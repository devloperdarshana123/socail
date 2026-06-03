

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Validators
// ─────────────────────────────────────────────

const noHtmlChars = (v) => !v || !/[<>"']/.test(v);

// ─────────────────────────────────────────────
//  Comment Schema
//
//  Threading logic:
//    Top-level comment  → parentComment: null,  rootComment: null,  depth: 0
//    Reply to comment   → parentComment: <id>,  rootComment: <id>,  depth: 1
//    Reply to reply     → parentComment: <id>,  rootComment: <same root>, depth: 2+
//
//  rootComment stored so all replies under a top-level comment
//  can be fetched in one query without recursive joins.
// ─────────────────────────────────────────────
const commentSchema = new Schema(
  {
    // ── References ────────────────────────────
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: [true, "Comment must belong to a post"],
    },

    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Comment author is required"],
    },

    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },

    rootComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },

    // ── Threading depth ───────────────────────
    depth: {
      type: Number,
      default: 0,
      min: [0, "depth cannot be negative"],
      max: [5, "Comment nesting cannot exceed depth 5"],
    },

    // ── Content ───────────────────────────────
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      minlength: [1, "Comment cannot be empty"],
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
      validate: {
        validator: noHtmlChars,
        message: "Comment content contains invalid characters (<, >, \", ')",
      },
    },

    // ── Mentions ──────────────────────────────
    mentions: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
      validate: [
        {
          validator: (v) => v.length <= 10,
          message: "Cannot mention more than 10 users in a comment",
        },
        {
          validator: (v) => {
            const ids = v.map((id) => id.toString());
            return new Set(ids).size === ids.length;
          },
          message: "Duplicate mentions are not allowed",
        },
      ],
    },

    // ── Engagement ────────────────────────────
    likesCount: {
      type: Number,
      default: 0,
      min: [0, "likesCount cannot be negative"],
    },

    repliesCount: {
      type: Number,
      default: 0,
      min: [0, "repliesCount cannot be negative"],
    },

    // ── Pinned ────────────────────────────────
    isPinned: {
      type: Boolean,
      default: false,
    },

    // ── Soft Delete ───────────────────────────
    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedContent: {
      type: String,
      default: null,
    },

    // ── Admin Moderation ──────────────────────
    // Added for admin panel: CommentsPage + admin.comment.controller.js

    /**
     * Moderation status set by admins.
     *  active  → visible, no issues
     *  flagged → under review (auto-flagged or reported)
     *  removed → hidden by admin (soft removal, content kept for audit)
     *  pending → awaiting review (e.g. first-time user, auto-held)
     */
    status: {
      type: String,
      enum: {
        values: ["active", "flagged", "removed", "pending"],
        message: "status must be one of: active, flagged, removed, pending",
      },
      default: "active",
      index: true,          // admin filter queries hit this frequently
    },

    /** Free-text reason recorded when an admin changes status */
    moderationReason: {
      type: String,
      default: null,
      maxlength: [500, "Moderation reason cannot exceed 500 characters"],
    },

    /** Timestamp of the last admin status change */
    moderatedAt: {
      type: Date,
      default: null,
    },

    /** Which admin last changed the status */
    moderatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /** Which admin hard/soft deleted this comment (separate from author soft-delete) */
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────

// Primary: top-level comments for a post, newest first, pinned first
commentSchema.index({ post: 1, parentComment: 1, isDeleted: 1, createdAt: -1 });

// Replies under a root comment thread, oldest first
commentSchema.index({ rootComment: 1, isDeleted: 1, createdAt: 1 });

// Pinned comment lookup (at most one per post)
commentSchema.index({ post: 1, isPinned: 1 });

// Author's comment history (profile / moderation)
commentSchema.index({ author: 1, createdAt: -1 });

// Direct replies to a specific parent
commentSchema.index({ parentComment: 1, isDeleted: 1, createdAt: 1 });

// Admin panel: filter by status + sort by date
commentSchema.index({ status: 1, createdAt: -1 });

// Admin panel: filter by status + isDeleted together
commentSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });

// ─────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────

/** True if this is a top-level comment */
commentSchema.virtual("isTopLevel").get(function () {
  return this.parentComment == null;
});

/**
 * Display-layer content.
 * content is never mutated; this virtual is the only presentation path.
 * Returns a stable placeholder key — UI layer localises it.
 */
commentSchema.virtual("displayContent").get(function () {
  if (this.isDeleted) return "[deleted]";
  return this.content;
});

// ─────────────────────────────────────────────
//  Static Methods  (all original statics preserved)
// ─────────────────────────────────────────────

/**
 * Cursor-paginated top-level comments for a post.
 * Pinned comment always fetched separately and prepended by the controller.
 */
