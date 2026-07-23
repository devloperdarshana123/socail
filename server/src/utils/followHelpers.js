import prisma from "../config/prisma.js";

// ── Send follow request (auto-accept if public account) ──────────────────
export const sendFollowRequest = async (followerId, followingId, isPrivate) => {
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });

  if (existing) {
    if (existing.status === "accepted" || existing.status === "pending") {
      return { status: existing.status, alreadyFollowing: true };
    }
    // rejected before — allow re-request
    const status = isPrivate ? "pending" : "accepted";
    await prisma.follow.update({
      where: { id: existing.id },
      data: { status, rejectedAt: null },
    });
    if (status === "accepted") {
      await Promise.all([
        prisma.user.update({ where: { id: followerId }, data: { followingCount: { increment: 1 } } }),
        prisma.user.update({ where: { id: followingId }, data: { followersCount: { increment: 1 } } }),
      ]);
    }
    return { status, alreadyFollowing: false };
  }

  const status = isPrivate ? "pending" : "accepted";

  await prisma.follow.create({ data: { followerId, followingId, status } });

  if (status === "accepted") {
    await Promise.all([
      prisma.user.update({ where: { id: followerId }, data: { followingCount: { increment: 1 } } }),
      prisma.user.update({ where: { id: followingId }, data: { followersCount: { increment: 1 } } }),
    ]);
  }

  return { status, alreadyFollowing: false };
};

// ── Unfollow / cancel pending request ──────────────────────────────────────
export const unfollow = async (followerId, followingId) => {
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });

  if (!existing) return { unfollowed: false };

  await prisma.follow.delete({ where: { id: existing.id } });

  if (existing.status === "accepted") {
    await Promise.all([
      prisma.user.update({ where: { id: followerId }, data: { followingCount: { decrement: 1 } } }),
      prisma.user.update({ where: { id: followingId }, data: { followersCount: { decrement: 1 } } }),
    ]);
  }

  return { unfollowed: true };
};

// ── Accept follow request ───────────────────────────────────────────────
export const acceptRequest = async (followerId, recipientId) => {
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId: recipientId } },
  });

  if (!existing || existing.status !== "pending") return { accepted: false };

  await prisma.follow.update({ where: { id: existing.id }, data: { status: "accepted" } });

  await Promise.all([
    prisma.user.update({ where: { id: followerId }, data: { followingCount: { increment: 1 } } }),
    prisma.user.update({ where: { id: recipientId }, data: { followersCount: { increment: 1 } } }),
  ]);

  return { accepted: true };
};

// ── Reject follow request (soft) ────────────────────────────────────────
export const rejectRequest = async (followerId, recipientId) => {
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId: recipientId } },
  });

  if (!existing || existing.status !== "pending") return { rejected: false };

  await prisma.follow.update({
    where: { id: existing.id },
    data: { status: "rejected", rejectedAt: new Date() },
  });

  return { rejected: true };
};

// ── Pending follow requests (cursor-based) ────────────────────────────────
export const getPendingRequests = async (userId, afterId, limit) => {
  const rows = await prisma.follow.findMany({
    where: { followingId: userId, status: "pending" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(afterId && { cursor: { id: afterId }, skip: 1 }),
    include: {
      follower: {
        select: { id: true, username: true, fullName: true, avatar: true, isVerifiedBadge: true },
      },
    },
  });

  const hasMore = rows.length > limit;
  const finalRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? finalRows[finalRows.length - 1].id : null;

  return { requests: finalRows.map((r) => r.follower), nextCursor };
};

// ── Followers list (cursor-based) ─────────────────────────────────────────
export const getFollowers = async (userId, afterId, limit) => {
  const rows = await prisma.follow.findMany({
    where: { followingId: userId, status: "accepted" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(afterId && { cursor: { id: afterId }, skip: 1 }),
    include: {
      follower: {
        select: { id: true, username: true, fullName: true, avatar: true, isVerifiedBadge: true },
      },
    },
  });

  const hasMore = rows.length > limit;
  const finalRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? finalRows[finalRows.length - 1].id : null;

  return { followers: finalRows, nextCursor };
};

// ── Following list (cursor-based) ─────────────────────────────────────────
export const getFollowing = async (userId, afterId, limit) => {
  const rows = await prisma.follow.findMany({
    where: { followerId: userId, status: "accepted" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(afterId && { cursor: { id: afterId }, skip: 1 }),
    include: {
      following: {
        select: { id: true, username: true, fullName: true, avatar: true, isVerifiedBadge: true },
      },
    },
  });

  const hasMore = rows.length > limit;
  const finalRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? finalRows[finalRows.length - 1].id : null;

  return { following: finalRows, nextCursor };
};

// ── Follow status between two users ───────────────────────────────────────
export const getFollowStatus = async (followerId, followingId) => {
  const row = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
    select: { status: true },
  });
  return row?.status ?? null;
};

// ── Mutual followers ───────────────────────────────────────────────────────
export const getMutualFollowers = async (userAId, userBId, limit) => {
  // Step 1: get userA's followers list (accepted)
  const aFollowers = await prisma.follow.findMany({
    where: { followingId: userAId, status: "accepted" },
    select: { followerId: true },
  });
  const aFollowerIds = aFollowers.map((f) => f.followerId);

  if (aFollowerIds.length === 0) return [];

  // Step 2: of those, who also follows userB
  const mutuals = await prisma.follow.findMany({
    where: {
      followingId: userBId,
      status: "accepted",
      followerId: { in: aFollowerIds },
    },
    take: limit,
    include: {
      follower: {
        select: { id: true, username: true, fullName: true, avatar: true, isVerifiedBadge: true },
      },
    },
  });

  return mutuals.map((m) => m.follower);
};

// ── Remove all follow relations between two users (for blocking) ──────────
export const removeAllBetween = async (userAId, userBId) => {
  const rows = await prisma.follow.findMany({
    where: {
      OR: [
        { followerId: userAId, followingId: userBId },
        { followerId: userBId, followingId: userAId },
      ],
    },
  });

  for (const row of rows) {
    await prisma.follow.delete({ where: { id: row.id } });
    if (row.status === "accepted") {
      await Promise.all([
        prisma.user.update({ where: { id: row.followerId }, data: { followingCount: { decrement: 1 } } }),
        prisma.user.update({ where: { id: row.followingId }, data: { followersCount: { decrement: 1 } } }),
      ]);
    }
  }

  return { removed: rows.length };
};