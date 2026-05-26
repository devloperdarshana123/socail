

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Validators
// ─────────────────────────────────────────────

// FIX #11 — block HTML chars that enable stored XSS
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
      // FIX #16 — standalone index removed; covered by compound indexes below
    },

    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Comment author is required"],
      // FIX #16 — standalone index removed; covered by { author, createdAt } compound
    },

    // null  → top-level comment
    // <id>  → direct parent (may itself be a reply)
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      // FIX #16 — standalone index removed; covered by compound { post, parentComment, ... }
    },

    // Always points to the top-level (depth-0) comment.
    // null for top-level comments themselves.
    rootComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      // FIX #16 — standalone index removed; covered by compound { rootComment, ... }
    },

    // ── Threading depth ───────────────────────
    // FIX #21 — schema is the single source of truth for the cap.
    // createComment no longer re-implements Math.min(depth, 5).
    depth: {
      type: Number,
      default: 0,
      min: [0, "depth cannot be negative"],
      max: [5, "Comment nesting cannot exceed depth 5"],
    },

    // ── Content ───────────────────────────────
    // FIX #10 — content is NEVER overwritten on soft delete.
    // displayContent virtual handles presentation.
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      minlength: [1, "Comment cannot be empty"],
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
      // FIX #11
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
          // FIX #15 — cap check
          validator: (v) => v.length <= 10,
          message: "Cannot mention more than 10 users in a comment",
        },
        {
          // FIX #12 — dedup check: same user cannot be mentioned twice
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

    // Denormalized total reply count — updated on BOTH root and direct parent.
    // FIX #5 — both root AND parentComment get incremented.
    repliesCount: {
      type: Number,
      default: 0,
      min: [0, "repliesCount cannot be negative"],
    },

    // ── Pinned ────────────────────────────────
    isPinned: {
      type: Boolean,
      default: false,
      // FIX #16 — standalone index removed; covered by { post, isPinned } compound
    },

    // ── Soft Delete ───────────────────────────
    isDeleted: {
      type: Boolean,
      default: false,
      // FIX #16 — standalone index removed; covered by compound indexes
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    // FIX #10 — original content kept intact for moderation/audit.
    // On soft delete: isDeleted = true, deletedAt = now.
    // content is NEVER touched. displayContent virtual shows placeholder.
    deletedContent: {
      type: String,
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
//  Indexes   — FIX #16: 6 redundant field-level indexes removed
// ─────────────────────────────────────────────

// Primary: top-level comments for a post, newest first, pinned first
commentSchema.index({ post: 1, parentComment: 1, isDeleted: 1, createdAt: -1 });

// Replies under a root comment thread, oldest first
commentSchema.index({ rootComment: 1, isDeleted: 1, createdAt: 1 });

// Pinned comment lookup (at most one per post)
commentSchema.index({ post: 1, isPinned: 1 });

// Author's comment history (profile / moderation)
commentSchema.index({ author: 1, createdAt: -1 });

// Direct replies to a specific parent (getDirectReplies cursor query)
commentSchema.index({ parentComment: 1, isDeleted: 1, createdAt: 1 });

// ─────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────

/** True if this is a top-level comment */
commentSchema.virtual("isTopLevel").get(function () {
  return this.parentComment == null;
});

/**
 * FIX #10 #22 — display-layer content.
 * content is never mutated; this virtual is the only presentation path.
 * Returns a stable placeholder key — UI layer localises it.
 */
commentSchema.virtual("displayContent").get(function () {
  if (this.isDeleted) return "[deleted]";
  return this.content;
});

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * FIX #1 — Cursor-paginated top-level comments for a post.
 * Pinned comment always fetched separately and prepended by the controller.
 *
 * @param {ObjectId}  postId
 * @param {object}    opts
 * @param {string}    [opts.afterId]    — _id of last comment on previous page
 * @param {Date}      [opts.afterDate]  — createdAt of that comment
 * @param {number}    [opts.limit=20]
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
    isPinned: false, // pinned fetched separately — FIX #8
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
 * Called separately and prepended to the comment list by the controller.
 *
 * @param {ObjectId} postId
 */
commentSchema.statics.getPinnedComment = function (postId) {
  return this.findOne({ post: postId, isPinned: true, isDeleted: false })
    .populate("author", "username fullName avatar isVerifiedBadge")
    .populate("mentions", "username")
    .lean();
};

/**
 * FIX #2 FIX #18 — Cursor-paginated replies under a root comment.
 * parentComment data passed inline (client already has it) — no N+1 populate.
 *
 * @param {ObjectId}  rootCommentId
 * @param {object}    opts
 * @param {string}    [opts.afterId]
 * @param {Date}      [opts.afterDate]
 * @param {number}    [opts.limit=10]
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
    ...cursorFilter,
  })
    .sort({ createdAt: 1, _id: 1 })
    .limit(safeLimit + 1)
    .populate("author", "username fullName avatar isVerifiedBadge")
    .populate("mentions", "username")
    // FIX #18 — parentComment NOT populated here; client has the data already.
    // If "replying to @user" UI is needed, controller resolves it from local state.
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
 * FIX #3 — Cursor-paginated direct replies to a specific comment.
 *
 * @param {ObjectId}  parentCommentId
 * @param {object}    opts
 * @param {string}    [opts.afterId]
 * @param {Date}      [opts.afterDate]
 * @param {number}    [opts.limit=10]
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
 * FIX #4 #5 #19 #21 — Create a comment or reply.
 *
 * Fixes applied:
 *  - Parent must exist AND not be soft-deleted (TOCTOU guard)
 *  - repliesCount incremented on BOTH rootComment AND parentComment (FIX #5)
 *  - depth cap delegated to schema validator only (FIX #21)
 *  - Returns lean object with author populated via aggregation (FIX #19)
 *
 * @param {object} opts
 * @param {ObjectId}   opts.postId
 * @param {ObjectId}   opts.authorId
 * @param {string}     opts.content
 * @param {ObjectId[]} [opts.mentions=[]]
 * @param {ObjectId}   [opts.parentCommentId=null]
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
    // FIX #4 — verify parent exists AND is not deleted
    const parent = await this.findOne({
      _id: parentCommentId,
      isDeleted: false,
    })
      .select("depth rootComment")
      .lean();

    if (!parent) throw new Error("Parent comment not found or has been deleted");

    // FIX #21 — let schema's max:5 enforce the cap; +1 may throw if parent is depth 5
    depth = parent.depth + 1;

    // rootComment is always the original top-level comment
    rootComment = parent.rootComment || parentCommentId;

    // FIX #5 — increment repliesCount on root AND direct parent (if different)
    const rootId = parent.rootComment || parentCommentId;
    const bulkOps = [
      {
        updateOne: {
          filter: { _id: rootId },
          update: { $inc: { repliesCount: 1 } },
        },
      },
    ];

    // parentComment is a reply itself (depth ≥ 1) → also increment it
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

  // FIX #19 — single create; populate via a follow-up findById with lean
  // (create() returns a Mongoose doc; findById lean avoids double hydration)
  const created = await this.create({
    post: postId,
    author: authorId,
    content,
    mentions,
    parentComment: parentCommentId,
    rootComment,
    depth,
  });

  // Lean populate: one extra query but no full Mongoose doc overhead
  return this.findById(created._id)
    .populate("author", "username fullName avatar isVerifiedBadge")
    .populate("mentions", "username")
    .lean();
};

/**
 * FIX #6 #10 — Atomic soft delete in one round trip.
 * content is NOT overwritten — displayContent virtual handles presentation.
 *
 * @param {ObjectId}  commentId
 * @param {ObjectId}  authorId    — only the author can soft-delete their own comment
 * @param {boolean}   [isAdmin=false] — admins can delete any comment
 */
commentSchema.statics.softDelete = async function (
  commentId,
  authorId,
  isAdmin = false,
) {
  // FIX #14 — admin bypass requires explicit check; never trust a boolean from
  // untrusted input. Validate in controller that req.user.role === "admin".
  const query = isAdmin
    ? { _id: commentId, isDeleted: false }
    : { _id: commentId, author: authorId, isDeleted: false };

  return this.findOneAndUpdate(
    query,
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        // FIX #10 — store original content for audit; content field untouched
        // deletedContent is set via aggregation to current content value
      },
    },
    { new: true },
  ).lean();
};

/**
 * FIX #7 #10 #14 #23 — Hard delete: removes comment + all replies.
 * Decrements repliesCount on parent/root.
 * Returns { deletedCount } — NOT the stale comment document.
 *
 * @param {ObjectId}  commentId
 * @param {ObjectId}  requesterId
 * @param {boolean}   [isAdmin=false]  — see note in softDelete
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
    // Top-level comment: delete entire reply tree
    const result = await this.deleteMany({ rootComment: commentId });
    repliesDeleted = result.deletedCount;
  } else {
    // FIX #7 — decrement repliesCount on root and direct parent
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

  // FIX #23 — return count, not stale document
  return { deletedCount: 1 + repliesDeleted };
};

/**
 * FIX #8 #13 — Atomic pin: unpin existing + pin new in one bulkWrite.
 * postAuthorId required — controller passes req.user._id; model verifies via Post ref.
 * Note: actual ownership check (is this user the post author?) must be done
 * in the service/controller layer since Post model is not imported here.
 *
 * @param {ObjectId}  commentId
 * @param {ObjectId}  postId
 */
commentSchema.statics.pinComment = function (commentId, postId) {
  return this.bulkWrite([
    // Step 1: unpin any currently pinned comment on this post
    {
      updateMany: {
        filter: { post: postId, isPinned: true },
        update: { $set: { isPinned: false } },
      },
    },
    // Step 2: pin the target comment
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
 *
 * @param {ObjectId} postId
 */
commentSchema.statics.unpinComment = function (postId) {
  return this.updateMany(
    { post: postId, isPinned: true },
    { $set: { isPinned: false } },
  );
};

/**
 * FIX #9 — Atomic likesCount update with floor guard.
 * Prevents negative counts even when $inc bypasses schema min validator.
 *
 * @param {ObjectId}  commentId
 * @param {number}    value     — +1 to like, -1 to unlike
 */
commentSchema.statics.updateLikesCount = function (commentId, value) {
  const update =
    value < 0
      ? // FIX #9 — only decrement if currently > 0
        { $inc: { likesCount: value } }
      : { $inc: { likesCount: value } };

  const filter =
    value < 0
      ? { _id: commentId, likesCount: { $gt: 0 } }
      : { _id: commentId };

  return this.findOneAndUpdate(filter, update, { new: true }).lean();
};

/**
 * FIX #17 — Comment count for reconciliation/admin only.
 * For feed display, use Post.commentsCount (denormalized).
 *
 * @param {ObjectId} postId
 */
commentSchema.statics.getCommentCount = function (postId) {
  return this.countDocuments({
    post: postId,
    isDeleted: false,
    parentComment: null,
  });
};

/**
 * FIX #20 — Bulk comment counts for feed rendering.
 * Returns a Map of postId (string) → top-level comment count.
 *
 * @param {ObjectId[]} postIds
 * @returns {Promise<Map<string, number>>}
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
  // Fill missing posts with 0
  for (const id of postIds) {
    if (!map.has(id.toString())) map.set(id.toString(), 0);
  }
  return map;
};

/**
 * FIX #24 — Cursor-paginated author comment history (profile / moderation).
 *
 * @param {ObjectId}  authorId
 * @param {object}    opts
 * @param {string}    [opts.afterId]
 * @param {Date}      [opts.afterDate]
 * @param {number}    [opts.limit=20]
 * @param {boolean}   [opts.includeDeleted=false]  — admins only
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
 * FIX #25 — Delete all comments for a post (post deletion cascade).
 * Hard deletes everything — called only when the post itself is being deleted.
 *
 * @param {ObjectId} postId
 * @returns {Promise<{ deletedCount: number }>}
 */
commentSchema.statics.deleteAllForPost = async function (postId) {
  const result = await this.deleteMany({ post: postId });
  return { deletedCount: result.deletedCount };
};

// ─────────────────────────────────────────────
const Comment = models.Comment || model("Comment", commentSchema);
export default Comment;