

import Post from "../models/Post.model.js";
import SocialUser from "../models/User.model.js";
import cloudinary from "../config/cloudinary.js";

// ── Create Post ──────────────────────────────────────────────────────────────
export const createPost = async (req, res) => {
  try {
    const { caption, tags } = req.body;
  let imageUrl = "";
let videoUrl = "";

    if (!caption && !req.file) {
      return res.status(400).json({ success: false, message: "Caption or image is required!" });
    }
    if (req.file && req.file.mimetype.startsWith('video/')) {
 const result = await cloudinary.uploader.upload(
  `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
  { resource_type: "video", folder: "erosocial/posts" }
);
  videoUrl = result.secure_url;
}  else if (req.file) {
   const result = await cloudinary.uploader.upload(
  `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
  { folder: "erosocial/posts" }
);
      imageUrl = result.secure_url;
    }

    const post = await Post.create({
      author: req.user._id,
      caption,
      image: imageUrl,
      video: videoUrl,
      tags: tags ? tags.split(",").map((t) => t.trim()) : [],
    });

    await post.populate("author", "name avatar role designation");

    return res.status(201).json({ success: true, message: "Post created successfully!", post });
  } catch (error) {
    console.error("Create post error:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};

// ── Get Feed (Only followed users' posts) ────────────────────────────────────
export const getFeed = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    // Get the current user's following list
    
const currentUser = await SocialUser.findById(req.user._id).select("following");
const followingIds = currentUser.following; 
    // Show posts only from followed users
    const posts = await Post.find({
      isSuspended: false,
    author: { $in: [...followingIds, req.user._id] },
    })
      .populate("author", "name avatar role designation")
      .populate("comments.user", "name avatar designation")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({
      isSuspended: false,
  author: { $in: [...followingIds, req.user._id] },
    });

    return res.status(200).json({
      success: true,
      posts,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get feed error:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};

// ── Get Explore (All posts sorted by most liked) ─────────────────────────────
export const getExplore = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const posts = await Post.aggregate([
      // Step 1: Sirf active posts, apni khud ki nahi
   { $match: { isSuspended: false } },

      // Step 2: likesCount field add karo sorting ke liye
      { $addFields: { likesCount: { $size: "$likes" } } },

      // Step 3: Most liked pehle, phir latest
      { $sort: { likesCount: -1, createdAt: -1 } },

      // Step 4: Pagination
      { $skip: skip },
      { $limit: limit },

      // Step 5: Author ki details fetch karo
      {
        $lookup: {
          from: "socialusers",
          localField: "author",
          foreignField: "_id",
          as: "author",
        },
      },
      { $unwind: "$author" },

      // Step 6: Author ke sirf zaroori fields rakhho
      {
        $project: {
          caption: 1,
          image: 1,
          video: 1,
          tags: 1,
          likes: 1,
          likesCount: 1,
          comments: 1,
          views: 1,
          savedBy: 1,
          createdAt: 1,
          "author._id":         1,
          "author.name":        1,
          "author.avatar":      1,
          "author.role":        1,
          "author.designation": 1,
        },
      },
    ]);

  const total = await Post.countDocuments({ isSuspended: false });
    return res.status(200).json({
      success: true,
      posts,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get explore error:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};

// ── Get Trending Posts ────────────────────────────────────────────────────────
export const getTrendingPosts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

   const posts = await Post.find({ isSuspended: false })
  .populate("author", "name avatar role designation")
  .populate("comments.user", "name avatar designation")
  .sort({ likesCount: -1, createdAt: -1 })
  .limit(limit);
// ✅ Yeh add karo:
    return res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error("Get trending posts error:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};

// ── Search Posts ──────────────────────────────────────────────────────────────
export const searchPosts = async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) {
      return res.status(400).json({ success: false, message: "Search query is required!" });
    }

    const posts = await Post.find({
      isSuspended: false,
      caption: { $regex: q, $options: "i" },
    })
      .populate("author", "name avatar role designation")
      .populate("comments.user", "name avatar designation")
      .sort({ createdAt: -1 })
      .limit(20);

    return res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error("Search posts error:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};

// ── Get Single Post ───────────────────────────────────────────────────────────
export const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("author", "name avatar role designation")
      .populate("comments.user", "name avatar designation");

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found!" });
    }

    // ✅ Yeh add karo:
    await Post.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

    return res.status(200).json({ success: true, post });
  } catch (error) {
    console.error("Get post error:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};

// ── Like / Unlike Post ────────────────────────────────────────────────────────
export const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found!" });
    }

    const alreadyLiked = post.likes.includes(req.user._id);

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== req.user._id.toString());
    } else {
      post.likes.push(req.user._id);
    }

    await post.save();

    return res.status(200).json({
      success: true,
      message: alreadyLiked ? "Post unliked!" : "Post liked!",
      likes: post.likes.length,
      isLiked: !alreadyLiked,
    });
  } catch (error) {
    console.error("Like post error:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};

// ── Add Comment ───────────────────────────────────────────────────────────────
export const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: "Comment cannot be empty!" });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found!" });
    }

    post.comments.push({ user: req.user._id, text });
    await post.save();
    await post.populate("comments.user", "name avatar designation");

    return res.status(201).json({
      success: true,
      message: "Comment added successfully!",
      comment: post.comments[post.comments.length - 1],
    });
  } catch (error) {
    console.error("Add comment error:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};

// ── Delete Comment ────────────────────────────────────────────────────────────
export const deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found!" });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found!" });
    }

    // Only the comment owner or an admin can delete the comment
    if (
      comment.user.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" &&
      req.user.role !== "super_admin"
    ) {
      return res.status(403).json({ success: false, message: "You are not authorized to delete this comment!" });
    }

    comment.deleteOne();
    await post.save();

    return res.status(200).json({ success: true, message: "Comment deleted successfully!" });
  } catch (error) {
    console.error("Delete comment error:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};



// ── Like / Unlike Comment ─────────────────────────────────────────────────────
export const likeComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found!" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ success: false, message: "Comment not found!" });

    const alreadyLiked = comment.likes.includes(req.user._id);
    if (alreadyLiked) {
      comment.likes = comment.likes.filter((id) => id.toString() !== req.user._id.toString());
    } else {
      comment.likes.push(req.user._id);
    }

    await post.save();
    return res.status(200).json({ success: true, isLiked: !alreadyLiked, likes: comment.likes.length });
  } catch (err) {
    console.error("likeComment error:", err);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};

// ── Reply to Comment ──────────────────────────────────────────────────────────
export const replyToComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: "Reply cannot be empty!" });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found!" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ success: false, message: "Comment not found!" });

    comment.replies.push({ user: req.user._id, text, likes: [] });
    await post.save();
    await post.populate("comments.replies.user", "name avatar designation");

    const reply = comment.replies[comment.replies.length - 1];
    return res.status(201).json({ success: true, reply });
  } catch (err) {
    console.error("replyToComment error:", err);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};

