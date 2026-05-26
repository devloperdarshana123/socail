import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError      from "../../utils/AppError.js";
import User          from "../../models/user.model.js";
import logger        from "../../config/logger.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../../helper/cloudinaryUpload.js";
import crypto        from "crypto";

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
export const getAdminProfile = asyncHandler(async (req, res) => {
  const admin = await User.findById(req.user._id).select(
    "fullName username email avatar designation bio notificationsEnabled role createdAt lastActiveAt"
  );
  if (!admin) throw new AppError("Admin not found.", 404);

  res.status(200).json({ success: true, data: admin });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/admin/settings/profile
//  Update fullName, username, email, designation, bio
// ─────────────────────────────────────────────────────────────────────────────
export const updateAdminProfile = asyncHandler(async (req, res, next) => {
  const { fullName, username, email, designation, bio } = req.body;

  if (!fullName?.trim()) return next(new AppError("Full name is required.", 400));
  if (fullName.trim().length < 2 || fullName.trim().length > 60)
    return next(new AppError("Full name must be 2–60 characters.", 400));
  if (bio && bio.length > 150)
    return next(new AppError("Bio cannot exceed 150 characters.", 400));

  // Build update object explicitly — never pass undefined to $set
  const updateFields = { fullName: fullName.trim() };

  if (username !== undefined) {
    if (username && !/^[a-z0-9._]+$/.test(username))
      return next(new AppError("Username: only lowercase letters, numbers, dots, underscores.", 400));
    const taken = await User.findOne({
      username: username.toLowerCase().trim(),
      _id:      { $ne: req.user._id },
    }).lean();
    if (taken) return next(new AppError("Username is already taken.", 409));
    updateFields.username = username.toLowerCase().trim();
  }

  if (email !== undefined) {
    if (email && !/^\S+@\S+\.\S+$/.test(email))
      return next(new AppError("Enter a valid email address.", 400));
    const taken = await User.findOne({
      email: email.toLowerCase().trim(),
      _id:   { $ne: req.user._id },
    }).lean();
    if (taken) return next(new AppError("Email is already in use.", 409));
    updateFields.email = email.toLowerCase().trim();
  }

  if (designation !== undefined) updateFields.designation = designation.trim();
  if (bio         !== undefined) updateFields.bio         = bio.trim();

  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateFields },
    { new: true, runValidators: true }
  ).select("fullName username email designation bio avatar role");

  logger.info("Admin profile updated", { adminId: req.user._id });

  res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    data:    updated,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/admin/settings/profile/avatar
//  Upload / replace admin avatar (multipart/form-data, field: "avatar")
// ─────────────────────────────────────────────────────────────────────────────
export const updateAdminAvatar = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new AppError("Please upload an image file.", 400));
  if (req.file.size > 5 * 1024 * 1024)
    return next(new AppError("Avatar cannot exceed 5MB.", 400));

  const admin = await User.findById(req.user._id);
  if (!admin) return next(new AppError("Admin not found.", 404));

  // Delete old avatar from Cloudinary
  if (admin.avatar?.publicId) {
    await deleteFromCloudinary(admin.avatar.publicId, "image").catch(() => {});
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

  admin.avatar = { url: result.secure_url, publicId: result.public_id };
  await admin.save({ validateBeforeSave: false });

  logger.info("Admin avatar updated", { adminId: req.user._id });

  res.status(200).json({
    success: true,
    message: "Avatar updated successfully.",
    data:    { avatar: admin.avatar },
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

  const admin = await User.findById(req.user._id).select("+password +refreshTokens");
if (!admin) return next(new AppError("Admin not found.", 404));

const isMatch = await admin.isPasswordCorrect(currentPassword);
if (!isMatch) return next(new AppError("Current password is incorrect.", 401));

// Hash and save new password — skip field validators (postsCount etc.)
admin.password = newPassword;
await admin.save({ validateBeforeSave: false });

// Revoke all OTHER sessions — current session stays alive
const currentRawToken = req.cookies?.refreshToken;
await admin.removeOtherRefreshTokens(currentRawToken);

logger.info("Admin password changed", { adminId: req.user._id });

res.status(200).json({
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

  await User.findByIdAndUpdate(req.user._id, { $set: { notificationsEnabled } });

  logger.info("Admin notification setting updated", {
    adminId: req.user._id,
    notificationsEnabled,
  });

  res.status(200).json({
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
  const admin = await User.findById(req.user._id).select("+refreshTokens");
  if (!admin) return next(new AppError("Admin not found.", 404));

  const currentHash = getCurrentTokenHash(req);
  const now         = new Date();

  const sessions = admin.refreshTokens
    .filter((t) => t.expiresAt > now)
    .map((t) => ({
      id:         t._id,
      deviceInfo: t.deviceInfo || "Unknown device",
      ipAddress:  t.ipAddress  || "Unknown IP",
      lastUsedAt: t.lastUsedAt,
      createdAt:  t.createdAt,
      expiresAt:  t.expiresAt,
      isTrusted:  t.isTrusted  ?? false,
      // ✅ Fix: compare tokenHash, not array position
      isCurrent:  currentHash ? t.tokenHash === currentHash : false,
    }))
    // Current session always first, then sort by lastUsedAt desc
    .sort((a, b) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      return new Date(b.lastUsedAt) - new Date(a.lastUsedAt);
    });

  res.status(200).json({
    success: true,
    data:    { sessions, total: sessions.length },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/v2/admin/settings/sessions/:sessionId
// ─────────────────────────────────────────────────────────────────────────────
export const revokeAdminSession = asyncHandler(async (req, res, next) => {
  const { sessionId } = req.params;

  const result = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { refreshTokens: { _id: sessionId } } },
    { new: true }
  ).select("+refreshTokens");

  if (!result) return next(new AppError("Session not found.", 404));

  logger.info("Admin session revoked", { adminId: req.user._id, sessionId });

  res.status(200).json({ success: true, message: "Session revoked." });
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/v2/admin/settings/sessions
//  Revoke ALL sessions except the current one
// ─────────────────────────────────────────────────────────────────────────────
export const revokeAllOtherSessions = asyncHandler(async (req, res, next) => {
  const currentHash = getCurrentTokenHash(req);

  if (!currentHash) {
    const admin = await User.findById(req.user._id).select("+refreshTokens");
    if (admin) await admin.removeAllRefreshTokens();
  } else {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { refreshTokens: { tokenHash: { $ne: currentHash } } },
    });
  }

  logger.info("Admin all other sessions revoked", { adminId: req.user._id });

  res.status(200).json({
    success: true,
    message: "All other sessions logged out.",
  });
});