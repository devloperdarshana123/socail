
// // import express from "express";
// // import cors from "cors";
// // import morgan from "morgan";
// // import { createServer } from "http";

// // import connectDB from "./config/db.js";
// // import { initSocket } from "./socket.js"; // ← NEW

// // import authRoutes        from "./routes/auth.routes.js";
// // import postRoutes        from "./routes/post.routes.js";
// // import followRoutes      from "./routes/follow.routes.js";
// // import marketplaceRoutes from "./routes/marketplace.routes.js";
// // import settingsRoutes    from "./routes/settings.routes.js";
// // import messageRoutes     from "./routes/message.routes.js";
// // import storyRoutes from "./routes/story.js";
// // import locationRoutes from "./routes/location.routes.js";
// // import chatRoutes from "./routes/chat.routes.js";
// // import notificationRoutes from "./routes/notification.routes.js";

// // const app        = express();
// // const httpServer = createServer(app);
// // const PORT       = process.env.PORT || 8001;

// // const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
// //   ? process.env.ALLOWED_ORIGINS.split(",")
// //   : ["http://localhost:5173", "http://localhost:5174"];

// // // ── Socket.io Init ────────────────────────────────────────────────────────────
// // initSocket(httpServer, ALLOWED_ORIGINS); // ← socket.js handle karega

// // // ── Express Middleware ────────────────────────────────────────────────────────
// // app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
// // app.use(morgan("dev"));
// // app.use(express.json());
// // app.use(express.urlencoded({ extended: true }));

// // // ── REST Routes ───────────────────────────────────────────────────────────────
// // app.use("/api/auth",        authRoutes);
// // app.use("/api/posts",       postRoutes);
// // app.use("/api/follow",      followRoutes);
// // app.use("/api/settings",    settingsRoutes);
// // app.use("/api/messages",    messageRoutes);
// // app.use("/api/marketplace", marketplaceRoutes);
// // app.use("/api/stories", storyRoutes);
// // app.use("/api/chat", chatRoutes);
// // app.use("/api/notifications", notificationRoutes);
// // app.use("/api/location", locationRoutes);
// // // ── Health Check ──────────────────────────────────────────────────────────────
// // app.get("/", (_, res) => {
// //   res.json({ success: true, message: "🚀 EroSocial Server Running!" });
// // });

// // // ── Global Error Handler ──────────────────────────────────────────────────────
// // app.use((err, req, res, next) => {
// //   console.error(err.stack);
// //   res.status(err.status || 500).json({
// //     success: false,
// //     message: err.message || "Server Error",
// //   });
// // });

// // // ── Start ─────────────────────────────────────────────────────────────────────
// // connectDB().then(() => {
// //   httpServer.listen(PORT, () => {
// //     console.log(`✅ EroSocial Server running on http://localhost:${PORT}`);
// //   });
// // });


// import "dotenv/config";
// import express       from "express";
// import cors          from "cors";
// import helmet        from "helmet";
// import morgan        from "morgan";
// import cookieParser  from "cookie-parser";
// import rateLimit     from "express-rate-limit";
// import { createServer } from "http";

// import connectDB          from "./config/db.js";
// import { initSocket }     from "./socket.js";

// import authRoutes         from "./routes/auth.routes.js";
// import postRoutes         from "./routes/post.routes.js";
// import followRoutes       from "./routes/follow.routes.js";
// import marketplaceRoutes  from "./routes/marketplace.routes.js";
// import settingsRoutes     from "./routes/settings.routes.js";
// import messageRoutes      from "./routes/message.routes.js";
// import storyRoutes        from "./routes/story.js";
// import locationRoutes     from "./routes/location.routes.js";
// import chatRoutes         from "./routes/chat.routes.js";
// import notificationRoutes from "./routes/notification.routes.js";

// // ─────────────────────────────────────────────────────────────────────────────
// // App Setup
// // ─────────────────────────────────────────────────────────────────────────────
// const app        = express();
// const httpServer = createServer(app);
// const PORT       = process.env.PORT || 8001;
// const isProd     = process.env.NODE_ENV === "production";

// const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
//   ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
//   : ["http://localhost:5173", "http://localhost:5174"];

// // ─────────────────────────────────────────────────────────────────────────────
// // Socket.io
// // ─────────────────────────────────────────────────────────────────────────────
// initSocket(httpServer, ALLOWED_ORIGINS);

// // ─────────────────────────────────────────────────────────────────────────────
// // Security Middleware
// // ─────────────────────────────────────────────────────────────────────────────

// // Helmet — HTTP headers secure karo
// app.use(helmet({
//   crossOriginResourcePolicy: { policy: "cross-origin" }, // images/media ke liye
// }));

// // CORS
// app.use(cors({
//   origin:      ALLOWED_ORIGINS,
//   credentials: true,                  // cookies allow karo
//   methods:     ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// }));

// // Global rate limit — DDoS protection
// const globalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,  // 15 min
//   max:      300,              // per IP
//   message:  { success: false, message: "Too many requests from this IP." },
//   standardHeaders: true,
//   legacyHeaders:   false,
//   skip: (req) => !isProd,    // development mein skip karo
// });
// app.use(globalLimiter);

// // ─────────────────────────────────────────────────────────────────────────────
// // General Middleware
// // ─────────────────────────────────────────────────────────────────────────────
// app.use(cookieParser());                              // refresh token cookie ke liye
// app.use(express.json({ limit: "10mb" }));
// app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// // Logging — production mein 'combined' (structured), dev mein 'dev'
// app.use(morgan(isProd ? "combined" : "dev"));

