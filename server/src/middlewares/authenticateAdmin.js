
// middlewares/authenticateAdmin.js
import jwt from "jsonwebtoken";
import asyncHandler from "./asyncHandler.js";
import AppError from "../utils/AppError.js";
import { userRepository } from "../config/repositories.js";
import logger from "../config/logger.js";
import { ENV } from "../config/env.js";
import { isTokenBlacklisted } from "../utils/tokenBlacklist.js";
import { ADMIN_COOKIE_ACCESS } from "../utils/authCookies.js";

export const isAdminAuthenticated = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[ADMIN_COOKIE_ACCESS];

  if (!token) {
    logger.warn("Admin auth attempt without token", { path: req.originalUrl, ip: req.ip });
    return next(new AppError("Access denied. Please log in to continue.", 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, ENV.ADMIN_ACCESS_TOKEN_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new AppError("Session expired. Please log in again.", 401));
    }
    return next(new AppError("Invalid token. Please log in again.", 401));
  }

  // ── Blacklist check ──────────────────────────────────────────────────────
  if (decoded.jti) {
    const blacklisted = await isTokenBlacklisted(decoded.jti);
    if (blacklisted) {
      logger.warn("Blacklisted admin token used", {
        userId: decoded._id,
        jti:    decoded.jti,
        path:   req.originalUrl,
        ip:     req.ip,
      });
      return next(new AppError("Session has been invalidated. Please log in again.", 401));
    }
  }

  // ── User fetch (repository-backed) ───────────────────────────────────────
  const user = await userRepository.findById(decoded._id, {
    select: {
      id:               true,
      email:            true,
      username:         true,
      fullName:         true,
      role:             true,
      accountStatus:    true,
      lastActiveAt:     true,
      avatar:           true,
      isEmailVerified:  true,
      isMobileVerified: true,
      authProvider:     true,
      // password, firebaseUid excluded intentionally
    },
  });

  if (!user) return next(new AppError("User no longer exists.", 401));

  // ── Role check — DB se verify, token pe trust nahi ──────────────────────
  if (user.role !== "super_admin") {
    logger.warn("Non-admin tried admin route", {
      userId: user.id,
      role:   user.role,
      path:   req.originalUrl,
    });
    return next(new AppError("Access denied. Admin privileges required.", 403));
  }

  if (user.accountStatus === "banned")
    return next(new AppError("This account has been permanently banned.", 403));
  if (user.accountStatus === "suspended")
    return next(new AppError("This account is temporarily suspended.", 403));
  if (user.accountStatus === "deactivated")
    return next(new AppError("This account has been deactivated.", 403));

  req.user = user;

  // ── lastActiveAt update (throttled, 5 min) ───────────────────────────────
  const FIVE_MIN   = 5 * 60 * 1000;
  const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt) : null;
  if (!lastActive || Date.now() - lastActive.getTime() > FIVE_MIN) {
    // Fire-and-forget, unchanged: a failed lastActiveAt touch must never
    // block an authenticated request.
    userRepository.update(user.id, { lastActiveAt: new Date() }).catch(() => {});
  }

  logger.debug("Admin authenticated", { userId: user.id, path: req.originalUrl });

  next();
});