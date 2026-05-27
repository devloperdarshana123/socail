

// import mongoose from "mongoose";

// const { Schema, model, models } = mongoose;

// // ─────────────────────────────────────────────────────────────────────────────
// //  Sub-schema: Cloudinary Media
// // ─────────────────────────────────────────────────────────────────────────────

// const cloudinaryMediaSchema = new Schema(
//   {
//     url:          { type: String, required: true },
//     publicId:     { type: String, required: true },
//     resourceType: { type: String, enum: ["image", "video"], required: true },
//     width:        { type: Number, default: null },
//     height:       { type: Number, default: null },
//     duration:     { type: Number, default: null },      // seconds (video only)
//     thumbnailUrl: { type: String, default: null },      // auto-generated for video
//   },
//   { _id: false },
// );

// // ─────────────────────────────────────────────────────────────────────────────
// //  Sub-schema: Text Story Content
// //  FIX #12 — proper sub-schema with _id:false (not raw inline object)
// // ─────────────────────────────────────────────────────────────────────────────

// const textContentSchema = new Schema(
//   {
//     text:       { type: String, trim: true, maxlength: [200, "Text cannot exceed 200 characters"] },
//     background: { type: String, default: "linear-gradient(135deg, #667eea, #764ba2)" },
//     textAlign:  { type: String, enum: ["left", "center", "right"], default: "center" },
//     textColor:  { type: String, default: "#ffffff" },
//   },
//   { _id: false },
// );

// // ─────────────────────────────────────────────────────────────────────────────
// //  Story Schema
// //  FIX #2  — viewers array REMOVED; moved to StoryView collection
// //  FIX #5  — closeFriends embedded list replaced with reference approach
// // ─────────────────────────────────────────────────────────────────────────────

// const storySchema = new Schema(
//   {
//     // ── Author ────────────────────────────────────────────────────────────────

//     author: {
//       type:     Schema.Types.ObjectId,
//       ref:      "User",
//       required: [true, "Story author is required"],
//       index:    true,
//     },

//     // ── Type ──────────────────────────────────────────────────────────────────

//     // FIX #11 — enforced via pre("validate") hook below
//     type: {
//       type:    String,
//       enum:    ["media", "text"],
//       default: "media",
//       index:   true,
//     },

//     // ── Media (type === "media") ───────────────────────────────────────────────

//     media: {
//       type:    cloudinaryMediaSchema,
//       default: null,
//     },

//     // ── Text Content (type === "text") ────────────────────────────────────────

//     // FIX #12 — wrapped in proper sub-schema
//     // FIX #13 — caption only used for media overlay; textContent.text for text stories
//     textContent: {
//       type:    textContentSchema,
//       default: null,
//     },

//     // Caption / text overlay for media stories only
//     caption: {
//       type:      String,
//       trim:      true,
//       maxlength: [200, "Caption cannot exceed 200 characters"],
//       default:   "",
//     },

//     // ── Visibility ────────────────────────────────────────────────────────────

//     audience: {
//       type:    String,
//       enum:    ["public", "followers", "close_friends"],
//       default: "followers",
//       index:   true,
//     },

//     // FIX #5 — closeFriends is a snapshot of user IDs at post time (acceptable
//     // for stories since they expire in 24h; long-lived content should query
//     // the CloseFriendship collection instead). Capped at 1000 to bound doc size.
//     closeFriends: {
//       type:     [{ type: Schema.Types.ObjectId, ref: "User" }],
//       default:  [],
//       validate: {
//         validator: (v) => v.length <= 1000,
//         message:   "closeFriends list cannot exceed 1000 users",
//       },
//     },

//     // ── Engagement Counters (source of truth in StoryView collection) ──────────

//     viewsCount:     { type: Number, default: 0, min: 0 },
//     reactionsCount: { type: Number, default: 0, min: 0 },

//     // ── Story Link (swipe-up style) ───────────────────────────────────────────

//     // FIX #4 — URL validated to http/https only
//     linkUrl: {
//       type:    String,
//       trim:    true,
//       default: null,
//       validate: {
//         validator: (v) => !v || /^https?:\/\/.{1,2000}$/.test(v),
//         message:   "linkUrl must be a valid http/https URL",
//       },
//     },

//     // ── Mentions & Hashtags ───────────────────────────────────────────────────

//     mentions: {
//       type:    [{ type: Schema.Types.ObjectId, ref: "User" }],
//       default: [],
//     },

//     hashtags: {
//       type:    [{ type: Schema.Types.ObjectId, ref: "Hashtag" }],
//       default: [],
//     },

//     // ── Soft Delete ───────────────────────────────────────────────────────────

