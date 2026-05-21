import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Sub-schema: Cloudinary Media
// ─────────────────────────────────────────────
const cloudinaryMediaSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false },
);

// ─────────────────────────────────────────────
//  Sub-schema: Reaction
// ─────────────────────────────────────────────
const reactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    emoji: {
      type: String,
      required: true,
      maxlength: 10, // emoji unicode safe length
    },
    reactedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

// ─────────────────────────────────────────────
//  Sub-schema: Reply Preview (denormalized)
// ─────────────────────────────────────────────
const replyPreviewSchema = new Schema(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      required: true,
    },
    text: {
      type: String,
      default: "",
      maxlength: 100, // sirf preview
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
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
//  Message Schema
// ─────────────────────────────────────────────
const messageSchema = new Schema(
  {
    // ── Core ─────────────────────────────────
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ── Content ───────────────────────────────
    text: {
      type: String,
      default: "",
      maxlength: [2000, "Message cannot exceed 2000 characters"],
      trim: true,
    },

    image: {
      type: cloudinaryMediaSchema,
      default: null,
    },

    // ── Reply ─────────────────────────────────
    replyTo: {
      type: replyPreviewSchema,
      default: null,
    },

    // ── Reactions ─────────────────────────────
    // Array of { userId, emoji } — ek user ek hi reaction de sakta hai
    reactions: {
      type: [reactionSchema],
      default: [],
    },

    // ── Read Receipts ─────────────────────────
    // seenBy  → message screen pe aaya (delivered + seen)
    // readBy  → user ne explicitly padha (blue tick)
    seenBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ── Edit History ──────────────────────────
    isEdited: {
      type: Boolean,
      default: false,
    },

    editedAt: {
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

    // ── Message Type ──────────────────────────
    type: {
      type: String,
      enum: ["text", "image", "system"], // system = "X ne group join kiya" etc.
      default: "text",
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
messageSchema.index({ conversation: 1, createdAt: -1 }); // message list (paginated)
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, isDeleted: 1 });

// ─────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────
messageSchema.virtual("reactionCount").get(function () {
  return this.reactions?.length ?? 0;
});

messageSchema.virtual("isRead").get(function () {
  return this.readBy?.length > 0;
});

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * Paginated messages for a conversation
 */
messageSchema.statics.getMessages = function (
  conversationId,
  { page = 1, limit = 30 } = {},
) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 30, 1), 100);
  const skip = (Math.max(parseInt(page) || 1, 1) - 1) * safeLimit;

  return this.find({ conversation: conversationId, isDeleted: false })
    .sort({ createdAt: -1 }) // latest first, frontend reverse karega
    .skip(skip)
    .limit(safeLimit)
    .populate("sender", "username fullName avatar isVerifiedBadge")
    .lean();
};

/**
 * Upsert reaction — ek user ek hi emoji rakh sakta hai
 */
messageSchema.statics.upsertReaction = function (messageId, userId, emoji) {
  // Pehle purani reaction remove karo, phir nai add karo
  return this.findByIdAndUpdate(
    messageId,
    {
      $pull: { reactions: { userId } },
    },
    { new: true },
  ).then((msg) => {
    if (!msg) return null;
    if (!emoji) return msg; // emoji null = reaction remove
    return this.findByIdAndUpdate(
      messageId,
      {
        $push: {
          reactions: { userId, emoji, reactedAt: new Date() },
        },
      },
      { new: true },
    );
  });
};

/**
 * Mark messages as read by a user (blue tick)
 */
messageSchema.statics.markReadBy = function (conversationId, userId) {
  return this.updateMany(
    {
      conversation: conversationId,
      readBy: { $ne: userId },
      sender: { $ne: userId }, // apne messages mark nahi karte
      isDeleted: false,
    },
    {
      $addToSet: { readBy: userId, seenBy: userId },
    },
  );
};

/**
 * Soft delete a message
 */
messageSchema.statics.softDelete = function (messageId, requesterId) {
  return this.findOneAndUpdate(
    { _id: messageId, sender: requesterId, isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        text: "",
        image: null,
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
messageSchema.methods.toSafeObject = function () {
  return {
    _id: this._id,
    conversation: this.conversation,
    sender: this.sender,
    text: this.isDeleted ? "" : (this.text ?? ""),
    image: this.isDeleted ? null : (this.image?.url ?? null),
    replyTo: this.replyTo ?? null,
    reactions: this.isDeleted ? [] : (this.reactions ?? []),
    seenBy: this.seenBy ?? [],
    readBy: this.readBy ?? [],
    isEdited: this.isEdited,
    editedAt: this.editedAt ?? null,
    isDeleted: this.isDeleted,
    deletedAt: this.deletedAt ?? null,
    type: this.type,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Message = models.Message || model("Message", messageSchema);
export default Message;