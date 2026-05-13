import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Sub-schema: Cloudinary Media
// ─────────────────────────────────────────────
const cloudinaryMediaSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true }, // for Cloudinary deletion
    resourceType: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
    width: Number,
    height: Number,
    duration: Number, // seconds (for video)
    thumbnailUrl: String, // auto-generated thumbnail for video
  },
  { _id: false }
);

// ─────────────────────────────────────────────
//  Sub-schema: Story Viewer
//  Tracks who viewed + optional reaction
// ─────────────────────────────────────────────
const viewerSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    viewedAt: {
      type: Date,
      default: Date.now,
    },

    // Reaction (like Instagram story react)
 reaction: {
  type: String,
  default: null,
  trim: true,
},
    reactedAt: {
      type: Date,
      default: null,
    },

    // If viewer replied via DM to this story
    repliedViaMessage: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
//  Story Schema
// ─────────────────────────────────────────────
const storySchema = new Schema(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Story author is required"],
      index: true,
    },

    // ── Media ──────────────────────────────────
  media: {
  type: cloudinaryMediaSchema,
  required: false,
  default: null,
},
    // media field ke baad add karo:
textContent: {
  text:       { type: String, trim: true, maxlength: 200 },
  background: { type: String, default: "linear-gradient(135deg, #667eea, #764ba2)" },
  textAlign:  { type: String, enum: ["left", "center", "right"], default: "center" },
  textColor:  { type: String, default: "#ffffff" },
},

type: {
  type: String,
  enum: ["media", "text"],
  default: "media",
},

    // ── Caption / Text overlay ─────────────────
    caption: {
      type: String,
      trim: true,
      maxlength: [200, "Caption cannot exceed 200 characters"],
      default: "",
    },

    // ── Visibility ─────────────────────────────
    audience: {
      type: String,
      enum: ["public", "followers", "close_friends"],
      default: "followers",
      index: true,
    },

    // Close friends list snapshot (if audience = close_friends)
    closeFriends: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },

    // ── Engagement ─────────────────────────────
    viewers: {
      type: [viewerSchema],
      default: [],
      select: false, // don't load viewers by default (can be large)
    },

    viewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    reactionsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Story Link (swipe-up style) ─────────────
    linkUrl: {
      type: String,
      trim: true,
      default: null,
    },

    // ── Mention tags in story ───────────────────
    mentions: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },

    // ── Hashtags in story ───────────────────────
    hashtags: {
      type: [{ type: Schema.Types.ObjectId, ref: "Hashtag" }],
      default: [],
    },

    // ── Soft Delete ────────────────────────────
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    // ── TTL: auto-expire after 24 hours ─────────
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─────────────────────────────────────────────
//  TTL Index — MongoDB auto-deletes after expiresAt
// ─────────────────────────────────────────────
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─────────────────────────────────────────────
//  Other Indexes
// ─────────────────────────────────────────────
storySchema.index({ author: 1, isDeleted: 1, expiresAt: -1 });
storySchema.index({ author: 1, createdAt: -1 });

// ─────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────

/** Is the story still active (not expired, not deleted) */
storySchema.virtual("isActive").get(function () {
  return !this.isDeleted && this.expiresAt > new Date();
});

/** Seconds remaining before story expires */
storySchema.virtual("expiresInSeconds").get(function () {
  const diff = this.expiresAt - new Date();
  return diff > 0 ? Math.floor(diff / 1000) : 0;
});

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * Get active stories for a user (not expired, not deleted)
 */
storySchema.statics.getActiveStoriesForUser = function (userId) {
  return this.find({
    author: userId,
    isDeleted: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

/**
 * Get stories feed — active stories from following list
 * @param {ObjectId[]} followingIds — list of user IDs the viewer follows
 * @param {ObjectId} viewerId — to filter audience
 */
storySchema.statics.getFeedStories = function (followingIds, viewerId) {
  return this.find({
    author: { $in: followingIds },
    isDeleted: false,
    expiresAt: { $gt: new Date() },
    $or: [
      { audience: "public" },
      { audience: "followers" },
      { audience: "close_friends", closeFriends: viewerId },
    ],
  })
    .sort({ createdAt: -1 })
    .populate("author", "username fullName avatar isVerifiedBadge");
};

/**
 * Record a story view (upsert — won't double count)
 */
storySchema.statics.recordView = async function (storyId, viewerId) {
  const story = await this.findOne({
    _id: storyId,
    isDeleted: false,
    expiresAt: { $gt: new Date() },
  }).select("+viewers");

  if (!story) return null;

  const alreadyViewed = story.viewers?.some(
    (v) => v.user?.toString() === viewerId.toString()
  );

  if (!alreadyViewed) {
    story.viewers.push({ user: viewerId });
    story.viewsCount += 1;
    await story.save({ validateBeforeSave: false });
  }

  return story;
};

/**
 * Add or update a reaction to a story
 */
storySchema.statics.reactToStory = async function (storyId, viewerId, reaction) {
  const story = await this.findOne({
    _id: storyId,
    isDeleted: false,
    expiresAt: { $gt: new Date() },
  }).select("+viewers");

  if (!story) return null;


   const viewerEntry = story.viewers?.find(
    (v) => v.user?.toString() === viewerId.toString()
  );

  if (viewerEntry) {
    const hadReaction = !!viewerEntry.reaction;
    viewerEntry.reaction = reaction;
    viewerEntry.reactedAt = new Date();
    if (!hadReaction && reaction) story.reactionsCount += 1;
    if (hadReaction && !reaction) story.reactionsCount = Math.max(0, story.reactionsCount - 1);
  } else {
    // Viewer not recorded yet — add with reaction
    story.viewers.push({ user: viewerId, reaction, reactedAt: new Date() });
    story.viewsCount += 1;
    if (reaction) story.reactionsCount += 1;
  }

  await story.save({ validateBeforeSave: false });
  return story;
};

/**
 * Soft delete a story (manual delete by author)
 */
storySchema.statics.softDelete = function (storyId, authorId) {
  return this.findOneAndUpdate(
    { _id: storyId, author: authorId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
    { new: true }
  );
};

/**
 * Get viewers list for a story (author only)
 */
storySchema.statics.getViewers = function (storyId, authorId, page = 1, limit = 30) {
  return this.findOne({ _id: storyId, author: authorId })
    .select("viewers viewsCount reactionsCount")
    .slice("viewers", [(page - 1) * limit, limit]);
};

const Story = models.Story || model("Story", storySchema);
export default Story;