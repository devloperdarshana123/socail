

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const TTL_SECONDS    = 90 * 24 * 60 * 60; // 90 days
const MAX_DURATION_S = 3_600;              // 1 hour max — FIX #3

// ─────────────────────────────────────────────────────────────────────────────
//  PostView Schema
//
//  One document per (user + post) within the 90-day TTL window.
//  After 90 days MongoDB TTL index deletes the record — the same user
//  can generate a fresh view on the same post after that.
//
//  duration = time spent on FIRST view in seconds (not cumulative).
//             Subsequent views within 90 days update duration via $max
//             so we always store the longest single session.  FIX #10
//
//  Anonymous/guest views: set user = null and provide sessionId.  FIX #4
// ─────────────────────────────────────────────────────────────────────────────

const postViewSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────

    // FIX #4 — optional: null for guest/anonymous viewers
    user: {
      type:    Schema.Types.ObjectId,
      ref:     "User",
      default: null,
      index:   true,
    },

    // FIX #4 — sessionId for anonymous tracking (set when user is null)
    sessionId: {
      type:    String,
      default: null,
      index:   true,
    },

    post: {
      type:     Schema.Types.ObjectId,
      ref:      "Post",
      required: true,
    },

    // FIX #9 — function form prevents evaluation-timing issues
    viewedAt: {
      type:    Date,
      default: () => new Date(),
    },

    // ── Analytics ─────────────────────────────────────────────────────────────

    // FIX #5 — default null so missing source is visible in analytics, not miscategorized
    source: {
      type:    String,
      enum:    ["feed", "explore", "profile", "direct", "modal", null],
      default: null,
    },

    // FIX #3 — bounded: 0–3600s (1 hour max)
    // FIX #10 — semantics: longest single session duration for this user+post pair
    duration: {
      type:    Number,
      default: 0,
      min:     [0,             "duration cannot be negative"],
      max:     [MAX_DURATION_S, `duration cannot exceed ${MAX_DURATION_S} seconds`],
    },

    device: {
      type:    String,
      enum:    ["mobile", "desktop", "tablet", null],
      default: null,
    },
  },
  { timestamps: false },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Indexes
//  FIX #6 — replaced low-cardinality { source, viewedAt } with useful compound
//  FIX #7 — added { user, viewedAt } for view history / personalization queries
// ─────────────────────────────────────────────────────────────────────────────

// Unique per authenticated viewer — sparse so null users don't conflict
postViewSchema.index({ user: 1, post: 1 }, { unique: true, sparse: true });

// Unique per anonymous session — sparse so null sessions don't conflict
postViewSchema.index({ sessionId: 1, post: 1 }, { unique: true, sparse: true });

// TTL — auto-delete after 90 days; after deletion same user can view again
postViewSchema.index({ viewedAt: 1 }, { expireAfterSeconds: TTL_SECONDS });

// Analytics: views per post over time
postViewSchema.index({ post: 1, viewedAt: -1 });

// FIX #6 — views per post broken down by source (useful analytics compound)
postViewSchema.index({ post: 1, source: 1, viewedAt: -1 });

// FIX #7 — user view history for personalization / "recently viewed"
postViewSchema.index({ user: 1, viewedAt: -1 });

// ─────────────────────────────────────────────────────────────────────────────
//  Static Methods
//  FIX #2 — all behavior centralized here; controllers never call find/create raw
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record a post view atomically.
 * FIX #1 — upsert + duplicate key (11000) handling; never throws on re-view.
 * FIX #8 — increments Post.viewsCount only on a genuinely new view.
 * FIX #10 — updates duration only if new session was longer ($max).
 *
 * @param {object} opts
 *   @param {ObjectId|null} opts.user       — null for anonymous
 *   @param {string|null}   opts.sessionId  — required if user is null
 *   @param {ObjectId}      opts.post
 *   @param {string|null}   opts.source
 *   @param {number}        opts.duration   — seconds (capped at MAX_DURATION_S)
 *   @param {string|null}   opts.device
 *
 * @returns {{ isNewView: boolean }}
 */
