import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Notification Schema
//
//  Covers all notification types:
//  post, comment, like, follow, mention,
//  story view/react/reply, message, system
//
//  Polymorphic ref for the entity that triggered it
// ─────────────────────────────────────────────

const notificationSchema = new Schema(
  {
    // ── Who receives this notification ─────────
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Receiver is required"],
      index: true,
    },

    // ── Who triggered the notification ─────────
    // null for system notifications
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // ── Notification Type ──────────────────────
    type: {
      type: String,
      required: [true, "Notification type is required"],
      enum: [
        // Post
        "post_like",           // someone liked your post
        "post_comment",        // someone commented on your post
        "post_mention",        // you were mentioned in a post caption
        "post_tag",            // you were tagged in a post
        // Comment
        "comment_like",        // someone liked your comment
        "comment_reply",       // someone replied to your comment
        "comment_mention",     // you were mentioned in a comment
        // Follow
        "follow",              // someone followed you (public account)
        "follow_request",      // someone requested to follow you (private)
        "follow_request_accepted", // your follow request was accepted
        // Story
        "story_view",          // someone viewed your story
        "story_reaction",      // someone reacted to your story
        "story_reply",         // someone replied to your story via DM
        "story_mention",       // you were mentioned in a story
        // Message
        "new_message",         // new DM received
        "new_group_message",   // new group chat message
        // System
        "system",              // platform announcement / admin message
      ],
      index: true,
    },

    // ── What triggered it (polymorphic) ────────
    // e.g., postId, commentId, storyId, conversationId
    refId: {
      type: Schema.Types.ObjectId,
      refPath: "refModel",
      default: null,
    },

    refModel: {
      type: String,
      enum: ["Post", "Comment", "Story", "Conversation", null],
      default: null,
    },

    // ── Extra metadata ─────────────────────────
    // e.g., preview text for comment/message, reaction emoji
    meta: {
      // Short preview of the comment/message content
      preview: {
        type: String,
        maxlength: 100,
        default: null,
      },

      // Reaction emoji (for post_like / story_reaction)
      reaction: {
        type: String,
        default: null,
      },

      // For group notifications — e.g., "and 4 others liked"
      extraCount: {
        type: Number,
        default: 0,
      },

      // Image/thumbnail url to show in notification
      imageUrl: {
        type: String,
        default: null,
      },
    },

    // ── Read State ────────────────────────────
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },

    // ── Soft Delete ───────────────────────────
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────

// Inbox feed — receiver's unread notifications
notificationSchema.index({ receiver: 1, isDeleted: 1, createdAt: -1 });

// Unread count badge
notificationSchema.index({ receiver: 1, isRead: 1, isDeleted: 1 });

// Dedup check — prevent duplicate notification of same type from same sender on same ref
notificationSchema.index({ receiver: 1, sender: 1, type: 1, refId: 1 }, { sparse: true });

// ─────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────

/** Human-readable label for notification type */
notificationSchema.virtual("label").get(function () {
  const labels = {
    post_like: "liked your post",
    post_comment: "commented on your post",
    post_mention: "mentioned you in a post",
    post_tag: "tagged you in a post",
    comment_like: "liked your comment",
    comment_reply: "replied to your comment",
    comment_mention: "mentioned you in a comment",
    follow: "started following you",
    follow_request: "requested to follow you",
    follow_request_accepted: "accepted your follow request",
    story_view: "viewed your story",
    story_reaction: "reacted to your story",
    story_reply: "replied to your story",
    story_mention: "mentioned you in a story",
    new_message: "sent you a message",
    new_group_message: "sent a message in group",
    system: "system notification",
  };
  return labels[this.type] || this.type;
});

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * Create a notification — skips if sender === receiver
 * Also prevents duplicate: same type+sender+refId within 1 min
 */
notificationSchema.statics.createNotification = async function ({
  receiver,
  sender,
  type,
  refId = null,
  refModel = null,
  meta = {},
}) {
  // No self-notifications
  if (sender && receiver.toString() === sender.toString()) return null;

  // Dedup: skip if same notification sent in last 60 seconds
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const existing = await this.findOne({
    receiver,
    sender,
    type,
    refId,
    createdAt: { $gte: oneMinuteAgo },
    isDeleted: false,
  });

  if (existing) return existing;

  return this.create({ receiver, sender, type, refId, refModel, meta });
};

/**
 * Get paginated notifications for a user (inbox)
 */
notificationSchema.statics.getInbox = function (userId, page = 1, limit = 20) {
  return this.find({ receiver: userId, isDeleted: false })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("sender", "username fullName avatar isVerifiedBadge")
    .populate("refId");
};

/**
 * Get unread notification count (for badge)
 */
notificationSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({
    receiver: userId,
    isRead: false,
    isDeleted: false,
  });
};

/**
 * Mark a single notification as read
 */
notificationSchema.statics.markAsRead = function (notificationId, userId) {
  return this.findOneAndUpdate(
    { _id: notificationId, receiver: userId, isRead: false },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
};

/**
 * Mark ALL notifications as read for a user
 */
notificationSchema.statics.markAllAsRead = function (userId) {
  return this.updateMany(
    { receiver: userId, isRead: false, isDeleted: false },
    { isRead: true, readAt: new Date() }
  );
};

/**
 * Mark all notifications of a specific type as read
 * e.g., mark all "new_message" read when user opens DM
 */
notificationSchema.statics.markTypeAsRead = function (userId, type) {
  return this.updateMany(
    { receiver: userId, type, isRead: false, isDeleted: false },
    { isRead: true, readAt: new Date() }
  );
};

/**
 * Soft delete a notification
 */
notificationSchema.statics.softDelete = function (notificationId, userId) {
  return this.findOneAndUpdate(
    { _id: notificationId, receiver: userId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
    { new: true }
  );
};

/**
 * Delete all notifications triggered by a specific ref
 * e.g., when a post is deleted, remove all its like/comment notifications
 */
notificationSchema.statics.deleteByRef = function (refId, refModel) {
  return this.deleteMany({ refId, refModel });
};

/**
 * Delete all notifications for a user (account deletion)
 */
notificationSchema.statics.deleteAllForUser = function (userId) {
  return this.deleteMany({
    $or: [{ receiver: userId }, { sender: userId }],
  });
};

/**
 * Get unread counts grouped by type (for notification tabs)
 * Returns: [{ type: "post_like", count: 5 }, ...]
 */
notificationSchema.statics.getUnreadByType = function (userId) {
  return this.aggregate([
    { $match: { receiver: new mongoose.Types.ObjectId(userId), isRead: false, isDeleted: false } },
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $project: { _id: 0, type: "$_id", count: 1 } },
    { $sort: { count: -1 } },
  ]);
};

const Notification = models.Notification || model("Notification", notificationSchema);
export default Notification;