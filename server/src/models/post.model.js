
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PAGE_LIMIT   = 50;
const MAX_TAGGED_USERS = 20;          // FIX #15 — Instagram-style cap
const MAX_MEDIA_BYTES  = 500 * 1024 * 1024; // 500 MB — FIX #8

/**
 * FIX #2 — Whitelisted counter fields.
 * updateCount() only accepts these — prevents arbitrary field writes / NoSQL injection
 * if field ever comes from a request.
 */
const COUNTABLE_FIELDS = new Set([
  "likesCount",
  "commentsCount",
  "sharesCount",
  "savedCount",
  "viewsCount",
]);

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-schema: Cloudinary Media Item
// ─────────────────────────────────────────────────────────────────────────────

const cloudinaryMediaSchema = new Schema(
  {
    url:          { type: String, required: true },
    publicId:     { type: String, required: true },
    resourceType: { type: String, enum: ["image", "video"], required: true },
    width:        { type: Number, default: null },
    height:       { type: Number, default: null },
    duration:     { type: Number, default: null },       // seconds — video only
    thumbnailUrl: { type: String, default: null },
    format:       { type: String, default: null },       // jpg, mp4, webp …

    // FIX #8 — bytes bounded: prevents corrupt Cloudinary responses storing garbage values
    bytes: {
      type:    Number,
      default: null,
      min:     [0,              "bytes cannot be negative"],
      max:     [MAX_MEDIA_BYTES, `bytes cannot exceed ${MAX_MEDIA_BYTES}`],
    },

    order: { type: Number, default: 0 }, // carousel sort order
  },
  { _id: false }, // no _id on embedded media items
);

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-schema: Tagged User in Post
// ─────────────────────────────────────────────────────────────────────────────

const taggedUserSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // FIX #7 — percentage-based position: valid range 0–100 (was unbounded before)
    posX: {
      type:    Number,
      default: null,
      min:     [0,   "posX must be between 0 and 100"],
      max:     [100, "posX must be between 0 and 100"],
    },
    posY: {
      type:    Number,
      default: null,
      min:     [0,   "posY must be between 0 and 100"],
      max:     [100, "posY must be between 0 and 100"],
    },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Post Schema
// ─────────────────────────────────────────────────────────────────────────────

