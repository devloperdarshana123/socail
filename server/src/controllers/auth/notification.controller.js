
import Notification from "../../models/notification.model.js";
import asyncHandler from "../../middlewares/asyncHandler.js";

// ── GET /api/notifications ────────────────────────────────────────────────
// Paginated inbox — page refresh ke baad bhi saari notifications milti hain
export const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(50, parseInt(req.query.limit) || 20);

  const [notifications, unreadCount] = await Promise.all([
    Notification.getInbox(userId, page, limit),
    Notification.getUnreadCount(userId),
  ]);

  res.status(200).json({
    success: true,
    data: {
      notifications,
      unreadCount,
      page,
      hasMore: notifications.length === limit,
    },
  });
});

// ── GET /api/notifications/count ──────────────────────────────────────────
// Sirf badge count — page load pe badge ke liye
export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.getUnreadCount(req.user._id);
  res.status(200).json({ success: true, data: { count } });
});

// ── PUT /api/notifications/read ───────────────────────────────────────────
// Mark ALL as read — bell icon open karne pe call karo
export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.markAllAsRead(req.user._id);
  res.status(200).json({ success: true, data: { count: 0 } });
});

// ── PUT /api/notifications/:id/read ──────────────────────────────────────
// Mark ONE notification as read
export const markOneRead = asyncHandler(async (req, res) => {
  const notification = await Notification.markAsRead(
    req.params.id,
    req.user._id
  );

  if (!notification) {
    return res.status(404).json({ success: false, message: "Notification not found" });
  }

  const count = await Notification.getUnreadCount(req.user._id);
  res.status(200).json({ success: true, data: { notification, unreadCount: count } });
});

// ── DELETE /api/notifications/:id ─────────────────────────────────────────
// Soft delete single notification
export const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.softDelete(req.params.id, req.user._id);

  if (!notification) {
    return res.status(404).json({ success: false, message: "Notification not found" });
  }

  const count = await Notification.getUnreadCount(req.user._id);
  res.status(200).json({ success: true, data: { unreadCount: count } });
});

// ── DELETE /api/notifications ─────────────────────────────────────────────
// Clear all (soft delete all) — "Clear All" button
export const clearAllNotifications = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { receiver: req.user._id, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() }
  );
  res.status(200).json({ success: true, data: { count: 0 } });
});