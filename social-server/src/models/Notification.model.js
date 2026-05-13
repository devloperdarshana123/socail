// import mongoose from "mongoose";

// const notificationSchema = new mongoose.Schema({
//   recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//   sender:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//   type:      { 
//     type: String, 
//     enum: ["like", "comment", "reply", "comment_like", "reply_like"], // ✅ "like" add kiya
//     required: true 
//   },
//   post:      { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
//   text:      { type: String },
//   isRead:    { type: Boolean, default: false },
// }, { timestamps: true });

// export default mongoose.model("Notification", notificationSchema);



import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocialUser",           // ✅ consistent ref — "User" nahi, "SocialUser"
      required: [true, "Recipient zaroori hai"],
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocialUser",
      required: [true, "Sender zaroori hai"],
    },

    type: {
      type: String,
      enum: [
        "like",           // post like
        "comment",        // post pe comment
        "reply",          // comment pe reply
        "comment_like",   // comment like
        "reply_like",     // reply like
        "follow",         // follow kiya          ← MISSING tha
        "mention",        // @mention             ← MISSING tha
        "story_view",     // story dekhi          ← bonus
        "system",         // admin/system message ← bonus
      ],
      required: [true, "Notification type zaroori hai"],
    },

    // ── References ────────────────────────────────────────────────────────────
    post:    { type: mongoose.Schema.Types.ObjectId, ref: "Post",    default: null },
    comment: { type: mongoose.Schema.Types.ObjectId, default: null },   // comment _id (embedded)
    story:   { type: mongoose.Schema.Types.ObjectId, ref: "Story",  default: null },

    // ── Content ───────────────────────────────────────────────────────────────
    text: {
      type: String,
      default: "",
      maxlength: [200, "Notification text 200 characters se zyada nahi ho sakta"],
    },

    // ── Status ────────────────────────────────────────────────────────────────
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },       // ← MISSING tha
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

notificationSchema.index({ recipient: 1, createdAt: -1 });   // inbox sorted
notificationSchema.index({ recipient: 1, isRead: 1 });        // unread count fast
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 }); // 60 din baad auto delete

// ─────────────────────────────────────────────────────────────────────────────
// Instance Methods
// ─────────────────────────────────────────────────────────────────────────────

notificationSchema.methods.markRead = async function () {
  if (this.isRead) return;
  this.isRead = true;
  this.readAt = new Date();
  await this.save({ validateBeforeSave: false });
};

// ─────────────────────────────────────────────────────────────────────────────
// Static Methods
// ─────────────────────────────────────────────────────────────────────────────

/** Ek user ke saari unread notifications */
notificationSchema.statics.getUnreadCount = function (recipientId) {
  return this.countDocuments({ recipient: recipientId, isRead: false });
};

/** Saari notifications read mark karo */
notificationSchema.statics.markAllRead = function (recipientId) {
  return this.updateMany(
    { recipient: recipientId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

/**
 * Notification create karo — duplicate avoid karo
 * (e.g. same user ne same post ko 5 baar like/unlike kiya)
 */
notificationSchema.statics.createUnique = async function (data) {
  const { recipient, sender, type, post } = data;

  // Self-notification nahi
  if (recipient.toString() === sender.toString()) return null;

  // Duplicate check — last 1 ghante mein same event
  const exists = await this.findOne({
    recipient,
    sender,
    type,
    post: post || null,
    createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
  });

  if (exists) return exists;
  return this.create(data);
};

// ─────────────────────────────────────────────────────────────────────────────

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;