import { commentRepository, socialPostRepository } from "../config/repositories.js";

// Persistence for the comment domain now flows through the repository layer
// (Phase 7A) instead of the Prisma client directly. Database/behavior are
// unchanged — every query below is the same shape as the prisma.* call it
// replaces; only the access path moved.
//
// ── TRANSACTION OWNERSHIP: UNCHANGED, AND STILL INCONSISTENT ────────────
// This is the one helper whose transactions are opened by its CONTROLLER.
// comment.controller.js calls transactionRunner.run(...) directly and then,
// inside that callback, calls:
//     CommentHelper.createComment({ ... })            // NO tx — global client
//     CommentHelper.incrementPostCommentsCount(tx, …) // tx — joins the transaction
//
// So comment creation is NOT actually covered by the transaction that
// appears to wrap it: a failure in the count update rolls back only the
// count, leaving the comment row committed. Phase 6I documented this; it is
// preserved EXACTLY here, because Phase 7A is behaviour-preserving and the
// instruction is not to redesign transaction ownership during this phase.
//
// The two count helpers therefore keep their `client`-first signatures —
// the controller passes `tx` positionally and must not change — and forward
// it to the repository as `{ tx: client }`. createComment deliberately takes
// no tx parameter, exactly as before.
//
// The inconsistency is called out again in the milestone report so it can be
// resolved deliberately rather than inherited silently.

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// The author projection attached to created comments and every list row.
const COMMENT_AUTHOR_SELECT = {
  id: true,
  username: true,
  fullName: true,
  avatar: true,
  isVerifiedBadge: true,
};

// ── Controller-extracted guards & transaction ops (Milestone 5E) ─────────
//    Every query below was inline in comment.controller.js and is moved
//    here verbatim so the controller performs no direct DB access. Queries
//    are byte-identical to the ones they replace; null is returned for a
//    missing row exactly as Prisma's findUnique does.

// addComment: post guard (comments-disabled / deleted checks).
export const getPostForCommentGuard = async (postId) => {
  return socialPostRepository.findById(postId, {
    includeDeleted: true,
    select: { id: true, authorId: true, commentsDisabled: true, isDeleted: true },
  });
};

// getComments: lightweight post-existence guard.
export const getPostExistence = async (postId) => {
  return socialPostRepository.findById(postId, {
    includeDeleted: true,
    select: { id: true, isDeleted: true },
  });
};

// getReplies / getDirectReplies: lightweight comment-existence guard.
export const getCommentExistence = async (commentId) => {
  return commentRepository.findById(commentId, {
    select: { id: true, isDeleted: true },
  });
};

// pinComment / unpinComment: comment lookup (id + owning post).
export const getCommentForPin = async (commentId) => {
  return commentRepository.findById(commentId, {
    select: { id: true, postId: true, isDeleted: true },
  });
};

// pinComment / unpinComment: post lookup (author, for the pin-permission check).
export const getPostForPin = async (postId) => {
  return socialPostRepository.findById(postId, {
    includeDeleted: true,
    select: { id: true, authorId: true, isDeleted: true },
  });
};

// Transaction-scoped post comment-count updates. `client` is the tx passed
// by the shared transaction runner (transactionRunner.run's callback), so
// these participate in that transaction exactly as the inline tx.post.update
// calls did. Queries are byte-identical to what they replace.
export const incrementPostCommentsCount = async (client, postId) => {
  return socialPostRepository.update(
    postId,
    { commentsCount: { inc: 1 } },
    { tx: client, select: { commentsCount: true } }
  );
};

export const decrementPostCommentsCount = async (client, postId, amount) => {
  return socialPostRepository.update(
    postId,
    { commentsCount: { dec: amount } },
    { tx: client }
  );
};

