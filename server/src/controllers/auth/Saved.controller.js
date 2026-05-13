import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import Saved from "../../models/saved.model.js";
import Post from "../../models/post.model.js";
import logger from "../../config/logger.js";

// ─────────────────────────────────────────────
//  POST /api/v2/saved/:postId
//  Toggle save/unsave a post
// ─────────────────────────────────────────────
export const toggleSave = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  const post = await Post.findOne({ _id: postId, isDeleted: false }).select("_id savedCount");
  if (!post) throw new AppError("Post not found", 404);

  const { saved } = await Saved.toggleSave(userId, postId);

  // Update denormalized savedCount
  await Post.updateCount(postId, "savedCount", saved ? 1 : -1);

  logger.info(`User ${userId} ${saved ? "saved" : "unsaved"} post ${postId}`);

  res.status(200).json({
    success: true,
    saved,
    savedCount: Math.max(0, post.savedCount + (saved ? 1 : -1)),
  });
});

// ─────────────────────────────────────────────
//  GET /api/v2/saved
//  Get all saved posts of current user
// ─────────────────────────────────────────────
export const getSavedPosts = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;

  const saved = await Saved.getSavedPosts(userId, page, limit);

  // Filter out null posts (deleted after saving)
  const posts = saved.map((s) => s.post).filter(Boolean);

  res.status(200).json({
    success: true,
    data: posts,
    pagination: { page, limit, hasMore: posts.length === limit },
  });
});

// ─────────────────────────────────────────────
//  GET /api/v2/saved/:postId/status
//  Check if current user saved a post
// ─────────────────────────────────────────────
export const getSaveStatus = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  const saved = await Saved.hasSaved(userId, postId);

  res.status(200).json({ success: true, saved });
});