

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import prisma from "../../config/prisma.js";
import redis from "../../config/redis.js";

const EXPLORE_CACHE_TTL = 60;
const PROFILE_CACHE_TTL = 30;
const ALLOWED_TYPES = new Set(["image", "reel", "text"]);
const MAX_LIMIT = 50;

const AUTHOR_SELECT = {
  id: true, username: true, fullName: true, avatar: true,
  isVerifiedBadge: true, accountStatus: true, role: true,
};

function isVisibleAuthor(post) {
  return (
    post.author != null &&
    post.author.accountStatus !== "deactivated" &&
    post.author.role !== "super_admin"
  );
}

// ─────────────────────────────────────────────
//  GET /api/v2/explore/posts
// ─────────────────────────────────────────────

export const getExplorePosts = asyncHandler(async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 24, MAX_LIMIT);
  const cursor = req.query.cursor?.trim() || null;
  const type = req.query.type?.trim() || "all";

  if (type !== "all" && !ALLOWED_TYPES.has(type)) {
    return next(new AppError("Invalid type. Allowed: image, reel, text, all.", 400));
  }

  const cacheKey = `explore:posts:first:v2`;
  const useCache = !cursor && type === "all";

  if (useCache) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.status(200).json({
          success: true,
          message: "Explore posts fetched successfully.",
          data: cached,
          fromCache: true,
        });
      }
    } catch {}
  }

  const where = {
    isDeleted: false,
    isDraft: false,
    visibility: "public",
    author: { accountStatus: { not: "deactivated" }, role: { not: "super_admin" } },
    ...(type !== "all" && { type }),
  };

  const rawPosts = await prisma.post.findMany({
    where,
    orderBy: { id: "desc" },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    select: {
      id: true, type: true, caption: true, media: true,
      likesCount: true, commentsCount: true, viewsCount: true, savedCount: true,
      createdAt: true, hashtags: true, commentsDisabled: true, likesHidden: true,
      author: { select: AUTHOR_SELECT },
    },
  });

  const hasMore = rawPosts.length > limit;
  const finalPosts = hasMore ? rawPosts.slice(0, limit) : rawPosts;
  const nextCursor = hasMore ? finalPosts[finalPosts.length - 1].id : null;

  const payload = { posts: finalPosts, nextCursor, hasMore, count: finalPosts.length };

  if (useCache) {
    try {
      await redis.set(cacheKey, JSON.stringify(payload), { ex: EXPLORE_CACHE_TTL });
    } catch {}
  }

  return res.status(200).json({
    success: true,
    message: "Explore posts fetched successfully.",
    data: payload,
  });
});

// ─────────────────────────────────────────────
//  GET /api/v2/explore/search
// ─────────────────────────────────────────────

export const searchPosts = asyncHandler(async (req, res, next) => {
  const q = req.query.q?.trim();
  const limit = Math.min(parseInt(req.query.limit) || 20, MAX_LIMIT);
  const cursor = req.query.cursor?.trim() || null;

  if (!q) return next(new AppError("Search query required.", 400));
  if (q.length > 100) return next(new AppError("Search query too long.", 400));

  const where = {
    isDeleted: false,
    isDraft: false,
    visibility: "public",
    author: { accountStatus: { not: "deactivated" }, role: { not: "super_admin" } },
    OR: [
      { caption: { contains: q, mode: "insensitive" } },
      { hashtags: { hasSome: [q.toLowerCase()] } },
    ],
  };

  const rawPosts = await prisma.post.findMany({
    where,
    orderBy: { id: "desc" },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    select: {
      id: true, type: true, caption: true, media: true,
      likesCount: true, commentsCount: true, viewsCount: true,
      createdAt: true, hashtags: true,
      author: { select: AUTHOR_SELECT },
    },
  });

  const hasMore = rawPosts.length > limit;
  const finalPosts = hasMore ? rawPosts.slice(0, limit) : rawPosts;
  const nextCursor = hasMore ? finalPosts[finalPosts.length - 1].id : null;

  return res.status(200).json({
    success: true,
    message: "Search results fetched.",
    data: { posts: finalPosts, nextCursor, hasMore, count: finalPosts.length, query: q },
  });
});

// ─────────────────────────────────────────────
//  GET /api/v2/explore/user/:username
// ─────────────────────────────────────────────

export const getPublicProfile = asyncHandler(async (req, res, next) => {
  const { username } = req.params;
  const postLimit = Math.min(parseInt(req.query.postLimit) || 18, MAX_LIMIT);
  const postCursor = req.query.postCursor?.trim() || null;

  const profileCacheKey = `profile:${username}:v2`;
  const useCache = !postCursor;

  if (useCache) {
    try {
      const cached = await redis.get(profileCacheKey);
      if (cached) {
        return res.status(200).json({ success: true, ...cached, fromCache: true });
      }
    } catch {}
  }

  const user = await prisma.user.findFirst({
    where: { username, accountStatus: "active", role: { not: "super_admin" } },
    select: {
      id: true, fullName: true, username: true, avatar: true, coverPhoto: true,
      bio: true, designation: true, businessCategory: true, location: true,
      followersCount: true, followingCount: true, isVerifiedBadge: true, isPrivate: true,
    },
  });

  if (!user) return next(new AppError("User not found.", 404));

  const currentUserId = req.user?.id || null;
  const followRecord = currentUserId
    ? await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: currentUserId, followingId: user.id } },
        select: { status: true },
      })
    : null;

  const isFollowing = followRecord?.status === "accepted";
  const isPending = followRecord?.status === "pending";

  let posts = [];
  let hasMorePosts = false;
  let nextPostCursor = null;

  const canViewPosts = !user.isPrivate || isFollowing || (currentUserId && user.id === currentUserId);

  if (canViewPosts) {
    const rawPosts = await prisma.post.findMany({
      where: { authorId: user.id, isDraft: false, isDeleted: false, visibility: "public" },
      orderBy: { id: "desc" },
      take: postLimit + 1,
      ...(postCursor && { cursor: { id: postCursor }, skip: 1 }),
      select: {
        id: true, type: true, media: true, caption: true,
        likesCount: true, commentsCount: true, viewsCount: true,
        commentsDisabled: true, likesHidden: true, createdAt: true,
      },
    });

    hasMorePosts = rawPosts.length > postLimit;
    posts = hasMorePosts ? rawPosts.slice(0, postLimit) : rawPosts;
    nextPostCursor = hasMorePosts ? posts[posts.length - 1].id : null;
  }

  const userPayload = { ...user, isFollowing, isPending, postsCount: posts.length };

  if (useCache) {
    try {
      await redis.set(
        profileCacheKey,
        JSON.stringify({ user: userPayload, posts, hasMorePosts, nextPostCursor }),
        { ex: PROFILE_CACHE_TTL },
      );
    } catch {}
  }

  return res.status(200).json({
    success: true,
    user: userPayload,
    posts,
    hasMorePosts,
    nextPostCursor,
  });
});