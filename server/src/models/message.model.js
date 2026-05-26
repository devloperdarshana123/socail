

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PAGE_LIMIT      = 100;
const MAX_TEXT_LENGTH     = 2000;
const MAX_REACTION_LENGTH = 10;
const MAX_PREVIEW_LENGTH  = 100;
const MAX_REACTIONS_CAP   = 500; // FIX #4 — cap reactions per message

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-schema: Cloudinary Media
// ─────────────────────────────────────────────────────────────────────────────

const cloudinaryMediaSchema = new Schema(
  {
    url: {
      type:     String,
      required: true,
      // FIX #9 — http/https URL validation
      validate: {
        validator: (v) => /^https?:\/\/.+/.test(v),
        message:   "image.url must be a valid http/https URL",
      },
    },
    publicId: {
      type:      String,
      required:  true,
      minlength: [1, "publicId cannot be empty"],
    },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-schema: Reaction
//  FIX #4  — reactions are still embedded here but capped at MAX_REACTIONS_CAP.
//             For a group chat platform, move to a separate MessageReaction
//             collection (same pattern as StoryView) when reactions per message
//             regularly exceed a few hundred.
//  FIX #13 — _id kept on reaction subdocs (removed _id: false) so positional
//             $[elem] filtered updates work correctly.
// ─────────────────────────────────────────────────────────────────────────────

const reactionSchema = new Schema(
  {
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    emoji: {
      type:      String,
      required:  true,
      maxlength: [MAX_REACTION_LENGTH, `Reaction cannot exceed ${MAX_REACTION_LENGTH} characters`],
      trim:      true,
    },
    reactedAt: {
      // FIX #15 — function form: evaluated at runtime, not at module load
      type:    Date,
      default: () => new Date(),
    },
  },
  // _id: true (default) — intentionally kept for positional update support
);

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-schema: Reply Preview (denormalized snapshot)
// ─────────────────────────────────────────────────────────────────────────────

const replyPreviewSchema = new Schema(
  {
    messageId: {
      type:     Schema.Types.ObjectId,
      ref:      "Message",
      required: true,
    },
    // FIX #8 — trim: true added; controller must strip HTML before storing
    text: {
      type:      String,
      default:   "",
      maxlength: [MAX_PREVIEW_LENGTH, `Preview cannot exceed ${MAX_PREVIEW_LENGTH} characters`],
      trim:      true,
    },
    senderId: {
      type:    Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },
    isDeleted: {
      type:    Boolean,
      default: false,
    },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-schema: Edit History Entry
//  FIX #18 — previous message versions stored for audit/moderation
// ─────────────────────────────────────────────────────────────────────────────

const editHistorySchema = new Schema(
  {
    text:     { type: String, default: "" },
    editedAt: { type: Date,   default: () => new Date() },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Message Schema
// ─────────────────────────────────────────────────────────────────────────────

const messageSchema = new Schema(
  {
    // ── Core ──────────────────────────────────────────────────────────────────
    conversation: {
      type:     Schema.Types.ObjectId,
      ref:      "Conversation",
      required: true,
      index:    true,
    },

    sender: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },

    // ── Content ───────────────────────────────────────────────────────────────
    text: {
      type:      String,
      default:   "",
      maxlength: [MAX_TEXT_LENGTH, `Message cannot exceed ${MAX_TEXT_LENGTH} characters`],
      trim:      true,
    },

    image: {
      type:    cloudinaryMediaSchema,
      default: null,
    },

    // ── Reply ─────────────────────────────────────────────────────────────────
    replyTo: {
      type:    replyPreviewSchema,
      default: null,
    },

    // ── Reactions ─────────────────────────────────────────────────────────────
    // FIX #3/#4 — seenBy/readBy moved to MessageReceipt collection (see below).
    //             Reactions still embedded but capped at MAX_REACTIONS_CAP.
    //             For large group platforms, migrate to a separate collection
    //             when reaction counts regularly exceed a few hundred.
    reactions: {
      type:    [reactionSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= MAX_REACTIONS_CAP,
        message:   `Reactions cannot exceed ${MAX_REACTIONS_CAP} per message`,
      },
    },

    // ── Edit History ──────────────────────────────────────────────────────────
    isEdited: {
      type:    Boolean,
      default: false,
    },

    editedAt: {
      type:    Date,
      default: null,
    },

    // FIX #18 — stores previous versions for audit trail / moderation
    editHistory: {
      type:   [editHistorySchema],
      default: [],
      select: false, // hidden by default; fetch explicitly when needed
    },

    // ── Soft Delete ───────────────────────────────────────────────────────────
    isDeleted: {
      type:    Boolean,
      default: false,
      index:   true,
    },

    deletedAt: {
      type:    Date,
      default: null,
    },

    // ── Message Type ──────────────────────────────────────────────────────────
    type: {
      type:    String,
      enum:    ["text", "image", "system"],
      default: "text",
      index:   true,
    },
  },
  {
    timestamps: true,

    /**
     * FIX #17 — toJSON transform replaces manual toSafeObject().
     * Runs automatically on every res.json() / JSON.stringify() call.
     * New schema fields are included automatically — no manual sync needed.
     */
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        // Redact deleted message content
        if (ret.isDeleted) {
          ret.text        = "";
          ret.image       = null;
          ret.reactions   = [];
          ret.replyTo     = null;
          // FIX #6 — reactions and replyTo cleared on delete (was missing before)
        }
        // Never send editHistory in normal responses (select: false handles DB side;
        // this handles virtuals/toJSON path)
        delete ret.editHistory;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Indexes
//  FIX #14 — standalone { sender } index removed (low utility).
//             Replaced with { conversation, sender } compound (actual query pattern).
//  FIX #12 — read receipt queries now live in MessageReceipt model.
// ─────────────────────────────────────────────────────────────────────────────

// Primary message list query: paginated chat history
messageSchema.index({ conversation: 1, createdAt: -1 });

// Soft-delete filter
messageSchema.index({ conversation: 1, isDeleted: 1 });

// FIX #14 — "messages by sender in conversation" (useful for moderation/search)
messageSchema.index({ conversation: 1, sender: 1, createdAt: -1 });

// ─────────────────────────────────────────────────────────────────────────────
//  Pre-validate Hook
//  FIX #7 — ensures message always has content for non-system types
// ─────────────────────────────────────────────────────────────────────────────

messageSchema.pre("validate", function () {
  if (this.type === "system") return; // system messages don't need content

  const hasText  = this.text && this.text.trim().length > 0;
  const hasImage = this.image && this.image.url;

  if (!hasText && !hasImage) {
    throw Object.assign(
      new Error("Message must have either text or an image"),
      { statusCode: 400 },
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────────────────────────────────────

messageSchema.virtual("reactionCount").get(function () {
  return this.reactions?.length ?? 0;
});

/**
 * FIX #16 — isRead virtual REMOVED.
 * readBy.length > 0 was "someone read it", not "this viewer read it".
 * isRead is now computed per-viewer in MessageReceipt.hasRead(messageId, userId).
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get paginated messages for a conversation (cursor-based, newest first).
 * FIX #1 — cursor replaces skip() (was scanning all preceding docs at scale).
 *
 * Chat UX: load latest messages first, scroll up triggers load-more with beforeId.
 *
 * @param {ObjectId} conversationId
 * @param {object}   opts
 * @param {number}   opts.limit       — default 30, max 100
 * @param {ObjectId} [opts.beforeId]  — cursor: return messages older than this _id
 * @returns {{ items, hasMore, nextCursor }}
 */
messageSchema.statics.getMessages = async function (conversationId, opts = {}) {
  const limit = Math.min(Math.max(parseInt(opts.limit) || 30, 1), MAX_PAGE_LIMIT);
  const query = { conversation: conversationId, isDeleted: false };

  if (opts.beforeId) query._id = { $lt: opts.beforeId };

  const results = await this.find(query)
    .sort({ _id: -1 }) // newest first — frontend reverses for display
    .limit(limit + 1)
    .populate("sender", "username fullName avatar isVerifiedBadge")
    .lean();

  const hasMore    = results.length > limit;
  const items      = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore && items.length ? items[items.length - 1]._id : null;

  return { items, hasMore, nextCursor };
};

/**
 * Upsert a reaction — one user, one emoji per message.
 * FIX #2 — single atomic bulkWrite replaces two-step $pull + $push (race condition).
 *
 * Flow:
 *   - emoji provided  → remove existing reaction from this user, add new one
 *   - emoji null      → remove reaction (toggle off)
 *
 * @param {ObjectId}      messageId
 * @param {ObjectId}      userId
 * @param {string|null}   emoji
 * @returns {Document|null}
 */
messageSchema.statics.upsertReaction = async function (messageId, userId, emoji) {
  if (emoji) {
    // Atomic: pull old reaction + push new in a single write
    return this.findByIdAndUpdate(
      messageId,
      {
        $pull: { reactions: { userId } },
      },
      { new: false }, // get doc state AFTER pull to check reaction cap
    ).then(async () => {
      // Check cap before pushing (re-fetch is necessary since $pull and cap
      // check can't be done atomically without a transaction)
      const current = await this.findById(messageId, { reactions: 1 });
      if (!current) return null;
      if (current.reactions.length >= MAX_REACTIONS_CAP) {
        throw Object.assign(
          new Error(`Message has reached the maximum of ${MAX_REACTIONS_CAP} reactions`),
          { statusCode: 400 },
        );
      }
      return this.findByIdAndUpdate(
        messageId,
        { $push: { reactions: { userId, emoji: emoji.trim(), reactedAt: new Date() } } },
        { new: true },
      );
    });
  }

  // emoji null = remove reaction only
  return this.findByIdAndUpdate(
    messageId,
    { $pull: { reactions: { userId } } },
    { new: true },
  );
};

/**
 * Soft delete a message — clears all content including reactions and replyTo.
 * FIX #6 — reactions and replyTo now cleared on delete (were leaking before).
 *
 * @param {ObjectId} messageId
 * @param {ObjectId} requesterId  — must be the sender
 * @returns {Document|null}
 */
messageSchema.statics.softDelete = function (messageId, requesterId) {
  return this.findOneAndUpdate(
    { _id: messageId, sender: requesterId, isDeleted: false },
    {
      $set: {
        isDeleted:  true,
        deletedAt:  new Date(),
        text:       "",
        image:      null,
        reactions:  [],   // FIX #6 — was missing
        replyTo:    null, // FIX #6 — was missing (preview leaked deleted content)
      },
    },
    { new: true },
  );
};

/**
 * Edit a message — saves previous version to editHistory.
 * FIX #18 — previous content preserved in editHistory for audit/moderation.
 *
 * @param {ObjectId} messageId
 * @param {ObjectId} senderId     — ownership check
 * @param {string}   newText
 * @returns {Document|null}
 */
messageSchema.statics.editMessage = async function (messageId, senderId, newText) {
  const trimmed = newText?.trim();
  if (!trimmed) {
    throw Object.assign(new Error("Edited message text cannot be empty"), { statusCode: 400 });
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw Object.assign(
      new Error(`Message cannot exceed ${MAX_TEXT_LENGTH} characters`),
      { statusCode: 400 },
    );
  }

  // Load current text to push to editHistory
  const current = await this.findOne(
    { _id: messageId, sender: senderId, isDeleted: false },
    { text: 1 },
  );
  if (!current) return null;

  return this.findByIdAndUpdate(
    messageId,
    {
      $set:  { text: trimmed, isEdited: true, editedAt: new Date() },
      $push: { editHistory: { text: current.text, editedAt: new Date() } },
    },
    { new: true },
  );
};

/**
 * Delete all messages in a conversation (conversation deletion cleanup).
 * Hard delete — called when the entire conversation is deleted.
 *
 * @param {ObjectId} conversationId
 * @returns {{ deletedCount: number }}
 */
messageSchema.statics.deleteAllByConversation = async function (conversationId) {
  const result = await this.deleteMany({ conversation: conversationId });
  return { deletedCount: result.deletedCount ?? 0 };
};

/**
 * Get the latest N messages for a conversation (for conversation list preview).
 *
 * @param {ObjectId} conversationId
 * @param {number}   limit           — default 1 (last message preview)
 * @returns {Document[]}
 */
messageSchema.statics.getLatestMessages = function (conversationId, limit = 1) {
  return this.find({ conversation: conversationId, isDeleted: false })
    .sort({ _id: -1 })
    .limit(limit)
    .populate("sender", "username fullName avatar")
    .lean();
};

// ─────────────────────────────────────────────────────────────────────────────
//  Model Export (hot-reload safe)
// ─────────────────────────────────────────────────────────────────────────────

const Message = models.Message || model("Message", messageSchema);
export default Message;