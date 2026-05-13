

import Post from "../../models/post.model.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../../helper/cloudinaryUpload.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import logger from "../../config/logger.js";
import Like from "../../models/like.model.js";
import PostView from "../../models/postView.model.js";
// ─────────────────────────────────────────────
//  CREATE POST
//  POST /api/v2/posts
// ─────────────────────────────────────────────
export const createPost = asyncHandler(async (req, res) => {
  const {
    caption = "",
    visibility = "public",
    type,
    commentsDisabled,
    likesHidden,
    location,
    isDraft,
  } = req.body;

  const files    = req.files || [];
  const authorId = req.user._id;

  for (const file of files) {
  if (file.size > 10 * 1024 * 1024) {
    return res.status(400).json({
      success: false,
      message: `File "${file.originalname}" 10MB  is max size chosse small size .`,
    });
  }
}
  // ── Validation ──
  if (!type || !["text", "image", "reel"].includes(type)) {
    return res.status(400).json({ success: false, message: "Invalid post type" });
  }
  if (type === "text" && files.length > 0) {
    return res.status(400).json({ success: false, message: "Text post cannot have media" });
  }
  if (type === "image" && files.length === 0) {
    return res.status(400).json({ success: false, message: "Image post requires at least one image" });
  }
  if (type === "reel" && files.length !== 1) {
    return res.status(400).json({ success: false, message: "Reel must have exactly one video" });
  }
  if (type === "reel" && !files[0]?.mimetype?.startsWith("video/")) {
    return res.status(400).json({ success: false, message: "Reel must be a video file" });
  }

  // ── Upload media to Cloudinary ──
  const mediaItems = [];

  for (let i = 0; i < files.length; i++) {
    const file    = files[i];
    const isVideo = file.mimetype.startsWith("video/");

    try {
      const result = await uploadToCloudinary(file.buffer, {
        folder:         isVideo ? "erovians/reels" : "erovians/posts",
        resourceType:   isVideo ? "video" : "image",
        transformation: isVideo ? [] : [{ quality: "auto:good", fetch_format: "auto" }],
        eager:          isVideo ? [{ format: "jpg", transformation: [{ start_offset: "0" }] }] : [],
        eager_async:    true,
      });

      mediaItems.push({
        url:          result.secure_url,
        publicId:     result.public_id,
        resourceType: isVideo ? "video" : "image",
        width:        result.width    || null,
        height:       result.height   || null,
        duration:     result.duration || null,
        thumbnailUrl: result.eager?.[0]?.secure_url || null,
        format:       result.format   || null,
        bytes:        result.bytes    || null,
        order:        i,
      });
    } catch (uploadError) {
      // Rollback — jo already upload ho gaye unhe delete karo
      for (const item of mediaItems) {
        await deleteFromCloudinary(item.publicId, item.resourceType).catch(() => {});
      }
      logger.error("Cloudinary upload failed", {
         error: uploadError.message ,
         stack: uploadError.stack 
         });
         console.error("CLOUDINARY FULL ERROR:", uploadError);
      return res.status(500).json({ success: false, message: "Media upload failed. Please try again." });
    }
  }

  // ── Parse location ──
  // Sirf tab save karo jab user ne actually location di ho
  let locationData = undefined;

  if (location) {
    try {
      const parsed   = typeof location === "string" ? JSON.parse(location) : location;
      const hasName   = parsed.name?.trim();
      const hasCoords = parsed.lat && parsed.lng;

      if (hasName || hasCoords) {
        locationData = {};
        if (hasName)   locationData.name = parsed.name.trim();
        if (hasCoords) locationData.coordinates = {
          type:        "Point",
          coordinates: [parseFloat(parsed.lng), parseFloat(parsed.lat)],
        };
      }
    } catch {
      locationData = undefined; // Invalid JSON — silently ignore
    }
  }

  // ── Create Post ──
  const newPost = await Post.create({
    author:           authorId,
    type,
    caption:          caption.trim(),
    media:            mediaItems,
    visibility,
    commentsDisabled: commentsDisabled === "true" || commentsDisabled === true,
    likesHidden:      likesHidden === "true"      || likesHidden === true,
    isDraft:          isDraft === "true"           || isDraft === true || false,
    ...(locationData !== undefined && { location: locationData }),
  });

  // ── Populate & return ──
  const populated = await Post.getPostById(newPost._id);

  logger.info("Post created", { postId: newPost._id, author: authorId, type });

  return res.status(201).json({
    success: true,
    message: "Post created successfully",
    post:    populated,
  });
});

// ─────────────────────────────────────────────
//  GET SINGLE POST
//  GET /api/v2/posts/:postId
// ─────────────────────────────────────────────
export const getPost = asyncHandler(async (req, res) => {
  const post = await Post.getPostById(req.params.postId);

  if (!post) {
    return res.status(404).json({ success: false, message: "Post not found" });
  }

  // ✅ Sirf ek baar view count badhe
  try {
    await PostView.create({
      user: req.user._id,
      post: req.params.postId,
    });
    // Create successful — pehli baar dekha, count badhaao
    await Post.updateCount(req.params.postId, "viewsCount", 1);
  } catch (err) {
    // Duplicate key error — already dekha hai, count mat badhaao
    if (err.code !== 11000) {
      throw err; // Koi aur error hai toh throw karo
    }
  }

  return res.status(200).json({ success: true, post });
});



export const getPostInteraction = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  const liked = await Like.hasLiked(userId, postId, "Post");

  return res.status(200).json({
    success: true,
    liked,
  });
});

// ─────────────────────────────────────────────
//  GET FEED POSTS
//  GET /api/v2/posts/feed
// ─────────────────────────────────────────────
export const getFeedPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const userId = req.user._id;

  const user      = await req.user.populate("following");
  const authorIds = [userId, ...user.following.map((f) => f._id)];

  const posts = await Post.getFeedPosts(authorIds, Number(page), Number(limit));

  return res.status(200).json({
    success: true,
    posts,
    page:    Number(page),
    hasMore: posts.length === Number(limit),
  });
});

// ─────────────────────────────────────────────
//  GET USER POSTS (Profile Grid)
//  GET /api/v2/posts/user/:userId
// ─────────────────────────────────────────────
export const getUserPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 12 } = req.query;
  const { userId }  = req.params;
  const viewerId    = req.user._id;

  const isFollower  = req.user.following?.includes(userId) || viewerId.toString() === userId;
  const posts       = await Post.getUserPosts(userId, isFollower, Number(page), Number(limit));

  return res.status(200).json({
    success: true,
    posts,
    page:    Number(page),
    hasMore: posts.length === Number(limit),
  });
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

  logger.info("Post deleted", { postId, author: authorId });

  return res.status(200).json({ success: true, message: "Post deleted successfully" });
});

export const recordView = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  try {
    await PostView.create({ user: req.user._id, post: postId });
    await Post.updateCount(postId, "viewsCount", 1);
  } catch (err) {
    if (err.code !== 11000) throw err; // Duplicate — ignore
  }

  return res.status(200).json({ success: true });
});

// ─────────────────────────────────────────────
//  GET DRAFT POSTS
//  GET /api/v2/posts/drafts
// ─────────────────────────────────────────────
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

  const populated = await Post.getPostById(post._id);

  logger.info("Draft published", { postId, author: authorId });

  return res.status(200).json({
    success: true,
    message: "Post published successfully",
    post:    populated,
  });
});