commentSchema.statics.getTopLevelComments = async function (
  postId,
  { afterId = null, afterDate = null, limit = 20 } = {},
) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50);

  const cursorFilter =
    afterId && afterDate
      ? {
          $or: [
            { createdAt: { $lt: new Date(afterDate) } },
            { createdAt: new Date(afterDate), _id: { $lt: afterId } },
          ],
        }
      : {};

  const comments = await this.find({
    post: postId,
    parentComment: null,
    isDeleted: false,
    isPinned: false,
    status: { $ne: "removed" },
    ...cursorFilter,
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(safeLimit + 1)
    .populate("author", "username fullName avatar isVerifiedBadge")
    .populate("mentions", "username")
    .lean();

  const hasMore = comments.length > safeLimit;
  if (hasMore) comments.pop();

  const last = comments[comments.length - 1];
  const nextCursor = hasMore
    ? { afterId: last._id, afterDate: last.createdAt }
    : null;

  return { comments, nextCursor };
};

/**
 * Get the pinned comment for a post (if any).
 */
commentSchema.statics.getPinnedComment = function (postId) {
 // REPLACE KARO
  return this.findOne({ post: postId, isPinned: true, isDeleted: false, status: { $ne: "removed" } })
    .populate("author", "username fullName avatar isVerifiedBadge")
    .populate("mentions", "username")
    .lean();
};

/**
 * Cursor-paginated replies under a root comment.
 */
commentSchema.statics.getReplies = async function (
  rootCommentId,
  { afterId = null, afterDate = null, limit = 10 } = {},
) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 50);

  const cursorFilter =
    afterId && afterDate
      ? {
          $or: [
            { createdAt: { $gt: new Date(afterDate) } },
            { createdAt: new Date(afterDate), _id: { $gt: afterId } },
          ],
        }
      : {};

  const replies = await this.find({
    rootComment: rootCommentId,
    isDeleted: false,
    status: { $ne: "removed" },
    ...cursorFilter,
  })
    .sort({ createdAt: 1, _id: 1 })
    .limit(safeLimit + 1)
    .populate("author", "username fullName avatar isVerifiedBadge")
    .populate("mentions", "username")
    .lean();

  const hasMore = replies.length > safeLimit;
  if (hasMore) replies.pop();

  const last = replies[replies.length - 1];
  const nextCursor = hasMore
    ? { afterId: last._id, afterDate: last.createdAt }
    : null;

  return { replies, nextCursor };
};

/**
 * Cursor-paginated direct replies to a specific comment.
 */
commentSchema.statics.getDirectReplies = async function (
  parentCommentId,
  { afterId = null, afterDate = null, limit = 10 } = {},
) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 50);

  const cursorFilter =
    afterId && afterDate
      ? {
          $or: [
            { createdAt: { $gt: new Date(afterDate) } },
            { createdAt: new Date(afterDate), _id: { $gt: afterId } },
          ],
        }
      : {};

  const replies = await this.find({
    parentComment: parentCommentId,
    isDeleted: false,
    status: { $ne: "removed" },
    ...cursorFilter,
  })
    .sort({ createdAt: 1, _id: 1 })
    .limit(safeLimit + 1)
    .populate("author", "username fullName avatar isVerifiedBadge")
    .populate("mentions", "username")
    .lean();

  const hasMore = replies.length > safeLimit;
  if (hasMore) replies.pop();

  const last = replies[replies.length - 1];
  const nextCursor = hasMore
    ? { afterId: last._id, afterDate: last.createdAt }
    : null;

  return { replies, nextCursor };
};

/**
 * Create a comment or reply.
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
    const parent = await this.findOne({
      _id: parentCommentId,
      isDeleted: false,
    })
      .select("depth rootComment")
      .lean();

    if (!parent) throw new Error("Parent comment not found or has been deleted");

    depth = parent.depth + 1;
    rootComment = parent.rootComment || parentCommentId;

    const rootId = parent.rootComment || parentCommentId;
    const bulkOps = [
      {
        updateOne: {
          filter: { _id: rootId },
          update: { $inc: { repliesCount: 1 } },
        },
      },
    ];

    if (parent.rootComment && parent.rootComment.toString() !== parentCommentId.toString()) {
      bulkOps.push({
        updateOne: {
          filter: { _id: parentCommentId },
          update: { $inc: { repliesCount: 1 } },
        },
      });
    }

    await this.bulkWrite(bulkOps);
  }

  const created = await this.create({
    post: postId,
    author: authorId,
    content,
    mentions,
    parentComment: parentCommentId,
    rootComment,
    depth,
  });

  return this.findById(created._id)
    .populate("author", "username fullName avatar isVerifiedBadge")
    .populate("mentions", "username")
    .lean();
};

/**
 * Atomic soft delete.
 */
