
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import User from "../../models/user.model.js";
import { sendToken, clearAuthCookies, COOKIE_REFRESH, COOKIE_ACCESS } from "../../utils/sendToken.js";
import logger from "../../config/logger.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { ENV } from "../../config/env.js";

// ─────────────────────────────────────────────
//  Internal helper — must match User model's hashToken
// ─────────────────────────────────────────────

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ═════════════════════════════════════════════
//  POST /admin/auth/login
// ═════════════════════════════════════════════

export const adminLogin = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return next(new AppError("Email and password are required", 400));
  }

  const user = await User.findByEmail(email).select("+password");
  if (!user) return next(new AppError("Invalid email or password", 401));

  const isMatch = await user.isPasswordCorrect(password);
  if (!isMatch) {
    logger.warn("Admin failed login attempt", { email, ip: req.ip });
    return next(new AppError("Invalid email or password", 401));
  }

  if (user.role !== "super_admin") {
    logger.warn("Unauthorized admin login attempt", { userId: user._id, role: user.role, ip: req.ip });
    return next(new AppError("Access denied. Admin privileges required.", 403));
  }

  if (user.accountStatus === "banned")      return next(new AppError("This account has been permanently banned.", 403));
  if (user.accountStatus === "suspended")   return next(new AppError("This account is temporarily suspended.", 403));
  if (user.accountStatus === "deactivated") return next(new AppError("This account has been deactivated.", 403));

  logger.info("Admin logged in", { userId: user._id, email: user.email, role: user.role });

  await sendToken(user, 200, res, {
    message   : "Admin login successful",
    nextRoute : "/dashboard",
    deviceInfo: req.headers["user-agent"] || "unknown",
    ipAddress : req.ip,
  }, next);
});

// ═════════════════════════════════════════════
//  POST /admin/auth/logout
// ═════════════════════════════════════════════

export const adminLogout = asyncHandler(async (req, res, next) => {
  const incomingRefreshToken = req.cookies?.[COOKIE_REFRESH];

  if (incomingRefreshToken) {
    const userWithTokens = await User.findById(req.user._id).select("+refreshTokens");
    if (userWithTokens) {
      // removeRefreshToken hashes the raw token internally — correct
      await userWithTokens.removeRefreshToken(incomingRefreshToken);
    }
  }

  logger.info("Admin logged out", { userId: req.user._id });
  return clearAuthCookies(res).status(200).json({ success: true, message: "Logged out successfully" });
});

// ═════════════════════════════════════════════
//  POST /admin/auth/refresh-token
// ═════════════════════════════════════════════

export const adminRefreshToken = asyncHandler(async (req, res, next) => {
  const incomingRefreshToken = req.cookies?.[COOKIE_REFRESH];

  if (!incomingRefreshToken) {
    return next(new AppError("Refresh token missing. Please log in again.", 401));
  }

  // Step 1 — verify JWT signature + expiry
  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, ENV.REFRESH_TOKEN_SECRET
);
  } catch {
    return next(new AppError("Invalid or expired refresh token. Please log in again.", 401));
  }

  // Step 2 — fetch user with refreshTokens
  const user = await User.findById(decoded._id).select("+refreshTokens");
  if (!user) return next(new AppError("User not found.", 401));

  // Step 3 — re-verify role from DB (never trust token payload for authorization)
  if (user.role !== "super_admin") {
    return next(new AppError("Access denied.", 403));
  }

  // Step 4 — look up by tokenHash (model stores hash, not raw token)
  const incomingHash = hashToken(incomingRefreshToken);
  const now          = new Date();
  const storedToken  = user.refreshTokens.find(
    (t) => t.tokenHash === incomingHash && t.expiresAt > now,
  );

  if (!storedToken) {
    logger.warn("Admin refresh token reuse or expired", { userId: user._id });
    return next(new AppError("Session invalid. Please log in again.", 401));
  }

  // Step 5 — rotate tokens
  await user.removeRefreshToken(incomingRefreshToken);
  const newAccessToken  = user.generateAccessToken();
  const newRefreshToken = await user.generateRefreshToken(
    storedToken.deviceInfo,
    storedToken.ipAddress,
  );

  const isProduction = process.env.NODE_ENV === "production";

  const accessTokenOptions = {
    maxAge  : 15 * 60 * 1000,
    httpOnly: true,
    path    : "/",
    sameSite: isProduction ? "none" : "lax",
    secure  : isProduction,
  };
  const refreshTokenOptions = {
    maxAge  : 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    path    : "/",
    sameSite: isProduction ? "none" : "lax",
    secure  : isProduction,
  };

  logger.info("Admin access token refreshed", { userId: user._id });

  return res
    .status(200)
    .cookie(COOKIE_ACCESS,  newAccessToken,  accessTokenOptions)
    .cookie(COOKIE_REFRESH, newRefreshToken, refreshTokenOptions)
    .json({
      success: true,
      message: "Token refreshed successfully",
      ...(process.env.NODE_ENV === "development" && { accessToken: newAccessToken }),
    });
});

// ═════════════════════════════════════════════
//  GET /admin/auth/me  (protected)
// ═════════════════════════════════════════════

export const getAdminMe = asyncHandler(async (req, res) => {
  const { _id, fullName, email, username, role, avatar } = req.user;
  return res.status(200).json({
    success: true,
    data   : { _id, fullName, email, username, role, avatar },
  });
});