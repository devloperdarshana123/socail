import { followRepository, userRepository } from "../config/repositories.js";

// Persistence for the follow domain now flows through the repository layer
// (Phase 7A) instead of the Prisma client directly. Database/behavior are
// unchanged — every query below is the same shape as the prisma.* call it
// replaces; only the access path moved.
//
// NOTE on atomicity: this helper has NO transactions, and did not have any
// before the migration either. The follow-row write and the two denormalized
// counter updates are separate statements (the counter pair runs under a
// Promise.all), so a crash between them can leave counters drifted. That is
// pre-existing behavior and is deliberately preserved unchanged here — see
// the follow characterization suite.

// ── Follow-target summary (fields the follow controller needs to decide
//    whether a follow is allowed and public-vs-private). Extracted verbatim
//    from follow.controller.js so the controller no longer touches Prisma
//    directly — Milestone 5 helpers-as-boundary. Query is byte-identical to
//    the one it replaces; returns null for a non-existent user, exactly as
//    Prisma's findUnique does. ────────────────────────────────────────────
export const getFollowTargetSummary = async (userId) => {
  return userRepository.findById(userId, {
    select: { accountStatus: true, isPrivate: true, username: true },
  });
};

// ── Send follow request (auto-accept if public account) ──────────────────
export const sendFollowRequest = async (followerId, followingId, isPrivate) => {
  const existing = await followRepository.findByFollowerAndFollowing(followerId, followingId);

  if (existing) {
    if (existing.status === "accepted" || existing.status === "pending") {
      return { status: existing.status, alreadyFollowing: true };
    }
    // rejected before — allow re-request
    const status = isPrivate ? "pending" : "accepted";
    await followRepository.update(existing.id, { status, rejectedAt: null });
    if (status === "accepted") {
      await Promise.all([
        userRepository.update(followerId, { followingCount: { inc: 1 } }),
        userRepository.update(followingId, { followersCount: { inc: 1 } }),
      ]);
    }
    return { status, alreadyFollowing: false };
  }

  const status = isPrivate ? "pending" : "accepted";

  await followRepository.create({ followerId, followingId, status });

  if (status === "accepted") {
    await Promise.all([
      userRepository.update(followerId, { followingCount: { inc: 1 } }),
      userRepository.update(followingId, { followersCount: { inc: 1 } }),
    ]);
  }

  return { status, alreadyFollowing: false };
};

// ── Unfollow / cancel pending request ──────────────────────────────────────
export const unfollow = async (followerId, followingId) => {
  const existing = await followRepository.findByFollowerAndFollowing(followerId, followingId);

  if (!existing) return { unfollowed: false };

  await followRepository.delete(existing.id);

  if (existing.status === "accepted") {
    await Promise.all([
      userRepository.update(followerId, { followingCount: { dec: 1 } }),
      userRepository.update(followingId, { followersCount: { dec: 1 } }),
    ]);
  }

  return { unfollowed: true };
};

// ── Accept follow request ───────────────────────────────────────────────
export const acceptRequest = async (followerId, recipientId) => {
  const existing = await followRepository.findByFollowerAndFollowing(followerId, recipientId);

  if (!existing || existing.status !== "pending") return { accepted: false };

  await followRepository.update(existing.id, { status: "accepted" });

  await Promise.all([
    userRepository.update(followerId, { followingCount: { inc: 1 } }),
    userRepository.update(recipientId, { followersCount: { inc: 1 } }),
  ]);

  return { accepted: true };
};

// ── Reject follow request (soft) ────────────────────────────────────────
export const rejectRequest = async (followerId, recipientId) => {
  const existing = await followRepository.findByFollowerAndFollowing(followerId, recipientId);

  if (!existing || existing.status !== "pending") return { rejected: false };

  await followRepository.update(existing.id, {
    status: "rejected",
    rejectedAt: new Date(),
  });

  return { rejected: true };
};

// ── Pending follow requests (cursor-based) ────────────────────────────────
export const getPendingRequests = async (userId, afterId, limit) => {
  const rows = await followRepository.findFollowersWithProfile(userId, {
    status: "pending",
    afterId,
    limit,
  });

  const hasMore = rows.length > limit;
  const finalRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? finalRows[finalRows.length - 1].id : null;

  return { requests: finalRows.map((r) => r.follower), nextCursor };
};

// ── Followers list (cursor-based) ─────────────────────────────────────────
export const getFollowers = async (userId, afterId, limit) => {
  const rows = await followRepository.findFollowersWithProfile(userId, {
    status: "accepted",
    afterId,
    limit,
  });

  const hasMore = rows.length > limit;
  const finalRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? finalRows[finalRows.length - 1].id : null;

  return { followers: finalRows, nextCursor };
};

// ── Following list (cursor-based) ─────────────────────────────────────────
export const getFollowing = async (userId, afterId, limit) => {
  const rows = await followRepository.findFollowingWithProfile(userId, {
    status: "accepted",
    afterId,
    limit,
  });

  const hasMore = rows.length > limit;
  const finalRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? finalRows[finalRows.length - 1].id : null;

  return { following: finalRows, nextCursor };
};

// ── Follow status between two users ───────────────────────────────────────
export const getFollowStatus = async (followerId, followingId) => {
  const row = await followRepository.findByFollowerAndFollowing(followerId, followingId, {
    select: { status: true },
  });
  return row?.status ?? null;
};

// ── Mutual followers ───────────────────────────────────────────────────────
export const getMutualFollowers = async (userAId, userBId, limit) => {
  // Step 1: get userA's followers list (accepted)
  const aFollowers = await followRepository.findAllFollowerIds(userAId, { status: "accepted" });
  const aFollowerIds = aFollowers.map((f) => f.followerId);

  if (aFollowerIds.length === 0) return [];

  // Step 2: of those, who also follows userB
  const mutuals = await followRepository.findFollowersAmongWithProfile(userBId, aFollowerIds, {
    status: "accepted",
    limit,
  });

  return mutuals.map((m) => m.follower);
};

// ── Remove all follow relations between two users (for blocking) ──────────
export const removeAllBetween = async (userAId, userBId) => {
  const rows = await followRepository.findAllBetween(userAId, userBId);

  for (const row of rows) {
    await followRepository.delete(row.id);
    if (row.status === "accepted") {
      await Promise.all([
        userRepository.update(row.followerId, { followingCount: { dec: 1 } }),
        userRepository.update(row.followingId, { followersCount: { dec: 1 } }),
      ]);
    }
  }

  return { removed: rows.length };
};