// ── Create comment (top-level or reply) ─────────────────────────────────
export const createComment = async (commentData) => {
  const { postId, authorId, content, mentions = [], parentCommentId = null } = commentData;

  // Calculate depth if reply
  let depth = 0;
  if (parentCommentId) {
    const parent = await commentRepository.findById(parentCommentId, {
      select: { depth: true, isDeleted: true },
    });

    if (!parent || parent.isDeleted) {
      throw new Error("Parent comment not found or has been deleted");
    }

    depth = (parent.depth || 0) + 1;

    // Max depth check
    if (depth > 5) {
      throw new Error("Maximum comment nesting depth reached");
    }
  }

  // NOTE: no `tx` here — see the transaction-ownership note in the header.
  // This create is deliberately NOT enrolled in the controller's transaction,
  // matching the pre-migration behaviour exactly.
  const comment = await commentRepository.create(
    {
      postId,
      authorId,
      content: content.trim().slice(0, 1000),
      mentions: mentions || [],
      parentCommentId: parentCommentId || null,
      depth,
      isPinned: false,
    },
    { include: { author: { select: COMMENT_AUTHOR_SELECT } } }
  );

  // Increment parent's repliesCount if reply
  if (parentCommentId) {
    await commentRepository.update(parentCommentId, { repliesCount: { inc: 1 } });
  }

  return comment;
};

// ── Get pinned comment for a post ───────────────────────────────────────
export const getPinnedComment = async (postId) => {
  return commentRepository.findFirstWhere(
    {
      postId,
      isPinned: true,
      isDeleted: false,
      status: "active",
    },
    {
      select: {
        id: true,
        content: true,
        mentions: true,
        isPinned: true,
        createdAt: true,
        updatedAt: true,
        repliesCount: true,
        author: { select: COMMENT_AUTHOR_SELECT },
      },
    }
  );
};

// ── Get top-level comments (cursor-paginated) ───────────────────────────
export const getTopLevelComments = async (postId, { afterId = null, afterDate = null, limit = 20 } = {}) => {
  const where = {
    postId,
    parentCommentId: null,
    isDeleted: false,
    status: "active",
  };

  if (afterId && afterDate) {
    where.or = [
      {
        createdAt: { lt: new Date(afterDate) },
      },
      {
        createdAt: { eq: new Date(afterDate) },
        id: { lt: afterId },
      },
    ];
  }

  const comments = await commentRepository.findManyWithCursor(where, {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      content: true,
      mentions: true,
      createdAt: true,
      updatedAt: true,
      repliesCount: true,
      author: { select: COMMENT_AUTHOR_SELECT },
    },
  });

  const hasMore = comments.length > limit;
  const items = hasMore ? comments.slice(0, limit) : comments;
  const nextCursor = hasMore
    ? {
        afterId: items[items.length - 1].id,
        afterDate: items[items.length - 1].createdAt.toISOString(),
      }
    : null;

  return { comments: items, nextCursor };
};

// ── Get all replies under a root comment ────────────────────────────────
export const getReplies = async (commentId, { afterId = null, afterDate = null, limit = 10 } = {}) => {
  const where = {
    // Either direct child OR any descendant of this comment
    or: [
      { parentCommentId: commentId },
      {
        parentCommentId: {
          in: await commentRepository
            .findAllWhere({ parentCommentId: commentId }, { select: { id: true } })
            .then((c) => c.map((x) => x.id)),
        },
      },
    ],
 isDeleted: false,
    status: "active",
  };

  if (afterId && afterDate) {
    where.and = [
      {
        or: [
          { createdAt: { lt: new Date(afterDate) } },
          {
            createdAt: { eq: new Date(afterDate) },
            id: { lt: afterId },
          },
        ],
      },
    ];
  }

  const replies = await commentRepository.findManyWithCursor(where, {
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      parentCommentId: true,
      content: true,
      mentions: true,
      depth: true,
      createdAt: true,
      updatedAt: true,
      repliesCount: true,
      author: { select: COMMENT_AUTHOR_SELECT },
    },
  });

  const hasMore = replies.length > limit;
  const items = hasMore ? replies.slice(0, limit) : replies;
  const nextCursor = hasMore
    ? {
        afterId: items[items.length - 1].id,
        afterDate: items[items.length - 1].createdAt.toISOString(),
      }
    : null;

  return { replies: items, nextCursor };
};

