

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import logger from "../../config/logger.js";
import { notifyChat } from "../../helper/notifyChat.js";
import * as CommentHelper from "../../utils/commentHelpers.js";
import prisma from "../../config/prisma.js";

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v2/comments/post/:postId
//  Create a top-level comment OR a reply
// ─────────────────────────────────────────────────────────────────────────────

export const addComment = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const userId = req.user.id;
  const { content, parentCommentId = null, mentions = [] } = req.body;

  if (!isValidUUID(postId)) {
    return next(new AppError("Invalid post ID.", 400));
  }

  // Input validation
  if (!content?.trim()) {
    return next(new AppError("Comment content is required", 400));
  }
  if (!Array.isArray(mentions) || mentions.length > 10) {
    return next(new AppError("Mentions must be an array of max 10 users", 400));
  }

  // Post guard
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, commentsDisabled: true, isDeleted: true },
  });

  if (!post || post.isDeleted) {
    return next(new AppError("Post not found", 404));
  }
  if (post.commentsDisabled) {
    return next(new AppError("Comments are disabled on this post", 403));
  }

  // Create comment
  let comment;
  try {
    comment = await CommentHelper.createComment({
      postId,
      authorId: userId,
      content: content.trim(),
      mentions,
      parentCommentId: parentCommentId || null,
    });
  } catch (err) {
    if (err.message?.includes("depth")) {
      return next(new AppError("Maximum comment nesting depth reached", 400));
    }
    if (err.message?.includes("Parent comment not found")) {
      return next(new AppError("Parent comment not found or has been deleted", 404));
    }
    throw err;
  }

  // Increment post commentsCount
  await prisma.post.update({
    where: { id: postId },
    data: { commentsCount: { increment: 1 } },
  });

  // Admin notification
  notifyChat("/notify/admin-notify", {
    type: "admin_new_comment",
    meta: {
      commentId: comment.id,
      postId,
      authorId: userId,
    },
  }).catch((err) => logger.error("Admin comment notification failed", { error: err.message }));

  logger.info("Comment added", {
    userId,
    postId,
    commentId: comment.id,
    isReply: !!parentCommentId,
  });

  // Notification (skip if own post)
  if (post.authorId !== userId) {
    notifyChat("/notify/comment", {
      to: post.authorId,
      from: userId,
      sender: {
        fullName: req.user.fullName || req.user.username || "",
        username: req.user.username || "",
        avatar: req.user.avatar?.url || null,
      },
      type: parentCommentId ? "reply" : "comment",
      postId,
      text: content.trim().slice(0, 100),
    }).catch((err) => logger.error("Comment notification failed", { error: err.message }));
  }

  const updatedPost = await prisma.post.findUnique({
  where: { id: postId },
  select: { commentsCount: true },
});

return res.status(201).json({
  success: true,
  data: comment,
  commentsCount: updatedPost?.commentsCount ?? 0,
});
});


