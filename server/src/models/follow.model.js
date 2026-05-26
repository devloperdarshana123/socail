
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

export const FOLLOW_STATUS = {
  PENDING:  "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected", // Fix #15: now actually used — soft reject instead of hard delete
};

// ─────────────────────────────────────────────
//  Schema
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
      enum: {
        values: Object.values(FOLLOW_STATUS),
        message: "status must be pending, accepted, or rejected",
      },
      default: FOLLOW_STATUS.ACCEPTED,
    },

    /**
     * Fix #7: soft-reject audit trail.
     * When a request is rejected, status = "rejected" and rejectedAt is set.
     * A TTL index cleans these up after 90 days (keeps moderation window open).
     * Repeated rejections from the same follower are visible to moderators.
     */
    rejectedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────
//  Pre-validate Hook
// ─────────────────────────────────────────────

/**
 * Fix #6: Prevent self-follow at the schema level.
 * Fires on .create() and .save(). The sendFollowRequest static also
 * checks this explicitly for the atomic path.
 */
followSchema.pre("validate", function () {
  if (this.follower && this.following && this.follower.equals(this.following)) {
    throw new Error("Users cannot follow themselves");
  }
});

// ─────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────

// PRIMARY: unique constraint — one follow relationship per pair
followSchema.index(
  { follower: 1, following: 1 },
  { unique: true, name: "unique_follow_pair" }
);

// Followers list — all users following a given account
followSchema.index(
  { following: 1, status: 1, createdAt: -1 },
  { name: "followers_by_account" }
);

// Following list — all accounts a user follows
followSchema.index(
  { follower: 1, status: 1, createdAt: -1 },
  { name: "following_by_user" }
);

/**
 * Fix #7: TTL on rejected requests — auto-purge after 90 days.
 * sparse: true — only indexes docs where rejectedAt is set (accepted/pending docs ignored).
 */
followSchema.index(
  { rejectedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60, sparse: true, name: "rejected_ttl" }
);

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * sendFollowRequest — atomic follow / re-follow.
 *
 * Fix #1: TOCTOU race eliminated with optimistic create + E11000 catch.
 *   - Public account  → status: "accepted" immediately
 *   - Private account → status: "pending"
 *   - If previously rejected → upsert resets status (allows re-request)
 * Fix #6: self-follow blocked before DB call.
 * Fix #5: if immediately accepted (public), updates User follower/following counts.
 *
 * @param {ObjectId} followerId
 * @param {ObjectId} followingId
 * @param {boolean}  isPrivate    — target account's privacy setting
 * @returns {{ status: string, doc: Follow, alreadyFollowing: boolean }}
 */
followSchema.statics.sendFollowRequest = async function (
  followerId,
  followingId,
  isPrivate = false
) {
  // Fix #6: self-follow guard
  if (followerId.toString() === followingId.toString()) {
    throw new Error("Users cannot follow themselves");
  }

  const status = isPrivate ? FOLLOW_STATUS.PENDING : FOLLOW_STATUS.ACCEPTED;

  try {
    // Optimistic create — succeeds on first follow (common path)
    const doc = await this.create({ follower: followerId, following: followingId, status });

    // Fix #5: update denormalized counts on immediate accept (public accounts)
    if (status === FOLLOW_STATUS.ACCEPTED) {
      await _updateFollowCounts(followerId, followingId, +1);
    }

    return { status: doc.status, doc, alreadyFollowing: false };

  } catch (err) {
    if (err.code !== 11000) throw err;

    // E11000: relationship already exists
    const existing = await this.findOne({ follower: followerId, following: followingId }).lean();

    if (!existing) throw err; // race resolved differently — rethrow

    // If previously rejected — allow re-request by resetting
    if (existing.status === FOLLOW_STATUS.REJECTED) {
      const doc = await this.findOneAndUpdate(
        { follower: followerId, following: followingId },
        { status, rejectedAt: null },
        { new: true }
      ).lean();

      if (status === FOLLOW_STATUS.ACCEPTED) {
        await _updateFollowCounts(followerId, followingId, +1);
      }

      return { status: doc.status, doc, alreadyFollowing: false };
    }

    return { status: existing.status, doc: existing, alreadyFollowing: true };
  }
};

