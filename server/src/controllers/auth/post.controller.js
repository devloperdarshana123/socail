

import Post from "../../models/post.model.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../../helper/cloudinaryUpload.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import logger from "../../config/logger.js";
import Like from "../../models/like.model.js";
import AppError from "../../utils/AppError.js";
import PostView from "../../models/postView.model.js";

// ─────────────────────────────────────────────
//  CREATE POST
//  POST /api/v2/posts
// ─────────────────────────────────────────────
// export const createPost = asyncHandler(async (req, res) => {
//   const {
//     caption = "",
//     visibility = "public",
//     type,
//     commentsDisabled,
//     likesHidden,
//     location,
//     isDraft,
//   } = req.body;

//   const files    = req.files || [];
//   const authorId = req.user._id;

//   for (const file of files) {
//   if (file.size > 10 * 1024 * 1024) {
//     return res.status(400).json({
//       success: false,
//       message: `File "${file.originalname}" 10MB  is max size chosse small size .`,
//     });
//   }
// }
//   // ── Validation ──
//   if (!type || !["text", "image", "reel"].includes(type)) {
//     return res.status(400).json({ success: false, message: "Invalid post type" });
//   }
//   if (type === "text" && files.length > 0) {
//     return res.status(400).json({ success: false, message: "Text post cannot have media" });
//   }
//   if (type === "image" && files.length === 0) {
//     return res.status(400).json({ success: false, message: "Image post requires at least one image" });
//   }
//   if (type === "reel" && files.length !== 1) {
//     return res.status(400).json({ success: false, message: "Reel must have exactly one video" });
//   }
//   if (type === "reel" && !files[0]?.mimetype?.startsWith("video/")) {
//     return res.status(400).json({ success: false, message: "Reel must be a video file" });
//   }

//   // ── Upload media to Cloudinary ──
//   const mediaItems = [];

//   for (let i = 0; i < files.length; i++) {
//     const file    = files[i];
//     const isVideo = file.mimetype.startsWith("video/");

//     try {
//       const result = await uploadToCloudinary(file.buffer, {
//         folder:         isVideo ? "erovians/reels" : "erovians/posts",
//         resourceType:   isVideo ? "video" : "image",
//         transformation: isVideo ? [] : [{ quality: "auto:good", fetch_format: "auto" }],
//         eager:          isVideo ? [{ format: "jpg", transformation: [{ start_offset: "0" }] }] : [],
//         eager_async:    true,
//       });

//       mediaItems.push({
//         url:          result.secure_url,
//         publicId:     result.public_id,
//         resourceType: isVideo ? "video" : "image",
//         width:        result.width    || null,
//         height:       result.height   || null,
//         duration:     result.duration || null,
//         thumbnailUrl: result.eager?.[0]?.secure_url || null,
//         format:       result.format   || null,
//         bytes:        result.bytes    || null,
//         order:        i,
//       });
//     } catch (uploadError) {
//       // Rollback — jo already upload ho gaye unhe delete karo
//       for (const item of mediaItems) {
//         await deleteFromCloudinary(item.publicId, item.resourceType).catch(() => {});
//       }
//       logger.error("Cloudinary upload failed", {
//          error: uploadError.message ,
//          stack: uploadError.stack 
//          });
//       return res.status(500).json({ success: false, message: "Media upload failed. Please try again." });
//     }
//   }

//   // ── Parse location ──
//   // Sirf tab save karo jab user ne actually location di ho
//   let locationData = undefined;

//   if (location) {
//     try {
//       const parsed   = typeof location === "string" ? JSON.parse(location) : location;
//       const hasName   = parsed.name?.trim();
//       const hasCoords = parsed.lat && parsed.lng;

//       if (hasName || hasCoords) {
//         locationData = {};
//         if (hasName)   locationData.name = parsed.name.trim();
//         if (hasCoords) locationData.coordinates = {
//           type:        "Point",
//           coordinates: [parseFloat(parsed.lng), parseFloat(parsed.lat)],
//         };
//       }
//     } catch {
//       locationData = undefined; // Invalid JSON — silently ignore
//     }
//   }

//   // ── Create Post ──
//   const newPost = await Post.create({
//     author:           authorId,
//     type,
//     caption:          caption.trim(),
//     media:            mediaItems,
//     visibility,
//     commentsDisabled: commentsDisabled === "true" || commentsDisabled === true,
//     likesHidden:      likesHidden === "true"      || likesHidden === true,
//     isDraft:          isDraft === "true"           || isDraft === true || false,
//     ...(locationData !== undefined && { location: locationData }),
//   });

//   // ── Populate & return ──
//   const populated = await Post.getPostById(newPost._id);

//   logger.info("Post created", { postId: newPost._id, author: authorId, type });

