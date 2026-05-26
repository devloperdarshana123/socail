

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-schema: Cloudinary Media
// ─────────────────────────────────────────────────────────────────────────────

const cloudinaryMediaSchema = new Schema(
  {
    url:          { type: String, required: true },
    publicId:     { type: String, required: true },
    resourceType: { type: String, enum: ["image", "video"], required: true },
    width:        { type: Number, default: null },
    height:       { type: Number, default: null },
    duration:     { type: Number, default: null },      // seconds (video only)
    thumbnailUrl: { type: String, default: null },      // auto-generated for video
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-schema: Text Story Content
//  FIX #12 — proper sub-schema with _id:false (not raw inline object)
// ─────────────────────────────────────────────────────────────────────────────

const textContentSchema = new Schema(
  {
    text:       { type: String, trim: true, maxlength: [200, "Text cannot exceed 200 characters"] },
    background: { type: String, default: "linear-gradient(135deg, #667eea, #764ba2)" },
    textAlign:  { type: String, enum: ["left", "center", "right"], default: "center" },
    textColor:  { type: String, default: "#ffffff" },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Story Schema
//  FIX #2  — viewers array REMOVED; moved to StoryView collection
//  FIX #5  — closeFriends embedded list replaced with reference approach
// ─────────────────────────────────────────────────────────────────────────────

const storySchema = new Schema(
  {
    // ── Author ────────────────────────────────────────────────────────────────

    author: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "Story author is required"],
      index:    true,
    },

    // ── Type ──────────────────────────────────────────────────────────────────

    // FIX #11 — enforced via pre("validate") hook below
    type: {
      type:    String,
      enum:    ["media", "text"],
      default: "media",
      index:   true,
    },

    // ── Media (type === "media") ───────────────────────────────────────────────

    media: {
      type:    cloudinaryMediaSchema,
      default: null,
    },

    // ── Text Content (type === "text") ────────────────────────────────────────

    // FIX #12 — wrapped in proper sub-schema
    // FIX #13 — caption only used for media overlay; textContent.text for text stories
    textContent: {
      type:    textContentSchema,
      default: null,
    },

    // Caption / text overlay for media stories only
    caption: {
      type:      String,
      trim:      true,
      maxlength: [200, "Caption cannot exceed 200 characters"],
      default:   "",
    },

    // ── Visibility ────────────────────────────────────────────────────────────

    audience: {
      type:    String,
      enum:    ["public", "followers", "close_friends"],
      default: "followers",
      index:   true,
    },

    // FIX #5 — closeFriends is a snapshot of user IDs at post time (acceptable
    // for stories since they expire in 24h; long-lived content should query
    // the CloseFriendship collection instead). Capped at 1000 to bound doc size.
    closeFriends: {
      type:     [{ type: Schema.Types.ObjectId, ref: "User" }],
      default:  [],
      validate: {
        validator: (v) => v.length <= 1000,
        message:   "closeFriends list cannot exceed 1000 users",
      },
    },

    // ── Engagement Counters (source of truth in StoryView collection) ──────────

    viewsCount:     { type: Number, default: 0, min: 0 },
    reactionsCount: { type: Number, default: 0, min: 0 },

    // ── Story Link (swipe-up style) ───────────────────────────────────────────

    // FIX #4 — URL validated to http/https only
    linkUrl: {
      type:    String,
      trim:    true,
      default: null,
      validate: {
        validator: (v) => !v || /^https?:\/\/.{1,2000}$/.test(v),
        message:   "linkUrl must be a valid http/https URL",
      },
    },

    // ── Mentions & Hashtags ───────────────────────────────────────────────────

    mentions: {
      type:    [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },

    hashtags: {
      type:    [{ type: Schema.Types.ObjectId, ref: "Hashtag" }],
      default: [],
    },

    // ── Soft Delete ───────────────────────────────────────────────────────────

    isDeleted: {
      type:    Boolean,
      default: false,
      index:   true,
    },

    deletedAt: {
      type:    Date,
      default: null,
    },

    // ── TTL: auto-expire after 24 hours ──────────────────────────────────────

    // FIX #16 — validated to be in the future
    expiresAt: {
      type:    Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      validate: {
        validator: function (v) {
          // On update skip; on create ensure it's in the future
          return this.isNew ? v > new Date() : true;
        },
        message: "expiresAt must be a future date",
      },
    },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Indexes
//  FIX #9  — added audience compound index for feed queries
//  FIX #14 — added mentions and hashtags indexes
// ─────────────────────────────────────────────────────────────────────────────

// TTL — MongoDB auto-deletes documents when expiresAt is reached
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Author feed queries
storySchema.index({ author: 1, isDeleted: 1, expiresAt: -1 });
storySchema.index({ author: 1, createdAt: -1 });

// FIX #9 — feed query with audience filter
storySchema.index({ audience: 1, isDeleted: 1, expiresAt: -1, author: 1 });

// FIX #14 — mention & hashtag queries
storySchema.index({ mentions: 1 });
storySchema.index({ hashtags: 1, expiresAt: -1 });

// ─────────────────────────────────────────────────────────────────────────────
//  Pre-validate Hook
//  FIX #11 — enforce that type matches the provided content
//  FIX #13 — clear irrelevant fields based on type to avoid confusion
// ─────────────────────────────────────────────────────────────────────────────

storySchema.pre("validate", function () {
  if (this.type === "media") {
    if (!this.media?.url || !this.media?.publicId) {
      throw new Error("Media story requires a valid media object (url + publicId)");
    }
    // Clear text-only field to keep doc clean
    this.textContent = null;
  }

  if (this.type === "text") {
    if (!this.textContent?.text?.trim()) {
      throw new Error("Text story requires textContent.text");
    }
    // Clear media-only field to keep doc clean
    this.media   = null;
    this.caption = "";
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────────────────────────────────────

storySchema.virtual("isActive").get(function () {
  return !this.isDeleted && this.expiresAt > new Date();
});

storySchema.virtual("expiresInSeconds").get(function () {
  const diff = this.expiresAt - new Date();
  return diff > 0 ? Math.floor(diff / 1000) : 0;
});

// ─────────────────────────────────────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get active (non-expired, non-deleted) stories for a single user
 */
storySchema.statics.getActiveStoriesForUser = function (userId) {
  return this.find({
    author:    userId,
    isDeleted: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

/**
 * Get stories feed — active stories from following list
 * FIX #7 — added limit + cursor-based pagination via beforeId
 *
 * @param {ObjectId[]} followingIds
 * @param {ObjectId}   viewerId
 * @param {object}     opts         - { limit, beforeId }
 */
storySchema.statics.getFeedStories = function (followingIds, viewerId, opts = {}) {
  const limit    = Math.min(parseInt(opts.limit) || 20, 50);
  const query    = {
    author:    { $in: followingIds },
    isDeleted: false,
    expiresAt: { $gt: new Date() },
    $or: [
      { audience: "public" },
      { audience: "followers" },
      { audience: "close_friends", closeFriends: viewerId },
    ],
  };

  // Cursor pagination — fetch stories older than beforeId
  if (opts.beforeId) {
    query._id = { $lt: opts.beforeId };
  }

  return this.find(query)
    .sort({ _id: -1 })
    .limit(limit)
    .populate("author", "username fullName avatar isVerifiedBadge");
};

/**
 * Soft delete a story (author only)
 */
storySchema.statics.softDelete = function (storyId, authorId) {
  return this.findOneAndUpdate(
    { _id: storyId, author: authorId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
    { new: true },
  );
};

const Story = models.Story || model("Story", storySchema);
export default Story;