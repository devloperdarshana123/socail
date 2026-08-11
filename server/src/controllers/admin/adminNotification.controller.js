
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError      from "../../utils/AppError.js";
import * as AdminNotificationHelper from "../../utils/adminNotificationHelpers.js";
import logger        from "../../config/logger.js";

const MAX_LIMIT = 50;

// Label map — previously in adminNotification.model.js
export const LABEL_MAP = {
  new_report:       "New Report",
  user_flagged:     "User Flagged",
  post_reported:    "Post Reported",
  comment_reported: "Comment Reported",
  user_banned:      "User Banned",
  user_suspended:   "User Suspended",
  appeal_received:  "Appeal Received",
};

// ─────────────────────────────────────────────────────────────
//  GET /api/v2/admin/notifications
// ─────────────────────────────────────────────────────────────

export const getAdminNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || MAX_LIMIT, MAX_LIMIT);

  const [notifications, unreadCount] = await Promise.all([
    AdminNotificationHelper.findAdminNotifications(limit),
    AdminNotificationHelper.countUnreadAdminNotifications(),
  ]);

  return res.status(200).json({
    success: true,
    data:    { notifications, unreadCount },
  });
});

// ─────────────────────────────────────────────────────────────
//  PATCH /api/v2/admin/notifications/read-all
// ─────────────────────────────────────────────────────────────

export const markAllAdminNotificationsRead = asyncHandler(async (req, res) => {
  const result = await AdminNotificationHelper.markAllAdminNotificationsRead();

  logger.info("Admin notifications marked as read", { modifiedCount: result.count });

  return res.status(200).json({
    success:       true,
    modifiedCount: result.count,
    message:       "All notifications marked as read.",
  });
});

// ─────────────────────────────────────────────────────────────
//  POST /api/v2/admin/notifications/save  (internal — chat server only)
// ─────────────────────────────────────────────────────────────

export const saveAdminNotification = asyncHandler(async (req, res, next) => {
  const { type, meta = {} } = req.body;

  if (!type) return next(new AppError("type is required.", 400));

  const notification = await AdminNotificationHelper.createAdminNotification({
    type,
    label: LABEL_MAP[type] || type,
    meta,
  });

  logger.info("Admin notification saved", { type, id: notification.id });

  return res.status(201).json({ success: true, data: { id: notification.id } });
});