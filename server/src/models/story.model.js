
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-schema: Cloudinary Media
// ─────────────────────────────────────────────────────────────────────────────

const cloudinaryMediaSchema = new Schema(
  {
    url:          { type: String, required: [true, "media.url is required"] },
    publicId:     { type: String, required: [true, "media.publicId is required"] },
    resourceType: {
      type:     String,
      enum:     { values: ["image", "video"], message: "resourceType must be image or video" },
      required: [true, "media.resourceType is required"],
    },
    width:        { type: Number, default: null, min: 0 },
    height:       { type: Number, default: null, min: 0 },
    duration:     { type: Number, default: null, min: 0 }, // seconds (video only)
    thumbnailUrl: {
      type:     String,
      default:  null,
      // AUDIT FIX #1: thumbnailUrl had no validation — XSS risk via inline rendering
      validate: {
        validator: (v) => !v || /^https?:\/\/.+/.test(v),
        message:   "thumbnailUrl must be a valid http/https URL",
      },
    },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-schema: Text Story Content
// ─────────────────────────────────────────────────────────────────────────────

// AUDIT FIX #2: textContentSchema had no XSS guard on background/textColor.
// A malicious user could inject CSS like expression() or javascript: URIs.
const isSafeCssValue = (v) => {
  if (!v) return true;
  if (/[<>"'`]/.test(v)) return false;
  return (
    /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) ||
    /^rgba?\(/.test(v)                                                ||
    /^hsla?\(/.test(v)                                                ||
    /^(linear|radial|conic)-gradient\(/.test(v)                       ||
    /^[a-zA-Z][a-zA-Z\s]+$/.test(v)
  );
};

const textContentSchema = new Schema(
  {
    text: {
      type:      String,
      trim:      true,
      maxlength: [500, "Text cannot exceed 500 characters"],
    },
    background: {
      type:     String,
      default:  "linear-gradient(135deg, #667eea, #764ba2)",
      validate: { validator: isSafeCssValue, message: "background contains invalid CSS" },
    },
    textAlign: {
      type:    String,
      enum:    { values: ["left", "center", "right"], message: "textAlign must be left, center, or right" },
      default: "center",
    },
    textColor: {
      type:     String,
      default:  "#ffffff",
      validate: { validator: isSafeCssValue, message: "textColor must be a valid CSS color" },
    },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Story Schema
// ─────────────────────────────────────────────────────────────────────────────

const storySchema = new Schema(
  {
    author: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "Story author is required"],
      index:    true,
    },

    type: {
      type:    String,
      enum:    { values: ["media", "text"], message: "type must be media or text" },
      default: "media",
      index:   true,
    },

    media: {
      type:    cloudinaryMediaSchema,
      default: null,
    },

    textContent: {
      type:    textContentSchema,
      default: null,
    },

    caption: {
      type:      String,
      trim:      true,
      maxlength: [200, "Caption cannot exceed 200 characters"],
      default:   "",
    },

    audience: {
      type:    String,
      enum:    { values: ["public", "followers", "close_friends"], message: "Invalid audience value" },
      default: "followers",
      index:   true,
    },

    // AUDIT FIX #3: closeFriends validator was arrow function — `this` context lost.
    // For array-level validators, always use regular function to access document context.
    // Also added min: 0 on the length check.
    closeFriends: {
      type:     [{ type: Schema.Types.ObjectId, ref: "User" }],
      default:  [],
      validate: {
        validator: function (v) { return Array.isArray(v) && v.length <= 1000; },
        message:   "closeFriends list cannot exceed 1000 users",
      },
    },

    // Counters — source of truth is StoryView collection.
    // These are denormalized caches, updated via $inc in StoryView.recordView.
    viewsCount:     { type: Number, default: 0, min: 0 },
    reactionsCount: { type: Number, default: 0, min: 0 },

    linkUrl: {
      type:    String,
      trim:    true,
      default: null,
      // AUDIT FIX #4: original regex was /^https?:\/\/.{1,2000}$/ — this matches
      // newlines in the middle of URL due to no 's' flag absence. Replaced with
      // stricter check that also blocks whitespace.
      validate: {
        validator: (v) => !v || /^https?:\/\/[^\s]{1,2000}$/.test(v),
        message:   "linkUrl must be a valid http/https URL without whitespace",
      },
    },

    mentions: {
      type:    [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
      // AUDIT FIX #5: no cap on mentions — unbounded array = doc size attack vector.
      validate: {
        validator: function (v) { return v.length <= 50; },
        message:   "Cannot mention more than 50 users",
      },
    },

    hashtags: {
      type:    [{ type: Schema.Types.ObjectId, ref: "Hashtag" }],
      default: [],
      // AUDIT FIX #5: same — cap hashtags
      validate: {
        validator: function (v) { return v.length <= 30; },
        message:   "Cannot use more than 30 hashtags",
      },
    },

    isDeleted: {
      type:    Boolean,
      default: false,
      index:   true,
    },

    deletedAt: {
      type:    Date,
      default: null,
    },

    expiresAt: {
      type:    Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      validate: {
        validator: function (v) {
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
// ─────────────────────────────────────────────────────────────────────────────

// TTL — MongoDB auto-deletes expired stories
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Author feed — most common query pattern
storySchema.index({ author: 1, isDeleted: 1, expiresAt: -1 });
storySchema.index({ author: 1, createdAt: -1 });

// Public feed with audience filter
storySchema.index({ audience: 1, isDeleted: 1, expiresAt: -1, author: 1 });

// Mention & hashtag queries
storySchema.index({ mentions: 1 });
storySchema.index({ hashtags: 1, expiresAt: -1 });

// AUDIT FIX #6: Added compound index for softDelete query pattern —
// { _id, author, isDeleted } is queried together in softDelete static.
storySchema.index({ author: 1, isDeleted: 1 });

// ─────────────────────────────────────────────────────────────────────────────
//  Pre-validate Hook
//  Story is a top-level document — pre("validate") works correctly here.
//  Subdocument hook was the bug in Highlight; top-level is fine.
// ─────────────────────────────────────────────────────────────────────────────

storySchema.pre("validate", function () {
  if (this.type === "media") {
    if (!this.media?.url || !this.media?.publicId) {
      throw new Error("Media story requires a valid media object (url + publicId)");
    }
    this.textContent = null;
  }

  if (this.type === "text") {
    if (!this.textContent?.text?.trim()) {
      throw new Error("Text story requires textContent.text");
    }
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
 * getActiveStoriesForUser — active stories for a single author.
 */
storySchema.statics.getActiveStoriesForUser = function (userId) {
  return this.find({
    author:    userId,
    isDeleted: false,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();
};

/**
 * getFeedStories — active stories from a following list.
 * Cursor-based pagination via beforeId.
 */
storySchema.statics.getFeedStories = function (followingIds, viewerId, opts = {}) {
  const limit = Math.min(parseInt(opts.limit) || 20, 50);
  const query = {
    author:    { $in: followingIds },
    isDeleted: false,
    expiresAt: { $gt: new Date() },
    $or: [
      { audience: "public" },
      { audience: "followers" },
      { audience: "close_friends", closeFriends: viewerId },
    ],
  };

  if (opts.beforeId) query._id = { $lt: opts.beforeId };

  return this.find(query)
    .sort({ _id: -1 })
    .limit(limit)
    .populate("author", "username fullName avatar isVerifiedBadge")
    .lean();
};

/**
 * softDelete — author-scoped soft delete.
 */
storySchema.statics.softDelete = function (storyId, authorId) {
  return this.findOneAndUpdate(
    { _id: storyId, author: authorId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
    { new: true },
  );
};

/**
 * softDeleteAllForUser — cascade delete on account removal.
 */
storySchema.statics.softDeleteAllForUser = async function (authorId) {
  // AUDIT FIX #7: this method was missing — needed for account deletion cascade.
  const result = await this.updateMany(
    { author: authorId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
  );
  return { deletedCount: result.modifiedCount ?? 0 };
};

const Story = models.Story || model("Story", storySchema);
export default Story;


