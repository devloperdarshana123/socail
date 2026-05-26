
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

/**
 * Allowed characters in a hashtag name (post-normalization, lowercase).
 * Supports: Latin alphanumeric, underscore, Devanagari, Arabic scripts.
 * Fix #15: at least one non-digit char required — pure-numeric tags blocked.
 */
export const HASHTAG_NAME_REGEX = /^[a-z0-9_\u0900-\u097F\u0600-\u06FF]+$/;
export const HASHTAG_EXTRACT_REGEX = /#([a-zA-Z0-9_\u0900-\u097F\u0600-\u06FF]+)/g;

/** Max hashtags processed per post — matches Post model cap */
export const MAX_HASHTAGS_PER_POST = 30;

/** Max hashtag name length */
export const MAX_HASHTAG_LENGTH = 100;

/** Chunk size for bulkWrite batches in cron jobs */
const BULK_WRITE_CHUNK_SIZE = 500;

/**
 * Escape a string for safe use in a MongoDB $regex value.
 * Fix #6: prevents ReDoS from user-supplied search queries.
 */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Normalize a raw hashtag string: strip #, lowercase, trim.
 */
const normalizeName = (raw) => raw.replace(/^#/, "").toLowerCase().trim();

/**
 * Validate a normalized hashtag name against allowed pattern.
 * Fix #15: rejects pure-numeric names.
 * Fix #16: used before upsert to filter invalid names.
 */
const isValidHashtagName = (name) => {
  if (!name || name.length < 1 || name.length > MAX_HASHTAG_LENGTH) return false;
  if (!HASHTAG_NAME_REGEX.test(name)) return false;
  // Fix #15: must contain at least one non-digit character
  if (/^[0-9]+$/.test(name)) return false;
  return true;
};

// ─────────────────────────────────────────────
//  Schema
// ─────────────────────────────────────────────

const hashtagSchema = new Schema(
  {
    // Always stored lowercase, no # symbol
    name: {
      type: String,
      required: [true, "Hashtag name is required"],
      // Fix #7: removed index: true — unique: true already creates a unique index.
      // Two indexes on the same field waste write performance and storage.
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [1, "Hashtag name too short"],
      maxlength: [MAX_HASHTAG_LENGTH, "Hashtag name too long"],
      match: [
        HASHTAG_NAME_REGEX,
        "Hashtag can only contain letters, numbers, and underscores (multilingual supported)",
      ],
    },

    // ── Usage Stats ───────────────────────────

    /** Total posts using this hashtag (denormalized counter) */
    postsCount: {
      type: Number,
      default: 0,
      min: [0, "postsCount cannot be negative"], // schema-level floor
    },

    /**
     * Posts using this hashtag in the last cron window (~1h).
     * Reset to 0 by recomputeTrendingScores cron.
     * Fix #14: also decremented on post delete via decrementCount.
     */
    recentPostsCount: {
      type: Number,
      default: 0,
      min: [0, "recentPostsCount cannot be negative"],
    },

    /**
     * Computed trending score — higher = more trending.
     * Formula: recentPostsCount * 10 + log(postsCount + 1)
     * Recomputed hourly by cron. Never written by user-facing code.
     *
     * Fix #9: NOT returned in public-facing selects (getTrending, searchHashtags).
     * Admin routes may select it explicitly.
     */
    trendingScore: {
      type: Number,
      default: 0,
    },

    lastUsedAt: {
      type: Date,
      default: () => new Date(),
    },

    // ── Content Moderation ────────────────────

    isBanned: {
      type: Boolean,
      default: false,
    },

    bannedAt: { type: Date, default: null },

    /**
     * Fix #8: bannedBy stores the admin's userId.
     * IMPORTANT: the controller/service MUST verify req.user.role === "admin"
     * before calling banHashtag(). This model cannot enforce role — it has no
     * request context. Do not call banHashtag() from non-admin routes.
     */
    bannedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
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

/**
 * Trending explore page — sort by score, filter out banned + zero-count.
 * Covers getTrending() query exactly.
 */
hashtagSchema.index(
  { isBanned: 1, postsCount: 1, trendingScore: -1 },
  { name: "trending_explore" }
);

/**
 * Prefix search — covers searchHashtags() $regex: ^query on name.
 * Fix #10: text index removed — MongoDB text search is for full-text, not prefix.
 * The unique B-tree index on `name` handles prefix regex efficiently.
 * No additional index needed here; the unique index IS the search index.
 */

/**
 * Fix #11/#12: removed standalone postsCount and lastUsedAt indexes.
 * postsCount sort in searchHashtags operates on a small filtered set (covered by name index).
 * lastUsedAt has no solo queries in any static — no index needed.
 *
 * Compound for any lastUsedAt range queries if added in future:
 * hashtagSchema.index({ isBanned: 1, lastUsedAt: -1 }, { name: "recent_activity" });
 */

// ─────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────

/** Formatted display name with # prefix */
hashtagSchema.virtual("displayName").get(function () {
  return `#${this.name}`;
});

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * upsertHashtag — create if not exists, increment counts if exists.
 *
 * Fix #4: name validated against regex BEFORE upserting — findOneAndUpdate
 *   with upsert bypasses Mongoose schema validators. Invalid names throw here
 *   instead of writing garbage to the DB.
 * Fix #5: banned hashtags are NOT incremented — checked after upsert.
 * Fix #17: returns .lean() object.
 *
 * @param {string} rawName — with or without #
 * @returns {Object|null}  — lean hashtag doc, or null if banned/invalid
 */
hashtagSchema.statics.upsertHashtag = async function (rawName) {
  const name = normalizeName(rawName);

  // Fix #4 + #16: validate before touching DB
  if (!isValidHashtagName(name)) return null;

  // Fix #5: check if banned BEFORE incrementing counts
  const existing = await this.findOne({ name }).select("isBanned").lean();
  if (existing?.isBanned) return null;

  return this.findOneAndUpdate(
    { name },
    {
      $inc: { postsCount: 1, recentPostsCount: 1 },
      $set: { lastUsedAt: new Date() },
      $setOnInsert: { name },
    },
    {
      upsert: true,
      new: true,
      // runValidators not needed — we validated manually above (more reliable)
    }
  ).lean();
};

/**
 * processHashtags — extract + upsert all hashtags from a post caption.
 *
 * Fix #1: uses bulkWrite (single round trip) instead of Promise.all
 *   with N parallel findOneAndUpdate calls. Eliminates write contention
 *   on popular hashtags under high traffic.
 * Fix #5: banned hashtags filtered before incrementing.
 * Fix #16: invalid names filtered before upsert.
 *
 * @param {string|string[]} input — caption string or array of hashtag names
 * @returns {ObjectId[]}           — array of hashtag _ids (banned excluded)
 */
hashtagSchema.statics.processHashtags = async function (input) {
  let rawNames = [];

  if (typeof input === "string") {
    const matches = [...input.matchAll(HASHTAG_EXTRACT_REGEX)];
    rawNames = matches.map((m) => m[1]);
  } else if (Array.isArray(input)) {
    rawNames = input;
  }

  // Normalize, validate, deduplicate — fix #16: invalid names filtered here
  const names = [
    ...new Set(
      rawNames
        .map(normalizeName)
        .filter(isValidHashtagName)
    ),
  ].slice(0, MAX_HASHTAGS_PER_POST);

  if (names.length === 0) return [];

  // Fix #5: fetch banned status for all names in one query
  const bannedSet = new Set(
    (await this.find({ name: { $in: names }, isBanned: true }).select("name").lean())
      .map((h) => h.name)
  );

  const allowedNames = names.filter((n) => !bannedSet.has(n));
  if (allowedNames.length === 0) return [];

  // Fix #1: single bulkWrite replaces N parallel upserts
  const now = new Date();
  const bulkOps = allowedNames.map((name) => ({
    updateOne: {
      filter: { name },
      update: {
        $inc: { postsCount: 1, recentPostsCount: 1 },
        $set: { lastUsedAt: now },
        $setOnInsert: { name },
      },
      upsert: true,
    },
  }));

  await this.bulkWrite(bulkOps, { ordered: false });

  // Fetch the resulting docs to return their _ids
  const hashtags = await this.find({ name: { $in: allowedNames } })
    .select("_id name")
    .lean();

  return hashtags.map((h) => h._id);
};

/**
 * decrementCount — decrement postsCount when a post is deleted.
 *
 * Fix #2: floor guard — postsCount cannot go below 0.
 * Fix #14: also decrements recentPostsCount (prevents false trending inflation).
 *
 * @param {ObjectId[]} hashtagIds
 * @returns {{ modifiedCount: number }}
 */
hashtagSchema.statics.decrementCount = async function (hashtagIds) {
  if (!hashtagIds?.length) return { modifiedCount: 0 };

  // Fix #2: only decrement docs where postsCount > 0
  // This prevents negative counts even on duplicate delete calls
  const result = await this.updateMany(
    { _id: { $in: hashtagIds }, postsCount: { $gt: 0 } },
    {
      $inc: { postsCount: -1, recentPostsCount: -1 }, // Fix #14
    }
  );

  // recentPostsCount floor — clamp any that went negative (edge case on rapid deletes)
  await this.updateMany(
    { _id: { $in: hashtagIds }, recentPostsCount: { $lt: 0 } },
    { $set: { recentPostsCount: 0 } }
  );

  return { modifiedCount: result.modifiedCount ?? 0 };
};

/**
 * getTrending — top hashtags for the explore page.
 *
 * Fix #9: trendingScore excluded from public response.
 *   Admin routes: call .select("+trendingScore") after this if needed,
 *   or use getHashtagStats() for internal tooling.
 *
 * @param {number} [limit=20]
 * @returns {Object[]}
 */
hashtagSchema.statics.getTrending = function (limit = 20) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  return this.find({ isBanned: false, postsCount: { $gt: 0 } })
    .sort({ trendingScore: -1, postsCount: -1 })
    .limit(safeLimit)
    .select("name postsCount displayName") // Fix #9: trendingScore excluded
    .lean();
};

/**
 * searchHashtags — prefix search for the search bar.
 *
 * Fix #6: user query is regex-escaped before building $regex — no ReDoS.
 * Fix #9: trendingScore excluded from results.
 *
 * @param {string} query
 * @param {number} [limit=10]
 * @returns {Object[]}
 */
hashtagSchema.statics.searchHashtags = function (query, limit = 10) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 50);
  const cleanQuery = escapeRegex(normalizeName(query)); // Fix #6

  if (!cleanQuery) return Promise.resolve([]);

  return this.find({
    name: { $regex: `^${cleanQuery}` }, // case-insensitive not needed — name is always lowercase
    isBanned: false,
  })
    .sort({ postsCount: -1 })
    .limit(safeLimit)
    .select("name postsCount") // Fix #9: no trendingScore in public result
    .lean();
};

