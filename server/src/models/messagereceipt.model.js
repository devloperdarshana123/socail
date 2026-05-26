import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
//  MessageReceipt Model
//
//  FIX for Message model bugs #3, #5, #11, #12:
//
//  PROBLEM (original model):
//    seenBy and readBy were arrays embedded inside every Message document.
//    In a group chat with 500 members, every message stored 500 ObjectIds
//    in EACH array = ~12KB per message just for read receipts.
//    A chat with 10,000 messages = 120MB of read receipt data in one collection.
//    MongoDB document size limit is 16MB — a message with enough readers crashes.
//    Additionally, $ne on an array can't use an index — full scan on every
//    "mark read" call.
//
//  SOLUTION:
//    One document per (message + user) pair.
//    Unique index prevents duplicates.
//    All read/seen queries are indexed lookups, not array scans.
//    No document size ceiling risk.
// ─────────────────────────────────────────────────────────────────────────────

const messageReceiptSchema = new Schema(
  {
    message: {
      type:     Schema.Types.ObjectId,
      ref:      "Message",
      required: true,
    },

    conversation: {
      type:     Schema.Types.ObjectId,
      ref:      "Conversation",
      required: true,
    },

    user: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    // "delivered to screen" — message appeared in viewport
    seenAt: {
      type:    Date,
      default: null,
    },

    // "explicitly read" — blue tick (user opened/focused the message)
    readAt: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: false, // seenAt + readAt are our timestamps
  },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────────────────────────────────────

// One receipt per (message + user) — DB-level uniqueness
messageReceiptSchema.index({ message: 1, user: 1 }, { unique: true });

// "Has user read message X?" — used in hasRead()
messageReceiptSchema.index({ message: 1, user: 1, readAt: 1 });

// "All receipts for a message" — used in getReceiptsForMessage()
messageReceiptSchema.index({ message: 1, readAt: -1 });

// FIX #12 — "Unread messages in conversation for user X" — was impossible before
// Used in getUnreadCount() and markReadByUser()
messageReceiptSchema.index({ conversation: 1, user: 1, readAt: 1 });

// ─────────────────────────────────────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark a single message as seen by a user.
 * Atomic upsert — safe to call multiple times.
 *
 * @param {ObjectId} messageId
 * @param {ObjectId} conversationId
 * @param {ObjectId} userId
 */
messageReceiptSchema.statics.markSeen = function (messageId, conversationId, userId) {
  return this.findOneAndUpdate(
    { message: messageId, user: userId },
    {
      $setOnInsert: { message: messageId, conversation: conversationId, user: userId },
      $set:         { seenAt: new Date() },
    },
    { upsert: true, new: true },
  );
};

/**
 * Mark a single message as read by a user (blue tick).
 * Sets both seenAt and readAt atomically.
 *
 * @param {ObjectId} messageId
 * @param {ObjectId} conversationId
 * @param {ObjectId} userId
 */
messageReceiptSchema.statics.markRead = function (messageId, conversationId, userId) {
  const now = new Date();
  return this.findOneAndUpdate(
    { message: messageId, user: userId },
    {
      $setOnInsert: { message: messageId, conversation: conversationId, user: userId },
      $set:         { readAt: now, seenAt: now },
    },
    { upsert: true, new: true },
  );
};

/**
 * Mark ALL unread messages in a conversation as read for a user.
 * FIX #5  — indexed lookup replaces { readBy: { $ne: userId } } array scan.
 * FIX #11 — single targeted updateMany on receipts collection instead of
 *           touching every Message document on every chat open.
 *
 * Strategy: upsert receipts for all messages in the conversation that the
 * user hasn't marked read yet. We use a two-step: fetch unread message IDs,
 * then bulkWrite upserts. This avoids a massive $in on the messages collection.
 *
 * @param {ObjectId} conversationId
 * @param {ObjectId} userId
 * @param {ObjectId[]} messageIds  — pass the visible message IDs from getMessages()
 * @returns {{ markedCount: number }}
 */
messageReceiptSchema.statics.markConversationRead = async function (
  conversationId,
  userId,
  messageIds,
) {
  if (!messageIds?.length) return { markedCount: 0 };

  // Find which of these messages already have a read receipt for this user
  const existing = await this.find(
    { message: { $in: messageIds }, user: userId, readAt: { $ne: null } },
    { message: 1 },
  ).lean();

  const alreadyRead = new Set(existing.map((r) => r.message.toString()));
  const toMark      = messageIds.filter((id) => !alreadyRead.has(id.toString()));

  if (!toMark.length) return { markedCount: 0 };

  const now = new Date();
  const ops = toMark.map((messageId) => ({
    updateOne: {
      filter: { message: messageId, user: userId },
      update: {
        $setOnInsert: { message: messageId, conversation: conversationId, user: userId },
        $set:         { readAt: now, seenAt: now },
      },
      upsert: true,
    },
  }));

  const result = await this.bulkWrite(ops, { ordered: false });
  return { markedCount: result.upsertedCount + result.modifiedCount };
};

/**
 * Get unread message count for a user in a conversation.
 * FIX #12 — uses { conversation, user, readAt } index (was impossible before).
 *
 * @param {ObjectId} conversationId
 * @param {ObjectId} userId
 * @param {number}   totalMessages  — total non-deleted messages in conversation
 * @returns {number}
 */
messageReceiptSchema.statics.getUnreadCount = async function (
  conversationId,
  userId,
  totalMessages,
) {
  const readCount = await this.countDocuments({
    conversation: conversationId,
    user:         userId,
    readAt:       { $ne: null },
  });
  return Math.max(0, totalMessages - readCount);
};

/**
 * Check if a specific user has read a specific message.
 *
 * @param {ObjectId} messageId
 * @param {ObjectId} userId
 * @returns {boolean}
 */
messageReceiptSchema.statics.hasRead = async function (messageId, userId) {
  const receipt = await this.exists({
    message: messageId,
    user:    userId,
    readAt:  { $ne: null },
  });
  return !!receipt;
};

/**
 * Get all receipts for a message (who has read it).
 * Used to show "Seen by: Alice, Bob, +3" in group chats.
 *
 * @param {ObjectId} messageId
 * @param {object}   opts
 * @param {number}   opts.limit
 * @returns {Document[]}
 */
messageReceiptSchema.statics.getReceiptsForMessage = function (messageId, opts = {}) {
  const limit = Math.min(parseInt(opts.limit) || 50, 200);
  return this.find({ message: messageId, readAt: { $ne: null } })
    .sort({ readAt: -1 })
    .limit(limit)
    .populate("user", "username fullName avatar")
    .lean();
};

/**
 * Delete all receipts for a conversation (conversation deletion cleanup).
 *
 * @param {ObjectId} conversationId
 * @returns {{ deletedCount: number }}
 */
messageReceiptSchema.statics.deleteAllByConversation = async function (conversationId) {
  const result = await this.deleteMany({ conversation: conversationId });
  return { deletedCount: result.deletedCount ?? 0 };
};

/**
 * Delete all receipts for a user (account deletion cleanup).
 *
 * @param {ObjectId} userId
 * @returns {{ deletedCount: number }}
 */
messageReceiptSchema.statics.deleteAllByUser = async function (userId) {
  const result = await this.deleteMany({ user: userId });
  return { deletedCount: result.deletedCount ?? 0 };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Model Export (hot-reload safe)
// ─────────────────────────────────────────────────────────────────────────────

const MessageReceipt = models.MessageReceipt || model("MessageReceipt", messageReceiptSchema);
export default MessageReceipt;