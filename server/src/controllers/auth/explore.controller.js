


// import asyncHandler from "../../middlewares/asyncHandler.js";
// import AppError from "../../utils/AppError.js";
// import Post from "../../models/post.model.js";
// import User from "../../models/user.model.js";
// import Follow from "../../models/follow.model.js";
// import redis from "../../config/redis.js";
// // ─────────────────────────────────────────────
// //  GET /api/v2/explore/posts
// // ─────────────────────────────────────────────
// export const getExplorePosts = asyncHandler(async (req, res, next) => {
//   const limit  = Math.min(parseInt(req.query.limit) || 24, 50);
//   const cursor = req.query.cursor || null;
//   const type   = req.query.type   || "all";
// // Cache — sirf first page
//   if (!cursor && type === "all") {
//     try {
//       const cached = await redis.get("explore:posts:first");
//       if (cached) {
//         return res.status(200).json({ success: true, message: "Explore posts fetched successfully.", data: cached, fromCache: true });
//       }
//     } catch { /* ignore */ }
//   }
//   const filter = {
//     isDeleted:  false,
//     isDraft:    false,
//  visibility: "public",
//   };

//   if (type !== "all") {
//     if (!["image", "reel", "text"].includes(type)) {
//       return next(new AppError("Invalid type. Use image, reel, text or all.", 400));
//     }
//     filter.type = type;
//   }

//   if (cursor) filter._id = { $lt: cursor };

//   const posts = await Post.find(filter)
//     .sort({ _id: -1 })
//     .limit(limit + 1)
//     .populate({
//       path: "author",
//       // NAYA — dono jagah getFeedPosts aur searchPosts mein
// select: "username fullName avatar isVerifiedBadge accountStatus role",
//     })
//     .select(
//       "type caption media likesCount commentsCount viewsCount savedCount " +
//       "author createdAt hashtags isCarousel thumbnail likesHidden commentsDisabled"
//     )
//     .lean();

//   // Deactivated user ki posts hide karo
//   // const filtered = posts.filter(
//   //   (post) => post.author && post.author.accountStatus !== "deactivated"
//   // );

//   // NAYA
// const filtered = posts.filter(
//   (post) => post.author && 
//   post.author.accountStatus !== "deactivated" &&
//   post.author.role !== "super_admin"
// );

//   const hasMore    = filtered.length > limit;
//   const finalPosts = hasMore ? filtered.slice(0, limit) : filtered;
//   const nextCursor = hasMore
//     ? finalPosts[finalPosts.length - 1]._id.toString()
//     : null;
// if (!cursor && type === "all") {
//     try {
//       await redis.set("explore:posts:first", JSON.stringify({ posts: finalPosts, nextCursor, hasMore, count: finalPosts.length }), { ex: 60 });
//     } catch { /* ignore */ }
//   }
//   res.status(200).json({
//     success: true,
//     message: "Explore posts fetched successfully.",
//     data: {
//       posts:      finalPosts,
//       nextCursor,
//       hasMore,
//       count:      finalPosts.length,
//     },
//   });
// });

// // ─────────────────────────────────────────────
// //  GET /api/v2/explore/search
// // ─────────────────────────────────────────────
// export const searchPosts = asyncHandler(async (req, res, next) => {
//   const q      = req.query.q?.trim();
//   const limit  = Math.min(parseInt(req.query.limit) || 20, 50);
//   const cursor = req.query.cursor || null;

//   if (!q) return next(new AppError("Search query required.", 400));
// if (q.length > 100) return next(new AppError("Search query too long.", 400));

//   const filter = {
//     isDeleted:  false,
//     isDraft:    false,
//     visibility: "public",
//     $text:      { $search: q },
//   };

//   if (cursor) filter._id = { $lt: cursor };

//   const posts = await Post.find(filter, { score: { $meta: "textScore" } })
//     .sort({ score: { $meta: "textScore" }, _id: -1 })
//     .limit(limit + 1)
//     .populate({
//       path: "author",
//       // NAYA
// select: "username fullName avatar isVerifiedBadge accountStatus role",
//     })
//     .select(
//       "type caption media likesCount commentsCount viewsCount " +
//       "author createdAt hashtags isCarousel thumbnail"
//     )
//     .lean();

