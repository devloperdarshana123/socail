


import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import { deleteFromCloudinary } from "../../helper/cloudinaryUpload.js";
import logger from "../../config/logger.js";
import * as PostHelper from "../../utils/postHelpers.js";
import redis from "../../config/redis.js";

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ─────────────────────────────────────────────
//  CREATE POST
//  POST /api/v2/posts
// ─────────────────────────────────────────────

export const createPost = asyncHandler(async (req, res, next) => {
  const { caption = "", visibility = "public", type, commentsDisabled = false, likesHidden = false, location, isDraft = false, media = [] } = req.body;

  // Validation
  if (!["text", "image", "reel"].includes(type)) {
    return next(new AppError("Invalid post type.", 400));
  }

  if (!isDraft) {
    if (type === "image" && (!media || media.length < 1)) {
      return next(new AppError("Image post requires at least one image.", 400));
    }
    if (type === "reel" && media.length !== 1) {
      return next(new AppError("Reel must have exactly one video.", 400));
    }
    if (type === "text" && media.length > 0) {
      return next(new AppError("Text post cannot have media.", 400));
    }
    if (media.length > 10) {
      return next(new AppError("Maximum 10 media items allowed.", 400));
    }
  } else {
    if (media.length > 10) {
      return next(new AppError("Maximum 10 media items allowed.", 400));
    }
    if (!caption?.trim() && (!media || media.length === 0)) {
      return next(new AppError("Draft must have at least a caption or media.", 400));
    }
  }

 const post = await PostHelper.createPost(req.user.id, req.body);

  if (!isDraft) {
    await redis.del(`posts:feed:${req.user.id}`).catch(() => {});
    await redis.del(`explore:posts:first:v2`).catch(() => {});
  }

  logger.info("Post created", { postId: post.id, author: req.user.id, type });

  return res.status(201).json({
    success: true,
    message: "Post created successfully",
    post,
  });
});

// ─────────────────────────────────────────────
//  GET POST
//  GET /api/v2/posts/:postId
// ─────────────────────────────────────────────

export const getPost = asyncHandler(async (req, res, next) => {
  if (!isValidUUID(req.params.postId)) {
    return next(new AppError("Invalid post ID.", 400));
  }

  const post = await PostHelper.getPostById(req.params.postId, req.user?.id);
  if (!post) {
    return next(new AppError("Post not found.", 404));
  }

  return res.status(200).json({ success: true, post });
});

// ─────────────────────────────────────────────
//  GET POST INTERACTION
//  GET /api/v2/posts/:postId/interaction
// ─────────────────────────────────────────────

// export const getPostInteraction = asyncHandler(async (req, res, next) => {
//   const { postId } = req.params;
//   const userId = req.user.id;

//   if (!isValidUUID(postId)) {
//     return next(new AppError("Invalid post ID.", 400));
//   }

//   const [liked, saved] = await Promise.all([
//     prisma.like.findFirst({
//   where: { likedById: userId, postId, commentId: null, storyId: null },
//   select: { id: true },
// }),
//     prisma.saved.findUnique({
//      where: { savedById_postId: { savedById: userId, postId } },
//       select: { id: true },
//     }),
//   ]);

//   return res.status(200).json({
//     success: true,
//     liked: !!liked,
//     saved: !!saved,
//   });
// });

export const getPostInteraction = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const userId = req.user.id;

  if (!isValidUUID(postId)) {
    return next(new AppError("Invalid post ID.", 400));
  }

  const [liked, saved, post] = await Promise.all([
    PostHelper.findPostLikeByUser(userId, postId),
    PostHelper.findPostSavedByUser(userId, postId),
    PostHelper.getPostInteractionCounts(postId),
  ]);

  return res.status(200).json({
    success: true,
    liked: !!liked,
    saved: !!saved,
    likesCount: post?.likesCount ?? 0,
    commentsCount: post?.commentsCount ?? 0,
    viewsCount: post?.viewsCount ?? 0,
  });
});
// ─────────────────────────────────────────────
//  GET FEED POSTS
//  GET /api/v2/posts/feed
// ─────────────────────────────────────────────

