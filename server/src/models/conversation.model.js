import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Sub-schema: Last Message Preview
// ─────────────────────────────────────────────
const lastMessagePreviewSchema = new Schema(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    text: {
      type: String,
      default: "",
      maxlength: 100, // preview ke liye truncated
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

// ─────────────────────────────────────────────
//  Conversation Schema
// ─────────────────────────────────────────────
const conversationSchema = new Schema(
  {
    // ── Participants ──────────────────────────
    participants: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      validate: {
        validator: (v) => v.length >= 2,
        message: "Conversation mein kam se kam 2 participants hone chahiye",
      },
    },

    // ── Last Message (denormalized for list view) ──
    lastMessage: {
      type: lastMessagePreviewSchema,
      default: null,
    },

    // ── Unread Count per user ─────────────────
    // { "userId": count }
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },

    // ── Group Chat ────────────────────────────
    isGroup: {
      type: Boolean,
      default: false,
      index: true,
    },

    groupName: {
      type: String,
      trim: true,
      maxlength: [50, "Group name cannot exceed 50 characters"],
      default: null,
    },

    groupAvatar: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },

    groupAdmin: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ── Soft Delete / Archive per user ────────
    // Users jo is conversation ko archive kar chuke hain
    archivedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Users jo is conversation ko delete kar chuke hain
    deletedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ── Status ────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });
conversationSchema.index({ participants: 1, updatedAt: -1 }); // conversation list query
conversationSchema.index({ isGroup: 1, isActive: 1 });

// ─────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────
conversationSchema.virtual("participantCount").get(function () {
  return this.participants?.length ?? 0;
});

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * Do users ke beech existing DM conversation dhundo
 */
conversationSchema.statics.findDMBetween = function (userAId, userBId) {
  return this.findOne({
    isGroup: false,
    participants: { $all: [userAId, userBId], $size: 2 },
    isActive: true,
  });
};

/**
 * User ki saari active conversations fetch karo (list view)
 */
conversationSchema.statics.getUserConversations = function (
  userId,
  { page = 1, limit = 20 } = {},
) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50);
  const skip = (Math.max(parseInt(page) || 1, 1) - 1) * safeLimit;

  return this.find({
    participants: userId,
    isActive: true,
    deletedBy: { $ne: userId },
  })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(safeLimit)
    .populate("participants", "username fullName avatar isVerifiedBadge accountStatus")
    .lean();
};

/**
 * Unread count increment karo for specific user
 */
conversationSchema.statics.incrementUnread = function (conversationId, userId) {
  return this.findByIdAndUpdate(
    conversationId,
    { $inc: { [`unreadCount.${userId}`]: 1 } },
    { new: true },
  );
};

/**
 * Unread count reset karo jab user messages padhle
 */
conversationSchema.statics.resetUnread = function (conversationId, userId) {
  return this.findByIdAndUpdate(
    conversationId,
    { $set: { [`unreadCount.${userId}`]: 0 } },
    { new: true },
  );
};

/**
 * lastMessage preview update karo (har naye message ke baad call karo)
 */
conversationSchema.statics.updateLastMessage = function (
  conversationId,
  { messageId, text, senderId, sentAt, isDeleted = false },
) {
  return this.findByIdAndUpdate(
    conversationId,
    {
      $set: {
        lastMessage: {
          messageId,
          text: text?.slice(0, 100) ?? "",
          senderId,
          sentAt: sentAt ?? new Date(),
          isDeleted,
        },
      },
    },
    { new: true },
  );
};

// ─────────────────────────────────────────────
//  Instance Methods
// ─────────────────────────────────────────────

/**
 * Safe object for sending to frontend
 */
conversationSchema.methods.toSafeObject = function (currentUserId) {
  const unread = this.unreadCount?.get?.(currentUserId?.toString()) ?? 0;
  return {
    _id: this._id,
    participants: this.participants,
    lastMessage: this.lastMessage ?? null,
    unreadCount: unread,
    isGroup: this.isGroup,
    groupName: this.groupName ?? null,
    groupAvatar: this.groupAvatar?.url ?? null,
    groupAdmin: this.groupAdmin ?? null,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Conversation = models.Conversation || model("Conversation", conversationSchema);
export default Conversation;