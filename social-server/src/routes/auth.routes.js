
import express from "express";
import rateLimit from "express-rate-limit";

import {
  register,
  verifyEmail,
  resendOtp,
  login,
  googleAuth,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
  searchUsers,
  suspendUser,
  unsuspendUser,
  warnUser,
} from "../controllers/auth.controller.js";

import { protect, adminOnly, superAdminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiters
// ─────────────────────────────────────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  { success: false, message: "Too many attempts. Try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders:   false,
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      30,
  message:  { success: false, message: "Too many requests. Slow down." },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ─────────────────────────────────────────────────────────────────────────────
// Public Routes
// ─────────────────────────────────────────────────────────────────────────────

router.post("/register",        authLimiter, register);
router.post("/verify-email",    authLimiter, verifyEmail);
router.post("/resend-otp",      authLimiter, resendOtp);
router.post("/login",           authLimiter, login);
router.post("/google",          authLimiter, googleAuth);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password",  authLimiter, resetPassword);
router.post("/refresh",         refreshAccessToken);   // cookie se — public

// ─────────────────────────────────────────────────────────────────────────────
// Protected Routes
// ─────────────────────────────────────────────────────────────────────────────

router.post("/logout", protect, logout);
router.get("/me",      protect, getMe);

router.get("/users/search", protect, searchLimiter, searchUsers);

// ─────────────────────────────────────────────────────────────────────────────
// Admin Routes
// ─────────────────────────────────────────────────────────────────────────────

router.put(   "/admin/users/:userId/suspend",   protect, adminOnly,      suspendUser);
router.put(   "/admin/users/:userId/unsuspend", protect, adminOnly,      unsuspendUser);
router.put(   "/admin/users/:userId/warn",      protect, adminOnly,      warnUser);

export default router;