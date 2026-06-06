
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const notificationSchema = new Schema(
  {
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Receiver is required"],
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "post_like", "post_comment", "post_mention", "post_tag",
        "comment_like", "comment_reply", "comment_mention",
        "follow", "follow_request", "follow_request_accepted",
        "story_view", "story_reaction", "story_reply", "story_mention",
        "new_message", "new_group_message",
        "system",
"admin_new_user",
"admin_new_report",
      ],
      index: true,
    },
    refId:    { type: Schema.Types.ObjectId, refPath: "refModel", default: null },
    refModel: { type: String, enum: ["Post", "Comment", "Story", "Conversation", null], default: null },
    meta: {
      preview:    { type: String, maxlength: 100, default: null },
      reaction:   { type: String, default: null },
      extraCount: { type: Number, default: 0 },
      imageUrl:   { type: String, default: null },
    },
    isRead:    { type: Boolean, default: false, index: true },
    readAt:    { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ── Indexes ───────────────────────────────────────────────────────────────
notificationSchema.index({ receiver: 1, isDeleted: 1, createdAt: -1 });
notificationSchema.index({ receiver: 1, isRead: 1, isDeleted: 1 });
notificationSchema.index({ receiver: 1, sender: 1, type: 1, refId: 1 }, { sparse: true });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// ── Virtual: human-readable label ─────────────────────────────────────────
notificationSchema.virtual("label").get(function () {
  const labels = {
    post_like:                "liked your post",
    post_comment:             "commented on your post",
    post_mention:             "mentioned you in a post",
    post_tag:                 "tagged you in a post",
    comment_like:             "liked your comment",
    comment_reply:            "replied to your comment",
    comment_mention:          "mentioned you in a comment",
    follow:                   "started following you",
    follow_request:           "requested to follow you",
    follow_request_accepted:  "accepted your follow request",
    story_view:               "viewed your story",
    story_reaction:           "reacted to your story",
    story_reply:              "replied to your story",
    story_mention:            "mentioned you in a story",
    new_message:              "sent you a message",
    new_group_message:        "sent a message in group",
    system:                   "system notification",
  };
  return labels[this.type] || this.type;
});

// ── Static: create with dedup ─────────────────────────────────────────────
notificationSchema.statics.createNotification = async function ({
  receiver, sender, type, refId = null, refModel = null, meta = {},
}) {
  if (sender && receiver.toString() === sender.toString()) return null;

  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const existing = await this.findOne({
    receiver, sender, type, refId,
    createdAt: { $gte: oneMinuteAgo },
    isDeleted: false,
  });
  if (existing) return existing;

  return this.create({ receiver, sender, type, refId, refModel, meta });
};

// ── Static: unread count (badge) ──────────────────────────────────────────
notificationSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({ receiver: userId, isRead: false, isDeleted: false });
};

// ── Static: mark all read ─────────────────────────────────────────────────
notificationSchema.statics.markAllAsRead = function (userId) {
  return this.updateMany(
    { receiver: userId, isRead: false, isDeleted: false },
    { isRead: true, readAt: new Date() }
  );
};

// ── Static: mark one read ─────────────────────────────────────────────────
notificationSchema.statics.markAsRead = function (notificationId, userId) {
  return this.findOneAndUpdate(
    { _id: notificationId, receiver: userId, isRead: false },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
};

// ── Static: soft delete ───────────────────────────────────────────────────
notificationSchema.statics.softDelete = function (notificationId, userId) {
  return this.findOneAndUpdate(
    { _id: notificationId, receiver: userId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
    { new: true }
  );
};

// models.Notification check — mongoose model cache (hot reload safe)
const Notification = models.Notification || model("Notification", notificationSchema);
export default Notification;