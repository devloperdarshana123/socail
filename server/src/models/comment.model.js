import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Comment Schema
//
//  Threading logic:
//    Top-level comment  → parentComment: null,  rootComment: null,  depth: 0
//    Reply to comment   → parentComment: <id>,  rootComment: <id>,  depth: 1
//    Reply to reply     → parentComment: <id>,  rootComment: <same root>, depth: 2+
//
//  We store rootComment so we can efficiently fetch
//  all replies under a top-level comment in one query.
// ─────────────────────────────────────────────

const commentSchema = new Schema(
  {
    // ── References ────────────────────────────
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: [true, "Comment must belong to a post"],
      index: true,
    },

    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Comment author is required"],
      index: true,
    },

    // null  → top-level comment
    // <id>  → direct parent (could be a reply too)
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },

    // Always points to the top-level comment
    // null for top-level comments themselves
    rootComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },

    // ── Threading depth ───────────────────────
    depth: {
      type: Number,
      default: 0,
      min: 0,
      max: 5, // cap nesting to prevent abuse
    },

    // ── Content ───────────────────────────────
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      minlength: [1, "Comment cannot be empty"],
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
    },

    // ── Mentions inside comment ────────────────
   mentions: {
  type: [{ type: Schema.Types.ObjectId, ref: "User" }],
  default: [],
  validate: {
    validator: function (v) { return v.length <= 10; },
    message: "Cannot mention more than 10 users in a comment",
  },
},

    // ── Engagement ────────────────────────────
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Denormalized reply count (only for top-level / depth-0 comments)
    repliesCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Pinned (post author can pin one comment) ─
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ── Soft Delete ───────────────────────────
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    // When soft-deleted, content is replaced with placeholder
    // but document stays so replies remain visible
    deletedContent: {
      type: String,
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

// Fetch top-level comments for a post (paginated)
commentSchema.index({ post: 1, parentComment: 1, isDeleted: 1, createdAt: -1 });

// Fetch all replies under a root comment
commentSchema.index({ rootComment: 1, isDeleted: 1, createdAt: 1 });

// Pinned comment fetch
commentSchema.index({ post: 1, isPinned: 1 });

// Author's comments (for profile / moderation)
commentSchema.index({ author: 1, createdAt: -1 });

// ─────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────

/** True if this is a top-level comment */
commentSchema.virtual("isTopLevel").get(function () {
  return this.parentComment === null || this.parentComment === undefined;
});

/** Display content — shows placeholder if deleted */
commentSchema.virtual("displayContent").get(function () {
  if (this.isDeleted) return "This comment was deleted";
  return this.content;
});

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * Get top-level comments for a post (paginated)
 * Pinned comment always first
 */
commentSchema.statics.getTopLevelComments = function (postId, page = 1, limit = 20) {
  return this.find({
    post: postId,
    parentComment: null,
    isDeleted: false,
  })
    .sort({ isPinned: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("author", "username fullName avatar isVerifiedBadge")
    .populate("mentions", "username");
};

/**
 * Get all replies under a root (top-level) comment — threaded
 * Returns flat list ordered by createdAt ASC (oldest first)
 */
commentSchema.statics.getReplies = function (rootCommentId, page = 1, limit = 10) {
  return this.find({
    rootComment: rootCommentId,
    isDeleted: false,
  })
    .sort({ createdAt: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("author", "username fullName avatar isVerifiedBadge")
    .populate("parentComment", "author content") // show who they replied to
    .populate("mentions", "username");
};

/**
 * Get direct replies to a specific comment
 */
commentSchema.statics.getDirectReplies = function (parentCommentId, page = 1, limit = 10) {
  return this.find({
    parentComment: parentCommentId,
    isDeleted: false,
  })
    .sort({ createdAt: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("author", "username fullName avatar isVerifiedBadge")
    .populate("mentions", "username");
};

/**
 * Create a new comment or reply with auto depth + rootComment resolution
 */
commentSchema.statics.createComment = async function ({
  postId,
  authorId,
  content,
  mentions = [],
  parentCommentId = null,
}) {
  let depth = 0;
  let rootComment = null;

  if (parentCommentId) {
    const parent = await this.findById(parentCommentId).select("depth rootComment parentComment");
    if (!parent) throw new Error("Parent comment not found");

    depth = Math.min(parent.depth + 1, 5); // cap at depth 5

    // rootComment is always the original top-level comment
    rootComment = parent.rootComment || parent._id;

    // Increment replies count on root comment only
    await this.findByIdAndUpdate(rootComment, { $inc: { repliesCount: 1 } });
  }

  const comment = await this.create({
    post: postId,
    author: authorId,
    content,
    mentions,
    parentComment: parentCommentId,
    rootComment,
    depth,
  });

  return comment.populate("author", "username fullName avatar isVerifiedBadge");
};

/**
 * Soft delete a comment
 * Content replaced with placeholder, replies remain visible
 */
commentSchema.statics.softDelete = async function (commentId, authorId) {
  const comment = await this.findOne({
    _id: commentId,
    author: authorId,
    isDeleted: false,
  });

  if (!comment) return null;

  comment.deletedContent = comment.content;
  comment.content = "This comment was deleted";
  comment.isDeleted = true;
  comment.deletedAt = new Date();
  await comment.save({ validateBeforeSave: false });

  return comment;
};

/**
 * Hard delete — removes comment + all its replies (use with caution)
 */
commentSchema.statics.hardDelete = async function (commentId, authorId, isAdmin = false) {
  const query = isAdmin
    ? { _id: commentId }
    : { _id: commentId, author: authorId };

  const comment = await this.findOne(query);
  if (!comment) return null;

  // Delete all replies under this comment tree
  if (comment.parentComment === null) {
    await this.deleteMany({ rootComment: commentId });
  }

  await comment.deleteOne();
  return comment;
};

/**
 * Pin a comment (only post author can do this)
 * Unpins any previously pinned comment on the post
 */
commentSchema.statics.pinComment = async function (commentId, postId) {
  // Unpin existing
  await this.updateMany({ post: postId, isPinned: true }, { isPinned: false });
  // Pin new
  return this.findByIdAndUpdate(commentId, { isPinned: true }, { new: true });
};

/**
 * Unpin comment
 */
commentSchema.statics.unpinComment = function (postId) {
  return this.updateMany({ post: postId, isPinned: true }, { isPinned: false });
};

/**
 * Atomically update likesCount
 */
commentSchema.statics.updateLikesCount = function (commentId, value) {
  return this.findByIdAndUpdate(
    commentId,
    { $inc: { likesCount: value } },
    { new: true }
  );
};

/**
 * Get comment count for a post (non-deleted)
 */
commentSchema.statics.getCommentCount = function (postId) {
  return this.countDocuments({ post: postId, isDeleted: false, parentComment: null });
};

const Comment = models.Comment || model("Comment", commentSchema);
export default Comment;