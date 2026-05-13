// import mongoose from "mongoose";

// const storySchema = new mongoose.Schema(
//   {
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "SocialUser",
//       required: true,
//       index: true,
//     },
//     mediaUrl: { type: String, default: "" },
//     mediaPublicId: { type: String, default: "" },
//     mediaType: {
//       type: String,
//       enum: ["image", "video", "text"],
//       required: true,
//     },
//     textContent: { type: String, default: "" },
//     textBg: { type: String, default: "#6366f1" },
//     viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
//     expiresAt: {
//       type: Date,
//       default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
//     },
//   },
//   { timestamps: true }
// );

// storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// export default mongoose.model("Story", storySchema);


import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

/** Viewer record — sirf ObjectId nahi, timestamp bhi */
const viewerSchema = new mongoose.Schema(
  {
    user:     { type: mongoose.Schema.Types.ObjectId, ref: "SocialUser", required: true },
    viewedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/** Reaction on story */
const reactionSchema = new mongoose.Schema(
  {
    user:  { type: mongoose.Schema.Types.ObjectId, ref: "SocialUser", required: true },
    emoji: { type: String, required: true, maxlength: 10 },
    at:    { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const storySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocialUser",
      required: [true, "User zaroori hai"],
      index: true,
    },

    // ── Media ─────────────────────────────────────────────────────────────────
    mediaUrl:      { type: String, default: "" },
    mediaPublicId: { type: String, default: "" },   // Cloudinary delete ke liye
    mediaType: {
      type: String,
      enum: ["image", "video", "text"],
      required: [true, "Media type zaroori hai"],
    },

    // ── Text Story ────────────────────────────────────────────────────────────
    textContent: {
      type: String,
      default: "",
      maxlength: [500, "Story text 500 characters se zyada nahi ho sakta"],
      trim: true,
    },
    textBg:   { type: String, default: "#6366f1", maxlength: 20 },
    textColor:{ type: String, default: "#ffffff", maxlength: 20 },

    // ── Engagement ────────────────────────────────────────────────────────────
    /**
     * Viewers array unbounded ho sakti thi — isliye separate docs nahi,
     * but viewer count track karo aur array cap 500 pe
     */
    viewers: {
      type: [viewerSchema],
      default: [],
    },
    viewerCount: { type: Number, default: 0 },   // fast count, array traverse nahi

    reactions: {
      type: [reactionSchema],
      default: [],
    },

    // ── Visibility ────────────────────────────────────────────────────────────
    visibility: {
      type: String,
      enum: ["public", "followers", "close_friends"],
      default: "public",
    },

    /** Specific users ko hide karo story se */
    hiddenFrom: [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],

    // ── Expiry ────────────────────────────────────────────────────────────────
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),   // 24 hours
    },
  },
  {
    timestamps: true,
    toJSON:  { virtuals: true },
    toObject:{ virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });  // TTL — auto delete
storySchema.index({ user: 1, createdAt: -1 });
storySchema.index({ createdAt: -1 });

// ─────────────────────────────────────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────────────────────────────────────

storySchema.virtual("isExpired").get(function () {
  return new Date() > this.expiresAt;
});

storySchema.virtual("reactionsCount").get(function () {
  return this.reactions?.length ?? 0;
});

// ─────────────────────────────────────────────────────────────────────────────
// Instance Methods
// ─────────────────────────────────────────────────────────────────────────────

/** Story view record karo */
storySchema.methods.addViewer = async function (userId) {
  const alreadyViewed = this.viewers.some(
    (v) => v.user.toString() === userId.toString()
  );
  if (alreadyViewed) return;

  // Array 500 se bada ho jaye toh purane viewers trim karo
  if (this.viewers.length >= 500) {
    this.viewers.shift();
  }

  this.viewers.push({ user: userId, viewedAt: new Date() });
  this.viewerCount += 1;
  await this.save({ validateBeforeSave: false });
};

/** Reaction add/update karo */
storySchema.methods.addReaction = async function (userId, emoji) {
  const existing = this.reactions.findIndex(
    (r) => r.user.toString() === userId.toString()
  );

  if (existing !== -1) {
    this.reactions[existing].emoji = emoji;   // update
  } else {
    this.reactions.push({ user: userId, emoji });
  }

  await this.save({ validateBeforeSave: false });
};

/** Reaction remove karo */
storySchema.methods.removeReaction = async function (userId) {
  this.reactions = this.reactions.filter(
    (r) => r.user.toString() !== userId.toString()
  );
  await this.save({ validateBeforeSave: false });
};

// ─────────────────────────────────────────────────────────────────────────────
// Static Methods
// ─────────────────────────────────────────────────────────────────────────────

/** Following users ki active stories */
storySchema.statics.getFeedStories = function (followingIds) {
  return this.find({
    user:      { $in: followingIds },
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .populate("user", "name username avatar")
    .lean();
};

// ─────────────────────────────────────────────────────────────────────────────

const Story = mongoose.model("Story", storySchema);
export default Story;