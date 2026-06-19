


// src/socket/index.js
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import chatHandler from "./handlers/Chathandler.js";
import notificationHandler from "./handlers/notificationHandler.js";
import logger from "../utils/logger.js";
import { addSocket, removeSocket } from "../services/onlineStore.js";
let io;

// ── Admin Namespace ──────────────────────────────────────────────────────────
const initAdminNamespace = (io) => {
  const adminNsp = io.of("/admin");

  adminNsp.use((socket, next) => {
    let token = socket.handshake.auth?.token;

    if (!token) {
      const cookies = cookie.parse(socket.handshake.headers.cookie || "");
      token = cookies.adminAccessToken;
    }

    if (!token) return next(new Error("Unauthorized"));

    try {
      const decoded = jwt.verify(token, process.env.ADMIN_ACCESS_TOKEN_SECRET);
      const validRoles = ["admin", "super_admin", "moderator"];

      if (!validRoles.includes(decoded.role)) {
        return next(new Error("Forbidden"));
      }

      socket.admin = decoded;
      next();
    } catch (err) {
      logger.error("❌ Admin JWT Error", { message: err.message });
      return next(new Error("Invalid token"));
    }
  });

  adminNsp.on("connection", (socket) => {
    const adminId = (socket.admin._id || socket.admin.id)?.toString();
    logger.info(`🛡️ Admin connected: ${adminId} [${socket.admin.role}]`);

    socket.join("admin_room");
    logger.info(`🛡️ Admin joined admin_room: ${adminId}`);

    socket.on("disconnect", (reason) => {
      logger.info(`🛡️ Admin disconnected: ${adminId} — ${reason}`);
    });
  });

  return adminNsp;
};

// ── Main Socket ──────────────────────────────────────────────────────────────
const initSocket = (server, pubClient, subClient) => {
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
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── JWT Auth Middleware ────────────────────────────────────────────────────
  io.use((socket, next) => {
    let token = socket.handshake.auth?.token;

    if (!token) {
      const cookies = cookie.parse(socket.handshake.headers.cookie || "");
      token = cookies.accessToken;
    }

    if (!token) return next(new Error("Unauthorized"));

    // try {
    //   const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
    //     ignoreExpiration: true,
    //   });

    //   const now       = Math.floor(Date.now() / 1000);
    //   const isExpired = decoded.exp && decoded.exp < now;

    //   if (isExpired) {
    //     logger.warn(`⚠️ Token expired for user: ${decoded._id}`);
    //     socket.user         = decoded;
    //     socket.tokenExpired = true;
    //   } else {
    //     socket.user         = decoded;
    //     socket.tokenExpired = false;
    //   }
try {
      let decoded;
      let isExpired = false;

      try {
        decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      } catch (err) {
        if (err.name === "TokenExpiredError") {
          decoded   = jwt.decode(token);
          isExpired = true;
          logger.warn(`⚠️ Token expired for user: ${decoded?._id}`);
        } else {
          throw err;
        }
      }

      if (!decoded) return next(new Error("Invalid token"));

      if (isExpired) {
        socket.user         = decoded;
        socket.tokenExpired = true;
      } else {
        socket.user         = decoded;
        socket.tokenExpired = false;
      }
      next();
    } catch (err) {
      logger.error("❌ JWT Error", { message: err.message });
      return next(new Error("Invalid token"));
    }
  });

  // ── Connection ─────────────────────────────────────────────────────────────
  io.on("connection",async (socket) => {
    const userId = (socket.user.id || socket.user._id)?.toString();
    if (!userId) {
      logger.error("❌ No userId in token — disconnecting");
      return socket.disconnect(true);
    }

    logger.info(`✅ User connected: ${userId}${socket.tokenExpired ? " (token expired)" : ""}`);
//     await addSocket(userId, socket.id);
// io.emit("user:online", { userId });

    if (socket.tokenExpired) {
      socket.emit("token:expired");
    }

    // ── Token refresh ──────────────────────────────────────────────────────
    socket.on("token:refresh", ({ token: newToken }) => {
      if (!newToken) return;
      try {
        const decoded       = jwt.verify(newToken, process.env.ACCESS_TOKEN_SECRET);
        socket.user         = decoded;
        socket.tokenExpired = false;
        logger.info(`🔄 Token refreshed for user: ${userId}`);
        socket.emit("token:refreshed");
      } catch (err) {
        logger.error("❌ Token refresh failed", { message: err.message });
        socket.emit("session_expired");
        socket.disconnect(true);
      }
    });

    // ── Handlers ──────────────────────────────────────────────────────────
    try {
      chatHandler(io, socket);
      notificationHandler(io, socket);
    } catch (err) {
      logger.error("❌ Handler init error", { err });
      socket.disconnect(true);
    }

  //   socket.on("disconnect", (reason) => {
  //     logger.info(`❌ User disconnected: ${userId} — reason: ${reason}`);
  //   });
  // });

  socket.on("disconnect", async (reason) => {
  logger.info(`❌ User disconnected: ${userId} — reason: ${reason}`);
  const isLastSocket = await removeSocket(userId, socket.id);
  if (isLastSocket) {
    io.emit("user:offline", { userId });
  }
});
  });

  initAdminNamespace(io);
  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};

export { initSocket, getIO };