const postSchema = new Schema(
  {
    // ── Author ────────────────────────────────────────────────────────────────
    author: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "Post author is required"],
      index:    true,
    },

    // ── Post Type ─────────────────────────────────────────────────────────────
    type: {
      type:     String,
      enum:     ["text", "image", "reel"],
      required: [true, "Post type is required"],
      index:    true,
    },

    // ── Content ───────────────────────────────────────────────────────────────
    caption: {
      type:      String,
      trim:      true,
      maxlength: [2200, "Caption cannot exceed 2200 characters"],
      default:   "",
    },

    /**
     * FIX #3 — IMPORTANT: Mongoose validators on arrays do NOT fire during
     * findByIdAndUpdate(). Controllers that push to media via $push must
     * re-validate type/count constraints manually before writing.
     * Example guard in controller:
     *   if (post.type === "reel" && post.media.length >= 1) throw error
     */
    media: {
      type:    [cloudinaryMediaSchema],
      default: [],
      validate: [
        {
          validator: function (arr) {
            if (this.type === "text")  return arr.length === 0;
            if (this.type === "reel")  return arr.length === 1;
            if (this.type === "image") return arr.length >= 1 && arr.length <= 10;
            return true;
          },
          message: "Invalid media count for post type",
        },
        {
          // reel must contain only video; image posts only images
          validator: function (arr) {
            if (this.type === "reel")  return arr.every((m) => m.resourceType === "video");
            if (this.type === "image") return arr.every((m) => m.resourceType === "image");
            return true;
          },
          message: "Media resourceType does not match post type",
        },
      ],
    },

    // ── Hashtags ──────────────────────────────────────────────────────────────
    /**
     * FIX #4  — Normalized via pre("save") hook: lowercase, no # prefix, deduped.
     * FIX #14 — Field-level index: true REMOVED. The compound index below is
     *           always used instead — standalone index was redundant and wasted space.
     */
    hashtags: {
      type:    [{ type: String }],
      default: [],
    },

    // ── Mentions ──────────────────────────────────────────────────────────────
    mentions: {
      type:    [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },

    // ── Tagged Users (image tag with optional position) ────────────────────────
    // FIX #15 — capped at MAX_TAGGED_USERS (20) — was unbounded before
    taggedUsers: {
      type:    [taggedUserSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= MAX_TAGGED_USERS,
        message:   `Cannot tag more than ${MAX_TAGGED_USERS} users in a post`,
      },
    },

    // ── Location ──────────────────────────────────────────────────────────────
    location: {
      name: { type: String, trim: true, maxlength: 100, default: null },
      coordinates: {
        type: { type: String, enum: ["Point"] },
        coordinates: {
          type: [Number], // [longitude, latitude]
          // FIX #5 — full range validation (was only checking arr.length === 2 before)
          validate: {
            validator: (arr) =>
              arr.length === 2 &&
              arr[0] >= -180 && arr[0] <= 180 && // longitude
              arr[1] >= -90  && arr[1] <= 90,    // latitude
            message: "coordinates must be [longitude, latitude] with valid ranges",
          },
        },
      },
    },

    // ── Visibility ────────────────────────────────────────────────────────────
    visibility: {
      type:    String,
      enum:    ["public", "followers", "only_me"],
      default: "public",
      index:   true,
    },

    // ── Engagement Counts (denormalized) ─────────────────────────────────────
    likesCount:    { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
    sharesCount:   { type: Number, default: 0, min: 0 },
    savedCount:    { type: Number, default: 0, min: 0 },
    viewsCount:    { type: Number, default: 0, min: 0 },

    // ── Settings ──────────────────────────────────────────────────────────────
    commentsDisabled: { type: Boolean, default: false },
    likesHidden:      { type: Boolean, default: false }, // Instagram-style

    // ── Soft Delete ───────────────────────────────────────────────────────────
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date,    default: null },

    // ── Draft ─────────────────────────────────────────────────────────────────
    // FIX #13 — sort drafts by updatedAt (timestamps: true provides it)
    isDraft: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,             // createdAt + updatedAt — use updatedAt to sort drafts
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Indexes
//
//  FIX #9  — added viewsCount to reels index for sort coverage
//  FIX #10 — combined caption + hashtags text index (was caption only)
//  FIX #12 — mentions index added for "posts mentioning user X" queries
//  FIX #14 — removed field-level index: true from hashtags (compound is sufficient)
// ─────────────────────────────────────────────────────────────────────────────

// Profile grid: user's posts sorted newest first
postSchema.index({ author: 1, isDeleted: 1, createdAt: -1 });

// Draft list: user's drafts sorted by last edit
postSchema.index({ author: 1, isDraft: 1, updatedAt: -1 });

// Hashtag feed
// FIX #14 — this compound index replaces the removed field-level hashtags index
postSchema.index({ hashtags: 1, isDeleted: 1, createdAt: -1 });

// Visibility filter queries
postSchema.index({ visibility: 1, isDeleted: 1, createdAt: -1 });

// FIX #9 — reels feed sorted by viewsCount (was missing viewsCount before)
postSchema.index({ type: 1, isDeleted: 1, viewsCount: -1, createdAt: -1 });

// Geo queries
postSchema.index({ "location.coordinates": "2dsphere" }, { sparse: true });

// FIX #10 — combined text index: covers caption search AND hashtag search
postSchema.index({ caption: "text", hashtags: "text" });

// FIX #12 — "all posts mentioning user X" — was missing before
postSchema.index({ mentions: 1, isDeleted: 1 });

// ─────────────────────────────────────────────────────────────────────────────
//  Pre-save Hook — Hashtag Normalization
//  FIX #4 — lowercase, strip leading #, deduplicate
//           Without this, #Marble and #marble are stored separately and split feeds
// ─────────────────────────────────────────────────────────────────────────────

postSchema.pre("save", function () {
  if (this.isModified("hashtags") && this.hashtags.length) {
    this.hashtags = [
      ...new Set(
        this.hashtags
          .map((h) => h.toLowerCase().trim().replace(/^#+/, ""))
          .filter(Boolean),
      ),
    ];
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────────────────────────────────────

/** True if post is a carousel (multiple images) */
postSchema.virtual("isCarousel").get(function () {
  return this.type === "image" && this.media.length > 1;
});

/** First media item's thumbnail URL */
postSchema.virtual("thumbnail").get(function () {
  if (!this.media || this.media.length === 0) return null;
  return this.media[0].thumbnailUrl || this.media[0].url;
});

// ─────────────────────────────────────────────────────────────────────────────
//  Shared select string for list queries (avoids repeating it everywhere)
// ─────────────────────────────────────────────────────────────────────────────

const LIST_SELECT =
  "media type caption likesCount commentsCount viewsCount savedCount " +
  "createdAt visibility commentsDisabled likesHidden hashtags author";

// ─────────────────────────────────────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get following feed — cursor-paginated.
 * FIX #1  — cursor replaces skip() (skip scans all preceding docs; slow at scale).
 * FIX #11 — visibility precondition documented: authorIds must only contain
 *           IDs of users the viewer actually follows. "followers" posts are safe
 *           because of this precondition — never pass unverified IDs here.
 *
 * @param {ObjectId[]} authorIds        — pre-verified list of followed user IDs
 * @param {object}     opts
 * @param {number}     opts.limit       — default 20, max 50
 * @param {ObjectId}   [opts.beforeId]  — cursor: return posts older than this _id
 */
postSchema.statics.getFeedPosts = async function (authorIds, opts = {}) {
  const limit = Math.min(parseInt(opts.limit) || 20, MAX_PAGE_LIMIT);

  const query = {
    author:     { $in: authorIds },
    isDeleted:  false,
    isDraft:    false,
    visibility: { $in: ["public", "followers"] },
  };

  if (opts.beforeId) query._id = { $lt: opts.beforeId };

  const results = await this.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("author", "username fullName avatar isVerifiedBadge isPrivate")
    .select(LIST_SELECT);

  const hasMore    = results.length > limit;
  const items      = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore && items.length ? items[items.length - 1]._id : null;

  return { items, hasMore, nextCursor };
};

/**
 * Get a user's profile posts — cursor-paginated.
 * FIX #1 — cursor replaces skip().
 * FIX #6 — visibility enforced per viewer relationship.
 *
 * @param {ObjectId} authorId
 * @param {boolean}  viewerIsFollower
 * @param {boolean}  viewerIsOwner     — true when viewer === author (shows only_me posts)
 * @param {object}   opts
 * @param {number}   opts.limit
 * @param {ObjectId} [opts.beforeId]
 */
postSchema.statics.getUserPosts = async function (
  authorId,
  viewerIsFollower = false,
  viewerIsOwner    = false,
  opts             = {},
) {
  const limit = Math.min(parseInt(opts.limit) || 12, MAX_PAGE_LIMIT);

  let visibilityFilter;
  if      (viewerIsOwner)        visibilityFilter = { $in: ["public", "followers", "only_me"] };
  else if (viewerIsFollower)     visibilityFilter = { $in: ["public", "followers"] };
  else                           visibilityFilter = "public";

  const query = {
    author:     authorId,
    isDeleted:  false,
    isDraft:    false,
    visibility: visibilityFilter,
  };

  if (opts.beforeId) query._id = { $lt: opts.beforeId };

  const results = await this.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("author", "username fullName avatar isVerifiedBadge isPrivate")
    .select(LIST_SELECT);

  const hasMore    = results.length > limit;
  const items      = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore && items.length ? items[items.length - 1]._id : null;

  return { items, hasMore, nextCursor };
};

/**
 * Get reels feed — cursor-paginated, sorted by viewsCount descending.
 * FIX #1 — cursor replaces skip().
 * FIX #9 — sort covered by { type, isDeleted, viewsCount, createdAt } index.
 *
 * Uses a composite (viewsCount + _id) cursor to handle ties in viewsCount.
 *
 * @param {object}   opts
 * @param {number}   opts.limit
 * @param {number}   [opts.afterViewsCount]  — cursor: viewsCount of last item
 * @param {ObjectId} [opts.beforeId]         — cursor: _id of last item
 */
postSchema.statics.getReelsFeed = async function (opts = {}) {
  const limit = Math.min(parseInt(opts.limit) || 10, MAX_PAGE_LIMIT);

  const query = {
    type:       "reel",
    isDeleted:  false,
    isDraft:    false,
    visibility: "public",
  };

  // Composite cursor: handles ties in viewsCount correctly
  if (opts.afterViewsCount !== undefined && opts.beforeId) {
    query.$or = [
      { viewsCount: { $lt: opts.afterViewsCount } },
      { viewsCount: opts.afterViewsCount, _id: { $lt: opts.beforeId } },
    ];
  }

  const results = await this.find(query)
    .sort({ viewsCount: -1, _id: -1 })
    .limit(limit + 1)
    .populate("author", "username fullName avatar isVerifiedBadge")
    .select(LIST_SELECT);

  const hasMore = results.length > limit;
  const items   = hasMore ? results.slice(0, -1) : results;

  const lastItem   = items[items.length - 1];
  const nextCursor = hasMore && lastItem
    ? { afterViewsCount: lastItem.viewsCount, beforeId: lastItem._id }
    : null;

  return { items, hasMore, nextCursor };
};

/**
 * Get posts by hashtag — cursor-paginated.
 * FIX #1 — cursor replaces skip().
 * FIX #4 — hashtag normalized before query.
 *
 * @param {string}   hashtag        — with or without leading #
 * @param {object}   opts
 * @param {number}   opts.limit
 * @param {ObjectId} [opts.beforeId]
 */
postSchema.statics.getPostsByHashtag = async function (hashtag, opts = {}) {
  const limit         = Math.min(parseInt(opts.limit) || 20, MAX_PAGE_LIMIT);
  const normalizedTag = hashtag.toLowerCase().trim().replace(/^#+/, "");

  if (!normalizedTag) return { items: [], hasMore: false, nextCursor: null };

  const query = {
    hashtags:   normalizedTag,
    isDeleted:  false,
    isDraft:    false,
    visibility: "public",
  };

  if (opts.beforeId) query._id = { $lt: opts.beforeId };

  const results = await this.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("author", "username fullName avatar isVerifiedBadge")
    .select(LIST_SELECT);

  const hasMore    = results.length > limit;
  const items      = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore && items.length ? items[items.length - 1]._id : null;

  return { items, hasMore, nextCursor };
};

/**
 * Full-text search across captions and hashtags.
 * FIX #10 — new static method; was completely missing before.
 *           Uses combined { caption: "text", hashtags: "text" } index.
 *
 * @param {string}   q              — search term (min 2 chars)
 * @param {object}   opts
 * @param {number}   opts.limit
 * @param {ObjectId} [opts.beforeId]
 */
postSchema.statics.searchPosts = async function (q, opts = {}) {
  const term = q?.trim();
  if (!term || term.length < 2) return { items: [], hasMore: false, nextCursor: null };

  const limit  = Math.min(parseInt(opts.limit) || 20, MAX_PAGE_LIMIT);
  const filter = {
    $text:      { $search: term },
    isDeleted:  false,
    isDraft:    false,
    visibility: "public",
  };

  if (opts.beforeId) filter._id = { $lt: opts.beforeId };

  const results = await this.find(filter, { score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" }, _id: -1 })
    .limit(limit + 1)
    .populate("author", "username fullName avatar isVerifiedBadge")
    .select(LIST_SELECT);

  const hasMore    = results.length > limit;
  const items      = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore && items.length ? items[items.length - 1]._id : null;

  return { items, hasMore, nextCursor };
};

/**
 * Get a single post with full details.
 * FIX #6 — visibility check added; was returning only_me posts to anyone before.
 *
 * @param {ObjectId}      postId
 * @param {ObjectId|null} viewerId           — null for unauthenticated
 * @param {boolean}       viewerIsFollower
 */
postSchema.statics.getPostById = async function (
  postId,
  viewerId         = null,
  viewerIsFollower = false,
  { allowDraft = false } = {},
) {
  const query = { _id: postId, isDeleted: false };
  if (!allowDraft) query.isDraft = false;

  const post = await this.findOne(query)
    .populate("author",           "username fullName avatar isVerifiedBadge isPrivate")
    .populate("mentions",         "username fullName avatar")
    .populate("taggedUsers.user", "username fullName avatar");

  if (!post) return null;

  // FIX #6 — enforce visibility rules on fetch (not just on feed queries)
  const isOwner =
    viewerId && post.author._id.toString() === viewerId.toString();

  if (post.visibility === "only_me"   && !isOwner)                     return null;
  if (post.visibility === "followers" && !isOwner && !viewerIsFollower) return null;

  return post;
};

/**
 * Get user's draft posts — sorted by last edited (updatedAt).
 * FIX #13 — updatedAt sort documented; allows "resume editing" UX.
 *
 * @param {ObjectId} authorId
 * @param {object}   opts
 * @param {number}   opts.limit
 * @param {ObjectId} [opts.beforeId]
 */
postSchema.statics.getDraftPosts = async function (authorId, opts = {}) {
  const limit = Math.min(parseInt(opts.limit) || 10, MAX_PAGE_LIMIT);
  const query = { author: authorId, isDraft: true, isDeleted: false };

  if (opts.beforeId) query._id = { $lt: opts.beforeId };

  const results = await this.find(query)
    .sort({ updatedAt: -1 })
    .limit(limit + 1)
    .select(LIST_SELECT);

  const hasMore    = results.length > limit;
  const items      = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore && items.length ? items[items.length - 1]._id : null;

  return { items, hasMore, nextCursor };
};

/**
 * Soft delete a post (author-only).
 *
 * FIX #16 — CASCADE RESPONSIBILITY (service layer):
 *   After calling this, your PostService MUST also call:
 *     PostView.removeAllByPost(postId)
 *     Saved.removeAllByPost(postId)
 *     Report.removeAllByTarget(postId, "Post")
 *     Comment.removeAllByPost(postId)     ← when you build Comment model
 *     Like.removeAllByTarget(postId)      ← when you build Like model
 *   Failing to do so leaves orphaned documents in every related collection.
 *
 * @param {ObjectId} postId
 * @param {ObjectId} authorId
 */
postSchema.statics.softDelete = function (postId, authorId) {
  return this.findOneAndUpdate(
    { _id: postId, author: authorId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
    { new: true },
  );
};

/**
 * Atomically increment / decrement a count field.
 * FIX #2 — field whitelisted: prevents arbitrary field writes if field ever
 *           comes from a request (was { $inc: { [field]: value } } with no guard).
 *
 * @param {ObjectId} postId
 * @param {string}   field  — must be in COUNTABLE_FIELDS
 * @param {number}   value  — typically 1 or -1
 */
postSchema.statics.updateCount = function (postId, field, value) {
  if (!COUNTABLE_FIELDS.has(field)) {
    throw Object.assign(
      new Error(
        `Invalid count field: "${field}". Allowed: ${[...COUNTABLE_FIELDS].join(", ")}`,
      ),
      { statusCode: 400 },
    );
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw Object.assign(
      new Error("updateCount: value must be a finite number"),
      { statusCode: 400 },
    );
  }
  return this.findByIdAndUpdate(
    postId,
    { $inc: { [field]: value } },
    { new: true },
  );
};

/**
 * Get all posts mentioning a specific user.
 * FIX #12 — uses the { mentions, isDeleted } index (was missing entirely before).
 *
 * @param {ObjectId} userId
 * @param {object}   opts
 * @param {number}   opts.limit
 * @param {ObjectId} [opts.beforeId]
 */
postSchema.statics.getPostsMentioning = async function (userId, opts = {}) {
  const limit = Math.min(parseInt(opts.limit) || 20, MAX_PAGE_LIMIT);
  const query = { mentions: userId, isDeleted: false, isDraft: false };

  if (opts.beforeId) query._id = { $lt: opts.beforeId };

  const results = await this.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("author", "username fullName avatar isVerifiedBadge")
    .select(LIST_SELECT);

  const hasMore    = results.length > limit;
  const items      = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore && items.length ? items[items.length - 1]._id : null;

  return { items, hasMore, nextCursor };
};

/**
 * Remove all posts by a user (for account deletion).
 * Soft-deletes in bulk — service layer still responsible for cascading to
 * PostView, Saved, Report, Comment, Like collections.
 *
 * @param {ObjectId} authorId
 */
postSchema.statics.removeAllByAuthor = function (authorId) {
  return this.updateMany(
    { author: authorId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Model Export (hot-reload safe)
// ─────────────────────────────────────────────────────────────────────────────

const Post = models.Post || model("Post", postSchema);
export default Post;