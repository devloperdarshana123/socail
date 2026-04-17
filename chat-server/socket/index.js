const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const chatHandler = require("./chatHandler");
const notificationHandler = require("./notificationHandler");

let io;

const initSocket = (server) => {
  const ALLOWED_ORIGINS = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",")
  : ["http://localhost:5173", "http://localhost:5174"];

io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  },
});

  // JWT auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Unauthorized"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    socket.join(userId);
    console.log(`✅ User connected: ${userId}`);

    chatHandler(io, socket);
    notificationHandler(io, socket);

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${userId}`);
    });
  });

  return io;
};

const getIO = () => io;

module.exports = { initSocket, getIO };