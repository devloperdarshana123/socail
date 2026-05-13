import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Block Schema
//  When A blocks B:
//    - B cannot see A's posts/stories/profile
//    - B cannot follow A
//    - Any existing follow between A↔B is removed (handle in service layer)
//    - DMs are disabled
// ─────────────────────────────────────────────

const blockSchema = new Schema(
  {
    blocker: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Blocker is required"],
    },

    blocked: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Blocked user is required"],
    },
  },
  {
    timestamps: true, // createdAt = when blocked
  }
);

// ─────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────

// Prevent duplicate block
blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

// Fast lookup: has user X blocked user Y?
blockSchema.index({ blocker: 1, createdAt: -1 });

// Fast lookup: has user Y been blocked by user X?
blockSchema.index({ blocked: 1 });

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * Check if userA has blocked userB
 */
blockSchema.statics.isBlocked = async function (blockerId, blockedId) {
  const doc = await this.findOne({ blocker: blockerId, blocked: blockedId });
  return !!doc;
};

/**
 * Check block in both directions (A blocked B OR B blocked A)
 * Useful before showing content / allowing follow
 */
blockSchema.statics.isBlockedEither = async function (userAId, userBId) {
  const doc = await this.findOne({
    $or: [
      { blocker: userAId, blocked: userBId },
      { blocker: userBId, blocked: userAId },
    ],
  });
  return !!doc;
};

/**
 * Get all blocked user IDs by a user
 */
blockSchema.statics.getBlockedIds = function (userId) {
  return this.find({ blocker: userId }).distinct("blocked");
};

/**
 * Get all users who have blocked a specific user
 */
blockSchema.statics.getBlockerIds = function (userId) {
  return this.find({ blocked: userId }).distinct("blocker");
};

/**
 * Block a user
 */
blockSchema.statics.blockUser = async function (blockerId, blockedId) {
  if (blockerId.toString() === blockedId.toString()) {
    throw new Error("Cannot block yourself");
  }
  return this.findOneAndUpdate(
    { blocker: blockerId, blocked: blockedId },
    { blocker: blockerId, blocked: blockedId },
    { upsert: true, new: true }
  );
};

/**
 * Unblock a user
 */
blockSchema.statics.unblockUser = function (blockerId, blockedId) {
  return this.findOneAndDelete({ blocker: blockerId, blocked: blockedId });
};

/**
 * Get block list with user details (paginated)
 */
blockSchema.statics.getBlockList = function (userId, page = 1, limit = 20) {
  return this.find({ blocker: userId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("blocked", "username fullName avatar isVerifiedBadge");
};

const Block = models.Block || model("Block", blockSchema);
export default Block;