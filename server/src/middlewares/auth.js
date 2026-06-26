

import jwt from "jsonwebtoken";
import asyncHandler from "./asyncHandler.js";
import AppError from "../utils/AppError.js";
import * as UserHelper from "../utils/userHelpers.js";
import logger from "../config/logger.js";
import { ENV } from "../config/env.js";
import { isTokenBlacklisted } from "../utils/tokenBlacklist.js";
import { USER_COOKIE_ACCESS } from "../utils/authCookies.js";
import redis from "../config/redis.js";
import prisma from "../config/prisma.js";

export const isAuthenticated = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  const accessToken =
    req.cookies?.[USER_COOKIE_ACCESS] ||
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);

  if (!accessToken) {
    logger.warn("Auth attempt without token", { path: req.originalUrl, ip: req.ip });
    return next(new AppError("Access denied. Please log in to continue.", 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(accessToken, ENV.USER_ACCESS_TOKEN_SECRET);
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
      logger.warn("Blacklisted token used", {
        userId: decoded._id,
        jti: decoded.jti,
        path: req.originalUrl,
        ip: req.ip,
      });
      return next(new AppError("Session has been invalidated. Please log in again.", 401));
    }
  }

  // ── User fetch with Redis cache ──────────────────────────────────────────
  let user;
  const cacheKey = `user:auth:${decoded._id}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const missingCriticalFields =
        !cached.accountStatus ||
        !cached.role ||
        cached.isOnboardingComplete === undefined;

      if (missingCriticalFields) {
        user = await UserHelper.findById(decoded._id);
        if (user) {
          const { password, ...safeForCache } = user;
          await redis.set(cacheKey, safeForCache, { ex: 300 });
        }
      } else {
        user = cached;
      }
    } else {
      user = await UserHelper.findById(decoded._id);
      if (user) {
        const { password, ...safeForCache } = user;
        await redis.set(cacheKey, safeForCache, { ex: 300 });
      }
    }
  } catch {
    user = await UserHelper.findById(decoded._id);
  }

  if (!user) {
    return next(new AppError("User no longer exists.", 401));
  }

  if (user.accountStatus === "banned") {
    return next(new AppError("Your account has been permanently banned.", 403));
  }
  if (user.accountStatus === "suspended") {
    return next(new AppError("Your account is temporarily suspended.", 403));
  }
  if (user.accountStatus === "deactivated") {
    return next(new AppError("Your account has been deactivated.", 403));
  }

  req.user = user;

  // ── lastActiveAt update (throttled, 5 min) ───────────────────────────────
  const FIVE_MIN = 5 * 60 * 1000;
  const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt) : null;
  if (!lastActive || Date.now() - lastActive.getTime() > FIVE_MIN) {
    const now = new Date();
    prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: now } }).catch(() => {});
    const { password, ...safeForCache } = user;
    redis.set(cacheKey, { ...safeForCache, lastActiveAt: now }, { ex: 300 }).catch(() => {});
  }

  logger.debug("User authenticated", { userId: user.id, path: req.originalUrl });

  next();
});

export const isAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user) return next(new AppError("Authentication required", 401));
  if (req.user.role !== "super_admin") {
    return next(new AppError("Access denied. Admin privileges required.", 403));
  }
  next();
});

export const isActive = asyncHandler(async (req, res, next) => {
  if (!req.user) return next(new AppError("Authentication required.", 401));
  if (req.user.accountStatus !== "active") {
    return next(new AppError("Please complete your account setup before continuing.", 403));
  }
  next();
});

export const isOnboardingPending = asyncHandler(async (req, res, next) => {
  if (!req.user) return next(new AppError("Authentication required.", 401));
  if (req.user.isOnboardingComplete) {
    return next(new AppError("Onboarding already completed.", 400));
  }
  if (req.user.onboardingStep < 2) {
    return next(new AppError("Please verify your email/phone first.", 403));
  }
  next();
});

export const authorizeRoles = (...roles) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) return next(new AppError("Authentication required.", 401));
    if (!roles.includes(req.user.role)) {
      logger.warn("Unauthorized role access", {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.originalUrl,
      });
      return next(new AppError("You do not have permission to perform this action.", 403));
    }
    next();
  });
};

export const isVerified = asyncHandler(async (req, res, next) => {
  if (!req.user) return next(new AppError("Authentication required.", 401));
  const { authProvider, isEmailVerified, isMobileVerified } = req.user;
  const verified =
    (authProvider === "email" && isEmailVerified) ||
    (authProvider === "phone" && isMobileVerified) ||
    authProvider === "google";
  if (!verified) {
    return next(new AppError("Please verify your email or phone number.", 403));
  }
  next();
});