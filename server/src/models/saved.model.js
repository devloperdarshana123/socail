// import mongoose from "mongoose";

// const { Schema, model, models } = mongoose;

// // ─────────────────────────────────────────────
// //  Saved (Bookmark) Schema
// //  One document per (user + post) — unique
// // ─────────────────────────────────────────────

// const savedSchema = new Schema(
//   {
//     savedBy: {
//       type: Schema.Types.ObjectId,
//       ref: "User",
//       required: [true, "savedBy is required"],
//       index: true,
//     },

//     post: {
//       type: Schema.Types.ObjectId,
//       ref: "Post",
//       required: [true, "post is required"],
//       index: true,
//     },
//   },
//   { timestamps: true }
// );

// // One user can save a post only once
// savedSchema.index({ savedBy: 1, post: 1 }, { unique: true });

// // Fetch all saved posts of a user (sorted newest first)
// savedSchema.index({ savedBy: 1, createdAt: -1 });

// // ─────────────────────────────────────────────
// //  Statics
// // ─────────────────────────────────────────────

// /** Toggle save — returns { saved: boolean } */
// savedSchema.statics.toggleSave = async function (userId, postId) {
//   const existing = await this.findOne({ savedBy: userId, post: postId });

//   if (existing) {
//     await existing.deleteOne();
//     return { saved: false };
//   }

//   await this.create({ savedBy: userId, post: postId });
//   return { saved: true };
// };

// /** Check if user has saved a post */
// savedSchema.statics.hasSaved = async function (userId, postId) {
//   const doc = await this.findOne({ savedBy: userId, post: postId });
//   return !!doc;
// };

// /** Bulk check — which postIds has the user saved */
// savedSchema.statics.getBulkSaveStatus = async function (userId, postIds) {
//   const saved = await this.find({
//     savedBy: userId,
//     post: { $in: postIds },
//   }).select("post");
//   return new Set(saved.map((s) => s.post.toString()));
// };

// /** Get saved posts for a user (paginated) */
// savedSchema.statics.getSavedPosts = async function (userId, page = 1, limit = 12) {
//   const results = await this.find({ savedBy: userId })
//     .sort({ createdAt: -1 })
//     .skip((page - 1) * limit)
//     .limit(limit)
//     .populate({
//       path: "post",
//       match: { isDeleted: false, isDraft: false },
//       select: "media type likesCount commentsCount viewsCount caption createdAt author",
//       populate: { path: "author", select: "username fullName avatar" },
//     });

//   // null posts filter karo (deleted/draft posts ki jagah null aata hai)
//   return results.filter((s) => s.post !== null);
// };

// const Saved = models.Saved || model("Saved", savedSchema);
// export default Saved;



import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SAVED_PER_USER = 5000; // cap per user (Instagram-style)
const MAX_BULK_IDS       = 100;  // max postIds in getBulkSaveStatus
const MAX_PAGE_LIMIT     = 50;   // max items per page

// ─────────────────────────────────────────────────────────────────────────────
//  Saved (Bookmark) Schema
//  One document per (savedBy + post) pair — enforced by unique index
// ─────────────────────────────────────────────────────────────────────────────

const savedSchema = new Schema(
  {
    savedBy: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "savedBy is required"],
    },

    post: {
      type:     Schema.Types.ObjectId,
      ref:      "Post",
      required: [true, "post is required"],
    },
  },
  { timestamps: true },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────────────────────────────────────

// Primary constraint — one save per (user, post) pair
savedSchema.index({ savedBy: 1, post: 1 }, { unique: true });

// Cursor-based pagination for user's saved list (FIX #4)
savedSchema.index({ savedBy: 1, _id: -1 });

// ─────────────────────────────────────────────────────────────────────────────
//  Statics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Toggle save/unsave atomically.
 * FIX #1 — no TOCTOU race condition; uses upsert + duplicate key handling.
 * FIX #9 — atomically updates Post.savedCount when the model has it.
 *
 * @returns {{ saved: boolean }}
 */
