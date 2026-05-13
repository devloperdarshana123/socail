import jwt from "jsonwebtoken";
import asyncHandler from "./asyncHandler.js";
import AppError from "../utils/AppError.js";
import User from "../models/user.model.js";
import logger from "../config/logger.js";

// ─────────────────────────────────────────────
//  isAuthenticated — Verify Access Token
//
//  Blocks:
//    - No token
//    - Invalid / expired token
//    - User deleted
//    - Banned / suspended / deactivated
//
//  NOTE: "pending" users ARE allowed here —
//  onboarding routes pe pending user ko access chahiye
//  (OTP verify ke baad token milta hai, accountStatus still "pending")
//  accountStatus "pending" block → sirf protected non-onboarding routes pe
//  use "isActive" middleware additionally
// ─────────────────────────────────────────────

export const isAuthenticated = asyncHandler(async (req, res, next) => {
  // 1. Token extract karo — cookie ya Authorization header se
  const accessToken =
    req.cookies?.accesstoken ||
    req.headers?.authorization?.replace("Bearer ", "").trim();

  if (!accessToken) {
    logger.warn("Auth attempt without token", {
      path: req.originalUrl,
      ip: req.ip,
    });
    return next(new AppError("Access denied. Please log in to continue.", 401));
  }

  // 2. Token verify karo
  let decoded;
  try {
    decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      logger.warn("Expired access token used", {
        path: req.originalUrl,
        ip: req.ip,
      });
      return next(new AppError("Session expired. Please log in again.", 401));
    }
    logger.warn("Invalid access token used", {
      path: req.originalUrl,
      ip: req.ip,
    });
    return next(new AppError("Invalid token. Please log in again.", 401));
  }

  // 3. User DB se fetch karo
  const user = await User.findById(decoded._id).select(
    "-password -refreshTokens -firebaseUid",
  );

  if (!user) {
    logger.warn("Token valid but user not found", { userId: decoded._id });
    return next(new AppError("User no longer exists.", 401));
  }

  // 4. Hard blocks — yeh kisi bhi route pe nahi jaane chahiye
  if (user.accountStatus === "banned") {
    logger.warn("Banned user attempted access", { userId: user._id });
    return next(new AppError("Your account has been permanently banned.", 403));
  }

  if (user.accountStatus === "suspended") {
    return next(new AppError("Your account is temporarily suspended.", 403));
  }

  if (user.accountStatus === "deactivated") {
    return next(new AppError("Your account has been deactivated.", 403));
  }

  // NOTE: "pending" yahan block NAHI kiya — onboarding ke liye allow hai
  // Sirf feed/protected routes pe "isActive" middleware lagao

  // 5. req.user set karo
  req.user = user;

  logger.info("User authenticated", {
    userId: user._id,
    username: user.username,
    accountStatus: user.accountStatus,
    path: req.originalUrl,
  });

  next();
});

// ─────────────────────────────────────────────
//  isActive — accountStatus "active" check
//
//  Use: feed, posts, follow — koi bhi feature route
//  Don't use on: onboarding routes
// ─────────────────────────────────────────────

export const isActive = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError("Authentication required.", 401));
  }

  if (req.user.accountStatus !== "active") {
    return next(
      new AppError(
        "Please complete your account setup before continuing.",
        403,
      ),
    );
  }

  next();
});

// ─────────────────────────────────────────────
//  isOnboardingPending — sirf onboarding step 2 wale users allow
//
//  Use: /onboarding/username routes pe
//  Step 2 = OTP verified, username baaki hai
// ─────────────────────────────────────────────

export const isOnboardingPending = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError("Authentication required.", 401));
  }

  // Agar onboarding already complete hai
  if (req.user.isOnboardingComplete) {
    return next(new AppError("Onboarding already completed.", 400));
  }

  // Step 1 pe hai matlab OTP verify nahi kiya abhi
  if (req.user.onboardingStep < 2) {
    return next(new AppError("Please verify your email/phone first.", 403));
  }

  next();
});

// ─────────────────────────────────────────────
//  authorizeRoles — Role-based Access Control
//
//  Usage: router.delete("/post/:id", isAuthenticated, authorizeRoles("admin"), ...)
// ─────────────────────────────────────────────

export const authorizeRoles = (...roles) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required.", 401));
    }

    if (!roles.includes(req.user.role)) {
      logger.warn("Unauthorized role access attempt", {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.originalUrl,
      });
      return next(
        new AppError("You do not have permission to perform this action.", 403),
      );
    }

    next();
  });
};

// ─────────────────────────────────────────────
//  isVerified — Email/Phone Verification Check
//
//  Use jab specific feature ke liye verified hona zaroori ho
// ─────────────────────────────────────────────

export const isVerified = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError("Authentication required.", 401));
  }

  const { authProvider, isEmailVerified, isMobileVerified } = req.user;

  const verified =
    (authProvider === "email" && isEmailVerified) ||
    (authProvider === "phone" && isMobileVerified) ||
    authProvider === "google"; // Google OAuth → auto-verified

  if (!verified) {
    return next(
      new AppError(
        "Please verify your email or phone number to access this feature.",
        403,
      ),
    );
  }

  next();
});
