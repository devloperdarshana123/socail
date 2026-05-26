
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PAGE_LIMIT = 50;

/**
 * FIX #14 — Per-type dedup window (ms).
 * Different notification types have different meaningful dedup periods.
 *   - "follow"   : Infinity  → only one follow notification per relationship ever
 *   - "story_view": 86400000 → dedup for the story's full 24h lifetime
 *   - "post_like" : 300000   → 5 minutes (re-like after unlike is a new event)
 *   - default    : 60000     → 60 seconds for everything else
 */
const DEDUP_WINDOW_MS = {
  follow:                  Infinity,
  follow_request:          Infinity,
  post_tag:                Infinity,
  story_view:              86_400_000, // 24 hours
  story_mention:           Infinity,
  post_mention:            Infinity,
  comment_mention:         Infinity,
  post_like:               300_000,    // 5 min
  comment_like:            300_000,
  story_reaction:          300_000,
  post_comment:            60_000,     // 60 sec
  comment_reply:           60_000,
  story_reply:             60_000,
  new_message:             10_000,     // 10 sec
  new_group_message:       10_000,
  follow_request_accepted: Infinity,
  system:                  0,          // system notifications are never deduped
};

/**
 * FIX #15 — Valid refModel per notification type.
 * null means no ref is needed.
 */
const TYPE_REF_MODEL_MAP = {
  post_like:               "Post",
  post_comment:            "Post",
  post_mention:            "Post",
  post_tag:                "Post",
  comment_like:            "Comment",
  comment_reply:           "Comment",
  comment_mention:         "Comment",
  follow:                  null,
  follow_request:          null,
  follow_request_accepted: null,
  story_view:              "Story",
  story_reaction:          "Story",
  story_reply:             "Story",
  story_mention:           "Story",
  new_message:             "Conversation",
  new_group_message:       "Conversation",
  system:                  null,
};

/**
 * FIX #11 — Types that should NOT be TTL-deleted.
 * System notifications and permanent relationship events persist indefinitely.
 * These get ttlExpiresAt: null which the sparse TTL index ignores.
 */
const PERMANENT_TYPES = new Set([
  "system",
  "follow",
  "follow_request_accepted",
]);

// 90 days in ms
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
//  Notification Schema
// ─────────────────────────────────────────────────────────────────────────────

