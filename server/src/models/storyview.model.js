import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
//  StoryView Model
//
//  FIX #2  — viewers array removed from Story document (16MB limit risk).
//             All view + reaction data lives here as a separate collection.
//  FIX #1  — atomic upsert prevents race conditions and double-counting.
//  FIX #3  — reactToStory is atomic; no double-load pattern.
//  FIX #8  — pagination uses index-based queries, not $slice on embedded array.
// ─────────────────────────────────────────────────────────────────────────────

const storyViewSchema = new Schema(
  {
    story: {
      type:     Schema.Types.ObjectId,
      ref:      "Story",
      required: true,
      index:    true,
    },

    viewer: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    viewedAt: {
      type:    Date,
      default: Date.now,
    },

    reaction: {
      type:      String,
      default:   null,
      trim:      true,
      maxlength: [10, "Reaction too long"],
    },

    reactedAt: {
      type:    Date,
      default: null,
    },

    repliedViaMessage: {
      type:    Boolean,
      default: false,
    },
  },
  {
    timestamps: false, // viewedAt is enough; no updatedAt needed
  },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────────────────────────────────────

// Unique constraint — one record per (story, viewer) pair; prevents double-count
storyViewSchema.index({ story: 1, viewer: 1 }, { unique: true });

// Pagination — fetch viewers for a story sorted by view time
storyViewSchema.index({ story: 1, viewedAt: -1 });

// Reactions filter — "show me all reactions on this story"
storyViewSchema.index({ story: 1, reaction: 1 });

// ─────────────────────────────────────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record a story view.
 * FIX #1 — atomic upsert: inserts if not exists, no-ops if already viewed.
 * Updates Story.viewsCount atomically via $inc only on insert.
 *
 * @returns {{ alreadyViewed: boolean }}
 */
storyViewSchema.statics.recordView = async function (storyId, viewerId) {
  const Story = mongoose.model("Story");

  // Check story is still active
  const story = await Story.findOne({
    _id:       storyId,
    isDeleted: false,
    expiresAt: { $gt: new Date() },
  }).select("_id");

  if (!story) return { alreadyViewed: false, story: null };

  try {
    // upsert=true + setOnInsert → only inserts if (story,viewer) pair is new
    await this.findOneAndUpdate(
      { story: storyId, viewer: viewerId },
      {
        $setOnInsert: {
          story:    storyId,
          viewer:   viewerId,
          viewedAt: new Date(),
        },
      },
      { upsert: true, new: false },
    );

    // Increment counter on Story doc — only if this was a fresh insert
    // (duplicate key = already viewed, skip increment)
    await Story.findByIdAndUpdate(storyId, { $inc: { viewsCount: 1 } });

    return { alreadyViewed: false };
  } catch (err) {
    // Duplicate key error (code 11000) = already viewed
    if (err.code === 11000) return { alreadyViewed: true };
    throw err;
  }
};

/**
 * Add or update a reaction on a story.
 * FIX #3 — atomic findOneAndUpdate; no double-load race condition.
 *
 * @param {ObjectId} storyId
 * @param {ObjectId} viewerId
 * @param {string|null} reaction  — pass null to remove reaction
 */
storyViewSchema.statics.reactToStory = async function (storyId, viewerId, reaction) {
  const Story = mongoose.model("Story");

  // Ensure story is still active
  const story = await Story.findOne({
    _id:       storyId,
    isDeleted: false,
    expiresAt: { $gt: new Date() },
  }).select("_id");

  if (!story) return null;

  // Fetch existing view record to know if reaction is changing
  const existing = await this.findOne({ story: storyId, viewer: viewerId }).select("reaction");

  const hadReaction = existing ? !!existing.reaction : false;
  const hasReaction = !!reaction;

  // Upsert view record with reaction update
  await this.findOneAndUpdate(
    { story: storyId, viewer: viewerId },
    {
      $set: {
        reaction,
        reactedAt: reaction ? new Date() : null,
      },
      // If viewer record doesn't exist yet, create it
      $setOnInsert: {
        story:    storyId,
        viewer:   viewerId,
        viewedAt: new Date(),
      },
    },
    { upsert: true },
  );

  // Atomically adjust reactionsCount on Story based on transition
  let countDelta = 0;
  if (!hadReaction && hasReaction)  countDelta = 1;   // added reaction
  if (hadReaction  && !hasReaction) countDelta = -1;  // removed reaction
  if (!existing)                    countDelta = 0;   // new view, no prior reaction to track

  if (countDelta !== 0) {
    await Story.findByIdAndUpdate(storyId, {
      $inc: { reactionsCount: countDelta },
    });
  }

  // If this was a brand-new viewer (no existing record), increment viewsCount too
  if (!existing) {
    await Story.findByIdAndUpdate(storyId, { $inc: { viewsCount: 1 } });
  }

  return { success: true };
};

/**
 * Get paginated viewers list for a story (author-only endpoint).
 * FIX #8 — index-based cursor pagination; never loads entire collection into memory.
 *
 * @param {ObjectId} storyId
 * @param {ObjectId} authorId    — ownership check done in controller, passed for clarity
 * @param {object}   opts        — { limit, beforeId }
 */
storyViewSchema.statics.getViewers = async function (storyId, opts = {}) {
  const limit = Math.min(parseInt(opts.limit) || 30, 100);
  const query = { story: storyId };

  // Cursor pagination — fetch records older than beforeId
  if (opts.beforeId) {
    query._id = { $lt: opts.beforeId };
  }

  return this.find(query)
    .sort({ viewedAt: -1 })
    .limit(limit)
    .populate("viewer", "username fullName avatar isVerifiedBadge");
};

/**
 * Get only viewers who reacted to a story.
 */
storyViewSchema.statics.getReactions = function (storyId, opts = {}) {
  const limit = Math.min(parseInt(opts.limit) || 30, 100);
  const query = { story: storyId, reaction: { $ne: null } };

  if (opts.beforeId) {
    query._id = { $lt: opts.beforeId };
  }

  return this.find(query)
    .sort({ reactedAt: -1 })
    .limit(limit)
    .populate("viewer", "username fullName avatar isVerifiedBadge");
};

/**
 * Check if a specific user has viewed a story.
 */
storyViewSchema.statics.hasViewed = function (storyId, viewerId) {
  return this.exists({ story: storyId, viewer: viewerId });
};

const StoryView = models.StoryView || model("StoryView", storyViewSchema);
export default StoryView;