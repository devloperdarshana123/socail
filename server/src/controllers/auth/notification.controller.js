

import asyncHandler from "../../middlewares/asyncHandler.js";
import * as NotifHelper from "../../utils/notificationHelpers.js";

const isValidUUID = (id) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ── GET /api/v2/notifications ─────────────────────────────────────────────
export const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);

  const [notifications, unreadCount] = await Promise.all([
    NotifHelper.getInbox(userId, page, limit),
    NotifHelper.getUnreadCount(userId),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      notifications,
      unreadCount,
      page,
      hasMore: notifications.length === limit,
    },
  });
});

// ── GET /api/v2/notifications/count ──────────────────────────────────────
export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await NotifHelper.getUnreadCount(req.user.id);
  return res.status(200).json({ success: true, data: { count } });
});

// ── PUT /api/v2/notifications/read ───────────────────────────────────────
export const markAllRead = asyncHandler(async (req, res) => {
  await NotifHelper.markAllAsRead(req.user.id);
  return res.status(200).json({ success: true, data: { count: 0 } });
});

// ── PUT /api/v2/notifications/:id/read ───────────────────────────────────
export const markOneRead = asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid notification ID." });
  }

  const notification = await NotifHelper.markOneAsRead(req.params.id, req.user.id);

  if (!notification) {
    return res.status(404).json({ success: false, message: "Notification not found." });
  }

  const unreadCount = await NotifHelper.getUnreadCount(req.user.id);
  return res.status(200).json({ success: true, data: { notification, unreadCount } });
});

// ── DELETE /api/v2/notifications/:id ─────────────────────────────────────
export const deleteNotification = asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid notification ID." });
  }

  const notification = await NotifHelper.softDeleteOne(req.params.id, req.user.id);

  if (!notification) {
    return res.status(404).json({ success: false, message: "Notification not found." });
  }

  const unreadCount = await NotifHelper.getUnreadCount(req.user.id);
  return res.status(200).json({ success: true, data: { unreadCount } });
});

// ── DELETE /api/v2/notifications ─────────────────────────────────────────
export const clearAllNotifications = asyncHandler(async (req, res) => {
  await NotifHelper.softDeleteAll(req.user.id);
  return res.status(200).json({ success: true, data: { count: 0 } });
});