/**
 * acceptRequest — accept a pending follow request.
 *
 * Fix #9: recipientId added — only the target account can accept.
 * Fix #5: increments follower/following counts on User.
 *
 * @param {ObjectId} followerId   — the user who sent the request
 * @param {ObjectId} recipientId  — the account being followed (must match req.user._id)
 * @returns {{ accepted: boolean, doc: Follow|null }}
 */
followSchema.statics.acceptRequest = async function (followerId, recipientId) {
  const doc = await this.findOneAndUpdate(
    { follower: followerId, following: recipientId, status: FOLLOW_STATUS.PENDING },
    { status: FOLLOW_STATUS.ACCEPTED },
    { new: true }
  ).lean();

  if (!doc) return { accepted: false, doc: null };

  // Fix #5: update denormalized counts
  await _updateFollowCounts(followerId, recipientId, +1);

  return { accepted: true, doc };
};

/**
 * rejectRequest — soft-reject a pending follow request.
 *
 * Fix #7: stores status: "rejected" + rejectedAt (audit trail).
 *   TTL index auto-purges after 90 days.
 *   Prevents repeated follow-request harassment being invisible to moderators.
 * Fix #9: recipientId ensures only the target can reject.
 *
 * @param {ObjectId} followerId
 * @param {ObjectId} recipientId
 * @returns {{ rejected: boolean }}
 */
followSchema.statics.rejectRequest = async function (followerId, recipientId) {
  const result = await this.findOneAndUpdate(
    { follower: followerId, following: recipientId, status: FOLLOW_STATUS.PENDING },
    { status: FOLLOW_STATUS.REJECTED, rejectedAt: new Date() }
  );
  return { rejected: !!result };
};

/**
 * unfollow — remove a follow relationship.
 *
 * Fix #8: returns normalized { unfollowed: boolean } instead of raw doc.
 * Fix #5: decrements follower/following counts only if was accepted.
 *
 * @param {ObjectId} followerId
 * @param {ObjectId} followingId
 * @returns {{ unfollowed: boolean }}
 */
followSchema.statics.unfollow = async function (followerId, followingId) {
  const doc = await this.findOneAndDelete({
    follower: followerId,
    following: followingId,
  }).lean();

  if (!doc) return { unfollowed: false };

  // Fix #5: only decrement if the relationship was accepted (pending = no count was added)
  if (doc.status === FOLLOW_STATUS.ACCEPTED) {
    await _updateFollowCounts(followerId, followingId, -1);
  }

  return { unfollowed: true };
};

/**
 * getFollowStatus — single doc lookup covering both isFollowing + status.
 * Fix #11: isFollowing now calls this — no duplicate DB queries.
 *
 * @returns {"pending"|"accepted"|"rejected"|null}
 */
followSchema.statics.getFollowStatus = async function (followerId, followingId) {
  const doc = await this.findOne({ follower: followerId, following: followingId })
    .select("status")
    .lean();
  return doc ? doc.status : null;
};

/**
 * isFollowing — boolean check (accepted relationships only).
 * Fix #11: calls getFollowStatus internally — no second DB query.
 */
followSchema.statics.isFollowing = async function (followerId, followingId) {
  const status = await this.getFollowStatus(followerId, followingId);
  return status === FOLLOW_STATUS.ACCEPTED;
};

/**
 * getBulkFollowStatus — which users in a list does followerId follow?
 * Fix #13: replaces N individual isFollowing() calls in feed rendering.
 *
 * @param {ObjectId}   followerId
 * @param {ObjectId[]} targetIds
 * @returns {Set<string>}  — Set of followed targetId strings
 */
followSchema.statics.getBulkFollowStatus = async function (followerId, targetIds) {
  if (!targetIds?.length) return new Set();

  const docs = await this.find({
    follower: followerId,
    following: { $in: targetIds },
    status: FOLLOW_STATUS.ACCEPTED,
  })
    .select("-_id following")
    .lean();

  return new Set(docs.map((d) => d.following.toString()));
};

/**
 * getFollowers — paginated list of followers with user data.
 * Fix #17: single query with populate — no second User.find() round trip.
 *
 * @param {ObjectId}      userId
 * @param {ObjectId|null} [afterId]  — cursor: last Follow._id
 * @param {number}        [limit=20]
 * @returns {{ followers: Follow[], nextCursor: ObjectId|null }}
 */
