import Notification from "../models/Notification.model.js";

// Saari notifications fetch karo
export const getNotifications = async (req, res) => {
  try {
    const notifs = await Notification.find({ recipient: req.user._id })
      .populate("sender", "name avatar")
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ notifications: notifs });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

// Sab read mark karo
export const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id }, { isRead: true });
    res.json({ message: "Marked all read" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};