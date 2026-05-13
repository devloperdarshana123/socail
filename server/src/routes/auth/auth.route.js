import express from "express";
import {
  register,
  verifyOtp,
  resendOtp,
  login,
  logout,
  refreshToken,
  getMe,
} from "../../controllers/auth/auth.controller.js";
import { isAuthenticated } from "../../middlewares/auth.js";

const router = express.Router();

// ─────────────────────────────────────────────
//  Public Routes — No token required
// ─────────────────────────────────────────────

// Step 1 — Register: user banao, OTP bhejo
router.post("/register", register);

// Step 2 — OTP verify karo, token milega
router.post("/verify-otp", verifyOtp);

// OTP resend — cooldown + max resend check ke saath
router.post("/resend-otp", resendOtp);

// Login — email + password
router.post("/login", login);

// Refresh token — naya access token lo
router.post("/refresh-token", refreshToken);

// ─────────────────────────────────────────────
//  Protected Routes — Token required
// ─────────────────────────────────────────────

// Current user info + onboarding resume route
router.get("/me", isAuthenticated, getMe);

// Logout — current device se
router.post("/logout", isAuthenticated, logout);

export default router;
