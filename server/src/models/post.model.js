import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Sub-schema: Cloudinary Media Item
// ─────────────────────────────────────────────
const cloudinaryMediaSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true }, // Cloudinary public_id for deletion
    resourceType: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    duration: { type: Number, default: null },       // seconds — video only
    thumbnailUrl: { type: String, default: null },   // auto-generated for video
    format: { type: String, default: null },         // jpg, mp4, webp etc.
    bytes: { type: Number, default: null },          // file size
    order: { type: Number, default: 0 },             // carousel order
  },
  { _id: false }
);

// ─────────────────────────────────────────────
//  Sub-schema: Tagged User in Post
// ─────────────────────────────────────────────
const taggedUserSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Optional position for image tagging (percentage based)
    posX: { type: Number, default: null },
    posY: { type: Number, default: null },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
//  Post Schema
// ─────────────────────────────────────────────
const postSchema = new Schema(
  {
    // ── Author ────────────────────────────────
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Post author is required"],
      index: true,
    },

    // ── Post Type ─────────────────────────────
    type: {
      type: String,
      enum: ["text", "image", "reel"],
      required: [true, "Post type is required"],
      index: true,
    },

    // ── Content ───────────────────────────────
    caption: {
      type: String,
      trim: true,
      maxlength: [2200, "Caption cannot exceed 2200 characters"],
      default: "",
    },

    // Array: single image, carousel (multi-image), or reel (single video)
    media: {
      type: [cloudinaryMediaSchema],
      default: [],
      validate: {
        validator: function (mediaArr) {
          if (this.type === "text") return mediaArr.length === 0;
          if (this.type === "reel") return mediaArr.length === 1;
          if (this.type === "image") return mediaArr.length >= 1 && mediaArr.length <= 10;
          return true;
        },
        message: "Invalid media count for post type",
      },
    },

    // ── Hashtags ──────────────────────────────
    hashtags: {
  type: [{ type: String }],
  default: [],
  index: true,
},

    // ── Mentions ──────────────────────────────
    mentions: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },

    // ── Tagged Users (image tag) ───────────────
    taggedUsers: {
      type: [taggedUserSchema],
      default: [],
    },

    // ── Location ──────────────────────────────
  location: {
  name: { type: String, trim: true, maxlength: 100, default: null },
  coordinates: {
    type: {
      type: String,
      enum: ["Point"],
    },
    coordinates: {
      type: [Number], // [lng, lat]
      validate: {
        validator: (arr) => arr.length === 2,
        message: "Coordinates mein exactly 2 values chahiye [lng, lat]",
      },
    },
  },
},

    // ── Visibility ────────────────────────────
    visibility: {
      type: String,
      enum: ["public", "followers", "only_me"],
      default: "public",
      index: true,
    },

    // ── Engagement Counts (denormalized) ──────
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    commentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    sharesCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    savedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Reel: view count
    viewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Settings ──────────────────────────────
    commentsDisabled: {
      type: Boolean,
      default: false,
    },

    likesHidden: {
      type: Boolean,
      default: false, // Instagram-style hide like count
    },

    // ── Soft Delete ───────────────────────────
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    // ── Draft ─────────────────────────────────
    isDraft: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────
postSchema.index({ author: 1, isDeleted: 1, createdAt: -1 });
postSchema.index({ hashtags: 1, isDeleted: 1, createdAt: -1 });
postSchema.index({ visibility: 1, isDeleted: 1, createdAt: -1 });
postSchema.index({ type: 1, isDeleted: 1, createdAt: -1 }); // reel feed
postSchema.index({ "location.coordinates": "2dsphere" });   // geo queries
postSchema.index({ caption: "text" });                       // text search

// ─────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────

/** Is carousel (multiple images) */
postSchema.virtual("isCarousel").get(function () {
  return this.type === "image" && this.media.length > 1;
});

/** First media item thumbnail */
postSchema.virtual("thumbnail").get(function () {
  if (!this.media || this.media.length === 0) return null;
  return this.media[0].thumbnailUrl || this.media[0].url;
});

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * Get feed posts from a list of user IDs (following feed)
 */
postSchema.statics.getFeedPosts = function (authorIds, page = 1, limit = 20) {
  return this.find({
    author: { $in: authorIds },
    isDeleted: false,
    isDraft: false,
    visibility: { $in: ["public", "followers"] },
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("author", "username fullName avatar isVerifiedBadge isPrivate")
    
};

/**
 * Get public posts of a user (for profile grid)
 */

postSchema.statics.getUserPosts = function (authorId, viewerIsFollower = false, page = 1, limit = 12) {
  const visibilityFilter = viewerIsFollower
    ? { $in: ["public", "followers"] }
    : "public";

  return this.find({
    author: authorId,
    isDeleted: false,
    isDraft: false,
    visibility: visibilityFilter,
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("author", "username fullName avatar isVerifiedBadge isPrivate")
    .select("media type caption likesCount commentsCount viewsCount createdAt visibility commentsDisabled likesHidden hashtags author");
};
/**
 * Get reels feed (type: reel, public)
 */
postSchema.statics.getReelsFeed = function (page = 1, limit = 10) {
  return this.find({
    type: "reel",
    isDeleted: false,
    isDraft: false,
    visibility: "public",
  })
    .sort({ viewsCount: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("author", "username fullName avatar isVerifiedBadge");
};

/**
 * Get posts by hashtag
 */
postSchema.statics.getPostsByHashtag = function (hashtagId, page = 1, limit = 20) {
  return this.find({
    hashtags: hashtagId,
    isDeleted: false,
    isDraft: false,
    visibility: "public",
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("author", "username fullName avatar isVerifiedBadge");
};

/**
 * Soft delete a post
 */
postSchema.statics.softDelete = function (postId, authorId) {
  return this.findOneAndUpdate(
    { _id: postId, author: authorId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
    { new: true }
  );
};

/**
 * Atomically update count fields
 * field: "likesCount" | "commentsCount" | "sharesCount" | "savedCount" | "viewsCount"
 * value: 1 or -1
 */
postSchema.statics.updateCount = function (postId, field, value) {
  return this.findByIdAndUpdate(
    postId,
    { $inc: { [field]: value } },
    { returnDocument: "after" }
  );
};

/**
 * Get a single post with full details
 */
postSchema.statics.getPostById = function (postId) {
  return this.findOne({ _id: postId, isDeleted: false, isDraft: false })
    .populate("author", "username fullName avatar isVerifiedBadge isPrivate")
    .populate("mentions", "username fullName avatar")
    .populate("taggedUsers.user", "username fullName avatar");
};

const Post = models.Post || model("Post", postSchema);
export default Post;