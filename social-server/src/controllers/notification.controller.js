// import Notification from "../models/Notification.model.js";

// // Saari notifications fetch karo
// export const getNotifications = async (req, res) => {
//   try {
//     const notifs = await Notification.find({ recipient: req.user._id })
//       .populate("sender", "name avatar")
//       .sort({ createdAt: -1 })
//       .limit(50);
//     res.json({ notifications: notifs });
//   } catch {
//     res.status(500).json({ message: "Server error" });
//   }
// };

// // Sab read mark karo
// export const markAllRead = async (req, res) => {
//   try {
//     await Notification.updateMany({ recipient: req.user._id }, { isRead: true });
//     res.json({ message: "Marked all read" });
//   } catch {
//     res.status(500).json({ message: "Server error" });
//   }
// };

import Notification from "../models/Notification.model.js";

// ─────────────────────────────────────────────────────────────────────────────
// Get Notifications (paginated)
// ─────────────────────────────────────────────────────────────────────────────

export const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { recipient: req.user._id };
    if (unreadOnly === "true") filter.isRead = false;

    const [notifications, unreadCount, total] = await Promise.all([
      Notification.find(filter)
        .populate("sender", "name username avatar")
        .populate("post",   "media caption")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notification.getUnreadCount(req.user._id),
      Notification.countDocuments({ recipient: req.user._id }),
    ]);

    return res.json({
      notifications,
      unreadCount,
      total,
      page:       parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error("getNotifications error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Mark Single Notification as Read
// ─────────────────────────────────────────────────────────────────────────────

export const markRead = async (req, res) => {
  try {
    const notif = await Notification.findOne({
      _id:       req.params.notifId,
      recipient: req.user._id,
    });

    if (!notif) return res.status(404).json({ message: "Notification nahi mili" });

    await notif.markRead();

    return res.json({ message: "Read mark ho gaya" });
  } catch (err) {
    console.error("markRead error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Mark All Notifications as Read
// ─────────────────────────────────────────────────────────────────────────────

export const markAllRead = async (req, res) => {
  try {
    await Notification.markAllRead(req.user._id);
    return res.json({ message: "Saari notifications read mark ho gayi" });
  } catch (err) {
    console.error("markAllRead error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Delete Single Notification
// ─────────────────────────────────────────────────────────────────────────────

export const deleteNotification = async (req, res) => {
  try {
    const result = await Notification.findOneAndDelete({
      _id:       req.params.notifId,
      recipient: req.user._id,
    });

    if (!result) return res.status(404).json({ message: "Notification nahi mili" });

    return res.json({ message: "Notification delete ho gayi" });
  } catch (err) {
    console.error("deleteNotification error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Delete All Notifications
// ─────────────────────────────────────────────────────────────────────────────

export const deleteAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    return res.json({ message: "Saari notifications delete ho gayi" });
  } catch (err) {
    console.error("deleteAllNotifications error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Unread Count (badge ke liye)
// ─────────────────────────────────────────────────────────────────────────────

export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user._id);
    return res.json({ unreadCount: count });
  } catch (err) {
    console.error("getUnreadCount error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};