//   // Deactivated user ki posts hide karo
//   // NAYA
// const filtered = posts.filter(
//   (post) => post.author && 
//   post.author.accountStatus !== "deactivated" &&
//   post.author.role !== "super_admin"
// );
//   const hasMore    = filtered.length > limit;
//   const finalPosts = hasMore ? filtered.slice(0, limit) : filtered;
//   const nextCursor = hasMore
//     ? finalPosts[finalPosts.length - 1]._id.toString()
//     : null;

//   res.status(200).json({
//     success: true,
//     message: "Search results fetched.",
//     data: {
//       posts:      finalPosts,
//       nextCursor,
//       hasMore,
//       count:      finalPosts.length,
//       query:      q,
//     },
//   });
// });


// // ─────────────────────────────────────────────
// //  GET /api/v2/explore/user/:username
// //  Public profile fetch karo
// // ─────────────────────────────────────────────
// // ─────────────────────────────────────────────
// //  GET /api/v2/explore/user/:username
// // ─────────────────────────────────────────────
// export const getPublicProfile = asyncHandler(async (req, res, next) => {
//   const { username } = req.params;


//   const profileCacheKey = `profile:${username}`;
//   try {
//     const cached = await redis.get(profileCacheKey);
//     if (cached) {
//       return res.status(200).json({ success: true, ...cached, fromCache: true });
//     }
//   } catch { /* ignore */ }
//   // const user = await User.findOne({ username, accountStatus: "active" })
//   // NAYA
// const user = await User.findOne({ 
//   username, 
//   accountStatus: "active",
//   role: { $ne: "super_admin" }
// })
//     .select("fullName username avatar coverPhoto bio designation businessCategory location followersCount followingCount isVerifiedBadge isPrivate");

//   if (!user) return next(new AppError("User not found.", 404));

//  const currentUserId = req.user?._id || null;

//  const followRecord = currentUserId
//   ? await Follow.findOne({ follower: currentUserId, following: user._id })
//   : null;

//   const isFollowing = followRecord?.status === "accepted";
//   const isPending   = followRecord?.status === "pending";

//   let posts = [];
//  if (!user.isPrivate || isFollowing || (currentUserId && user._id.equals(currentUserId))) {
//     posts = await Post.find({
//       author:    user._id,
//       isDraft:   false,
//       isDeleted: false,
//       visibility: "public",
//     })
//       .select("type media caption likesCount commentsCount viewsCount commentsDisabled likesHidden createdAt")
//       .sort({ createdAt: -1 })
//       .limit(30)
//       .lean();
//   }

//   try {
//     const cacheData = { user: { ...user.toObject(), isFollowing, isPending, postsCount: posts.length }, posts };
//     await redis.set(profileCacheKey, JSON.stringify(cacheData), { ex: 30 });
//   } catch { /* ignore */ }
//   return res.status(200).json({
//     success:   true,
//     user:      { ...user.toObject(), isFollowing, isPending, postsCount: posts.length },
//     posts,
//   });
// });



// explore.controller.js — COMPLETE REWRITE

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError      from "../../utils/AppError.js";
import Post          from "../../models/post.model.js";
import User          from "../../models/user.model.js";
import Follow        from "../../models/follow.model.js";
import redis         from "../../config/redis.js";

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

const EXPLORE_CACHE_TTL  = 60;          // seconds
const PROFILE_CACHE_TTL  = 30;          // seconds
const ALLOWED_TYPES      = new Set(["image", "reel", "text"]);
const MAX_LIMIT          = 50;
const OVERSAMPLE_BUFFER  = 20;          // extra docs to fetch so filtering never under-delivers

// ─────────────────────────────────────────────
//  Helper — reusable author populate options
// ─────────────────────────────────────────────

const AUTHOR_SELECT =
  "username fullName avatar isVerifiedBadge accountStatus role";

// ─────────────────────────────────────────────
//  Helper — filter hidden authors (deactivated / super_admin)
// ─────────────────────────────────────────────

function isVisibleAuthor(post) {
  return (
    post.author != null &&
    post.author.accountStatus !== "deactivated" &&
    post.author.role         !== "super_admin"
  );
}

// ─────────────────────────────────────────────
//  Helper — paginate-after-filter
//  Fetches (limit + OVERSAMPLE_BUFFER) docs, filters, then slices to exact limit.
//  Falls back to a second DB pass if the first sample was still not enough.
// ─────────────────────────────────────────────

