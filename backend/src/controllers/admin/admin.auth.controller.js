

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import * as AdminAuthHelper from "../../utils/adminAuthHelpers.js";
import { sendAdminToken }    from "../../utils/sendAdminToken.js";
import { clearAdminCookies } from "../../utils/authCookies.js";
import { ADMIN_COOKIE_ACCESS, ADMIN_COOKIE_REFRESH } from "../../utils/authCookies.js";
import logger  from "../../config/logger.js";
import jwt     from "jsonwebtoken";
import crypto  from "crypto";
import bcrypt  from "bcryptjs";
import { ENV } from "../../config/env.js";
import { blacklistToken, generateJti } from "../../utils/tokenBlacklist.js";
import redis from "../../config/redis.js";

// ─────────────────────────────────────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function verifyPassword(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

// ═════════════════════════════════════════════
//  POST /admin/auth/login
// ═════════════════════════════════════════════

export const adminLogin = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return next(new AppError("Email and password are required", 400));
  }

  // Prisma: findUnique by email
  const user = await AdminAuthHelper.findAdminByEmail(email.trim().toLowerCase());

  if (!user || !user.password) {
    return next(new AppError("Invalid email or password", 401));
  }

  const isMatch = await verifyPassword(password, user.password);
  if (!isMatch) {
    logger.warn("Admin failed login attempt", { email, ip: req.ip });
    return next(new AppError("Invalid email or password", 401));
  }

  if (user.role !== "super_admin") {
    logger.warn("Unauthorized admin login attempt", { userId: user.id, role: user.role, ip: req.ip });
    return next(new AppError("Access denied. Admin privileges required.", 403));
  }

  if (user.accountStatus === "banned")      return next(new AppError("This account has been permanently banned.", 403));
  if (user.accountStatus === "suspended")   return next(new AppError("This account is temporarily suspended.", 403));
  if (user.accountStatus === "deactivated") return next(new AppError("This account has been deactivated.", 403));

  logger.info("Admin logged in", { userId: user.id, email: user.email, role: user.role });

  // sendAdminToken expects a user object — pass prisma user directly
  await sendAdminToken(user, 200, res, {
    message:    "Admin login successful",
    nextRoute:  "/dashboard",
    deviceInfo: req.headers["user-agent"] || "unknown",
    ipAddress:  req.ip,
  }, next);
});

// ═════════════════════════════════════════════
//  POST /admin/auth/logout
// ═════════════════════════════════════════════

export const adminLogout = asyncHandler(async (req, res, next) => {
  const incomingRefreshToken = req.cookies?.[ADMIN_COOKIE_REFRESH];
  const accessToken          = req.cookies?.[ADMIN_COOKIE_ACCESS];

  // Blacklist current access token
  if (accessToken) {
    try {
      const decoded = jwt.decode(accessToken);
      if (decoded?.jti && decoded?.exp) {
        await blacklistToken(decoded.jti, decoded.exp);
      }
    } catch { /* ignore */ }
  }

  // Remove refresh token from DB
  if (incomingRefreshToken) {
    const tokenHash = hashToken(incomingRefreshToken);
    await AdminAuthHelper.deleteAdminRefreshTokenByHash(req.user.id, tokenHash);
  }

  logger.info("Admin logged out", { userId: req.user.id });
  return clearAdminCookies(res).status(200).json({ success: true, message: "Logged out successfully" });
});

// ═════════════════════════════════════════════
//  POST /admin/auth/refresh-token
// ═════════════════════════════════════════════