commentSchema.statics.softDelete = async function (
  commentId,
  authorId,
  isAdmin = false,
) {
  const query = isAdmin
    ? { _id: commentId, isDeleted: false }
    : { _id: commentId, author: authorId, isDeleted: false };

  return this.findOneAndUpdate(
    query,
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    },
    { new: true },
  ).lean();
};

/**
 * Hard delete: removes comment + all replies.
 */
commentSchema.statics.hardDelete = async function (
  commentId,
  requesterId,
  isAdmin = false,
) {
  const query = isAdmin
    ? { _id: commentId }
    : { _id: commentId, author: requesterId };

  const comment = await this.findOne(query).select("parentComment rootComment depth").lean();
  if (!comment) return { deletedCount: 0 };

  let repliesDeleted = 0;

  if (comment.parentComment === null) {
    const result = await this.deleteMany({ rootComment: commentId });
    repliesDeleted = result.deletedCount;
  } else {
    const rootId = comment.rootComment;
    const bulkOps = [
      {
        updateOne: {
          filter: { _id: rootId, repliesCount: { $gt: 0 } },
          update: { $inc: { repliesCount: -1 } },
        },
      },
    ];

    if (
      comment.parentComment &&
      comment.parentComment.toString() !== rootId?.toString()
    ) {
      bulkOps.push({
        updateOne: {
          filter: { _id: comment.parentComment, repliesCount: { $gt: 0 } },
          update: { $inc: { repliesCount: -1 } },
        },
      });
    }

    await this.bulkWrite(bulkOps);
  }

  await this.deleteOne({ _id: commentId });

  return { deletedCount: 1 + repliesDeleted };
};

/**
 * Atomic pin: unpin existing + pin new in one bulkWrite.
 */
commentSchema.statics.pinComment = function (commentId, postId) {
  return this.bulkWrite([
    {
      updateMany: {
        filter: { post: postId, isPinned: true },
        update: { $set: { isPinned: false } },
      },
    },
    {
      updateOne: {
        filter: { _id: commentId, post: postId, isDeleted: false },
        update: { $set: { isPinned: true } },
      },
    },
  ]);
};

/**
 * Unpin all pinned comments on a post.
 */
commentSchema.statics.unpinComment = function (postId) {
  return this.updateMany(
    { post: postId, isPinned: true },
    { $set: { isPinned: false } },
  );
};

/**
 * Atomic likesCount update with floor guard.
 */
commentSchema.statics.updateLikesCount = function (commentId, value) {
  const filter =
    value < 0
      ? { _id: commentId, likesCount: { $gt: 0 } }
      : { _id: commentId };

  return this.findOneAndUpdate(filter, { $inc: { likesCount: value } }, { new: true }).lean();
};

/**
 * Comment count for reconciliation/admin only.
 */
commentSchema.statics.getCommentCount = function (postId) {
  return this.countDocuments({
    post: postId,
    isDeleted: false,
    parentComment: null,
  });
};

/**
 * Bulk comment counts for feed rendering.
 */
commentSchema.statics.getBulkCommentCounts = async function (postIds) {
  const results = await this.aggregate([
    {
      $match: {
        post: { $in: postIds },
        isDeleted: false,
        parentComment: null,
      },
    },
    {
      $group: { _id: "$post", count: { $sum: 1 } },
    },
  ]);

  const map = new Map();
  for (const r of results) {
    map.set(r._id.toString(), r.count);
  }
  for (const id of postIds) {
    if (!map.has(id.toString())) map.set(id.toString(), 0);
  }
  return map;
};

/**
 * Cursor-paginated author comment history (profile / moderation).
 */
commentSchema.statics.getByAuthor = async function (
  authorId,
  { afterId = null, afterDate = null, limit = 20, includeDeleted = false } = {},
) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50);

  const baseFilter = { author: authorId };
  if (!includeDeleted) baseFilter.isDeleted = false;

  const cursorFilter =
    afterId && afterDate
      ? {
          $or: [
            { createdAt: { $lt: new Date(afterDate) } },
            { createdAt: new Date(afterDate), _id: { $lt: afterId } },
          ],
        }
      : {};

  const comments = await this.find({ ...baseFilter, ...cursorFilter })
    .sort({ createdAt: -1, _id: -1 })
    .limit(safeLimit + 1)
    .populate("post", "caption")
    .lean();

  const hasMore = comments.length > safeLimit;
  if (hasMore) comments.pop();

  const last = comments[comments.length - 1];
  const nextCursor = hasMore
    ? { afterId: last._id, afterDate: last.createdAt }
    : null;

  return { comments, nextCursor };
};

/**
 * Delete all comments for a post (post deletion cascade).
 */
commentSchema.statics.deleteAllForPost = async function (postId) {
  const result = await this.deleteMany({ post: postId });
  return { deletedCount: result.deletedCount };
};

// ─────────────────────────────────────────────
const Comment = models.Comment || model("Comment", commentSchema);
export default Comment;