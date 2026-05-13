import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import Comment from "../../models/comment.model.js";
import Post from "../../models/post.model.js";
import logger from "../../config/logger.js";

// ─────────────────────────────────────────────
//  POST /api/v2/comments/post/:postId
//  Add a top-level comment or reply
// ─────────────────────────────────────────────
export const addComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;
  const { content, parentCommentId = null, mentions = [] } = req.body;

  if (!content?.trim()) throw new AppError("Comment content is required", 400);

  const post = await Post.findOne({ _id: postId, isDeleted: false });
  if (!post) throw new AppError("Post not found", 404);
  if (post.commentsDisabled) throw new AppError("Comments are disabled on this post", 403);

  const comment = await Comment.createComment({
    postId,
    authorId: userId,
    content: content.trim(),
    mentions,
    parentCommentId,
  });

  // Increment commentsCount on post
  await Post.updateCount(postId, "commentsCount", 1);

  logger.info(`User ${userId} commented on post ${postId}`);

  res.status(201).json({ success: true, data: comment });
});

// ─────────────────────────────────────────────
//  GET /api/v2/comments/post/:postId
//  Get top-level comments (paginated)
// ─────────────────────────────────────────────
export const getComments = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const post = await Post.findOne({ _id: postId, isDeleted: false }).select("_id");
  if (!post) throw new AppError("Post not found", 404);

  const [comments, total] = await Promise.all([
    Comment.getTopLevelComments(postId, page, limit),
    Comment.getCommentCount(postId),
  ]);

  res.status(200).json({
    success: true,
    data: comments,
    pagination: { page, limit, total, hasMore: page * limit < total },
  });
});

// ─────────────────────────────────────────────
//  GET /api/v2/comments/:commentId/replies
//  Get replies under a comment
// ─────────────────────────────────────────────
export const getReplies = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const replies = await Comment.getReplies(commentId, page, limit);

  res.status(200).json({ success: true, data: replies });
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/comments/:commentId
//  Soft delete a comment (author only)
// ─────────────────────────────────────────────
export const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user._id;

  const comment = await Comment.softDelete(commentId, userId);
  if (!comment) throw new AppError("Comment not found or unauthorized", 404);

  // Decrement commentsCount on post
  await Post.updateCount(comment.post, "commentsCount", -1);

  res.status(200).json({ success: true, message: "Comment deleted" });
});