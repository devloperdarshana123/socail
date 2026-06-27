
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import logger from "../../config/logger.js";
import * as SettingsHelper from "../../utils/settingsHelpers.js";
import * as UserHelper from "../../utils/userHelpers.js";
import redis from "../../config/redis.js";
import prisma from "../../config/prisma.js";
import { sendUserToken } from "../../utils/sendUserToken.js";

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ─────────────────────────────────────────────
//  GET /api/v2/settings/me
//  Logged-in user ka profile fetch karo
// ─────────────────────────────────────────────

export const getMyProfile = asyncHandler(async (req, res, next) => {
  const user = await SettingsHelper.getUserProfile(req.user.id);

  if (!user) {
    return next(new AppError("User not found.", 404));
  }

  return res.status(200).json({
    success: true,
    message: "Profile fetched successfully.",
    data: { user },
  });
});

// ─────────────────────────────────────────────
//  PATCH /api/v2/settings/profile
//  fullName, bio, designation update karo
// ─────────────────────────────────────────────

export const updateProfile = asyncHandler(async (req, res, next) => {
  try {
    const updatedUser = await SettingsHelper.updateUserProfile(req.user.id, req.body);

    // Redis cache clear
    await redis.del(`user:auth:${req.user.id}`).catch(() => {});

    logger.info("User profile updated", { userId: req.user.id });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: UserHelper.toSafeObject(updatedUser),
    });
  } catch (err) {
    return next(new AppError(err.message, 400));
  }
});

// ─────────────────────────────────────────────
//  PATCH /api/v2/settings/password
//  Old password verify → naya hash karke save
// ─────────────────────────────────────────────

export const updatePassword = asyncHandler(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;

  if (!newPassword) {
    return next(new AppError("New password is required.", 400));
  }

  try {
    const result = await SettingsHelper.updatePassword(req.user.id, oldPassword, newPassword);

    // Clear Redis cache + sessions
    await Promise.all([
      redis.del(`user:auth:${req.user.id}`).catch(() => {}),
      redis.del(`sessions:${req.user.id}`).catch(() => {}),
    ]);

    logger.info("User password updated", { userId: req.user.id });

    return res.status(200).json({
      success: true,
      message: result.message,
      data: {},
    });
  } catch (err) {
    if (err.message.includes("incorrect")) {
      return next(new AppError(err.message, 401));
    }
    return next(new AppError(err.message, 400));
  }
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/settings/deactivate
//  Account deactivate karo (soft delete)
// ─────────────────────────────────────────────

export const deactivateAccount = asyncHandler(async (req, res, next) => {
  try {
    await SettingsHelper.deactivateAccount(req.user.id);

    // Clear cookies
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    // Clear Redis
    await redis.del(`user:auth:${req.user.id}`).catch(() => {});

    logger.info("User account deactivated", { userId: req.user.id });

    return res.status(200).json({
      success: true,
      message: "Account deactivated successfully.",
      data: {},
    });
  } catch (err) {
    return next(new AppError(err.message, 400));
  }
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/settings/permanent-delete
//  Account permanently delete karo (hard delete)
//  ⚠️ IRREVERSIBLE — be careful!
// ─────────────────────────────────────────────

export const permanentlyDeleteAccount = asyncHandler(async (req, res, next) => {
  const { password } = req.body;

  if (!password) {
    return next(new AppError("Password is required to permanently delete account.", 400));
  }

  // Verify password
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { password: true },
    });

    if (!user || !user.password) {
      return next(new AppError("Password verification failed.", 401));
    }

    const isMatch = await UserHelper.isPasswordCorrect(user, password);
    if (!isMatch) {
      return next(new AppError("Password is incorrect.", 401));
    }

    // Hard delete
    await SettingsHelper.hardDeleteAccount(req.user.id);

    // Clear cookies
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    // Clear Redis
    await redis.del(`user:auth:${req.user.id}`).catch(() => {});

    logger.warn("User account permanently deleted", { userId: req.user.id });

    return res.status(200).json({
      success: true,
      message: "Account permanently deleted. All data has been removed.",
      data: {},
    });
  } catch (err) {
    return next(new AppError(err.message, 400));
  }
});


export const reactivateAccount = asyncHandler(async (req, res, next) => {
  const { userId, password } = req.body;

  if (!userId || !password)
    return next(new AppError("userId and password are required", 400));

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, accountStatus: true, password: true,
              isOnboardingComplete: true, onboardingStep: true },
  });

  if (!user) return next(new AppError("User not found", 404));
  if (user.accountStatus !== "deactivated")
    return next(new AppError("Account is not deactivated", 400));

  // Password verify
  const isMatch = await UserHelper.isPasswordCorrect(user, password);
  if (!isMatch) return next(new AppError("Incorrect password.", 401));

  await SettingsHelper.reactivateAccount(userId);

  // Redis clear
  await redis.del(`user:auth:${userId}`).catch(() => {});

  const updatedUser = await prisma.user.findUnique({ where: { id: userId } });

  logger.info("User account reactivated", { userId });

  await sendUserToken(updatedUser, 200, res, {
    message: "Account reactivated successfully!",
    nextRoute: "/feed",
    deviceInfo: req.headers["user-agent"] || "unknown",
    ipAddress: req.ip,
  }, next);
});