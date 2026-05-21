import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import User from "../../models/user.model.js";
import { sendToken } from "../../utils/sendToken.js";
import logger from "../../config/logger.js";
import jwt from "jsonwebtoken";


// ─────────────────────────────────────────────

export const adminLogin = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // ── 1. Validation ────────────────────────────────────────────
  if (!email?.trim() || !password) {
    return next(new AppError("Email and password are required", 400));
  }

  // ── 2. User fetch (password explicitly select karo) ──────────
  const user = await User.findByEmail(email).select("+password");

  if (!user) {
    return next(new AppError("Invalid email or password", 401));
  }

  // ── 3. Password check ────────────────────────────────────────
  const isMatch = await user.isPasswordCorrect(password);
  if (!isMatch) {
    logger.warn("Admin failed login attempt", { email, ip: req.ip });
    return next(new AppError("Invalid email or password", 401));
  }

  // ── 4. Role check — sirf super_admin ─────────────────────────
  if (user.role !== "super_admin") {
    logger.warn("Unauthorized admin login attempt", {
      userId: user._id,
      role: user.role,
      ip: req.ip,
    });
    return next(
      new AppError("Access denied. Admin privileges required.", 403),
    );
  }

  // ── 5. Account status checks ─────────────────────────────────
  if (user.accountStatus === "banned") {
    return next(new AppError("This account has been permanently banned.", 403));
  }

  if (user.accountStatus === "suspended") {
    return next(new AppError("This account is temporarily suspended.", 403));
  }

  if (user.accountStatus === "deactivated") {
    return next(new AppError("This account has been deactivated.", 403));
  }

  logger.info("Admin logged in", {
    userId: user._id,
    email: user.email,
    role: user.role,
  });

  // ── 6. Token bhejo ───────────────────────────────────────────
  await sendToken(
    user,
    200,
    res,
    {
      message: "Admin login successful",
      nextRoute: "/dashboard",
      deviceInfo: req.headers["user-agent"] || "unknown",
      ipAddress: req.ip,
    },
    next,
  );
});

// ─────────────────────────────────────────────
//  POST /admin/auth/logout
//
//  Protected — isAuthenticated + isAdmin middleware
//  Current device ka refresh token remove karo
// ─────────────────────────────────────────────

export const adminLogout = asyncHandler(async (req, res, next) => {
  const incomingRefreshToken = req.cookies?.refreshtoken;

  if (incomingRefreshToken) {
    const userWithTokens = await User.findById(req.user._id).select(
      "+refreshTokens",
    );
    if (userWithTokens) {
      await userWithTokens.removeRefreshToken(incomingRefreshToken);
    }
  }

  const isProduction = process.env.NODE_ENV === "production";

  const cookieOptions = {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  };

  logger.info("Admin logged out", { userId: req.user._id });

  return res
    .status(200)
    .clearCookie("accesstoken", cookieOptions)
    .clearCookie("refreshtoken", cookieOptions)
    .json({
      success: true,
      message: "Logged out successfully",
    });
});

// ─────────────────────────────────────────────
//  POST /admin/auth/refresh-token
//
//  Refresh token se naya access token lo
//  Same rotation pattern as main auth
// ─────────────────────────────────────────────

export const adminRefreshToken = asyncHandler(async (req, res, next) => {
  const incomingRefreshToken = req.cookies?.refreshtoken;

  if (!incomingRefreshToken) {
    return next(
      new AppError("Refresh token missing. Please log in again.", 401),
    );
  }

  // ── Verify karo ──────────────────────────────────────────────
  let decoded;
  try {
    decoded = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );
  } catch (err) {
    return next(
      new AppError("Invalid or expired refresh token. Please log in again.", 401),
    );
  }

  // ── User fetch ───────────────────────────────────────────────
  const user = await User.findById(decoded._id).select(
    "+refreshTokens +refreshTokens.token",
  );

  if (!user) {
    return next(new AppError("User not found.", 401));
  }

  // ── Role re-verify (token mein role nahi hota — DB se check) ─
  if (user.role !== "super_admin") {
    return next(new AppError("Access denied.", 403));
  }

  // ── Token valid hai? ─────────────────────────────────────────
  const now = new Date();
  const storedToken = user.refreshTokens.find(
    (t) => t.token === incomingRefreshToken && t.expiresAt > now,
  );

  if (!storedToken) {
    logger.warn("Admin refresh token reuse or expired", { userId: user._id });
    return next(new AppError("Session invalid. Please log in again.", 401));
  }

  // ── Rotate tokens ────────────────────────────────────────────
  await user.removeRefreshToken(incomingRefreshToken);
  const newAccessToken = user.generateAccessToken();
  const newRefreshToken = await user.generateRefreshToken(
    storedToken.deviceInfo,
    storedToken.ipAddress,
  );

  const isProduction = process.env.NODE_ENV === "production";

  const accessTokenOptions = {
    expires: new Date(Date.now() + 15 * 60 * 1000),
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  };

  const refreshTokenOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  };

  logger.info("Admin access token refreshed", { userId: user._id });

  return res
    .status(200)
    .cookie("accesstoken", newAccessToken, accessTokenOptions)
    .cookie("refreshtoken", newRefreshToken, refreshTokenOptions)
    .json({
      success: true,
      message: "Token refreshed successfully",
      ...(process.env.NODE_ENV === "production"
        ? {}
        : { accessToken: newAccessToken }),
    });
});

// ─────────────────────────────────────────────
//  GET /admin/auth/me
//
//  Protected — isAuthenticated + isAdmin
//  Current admin ka data return karo
// ─────────────────────────────────────────────

export const getAdminMe = asyncHandler(async (req, res, next) => {
  const user = req.user;

  return res.status(200).json({
    success: true,
    data: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      role: user.role,
      avatar: user.avatar,
    },
  });
});