export const getFeedPosts = asyncHandler(async (req, res, next) => {
  const cacheKey = `posts:feed:${req.user.id}`;

  // Cache first page only
  if (!req.query.beforeId) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.status(200).json({ ...JSON.parse(cached), fromCache: true });
      }
    } catch {}
  }

  const { beforeId } = req.query;
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const userId = req.user.id;

  // Get following list
  const follows = await PostHelper.getAcceptedFollowingIds(userId);

  const rawIds = [userId, ...follows.map((f) => f.followingId)];

  // Filter out super_admin
  const hiddenUsers = await PostHelper.getSuperAdminIds();
  const hiddenIds = new Set(hiddenUsers.map((u) => u.id));
  const authorIds = rawIds.filter((id) => !hiddenIds.has(id));

  const { items, hasMore, nextCursor } = await PostHelper.getFeedPosts(authorIds, {
    beforeId: beforeId || null,
    limit,
  });

  const responseData = { success: true, posts: items, hasMore, nextCursor };

  if (!beforeId) {
    try {
      await redis.set(cacheKey, JSON.stringify(responseData), { ex: 300 });
    } catch {}
  }

  return res.status(200).json(responseData);
});

// ─────────────────────────────────────────────
//  GET USER POSTS (Profile Grid)
//  GET /api/v2/posts/user/:userId
// ─────────────────────────────────────────────

export const getUserPosts = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  if (!isValidUUID(userId)) {
    return next(new AppError("Invalid user ID.", 400));
  }

  // super_admin block
  const targetUser = await PostHelper.getUserRoleAndPrivacy(userId);

  if (targetUser?.role === "super_admin") {
    return res.status(200).json({
      success: true,
      data: [],
      hasMore: false,
      nextCursor: null,
      postsCount: 0,
    });
  }

  const limit = Math.min(18, Math.max(1, parseInt(req.query.limit) || 18));
  const beforeId = req.query.beforeId?.trim() || null;
  const viewerId = req.user.id;
  const isOwner = viewerId === userId;

  // Get postsCount and follow status in parallel
  const [postsCount, followRecord] = await Promise.all([
    PostHelper.countVisibleUserPosts(userId),
    isOwner
      ? Promise.resolve(null)
      : PostHelper.getFollowStatus(viewerId, userId),
  ]);

  const isFollower = followRecord?.status === "accepted";

  const { items, hasMore, nextCursor } = await PostHelper.getUserPosts(
    userId,
    isFollower,
    isOwner,
    { beforeId, limit }
  );

  return res.status(200).json({
    success: true,
    data: items,
    hasMore,
    nextCursor,
    postsCount,
  });
});

 
export const deletePost = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const userId = req.user.id;

  if (!isValidUUID(postId)) {
    return next(new AppError("Invalid post ID.", 400));
  }

  const post = await PostHelper.deletePost(postId, userId);
  if (!post) {
    return next(new AppError("Post not found.", 404));
  }

  // Delete media from Cloudinary in parallel
  await Promise.all(
    post.media.map((item) =>
      deleteFromCloudinary(item.publicId, item.resourceType).catch((err) => {
        logger.warn("Cloudinary delete failed", { publicId: item.publicId, error: err.message });
      })
    )
  );

  await redis.del(`posts:feed:${userId}`).catch(() => {});
  await redis.del(`explore:posts:first:v2`).catch(() => {});

  logger.info("Post deleted", { postId, author: userId });

  return res.status(200).json({ success: true, message: "Post deleted successfully" });
});



export const getDraftPosts = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 20));
  const beforeId = req.query.beforeId?.trim() || null;

  if (beforeId && !isValidUUID(beforeId)) {
    return res.status(400).json({ success: false, message: "Invalid cursor." });
  }

  const { items, hasMore, nextCursor } = await PostHelper.getDraftPosts(userId, { beforeId, limit });

  return res.status(200).json({
    success: true,
    posts: items,
    hasMore,
    nextCursor,
  });
});