/**
 * findByName — exact lookup by hashtag name.
 *
 * @param {string} name — with or without #
 * @returns {Object|null}
 */
hashtagSchema.statics.findByName = function (name) {
  return this.findOne({ name: normalizeName(name) }).lean();
};

/**
 * banHashtag — admin action.
 * Fix #8: see bannedBy field comment — caller MUST verify admin role.
 *
 * @param {ObjectId} hashtagId
 * @param {ObjectId} adminId    — must be verified as admin in controller
 * @returns {Object|null}
 */
hashtagSchema.statics.banHashtag = function (hashtagId, adminId) {
  return this.findByIdAndUpdate(
    hashtagId,
    { isBanned: true, bannedAt: new Date(), bannedBy: adminId },
    { new: true }
  ).lean();
};

/**
 * unbanHashtag — admin action.
 *
 * @param {ObjectId} hashtagId
 * @returns {Object|null}
 */
hashtagSchema.statics.unbanHashtag = function (hashtagId) {
  return this.findByIdAndUpdate(
    hashtagId,
    { isBanned: false, bannedAt: null, bannedBy: null },
    { new: true }
  ).lean();
};

/**
 * recomputeTrendingScores — hourly cron job entry point.
 *
 * Fix #3: processes in cursor batches — never loads all hashtags into heap.
 * Fix #13: bulkWrite chunked to BULK_WRITE_CHUNK_SIZE — no BSON 16MB limit breach.
 * Fix #19: returns { updated: number } for cron logging.
 *
 * Formula: trendingScore = recentPostsCount * 10 + log(postsCount + 1)
 * After scoring, recentPostsCount is reset to 0 for the next window.
 *
 * @returns {{ updated: number }}
 */