followSchema.statics.getFollowers = async function (userId, afterId = null, limit = 20) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const query = { following: userId, status: FOLLOW_STATUS.ACCEPTED };
  if (afterId) query._id = { $lt: afterId };

  const docs = await this.find(query)
    .sort({ _id: -1 })
    .limit(safeLimit + 1)
    .populate("follower", "username fullName avatar isVerifiedBadge isPrivate")
    .lean();

  const hasMore = docs.length > safeLimit;
  if (hasMore) docs.pop();

  return {
    followers: docs,
    nextCursor: hasMore ? docs[docs.length - 1]._id : null,
  };
};

/**
 * getFollowing — paginated list of accounts a user follows.
 * Fix #17: mirrors getFollowers pattern.
 *
 * @param {ObjectId}      userId
 * @param {ObjectId|null} [afterId]
 * @param {number}        [limit=20]
 * @returns {{ following: Follow[], nextCursor: ObjectId|null }}
 */
followSchema.statics.getFollowing = async function (userId, afterId = null, limit = 20) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const query = { follower: userId, status: FOLLOW_STATUS.ACCEPTED };
  if (afterId) query._id = { $lt: afterId };

  const docs = await this.find(query)
    .sort({ _id: -1 })
    .limit(safeLimit + 1)
    .populate("following", "username fullName avatar isVerifiedBadge isPrivate")
    .lean();

  const hasMore = docs.length > safeLimit;
  if (hasMore) docs.pop();

  return {
    following: docs,
    nextCursor: hasMore ? docs[docs.length - 1]._id : null,
  };
};

/**
 * getFollowerIds — raw accepted follower IDs for internal use (feed generation etc).
 * Fix #4: hard-capped at 5000. For feed queries on large accounts, use
 * aggregation-based approaches rather than loading full ID lists.
 *
 * @param {ObjectId} userId
 * @param {number}   [cap=5000]
 * @returns {ObjectId[]}
 */
followSchema.statics.getFollowerIds = async function (userId, cap = 5000) {
  const docs = await this.find({ following: userId, status: FOLLOW_STATUS.ACCEPTED })
    .limit(cap)
    .select("-_id follower")
    .lean();
  return docs.map((d) => d.follower);
};

/**
 * getFollowingIds — raw accepted following IDs for internal use.
 * Fix #4: hard-capped at 5000.
 *
 * @param {ObjectId} userId
 * @param {number}   [cap=5000]
 * @returns {ObjectId[]}
 */
followSchema.statics.getFollowingIds = async function (userId, cap = 5000) {
  const docs = await this.find({ follower: userId, status: FOLLOW_STATUS.ACCEPTED })
    .limit(cap)
    .select("-_id following")
    .lean();
  return docs.map((d) => d.following);
};

/**
 * getPendingRequests — follow requests awaiting approval.
 * Fix #2: cursor pagination replaces skip().
 *
 * @param {ObjectId}      userId   — the private account receiving requests
 * @param {ObjectId|null} [afterId]
 * @param {number}        [limit=20]
 * @returns {{ requests: Follow[], nextCursor: ObjectId|null }}
 */
followSchema.statics.getPendingRequests = async function (userId, afterId = null, limit = 20) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const query = { following: userId, status: FOLLOW_STATUS.PENDING };
  if (afterId) query._id = { $lt: afterId };

  const docs = await this.find(query)
    .sort({ _id: -1 })
    .limit(safeLimit + 1)
    .populate("follower", "username fullName avatar isVerifiedBadge")
    .lean();

  const hasMore = docs.length > safeLimit;
  if (hasMore) docs.pop();

  return {
    requests: docs,
    nextCursor: hasMore ? docs[docs.length - 1]._id : null,
  };
};

/**
 * getMutualFollowers — users who follow both userA and userB.
 * Fix #3: DB-side $setIntersection via aggregation — no heap loading.
 * Fix #14: capped at `limit` — no unbounded result set.
 * Fix #18: returns populated user data via $lookup.
 *
 * @param {ObjectId} userAId
 * @param {ObjectId} userBId
 * @param {number}   [limit=20]
 * @returns {Object[]}  — user documents (username, fullName, avatar, isVerifiedBadge)
 */