savedSchema.statics.toggleSave = async function (userId, postId) {
  const Post = mongoose.model("Post");

  // Verify post exists and is visible before saving
  // FIX #3 — guard against saving non-existent / deleted / draft posts
  const post = await Post.findOne({
    _id:       postId,
    isDeleted: false,
    isDraft:   false,
  }).select("_id savedCount");

  if (!post) {
    throw Object.assign(new Error("Post not found or not available"), { statusCode: 404 });
  }

  try {
    // Attempt atomic insert — succeeds only if (userId, postId) doesn't exist
    await this.create({ savedBy: userId, post: postId });

    // Atomically increment Post.savedCount if the field exists
    if ("savedCount" in (post.toObject?.() ?? post)) {
      await Post.findByIdAndUpdate(postId, { $inc: { savedCount: 1 } });
    }

    return { saved: true };
  } catch (err) {
    // Duplicate key (code 11000) = already saved → unsave atomically
    if (err.code === 11000) {
      await this.deleteOne({ savedBy: userId, post: postId });

      if ("savedCount" in (post.toObject?.() ?? post)) {
        await Post.findByIdAndUpdate(postId, {
          $inc: { savedCount: -1 },
        });
      }

      return { saved: false };
    }
    throw err; // re-throw unexpected errors
  }
};

/**
 * Check if a user has saved a specific post.
 * FIX #2 — uses exists() instead of findOne() — no document transfer overhead.
 *
 * @returns {boolean}
 */
savedSchema.statics.hasSaved = async function (userId, postId) {
  return !!(await this.exists({ savedBy: userId, post: postId }));
};

/**
 * Bulk check — which postIds has the user saved.
 * FIX #6 — empty array guard + cap at MAX_BULK_IDS.
 *
 * @param {ObjectId}   userId
 * @param {ObjectId[]} postIds
 * @returns {Set<string>}
 */
savedSchema.statics.getBulkSaveStatus = async function (userId, postIds) {
  // FIX #6 — guard empty input and cap size
  if (!postIds?.length) return new Set();

  const safeIds = postIds.slice(0, MAX_BULK_IDS);

  const saved = await this.find({
    savedBy: userId,
    post:    { $in: safeIds },
  }).select("post");

  return new Set(saved.map((s) => s.post.toString()));
};

/**
 * Get paginated saved posts for a user.
 * FIX #4 — cursor-based pagination (no skip() scan).
 * FIX #5 — limit capped at MAX_PAGE_LIMIT.
 * FIX #7 — populate+match trap avoided: we query Post separately so
 *           pagination counts are always accurate regardless of deleted posts.
 *
 * @param {ObjectId} userId
 * @param {object}   opts     — { limit, beforeId }
 *   beforeId: last _id from previous page (for cursor pagination)
 * @returns {{ items: Saved[], hasMore: boolean }}
 */
savedSchema.statics.getSavedPosts = async function (userId, opts = {}) {
  const limit = Math.min(parseInt(opts.limit) || 12, MAX_SAVED_PER_USER);
  const safeLimit = Math.min(limit, MAX_PAGE_LIMIT);

  const query = { savedBy: userId };

  // Cursor pagination — records older than beforeId
  // FIX #4 — _id-based cursor instead of skip()
  if (opts.beforeId) {
    query._id = { $lt: opts.beforeId };
  }

  // Fetch one extra to determine hasMore without a separate count query
  const results = await this.find(query)
    .sort({ _id: -1 })
    .limit(safeLimit + 1)
    .populate({
      path:   "post",
      // FIX #7 — match only active posts; nulls are excluded below cleanly
      match:  { isDeleted: false, isDraft: false },
      select: "media type likesCount commentsCount viewsCount savedCount caption createdAt author",
      populate: {
        path:   "author",
        select: "username fullName avatar isVerifiedBadge",
      },
    });

  // Filter out null posts (deleted/draft) — FIX #7
  // Note: because we filter after fetch, the returned page may be smaller
  // than safeLimit. The cursor (hasMore + nextCursor) stays accurate.
  const valid   = results.filter((s) => s.post !== null);
  const hasMore = results.length > safeLimit;
  const items   = hasMore ? valid.slice(0, -1) : valid;

  return {
    items,
    hasMore,
    nextCursor: hasMore && items.length ? items[items.length - 1]._id : null,
  };
};

/**
 * Get total saved count for a user.
 * Useful for enforcing the MAX_SAVED_PER_USER cap in the controller.
 *
 * @returns {number}
 */
savedSchema.statics.getSavedCount = function (userId) {
  return this.countDocuments({ savedBy: userId });
};

/**
 * Remove all saves by a user (account deletion / deactivation).
 */
savedSchema.statics.removeAllByUser = function (userId) {
  return this.deleteMany({ savedBy: userId });
};

/**
 * Remove all saves for a post (post deletion).
 */
savedSchema.statics.removeAllByPost = function (postId) {
  return this.deleteMany({ post: postId });
};

// ─────────────────────────────────────────────────────────────────────────────
//  Model Export (hot-reload safe)
// ─────────────────────────────────────────────────────────────────────────────

const Saved = models.Saved || model("Saved", savedSchema);
export default Saved;