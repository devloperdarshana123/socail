import express from "express";
import {
  register,
  verifyOtp,
  resendOtp,
  login,
  logout,
  refreshToken,
  getMe,
   forgotPassword,  
  resetPassword,
   googleAuth, 
} from "../../controllers/auth/auth.controller.js";
import { isAuthenticated } from "../../middlewares/auth.js";
import {
  loginLimiter,
  otpResendLimiter,
  forgotPasswordLimiter,
} from "../../middlewares/rateLimiter.js";

const router = express.Router();

// ─────────────────────────────────────────────
//  Public Routes — No token required
// ─────────────────────────────────────────────


router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", otpResendLimiter, resendOtp);
router.post("/login",loginLimiter, login);
router.post("/google", googleAuth); 
router.post("/forgot-password",forgotPasswordLimiter, forgotPassword);
router.post("/refresh-token", refreshToken);

// ─────────────────────────────────────────────
//  Protected Routes — Token required
// ─────────────────────────────────────────────


router.get("/me", isAuthenticated, getMe);
router.post("/reset-password", isAuthenticated, resetPassword);
router.post("/logout", isAuthenticated, logout);

export default router;
