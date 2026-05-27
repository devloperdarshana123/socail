

import Post from "../../models/post.model.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../../helper/cloudinaryUpload.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import logger from "../../config/logger.js";
import Like from "../../models/like.model.js";
import AppError from "../../utils/AppError.js";
import PostView from "../../models/postView.model.js";
import Follow from "../../models/follow.model.js";
import Saved from "../../models/saved.model.js";
import User from "../../models/user.model.js";


import {
  getPostFeedCache,
  setPostFeedCache,
  invalidatePostFeedCache,
  isPostAlreadyViewed,
} from "../../utils/postCache.js";
const sanitizeMediaItem = (item, index) => ({
  url:          String(item.url          || ""),
  publicId:     String(item.publicId     || ""),
  resourceType: ["image", "video"].includes(item.resourceType) ? item.resourceType : "image",
  width:        Number(item.width)        || null,
  height:       Number(item.height)       || null,
  duration:     Number(item.duration)     || null,
  thumbnailUrl: item.thumbnailUrl ? String(item.thumbnailUrl) : null,
  format:       item.format       ? String(item.format)       : null,
  bytes:        Number(item.bytes)        || null,
  order:        index,
});

// ─────────────────────────────────────────────
//  CREATE POST
//  POST /api/v2/posts
// ─────────────────────────────────────────────
export const createPost = asyncHandler(async (req, res, next) => {
  const {
    caption          = "",
    visibility       = "public",
    type,
    commentsDisabled = false,
    likesHidden      = false,
    location,
    isDraft          = false,
    media            = [],
  } = req.body;

  const authorId = req.user._id;

  // ── Validation ──
  if (!["text", "image", "reel"].includes(type)) {
    return next(new AppError("Invalid post type.", 400));
  }
 if (!Boolean(isDraft)) {
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

  // ── Sanitize ──
  const sanitized = media.map(sanitizeMediaItem);


  // ── Parse location ──
  let locationData = null;
  if (location) {
    try {
      const parsed = typeof location === "string" ? JSON.parse(location) : location;
      if (parsed?.name?.trim()) {
        locationData = { name: parsed.name.trim() };
        if (parsed.lat && parsed.lng) {
          locationData.coordinates = {
            type:        "Point",
            coordinates: [parseFloat(parsed.lng), parseFloat(parsed.lat)],
          };
        }
      }
    } catch { /* invalid JSON — ignore */ }
  }

  // ── Create post ──
  const newPost = await Post.create({
    author:           authorId,
    type,
    caption:          caption.trim().slice(0, 2200),
    media:            sanitized,
    visibility,
    commentsDisabled: Boolean(commentsDisabled),
    likesHidden:      Boolean(likesHidden),
    isDraft:          Boolean(isDraft),
    ...(locationData && { location: locationData }),
  });

 const populated = await Post.getPostById(
  newPost._id,
  authorId,
  false,
  { allowDraft: Boolean(isDraft) },
);
if (!newPost.isDraft) {
  await User.findByIdAndUpdate(authorId, { $inc: { postsCount: 1 } });
}
if (!newPost.isDraft) {
    await invalidatePostFeedCache(authorId.toString());
  }
  logger.info("Post created", { postId: newPost._id, author: authorId, type });

  return res.status(201).json({
    success: true,
    message: "Post created successfully",
    post:    populated,
  });
});


export const getPost = asyncHandler(async (req, res) => {
  const post = await Post.getPostById(req.params.postId);
  if (!post) return res.status(404).json({ success: false, message: "Post not found" });

  // View tracking frontend recordView se hogi — getPost sirf data dega
  return res.status(200).json({ success: true, post });
});
export const getPostInteraction = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId     = req.user._id;

  // Run both checks in parallel — no sequential DB calls
  const [liked, saved] = await Promise.all([
    Like.hasLiked(userId, postId, "Post"),
    Saved.hasSaved(userId, postId),
  ]);

  return res.status(200).json({ success: true, liked, saved });
});

// ─────────────────────────────────────────────
//  GET FEED POSTS
//  GET /api/v2/posts/feed
// ─────────────────────────────────────────────
export const getFeedPosts = asyncHandler(async (req, res) => {
  if (!req.query.beforeId) {
    const cached = await getPostFeedCache(req.user._id.toString());
    if (cached) {
      return res.status(200).json({ ...cached, fromCache: true });
    }
  }
  const { beforeId } = req.query;
  const limit        = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const userId       = req.user._id;

  const follows   = await Follow.find({ follower: userId }).select("following").lean();
  const authorIds = [userId, ...follows.map((f) => f.following)];

  const { items, hasMore, nextCursor } = await Post.getFeedPosts(authorIds, { beforeId: beforeId || null, limit });

  const responseData = { success: true, posts: items, hasMore, nextCursor };
  if (!beforeId) await setPostFeedCache(userId.toString(), responseData);
  return res.status(200).json(responseData);
});
// ─────────────────────────────────────────────
//  GET USER POSTS (Profile Grid)
//  GET /api/v2/posts/user/:userId
// ─────────────────────────────────────────────
export const getUserPosts = asyncHandler(async (req, res) => {
  const { userId }   = req.params;
  const { beforeId } = req.query;
  const limit        = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
  const viewerId     = req.user._id.toString();

  const isOwner    = viewerId === userId;
  const isFollower = isOwner
    ? false
    : !!(await Follow.findOne({ follower: viewerId, following: userId }).lean());

  const { items, hasMore, nextCursor } = await Post.getUserPosts(
    userId, isFollower, isOwner, { beforeId: beforeId || null, limit }
  );

  return res.status(200).json({ success: true, data: items, hasMore, nextCursor });
});

