import mongoose from "mongoose";
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import Saved from "../../models/saved.model.js";
import Post from "../../models/post.model.js";
import Follow from "../../models/follow.model.js";
import logger from "../../config/logger.js";

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

const validateObjectId = (id, label = "id") => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
};

/**
 * Verify post exists and is visible to the viewer.
 * Private-account posts: only followers (and author) can see/save.
 */
const assertPostVisible = async (postId, viewerId) => {
  const post = await Post.findOne({ _id: postId, isDeleted: false, isDraft: false })
    .select("_id savedCount author isArchived")
    .lean();

  if (!post) throw new AppError("Post not found", 404);
  if (post.isArchived) throw new AppError("Post not found", 404);

  // Check if author's account is private
  const author = await mongoose
    .model("User")
    .findById(post.author)
    .select("isPrivate")
    .lean();

  if (author?.isPrivate && post.author.toString() !== viewerId.toString()) {
    // Follow.getFollowStatus returns string: "accepted"|"pending"|"rejected"|null
    const status = await Follow.getFollowStatus(viewerId, post.author);
    if (status !== "accepted") {
      throw new AppError("This post is from a private account", 403);
    }
  }

  return post;
};

// ─────────────────────────────────────────────
//  POST /api/v2/saved/:postId
//  Toggle save / unsave a post
// ─────────────────────────────────────────────
export const toggleSave = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  validateObjectId(postId, "postId");

  // Verify post is visible before saving
  await assertPostVisible(postId, userId);

  // Model handles: atomic toggle + savedCount update internally
  // Do NOT call Post.updateCount separately — that would double-count
  const { saved } = await Saved.toggleSave(userId, postId);

  // Fetch updated count from DB (model already updated it)
  const updated = await Post.findById(postId).select("savedCount").lean();
  const savedCount = Math.max(0, updated?.savedCount ?? 0);

  logger.info(`User ${userId} ${saved ? "saved" : "unsaved"} post ${postId}`);

  res.status(200).json({ success: true, saved, savedCount });
});

// ─────────────────────────────────────────────
//  GET /api/v2/saved
//  Get paginated saved posts for the current user
// ─────────────────────────────────────────────
export const getSavedPosts = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));

  // Model accepts: { limit, beforeId }
  // beforeId = last _id from previous page (cursor)
  const beforeId = req.query.beforeId || null;

  // Model returns: { items, hasMore, nextCursor }
  const { items, hasMore, nextCursor } = await Saved.getSavedPosts(userId, {
    beforeId: beforeId && mongoose.isValidObjectId(beforeId) ? beforeId : null,
    limit,
  });

  // Model already filters deleted/draft posts via populate match
  const data = items
    .filter((s) => s.post)
    .map((s) => ({
      savedAt: s.createdAt,
      post:    s.post,
    }));

  res.status(200).json({
    success: true,
    data,
    pagination: { limit, hasMore, nextCursor },
  });
});

// ─────────────────────────────────────────────
//  GET /api/v2/saved/:postId/status
//  Check if current user has saved a specific post
// ─────────────────────────────────────────────
export const getSaveStatus = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  validateObjectId(postId, "postId");

  const saved = await Saved.hasSaved(userId, postId);

  res.status(200).json({ success: true, saved });
});

// ─────────────────────────────────────────────
//  POST /api/v2/saved/status/bulk
//  Check save status for multiple posts (max 50)
//  Body: { postIds: ["id1", "id2", ...] }
// ─────────────────────────────────────────────
export const getBulkSaveStatus = asyncHandler(async (req, res) => {
  const userId    = req.user._id;
  const { postIds } = req.body;

  if (!Array.isArray(postIds) || postIds.length === 0)
    throw new AppError("postIds must be a non-empty array", 400);

  if (postIds.length > 50)
    throw new AppError("Cannot check more than 50 posts at once", 400);

  for (const id of postIds) {
    validateObjectId(id, "postId");
  }

  // Returns Set<string> of saved postIds
  const savedSet = await Saved.getBulkSaveStatus(userId, postIds);

  const result = {};
  for (const id of postIds) {
    result[id] = savedSet.has(id.toString());
  }

  res.status(200).json({ success: true, data: result });
});