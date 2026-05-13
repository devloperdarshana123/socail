import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Hashtag Schema
//
//  Hashtags are extracted from post/story captions
//  in the service layer and upserted here.
//  trendingScore is computed periodically (cron job)
//  based on recent usage velocity.
// ─────────────────────────────────────────────

const hashtagSchema = new Schema(
  {
    // ── Name ──────────────────────────────────
    // Always stored lowercase, no # symbol
    name: {
      type: String,
      required: [true, "Hashtag name is required"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [1, "Hashtag name too short"],
      maxlength: [100, "Hashtag name too long"],
      match: [
        /^[a-z0-9_\u0900-\u097F\u0600-\u06FF]+$/,
        "Hashtag can only contain letters, numbers, and underscores (multilingual supported)",
      ],
      index: true,
    },

    // ── Usage Stats ───────────────────────────
    postsCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    // Posts in the last 24h — used for trending calc
    recentPostsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Computed trending score (higher = more trending)
    // Reset & recomputed by a cron job every hour
    trendingScore: {
      type: Number,
      default: 0,
      index: true,
    },

    lastUsedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // ── Content Moderation ────────────────────
    isBanned: {
      type: Boolean,
      default: false,
      index: true,
    },

    bannedAt: {
      type: Date,
      default: null,
    },

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

// Trending explore page — top hashtags by score
hashtagSchema.index({ trendingScore: -1, postsCount: -1 });

// Search bar — text search on name
hashtagSchema.index({ name: "text" });

// Recent activity filter
hashtagSchema.index({ lastUsedAt: -1 });

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
 * Upsert a hashtag — create if not exists, update counts if exists
 * Call this when a post with hashtags is created
 * @param {string} name — raw hashtag string (with or without #)
 * @returns {Document} hashtag
 */
hashtagSchema.statics.upsertHashtag = async function (name) {
  const cleanName = name.replace(/^#/, "").toLowerCase().trim();

  return this.findOneAndUpdate(
    { name: cleanName },
    {
      $inc: { postsCount: 1, recentPostsCount: 1 },
      $set: { lastUsedAt: new Date() },
      $setOnInsert: { name: cleanName },
    },
    { upsert: true, new: true }
  );
};

/**
 * Upsert multiple hashtags at once (for post creation)
 * Extracts hashtags from caption string OR accepts array of names
 * @param {string|string[]} input — caption string or array of hashtag names
 * @returns {ObjectId[]} array of hashtag IDs
 */
hashtagSchema.statics.processHashtags = async function (input) {
  let names = [];

  if (typeof input === "string") {
    // Extract from caption
    const matches = input.match(/#([a-zA-Z0-9_\u0900-\u097F\u0600-\u06FF]+)/g) || [];
    names = matches.map((tag) => tag.replace(/^#/, "").toLowerCase());
  } else if (Array.isArray(input)) {
    names = input.map((t) => t.replace(/^#/, "").toLowerCase());
  }

  // Deduplicate
  const uniqueNames = [...new Set(names)].slice(0, 30); // max 30 hashtags per post

  if (uniqueNames.length === 0) return [];

  const hashtags = await Promise.all(
    uniqueNames.map((name) => this.upsertHashtag(name))
  );

  return hashtags
    .filter((h) => !h.isBanned)   // exclude banned hashtags
    .map((h) => h._id);
};

/**
 * Decrement postsCount when a post is deleted
 */
hashtagSchema.statics.decrementCount = function (hashtagIds) {
  return this.updateMany(
    { _id: { $in: hashtagIds } },
    { $inc: { postsCount: -1 } }
  );
};

/**
 * Get trending hashtags (explore page)
 */
hashtagSchema.statics.getTrending = function (limit = 20) {
  return this.find({ isBanned: false, postsCount: { $gt: 0 } })
    .sort({ trendingScore: -1, postsCount: -1 })
    .limit(limit)
    .select("name postsCount trendingScore");
};

/**
 * Search hashtags by name (search bar)
 */
hashtagSchema.statics.searchHashtags = function (query, limit = 10) {
  const cleanQuery = query.replace(/^#/, "").toLowerCase().trim();
  return this.find({
    name: { $regex: `^${cleanQuery}`, $options: "i" },
    isBanned: false,
  })
    .sort({ postsCount: -1 })
    .limit(limit)
    .select("name postsCount trendingScore");
};

/**
 * Find hashtag by exact name
 */
hashtagSchema.statics.findByName = function (name) {
  const cleanName = name.replace(/^#/, "").toLowerCase().trim();
  return this.findOne({ name: cleanName });
};

/**
 * Ban a hashtag (admin)
 */
hashtagSchema.statics.banHashtag = function (hashtagId, adminId) {
  return this.findByIdAndUpdate(
    hashtagId,
    { isBanned: true, bannedAt: new Date(), bannedBy: adminId },
    { new: true }
  );
};

/**
 * Unban a hashtag (admin)
 */
hashtagSchema.statics.unbanHashtag = function (hashtagId) {
  return this.findByIdAndUpdate(
    hashtagId,
    { isBanned: false, bannedAt: null, bannedBy: null },
    { new: true }
  );
};

/**
 * Recompute trendingScore for all hashtags
 * Called by a cron job (e.g., every hour)
 * Score = recentPostsCount * 10 + log(postsCount + 1)
 */
hashtagSchema.statics.recomputeTrendingScores = async function () {
  const hashtags = await this.find({ isBanned: false }).select(
    "postsCount recentPostsCount"
  );

  const bulkOps = hashtags.map((h) => ({
    updateOne: {
      filter: { _id: h._id },
      update: {
        $set: {
          trendingScore:
            h.recentPostsCount * 10 + Math.log(h.postsCount + 1),
        },
        $set: { recentPostsCount: 0 }, // reset for next window
      },
    },
  }));

  if (bulkOps.length > 0) {
    await this.bulkWrite(bulkOps);
  }
};

const Hashtag = models.Hashtag || model("Hashtag", hashtagSchema);
export default Hashtag;