// ─────────────────────────────────────────────
//  DELETE POST
//  DELETE /api/v2/posts/:postId
// ─────────────────────────────────────────────
export const deletePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const authorId   = req.user._id;

  const post = await Post.findOne({ _id: postId, author: authorId, isDeleted: false });
  if (!post) {
    return res.status(404).json({ success: false, message: "Post not found" });
  }

  // Cloudinary se media delete karo
  for (const item of post.media) {
    await deleteFromCloudinary(item.publicId, item.resourceType).catch((err) => {
      logger.warn("Cloudinary delete failed", { publicId: item.publicId, error: err.message });
    });
  }

  await Post.softDelete(postId, authorId);


await User.findOneAndUpdate(
  { _id: authorId, postsCount: { $gt: 0 } },
  { $inc: { postsCount: -1 } }
);

await invalidatePostFeedCache(authorId.toString());
  logger.info("Post deleted", { postId, author: authorId });

  return res.status(200).json({ success: true, message: "Post deleted successfully" });
});



// ─────────────────────────────────────────────
//  GET DRAFT POSTS
//  GET /api/v2/posts/drafts
// ─────────────────────────────────────────────
export const recordView = asyncHandler(async (req, res) => {
  const { postId }               = req.params;
  const { source = "modal", duration = 0 } = req.body;
  const userId                   = req.user._id;

  // ── 1. Post fetch — author check ──
  const post = await Post.findById(postId).select("author viewsCount").lean();
  if (!post) return res.status(404).json({ success: false, message: "Post not found" });

  // ── 2. Owner ka view count nahi ──
  if (post.author.toString() === userId.toString()) {
    return res.status(200).json({ success: true, skipped: true, reason: "owner" });
  }
  // Redis dedup — 24h mein ek baar hi DB write
  const alreadySeen = await isPostAlreadyViewed(postId, userId.toString());
  if (alreadySeen) {
    return res.status(200).json({ success: true, recorded: false });
  }

  // ── 3. Valid source check ──
  const validSources = ["feed", "explore", "profile", "direct", "modal"];
  const safeSource   = validSources.includes(source) ? source : "modal";

  // ── 4. Device detect ──
  const ua     = req.headers["user-agent"] || "";
  const device = /mobile/i.test(ua) ? "mobile" : /tablet|ipad/i.test(ua) ? "tablet" : "desktop";

  // ── 5. Try insert — duplicate silently ignore ──
  // ── 5. Delegate to model static — single source of truth ──
  const { isNewView } = await PostView.recordView({
    user:     userId,
    post:     postId,
    source:   safeSource,
    duration: Number(duration) || 0,
    device,
  });

  if (isNewView) {
    logger.info("View recorded", { postId, userId, source: safeSource, device });
  }

  return res.status(200).json({ success: true, recorded: isNewView });
   
 
});

export const getDraftPosts = asyncHandler(async (req, res) => {
  const authorId = req.user._id;

  const drafts = await Post.find({
    author:    authorId,
    isDraft:   true,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .select("media type caption likesCount commentsCount viewsCount createdAt isDraft");

  return res.status(200).json({
    success: true,
    posts:   drafts,
  });
});

// ─────────────────────────────────────────────
//  PUBLISH DRAFT
//  PATCH /api/v2/posts/:postId/publish
// ─────────────────────────────────────────────
export const publishDraft = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const authorId   = req.user._id;

  const post = await Post.findOne({
    _id:       postId,
    author:    authorId,
    isDraft:   true,
    isDeleted: false,
  });

  if (!post) {
    return res.status(404).json({ success: false, message: "Draft not found" });
  }

  post.isDraft = false;
  await post.save();

 const populated = await Post.getPostById(post._id, authorId, false);

 await User.findByIdAndUpdate(authorId, { $inc: { postsCount: 1 } });
 await invalidatePostFeedCache(authorId.toString());
  logger.info("Draft published", { postId, author: authorId });

  return res.status(200).json({
    success: true,
    message: "Post published successfully",
    post:    populated,
  });
});

export const updatePost = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const { caption, isDraft } = req.body;

  const post = await Post.findOne({ _id: postId, author: req.user._id });
  if (!post) return next(new AppError("Post not found.", 404));

  if (caption !== undefined) {
  if (caption.length > 2200) {
    return next(new AppError("Caption cannot exceed 2200 characters.", 400));
  }
  post.caption = caption.trim();
}
  if (isDraft !== undefined) post.isDraft = isDraft === true || isDraft === "true";

  await post.save();

  return res.status(200).json({
    success: true,
    message: "Post updated.",
    post,
  });
});