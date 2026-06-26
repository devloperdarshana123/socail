

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import logger from "../../config/logger.js";
import * as SavedHelper from "../../utils/savedHelpers.js";
import redis from "../../config/redis.js";
import prisma from "../../config/prisma.js";

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ─────────────────────────────────────────────
//  POST /api/v2/saved/:postId
//  Toggle save / unsave a post
// ─────────────────────────────────────────────

export const toggleSave = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const userId = req.user.id;

  if (!isValidUUID(postId)) {
    return next(new AppError("Invalid post ID.", 400));
  }

  try {
    // Verify post is visible before saving
    await SavedHelper.assertPostVisible(postId, userId);
  } catch (err) {
    if (err.message.includes("private")) {
      return next(new AppError(err.message, 403));
    }
    return next(new AppError(err.message, 404));
  }

  const { saved } = await SavedHelper.toggleSave(userId, postId);

  // Fetch updated count
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { savedCount: true },
  });

  const savedCount = Math.max(0, post?.savedCount ?? 0);

  logger.info(`User ${userId} ${saved ? "saved" : "unsaved"} post ${postId}`);

  // Invalidate cache
  try {
    await redis.del(`saved:${userId}`);
  } catch {}

  return res.status(200).json({ success: true, saved, savedCount });
});

// ─────────────────────────────────────────────
//  GET /api/v2/saved
//  Get paginated saved posts for the current user
// ─────────────────────────────────────────────

export const getSavedPosts = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
  const beforeId = req.query.beforeId || null;

  // Validate cursor
  if (beforeId && !isValidUUID(beforeId)) {
    return next(new AppError("Invalid cursor.", 400));
  }

  // Check cache (first page only)
  if (!beforeId) {
    try {
      const cached = await redis.get(`saved:${userId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        return res.status(200).json({
          success: true,
          data: parsed.data,
          pagination: parsed.pagination,
          fromCache: true,
        });
      }
    } catch {}
  }

  const { items, hasMore, nextCursor } = await SavedHelper.getSavedPosts(userId, {
    beforeId,
    limit,
  });

  // Filter out null posts (in case post was deleted)
  const data = items
    .filter((s) => s.post)
    .map((s) => ({
      savedAt: s.createdAt,
      post: s.post,
    }));

  const pagination = { limit, hasMore, nextCursor };

  // Cache first page only
  if (!beforeId) {
    try {
      await redis.set(
        `saved:${userId}`,
        JSON.stringify({ data, pagination }),
        { ex: 30 }
      );
    } catch {}
  }

  return res.status(200).json({
    success: true,
    data,
    pagination,
  });
});

// ─────────────────────────────────────────────
//  GET /api/v2/saved/:postId/status
//  Check if current user has saved a specific post
// ─────────────────────────────────────────────

export const getSaveStatus = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const userId = req.user.id;

  if (!isValidUUID(postId)) {
    return next(new AppError("Invalid post ID.", 400));
  }

  const saved = await SavedHelper.hasSaved(userId, postId);

  return res.status(200).json({ success: true, saved });
});

// ─────────────────────────────────────────────
//  POST /api/v2/saved/status/bulk
//  Check save status for multiple posts (max 50)
//  Body: { postIds: ["id1", "id2", ...] }
// ─────────────────────────────────────────────

export const getBulkSaveStatus = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { postIds } = req.body;

  if (!Array.isArray(postIds) || postIds.length === 0) {
    return next(new AppError("postIds must be a non-empty array", 400));
  }

  if (postIds.length > 50) {
    return next(new AppError("Cannot check more than 50 posts at once", 400));
  }

  // Validate all IDs
  const invalidId = postIds.find((id) => !isValidUUID(id));
  if (invalidId) {
    return next(new AppError("Invalid post ID in list.", 400));
  }

  const savedSet = await SavedHelper.getBulkSaveStatus(userId, postIds);

  const result = {};
  for (const id of postIds) {
    result[id] = savedSet.has(id);
  }

  return res.status(200).json({ success: true, data: result });
});