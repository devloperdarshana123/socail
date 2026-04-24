
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { createServer } from "http";

import connectDB from "./config/db.js";
import { initSocket } from "./socket.js"; // ← NEW

import authRoutes        from "./routes/auth.routes.js";
import postRoutes        from "./routes/post.routes.js";
import followRoutes      from "./routes/follow.routes.js";
import marketplaceRoutes from "./routes/marketplace.routes.js";
import settingsRoutes    from "./routes/settings.routes.js";
import messageRoutes     from "./routes/message.routes.js";
import storyRoutes from "./routes/story.js";
import locationRoutes from "./routes/location.routes.js";
import chatRoutes from "./routes/chat.routes.js";

const app        = express();
const httpServer = createServer(app);
const PORT       = process.env.PORT || 8001;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:5174"];

// ── Socket.io Init ────────────────────────────────────────────────────────────
initSocket(httpServer, ALLOWED_ORIGINS); // ← socket.js handle karega

// ── Express Middleware ────────────────────────────────────────────────────────
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── REST Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",        authRoutes);
app.use("/api/posts",       postRoutes);
app.use("/api/follow",      followRoutes);
app.use("/api/settings",    settingsRoutes);
app.use("/api/messages",    messageRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/location", locationRoutes);
// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/", (_, res) => {
  res.json({ success: true, message: "🚀 EroSocial Server Running!" });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Server Error",
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`✅ EroSocial Server running on http://localhost:${PORT}`);
  });
});