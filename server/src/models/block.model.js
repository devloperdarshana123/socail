

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Block Schema
//
//  When A blocks B:
//    - B cannot see A's posts / stories / profile
//    - B cannot follow A
//    - Any existing follow between A ↔ B is removed  (service layer)
//    - DMs between A and B are disabled              (service layer)
//    - Block relationship is ONE-WAY in this document:
//        blocker = A  (the user who initiated the block)
//        blocked = B  (the user who was blocked)
//      To check either direction use isBlockedEither() or getBulkBlockStatus().
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
    timestamps: true, // createdAt = timestamp of the block action
  },
);

// ─────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────

// Primary constraint: one block record per (blocker, blocked) pair
blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

// getBlockList — blocker's list sorted newest-first
// FIX #10 — explicitly documented: this index serves getBlockList's
// { blocker } + sort(createdAt) query. The unique index above covers
// isBlocked's exact { blocker, blocked } lookup; this one covers the range scan.
blockSchema.index({ blocker: 1, createdAt: -1 });

// getBlockerIds / getBulkBlockStatus — lookup by blocked user
// FIX #7 — internal/admin use only; see getBlockerIds JSDoc
blockSchema.index({ blocked: 1 });

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * FIX #4 — Check if blockerId has blocked blockedId.
 * Uses minimal projection + lean — no document hydration for an existence check.
 *
 * @param {ObjectId} blockerId
 * @param {ObjectId} blockedId
 * @returns {Promise<boolean>}
 */
blockSchema.statics.isBlocked = async function (blockerId, blockedId) {
  const doc = await this.findOne(
    { blocker: blockerId, blocked: blockedId },
    { _id: 1 },   // minimal projection
  ).lean();
  return doc !== null;
};

/**
 * FIX #15 — Explicit inverse: has blockedId blocked blockerId?
 * Named helper prevents argument-order bugs in controllers.
 *
 * @param {ObjectId} blockerId   — the user asking "was I blocked?"
 * @param {ObjectId} blockedId   — the user who may have blocked them
 * @returns {Promise<boolean>}
 */
blockSchema.statics.isBlockedByUser = async function (blockerId, blockedId) {
  // Semantics: "has blockedId blocked blockerId?"
  return this.isBlocked(blockedId, blockerId);
};

/**
 * FIX #4 #11 — Check block in either direction (A→B or B→A).
 * Uses minimal projection + lean.
 * Called in content-visibility middleware — keep it as lean as possible.
 * For bulk checks across many users, use getBulkBlockStatus() instead.
 *
 * @param {ObjectId} userAId
 * @param {ObjectId} userBId
 * @returns {Promise<boolean>}
 */
blockSchema.statics.isBlockedEither = async function (userAId, userBId) {
  const doc = await this.findOne(
    {
      $or: [
        { blocker: userAId, blocked: userBId },
        { blocker: userBId, blocked: userAId },
      ],
    },
    { _id: 1 },
  ).lean();
  return doc !== null;
};

/**
 * FIX #3 — Get blocked user IDs for a user, with a hard cap.
 * Use sparingly — for feed filtering, getBulkBlockStatus() is more efficient.
 * For accounts with thousands of blocks, paginate with getBlockList() instead.
 *
 * @param {ObjectId} userId
 * @param {number}   [limit=1000]  — safety cap; raise carefully
 * @returns {Promise<ObjectId[]>}
 */
blockSchema.statics.getBlockedIds = async function (userId, limit = 1000) {
  const docs = await this.find({ blocker: userId })
    .select("-_id blocked")
    .limit(limit)
    .lean();
  return docs.map((d) => d.blocked);
};

/**
 * FIX #3 FIX #7 — Get IDs of users who have blocked a specific user.
 *
 * ⚠️  INTERNAL / ADMIN USE ONLY.
 * This exposes who has blocked a given user — on most platforms
 * (Instagram, X/Twitter) this relationship is intentionally hidden from
 * the blocked party. Do NOT expose this through a public API endpoint.
 *
 * @param {ObjectId} userId
 * @param {number}   [limit=1000]
 * @returns {Promise<ObjectId[]>}
 */
blockSchema.statics.getBlockerIds = async function (userId, limit = 1000) {
  const docs = await this.find({ blocked: userId })
    .select("-_id blocker")
    .limit(limit)
    .lean();
  return docs.map((d) => d.blocker);
};

/**
 * FIX #8 — Bulk block-status check for feed rendering.
 * Given the current user and a list of other user IDs, returns a Set of
 * IDs that have ANY block relationship (in either direction) with the viewer.
 *
 * Usage in feed middleware:
 *   const blocked = await Block.getBulkBlockStatus(viewerId, authorIds);
 *   const visible = posts.filter(p => !blocked.has(p.author._id.toString()));
 *
 * @param {ObjectId}   viewerId    — the currently authenticated user
 * @param {ObjectId[]} userIds     — list of other user IDs to check against
 * @returns {Promise<Set<string>>} — Set of userId strings with a block relationship
 */
