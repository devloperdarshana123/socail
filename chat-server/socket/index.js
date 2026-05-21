// chat-server/socket/index.js
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import chatHandler from "./Chathandler.js";
import notificationHandler from "./notificationHandler.js";

let io;

const initSocket = (server) => {
  const ALLOWED_ORIGINS = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",")
    : ["http://localhost:5173", "http://localhost:5174"];

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) callback(null, true);
        else callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    },
    // ✅ Production: ping timeout badha do — mobile networks ke liye
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── JWT Auth Middleware ──────────────────────────────────────────────────
  // ignoreExpiration: true — kyunki HTTP aur Socket lifecycle alag hain.
  // Expire hone par disconnect nahi karenge — client apne aap naya token bhejega.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    console.log("🔑 Token received:", token ? "YES" : "NO");
    if (!token) return next(new Error("Unauthorized"));

    try {
      // ✅ ignoreExpiration: true — expire token pe bhi connect karne do
      // Real auth check har sensitive action pe karenge (Chathandler mein)
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
        ignoreExpiration: true,
      });

      const now = Math.floor(Date.now() / 1000);
      const isExpired = decoded.exp && decoded.exp < now;

      if (isExpired) {
        // ✅ Expired but connected — client ko signal bhejo token refresh karne ka
        console.log(`⚠️ Token expired for user: ${decoded._id} — allowing connect, signaling refresh`);
        socket.user = decoded;
        socket.tokenExpired = true; // flag rakho
      } else {
        console.log("✅ Token decoded:", decoded);
        socket.user = decoded;
        socket.tokenExpired = false;
      }

      next();
    } catch (err) {
      console.log("❌ JWT Error:", err.message);
      return next(new Error("Invalid token"));
    }
  });

  // ── Connection ───────────────────────────────────────────────────────────
  io.on("connection", (socket) => {
    const userId = (socket.user.id || socket.user._id)?.toString();
    if (!userId) {
      console.error("❌ No userId in token — disconnecting");
      return socket.disconnect(true);
    }

    console.log(`✅ User connected: ${userId}${socket.tokenExpired ? " (token expired — awaiting refresh)" : ""}`);

    // ✅ Token expire tha — client ko immediately signal karo
    if (socket.tokenExpired) {
      socket.emit("token:expired"); // frontend handle karega
    }

    // ── Token refresh event — client naya token bhejta hai ──────────────
    socket.on("token:refresh", ({ token: newToken }) => {
      if (!newToken) return;
      try {
        const decoded = jwt.verify(newToken, process.env.ACCESS_TOKEN_SECRET);
        socket.user = decoded;
        socket.tokenExpired = false;
        console.log(`🔄 Token refreshed for user: ${userId}`);
        socket.emit("token:refreshed"); // ✅ confirm karo client ko
      } catch (err) {
        console.log("❌ Token refresh failed:", err.message);
        socket.emit("session_expired"); // ab logout karo
        socket.disconnect(true);
      }
    });

    // ── Handlers ────────────────────────────────────────────────────────
    try {
      chatHandler(io, socket);
      notificationHandler(io, socket);
    } catch (err) {
      console.error("Handler init error:", err);
      socket.disconnect(true);
    }

    socket.on("disconnect", (reason) => {
      console.log(`❌ User disconnected: ${userId} — reason: ${reason}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};

export { initSocket, getIO };