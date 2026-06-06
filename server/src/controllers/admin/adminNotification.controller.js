import asyncHandler        from "../../middlewares/asyncHandler.js";
import AdminNotification   from "../../models/adminNotification.model.js";
import { LABEL_MAP }       from "../../models/adminNotification.model.js";
import AppError            from "../../utils/AppError.js";
import logger              from "../../config/logger.js";

const MAX_LIMIT = 50;

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/admin/notifications
//  Last N admin notifications + unread count
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || MAX_LIMIT, MAX_LIMIT);

  const [notifications, unreadCount] = await Promise.all([
    AdminNotification.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    AdminNotification.countDocuments({ isRead: false }),
  ]);

  return res.status(200).json({
    success: true,
    data:    { notifications, unreadCount },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/admin/notifications/read-all
//  Mark all as read
// ─────────────────────────────────────────────────────────────────────────────
export const markAllAdminNotificationsRead = asyncHandler(async (req, res) => {
  const result = await AdminNotification.updateMany(
    { isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  logger.info("Admin notifications marked as read", {
    modifiedCount: result.modifiedCount,
  });

  return res.status(200).json({
    success:       true,
    modifiedCount: result.modifiedCount,
    message:       "All notifications marked as read.",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v2/admin/notifications/save  (internal — chat server only)
//  Save a new admin notification to DB
// ─────────────────────────────────────────────────────────────────────────────
export const saveAdminNotification = asyncHandler(async (req, res, next) => {
  const { type, meta = {} } = req.body;

  if (!type) return next(new AppError("type is required.", 400));

  const notification = await AdminNotification.create({
    type,
    label: LABEL_MAP[type] || type,
    meta,
  });

  logger.info("Admin notification saved", { type, id: notification._id });

  return res.status(201).json({ success: true, data: { id: notification._id } });
});