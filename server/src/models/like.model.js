import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Like Schema — Polymorphic
//
//  Supports:   Post | Comment | Story
//  Each like is unique per (user + target)
//  Reaction emoji support (like Instagram)
// ─────────────────────────────────────────────

const likeSchema = new Schema(
  {
    // ── Who liked ─────────────────────────────
    likedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "likedBy is required"],
      index: true,
    },

    // ── What was liked (polymorphic) ──────────
    targetId: {
      type: Schema.Types.ObjectId,
      required: [true, "targetId is required"],
      refPath: "targetModel",
      index: true,
    },

    targetModel: {
      type: String,
      required: [true, "targetModel is required"],
      enum: ["Post", "Comment", "Story"],
    },

    // ── Reaction type ─────────────────────────
    // null = plain like (❤️ default)
    reaction: {
      type: String,
      enum: ["❤️", "🔥", "😮", "😂", "😢", "👏", null],
      default: null, // null means simple like
    },
  },
  {
    timestamps: true, // createdAt = when liked
  }
);

// ─────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────

// Prevent duplicate like — one user one like per target
likeSchema.index({ likedBy: 1, targetId: 1, targetModel: 1 }, { unique: true });

// Fetch all likes on a target (Post/Comment/Story)
likeSchema.index({ targetId: 1, targetModel: 1, createdAt: -1 });

// Fetch all likes by a user (liked posts list)
likeSchema.index({ likedBy: 1, targetModel: 1, createdAt: -1 });

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * Toggle like — like if not liked, unlike if already liked
 * Returns: { liked: boolean, doc: Like | null }
 */
likeSchema.statics.toggleLike = async function (userId, targetId, targetModel, reaction = null) {
  const existing = await this.findOne({
    likedBy: userId,
    targetId,
    targetModel,
  });

  if (existing) {
    await existing.deleteOne();
    return { liked: false, doc: null };
  }

  const doc = await this.create({
    likedBy: userId,
    targetId,
    targetModel,
    reaction,
  });

  return { liked: true, doc };
};

/**
 * Check if a user has liked a target
 */
likeSchema.statics.hasLiked = async function (userId, targetId, targetModel) {
  const doc = await this.findOne({ likedBy: userId, targetId, targetModel });
  return !!doc;
};

/**
 * Get like document (to check reaction type too)
 */
likeSchema.statics.getLike = function (userId, targetId, targetModel) {
  return this.findOne({ likedBy: userId, targetId, targetModel });
};

/**
 * Update reaction on an existing like
 */
likeSchema.statics.updateReaction = function (userId, targetId, targetModel, reaction) {
  return this.findOneAndUpdate(
    { likedBy: userId, targetId, targetModel },
    { reaction },
    { new: true }
  );
};

/**
 * Get users who liked a target (paginated)
 */
likeSchema.statics.getLikers = function (targetId, targetModel, page = 1, limit = 20) {
  return this.find({ targetId, targetModel })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("likedBy", "username fullName avatar isVerifiedBadge");
};

/**
 * Get total like count for a target
 */
likeSchema.statics.getLikesCount = function (targetId, targetModel) {
  return this.countDocuments({ targetId, targetModel });
};

/**
 * Get reaction breakdown for a target
 * Returns: [{ reaction: "❤️", count: 10 }, ...]
 */
likeSchema.statics.getReactionBreakdown = function (targetId, targetModel) {
  return this.aggregate([
    { $match: { targetId: new mongoose.Types.ObjectId(targetId), targetModel } },
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
        reaction: { $ifNull: ["$_id", "❤️"] },
        count: 1,
      },
    },
  ]);
};

/**
 * Get all post IDs liked by a user (for "liked posts" profile tab)
 */
likeSchema.statics.getLikedPostIds = function (userId, page = 1, limit = 20) {
  return this.find({ likedBy: userId, targetModel: "Post" })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select("targetId");
};

/**
 * Delete all likes on a target (e.g., when post is deleted)
 */
likeSchema.statics.deleteAllForTarget = function (targetId, targetModel) {
  return this.deleteMany({ targetId, targetModel });
};

/**
 * Bulk check: which targets has the user liked from a list
 * Returns Set of targetId strings
 */
likeSchema.statics.getBulkLikeStatus = async function (userId, targetIds, targetModel) {
  const liked = await this.find({
    likedBy: userId,
    targetId: { $in: targetIds },
    targetModel,
  }).select("targetId");

  return new Set(liked.map((l) => l.targetId.toString()));
};

const Like = models.Like || model("Like", likeSchema);
export default Like;