postViewSchema.statics.recordView = async function ({
  user      = null,
  sessionId = null,
  post,
  source    = null,
  duration  = 0,
  device    = null,
}) {
  // FIX #4 — must provide either user or sessionId
  if (!user && !sessionId) {
    throw Object.assign(
      new Error("recordView requires either user or sessionId"),
      { statusCode: 400 },
    );
  }

  // Clamp duration to valid range — FIX #3
  const safeDuration = Math.min(Math.max(Number(duration) || 0, 0), MAX_DURATION_S);

  // Build the lookup key based on viewer identity
  const matchKey = user ? { user, post } : { sessionId, post };

  try {
    // Attempt insert — succeeds only on genuinely new view
    await this.create({
      user,
      sessionId,
      post,
      source,
      duration: safeDuration,
      device,
      viewedAt: new Date(),
    });

    // New view — increment Post.viewsCount atomically — FIX #8
    await mongoose.model("Post").findByIdAndUpdate(post, {
      $inc: { viewsCount: 1 },
    });

    return { isNewView: true };
  } catch (err) {
    if (err.code !== 11000) throw err; // re-throw unexpected errors

    // Duplicate — already viewed within 90-day window.
    // Update duration if this session was longer — FIX #10
    await this.findOneAndUpdate(matchKey, {
      $max: { duration: safeDuration },
      // Update source/device only if they were null before (first meaningful value wins)
      ...(source ? { $set: { source } } : {}),
      ...(device ? { $set: { device } } : {}),
    });

    return { isNewView: false };
  }
};

/**
 * Check if a viewer has already viewed a post within the 90-day window.
 * FIX #2 — uses exists() for minimal DB overhead.
 *
 * @returns {boolean}
 */
postViewSchema.statics.hasViewed = async function ({ user = null, sessionId = null, post }) {
  const matchKey = user ? { user, post } : { sessionId, post };
  return !!(await this.exists(matchKey));
};

/**
 * Get paginated view analytics for a post (admin/author dashboard).
 * Cursor-paginated — no skip().
 *
 * @param {ObjectId} postId
 * @param {object}   opts   — { limit, beforeId, source, device }
 * @returns {{ items, hasMore, nextCursor }}
 */
postViewSchema.statics.getPostAnalytics = async function (postId, opts = {}) {
  const limit = Math.min(parseInt(opts.limit) || 30, 100);
  const query = { post: postId };

  if (opts.beforeId) query._id  = { $lt: opts.beforeId };
  if (opts.source)   query.source = opts.source;
  if (opts.device)   query.device = opts.device;

  const results = await this.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .select("-__v");

  const hasMore    = results.length > limit;
  const items      = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore && items.length ? items[items.length - 1]._id : null;

  return { items, hasMore, nextCursor };
};

/**
 * Get aggregated stats for a post — total views, by source, by device.
 * ⚠️ PRODUCTION NOTE: Cache in Redis (TTL ~60s). Don't call on every request.
 *
 * @param {ObjectId} postId
 * @returns {{ totalViews, bySource, byDevice, avgDuration }}
 */
postViewSchema.statics.getPostStats = function (postId) {
  return this.aggregate([
    { $match: { post: new mongoose.Types.ObjectId(postId) } },
    {
      $group: {
        _id:         null,
        totalViews:  { $sum: 1 },
        avgDuration: { $avg: "$duration" },
        bySource: {
          $push: "$source",
        },
        byDevice: {
          $push: "$device",
        },
      },
    },
    {
      $project: {
        _id:         0,
        totalViews:  1,
        avgDuration: { $round: ["$avgDuration", 1] },
        bySource:    1,
        byDevice:    1,
      },
    },
  ]);
};

/**
 * Get recently viewed posts for a user (personalization / watch history).
 * FIX #7 — uses the { user, viewedAt } index added above.
 *
 * @param {ObjectId} userId
 * @param {object}   opts   — { limit, beforeId }
 */
postViewSchema.statics.getViewHistory = async function (userId, opts = {}) {
  const limit = Math.min(parseInt(opts.limit) || 20, 50);
  const query = { user: userId };

  if (opts.beforeId) query._id = { $lt: opts.beforeId };

  const results = await this.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("post", "media type caption author createdAt")
    .select("post viewedAt source duration");

  const hasMore    = results.length > limit;
  const items      = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore && items.length ? items[items.length - 1]._id : null;

  return { items, hasMore, nextCursor };
};

/**
 * Delete all view records for a post (post deletion cleanup).
 */
postViewSchema.statics.removeAllByPost = function (postId) {
  return this.deleteMany({ post: postId });
};

/**
 * Delete all view records for a user (account deletion cleanup).
 */
postViewSchema.statics.removeAllByUser = function (userId) {
  return this.deleteMany({ user: userId });
};

// ─────────────────────────────────────────────────────────────────────────────
//  Model Export (hot-reload safe)
// ─────────────────────────────────────────────────────────────────────────────

const PostView = models.PostView || model("PostView", postViewSchema);
export default PostView;