// // ─────────────────────────────────────────────────────────────────────────────
// // Routes
// // ─────────────────────────────────────────────────────────────────────────────
// app.use("/api/auth",          authRoutes);
// app.use("/api/posts",         postRoutes);
// app.use("/api/follow",        followRoutes);
// app.use("/api/settings",      settingsRoutes);
// app.use("/api/messages",      messageRoutes);
// app.use("/api/marketplace",   marketplaceRoutes);
// app.use("/api/stories",       storyRoutes);
// app.use("/api/chat",          chatRoutes);
// app.use("/api/notifications", notificationRoutes);
// app.use("/api/location",      locationRoutes);

// // ─────────────────────────────────────────────────────────────────────────────
// // Health Check
// // ─────────────────────────────────────────────────────────────────────────────
// app.get("/health", (_, res) => {
//   res.json({
//     success: true,
//     status:  "ok",
//     env:     process.env.NODE_ENV,
//     time:    new Date().toISOString(),
//   });
// });

// // 404 handler — koi route match nahi hua
// app.use((req, res) => {
//   res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Global Error Handler
// // ─────────────────────────────────────────────────────────────────────────────
// // eslint-disable-next-line no-unused-vars
// app.use((err, req, res, next) => {
//   // Mongoose validation error
//   if (err.name === "ValidationError") {
//     const message = Object.values(err.errors).map((e) => e.message).join(", ");
//     return res.status(400).json({ success: false, message });
//   }

//   // Mongoose duplicate key
//   if (err.code === 11000) {
//     const field = Object.keys(err.keyValue)[0];
//     return res.status(409).json({
//       success: false,
//       message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
//     });
//   }

//   // JWT errors
//   if (err.name === "JsonWebTokenError")  {
//     return res.status(401).json({ success: false, message: "Invalid token" });
//   }
//   if (err.name === "TokenExpiredError") {
//     return res.status(401).json({ success: false, code: "TOKEN_EXPIRED", message: "Token expired" });
//   }

//   // Stack trace sirf development mein
//   if (!isProd) console.error(err.stack);

//   res.status(err.status || 500).json({
//     success: false,
//     message: isProd ? "Internal server error" : err.message,
//   });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Start Server
// // ─────────────────────────────────────────────────────────────────────────────
// connectDB().then(() => {
//   httpServer.listen(PORT, () => {
//     console.log(`✅ Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
//   });
// }).catch((err) => {
//   console.error("❌ DB connection failed:", err.message);
//   process.exit(1);
// });

// // Unhandled errors — crash nahi hone dena
// process.on("unhandledRejection", (err) => {
//   console.error("Unhandled Rejection:", err.message);
//   if (isProd) process.exit(1);
// });


import "dotenv/config";
import express      from "express";
import cors         from "cors";
import helmet       from "helmet";
import morgan       from "morgan";
import cookieParser from "cookie-parser";
import rateLimit    from "express-rate-limit";
import { createServer } from "http";
import { errorHandler } from "./middleware/error.middleware.js";

import connectDB          from "./config/db.js";
import { initSocket }     from "./socket.js";

import authRoutes         from "./routes/auth.routes.js";
import postRoutes         from "./routes/post.routes.js";
import followRoutes       from "./routes/follow.routes.js";
import marketplaceRoutes  from "./routes/marketplace.routes.js";
import settingsRoutes     from "./routes/settings.routes.js";
import messageRoutes      from "./routes/message.routes.js";
import storyRoutes        from "./routes/story.js";        // ✅ story.js → story.routes.js
import locationRoutes     from "./routes/location.routes.js";
import chatRoutes         from "./routes/chat.routes.js";       // ✅ chat.routes.js → chatbot.routes.js
import notificationRoutes from "./routes/notification.routes.js";

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

const app        = express();
const httpServer = createServer(app);
const PORT       = process.env.PORT || 8001;
const isProd     = process.env.NODE_ENV === "production";

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:5174"];

// ─────────────────────────────────────────────────────────────────────────────
// Socket.io
// ─────────────────────────────────────────────────────────────────────────────

initSocket(httpServer, ALLOWED_ORIGINS);

// ─────────────────────────────────────────────────────────────────────────────
// Security Middleware
// ─────────────────────────────────────────────────────────────────────────────

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },  // Cloudinary images ke liye
}));

app.use(cors({
  origin:         ALLOWED_ORIGINS,
  credentials:    true,
  methods:        ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Global rate limit — DDoS protection (sirf production mein)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      300,
  message:  { success: false, message: "Too many requests from this IP." },
  standardHeaders: true,
  legacyHeaders:   false,
  skip: () => !isProd,
});
app.use(globalLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// General Middleware
// ─────────────────────────────────────────────────────────────────────────────

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan(isProd ? "combined" : "dev"));
app.use(errorHandler);
// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

app.use("/api/auth",          authRoutes);
app.use("/api/posts",         postRoutes);
app.use("/api/follow",        followRoutes);
app.use("/api/settings",      settingsRoutes);
app.use("/api/messages",      messageRoutes);
app.use("/api/marketplace",   marketplaceRoutes);
app.use("/api/stories",       storyRoutes);
app.use("/api/chat",          chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/location",      locationRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────

app.get("/health", (_, res) => {
  res.json({
    success: true,
    status:  "ok",
    env:     process.env.NODE_ENV || "development",
    time:    new Date().toISOString(),
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─────────────────────────────────────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Mongoose validation error
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors).map((e) => e.message).join(", ");
    return res.status(400).json({ success: false, message });
  }

  // Duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ success: false, code: "TOKEN_EXPIRED", message: "Token expired" });
  }

  if (!isProd) console.error(err.stack);

  res.status(err.status || 500).json({
    success: false,
    message: isProd ? "Internal server error" : err.message,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
  });
}).catch((err) => {
  console.error("❌ DB connection failed:", err.message);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err.message);
  if (isProd) process.exit(1);
});