hashtagSchema.statics.recomputeTrendingScores = async function () {
  let updated = 0;
  let batch = [];

  // Fix #3: cursor — streams docs one at a time, never fills heap
  const cursor = this.find({ isBanned: false })
    .select("postsCount recentPostsCount")
    .lean()
    .cursor();

  for await (const h of cursor) {
    // Fix #2: guard against negative counts corrupting log()
    const safePostsCount = Math.max(0, h.postsCount);
    const safeRecentCount = Math.max(0, h.recentPostsCount);
    const score = safeRecentCount * 10 + Math.log(safePostsCount + 1);

    batch.push({
      updateOne: {
        filter: { _id: h._id },
        update: {
          $set: {
            trendingScore: score,
            recentPostsCount: 0, // reset window counter
          },
        },
      },
    });

    // Fix #13: flush every BULK_WRITE_CHUNK_SIZE ops — prevents BSON 16MB limit
    if (batch.length >= BULK_WRITE_CHUNK_SIZE) {
      await this.bulkWrite(batch, { ordered: false });
      updated += batch.length;
      batch = [];
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    await this.bulkWrite(batch, { ordered: false });
    updated += batch.length;
  }

  return { updated }; // Fix #19
};

/**
 * getHashtagStats — admin dashboard summary.
 * Fix #18: centralized stats instead of scattered controller aggregations.
 *
 * @returns {{ total, banned, active, avgPostsCount, topByUsage[] }}
 */
hashtagSchema.statics.getHashtagStats = async function () {
  const [counts, topByUsage] = await Promise.all([
    this.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          banned: { $sum: { $cond: ["$isBanned", 1, 0] } },
          avgPostsCount: { $avg: "$postsCount" },
        },
      },
    ]),
    this.find({ isBanned: false })
      .sort({ postsCount: -1 })
      .limit(10)
      .select("name postsCount trendingScore") // admin route — trendingScore included
      .lean(),
  ]);

  const stats = counts[0] ?? { total: 0, banned: 0, avgPostsCount: 0 };
  return {
    total: stats.total,
    banned: stats.banned,
    active: stats.total - stats.banned,
    avgPostsCount: Math.round(stats.avgPostsCount ?? 0),
    topByUsage,
  };
};

/**
 * getBulkByNames — fetch multiple hashtags by name in one query.
 * Useful for post display: resolve hashtag names → full docs.
 *
 * @param {string[]} names — normalized or raw names
 * @returns {Object[]}
 */
hashtagSchema.statics.getBulkByNames = function (names) {
  const normalized = names.map(normalizeName).filter(Boolean);
  if (!normalized.length) return Promise.resolve([]);
  return this.find({ name: { $in: normalized } }).select("name postsCount isBanned").lean();
};

// ─────────────────────────────────────────────
//  Model Export
// ─────────────────────────────────────────────

const Hashtag = models.Hashtag || model("Hashtag", hashtagSchema);
export default Hashtag;