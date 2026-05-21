
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

import authRoute from "./routes/auth/auth.route.js";
import globalErrorHandler from "./middlewares/globalErrorHandler.js";
import AppError from "./utils/AppError.js";
import consentRouter from "./routes/auth/consent.route.js";
import onboardingRoute from "./routes/auth/onboarding.route.js";
import postRouter from "./routes/auth/post.route.js";
import userRouter from "./routes/auth/user.route.js";
import likeRouter from "./routes/auth/like.route.js";
import commentRouter from "./routes/auth/comment.route.js";
import savedRouter from "./routes/auth/saved.route.js";
import settingRoute from "./routes/auth/Setting.route.js";
import exploreRoute from "./routes/auth/Explore.route.js";
import chatRoute from "./routes/auth/chat.route.js";
import storyRouter from "./routes/auth/story.route.js";
import followRouter from "./routes/auth/follow.route.js";
import messageRouter from "./routes/auth/message.route.js";
import notificationRoutes from "./routes/auth/notification.route.js";
import transcribeRoute from "./routes/auth/Transcribe.route.js";


//admin//
import adminAuthRoute from "./routes/admin/Admin.auth.route.js";
import adminUserRoute from "./routes/admin/Admin.user.routes .js";

const app = express();

// ── Security ──
app.use(helmet());

// ── CORS ──
// CHANGE 1: Single URL ki jagah array — multiple origins support
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((o) => o.trim())
  : ["http://localhost:5173"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  }),
);

// ── Body Parsers ──
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// CHANGE 2: Request logging — har request log hogi
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

// CHANGE 3: Rate limiting — DDoS / brute force se bachao
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});

// Auth routes ke liye strict limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 15 min mein sirf 20 auth attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, please try again later." },
});



const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // sirf 10 attempts — admin panel sensitive hai
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many admin login attempts. Please try again later." },
});

app.use("/api/", globalLimiter);
app.use("/api/v2/auth/login", authLimiter);
app.use("/api/v2/auth/register", authLimiter);
app.use("/api/v2/auth/forgot-password", authLimiter);

// ── Health Check — CHANGE 4: DB status bhi check karo ──
app.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.status(200).json({
    status: "ok",
    db: dbState,
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV,
  });
});

// ── Routes ──
app.use("/api/v2/auth", authRoute);
app.use("/api/v2/consent", consentRouter);
app.use("/api/v2/onboarding", onboardingRoute);
app.use("/api/v2/posts", postRouter);
app.use("/api/v2/user", userRouter);
app.use("/api/v2/likes", likeRouter);
app.use("/api/v2/comments", commentRouter);
app.use("/api/v2/saved", savedRouter);
app.use("/api/v2/settings", settingRoute);
app.use("/api/v2/explore", exploreRoute);
app.use("/api/v2/chat", chatRoute);
app.use("/api/v2/messages", messageRouter);
app.use("/api/v2/stories", storyRouter);
app.use("/api/v2/follow", followRouter);
app.use("/api/v2/notifications", notificationRoutes);
app.use("/api/v2/transcribe", rateLimit({
  windowMs: 60 * 1000, 
  max: 10,             
  message: { success: false, message: "Too many voice requests." }
}));
app.use("/api/v2/transcribe", transcribeRoute);

app.use("/api/v2/admin/login", adminAuthLimiter);
app.use("/api/v2/admin/auth", adminAuthRoute);
app.use("/api/v2/admin",      adminUserRoute); 


// ── 404 Handler ──
app.all("/{*splat}", (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// ── Global Error Handler ──
app.use(globalErrorHandler);

export default app;