// ── Like / Unlike Reply ───────────────────────────────────────────────────────
export const likeReply = async (req, res) => {
  try {
    const { postId, commentId, replyId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found!" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ success: false, message: "Comment not found!" });

    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ success: false, message: "Reply not found!" });

    const alreadyLiked = reply.likes.includes(req.user._id);
    if (alreadyLiked) {
      reply.likes = reply.likes.filter((id) => id.toString() !== req.user._id.toString());
    } else {
      reply.likes.push(req.user._id);
    }

    await post.save();
    return res.status(200).json({ success: true, isLiked: !alreadyLiked, likes: reply.likes.length });
  } catch (err) {
    console.error("likeReply error:", err);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};

// ── Save / Unsave Post ────────────────────────────────────────────────────────
export const savePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found!" });
    }

    const alreadySaved = post.savedBy.includes(req.user._id);

    if (alreadySaved) {
      post.savedBy = post.savedBy.filter((id) => id.toString() !== req.user._id.toString());
    } else {
      post.savedBy.push(req.user._id);
    }

    await post.save();

    return res.status(200).json({
      success: true,
      message: alreadySaved ? "Post unsaved!" : "Post saved!",
      isSaved: !alreadySaved,
    });
  } catch (error) {
    console.error("Save post error:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};

// ── Get Saved Posts ───────────────────────────────────────────────────────────
export const getSavedPosts = async (req, res) => {
  try {
    const posts = await Post.find({
      savedBy: req.user._id,
      isSuspended: false,
    })
      .populate("author", "name avatar role designation")
      .populate("comments.user", "name avatar designation")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error("Get saved posts error:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};

// ── Delete Post ───────────────────────────────────────────────────────────────
export const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found!" });
    }

    if (
      post.author.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" &&
      req.user.role !== "super_admin"
    ) {
      return res.status(403).json({ success: false, message: "You are not authorized to delete this post!" });
    }

    if (post.image) {
      const publicId = post.image.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`erosocial/posts/${publicId}`);
    }

    await post.deleteOne();

    return res.status(200).json({ success: true, message: "Post deleted successfully!" });
  } catch (error) {
    console.error("Delete post error:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};

// ── Suspend Post (Admin Only) ─────────────────────────────────────────────────
export const suspendPost = async (req, res) => {
  try {
    const { reason } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found!" });
    }

    post.isSuspended   = true;
    post.suspendedBy   = req.user._id;
    post.suspendReason = reason || "Suspended by admin";
    await post.save();

    return res.status(200).json({ success: true, message: "Post suspended successfully!" });
  } catch (error) {
    console.error("Suspend post error:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};

// ── Unsuspend Post (Admin Only) ───────────────────────────────────────────────
export const unsuspendPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found!" });
    }

    post.isSuspended   = false;
    post.suspendedBy   = null;
    post.suspendReason = "";
    await post.save();

    return res.status(200).json({ success: true, message: "Post unsuspended successfully!" });
  } catch (error) {
    console.error("Unsuspend post error:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};

// ── Get My Posts ──────────────────────────────────────────────────────────────
export const getMyPosts = async (req, res) => {
  try {
    const posts = await Post.find({ author: req.user._id })
      .populate("author", "name avatar role designation")
        .populate("comments.user", "name avatar designation")  
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error("Get my posts error:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};


// ── Get User Posts (Public) ───────────────────────────────────────────────────
export const getUserPosts = async (req, res) => {
  try {
    const posts = await Post.find({ 
      author: req.params.userId,
      isSuspended: false,
    })
      .populate("author", "name avatar role designation")
      .populate("comments.user", "name avatar designation")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error("Get user posts error:", error);
    return res.status(500).json({ success: false, message: "Internal server error!" });
  }
};