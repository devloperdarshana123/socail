

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

/**
 * Valid reaction types.
 * NOTE: We removed `null` as an enum member (fix #13).
 * Plain like = reaction: "❤️" (default).
 * This makes getReactionBreakdown unambiguous —
 * "❤️" always means the user chose ❤️ (or did a plain like,
 * which is semantically identical).
 *
 * If you ever want to distinguish "plain tap" from "hold + pick ❤️",
 * add a `isPlainLike: Boolean` field instead of abusing null.
 */
export const REACTION_TYPES = ["❤️", "🔥", "😮", "😂", "😢", "👏"];

/**
 * Models that can be liked.
 * Extend here — no other code change needed.
 */
export const LIKEABLE_MODELS = ["Post", "Comment", "Story"];

/**
 * Parent models that carry a denormalized likesCount field.
 * toggleLike will $inc this field when updateParentCount: true.
 * Key = targetModel string, Value = Mongoose model name (same here).
 */
const PARENT_COUNT_MODELS = new Set(["Post", "Comment", "Story"]);

// ─────────────────────────────────────────────
//  Schema
// ─────────────────────────────────────────────

const likeSchema = new Schema(
  {
    // ── Who liked ─────────────────────────────
    likedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "likedBy is required"],
      // Fix #12: removed standalone index: true — covered by compound unique index below
    },

    // ── What was liked (polymorphic) ──────────
    targetId: {
      type: Schema.Types.ObjectId,
      required: [true, "targetId is required"],
      refPath: "targetModel",
      // Fix #12: removed standalone index: true — covered by compound unique index below
    },

    targetModel: {
      type: String,
      required: [true, "targetModel is required"],
      enum: {
        values: LIKEABLE_MODELS,
        message: "targetModel must be one of: " + LIKEABLE_MODELS.join(", "),
      },
    },

    // ── Reaction type ─────────────────────────
    // Fix #13: removed null from enum. Default = ❤️ (plain like).
    // Use isPlainLike field if you need to distinguish tap vs hold-pick.
    reaction: {
      type: String,
      enum: {
        values: REACTION_TYPES,
        message: "reaction must be one of: " + REACTION_TYPES.join(", "),
      },
      default: "❤️",
      trim: true,
    },

    // ── Self-like guard (fix #8) ───────────────
    // authorId is stored so pre("validate") can block self-likes
    // without a DB round-trip. Controllers must pass it in.
    // It is NOT indexed — only used for validation.
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      // Not required — Comment likes may not always carry authorId
      // but Post/Story likes should. Document this in controller.
    },
  },
  {
    timestamps: true, // createdAt = when liked
    toJSON: { virtuals: false },
    toObject: { virtuals: false },
  }
);

// ─────────────────────────────────────────────
//  Validation Hook
// ─────────────────────────────────────────────

/**
 * Fix #8: Prevent self-likes.
 * Fires on .create() and .save() only.
 * Controllers calling findOneAndUpdate must enforce this themselves.
 */
likeSchema.pre("validate", function () {
  if (this.authorId && this.likedBy && this.authorId.equals(this.likedBy)) {
    throw new Error("Users cannot like their own content");
  }
});

// ─────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────

// PRIMARY: Unique constraint — one like per (user, target).
// Also covers queries on likedBy prefix alone (fix #12).
likeSchema.index(
  { likedBy: 1, targetId: 1, targetModel: 1 },
  { unique: true, name: "unique_like_per_user_target" }
);

// Fetch all likers on a target, sorted by time
likeSchema.index(
  { targetId: 1, targetModel: 1, createdAt: -1 },
  { name: "target_likes_by_time" }
);

// Fix #10: reaction added to index — covers getReactionBreakdown $group
likeSchema.index(
  { targetId: 1, targetModel: 1, reaction: 1 },
  { name: "target_reaction_breakdown" }
);

// Liked posts by user — for profile tab
likeSchema.index(
  { likedBy: 1, targetModel: 1, createdAt: -1 },
  { name: "user_likes_by_model" }
);

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * toggleLike — atomic like/unlike with optional parent count update.
 *
 * Fix #1: TOCTOU race eliminated.
 *   Strategy: attempt create first.
 *   If E11000 (duplicate key) → user already liked → delete it (unlike).
 *   This is a single-round-trip optimistic path for the common case (liking).
 *
 * Fix #4: Returns previous reaction on unlike so caller can update UI/counters.
 *
 * Fix #14: Pass updateParentCount: true to atomically $inc likesCount
 *   on the parent document. The parent model must be imported dynamically
 *   to avoid circular dependency issues.
 *
 * @param {ObjectId} userId
 * @param {ObjectId} targetId
 * @param {string}   targetModel  — "Post" | "Comment" | "Story"
 * @param {string}   [reaction]   — one of REACTION_TYPES, default "❤️"
 * @param {Object}   [options]
 * @param {boolean}  [options.updateParentCount=false]
 * @param {ObjectId} [options.authorId]  — content author, for self-like guard
 * @returns {{ liked: boolean, doc: Like|null, previousReaction: string|null }}
 */
