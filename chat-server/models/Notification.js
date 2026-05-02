const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, required: true },
  sender:    { type: mongoose.Schema.Types.ObjectId, required: true },
  type: { type: String, enum: ["like", "comment", "reply", "comment_like", "reply_like"] },
  post:      { type: mongoose.Schema.Types.ObjectId },
  text:      { type: String },
  isRead:    { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Notification", notificationSchema);