// ── Get direct replies to a specific comment ───────────────────────────
export const getDirectReplies = async (commentId, { afterId = null, afterDate = null, limit = 10 } = {}) => {
 const where = {
    parentCommentId: commentId,
    isDeleted: false,
    status: "active",
  };

  if (afterId && afterDate) {
    where.or = [
      { createdAt: { lt: new Date(afterDate) } },
      {
        createdAt: { eq: new Date(afterDate) },
        id: { lt: afterId },
      },
    ];
  }

  const replies = await commentRepository.findManyWithCursor(where, {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      content: true,
      mentions: true,
      createdAt: true,
      updatedAt: true,
      repliesCount: true,
      author: { select: COMMENT_AUTHOR_SELECT },
    },
  });

  const hasMore = replies.length > limit;
  const items = hasMore ? replies.slice(0, limit) : replies;
  const nextCursor = hasMore
    ? {
        afterId: items[items.length - 1].id,
        afterDate: items[items.length - 1].createdAt.toISOString(),
      }
    : null;

  return { replies: items, nextCursor };
};

// ── Soft delete comment ─────────────────────────────────────────────────
export const softDeleteComment = async (commentId, userId) => {
  const comment = await commentRepository.findById(commentId, {
    select: { id: true, authorId: true, postId: true, isDeleted: true },
  });

  if (!comment || comment.isDeleted || String(comment.authorId) !== String(userId)) {
    return null;
  }

  // update(), NOT delete() — the repository's delete() would also stamp
  // deletedAt, which this query never wrote.
  const deleted = await commentRepository.update(commentId, { isDeleted: true });

  return { ...deleted, post: deleted.postId };
};

// ── Hard delete comment and all replies ──────────────────────────────────
export const hardDeleteComment = async (commentId, userId, isAdmin = false) => {
  const comment = await commentRepository.findById(commentId, {
    select: { id: true, authorId: true, postId: true, isDeleted: true },
  });

  if (!comment) {
    return { deletedCount: 0, postId: null };
  }

  // Non-admin can only delete own comments
  if (!isAdmin && String(comment.authorId) !== String(userId)) {
    return { deletedCount: 0, postId: null };
  }

  // Find all replies (descendants)
  const findAllDescendants = async (parentId) => {
    const directReplies = await commentRepository.findAllWhere(
      { parentCommentId: parentId },
      { select: { id: true } }
    );

    let allDescendants = [...directReplies];
    for (const reply of directReplies) {
      const subReplies = await findAllDescendants(reply.id);
      allDescendants = [...allDescendants, ...subReplies];
    }

    return allDescendants;
  };

  const descendants = await findAllDescendants(commentId);
  const allIds = [commentId, ...descendants.map((d) => d.id)];

  // Delete all in one go — a HARD delete, hence deleteManyWhere rather than
  // the repository's soft-deleting delete().
  await commentRepository.deleteManyWhere({ id: { in: allIds } });

  return { deletedCount: allIds.length, postId: comment.postId };
};

// ── Pin comment ─────────────────────────────────────────────────────────
export const pinComment = async (commentId, postId) => {
  // Unpin all other comments on this post first
  await commentRepository.updateManyWhere({ postId, isPinned: true }, { isPinned: false });

  // Pin this one
  return commentRepository.update(commentId, { isPinned: true });
};

// ── Unpin comment ───────────────────────────────────────────────────────
export const unpinComment = async (postId) => {
  return commentRepository.updateManyWhere({ postId, isPinned: true }, { isPinned: false });
};