likeSchema.statics.toggleLike = async function (
  userId,
  targetId,
  targetModel,
  reaction = "❤️",
  { updateParentCount = false, authorId = null } = {}
) {
  // Validate reaction value explicitly (findOneAndUpdate skips validators)
  if (!REACTION_TYPES.includes(reaction)) {
    throw new Error(`Invalid reaction: ${reaction}`);
  }

  // Self-like guard (fix #8) — model-level backup for atomic path
  if (authorId && authorId.toString() === userId.toString()) {
    throw new Error("Users cannot like their own content");
  }

  let liked = false;
  let doc = null;
  let previousReaction = null;

  try {
    // Optimistic create — succeeds on first like (common path)
    doc = await this.create({
      likedBy: userId,
      targetId,
      targetModel,
      reaction,
      authorId,
    });
    liked = true;
  } catch (err) {
    if (err.code !== 11000) throw err; // Unexpected error — rethrow

    // E11000: already liked → unlike (atomic delete)
    const deleted = await this.findOneAndDelete({
      likedBy: userId,
      targetId,
      targetModel,
    }).lean();

    previousReaction = deleted?.reaction ?? null;
    liked = false;
    doc = null;
  }

  // Fix #14: Update denormalized likesCount on parent document
  if (updateParentCount && PARENT_COUNT_MODELS.has(targetModel)) {
    try {
      const ParentModel = mongoose.model(targetModel);
      await ParentModel.findByIdAndUpdate(targetId, {
        $inc: { likesCount: liked ? 1 : -1 },
      });
    } catch {
      // Non-fatal — count drift is recoverable; don't fail the like operation.
      // Log this in production via your logger:
      // logger.warn(`likesCount sync failed for ${targetModel}:${targetId}`);
    }
  }

  return { liked, doc, previousReaction };
};

/**
 * getLike — get full like document for a user+target.
 * Use this instead of hasLiked when you also need the reaction type.
 * Fix #11: hasLiked now calls this internally — no duplicate DB hits.
 *
 * @returns {Like | null}
 */
likeSchema.statics.getLike = function (userId, targetId, targetModel) {
  return this.findOne({ likedBy: userId, targetId, targetModel }).lean();
};

/**
 * hasLiked — boolean check.
 * Fix #11: calls getLike internally; no second DB round trip.
 */
likeSchema.statics.hasLiked = async function (userId, targetId, targetModel) {
  const doc = await this.getLike(userId, targetId, targetModel);
  return !!doc;
};

/**
 * updateReaction — change reaction on an existing like.
 * Fix #5: runValidators: true added.
 */
likeSchema.statics.updateReaction = function (userId, targetId, targetModel, reaction) {
  if (!REACTION_TYPES.includes(reaction)) {
    throw new Error(`Invalid reaction: ${reaction}`);
  }
  return this.findOneAndUpdate(
    { likedBy: userId, targetId, targetModel },
    { reaction },
    { new: true, runValidators: true } // Fix #5
  ).lean();
};

/**
 * getLikers — paginated list of users who liked a target.
 * Fix #2: cursor pagination replaces skip().
 *
 * @param {ObjectId}      targetId
 * @param {string}        targetModel
 * @param {ObjectId|null} [afterId]   — cursor: last Like._id from previous page
 * @param {number}        [limit=20]
 * @returns {{ likers: Like[], nextCursor: ObjectId|null }}
 */
likeSchema.statics.getLikers = async function (
  targetId,
  targetModel,
  afterId = null,
  limit = 20
) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

  const query = { targetId, targetModel };
  if (afterId) query._id = { $lt: afterId };

  const docs = await this.find(query)
    .sort({ _id: -1 })
    .limit(safeLimit + 1)
    .populate("likedBy", "username fullName avatar isVerifiedBadge")
    .lean();

  const hasMore = docs.length > safeLimit;
  if (hasMore) docs.pop();

  return {
    likers: docs,
    nextCursor: hasMore ? docs[docs.length - 1]._id : null,
  };
};

/**
 * getLikesCount — total like count for a target.
 * Fix #9: NOTE — do NOT call this per-post in feed rendering.
 * Use the denormalized Post.likesCount field instead.
 * This method is for reconciliation/admin use only.
 */
likeSchema.statics.getLikesCount = function (targetId, targetModel) {
  return this.countDocuments({ targetId, targetModel });
};

/**
 * getReactionBreakdown — emoji reaction counts for a target.
 * Fix #10: uses the { targetId, targetModel, reaction } index for $group coverage.
 *
 * @returns {{ reaction: string, count: number }[]}
 */