//   return res.status(201).json({
//     success: true,
//     message: "Post created successfully",
//     post:    populated,
//   });
// });


// export const createPost = asyncHandler(async (req, res) => {
//   const {
//     caption = "",
//     visibility = "public",
//     type,
//     commentsDisabled,
//     likesHidden,
//     location,
//     isDraft,
//     media,           // ← Now receiving array of media objects
//   } = req.body;

//   const authorId = req.user._id;

//   // Validation
//   if (!["text", "image", "reel"].includes(type)) {
//     return res.status(400).json({ success: false, message: "Invalid post type" });
//   }

//   if ((type === "image" && (!media || media.length === 0)) ||
//       (type === "reel" && (!media || media.length !== 1)) ||
//       (type === "text" && media && media.length > 0)) {
//     return res.status(400).json({ success: false, message: "Invalid media for post type" });
//   }

//   // Optional: Verify public_ids if you want extra security

//   let locationData = null;
//   if (location) {
//     try {
//       locationData = typeof location === "string" ? JSON.parse(location) : location;
//     } catch {}
//   }

//   const newPost = await Post.create({
//     author: authorId,
//     type,
//     caption: caption.trim(),
//     media: media || [],           // ← Directly save what frontend sends
//     visibility,
//     commentsDisabled: !!commentsDisabled,
//     likesHidden: !!likesHidden,
//     isDraft: !!isDraft,
//     ...(locationData && { location: locationData }),
//   });

//   const populated = await Post.getPostById(newPost._id);

//   return res.status(201).json({
//     success: true,
//     message: "Post created successfully",
//     post: populated,
//   });
// });
//  GET SINGLE POST
//  GET /api/v2/posts/:postId
// ─────────────────────────────────────────────

// ─── Security helpers ────────────────────────────────────────────────────────


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

  const populated = await Post.getPostById(newPost._id);

  logger.info("Post created", { postId: newPost._id, author: authorId, type });

  return res.status(201).json({
    success: true,
    message: "Post created successfully",
    post:    populated,
  });
});
// export const getPost = asyncHandler(async (req, res) => {
//   const post = await Post.getPostById(req.params.postId);

//   if (!post) {
//     return res.status(404).json({ success: false, message: "Post not found" });
//   }

//   // ✅ Sirf ek baar view count badhe
//   try {
//     await PostView.create({
//       user: req.user._id,
//       post: req.params.postId,
//     });
//     // Create successful — pehli baar dekha, count badhaao
//     await Post.updateCount(req.params.postId, "viewsCount", 1);
//   } catch (err) {
//     // Duplicate key error — already dekha hai, count mat badhaao
//     if (err.code !== 11000) {
//       throw err; // Koi aur error hai toh throw karo
//     }
//   }

//   return res.status(200).json({ success: true, post });
// });


export const getPost = asyncHandler(async (req, res) => {
  const post = await Post.getPostById(req.params.postId);
  if (!post) return res.status(404).json({ success: false, message: "Post not found" });

  // View tracking frontend recordView se hogi — getPost sirf data dega
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
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
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
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
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

// export const recordView = asyncHandler(async (req, res) => {
//   const { postId } = req.params;

//   try {
//     await PostView.create({ user: req.user._id, post: postId });
//     await Post.updateCount(postId, "viewsCount", 1);
//   } catch (err) {
//     if (err.code !== 11000) throw err; // Duplicate — ignore
//   }

//   return res.status(200).json({ success: true });
// });

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

  // ── 3. Valid source check ──
  const validSources = ["feed", "explore", "profile", "direct", "modal"];
  const safeSource   = validSources.includes(source) ? source : "modal";

  // ── 4. Device detect ──
  const ua     = req.headers["user-agent"] || "";
  const device = /mobile/i.test(ua) ? "mobile" : /tablet|ipad/i.test(ua) ? "tablet" : "desktop";

  // ── 5. Try insert — duplicate silently ignore ──
  try {
    await PostView.create({
      user:     userId,
      post:     postId,
      viewedAt: new Date(),
      source:   safeSource,
      duration: Math.min(Math.max(0, Number(duration) || 0), 3600), // max 1 hour
      device,
    });

    // ── 6. Atomic increment — race condition safe ──
    await Post.findByIdAndUpdate(postId, { $inc: { viewsCount: 1 } });

    logger.info("View recorded", { postId, userId, source: safeSource, device });

    return res.status(200).json({ success: true, recorded: true });

  } catch (err) {
    if (err.code === 11000) {
      // Already viewed — silently return
      return res.status(200).json({ success: true, recorded: false, reason: "already_viewed" });
    }
    throw err;
  }
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

  const populated = await Post.getPostById(post._id);

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