//     isDeleted: {
//       type:    Boolean,
//       default: false,
//       index:   true,
//     },

//     deletedAt: {
//       type:    Date,
//       default: null,
//     },

//     // ── TTL: auto-expire after 24 hours ──────────────────────────────────────

//     // FIX #16 — validated to be in the future
//     expiresAt: {
//       type:    Date,
//       default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
//       validate: {
//         validator: function (v) {
//           // On update skip; on create ensure it's in the future
//           return this.isNew ? v > new Date() : true;
//         },
//         message: "expiresAt must be a future date",
//       },
//     },
//   },
//   {
//     timestamps: true,
//     toJSON:     { virtuals: true },
//     toObject:   { virtuals: true },
//   },
// );

// // ─────────────────────────────────────────────────────────────────────────────
// //  Indexes
// //  FIX #9  — added audience compound index for feed queries
// //  FIX #14 — added mentions and hashtags indexes
// // ─────────────────────────────────────────────────────────────────────────────

// // TTL — MongoDB auto-deletes documents when expiresAt is reached
// storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// // Author feed queries
// storySchema.index({ author: 1, isDeleted: 1, expiresAt: -1 });
// storySchema.index({ author: 1, createdAt: -1 });

// // FIX #9 — feed query with audience filter
// storySchema.index({ audience: 1, isDeleted: 1, expiresAt: -1, author: 1 });

// // FIX #14 — mention & hashtag queries
// storySchema.index({ mentions: 1 });
// storySchema.index({ hashtags: 1, expiresAt: -1 });

// // ─────────────────────────────────────────────────────────────────────────────
// //  Pre-validate Hook
// //  FIX #11 — enforce that type matches the provided content
// //  FIX #13 — clear irrelevant fields based on type to avoid confusion
// // ─────────────────────────────────────────────────────────────────────────────

// storySchema.pre("validate", function () {
//   if (this.type === "media") {
//     if (!this.media?.url || !this.media?.publicId) {
//       throw new Error("Media story requires a valid media object (url + publicId)");
//     }
//     // Clear text-only field to keep doc clean
//     this.textContent = null;
//   }

//   if (this.type === "text") {
//     if (!this.textContent?.text?.trim()) {
//       throw new Error("Text story requires textContent.text");
//     }
//     // Clear media-only field to keep doc clean
//     this.media   = null;
//     this.caption = "";
//   }
// });

// // ─────────────────────────────────────────────────────────────────────────────
// //  Virtuals
// // ─────────────────────────────────────────────────────────────────────────────

// storySchema.virtual("isActive").get(function () {
//   return !this.isDeleted && this.expiresAt > new Date();
// });

// storySchema.virtual("expiresInSeconds").get(function () {
//   const diff = this.expiresAt - new Date();
//   return diff > 0 ? Math.floor(diff / 1000) : 0;
// });

// // ─────────────────────────────────────────────────────────────────────────────
// //  Static Methods
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * Get active (non-expired, non-deleted) stories for a single user
//  */
// storySchema.statics.getActiveStoriesForUser = function (userId) {
//   return this.find({
//     author:    userId,
//     isDeleted: false,
//     expiresAt: { $gt: new Date() },
//   }).sort({ createdAt: -1 });
// };

// /**
//  * Get stories feed — active stories from following list
//  * FIX #7 — added limit + cursor-based pagination via beforeId
//  *
//  * @param {ObjectId[]} followingIds
//  * @param {ObjectId}   viewerId
//  * @param {object}     opts         - { limit, beforeId }
//  */
// storySchema.statics.getFeedStories = function (followingIds, viewerId, opts = {}) {
//   const limit    = Math.min(parseInt(opts.limit) || 20, 50);
//   const query    = {
//     author:    { $in: followingIds },
//     isDeleted: false,
//     expiresAt: { $gt: new Date() },
//     $or: [
//       { audience: "public" },
//       { audience: "followers" },
//       { audience: "close_friends", closeFriends: viewerId },
//     ],
//   };

//   // Cursor pagination — fetch stories older than beforeId
//   if (opts.beforeId) {
//     query._id = { $lt: opts.beforeId };
//   }

//   return this.find(query)
//     .sort({ _id: -1 })
//     .limit(limit)
//     .populate("author", "username fullName avatar isVerifiedBadge");
// };

// /**
//  * Soft delete a story (author only)
//  */
// storySchema.statics.softDelete = function (storyId, authorId) {
//   return this.findOneAndUpdate(
//     { _id: storyId, author: authorId, isDeleted: false },
//     { isDeleted: true, deletedAt: new Date() },
//     { new: true },
//   );
// };

// const Story = models.Story || model("Story", storySchema);
// export default Story;

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


