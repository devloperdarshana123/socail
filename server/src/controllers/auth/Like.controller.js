import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import Like from "../../models/like.model.js";
import Post from "../../models/post.model.js";
import Comment from "../../models/comment.model.js";
import logger from "../../config/logger.js";

// ─────────────────────────────────────────────
//  POST /api/v2/likes/post/:postId
//  Toggle like on a post
// ─────────────────────────────────────────────
export const togglePostLike = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;
  const { reaction = null } = req.body || {};

  const post = await Post.findOne({ _id: postId, isDeleted: false });
  if (!post) throw new AppError("Post not found", 404);

  const { liked } = await Like.toggleLike(userId, postId, "Post", reaction);

  // Update denormalized count on Post
  await Post.updateCount(postId, "likesCount", liked ? 1 : -1);

  logger.info(`User ${userId} ${liked ? "liked" : "unliked"} post ${postId}`);

  res.status(200).json({
    success: true,
    liked,
    likesCount: Math.max(0, post.likesCount + (liked ? 1 : -1)),
  });
});

// ─────────────────────────────────────────────
//  POST /api/v2/likes/comment/:commentId
//  Toggle like on a comment
// ─────────────────────────────────────────────
export const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user._id;

  const comment = await Comment.findOne({ _id: commentId, isDeleted: false });
  if (!comment) throw new AppError("Comment not found", 404);

  const { liked } = await Like.toggleLike(userId, commentId, "Comment");

  await Comment.updateLikesCount(commentId, liked ? 1 : -1);

  res.status(200).json({
    success: true,
    liked,
    likesCount: Math.max(0, comment.likesCount + (liked ? 1 : -1)),
  });
});

// ─────────────────────────────────────────────
//  GET /api/v2/likes/post/:postId/status
//  Check if current user liked a post
// ─────────────────────────────────────────────
export const getPostLikeStatus = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  const liked = await Like.hasLiked(userId, postId, "Post");

  res.status(200).json({ success: true, liked });
});

// ─────────────────────────────────────────────
//  GET /api/v2/likes/post/:postId/likers
//  Get users who liked a post (paginated)
// ─────────────────────────────────────────────
export const getPostLikers = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const likers = await Like.getLikers(postId, "Post", page, limit);
  const total = await Like.getLikesCount(postId, "Post");

  res.status(200).json({
    success: true,
    data: likers,
    pagination: { page, limit, total },
  });
});