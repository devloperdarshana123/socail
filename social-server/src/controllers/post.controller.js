
import Post from "../models/Post.model.js";
import SocialUser from "../models/User.model.js";
import Notification from "../models/Notification.model.js";
import cloudinary from "../config/cloudinary.js";
import { emitToUser } from "../socket.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Buffer se Cloudinary pe upload */
const uploadBuffer = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    stream.end(buffer);
  });

/** Cloudinary se file delete */
const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error("Cloudinary delete error:", err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Create Post
// ─────────────────────────────────────────────────────────────────────────────

export const createPost = async (req, res) => {
  try {
    const { caption, tags, visibility } = req.body;
    const files = req.files || [];

    // Validation
    if (!caption?.trim() && files.length === 0) {
      return res.status(400).json({ message: "Caption ya koi media zaroori hai" });
    }

    // Media upload
    const media = [];
    for (const file of files) {
      const isVideo     = file.mimetype.startsWith("video/");
      const resourceType = isVideo ? "video" : "image";

      const result = await uploadBuffer(file.buffer, {
        folder:        "social/posts",
        resource_type: resourceType,
        quality:       "auto",
        fetch_format:  "auto",
      });

      media.push({
        url:       result.secure_url,
        publicId:  result.public_id,
        mediaType: isVideo ? "video" : "image",
      });
    }

    // postType determine karo
    let postType = "text";
    if (media.length > 0) {
      const hasVideo = media.some((m) => m.mediaType === "video");
      const hasImage = media.some((m) => m.mediaType === "image");
      if (hasVideo && hasImage) postType = "mixed";
      else if (hasVideo) postType = "video";
      else postType = "image";
    }

    // Tags normalize karo
    const normalizedTags = tags
      ? (Array.isArray(tags) ? tags : tags.split(","))
          .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
          .filter(Boolean)
          .slice(0, 30)
      : [];

    const post = await Post.create({
      author:     req.user._id,
      caption:    caption?.trim() || "",
      media,
      postType,
      tags:       normalizedTags,
      visibility: visibility || "public",
    });

    await post.populate("author", "name username avatar");

    return res.status(201).json({ message: "Post ban gayi!", post });
  } catch (err) {
    console.error("createPost error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Get Single Post
// ─────────────────────────────────────────────────────────────────────────────

export const getPost = async (req, res) => {
  try {
    const post = await Post.findOne({
      _id:       req.params.postId,
      isDeleted: false,
    })
      .populate("author", "name username avatar")
      .populate("comments.user", "name username avatar")
      .populate("comments.replies.user", "name username avatar");

    if (!post) return res.status(404).json({ message: "Post nahi mili" });

    // Visibility check
    if (post.visibility === "only_me" && post.author._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Ye post private hai" });
    }

    // View count increment (non-blocking)
    Post.findByIdAndUpdate(post._id, { $inc: { views: 1 } }).exec();

    return res.json({ post });
  } catch (err) {
    console.error("getPost error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Feed
// ─────────────────────────────────────────────────────────────────────────────

export const getFeed = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const currentUser = await SocialUser.findById(req.user._id).select("following");

    // Apni posts + following ki posts
    const authorIds = [req.user._id, ...currentUser.following];

    const posts = await Post.getFeed(authorIds, {
      page:  parseInt(page),
      limit: parseInt(limit),
    });

    const normalizedPosts = posts.map((p) => ({
  ...p,
  image: p.media?.find((m) => m.mediaType === "image")?.url || "",
  video: p.media?.find((m) => m.mediaType === "video")?.url || "",
}));
return res.json({ posts: normalizedPosts, page: parseInt(page) });
  } catch (err) {
    console.error("getFeed error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Explore (public posts, random/trending)
// ─────────────────────────────────────────────────────────────────────────────

export const explorePosts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Blocked users ki posts exclude karo
    const currentUser = await SocialUser.findById(req.user._id).select("blockedUsers following");
    const exclude     = [...(currentUser.blockedUsers || [])];

    const posts = await Post.find({
      isDeleted:   false,
      isSuspended: false,
      visibility:  "public",
      author:      { $nin: exclude },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("author", "name username avatar")
      .lean();

   const normalizedPosts = posts.map((p) => ({
  ...p,
  image: p.media?.find((m) => m.mediaType === "image")?.url || "",
  video: p.media?.find((m) => m.mediaType === "video")?.url || "",
}));
return res.json({ posts: normalizedPosts, page: parseInt(page) });
  } catch (err) {
    console.error("explorePosts error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// User ke Posts
// ─────────────────────────────────────────────────────────────────────────────

export const getUserPosts = async (req, res) => {
  try {
    const { userId }           = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const isSelf = req.user._id.toString() === userId;

    const visibilityFilter = isSelf
      ? {}
      : { visibility: { $in: ["public", "followers"] } };

    const posts = await Post.find({
      author:      userId,
      isDeleted:   false,
      isSuspended: false,
      ...visibilityFilter,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("author", "name username avatar")
      .lean();

    const normalizedPosts = posts.map((p) => ({
  ...p,
  image: p.media?.find((m) => m.mediaType === "image")?.url || "",
  video: p.media?.find((m) => m.mediaType === "video")?.url || "",
}));
return res.json({ posts: normalizedPosts, page: parseInt(page) });
  } catch (err) {
    console.error("getUserPosts error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Delete Post
// ─────────────────────────────────────────────────────────────────────────────

export const deletePost = async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.postId, isDeleted: false });
    if (!post) return res.status(404).json({ message: "Post nahi mili" });

    const isOwner = post.author.toString() === req.user._id.toString();
    const isAdmin = ["admin", "super_admin"].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Is post ko delete karne ka permission nahi" });
    }

    // Cloudinary se media delete karo (background mein)
    Promise.all(
      post.media.map((m) => deleteFromCloudinary(m.publicId, m.mediaType === "video" ? "video" : "image"))
    ).catch(console.error);

    await post.softDelete();

    return res.json({ message: "Post delete ho gayi" });
  } catch (err) {
    console.error("deletePost error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Like / Unlike
// ─────────────────────────────────────────────────────────────────────────────

export const toggleLike = async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.postId, isDeleted: false });
    if (!post) return res.status(404).json({ message: "Post nahi mili" });

    const liked = await post.toggleLike(req.user._id);

    // Notification sirf like karte waqt
    if (liked && post.author.toString() !== req.user._id.toString()) {
      const notif = await Notification.createUnique({
        recipient: post.author,
        sender:    req.user._id,
        type:      "like",
        post:      post._id,
      });
      if (notif) emitToUser(post.author.toString(), "notification", notif);
    }

    return res.json({ liked, likesCount: post.likes.length });
  } catch (err) {
    console.error("toggleLike error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Save / Unsave Post
// ─────────────────────────────────────────────────────────────────────────────

export const toggleSave = async (req, res) => {
  try {
    const post    = await Post.findOne({ _id: req.params.postId, isDeleted: false });
    if (!post) return res.status(404).json({ message: "Post nahi mili" });

    const userId  = req.user._id;
    const isSaved = post.savedBy.some((id) => id.toString() === userId.toString());

    if (isSaved) {
      post.savedBy.pull(userId);
    } else {
      post.savedBy.addToSet(userId);
    }

    await post.save({ validateBeforeSave: false });

    return res.json({ saved: !isSaved });
  } catch (err) {
    console.error("toggleSave error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Saved Posts
// ─────────────────────────────────────────────────────────────────────────────

export const getSavedPosts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const posts = await Post.find({
      savedBy:     req.user._id,
      isDeleted:   false,
      isSuspended: false,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("author", "name username avatar")
      .lean();

 const normalizedPosts = posts.map((p) => ({
  ...p,
  image: p.media?.find((m) => m.mediaType === "image")?.url || "",
  video: p.media?.find((m) => m.mediaType === "video")?.url || "",
}));
return res.json({ posts: normalizedPosts, page: parseInt(page) });
  } catch (err) {
    console.error("getSavedPosts error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Add Comment
// ─────────────────────────────────────────────────────────────────────────────

export const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Comment text do" });

    const post = await Post.findOne({ _id: req.params.postId, isDeleted: false });
    if (!post) return res.status(404).json({ message: "Post nahi mili" });

    const comment = await post.addComment(req.user._id, text.trim());

    // Notification
    if (post.author.toString() !== req.user._id.toString()) {
      const notif = await Notification.createUnique({
        recipient: post.author,
        sender:    req.user._id,
        type:      "comment",
        post:      post._id,
        comment:   comment._id,
        text:      text.slice(0, 100),
      });
      if (notif) emitToUser(post.author.toString(), "notification", notif);
    }

    await post.populate("comments.user", "name username avatar");
    const populatedComment = post.comments.id(comment._id);

    return res.status(201).json({ message: "Comment add ho gaya", comment: populatedComment });
  } catch (err) {
    console.error("addComment error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Delete Comment
// ─────────────────────────────────────────────────────────────────────────────

export const deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;

    const post = await Post.findOne({ _id: postId, isDeleted: false });
    if (!post) return res.status(404).json({ message: "Post nahi mili" });

    const comment = post.comments.id(commentId);
    if (!comment || comment.isDeleted) {
      return res.status(404).json({ message: "Comment nahi mila" });
    }

    const isOwner     = comment.user.toString() === req.user._id.toString();
    const isPostOwner = post.author.toString() === req.user._id.toString();
    const isAdmin     = ["admin", "super_admin"].includes(req.user.role);

    if (!isOwner && !isPostOwner && !isAdmin) {
      return res.status(403).json({ message: "Delete karne ka permission nahi" });
    }

    await post.deleteComment(commentId, isOwner ? req.user._id : comment.user);

    return res.json({ message: "Comment delete ho gaya" });
  } catch (err) {
    console.error("deleteComment error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Add Reply
// ─────────────────────────────────────────────────────────────────────────────

export const addReply = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text }              = req.body;

    if (!text?.trim()) return res.status(400).json({ message: "Reply text do" });

    const post = await Post.findOne({ _id: postId, isDeleted: false });
    if (!post) return res.status(404).json({ message: "Post nahi mili" });

    const comment = post.comments.id(commentId);
    if (!comment || comment.isDeleted) {
      return res.status(404).json({ message: "Comment nahi mila" });
    }

    comment.replies.push({ user: req.user._id, text: text.trim() });
    await post.save({ validateBeforeSave: false });

    const newReply = comment.replies[comment.replies.length - 1];

    // Notification to comment owner
    if (comment.user.toString() !== req.user._id.toString()) {
      const notif = await Notification.createUnique({
        recipient: comment.user,
        sender:    req.user._id,
        type:      "reply",
        post:      post._id,
        comment:   comment._id,
        text:      text.slice(0, 100),
      });
      if (notif) emitToUser(comment.user.toString(), "notification", notif);
    }

    return res.status(201).json({ message: "Reply add ho gayi", reply: newReply });
  } catch (err) {
    console.error("addReply error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Like Comment
// ─────────────────────────────────────────────────────────────────────────────

export const toggleCommentLike = async (req, res) => {
  try {
    const { postId, commentId } = req.params;

    const post = await Post.findOne({ _id: postId, isDeleted: false });
    if (!post) return res.status(404).json({ message: "Post nahi mili" });

    const comment = post.comments.id(commentId);
    if (!comment || comment.isDeleted) {
      return res.status(404).json({ message: "Comment nahi mila" });
    }

    const userId  = req.user._id;
    const liked   = comment.likes.some((id) => id.toString() === userId.toString());

    if (liked) {
      comment.likes.pull(userId);
    } else {
      comment.likes.addToSet(userId);

      if (comment.user.toString() !== userId.toString()) {
        const notif = await Notification.createUnique({
          recipient: comment.user,
          sender:    userId,
          type:      "comment_like",
          post:      post._id,
          comment:   comment._id,
        });
        if (notif) emitToUser(comment.user.toString(), "notification", notif);
      }
    }

    await post.save({ validateBeforeSave: false });

    return res.json({ liked: !liked, likesCount: comment.likes.length });
  } catch (err) {
    console.error("toggleCommentLike error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Search Posts by Tag
// ─────────────────────────────────────────────────────────────────────────────

export const searchByTag = async (req, res) => {
  try {
    const { tag, page = 1, limit = 20 } = req.query;
    if (!tag) return res.status(400).json({ message: "Tag do" });

    const posts = await Post.findByTag(tag.toLowerCase().replace(/^#/, ""), {
      page:  parseInt(page),
      limit: parseInt(limit),
    });

    return res.json({ posts, page: parseInt(page) });
  } catch (err) {
    console.error("searchByTag error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin — Suspend Post
// ─────────────────────────────────────────────────────────────────────────────

export const suspendPost = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: "Reason do" });

    const post = await Post.findOne({ _id: req.params.postId, isDeleted: false });
    if (!post) return res.status(404).json({ message: "Post nahi mili" });

    await post.suspendPost(req.user._id, reason);

    return res.json({ message: "Post suspend ho gayi" });
  } catch (err) {
    console.error("suspendPost error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// My Posts (Logged-in user ke apne posts)
// ─────────────────────────────────────────────────────────────────────────────

export const getMyPosts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const posts = await Post.find({
      author:      req.user._id,
      isDeleted:   false,
      isSuspended: false,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("author", "name username avatar")
      .lean();

   const normalizedPosts = posts.map((p) => ({
  ...p,
  image: p.media?.find((m) => m.mediaType === "image")?.url || "",
  video: p.media?.find((m) => m.mediaType === "video")?.url || "",
}));
return res.json({ posts: normalizedPosts, page: parseInt(page) });
  } catch (err) {
    console.error("getMyPosts error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};