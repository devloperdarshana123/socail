import prisma from "../config/prisma.js";

const VALID_REACTIONS = ["❤️", "🔥", "😮", "😂", "😢", "👏"];

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ── Toggle like/reaction ────────────────────────────────────────────────
export const toggleLike = async (userId, targetId, targetType, reaction = "❤️", options = {}) => {
  const { updateParentCount = false, authorId = null } = options;

  if (!VALID_REACTIONS.includes(reaction)) {
    throw new Error("Invalid reaction type");
  }

  // Check if already liked
  const existing = await prisma.like.findFirst({
    where: {
      likedById: userId,
      ...(targetType === "Post" ? { postId: targetId } : {}),
      ...(targetType === "Comment" ? { commentId: targetId } : {}),
    },
  });

  let liked = false;
  let previousReaction = null;

  if (existing) {
    if (existing.reaction === reaction) {
      // Same reaction — unlike
      await prisma.like.delete({ where: { id: existing.id } });
      liked = false;
      previousReaction = reaction;

      if (updateParentCount) {
        if (targetType === "Post") {
          await prisma.post.update({
            where: { id: targetId },
            data: { likesCount: { decrement: 1 } },
          });
        } else if (targetType === "Comment") {
          await prisma.comment.update({
            where: { id: targetId },
            data: { likesCount: { decrement: 1 } },
          });
        }
      }
    } else {
      // Different reaction — update
      previousReaction = existing.reaction;
      await prisma.like.update({
        where: { id: existing.id },
        data: { reaction },
      });
      liked = true;
    }
  } else {
    // New like
    await prisma.like.create({
      data: {
        likedById: userId,
        reaction,
        targetModel: targetType,
        ...(targetType === "Post" ? { postId: targetId } : {}),
        ...(targetType === "Comment" ? { commentId: targetId } : {}),
      },
    });
    liked = true;

    if (updateParentCount) {
      if (targetType === "Post") {
        await prisma.post.update({
          where: { id: targetId },
          data: { likesCount: { increment: 1 } },
        });
      } else if (targetType === "Comment") {
        await prisma.comment.update({
          where: { id: targetId },
          data: { likesCount: { increment: 1 } },
        });
      }
    }
  }

  return { liked, previousReaction };
};

// ── Get like status ─────────────────────────────────────────────────────
export const getLikeStatus = async (userId, targetId, targetType) => {
  return prisma.like.findFirst({
    where: {
      likedById: userId,
      ...(targetType === "Post" ? { postId: targetId } : {}),
      ...(targetType === "Comment" ? { commentId: targetId } : {}),
    },
    select: { id: true, reaction: true },
  });
};

// ── Get likers list (cursor-paginated) ──────────────────────────────────
export const getLikers = async (targetId, targetType, afterId = null, limit = 20) => {
  const where = {
    ...(targetType === "Post" ? { postId: targetId } : {}),
    ...(targetType === "Comment" ? { commentId: targetId } : {}),
  };

  if (afterId) {
    where.id = { lt: afterId };
  }

  const likes = await prisma.like.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: {
      id: true,
      reaction: true,
      likedBy: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          isVerifiedBadge: true,
        },
      },
    },
  });

  const hasMore = likes.length > limit;
  const items = hasMore ? likes.slice(0, limit) : likes;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return {
    likers: items.map((like) => ({
      ...like.likedBy,
      reaction: like.reaction,
    })),
    nextCursor,
  };
};

// ── Get reaction breakdown ──────────────────────────────────────────────
export const getReactionBreakdown = async (targetId, targetType) => {
  const where = {
    ...(targetType === "Post" ? { postId: targetId } : {}),
    ...(targetType === "Comment" ? { commentId: targetId } : {}),
  };

  const likes = await prisma.like.groupBy({
    by: ["reaction"],
    where,
    _count: { reaction: true },
  });

  const breakdown = {};
  VALID_REACTIONS.forEach((emoji) => {
    breakdown[emoji] = 0;
  });

  likes.forEach((item) => {
    breakdown[item.reaction] = item._count.reaction;
  });

  return breakdown;
};

// ── Check if user liked ─────────────────────────────────────────────────
export const hasLiked = async (userId, targetId, targetType) => {
  const like = await getLikeStatus(userId, targetId, targetType);
  return !!like;
};

// ── Delete like ─────────────────────────────────────────────────────────
export const deleteLike = async (userId, targetId, targetType) => {
  const deleted = await prisma.like.deleteMany({
    where: {
      likedById: userId,
      ...(targetType === "Post" ? { postId: targetId } : {}),
      ...(targetType === "Comment" ? { commentId: targetId } : {}),
    },
  });

  return deleted.count > 0;
};