// const mongoose = require("mongoose");

// const notificationSchema = new mongoose.Schema({
//   recipient: { type: mongoose.Schema.Types.ObjectId, required: true },
//   sender:    { type: mongoose.Schema.Types.ObjectId, required: true },
//   type: { type: String, enum: ["like", "comment", "reply", "comment_like", "reply_like"] },
//   post:      { type: mongoose.Schema.Types.ObjectId },
//   text:      { type: String },
//   isRead:    { type: Boolean, default: false },
// }, { timestamps: true });

// module.exports = mongoose.model("Notification", notificationSchema);


const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",                              // ✅ add
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",                              // ✅ add
      required: true,
    },
    type: {
      type: String,
      enum: [
        "like",
        "comment",
        "reply",
        "comment_like",
        "reply_like",
        "follow_request",                       // ✅ add
        "follow_accepted",                      // ✅ add
      ],
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",                              // ✅ add
      default: null,
    },
    text: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// ✅ Indexes
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ isRead: 1 });

module.exports = mongoose.model("Notification", notificationSchema);