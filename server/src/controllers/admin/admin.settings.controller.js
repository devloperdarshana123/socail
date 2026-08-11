
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError      from "../../utils/AppError.js";
import * as AdminSettingsHelper from "../../utils/adminSettingsHelpers.js";
import logger        from "../../config/logger.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../../helper/cloudinaryUpload.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// ─────────────────────────────────────────────────────────────────────────────
//  Internal helper — identify current session token hash from cookie
// ─────────────────────────────────────────────────────────────────────────────

const getCurrentTokenHash = (req) => {
  const raw = req.cookies?.refreshToken;
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest("hex");
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/admin/settings/profile
// ─────────────────────────────────────────────────────────────────────────────

export const getAdminProfile = asyncHandler(async (req, res, next) => {
  const admin = await AdminSettingsHelper.findAdminProfile(req.user.id);

  if (!admin) return next(new AppError("Admin not found.", 404));

  return res.status(200).json({ success: true, data: admin });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/admin/settings/profile
// ─────────────────────────────────────────────────────────────────────────────

export const updateAdminProfile = asyncHandler(async (req, res, next) => {
  const { fullName, username, email, designation, bio } = req.body;

  if (!fullName?.trim())
    return next(new AppError("Full name is required.", 400));
  if (fullName.trim().length < 2 || fullName.trim().length > 60)
    return next(new AppError("Full name must be 2–60 characters.", 400));
  if (bio && bio.length > 150)
    return next(new AppError("Bio cannot exceed 150 characters.", 400));

  const data = { fullName: fullName.trim() };

  if (username !== undefined) {
    if (username && !/^[a-z0-9._]+$/.test(username))
      return next(new AppError("Username: only lowercase letters, numbers, dots, underscores.", 400));

    const taken = await AdminSettingsHelper.findUserByUsernameExcludingId(
      username.toLowerCase().trim(),
      req.user.id,
    );
    if (taken) return next(new AppError("Username is already taken.", 409));
    data.username = username.toLowerCase().trim();
  }

  if (email !== undefined) {
    if (email && !/^\S+@\S+\.\S+$/.test(email))
      return next(new AppError("Enter a valid email address.", 400));

    const taken = await AdminSettingsHelper.findUserByEmailExcludingId(
      email.toLowerCase().trim(),
      req.user.id,
    );
    if (taken) return next(new AppError("Email is already in use.", 409));
    data.email = email.toLowerCase().trim();
  }

  if (designation !== undefined) data.designation = designation.trim();
  if (bio         !== undefined) data.bio         = bio.trim();

  const updated = await AdminSettingsHelper.updateAdminProfileFields(req.user.id, data);

  logger.info("Admin profile updated", { adminId: req.user.id });

  return res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    data:    updated,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/admin/settings/profile/avatar
// ─────────────────────────────────────────────────────────────────────────────

export const updateAdminAvatar = asyncHandler(async (req, res, next) => {
  if (!req.file)
    return next(new AppError("Please upload an image file.", 400));
  if (req.file.size > 5 * 1024 * 1024)
    return next(new AppError("Avatar cannot exceed 5MB.", 400));

  const admin = await AdminSettingsHelper.findAdminAvatar(req.user.id);
  if (!admin) return next(new AppError("Admin not found.", 404));

  // Delete old avatar from Cloudinary
  const oldAvatar = admin.avatar;
  if (oldAvatar?.publicId) {
    await deleteFromCloudinary(oldAvatar.publicId, "image").catch(() => {});
  }

  const result = await uploadToCloudinary(req.file.buffer, {
    folder:       "erovians/admin-avatars",
    resourceType: "image",
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "face" },
      { quality: "auto:best" },
      { fetch_format: "auto" },
    ],
  });

  const newAvatar = { url: result.secure_url, publicId: result.public_id };

  await AdminSettingsHelper.updateAdminAvatar(req.user.id, newAvatar);

  logger.info("Admin avatar updated", { adminId: req.user.id });

  return res.status(200).json({
    success: true,
    message: "Avatar updated successfully.",
    data:    { avatar: newAvatar },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/admin/settings/password
// ─────────────────────────────────────────────────────────────────────────────

export const changeAdminPassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword)
    return next(new AppError("All password fields are required.", 400));
  if (newPassword !== confirmPassword)
    return next(new AppError("New password and confirm password do not match.", 400));
  if (newPassword.length < 8)
    return next(new AppError("New password must be at least 8 characters.", 400));
  if (currentPassword === newPassword)
    return next(new AppError("New password must differ from current password.", 400));

  const admin = await AdminSettingsHelper.findAdminPassword(req.user.id);
  if (!admin) return next(new AppError("Admin not found.", 404));

  const isMatch = await bcrypt.compare(currentPassword, admin.password);
  if (!isMatch) return next(new AppError("Current password is incorrect.", 401));

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Hash of current refresh token — keep this session alive
  const currentHash = getCurrentTokenHash(req);

  // Update password + delete all OTHER refresh tokens in a transaction
  await AdminSettingsHelper.changeAdminPasswordAndRevokeOtherSessions(
    req.user.id,
    hashedPassword,
    currentHash,
  );

  logger.info("Admin password changed", { adminId: req.user.id });

  return res.status(200).json({
    success: true,
    message: "Password changed. All other devices have been logged out.",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/admin/settings/notifications
// ─────────────────────────────────────────────────────────────────────────────

export const updateNotificationSettings = asyncHandler(async (req, res, next) => {
  const { notificationsEnabled } = req.body;

  if (typeof notificationsEnabled !== "boolean")
    return next(new AppError("notificationsEnabled must be a boolean.", 400));

  await AdminSettingsHelper.updateAdminNotificationSettings(req.user.id, notificationsEnabled);

  logger.info("Admin notification setting updated", {
    adminId: req.user.id,
    notificationsEnabled,
  });

  return res.status(200).json({
    success: true,
    message: `Notifications ${notificationsEnabled ? "enabled" : "disabled"}.`,
    data:    { notificationsEnabled },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/admin/settings/sessions
//  Returns all active sessions — current session flagged with isCurrent: true
// ─────────────────────────────────────────────────────────────────────────────

export const getAdminSessions = asyncHandler(async (req, res, next) => {
  const now         = new Date();
  const currentHash = getCurrentTokenHash(req);

  // Fetch only non-expired tokens for this admin
  const tokens = await AdminSettingsHelper.findActiveAdminSessions(req.user.id, now);

  const sessions = tokens
    .map((t) => ({
      id:         t.id,
      deviceInfo: t.deviceInfo || "Unknown device",
      ipAddress:  t.ipAddress  || "Unknown IP",
      lastUsedAt: t.lastUsedAt,
      createdAt:  t.createdAt,
      expiresAt:  t.expiresAt,
      isTrusted:  t.isTrusted ?? false,
      isCurrent:  currentHash ? t.tokenHash === currentHash : false,
    }))
    .sort((a, b) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return  1;
      return new Date(b.lastUsedAt) - new Date(a.lastUsedAt);
    });

  return res.status(200).json({
    success: true,
    data:    { sessions, total: sessions.length },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/v2/admin/settings/sessions/:sessionId
// ─────────────────────────────────────────────────────────────────────────────

export const revokeAdminSession = asyncHandler(async (req, res, next) => {
  const { sessionId } = req.params;

  const token = await AdminSettingsHelper.findAdminSessionById(sessionId, req.user.id);

  if (!token) return next(new AppError("Session not found.", 404));

  await AdminSettingsHelper.deleteAdminSettingsSessionById(sessionId);

  logger.info("Admin session revoked", { adminId: req.user.id, sessionId });

  return res.status(200).json({ success: true, message: "Session revoked." });
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/v2/admin/settings/sessions
//  Revoke ALL sessions except the current one
// ─────────────────────────────────────────────────────────────────────────────

export const revokeAllOtherSessions = asyncHandler(async (req, res, next) => {
  const currentHash = getCurrentTokenHash(req);

  await AdminSettingsHelper.deleteOtherAdminSessions(req.user.id, currentHash);

  logger.info("Admin all other sessions revoked", { adminId: req.user.id });

  return res.status(200).json({
    success: true,
    message: "All other sessions logged out.",
  });
});