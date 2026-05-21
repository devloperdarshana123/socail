import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import Like from "../../models/like.model.js";
import Post from "../../models/post.model.js";
import Comment from "../../models/comment.model.js";
import logger from "../../config/logger.js";
import { notifyChat } from "../../helper/notifyChat.js";
// ─────────────────────────────────────────────
//  POST /api/v2/likes/post/:postId
//  Toggle like on a post
// ─────────────────────────────────────────────
export const togglePostLike = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;
  const { reaction = null } = req.body || {};
  const VALID_REACTIONS = ["❤️", "🔥", "😮", "😂", "😢", "👏", null];
if (!VALID_REACTIONS.includes(reaction)) {
  throw new AppError("Invalid reaction type.", 400);
}

  const post = await Post.findOne({ _id: postId, isDeleted: false });
  if (!post) throw new AppError("Post not found", 404);

  const { liked } = await Like.toggleLike(userId, postId, "Post", reaction);

  // Update denormalized count on Post
  await Post.updateCount(postId, "likesCount", liked ? 1 : -1);

 logger.info(`User ${userId} ${liked ? "liked" : "unliked"} post ${postId}`);

  // Notification — sirf like pe, unlike pe nahi, aur apni post pe nahi
 if (liked && post.author.toString() !== userId.toString()) {
    notifyChat("/notify/like", {
      to:     post.author.toString(),
      from:   userId.toString(),
      sender: {
        fullName: req.user.fullName || req.user.username || "",
        username: req.user.username || "",
        avatar:   req.user.avatar?.url || null,
      },
      type:   "like",
      postId: postId,
      text:   null,
    }).catch((err) =>
      logger.error("Like notification failed", { error: err.message })
    );
  }
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
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  const likers = await Like.getLikers(postId, "Post", page, limit);
  const total = await Like.getLikesCount(postId, "Post");

  res.status(200).json({
    success: true,
    data: likers,
    pagination: { page, limit, total },
  });
});