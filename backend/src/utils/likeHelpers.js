import { transactionRunner } from "../config/transaction.js";
import { likeRepository, socialPostRepository, commentRepository } from "../config/repositories.js";

// Persistence for the like domain now flows through the repository layer
// (Phase 7A) instead of the Prisma client directly. Database/behavior are
// unchanged — every query below is the same shape as the prisma.* call it
// replaces; only the access path moved.

const VALID_REACTIONS = ["❤️", "🔥", "😮", "😂", "😢", "👏"];

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ── Toggle like/reaction ────────────────────────────────────────────────
export const toggleLike = async (userId, targetId, targetType, reaction = "❤️", options = {}) => {
  const { updateParentCount = false, authorId = null } = options;

  if (!VALID_REACTIONS.includes(reaction)) {
    throw new Error("Invalid reaction type");
  }

  let liked = false;
  let previousReaction = null;

  await transactionRunner.run(async (tx) => {
    // Check if already liked
    const existing = await likeRepository.findByUserAndTarget(userId, targetType, targetId, { tx });

    if (existing) {
      if (existing.reaction === reaction) {
        // Same reaction — unlike
        await likeRepository.delete(existing.id, { tx });
        liked = false;
        previousReaction = reaction;

        if (updateParentCount) {
          if (targetType === "Post") {
            await socialPostRepository.update(targetId, { likesCount: { dec: 1 } }, { tx });
          } else if (targetType === "Comment") {
            await commentRepository.update(targetId, { likesCount: { dec: 1 } }, { tx });
          }
        }
      } else {
        // Different reaction — update
        previousReaction = existing.reaction;
        await likeRepository.update(existing.id, { reaction }, { tx });
        liked = true;
      }
    } else {
      // New like
      try {
        await likeRepository.create(
          {
            likedById: userId,
            reaction,
            targetModel: targetType,
            ...(targetType === "Post" ? { postId: targetId } : {}),
            ...(targetType === "Comment" ? { commentId: targetId } : {}),
          },
          { tx }
        );
      } catch (err) {
        if (err.code === "P2002") {
          // Duplicate like — someone else's request won the race, treat as already liked
          liked = true;
          return;
        }
        throw err;
      }
      liked = true;

      if (updateParentCount) {
        if (targetType === "Post") {
          await socialPostRepository.update(targetId, { likesCount: { inc: 1 } }, { tx });
        } else if (targetType === "Comment") {
          await commentRepository.update(targetId, { likesCount: { inc: 1 } }, { tx });
        }
      }
    }
  });

  return { liked, previousReaction };
};

// ── Like-target lookups (extracted verbatim from like.controller.js so the
//    controller no longer touches Prisma directly — Milestone 5
//    helpers-as-boundary. Each query is byte-identical to the one it
//    replaces; returns null for a missing row, as findUnique does. ────────
export const getPostForLike = async (postId) => {
  return socialPostRepository.findById(postId, {
    includeDeleted: true,
    select: { id: true, authorId: true, likesCount: true, likesHidden: true, isDeleted: true },
  });
};

export const getPostLikesCount = async (postId) => {
  return socialPostRepository.findById(postId, {
    includeDeleted: true,
    select: { likesCount: true },
  });
};

export const getCommentForLike = async (commentId) => {
  return commentRepository.findById(commentId, {
    select: { id: true, authorId: true, likesCount: true, isDeleted: true },
  });
};

export const getCommentLikesCount = async (commentId) => {
  return commentRepository.findById(commentId, {
    select: { likesCount: true },
  });
};

// ── Get like status ─────────────────────────────────────────────────────
export const getLikeStatus = async (userId, targetId, targetType) => {
  return likeRepository.findByUserAndTarget(userId, targetType, targetId, {
    select: { id: true, reaction: true },
  });
};

// ── Get likers list (cursor-paginated) ──────────────────────────────────
export const getLikers = async (targetId, targetType, afterId = null, limit = 20) => {
  const likes = await likeRepository.findLikersWithUser(targetType, targetId, { afterId, limit });

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

  const likes = await likeRepository.groupByReaction(where);

  const breakdown = {};
  VALID_REACTIONS.forEach((emoji) => {
    breakdown[emoji] = 0;
  });

  likes.forEach((item) => {
    breakdown[item.key] = item.count;
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
  const deleted = await likeRepository.deleteByUserAndTarget(userId, targetType, targetId);

  return deleted.count > 0;
};
