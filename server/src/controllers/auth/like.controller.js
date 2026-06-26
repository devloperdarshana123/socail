

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import logger from "../../config/logger.js";
import { notifyChat } from "../../helper/notifyChat.js";
import * as LikeHelper from "../../utils/likeHelpers.js";
import prisma from "../../config/prisma.js";

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const VALID_REACTIONS = ["❤️", "🔥", "😮", "😂", "😢", "👏"];

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v2/likes/post/:postId
//  Toggle like / reaction on a post
// ─────────────────────────────────────────────────────────────────────────────

export const togglePostLike = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const userId = req.user.id;
  const { reaction = "❤️" } = req.body || {};

  if (!isValidUUID(postId)) {
    return next(new AppError("Invalid post ID.", 400));
  }

  if (!VALID_REACTIONS.includes(reaction)) {
    return next(new AppError("Invalid reaction type.", 400));
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, likesCount: true, likesHidden: true, isDeleted: true },
  });

  if (!post || post.isDeleted) {
    return next(new AppError("Post not found", 404));
  }

  const { liked, previousReaction } = await LikeHelper.toggleLike(
    userId,
    postId,
    "Post",
    reaction,
    { updateParentCount: true, authorId: post.authorId }
  );

  logger.info("Post like toggled", {
    userId,
    postId,
    liked,
    reaction,
    previousReaction: previousReaction || null,
  });

  // Fire-and-forget notification — only on like, not unlike, not own post
  if (liked && post.authorId !== userId) {
    notifyChat("/notify/like", {
      to: post.authorId,
      from: userId,
      sender: {
        fullName: req.user.fullName || req.user.username || "",
        username: req.user.username || "",
        avatar: req.user.avatar?.url || null,
      },
      type: "like",
      postId,
      reaction,
      text: null,
    }).catch((err) => logger.error("Like notification failed", { error: err.message }));
  }

  // Optimistic count
  const updatedPost = await prisma.post.findUnique({
  where: { id: postId },
  select: { likesCount: true },
});
const actualCount = updatedPost?.likesCount ?? 0;
  return res.status(200).json({
    success: true,
    liked,
    reaction: liked ? reaction : null,
    likesCount: actualCount,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v2/likes/comment/:commentId
//  Toggle like on a comment
// ─────────────────────────────────────────────────────────────────────────────

export const toggleCommentLike = asyncHandler(async (req, res, next) => {
  const { commentId } = req.params;
  const userId = req.user.id;

  if (!isValidUUID(commentId)) {
    return next(new AppError("Invalid comment ID.", 400));
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, likesCount: true, isDeleted: true },
  });

  if (!comment || comment.isDeleted) {
    return next(new AppError("Comment not found", 404));
  }

  const { liked } = await LikeHelper.toggleLike(
    userId,
    commentId,
    "Comment",
    "❤️",
    { updateParentCount: true, authorId: comment.authorId }
  );

  logger.info("Comment like toggled", { userId, commentId, liked });

  const updatedComment = await prisma.comment.findUnique({
  where: { id: commentId },
  select: { likesCount: true },
});
const actualCount = updatedComment?.likesCount ?? 0;

return res.status(200).json({
  success: true,
  liked,
  likesCount: actualCount,
});
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/likes/post/:postId/status
//  Check if current user liked a post + their reaction
// ─────────────────────────────────────────────────────────────────────────────

export const getPostLikeStatus = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const userId = req.user.id;

  if (!isValidUUID(postId)) {
    return next(new AppError("Invalid post ID.", 400));
  }

  const likeRecord = await LikeHelper.getLikeStatus(userId, postId, "Post");

  return res.status(200).json({
    success: true,
    liked: !!likeRecord,
    reaction: likeRecord?.reaction || null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/likes/post/:postId/likers
//  Cursor-paginated list of users who liked a post
// ─────────────────────────────────────────────────────────────────────────────

export const getPostLikers = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const { afterId } = req.query;
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  if (!isValidUUID(postId)) {
    return next(new AppError("Invalid post ID.", 400));
  }

  if (afterId && !isValidUUID(afterId)) {
    return next(new AppError("Invalid cursor.", 400));
  }

  const { likers, nextCursor } = await LikeHelper.getLikers(postId, "Post", afterId || null, limit);

  return res.status(200).json({
    success: true,
    data: likers,
    nextCursor,
    hasMore: nextCursor !== null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/likes/post/:postId/reactions
//  Emoji reaction breakdown for a post
// ─────────────────────────────────────────────────────────────────────────────

export const getPostReactions = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;

  if (!isValidUUID(postId)) {
    return next(new AppError("Invalid post ID.", 400));
  }

  const breakdown = await LikeHelper.getReactionBreakdown(postId, "Post");

  return res.status(200).json({
    success: true,
    data: breakdown,
  });
});