export const publishDraft = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const userId = req.user.id;

  if (!isValidUUID(postId)) {
    return next(new AppError("Invalid post ID.", 400));
  }

  try {
    const post = await PostHelper.publishDraft(postId, userId);
    if (!post) {
      return next(new AppError("Draft not found.", 404));
    }

    await redis.del(`posts:feed:${userId}`).catch(() => {});

    logger.info("Draft published", { postId, author: userId });

    return res.status(200).json({
      success: true,
      message: "Post published successfully",
      post,
    });
  } catch (err) {
    return next(new AppError(err.message, 400));
  }
});



export const updatePost = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const { caption, isDraft, media } = req.body;

  if (!isValidUUID(postId)) {
    return next(new AppError("Invalid post ID.", 400));
  }

  try {
    // Get current media for deletion tracking
    const current = await PostHelper.getPostMediaForUpdate(postId);

    if (!current) {
      return next(new AppError("Post not found.", 404));
    }

    // Delete removed media from Cloudinary
    if (media) {
      const newPublicIds = media.map((m) => m.publicId);
      const toDelete = current.media.filter((m) => !newPublicIds.includes(m.publicId));

      await Promise.all(
        toDelete.map((m) =>
          deleteFromCloudinary(m.publicId, m.resourceType).catch((err) => {
            logger.warn("Cloudinary delete failed", { publicId: m.publicId, error: err.message });
          })
        )
      );
    }

    const updated = await PostHelper.updatePost(postId, req.user.id, req.body);
    if (!updated) {
      return next(new AppError("Post not found.", 404));
    }

    await redis.del(`posts:feed:${req.user.id}`).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Post updated.",
      post: updated,
    });
  } catch (err) {
    return next(new AppError(err.message, 400));
  }
});



export const recordView = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const { source = "modal", duration = 0 } = req.body || {};
  const userId = req.user.id;

  if (!isValidUUID(postId)) {
    return next(new AppError("Invalid post ID.", 400));
  }

  // Validate source
  const validSources = ["feed", "explore", "profile", "direct", "modal"];
  const safeSource = validSources.includes(source) ? source : "modal";

  // Detect device
  const ua = req.headers["user-agent"] || "";
  const device = /mobile/i.test(ua) ? "mobile" : /tablet|ipad/i.test(ua) ? "tablet" : "desktop";

  const result = await PostHelper.recordPostView(postId, userId, {
    source: safeSource,
    duration: Number(duration) || 0,
    device,
  });

  if (!result) {
    return next(new AppError("Post not found.", 404));
  }

  if (result.isNewView) {
    logger.info("View recorded", { postId, userId, source: safeSource, device });
  }

  const updatedPost = await PostHelper.getPostViewsCount(postId);

return res.status(200).json({
  success: true,
  recorded: result.isNewView,
  selfView: result.selfView,
  viewsCount: updatedPost?.viewsCount ?? 0,
});
});



export const deleteUnusedMedia = asyncHandler(async (req, res, next) => {
  const { publicId, resourceType = "image" } = req.body;

  if (!publicId) {
    return next(new AppError("publicId is required.", 400));
  }

  try {
    await deleteFromCloudinary(publicId, resourceType);
    logger.info("Orphan media deleted", { publicId, resourceType, userId: req.user.id });
    return res.status(200).json({ success: true, message: "Media deleted." });
  } catch (err) {
    logger.warn("Orphan media delete failed", { publicId, error: err.message });
    return res.status(200).json({ success: false, message: "Delete failed, cron will clean it later." });
  }
});



export const bulkDeleteUnusedMedia = asyncHandler(async (req, res, next) => {
  const { items = [] } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return next(new AppError("items array is required.", 400));
  }
  if (items.length > 10) {
    return next(new AppError("Maximum 10 items per request.", 400));
  }

  const results = await Promise.allSettled(
    items.map((m) => deleteFromCloudinary(m.publicId, m.resourceType || "image"))
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      logger.warn("Bulk orphan delete failed", { publicId: items[i].publicId, error: r.reason?.message });
    }
  });

  logger.info("Bulk orphan media cleanup done", { count: items.length, userId: req.user.id });
  return res.status(200).json({ success: true, message: "Cleanup processed." });
});