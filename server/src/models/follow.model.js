import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Follow Schema
//  Handles: follow request, accept, reject, unfollow
//  For private accounts → status: "pending" until accepted
//  For public accounts  → status: "accepted" immediately
// ─────────────────────────────────────────────

const followSchema = new Schema(
  {
    follower: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Follower is required"],
    },

    following: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Following user is required"],
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "accepted", // override to "pending" for private accounts
      index: true,
    },
  },
  {
    timestamps: true, // createdAt = when they followed/requested
  }
);

// ─────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────

// Primary: prevent duplicate follow
followSchema.index({ follower: 1, following: 1 }, { unique: true });

// Fetch all followers of a user fast
followSchema.index({ following: 1, status: 1, createdAt: -1 });

// Fetch all following of a user fast
followSchema.index({ follower: 1, status: 1, createdAt: -1 });

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * Check if userA follows userB (accepted)
 */
followSchema.statics.isFollowing = async function (followerId, followingId) {
  const doc = await this.findOne({
    follower: followerId,
    following: followingId,
    status: "accepted",
  });
  return !!doc;
};

/**
 * Check follow status between two users
 * Returns: "accepted" | "pending" | "rejected" | null
 */
followSchema.statics.getFollowStatus = async function (followerId, followingId) {
  const doc = await this.findOne({
    follower: followerId,
    following: followingId,
  });
  return doc ? doc.status : null;
};

/**
 * Get all follower user IDs of a user (accepted only)
 */
followSchema.statics.getFollowerIds = function (userId) {
  return this.find({ following: userId, status: "accepted" })
    .distinct("follower");
};

/**
 * Get all following user IDs of a user (accepted only)
 */
followSchema.statics.getFollowingIds = function (userId) {
  return this.find({ follower: userId, status: "accepted" })
    .distinct("following");
};

/**
 * Get pending follow requests for a private account
 */
followSchema.statics.getPendingRequests = function (userId, page = 1, limit = 20) {
  return this.find({ following: userId, status: "pending" })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("follower", "username fullName avatar isVerifiedBadge");
};

/**
 * Unfollow — deletes the document
 */
followSchema.statics.unfollow = function (followerId, followingId) {
  return this.findOneAndDelete({ follower: followerId, following: followingId });
};

/**
 * Accept a follow request
 */
followSchema.statics.acceptRequest = function (followerId, followingId) {
  return this.findOneAndUpdate(
    { follower: followerId, following: followingId, status: "pending" },
    { status: "accepted" },
    { new: true }
  );
};

/**
 * Reject a follow request
 */
followSchema.statics.rejectRequest = function (followerId, followingId) {
  return this.findOneAndDelete({
    follower: followerId,
    following: followingId,
    status: "pending",
  });
};

/**
 * Get mutual followers between two users
 */
followSchema.statics.getMutualFollowers = async function (userAId, userBId) {
  const [aFollowers, bFollowers] = await Promise.all([
    this.find({ following: userAId, status: "accepted" }).distinct("follower"),
    this.find({ following: userBId, status: "accepted" }).distinct("follower"),
  ]);

  const aSet = new Set(aFollowers.map((id) => id.toString()));
  return bFollowers.filter((id) => aSet.has(id.toString()));
};

const Follow = models.Follow || model("Follow", followSchema);
export default Follow;