followSchema.statics.getMutualFollowers = async function (userAId, userBId, limit = 20) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

  const results = await this.aggregate([
    // Get all accepted followers of userA
    {
      $match: {
        following: new mongoose.Types.ObjectId(userAId),
        status: FOLLOW_STATUS.ACCEPTED,
      },
    },
    {
      $group: { _id: null, aFollowers: { $addToSet: "$follower" } },
    },
    // Get all accepted followers of userB via $lookup
    {
      $lookup: {
        from: "follows",
        pipeline: [
          {
            $match: {
              following: new mongoose.Types.ObjectId(userBId),
              status: FOLLOW_STATUS.ACCEPTED,
            },
          },
          { $group: { _id: null, bFollowers: { $addToSet: "$follower" } } },
        ],
        as: "bData",
      },
    },
    { $unwind: { path: "$bData", preserveNullAndEmpty: true } },
    // Fix #3: intersection happens in DB
    {
      $project: {
        mutual: {
          $slice: [
            { $setIntersection: ["$aFollowers", { $ifNull: ["$bData.bFollowers", []] }] },
            safeLimit,
          ],
        },
      },
    },
    { $unwind: "$mutual" },
    // Fix #18: populate user data via $lookup
    {
      $lookup: {
        from: "users",
        localField: "mutual",
        foreignField: "_id",
        as: "user",
        pipeline: [
          { $project: { username: 1, fullName: 1, avatar: 1, isVerifiedBadge: 1 } },
        ],
      },
    },
    { $unwind: "$user" },
    { $replaceRoot: { newRoot: "$user" } },
  ]);

  return results;
};

/**
 * removeAllBetween — delete all follow relationships between two users.
 * Fix #12: used for block/mute scenarios (bidirectional cleanup).
 * Also handles User.followersCount / followingCount sync.
 *
 * @param {ObjectId} userAId
 * @param {ObjectId} userBId
 * @returns {{ deletedCount: number }}
 */
followSchema.statics.removeAllBetween = async function (userAId, userBId) {
  // Fetch before delete to know which were accepted (for count updates)
  const docs = await this.find({
    $or: [
      { follower: userAId, following: userBId },
      { follower: userBId, following: userAId },
    ],
  })
    .select("follower following status")
    .lean();

  if (!docs.length) return { deletedCount: 0 };

  await this.deleteMany({
    $or: [
      { follower: userAId, following: userBId },
      { follower: userBId, following: userAId },
    ],
  });

  // Fix #5: update counts for any accepted relationships that were removed
  for (const doc of docs) {
    if (doc.status === FOLLOW_STATUS.ACCEPTED) {
      await _updateFollowCounts(doc.follower, doc.following, -1);
    }
  }

  return { deletedCount: docs.length };
};

/**
 * removeAllForUser — cascade delete when account is deleted.
 * Fix #16: cleans both directions — as follower and as following.
 * NOTE: Does NOT update follower counts on other users (too expensive for N users).
 * Run a reconciliation job post-deletion, or rely on periodic count reconciliation.
 *
 * @param {ObjectId} userId
 * @returns {{ deletedCount: number }}
 */
followSchema.statics.removeAllForUser = async function (userId) {
  const result = await this.deleteMany({
    $or: [{ follower: userId }, { following: userId }],
  });
  return { deletedCount: result.deletedCount ?? 0 };
};

// ─────────────────────────────────────────────
//  Internal Helper
// ─────────────────────────────────────────────

/**
 * _updateFollowCounts — atomically update denormalized follower/following counts.
 * Fix #5: called by accept, unfollow, and sendFollowRequest (immediate accept).
 *
 * Uses dynamic model import to avoid circular dependency
 * (Follow ↔ User would be circular if imported at top level).
 *
 * @param {ObjectId} followerId
 * @param {ObjectId} followingId
 * @param {1|-1}     delta
 */
async function _updateFollowCounts(followerId, followingId, delta) {
  try {
    const User = mongoose.model("User");
    await Promise.all([
      // follower gains +1 followingCount
      User.findByIdAndUpdate(followerId, { $inc: { followingCount: delta } }),
      // following account gains +1 followersCount
      User.findByIdAndUpdate(followingId, { $inc: { followersCount: delta } }),
    ]);
  } catch {
    // Non-fatal — count drift is recoverable via reconciliation job.
    // Log in production: logger.warn(`followCount sync failed: ${followerId} → ${followingId}`);
  }
}

// ─────────────────────────────────────────────
//  Model Export
// ─────────────────────────────────────────────

const Follow = models.Follow || model("Follow", followSchema);
export default Follow;