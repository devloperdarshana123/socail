

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError      from "../../utils/AppError.js";
import Comment       from "../../models/comment.model.js";
import Post          from "../../models/post.model.js";
import logger        from "../../config/logger.js";
import { notifyChat } from "../../helper/notifyChat.js";

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v2/comments/post/:postId
//  Create a top-level comment OR a reply
// ─────────────────────────────────────────────────────────────────────────────
export const addComment = asyncHandler(async (req, res, next) => {
  const { postId }                             = req.params;
  const userId                                 = req.user._id;
  const { content, parentCommentId = null, mentions = [] } = req.body;

  // ── Input validation ──────────────────────────────────────────────────────
  if (!content?.trim()) {
    return next(new AppError("Comment content is required", 400));
  }
  if (!Array.isArray(mentions) || mentions.length > 10) {
    return next(new AppError("Mentions must be an array of max 10 users", 400));
  }

  // ── Post guard ────────────────────────────────────────────────────────────
  const post = await Post.findOne({ _id: postId, isDeleted: false }).select(
    "author commentsDisabled",
  );
  if (!post)               return next(new AppError("Post not found", 404));
  if (post.commentsDisabled) return next(new AppError("Comments are disabled on this post", 403));

  // ── Create via model static (handles depth, root, repliesCount) ───────────
  let comment;
  try {
    comment = await Comment.createComment({
      postId,
      authorId       : userId,
      content        : content.trim(),
      mentions,
      parentCommentId: parentCommentId || null,
    });
  } catch (err) {
    // schema max:5 depth throws here
    if (err.message?.includes("depth")) {
      return next(new AppError("Maximum comment nesting depth reached", 400));
    }
    if (err.message?.includes("Parent comment not found")) {
      return next(new AppError("Parent comment not found or has been deleted", 404));
    }
    throw err;
  }

  // ── Increment post commentsCount ──────────────────────────────────────────
  await Post.updateCount(postId, "commentsCount", 1);
  notifyChat("/notify/admin-notify", {
  type: "admin_new_comment",
  meta: {
    commentId: comment._id.toString(),
    postId,
    authorId: userId.toString(),
  },
}).catch((err) =>
  logger.error("Admin comment notification failed", { error: err.message })
);

  logger.info("Comment added", {
    userId, postId,
    commentId      : comment._id,
    isReply        : !!parentCommentId,
  });

  // ── Notification (skip if own post) ──────────────────────────────────────
  if (post.author.toString() !== userId.toString()) {
    notifyChat("/notify/comment", {
      to    : post.author.toString(),
      from  : userId.toString(),
      sender: {
        fullName: req.user.fullName || req.user.username || "",
        username: req.user.username || "",
        avatar  : req.user.avatar?.url || null,
      },
      type  : parentCommentId ? "reply" : "comment",
      postId,
      text  : content.trim().slice(0, 100),
    }).catch((err) =>
      logger.error("Comment notification failed", { error: err.message }),
    );
  }

  return res.status(201).json({ success: true, data: comment });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/comments/post/:postId
//  Top-level comments — cursor-paginated, pinned comment prepended
//
//  Query params:
//    afterId   — _id of last comment on previous page
//    afterDate — createdAt of that comment (ISO string)
//    limit     — default 20, max 50
// ─────────────────────────────────────────────────────────────────────────────
export const getComments = asyncHandler(async (req, res, next) => {
  const { postId }              = req.params;
  const { afterId, afterDate }  = req.query;
  const limit                   = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  const post = await Post.findOne({ _id: postId, isDeleted: false }).select("_id");
  if (!post) return next(new AppError("Post not found", 404));

  // Fetch pinned + paginated top-level comments in parallel
  const [pinned, { comments, nextCursor }] = await Promise.all([
    // Pinned only on first page (no afterId cursor)
    !afterId ? Comment.getPinnedComment(postId) : Promise.resolve(null),
    Comment.getTopLevelComments(postId, { afterId, afterDate, limit }),
  ]);

  // Prepend pinned comment, deduplicate in case it appears in main list
  let result = comments;
  if (pinned) {
    const pinnedId = pinned._id.toString();
    result = [pinned, ...comments.filter((c) => c._id.toString() !== pinnedId)];
  }

  return res.status(200).json({
    success   : true,
    data      : result,
    nextCursor,                          // null when no more pages
    hasMore   : nextCursor !== null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/comments/:commentId/replies
//  Replies under a root comment — cursor-paginated
//
//  Query params:
//    afterId   — cursor
//    afterDate — cursor
//    limit     — default 10, max 50
// ─────────────────────────────────────────────────────────────────────────────
export const getReplies = asyncHandler(async (req, res, next) => {
  const { commentId }           = req.params;
  const { afterId, afterDate }  = req.query;
  const limit                   = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

  const root = await Comment.findById(commentId).select("_id isDeleted").lean();
  if (!root || root.isDeleted) return next(new AppError("Comment not found", 404));

  const { replies, nextCursor } = await Comment.getReplies(
    commentId,
    { afterId, afterDate, limit },
  );

  return res.status(200).json({
    success   : true,
    data      : replies,
    nextCursor,
    hasMore   : nextCursor !== null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/comments/:commentId/direct-replies
//  Direct replies to a specific comment (not the whole thread)
// ─────────────────────────────────────────────────────────────────────────────
export const getDirectReplies = asyncHandler(async (req, res, next) => {
  const { commentId }           = req.params;
  const { afterId, afterDate }  = req.query;
  const limit                   = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

  const { replies, nextCursor } = await Comment.getDirectReplies(
    commentId,
    { afterId, afterDate, limit },
  );

  return res.status(200).json({
    success   : true,
    data      : replies,
    nextCursor,
    hasMore   : nextCursor !== null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/v2/comments/:commentId
//  Soft-delete own comment; hard-delete for admin
// ─────────────────────────────────────────────────────────────────────────────
export const deleteComment = asyncHandler(async (req, res, next) => {
  const { commentId } = req.params;
  const userId        = req.user._id;
  const isAdmin       = req.user.role === "super_admin" || req.user.role === "admin";

  if (isAdmin) {
    // Hard delete: removes comment + all replies, returns { deletedCount }
  //   const { deletedCount } = await Comment.hardDelete(commentId, userId, true);
  //   if (!deletedCount) return next(new AppError("Comment not found", 404));

  //   logger.info("Admin hard-deleted comment", { adminId: userId, commentId, deletedCount });
  //   return res.status(200).json({
  //     success: true,
  //     message: `Comment and ${deletedCount - 1} replies deleted`,
  //   });
  // }
const { deletedCount, postId } = await Comment.hardDelete(commentId, userId, true);
if (!deletedCount) return next(new AppError("Comment not found", 404));

if (postId) {
  await Post.updateCount(postId.toString(), "commentsCount", -deletedCount);
}

logger.info("Admin hard-deleted comment", { adminId: userId, commentId, deletedCount });
return res.status(200).json({
  success: true,
  message: `Comment and ${deletedCount - 1} replies deleted`,
});
  }
  // Regular user: soft delete
  const comment = await Comment.softDelete(commentId, userId);
  if (!comment) return next(new AppError("Comment not found or unauthorized", 404));

  // Decrement post commentsCount
  await Post.updateCount(comment.post.toString(), "commentsCount", -1);

  logger.info("Comment soft-deleted", { userId, commentId });
  return res.status(200).json({ success: true, message: "Comment deleted" });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/comments/:commentId/pin
//  Pin a comment (post author only)
// ─────────────────────────────────────────────────────────────────────────────
export const pinComment = asyncHandler(async (req, res, next) => {
  const { commentId } = req.params;
  const userId        = req.user._id;

  const comment = await Comment.findOne({ _id: commentId, isDeleted: false })
    .select("post")
    .lean();
  if (!comment) return next(new AppError("Comment not found", 404));

  // Only post author can pin
  const post = await Post.findOne({ _id: comment.post, isDeleted: false })
    .select("author")
    .lean();
  if (!post) return next(new AppError("Post not found", 404));

  if (post.author.toString() !== userId.toString()) {
    return next(new AppError("Only the post author can pin a comment", 403));
  }

  await Comment.pinComment(commentId, comment.post);

  logger.info("Comment pinned", { userId, commentId, postId: comment.post });
  return res.status(200).json({ success: true, message: "Comment pinned" });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/comments/:commentId/unpin
//  Unpin comments on a post (post author only)
// ─────────────────────────────────────────────────────────────────────────────
export const unpinComment = asyncHandler(async (req, res, next) => {
  const { commentId } = req.params;
  const userId        = req.user._id;

  const comment = await Comment.findOne({ _id: commentId, isDeleted: false })
    .select("post")
    .lean();
  if (!comment) return next(new AppError("Comment not found", 404));

  const post = await Post.findOne({ _id: comment.post, isDeleted: false })
    .select("author")
    .lean();
  if (!post) return next(new AppError("Post not found", 404));

  if (post.author.toString() !== userId.toString()) {
    return next(new AppError("Only the post author can unpin a comment", 403));
  }

  await Comment.unpinComment(comment.post);

  logger.info("Comment unpinned", { userId, postId: comment.post });
  return res.status(200).json({ success: true, message: "Comment unpinned" });
});