async function fetchFilteredPage({ filter, sort, select, limit, populate }) {
  const fetchSize = limit + OVERSAMPLE_BUFFER;

  const raw = await Post.find(filter)
    .sort(sort)
    .limit(fetchSize)
    .populate(populate)
    .select(select)
    .lean();

  const filtered = raw.filter(isVisibleAuthor);

  // Happy path — got enough
  if (filtered.length >= limit + 1 || raw.length < fetchSize) {
    // raw.length < fetchSize means DB has no more docs — no second pass needed
    const hasMore    = filtered.length > limit;
    const finalPosts = hasMore ? filtered.slice(0, limit) : filtered;
    const nextCursor = hasMore
      ? finalPosts[finalPosts.length - 1]._id.toString()
      : null;
    return { posts: finalPosts, hasMore, nextCursor };
  }

  // Edge case — oversample was not enough (many hidden users in this page).
  // Do one more pass with a larger window (2x).
  const raw2 = await Post.find(filter)
    .sort(sort)
    .limit((limit + OVERSAMPLE_BUFFER) * 2)
    .populate(populate)
    .select(select)
    .lean();

  const filtered2  = raw2.filter(isVisibleAuthor);
  const hasMore    = filtered2.length > limit;
  const finalPosts = hasMore ? filtered2.slice(0, limit) : filtered2;
  const nextCursor = hasMore
    ? finalPosts[finalPosts.length - 1]._id.toString()
    : null;

  return { posts: finalPosts, hasMore, nextCursor };
}

// ─────────────────────────────────────────────
//  GET /api/v2/explore/posts
// ─────────────────────────────────────────────

export const getExplorePosts = asyncHandler(async (req, res, next) => {
  const limit  = Math.min(parseInt(req.query.limit) || 24, MAX_LIMIT);
  const cursor = req.query.cursor?.trim() || null;
  const type   = req.query.type?.trim()   || "all";

  if (type !== "all" && !ALLOWED_TYPES.has(type)) {
    return next(new AppError("Invalid type. Allowed: image, reel, text, all.", 400));
  }

  // ── Cache: only first page, only "all" type ─────────────────────────────
  const cacheKey     = `explore:posts:first:v2`;   // versioned key — busts old stale cache
  const useCache     = !cursor && type === "all";

  if (useCache) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.status(200).json({
          success:   true,
          message:   "Explore posts fetched successfully.",
          data:      cached,
          fromCache: true,
        });
      }
    } catch { /* Redis miss — fall through to DB */ }
  }

  // ── Build DB filter ──────────────────────────────────────────────────────
  const filter = {
    isDeleted:  false,
    isDraft:    false,
    visibility: "public",
  };

  if (type !== "all") filter.type = type;
  if (cursor)         filter._id  = { $lt: cursor };

  // ── Fetch with oversample + filter ──────────────────────────────────────
  const { posts, hasMore, nextCursor } = await fetchFilteredPage({
    filter,
    sort:      { _id: -1 },
    select:
      "type caption media likesCount commentsCount viewsCount savedCount " +
      "author createdAt hashtags isCarousel thumbnail likesHidden commentsDisabled",
    limit,
    populate: { path: "author", select: AUTHOR_SELECT },
  });

  const payload = { posts, nextCursor, hasMore, count: posts.length };

  // ── Cache first page ─────────────────────────────────────────────────────
  if (useCache) {
    try {
      await redis.set(cacheKey, JSON.stringify(payload), { ex: EXPLORE_CACHE_TTL });
    } catch { /* non-fatal */ }
  }

  return res.status(200).json({
    success: true,
    message: "Explore posts fetched successfully.",
    data:    payload,
  });
});

// ─────────────────────────────────────────────
//  GET /api/v2/explore/search
// ─────────────────────────────────────────────

