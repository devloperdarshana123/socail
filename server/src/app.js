import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
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
const app = express();

// ── Security ──
app.use(helmet());

// ── CORS ──
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  }),
);

// ── Body Parsers ──
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Health Check ──
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
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
app.use("/api/v2/stories", storyRouter);

// ── 404 Handler ──
app.all("/{*splat}", (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// ── Global Error Handler ──
app.use(globalErrorHandler);

export default app;