blockSchema.statics.getBulkBlockStatus = async function (viewerId, userIds) {
  if (!userIds.length) return new Set();

  const docs = await this.find(
    {
      $or: [
        { blocker: viewerId, blocked: { $in: userIds } },
        { blocker: { $in: userIds }, blocked: viewerId },
      ],
    },
    { blocker: 1, blocked: 1, _id: 0 },
  ).lean();

  const viewerStr = viewerId.toString();
  const result = new Set();

  for (const doc of docs) {
    const b = doc.blocker.toString();
    const d = doc.blocked.toString();
    // Add whichever side is NOT the viewer
    result.add(b === viewerStr ? d : b);
  }

  return result;
};

/**
 * FIX #2 #5 #13 — Atomically block a user.
 *
 * Uses $setOnInsert so a re-block (record already exists) is fully idempotent:
 *   - createdAt is NOT reset
 *   - Returns the existing record unchanged
 *
 * E11000 (concurrent double-block race) is caught and resolved gracefully.
 *
 * @param {ObjectId} blockerId
 * @param {ObjectId} blockedId
 * @returns {Promise<{ block: object, created: boolean }>}
 */
blockSchema.statics.blockUser = async function (blockerId, blockedId) {
  if (blockerId.toString() === blockedId.toString()) {
    throw new Error("Cannot block yourself");
  }

  try {
    const block = await this.findOneAndUpdate(
      { blocker: blockerId, blocked: blockedId },
      {
        // FIX #2 — $setOnInsert: only written on INSERT, not on update.
        // This preserves the original createdAt on re-block.
        $setOnInsert: {
          blocker: blockerId,
          blocked: blockedId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    return { block, created: true };
  } catch (err) {
    // FIX #5 — concurrent double-block: unique index fires E11000
    if (err.code === 11000) {
      const existing = await this.findOne(
        { blocker: blockerId, blocked: blockedId },
        { _id: 1, createdAt: 1 },
      ).lean();
      return { block: existing, created: false };
    }
    throw err;
  }
};

/**
 * FIX #6 — Unblock a user.
 * Returns { unblocked: boolean } — not the raw deleted document.
 *
 * @param {ObjectId} blockerId
 * @param {ObjectId} blockedId
 * @returns {Promise<{ unblocked: boolean }>}
 */
blockSchema.statics.unblockUser = async function (blockerId, blockedId) {
  const result = await this.deleteOne({ blocker: blockerId, blocked: blockedId });
  return { unblocked: result.deletedCount === 1 };
};

/**
 * FIX #1 #9 — Cursor-paginated block list with user details.
 *
 * @param {ObjectId}  userId
 * @param {object}    opts
 * @param {string}    [opts.afterId]    — _id of last record on previous page
 * @param {Date}      [opts.afterDate]  — createdAt of that record
 * @param {number}    [opts.limit=20]
 * @returns {Promise<{ blocks: object[], nextCursor: object|null }>}
 */
blockSchema.statics.getBlockList = async function (
  userId,
  { afterId = null, afterDate = null, limit = 20 } = {},
) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50);

  const cursorFilter =
    afterId && afterDate
      ? {
          $or: [
            { createdAt: { $lt: new Date(afterDate) } },
            { createdAt: new Date(afterDate), _id: { $lt: afterId } },
          ],
        }
      : {};

  const blocks = await this.find({ blocker: userId, ...cursorFilter })
    .sort({ createdAt: -1, _id: -1 })
    .limit(safeLimit + 1)
    .select("blocked createdAt")
    .populate("blocked", "username fullName avatar isVerifiedBadge")
    .lean();

  const hasMore = blocks.length > safeLimit;
  if (hasMore) blocks.pop();

  const last = blocks[blocks.length - 1];
  const nextCursor = hasMore
    ? { afterId: last._id, afterDate: last.createdAt }
    : null;

  return { blocks, nextCursor };
};

/**
 * FIX #14 — Count of blocked users (for profile settings badge).
 *
 * @param {ObjectId} userId
 * @returns {Promise<number>}
 */
blockSchema.statics.getBlockCount = function (userId) {
  return this.countDocuments({ blocker: userId });
};

/**
 * FIX #12 — Delete all Block records for a user on account deletion.
 * Removes both directions: records where user is blocker OR blocked.
 *
 * @param {ObjectId} userId
 * @returns {Promise<{ deletedCount: number }>}
 */
blockSchema.statics.deleteAllForUser = async function (userId) {
  const result = await this.deleteMany({
    $or: [{ blocker: userId }, { blocked: userId }],
  });
  return { deletedCount: result.deletedCount };
};

// ─────────────────────────────────────────────
const Block = models.Block || model("Block", blockSchema);
export default Block;