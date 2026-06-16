
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";

import {
  authRouteLimiter,
  adminAuthRouteLimiter,
  transcribeLimiter,
  globalRouteLimiter,
} from "./middlewares/rateLimiter.js";
import mongoose from "mongoose";
import authRoute from "./routes/auth/auth.route.js";
import globalErrorHandler from "./middlewares/globalErrorHandler.js";
import AppError from "./utils/AppError.js";
import consentRouter from "./routes/auth/consent.route.js";
import onboardingRoute from "./routes/auth/onboarding.route.js";
import postRouter from "./routes/auth/post.route.js";
import userRouter from "./routes/auth/user.route.js";
import likeRouter from "./routes/auth/like.route.js";
import commentRouter from "./routes/auth/Comment.route.js";
import savedRouter from "./routes/auth/saved.route.js";
import settingRoute from "./routes/auth/setting.route.js";
import exploreRoute from "./routes/auth/explore.route.js";
import chatRoute from "./routes/auth/chat.route.js";
import storyRouter from "./routes/auth/story.route.js";
import followRouter from "./routes/auth/follow.route.js";
import messageRouter from "./routes/auth/message.route.js";
import notificationRoutes from "./routes/auth/notification.route.js";
import transcribeRoute from "./routes/auth/transcribe.route.js";
import reportRouter from "./routes/auth/report.route.js";
import "./cron/suspensionCron.js";


//admin//
import adminAuthRoute from "./routes/admin/admin.auth.route.js";
import adminSettingsRoute from "./routes/admin/admin.settings.route.js";
import adminUserRoute from "./routes/admin/admin.user.routes.js";
import adminReportRoute from "./routes/admin/admin.report.routes.js";
import dashboardRoutes from "./routes/admin/admin.dashboard.route.js";
import auditLogRoute from "./routes/admin/admin.auditlog.route.js";
import commentRoutes from "./routes/admin/admin.comment.routes.js";
import adminNotificationRoute from "./routes/admin/adminNotification.routes.js";
const app = express();

// ── Security ──
app.use(helmet());
app.use(compression());



const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:5174"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-platform"],
    exposedHeaders: ["set-cookie"],
  }),
);
// ── Body Parsers ──
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// CHANGE 2: Request logging — har request log hogi
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}




app.use("/api/", globalRouteLimiter);
app.use("/api/v2/auth/login", authRouteLimiter);
app.use("/api/v2/auth/register", authRouteLimiter);
app.use("/api/v2/auth/forgot-password", authRouteLimiter);

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
app.use("/api/v2/user/report", reportRouter);

app.use("/api/v2/transcribe", transcribeLimiter);
app.use("/api/v2/transcribe", transcribeRoute);
app.use("/api/v2/admin/login", adminAuthRouteLimiter);
app.use("/api/v2/admin/auth", adminAuthRoute);
app.use("/api/v2/admin/dashboard", dashboardRoutes);
app.use("/api/v2/admin/comments", commentRoutes);
app.use("/api/v2/admin/notifications", adminNotificationRoute);
app.use("/api/v2/admin",      adminUserRoute); 
app.use("/api/v2/admin", adminReportRoute);
app.use("/api/v2/admin/settings", adminSettingsRoute);
app.use("/api/v2/admin/audit-logs", auditLogRoute);




// ── 404 Handler ──
app.all("/{*splat}", (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// ── Global Error Handler ──
app.use(globalErrorHandler);

export default app;