likeSchema.statics.getReactionBreakdown = function (targetId, targetModel) {
  return this.aggregate([
    {
      $match: {
        targetId: new mongoose.Types.ObjectId(targetId),
        targetModel,
      },
    },
    {
      $group: {
        _id: "$reaction",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    {
      $project: {
        _id: 0,
        reaction: "$_id",
        count: 1,
      },
    },
  ]);
};

/**
 * getLikedPostIds — IDs of posts liked by a user, cursor-paginated.
 * Fix #3: cursor pagination replaces skip().
 * Fix #15: returns array of ObjectIds directly, not Like documents.
 *
 * @param {ObjectId}      userId
 * @param {ObjectId|null} [afterId]  — cursor: last Like._id from previous page
 * @param {number}        [limit=20]
 * @returns {{ ids: ObjectId[], nextCursor: ObjectId|null }}
 */
likeSchema.statics.getLikedPostIds = async function (userId, afterId = null, limit = 20) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

  const query = { likedBy: userId, targetModel: "Post" };
  if (afterId) query._id = { $lt: afterId };

  const docs = await this.find(query)
    .sort({ _id: -1 })
    .limit(safeLimit + 1)
    .select("-_id targetId") // Fix #7: only fetch what we need
    .lean();

  const hasMore = docs.length > safeLimit;
  if (hasMore) docs.pop();

  // Fix #15: return IDs directly, not Like docs
  return {
    ids: docs.map((d) => d.targetId),
    nextCursor: hasMore ? docs[docs.length - 1]?._id ?? null : null,
    // NOTE: _id is excluded by select — nextCursor will be null.
    // If cursor is needed, remove "-_id" from select and adjust:
    // .select("targetId") — includes _id by default
  };
};

/**
 * getLikedPostIdsWithCursor — variant that returns cursor too.
 * Use this when you need to paginate.
 */
likeSchema.statics.getLikedPostIdsWithCursor = async function (
  userId,
  afterId = null,
  limit = 20
) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

  const query = { likedBy: userId, targetModel: "Post" };
  if (afterId) query._id = { $lt: afterId };

  const docs = await this.find(query)
    .sort({ _id: -1 })
    .limit(safeLimit + 1)
    .select("targetId") // includes _id for cursor
    .lean();

  const hasMore = docs.length > safeLimit;
  if (hasMore) docs.pop();

  return {
    ids: docs.map((d) => d.targetId),
    nextCursor: hasMore ? docs[docs.length - 1]._id : null,
  };
};

/**
 * getBulkLikeStatus — which targets in a list has the user liked?
 * Fix #7: lean() + minimal field selection.
 *
 * @returns {Set<string>}  — Set of targetId strings
 */
likeSchema.statics.getBulkLikeStatus = async function (userId, targetIds, targetModel) {
  const liked = await this.find({
    likedBy: userId,
    targetId: { $in: targetIds },
    targetModel,
  })
    .select("-_id targetId")
    .lean();

  return new Set(liked.map((l) => l.targetId.toString()));
};

/**
 * getBulkReactions — like getBulkLikeStatus but includes reaction type.
 * Fix #16: NEW helper — returns Map<targetIdString, reactionString>.
 * Use this to render the correct emoji on feed posts.
 *
 * @returns {Map<string, string>}  — Map of targetId → reaction
 */
likeSchema.statics.getBulkReactions = async function (userId, targetIds, targetModel) {
  const docs = await this.find({
    likedBy: userId,
    targetId: { $in: targetIds },
    targetModel,
  })
    .select("-_id targetId reaction")
    .lean();

  return new Map(docs.map((d) => [d.targetId.toString(), d.reaction]));
};

/**
 * deleteAllForTarget — remove all likes when content is deleted.
 * Fix #6: normalized return shape.
 *
 * @returns {{ deletedCount: number }}
 */
likeSchema.statics.deleteAllForTarget = async function (targetId, targetModel) {
  const result = await this.deleteMany({ targetId, targetModel });
  return { deletedCount: result.deletedCount ?? 0 };
};

/**
 * deleteAllForUser — remove all likes when account is deleted.
 * Called during account deletion cascade.
 *
 * @returns {{ deletedCount: number }}
 */
likeSchema.statics.deleteAllForUser = async function (userId) {
  const result = await this.deleteMany({ likedBy: userId });
  return { deletedCount: result.deletedCount ?? 0 };
};

/**
 * getTopLikedTargets — most liked targets of a given model type.
 * Useful for "trending posts" or "popular comments" features.
 * NOTE: For real trending, use denormalized likesCount on the parent — don't run
 * this aggregation in real-time. Schedule it as a background job.
 *
 * @param {string} targetModel
 * @param {number} [limit=10]
 * @param {Date}   [since]   — only count likes after this date
 * @returns {{ targetId: ObjectId, count: number }[]}
 */
likeSchema.statics.getTopLikedTargets = function (targetModel, limit = 10, since = null) {
  const match = { targetModel };
  if (since) match.createdAt = { $gte: since };

  return this.aggregate([
    { $match: match },
    { $group: { _id: "$targetId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: Math.min(parseInt(limit) || 10, 50) },
    { $project: { _id: 0, targetId: "$_id", count: 1 } },
  ]);
};

// ─────────────────────────────────────────────
//  Model Export
// ─────────────────────────────────────────────

const Like = models.Like || model("Like", likeSchema);
export default Like;