export const searchPosts = asyncHandler(async (req, res, next) => {
  const q      = req.query.q?.trim();
  const limit  = Math.min(parseInt(req.query.limit) || 20, MAX_LIMIT);
  const cursor = req.query.cursor?.trim() || null;

  if (!q)           return next(new AppError("Search query required.", 400));
  if (q.length > 100) return next(new AppError("Search query too long.", 400));

  const filter = {
    isDeleted:  false,
    isDraft:    false,
    visibility: "public",
    $text:      { $search: q },
  };

  if (cursor) filter._id = { $lt: cursor };

  // Text search — use score sort; oversample manually (fetchFilteredPage uses _id sort)
  const fetchSize = limit + OVERSAMPLE_BUFFER;

  const raw = await Post.find(filter, { score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" }, _id: -1 })
    .limit(fetchSize)
    .populate({ path: "author", select: AUTHOR_SELECT })
    .select(
      "type caption media likesCount commentsCount viewsCount " +
      "author createdAt hashtags isCarousel thumbnail"
    )
    .lean();

  const filtered   = raw.filter(isVisibleAuthor);
  const hasMore    = filtered.length > limit;
  const finalPosts = hasMore ? filtered.slice(0, limit) : filtered;
  const nextCursor = hasMore
    ? finalPosts[finalPosts.length - 1]._id.toString()
    : null;

  return res.status(200).json({
    success: true,
    message: "Search results fetched.",
    data: {
      posts:      finalPosts,
      nextCursor,
      hasMore,
      count:      finalPosts.length,
      query:      q,
    },
  });
});

// ─────────────────────────────────────────────
//  GET /api/v2/explore/user/:username
// ─────────────────────────────────────────────

export const getPublicProfile = asyncHandler(async (req, res, next) => {
  const { username } = req.params;
  const postLimit    = Math.min(parseInt(req.query.postLimit) || 18, MAX_LIMIT);
  const postCursor   = req.query.postCursor?.trim() || null;

  // ── Cache: only first page, no cursor ───────────────────────────────────
  const profileCacheKey = `profile:${username}:v2`;
  const useCache        = !postCursor;

  if (useCache) {
    try {
      const cached = await redis.get(profileCacheKey);
      if (cached) {
        return res.status(200).json({ success: true, ...cached, fromCache: true });
      }
    } catch { /* fall through */ }
  }

  // ── Fetch user ───────────────────────────────────────────────────────────
  const user = await User.findOne({
    username,
    accountStatus: "active",
    role:          { $ne: "super_admin" },
  }).select(
    "fullName username avatar coverPhoto bio designation businessCategory " +
    "location followersCount followingCount isVerifiedBadge isPrivate"
  );

  if (!user) return next(new AppError("User not found.", 404));

  // ── Follow status ────────────────────────────────────────────────────────
  const currentUserId  = req.user?._id || null;
  const followRecord   = currentUserId
    ? await Follow.findOne({ follower: currentUserId, following: user._id })
        .select("status")
        .lean()
    : null;

  const isFollowing = followRecord?.status === "accepted";
  const isPending   = followRecord?.status === "pending";

  // ── Posts — cursor-based pagination ─────────────────────────────────────
  let posts           = [];
  let hasMorePosts    = false;
  let nextPostCursor  = null;

  const canViewPosts =
    !user.isPrivate ||
    isFollowing ||
    (currentUserId && user._id.equals(currentUserId));

  if (canViewPosts) {
    const postFilter = {
      author:     user._id,
      isDraft:    false,
      isDeleted:  false,
      visibility: "public",
      ...(postCursor && { _id: { $lt: postCursor } }),
    };

    const rawPosts = await Post.find(postFilter)
      .select(
        "type media caption likesCount commentsCount viewsCount " +
        "commentsDisabled likesHidden createdAt"
      )
      .sort({ _id: -1 })
      .limit(postLimit + 1)
      .lean();

    hasMorePosts   = rawPosts.length > postLimit;
    posts          = hasMorePosts ? rawPosts.slice(0, postLimit) : rawPosts;
    nextPostCursor = hasMorePosts ? posts[posts.length - 1]._id.toString() : null;
  }

  const userPayload = {
    ...user.toObject(),
    isFollowing,
    isPending,
    postsCount: posts.length,
  };

  // ── Cache first page ─────────────────────────────────────────────────────
  if (useCache) {
    try {
      await redis.set(
        profileCacheKey,
        JSON.stringify({ user: userPayload, posts, hasMorePosts, nextPostCursor }),
        { ex: PROFILE_CACHE_TTL }
      );
    } catch { /* non-fatal */ }
  }

  return res.status(200).json({
    success:        true,
    user:           userPayload,
    posts,
    hasMorePosts,
    nextPostCursor,
  });
});