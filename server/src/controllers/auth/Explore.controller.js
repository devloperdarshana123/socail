


import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import Post from "../../models/post.model.js";
import User from "../../models/user.model.js";
import Follow from "../../models/follow.model.js";
// ─────────────────────────────────────────────
//  GET /api/v2/explore/posts
// ─────────────────────────────────────────────
export const getExplorePosts = asyncHandler(async (req, res, next) => {
  const limit  = Math.min(parseInt(req.query.limit) || 24, 50);
  const cursor = req.query.cursor || null;
  const type   = req.query.type   || "all";

  const filter = {
    isDeleted:  false,
    isDraft:    false,
    visibility: "public",
  };

  if (type !== "all") {
    if (!["image", "reel", "text"].includes(type)) {
      return next(new AppError("Invalid type. Use image, reel, text or all.", 400));
    }
    filter.type = type;
  }

  if (cursor) filter._id = { $lt: cursor };

  const posts = await Post.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate({
      path: "author",
      select: "username fullName avatar isVerifiedBadge accountStatus",
    })
    .select(
      "type caption media likesCount commentsCount viewsCount savedCount " +
      "author createdAt hashtags isCarousel thumbnail likesHidden commentsDisabled"
    )
    .lean();

  // Deactivated user ki posts hide karo
  const filtered = posts.filter(
    (post) => post.author && post.author.accountStatus !== "deactivated"
  );

  const hasMore    = filtered.length > limit;
  const finalPosts = hasMore ? filtered.slice(0, limit) : filtered;
  const nextCursor = hasMore
    ? finalPosts[finalPosts.length - 1]._id.toString()
    : null;

  res.status(200).json({
    success: true,
    message: "Explore posts fetched successfully.",
    data: {
      posts:      finalPosts,
      nextCursor,
      hasMore,
      count:      finalPosts.length,
    },
  });
});

// ─────────────────────────────────────────────
//  GET /api/v2/explore/search
// ─────────────────────────────────────────────
export const searchPosts = asyncHandler(async (req, res, next) => {
  const q      = req.query.q?.trim();
  const limit  = Math.min(parseInt(req.query.limit) || 20, 50);
  const cursor = req.query.cursor || null;

  if (!q) return next(new AppError("Search query required.", 400));
if (q.length > 100) return next(new AppError("Search query too long.", 400));

  const filter = {
    isDeleted:  false,
    isDraft:    false,
    visibility: "public",
    $text:      { $search: q },
  };

  if (cursor) filter._id = { $lt: cursor };

  const posts = await Post.find(filter, { score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" }, _id: -1 })
    .limit(limit + 1)
    .populate({
      path: "author",
      select: "username fullName avatar isVerifiedBadge accountStatus",
    })
    .select(
      "type caption media likesCount commentsCount viewsCount " +
      "author createdAt hashtags isCarousel thumbnail"
    )
    .lean();

  // Deactivated user ki posts hide karo
  const filtered = posts.filter(
    (post) => post.author && post.author.accountStatus !== "deactivated"
  );

  const hasMore    = filtered.length > limit;
  const finalPosts = hasMore ? filtered.slice(0, limit) : filtered;
  const nextCursor = hasMore
    ? finalPosts[finalPosts.length - 1]._id.toString()
    : null;

  res.status(200).json({
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
//  Public profile fetch karo
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
//  GET /api/v2/explore/user/:username
// ─────────────────────────────────────────────
export const getPublicProfile = asyncHandler(async (req, res, next) => {
  const { username } = req.params;

  const user = await User.findOne({ username, accountStatus: "active" })
    .select("fullName username avatar coverPhoto bio designation businessCategory location followersCount followingCount isVerifiedBadge isPrivate");

  if (!user) return next(new AppError("User not found.", 404));

 const currentUserId = req.user?._id || null;

 const followRecord = currentUserId
  ? await Follow.findOne({ follower: currentUserId, following: user._id })
  : null;

  const isFollowing = followRecord?.status === "accepted";
  const isPending   = followRecord?.status === "pending";

  let posts = [];
 if (!user.isPrivate || isFollowing || (currentUserId && user._id.equals(currentUserId))) {
    posts = await Post.find({
      author:    user._id,
      isDraft:   false,
      isDeleted: { $ne: true },
      visibility: "public",
    })
      .select("type media caption likesCount commentsCount viewsCount commentsDisabled likesHidden createdAt")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
  }

  return res.status(200).json({
    success:   true,
    user:      { ...user.toObject(), isFollowing, isPending, postsCount: posts.length },
    posts,
  });
});