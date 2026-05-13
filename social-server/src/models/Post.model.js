// import mongoose from "mongoose";

// const postSchema = new mongoose.Schema(
//   {
//     author: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "SocialUser",
//       required: true,
//     },
//     caption: { type: String, default: "" },
//     image:   { type: String, default: "" },
//     video:   { type: String, default: "" },
//     tags:    [{ type: String }],
//     likes:   [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
//     savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
//    comments: [
//   {
//     user: { type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" },
//     text: { type: String, required: true },
//     likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }], // ✅ comment like
//     replies: [                                                              // ✅ nested replies
//       {
//         user: { type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" },
//         text: { type: String, required: true },
//         likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
//         createdAt: { type: Date, default: Date.now },
//       },
//     ],
//     createdAt: { type: Date, default: Date.now },
//   },
// ],
//     views:         { type: Number, default: 0 },
//     isSuspended:   { type: Boolean, default: false },
//     suspendedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "SocialUser", default: null },
//     suspendReason: { type: String, default: "" },
//   },
//   { timestamps: true }
// );

// const Post = mongoose.model("Post", postSchema);
// export default Post;



import mongoose from "mongoose";
import validator from "validator";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

/** Cloudinary media — url + publicId */
const mediaSchema = new mongoose.Schema(
  {
    url:       { type: String, default: "" },
    publicId:  { type: String, default: "" },
    mediaType: { type: String, enum: ["image", "video"], default: "image" },
  },
  { _id: false }
);

/** Reply inside a comment */
const replySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocialUser",
      required: true,
    },
    text: {
      type: String,
      required: [true, "Reply text zaroori hai"],
      trim: true,
      maxlength: [1000, "Reply 1000 characters se zyada nahi ho sakti"],
    },
    likes:    [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
    isDeleted:{ type: Boolean, default: false },
  },
  { timestamps: true }
);

/** Comment */
const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocialUser",
      required: true,
    },
    text: {
      type: String,
      required: [true, "Comment text zaroori hai"],
      trim: true,
      maxlength: [1000, "Comment 1000 characters se zyada nahi ho sakta"],
    },
    likes:     [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
    replies:   [replySchema],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocialUser",
      required: [true, "Author zaroori hai"],
      index: true,
    },

    // ── Content ───────────────────────────────────────────────────────────────
    caption: {
      type: String,
      default: "",
      trim: true,
      maxlength: [2200, "Caption 2200 characters se zyada nahi ho sakta"],
    },

    /** Multiple media support — ek post mein max 10 images/videos */
    media: {
      type: [mediaSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: "Ek post mein zyada se zyada 10 media files allowed hain",
      },
    },

    postType: {
      type: String,
      enum: ["image", "video", "text", "mixed"],
      default: "text",
    },

    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 30,
        message: "Zyada se zyada 30 tags allowed hain",
      },
    },

    // ── Engagement ────────────────────────────────────────────────────────────
    likes:    [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
    savedBy:  [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
    comments: [commentSchema],
    views:    { type: Number, default: 0, min: 0 },

    // ── Moderation ────────────────────────────────────────────────────────────
    isSuspended:   { type: Boolean, default: false },
    suspendedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "SocialUser", default: null },
    suspendReason: { type: String, default: "" },
    suspendedAt:   { type: Date, default: null },

    /** Soft delete */
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },

    /** Visibility */
    visibility: {
      type: String,
      enum: ["public", "followers", "only_me"],
      default: "public",
    },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────────────────────────────────────

postSchema.virtual("likesCount").get(function () {
  return this.likes?.length ?? 0;
});

postSchema.virtual("commentsCount").get(function () {
  return this.comments?.filter((c) => !c.isDeleted).length ?? 0;
});

postSchema.virtual("savedCount").get(function () {
  return this.savedBy?.length ?? 0;
});

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ isDeleted: 1, isSuspended: 1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ "likes": 1 });

// ─────────────────────────────────────────────────────────────────────────────
// Instance Methods
// ─────────────────────────────────────────────────────────────────────────────

/** Like toggle — atomic */
postSchema.methods.toggleLike = async function (userId) {
  const id      = userId.toString();
  const liked   = this.likes.map((l) => l.toString()).includes(id);

  if (liked) {
    this.likes.pull(userId);
  } else {
    this.likes.addToSet(userId);
  }

  await this.save({ validateBeforeSave: false });
  return !liked;   // true = liked, false = unliked
};

/** Soft delete */
postSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save({ validateBeforeSave: false });
};

/** Suspend post */
postSchema.methods.suspendPost = async function (by, reason) {
  this.isSuspended   = true;
  this.suspendedBy   = by;
  this.suspendReason = reason;
  this.suspendedAt   = new Date();
  await this.save({ validateBeforeSave: false });
};

/** Comment add karo */
postSchema.methods.addComment = async function (userId, text) {
  this.comments.push({ user: userId, text });
  await this.save({ validateBeforeSave: false });
  return this.comments[this.comments.length - 1];
};

/** Comment delete (soft) */
postSchema.methods.deleteComment = async function (commentId, userId) {
  const comment = this.comments.id(commentId);
  if (!comment) throw new Error("Comment nahi mila");
  if (comment.user.toString() !== userId.toString()) throw new Error("Ye aapka comment nahi hai");
  comment.isDeleted = true;
  await this.save({ validateBeforeSave: false });
};

// ─────────────────────────────────────────────────────────────────────────────
// Static Methods
// ─────────────────────────────────────────────────────────────────────────────

/** Feed ke liye — author IDs list se posts */
postSchema.statics.getFeed = function (authorIds, { page = 1, limit = 20 } = {}) {
  return this.find({
    author:      { $in: authorIds },
    isDeleted:   false,
    isSuspended: false,
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("author", "name username avatar")
    .lean();
};

/** Tag se posts dhundo */
postSchema.statics.findByTag = function (tag, { page = 1, limit = 20 } = {}) {
  return this.find({
    tags:        tag.toLowerCase(),
    isDeleted:   false,
    isSuspended: false,
    visibility:  "public",
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("author", "name username avatar")
    .lean();
};

// ─────────────────────────────────────────────────────────────────────────────

const Post = mongoose.model("Post", postSchema);
export default Post;