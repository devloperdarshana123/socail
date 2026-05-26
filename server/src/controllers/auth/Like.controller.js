

import asyncHandler  from "../../middlewares/asyncHandler.js";
import AppError      from "../../utils/AppError.js";
import Like          from "../../models/like.model.js";
import Post          from "../../models/post.model.js";
import Comment       from "../../models/comment.model.js";
import logger        from "../../config/logger.js";
import { notifyChat } from "../../helper/notifyChat.js";

const VALID_REACTIONS = ["❤️", "🔥", "😮", "😂", "😢", "👏"];

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v2/likes/post/:postId
//  Toggle like / reaction on a post
// ─────────────────────────────────────────────────────────────────────────────
export const togglePostLike = asyncHandler(async (req, res, next) => {
  const { postId }          = req.params;
  const userId              = req.user._id;
  const { reaction = "❤️" } = req.body || {};

  if (!VALID_REACTIONS.includes(reaction)) {
    return next(new AppError("Invalid reaction type.", 400));
  }

  const post = await Post.findOne({ _id: postId, isDeleted: false })
    .select("author likesCount likesHidden")
    .lean();
  if (!post) return next(new AppError("Post not found", 404));

  // toggleLike handles: self-like guard, E11000 race, likesCount $inc
  const { liked, previousReaction } = await Like.toggleLike(
    userId,
    postId,
    "Post",
    reaction,
    { updateParentCount: true, authorId: post.author },
  );

  logger.info("Post like toggled", {
    userId, postId, liked, reaction,
    previousReaction: previousReaction || null,
  });

  // Fire-and-forget notification — only on like, not unlike, not own post
  if (liked && post.author.toString() !== userId.toString()) {
    notifyChat("/notify/like", {
      to    : post.author.toString(),
      from  : userId.toString(),
      sender: {
        fullName: req.user.fullName || req.user.username || "",
        username: req.user.username || "",
        avatar  : req.user.avatar?.url || null,
      },
      type    : "like",
      postId,
      reaction,
      text    : null,
    }).catch((err) =>
      logger.error("Like notification failed", { error: err.message }),
    );
  }

  return res.status(200).json({
    success   : true,
    liked,
    reaction  : liked ? reaction : null,
    // Optimistic count — DB is source of truth; frontend refetches on mismatch
    likesCount: Math.max(0, post.likesCount + (liked ? 1 : -1)),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v2/likes/comment/:commentId
//  Toggle like on a comment
// ─────────────────────────────────────────────────────────────────────────────
export const toggleCommentLike = asyncHandler(async (req, res, next) => {
  const { commentId } = req.params;
  const userId        = req.user._id;

  const comment = await Comment.findOne({ _id: commentId, isDeleted: false })
    .select("author likesCount")
    .lean();
  if (!comment) return next(new AppError("Comment not found", 404));

  const { liked } = await Like.toggleLike(
    userId,
    commentId,
    "Comment",
    "❤️",
    { updateParentCount: true, authorId: comment.author },
  );

  logger.info("Comment like toggled", { userId, commentId, liked });

  return res.status(200).json({
    success   : true,
    liked,
    likesCount: Math.max(0, comment.likesCount + (liked ? 1 : -1)),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/likes/post/:postId/status
//  Check if current user liked a post + their reaction
// ─────────────────────────────────────────────────────────────────────────────
export const getPostLikeStatus = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const userId     = req.user._id;

  // getLike returns full doc — no second round trip for reaction
  const doc = await Like.getLike(userId, postId, "Post");

  return res.status(200).json({
    success : true,
    liked   : !!doc,
    reaction: doc?.reaction || null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/likes/post/:postId/likers
//  Cursor-paginated list of users who liked a post
// ─────────────────────────────────────────────────────────────────────────────
export const getPostLikers = asyncHandler(async (req, res, next) => {
  const { postId }  = req.params;
  const { afterId } = req.query;
  const limit       = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  const { likers, nextCursor } = await Like.getLikers(
    postId, "Post", afterId || null, limit,
  );

  return res.status(200).json({
    success   : true,
    data      : likers,
    nextCursor,
    hasMore   : nextCursor !== null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/likes/post/:postId/reactions
//  Emoji reaction breakdown for a post
// ─────────────────────────────────────────────────────────────────────────────
export const getPostReactions = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;

  const breakdown = await Like.getReactionBreakdown(postId, "Post");

  return res.status(200).json({
    success: true,
    data   : breakdown,
  });
});