export const getComments = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const { afterId, afterDate } = req.query;
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  if (!isValidUUID(postId)) {
    return next(new AppError("Invalid post ID.", 400));
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, isDeleted: true },
  });

  if (!post || post.isDeleted) {
    return next(new AppError("Post not found", 404));
  }

  // Fetch pinned + paginated in parallel
  const [pinned, { comments, nextCursor }] = await Promise.all([
    !afterId ? CommentHelper.getPinnedComment(postId) : Promise.resolve(null),
    CommentHelper.getTopLevelComments(postId, { afterId, afterDate, limit }),
  ]);

  // Prepend pinned, deduplicate
  let result = comments;
  if (pinned) {
    const pinnedId = pinned.id;
    result = [pinned, ...comments.filter((c) => c.id !== pinnedId)];
  }

  return res.status(200).json({
    success: true,
    data: result,
    nextCursor,
    hasMore: nextCursor !== null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/comments/:commentId/replies
//  Replies under a root comment — cursor-paginated
// ─────────────────────────────────────────────────────────────────────────────

export const getReplies = asyncHandler(async (req, res, next) => {
  const { commentId } = req.params;
  const { afterId, afterDate } = req.query;
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

  if (!isValidUUID(commentId)) {
    return next(new AppError("Invalid comment ID.", 400));
  }

  const root = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, isDeleted: true },
  });

  if (!root || root.isDeleted) {
    return next(new AppError("Comment not found", 404));
  }

  const { replies, nextCursor } = await CommentHelper.getReplies(commentId, {
    afterId,
    afterDate,
    limit,
  });

  return res.status(200).json({
    success: true,
    data: replies,
    nextCursor,
    hasMore: nextCursor !== null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/comments/:commentId/direct-replies
//  Direct replies to a specific comment
// ─────────────────────────────────────────────────────────────────────────────

export const getDirectReplies = asyncHandler(async (req, res, next) => {
  const { commentId } = req.params;
  const { afterId, afterDate } = req.query;
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

  if (!isValidUUID(commentId)) {
    return next(new AppError("Invalid comment ID.", 400));
  }

  const { replies, nextCursor } = await CommentHelper.getDirectReplies(commentId, {
    afterId,
    afterDate,
    limit,
  });

  return res.status(200).json({
    success: true,
    data: replies,
    nextCursor,
    hasMore: nextCursor !== null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/v2/comments/:commentId
//  Soft-delete own comment; hard-delete for admin
// ─────────────────────────────────────────────────────────────────────────────

export const deleteComment = asyncHandler(async (req, res, next) => {
  const { commentId } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === "super_admin" || req.user.role === "admin";

  if (!isValidUUID(commentId)) {
    return next(new AppError("Invalid comment ID.", 400));
  }

  if (isAdmin) {
    // Hard delete
    const { deletedCount, postId } = await CommentHelper.hardDeleteComment(
      commentId,
      userId,
      true
    );

    if (!deletedCount) {
      return next(new AppError("Comment not found", 404));
    }

    if (postId) {
      await prisma.post.update({
        where: { id: postId },
        data: { commentsCount: { decrement: deletedCount } },
      });
    }

    logger.info("Admin hard-deleted comment", { adminId: userId, commentId, deletedCount });

    return res.status(200).json({
      success: true,
      message: `Comment and ${deletedCount - 1} replies deleted`,
    });
  }

  // Regular user: soft delete
  const comment = await CommentHelper.softDeleteComment(commentId, userId);
  if (!comment) {
    return next(new AppError("Comment not found or unauthorized", 404));
  }

  // Decrement post commentsCount
  await prisma.post.update({
    where: { id: comment.post },
    data: { commentsCount: { decrement: 1 } },
  });

  logger.info("Comment soft-deleted", { userId, commentId });

  return res.status(200).json({ success: true, message: "Comment deleted" });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/comments/:commentId/pin
//  Pin a comment (post author only)
// ─────────────────────────────────────────────────────────────────────────────

export const pinComment = asyncHandler(async (req, res, next) => {
  const { commentId } = req.params;
  const userId = req.user.id;

  if (!isValidUUID(commentId)) {
    return next(new AppError("Invalid comment ID.", 400));
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true, isDeleted: true },
  });

  if (!comment || comment.isDeleted) {
    return next(new AppError("Comment not found", 404));
  }

  // Only post author can pin
  const post = await prisma.post.findUnique({
    where: { id: comment.postId },
    select: { id: true, authorId: true, isDeleted: true },
  });

  if (!post || post.isDeleted) {
    return next(new AppError("Post not found", 404));
  }

  if (post.authorId !== userId) {
    return next(new AppError("Only the post author can pin a comment", 403));
  }

  await CommentHelper.pinComment(commentId, comment.postId);

  logger.info("Comment pinned", { userId, commentId, postId: comment.postId });

  return res.status(200).json({ success: true, message: "Comment pinned" });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/comments/:commentId/unpin
//  Unpin comments on a post (post author only)
// ─────────────────────────────────────────────────────────────────────────────

export const unpinComment = asyncHandler(async (req, res, next) => {
  const { commentId } = req.params;
  const userId = req.user.id;

  if (!isValidUUID(commentId)) {
    return next(new AppError("Invalid comment ID.", 400));
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true, isDeleted: true },
  });

  if (!comment || comment.isDeleted) {
    return next(new AppError("Comment not found", 404));
  }

  const post = await prisma.post.findUnique({
    where: { id: comment.postId },
    select: { id: true, authorId: true, isDeleted: true },
  });

  if (!post || post.isDeleted) {
    return next(new AppError("Post not found", 404));
  }

  if (post.authorId !== userId) {
    return next(new AppError("Only the post author can unpin a comment", 403));
  }

  await CommentHelper.unpinComment(comment.postId);

  logger.info("Comment unpinned", { userId, postId: comment.postId });

  return res.status(200).json({ success: true, message: "Comment unpinned" });
});