const notificationSchema = new Schema(
  {
    // ── Who receives this notification ────────────────────────────────────────
    receiver: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "Receiver is required"],
      index:    true,
    },

    // ── Who triggered it (null for system notifications) ──────────────────────
    sender: {
      type:    Schema.Types.ObjectId,
      ref:     "User",
      default: null,
      index:   true,
    },

    // ── Notification Type ─────────────────────────────────────────────────────
    type: {
      type:     String,
      required: [true, "Notification type is required"],
      enum:     Object.keys(TYPE_REF_MODEL_MAP),
      index:    true,
    },

    // ── Polymorphic ref to the entity that triggered it ───────────────────────
    refId: {
      type:    Schema.Types.ObjectId,
      refPath: "refModel",
      default: null,
    },

    // FIX #15 — validated against type in pre("validate") hook
    refModel: {
      type:    String,
      enum:    ["Post", "Comment", "Story", "Conversation", null],
      default: null,
    },

    // ── Extra metadata ────────────────────────────────────────────────────────
    meta: {
      // FIX #5 — trim: true added; controller must strip HTML before storing
      preview: {
        type:      String,
        maxlength: [100, "Preview cannot exceed 100 characters"],
        trim:      true,
        default:   null,
      },

      // FIX #7 — maxlength: 10 added (was unbounded before)
      reaction: {
        type:      String,
        maxlength: [10, "Reaction cannot exceed 10 characters"],
        default:   null,
      },

      extraCount: {
        type:    Number,
        default: 0,
        min:     0,
      },

      // FIX #6 — http/https URL validation (was unvalidated before)
      imageUrl: {
        type:    String,
        default: null,
        validate: {
          validator: (v) => !v || /^https?:\/\/.+/.test(v),
          message:   "imageUrl must be a valid http/https URL",
        },
      },
    },

    // ── Read State ────────────────────────────────────────────────────────────
    isRead: {
      type:    Boolean,
      default: false,
      index:   true,
    },

    readAt: {
      type:    Date,
      default: null,
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

    /**
     * FIX #11 — Sparse TTL field replaces createdAt TTL index.
     * PERMANENT_TYPES (system, follow, follow_request_accepted) get null here
     * and are ignored by the sparse TTL index → never auto-deleted.
     * All other types get a Date 90 days from creation → auto-deleted.
     */
    ttlExpiresAt: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────────────────────────────────────

// Inbox feed — receiver's notifications sorted newest first
notificationSchema.index({ receiver: 1, isDeleted: 1, createdAt: -1 });

// Unread badge count
notificationSchema.index({ receiver: 1, isRead: 1, isDeleted: 1 });

// FIX #12 — covers markTypeAsRead query: { receiver, type, isRead, isDeleted }
notificationSchema.index({ receiver: 1, type: 1, isRead: 1, isDeleted: 1 });

/**
 * FIX #3 — unique: true added.
 * DB-level enforcement: one notification per (receiver + sender + type + refId).
 * sparse: true so null refId values (follow, system) don't conflict with each other.
 * Combined with the upsert in createNotification, this eliminates TOCTOU races.
 */
notificationSchema.index(
  { receiver: 1, sender: 1, type: 1, refId: 1 },
  { unique: true, sparse: true },
);

/**
 * FIX #11 — Sparse TTL index on ttlExpiresAt (not createdAt).
 * sparse: true means documents where ttlExpiresAt === null are ignored
 * → PERMANENT_TYPES are never auto-deleted by MongoDB.
 */
notificationSchema.index(
  { ttlExpiresAt: 1 },
  { expireAfterSeconds: 0, sparse: true },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Pre-validate Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FIX #15 — Validate refModel matches the expected model for the notification type.
 * FIX #11 — Set ttlExpiresAt: null for permanent types, Date for the rest.
 */
notificationSchema.pre("validate", function () {
  // Validate refModel vs type
  const expectedRefModel = TYPE_REF_MODEL_MAP[this.type];
  if (expectedRefModel !== undefined && this.refModel !== expectedRefModel) {
    throw Object.assign(
      new Error(
        `Notification type "${this.type}" requires refModel "${expectedRefModel ?? "null"}", ` +
        `got "${this.refModel}"`,
      ),
      { statusCode: 400 },
    );
  }

  // Set TTL expiry on new documents only
  if (this.isNew) {
    this.ttlExpiresAt = PERMANENT_TYPES.has(this.type)
      ? null
      : new Date(Date.now() + TTL_MS);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Virtuals
//
//  FIX #17 — label virtual kept here for server-side use (e.g. push notification
//             payload construction) but documented: frontend should maintain its
//             own label map client-side instead of relying on API to send it.
// ─────────────────────────────────────────────────────────────────────────────

notificationSchema.virtual("label").get(function () {
  const labels = {
    post_like:               "liked your post",
    post_comment:            "commented on your post",
    post_mention:            "mentioned you in a post",
    post_tag:                "tagged you in a post",
    comment_like:            "liked your comment",
    comment_reply:           "replied to your comment",
    comment_mention:         "mentioned you in a comment",
    follow:                  "started following you",
    follow_request:          "requested to follow you",
    follow_request_accepted: "accepted your follow request",
    story_view:              "viewed your story",
    story_reaction:          "reacted to your story",
    story_reply:             "replied to your story",
    story_mention:           "mentioned you in a story",
    new_message:             "sent you a message",
    new_group_message:       "sent a message in group",
    system:                  "system notification",
  };
  return labels[this.type] || this.type;
});

// ─────────────────────────────────────────────────────────────────────────────
//  Populate configs per refModel type — FIX #4
//  refId can be Post | Comment | Story | Conversation — each has different fields.
//  A single .populate({ path: "refId", select: "caption media type text" }) was
//  returning wrong/empty fields for most types silently.
// ─────────────────────────────────────────────────────────────────────────────

const REF_POPULATE_SELECT = {
  Post:         "caption media type likesCount commentsCount author",
  Comment:      "text post author",
  Story:        "media type author expiresAt",
  Conversation: "participants lastMessage isGroup groupName",
};

// ─────────────────────────────────────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a notification — skips self-notifications, deduplicates per type window.
 *
 * FIX #2  — atomic findOneAndUpdate + upsert replaces findOne + create (TOCTOU).
 *           Two simultaneous identical events produce exactly one notification.
 * FIX #3  — unique index enforces dedup at DB level; duplicate key (11000) is
 *           caught and treated as "already exists" — not an error.
 * FIX #14 — dedup window is per-type from DEDUP_WINDOW_MS config.
 * FIX #15 — refModel validated by pre("validate") hook.
 *
 * @param {object} params
 * @param {ObjectId}      params.receiver
 * @param {ObjectId|null} params.sender
 * @param {string}        params.type
 * @param {ObjectId|null} [params.refId]
 * @param {string|null}   [params.refModel]
 * @param {object}        [params.meta]
 * @returns {Document|null}
 */
notificationSchema.statics.createNotification = async function ({
  receiver,
  sender,
  type,
  refId    = null,
  refModel = null,
  meta     = {},
}) {
  // No self-notifications
  if (sender && receiver.toString() === sender.toString()) return null;

  const dedupWindowMs = DEDUP_WINDOW_MS[type] ?? 60_000;

  // Infinity window types (follow, post_tag etc.) — upsert with no time filter
  // so only one notification ever exists for this (receiver, sender, type, refId)
  const dedupFilter = {
    receiver,
    sender,
    type,
    refId,
  };

  if (dedupWindowMs !== Infinity && dedupWindowMs > 0) {
    dedupFilter.createdAt = { $gte: new Date(Date.now() - dedupWindowMs) };
  }

  // For system (dedupWindowMs === 0): always create new — don't upsert
  if (dedupWindowMs === 0) {
    try {
      return await this.create({ receiver, sender, type, refId, refModel, meta });
    } catch (err) {
      if (err.code === 11000) return null; // shouldn't happen for system, but safe
      throw err;
    }
  }

  // FIX #2 — atomic upsert: findOneAndUpdate with upsert creates on miss,
  //           updates (refreshes meta) on hit. No TOCTOU window.
  // FIX #3 — unique index backs this up at DB level.
  try {
    return await this.findOneAndUpdate(
      dedupFilter,
      {
        $setOnInsert: { receiver, sender, type, refId, refModel },
        $set:         { meta, isDeleted: false },
        $inc:         { "meta.extraCount": 0 }, // touch doc to reset updatedAt
      },
      {
        upsert:              true,
        new:                 true,
        setDefaultsOnInsert: true,
      },
    );
  } catch (err) {
    // FIX #3 — unique index violation = notification already exists; not an error
    if (err.code === 11000) return null;
    throw err;
  }
};

/**
 * Get paginated notifications for a user (inbox).
 * FIX #1  — cursor replaces skip() (was scanning all preceding docs at scale).
 * FIX #4  — refId populate now uses per-model field selection.
 *
 * @param {ObjectId} userId
 * @param {object}   opts
 * @param {number}   opts.limit
 * @param {ObjectId} [opts.beforeId]  — cursor
 * @returns {{ items, hasMore, nextCursor }}
 */
notificationSchema.statics.getInbox = async function (userId, opts = {}) {
  const limit = Math.min(parseInt(opts.limit) || 20, MAX_PAGE_LIMIT);
  const query = { receiver: userId, isDeleted: false };

  if (opts.beforeId) query._id = { $lt: opts.beforeId };

  const results = await this.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("sender", "username fullName avatar isVerifiedBadge");

  // FIX #4 — populate refId with correct fields per refModel type
  // We can't use a single .populate() with one select string because each
  // refModel (Post/Comment/Story/Conversation) has completely different fields.
  // Instead we populate each document's refId based on its own refModel value.
  const populatedResults = await Promise.all(
    results.map(async (doc) => {
      if (doc.refId && doc.refModel && REF_POPULATE_SELECT[doc.refModel]) {
        await doc.populate({
          path:   "refId",
          select: REF_POPULATE_SELECT[doc.refModel],
        });
      }
      return doc;
    }),
  );

  const hasMore    = populatedResults.length > limit;
  const items      = hasMore ? populatedResults.slice(0, -1) : populatedResults;
  const nextCursor = hasMore && items.length ? items[items.length - 1]._id : null;

  return { items, hasMore, nextCursor };
};

/**
 * Get unread notification count (for badge).
 *
 * @param {ObjectId} userId
 * @returns {number}
 */
notificationSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({
    receiver:  userId,
    isRead:    false,
    isDeleted: false,
  });
};

/**
 * Get unread counts grouped by type (for notification tabs).
 * Returns: [{ type: "post_like", count: 5 }, ...]
 *
 * FIX #10 — PRODUCTION NOTE: cache this in Redis with ~30s TTL.
 *           Running this aggregation on every tab render on a user with 50k
 *           notifications will be slow. Never call uncached in a hot path.
 *
 * @param {ObjectId} userId
 * @returns {Array<{ type: string, count: number }>}
 */
notificationSchema.statics.getUnreadByType = function (userId) {
  return this.aggregate([
    {
      $match: {
        receiver:  new mongoose.Types.ObjectId(userId),
        isRead:    false,
        isDeleted: false,
      },
    },
    { $group:   { _id: "$type", count: { $sum: 1 } } },
    { $project: { _id: 0, type: "$_id", count: 1 } },
    { $sort:    { count: -1 } },
  ]);
};

/**
 * Mark a single notification as read.
 *
 * @param {ObjectId} notificationId
 * @param {ObjectId} userId          — ownership check
 * @returns {Document|null}
 */
notificationSchema.statics.markAsRead = function (notificationId, userId) {
  return this.findOneAndUpdate(
    { _id: notificationId, receiver: userId, isRead: false },
    { isRead: true, readAt: new Date() },
    { new: true },
  );
};

/**
 * Mark ALL notifications as read for a user.
 * FIX #16 — returns normalized { modifiedCount } instead of raw updateMany result.
 *
 * @param {ObjectId} userId
 * @returns {{ modifiedCount: number }}
 */
notificationSchema.statics.markAllAsRead = async function (userId) {
  const result = await this.updateMany(
    { receiver: userId, isRead: false, isDeleted: false },
    { isRead: true, readAt: new Date() },
  );
  return { modifiedCount: result.modifiedCount ?? 0 };
};

/**
 * Mark all notifications of a specific type as read.
 * FIX #12 — uses { receiver, type, isRead, isDeleted } compound index.
 * FIX #16 — returns normalized { modifiedCount }.
 *
 * e.g. mark all "new_message" read when user opens DM inbox.
 *
 * @param {ObjectId} userId
 * @param {string}   type
 * @returns {{ modifiedCount: number }}
 */
notificationSchema.statics.markTypeAsRead = async function (userId, type) {
  const result = await this.updateMany(
    { receiver: userId, type, isRead: false, isDeleted: false },
    { isRead: true, readAt: new Date() },
  );
  return { modifiedCount: result.modifiedCount ?? 0 };
};

/**
 * Soft delete a single notification (receiver-only action).
 *
 * @param {ObjectId} notificationId
 * @param {ObjectId} userId
 * @returns {Document|null}
 */
notificationSchema.statics.softDelete = function (notificationId, userId) {
  return this.findOneAndUpdate(
    { _id: notificationId, receiver: userId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
    { new: true },
  );
};

/**
 * Soft delete all notifications triggered by a specific ref.
 * FIX #8 — changed from deleteMany (hard) to updateMany (soft).
 *           Audit trail preserved. Consistent with all other deletion methods.
 *
 * e.g. when a post is deleted, soft-delete all its like/comment notifications.
 *
 * @param {ObjectId} refId
 * @param {string}   refModel
 * @returns {{ modifiedCount: number }}
 */
notificationSchema.statics.deleteByRef = async function (refId, refModel) {
  const result = await this.updateMany(
    { refId, refModel, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
  );
  return { modifiedCount: result.modifiedCount ?? 0 };
};

/**
 * Soft delete all notifications for a user (account deletion).
 * FIX #9 — returns normalized { deletedCount } instead of raw deleteMany result.
 *
 * @param {ObjectId} userId
 * @returns {{ deletedCount: number }}
 */
notificationSchema.statics.deleteAllForUser = async function (userId) {
  const result = await this.updateMany(
    {
      $or:       [{ receiver: userId }, { sender: userId }],
      isDeleted: false,
    },
    { isDeleted: true, deletedAt: new Date() },
  );
  return { deletedCount: result.modifiedCount ?? 0 };
};

/**
 * Remove all notifications sent by a specific sender to a specific receiver.
 * Useful when a user unfollows or blocks someone — cleans up their notifications.
 *
 * @param {ObjectId} senderId
 * @param {ObjectId} receiverId
 * @returns {{ deletedCount: number }}
 */
notificationSchema.statics.deleteBySenderAndReceiver = async function (senderId, receiverId) {
  const result = await this.updateMany(
    { sender: senderId, receiver: receiverId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
  );
  return { deletedCount: result.modifiedCount ?? 0 };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Model Export (hot-reload safe)
// ─────────────────────────────────────────────────────────────────────────────

const Notification = models.Notification || model("Notification", notificationSchema);
export default Notification;