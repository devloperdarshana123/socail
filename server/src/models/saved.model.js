import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Saved (Bookmark) Schema
//  One document per (user + post) — unique
// ─────────────────────────────────────────────

const savedSchema = new Schema(
  {
    savedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "savedBy is required"],
      index: true,
    },

    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: [true, "post is required"],
      index: true,
    },
  },
  { timestamps: true }
);

// One user can save a post only once
savedSchema.index({ savedBy: 1, post: 1 }, { unique: true });

// Fetch all saved posts of a user (sorted newest first)
savedSchema.index({ savedBy: 1, createdAt: -1 });

// ─────────────────────────────────────────────
//  Statics
// ─────────────────────────────────────────────

/** Toggle save — returns { saved: boolean } */
savedSchema.statics.toggleSave = async function (userId, postId) {
  const existing = await this.findOne({ savedBy: userId, post: postId });

  if (existing) {
    await existing.deleteOne();
    return { saved: false };
  }

  await this.create({ savedBy: userId, post: postId });
  return { saved: true };
};

/** Check if user has saved a post */
savedSchema.statics.hasSaved = async function (userId, postId) {
  const doc = await this.findOne({ savedBy: userId, post: postId });
  return !!doc;
};

/** Bulk check — which postIds has the user saved */
savedSchema.statics.getBulkSaveStatus = async function (userId, postIds) {
  const saved = await this.find({
    savedBy: userId,
    post: { $in: postIds },
  }).select("post");
  return new Set(saved.map((s) => s.post.toString()));
};

/** Get saved posts for a user (paginated) */
savedSchema.statics.getSavedPosts = async function (userId, page = 1, limit = 12) {
  const results = await this.find({ savedBy: userId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate({
      path: "post",
      match: { isDeleted: false, isDraft: false },
      select: "media type likesCount commentsCount viewsCount caption createdAt author",
      populate: { path: "author", select: "username fullName avatar" },
    });

  // null posts filter karo (deleted/draft posts ki jagah null aata hai)
  return results.filter((s) => s.post !== null);
};

const Saved = models.Saved || model("Saved", savedSchema);
export default Saved;