export const adminRefreshToken = asyncHandler(async (req, res, next) => {
  const incomingRefreshToken = req.cookies?.[ADMIN_COOKIE_REFRESH];

  // ── Step 1: Cookie present? ──────────────────────────────────────────────
  if (!incomingRefreshToken) {
    logger.warn("Admin refresh: no refresh token cookie", { ip: req.ip });
    return next(new AppError("Refresh token missing. Please log in again.", 401));
  }

  // ── Step 2: JWT signature + expiry valid? ────────────────────────────────
  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, ENV.ADMIN_REFRESH_TOKEN_SECRET);
  } catch (err) {
    logger.warn("Admin refresh: JWT verify failed", { reason: err.message, ip: req.ip });
    return next(new AppError("Invalid or expired refresh token. Please log in again.", 401));
  }

  // ── Step 3: User exists in DB? ───────────────────────────────────────────
  const user = await AdminAuthHelper.findAdminById(decoded._id);

  if (!user) {
    logger.warn("Admin refresh: user not found", { userId: decoded._id });
    return next(new AppError("User not found.", 401));
  }

  // ── Step 4: Still an admin? ──────────────────────────────────────────────
  if (user.role !== "super_admin") {
    logger.warn("Admin refresh: role downgraded", { userId: user.id, role: user.role });
    return next(new AppError("Access denied.", 403));
  }

  // ── Step 5: Token hash in DB and not expired? ────────────────────────────
  const incomingHash = hashToken(incomingRefreshToken);
  const now          = new Date();

  const storedToken = await AdminAuthHelper.findValidAdminRefreshToken(user.id, incomingHash, now);

  if (!storedToken) {
    logger.warn("Admin refresh: token hash not found or expired", {
      userId:          user.id,
      hashPrefix:      incomingHash.slice(0, 8),
    });
    return next(new AppError("Session invalid. Please log in again.", 401));
  }

  // ── Account status check ─────────────────────────────────────────────────
  if (user.accountStatus === "banned" || user.accountStatus === "suspended") {
    await AdminAuthHelper.deleteAdminRefreshTokenById(storedToken.id);
    return next(new AppError("Your account has been suspended or banned.", 403));
  }

  // ── Step 6: Rotate — delete old, create new ──────────────────────────────
  await AdminAuthHelper.deleteAdminRefreshTokenById(storedToken.id);

  // Blacklist old access token
  const oldAccessToken = req.cookies?.[ADMIN_COOKIE_ACCESS];
  if (oldAccessToken) {
    try {
      const oldDecoded = jwt.decode(oldAccessToken);
      if (oldDecoded?.jti && oldDecoded?.exp) {
        await blacklistToken(oldDecoded.jti, oldDecoded.exp);
      }
    } catch { /* ignore */ }
  }

  // Generate new tokens
  // NOTE: generateAdminAccessToken / generateAdminRefreshToken are util functions
  // that only need user.id and user.role — adjust import path as needed
  const { generateAdminAccessToken, generateAdminRefreshToken } = await import("../../utils/userHelpers.js");

  const newAccessToken  = generateAdminAccessToken(user);
  const newRefreshToken = await generateAdminRefreshToken(user, {
    deviceInfo: storedToken.deviceInfo,
    ipAddress:  storedToken.ipAddress,
  });

  // ── Step 7: Set new cookies ──────────────────────────────────────────────
  const isProduction = process.env.NODE_ENV === "production";

  const baseCookieOptions = {
    httpOnly: true,
    path:     "/",
    sameSite: isProduction ? "none" : "lax",
    secure:   isProduction,
    ...(isProduction && process.env.COOKIE_DOMAIN
      ? { domain: process.env.COOKIE_DOMAIN }
      : {}),
  };

  // Clear Redis cache for this user
  await redis.del(`user:${user.id}`).catch(() => {});

  logger.info("Admin token refreshed", {
    userId:     user.id,
    deviceInfo: storedToken.deviceInfo,
  });

  return res
    .status(200)
    .cookie(ADMIN_COOKIE_ACCESS, newAccessToken, {
      ...baseCookieOptions,
      maxAge: 15 * 60 * 1000,          // 15 min
    })
    .cookie(ADMIN_COOKIE_REFRESH, newRefreshToken, {
      ...baseCookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
    .json({
      success: true,
      message: "Token refreshed successfully",
      ...(process.env.NODE_ENV === "development" && {
        _debug: { accessToken: newAccessToken },
      }),
    });
});

// ═════════════════════════════════════════════
//  GET /admin/auth/me  (protected)
// ═════════════════════════════════════════════

export const getAdminMe = asyncHandler(async (req, res) => {
  const { id, fullName, email, username, role, avatar } = req.user;
  return res.status(200).json({
    success: true,
    data:    { id, fullName, email, username, role, avatar },
  });
});

// ═════════════════════════════════════════════
//  GET /admin/auth/socket-token  (protected)
// ═════════════════════════════════════════════

export const getAdminSocketToken = asyncHandler(async (req, res) => {
  const token = jwt.sign(
    {
      _id:  req.user.id,
      id:   req.user.id,
      role: req.user.role,
      jti:  generateJti(),
    },
    ENV.ADMIN_ACCESS_TOKEN_SECRET,
    { expiresIn: "1m" },
  );

  return res.status(200).json({ success: true, data: { token } });
});