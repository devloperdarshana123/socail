import prisma from "../config/prisma.js";

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ── Create comment (top-level or reply) ─────────────────────────────────
export const createComment = async (commentData) => {
  const { postId, authorId, content, mentions = [], parentCommentId = null } = commentData;

  // Calculate depth if reply
  let depth = 0;
  if (parentCommentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentCommentId },
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

  const comment = await prisma.comment.create({
    data: {
      postId,
      authorId,
      content: content.trim().slice(0, 1000),
      mentions: mentions || [],
      parentCommentId: parentCommentId || null,
      depth,
      isPinned: false,
    },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          isVerifiedBadge: true,
        },
      },
    },
  });

  // Increment parent's repliesCount if reply
  if (parentCommentId) {
    await prisma.comment.update({
      where: { id: parentCommentId },
      data: { repliesCount: { increment: 1 } },
    });
  }

  return comment;
};

// ── Get pinned comment for a post ───────────────────────────────────────
export const getPinnedComment = async (postId) => {
  return prisma.comment.findFirst({
    where: {
      postId,
      isPinned: true,
      isDeleted: false,
      status: "active",
    },
    select: {
      id: true,
      content: true,
      mentions: true,
      isPinned: true,
      createdAt: true,
      updatedAt: true,
      repliesCount: true,
      author: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          isVerifiedBadge: true,
        },
      },
    },
  });
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
    where.OR = [
      {
        createdAt: { lt: new Date(afterDate) },
      },
      {
        createdAt: { equals: new Date(afterDate) },
        id: { lt: afterId },
      },
    ];
  }

  const comments = await prisma.comment.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      content: true,
      mentions: true,
      createdAt: true,
      updatedAt: true,
      repliesCount: true,
      author: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          isVerifiedBadge: true,
        },
      },
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
    OR: [
      { parentCommentId: commentId },
      {
        parentCommentId: {
          in: await prisma.comment
            .findMany({
              where: { parentCommentId: commentId },
              select: { id: true },
            })
            .then((c) => c.map((x) => x.id)),
        },
      },
    ],
 isDeleted: false,
    status: "active",
  };

  if (afterId && afterDate) {
    where.AND = [
      {
        OR: [
          { createdAt: { lt: new Date(afterDate) } },
          {
            createdAt: { equals: new Date(afterDate) },
            id: { lt: afterId },
          },
        ],
      },
    ];
  }

  const replies = await prisma.comment.findMany({
    where,
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
      author: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          isVerifiedBadge: true,
        },
      },
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
    where.OR = [
      { createdAt: { lt: new Date(afterDate) } },
      {
        createdAt: { equals: new Date(afterDate) },
        id: { lt: afterId },
      },
    ];
  }

  const replies = await prisma.comment.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      content: true,
      mentions: true,
      createdAt: true,
      updatedAt: true,
      repliesCount: true,
      author: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          isVerifiedBadge: true,
        },
      },
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
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, postId: true, isDeleted: true },
  });

  if (!comment || comment.isDeleted || comment.authorId !== userId) {
    return null;
  }

  const deleted = await prisma.comment.update({
    where: { id: commentId },
    data: { isDeleted: true },
  });

  return { ...deleted, post: deleted.postId };
};

// ── Hard delete comment and all replies ──────────────────────────────────
export const hardDeleteComment = async (commentId, userId, isAdmin = false) => {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, postId: true, isDeleted: true },
  });

  if (!comment) {
    return { deletedCount: 0, postId: null };
  }

  // Non-admin can only delete own comments
  if (!isAdmin && comment.authorId !== userId) {
    return { deletedCount: 0, postId: null };
  }

  // Find all replies (descendants)
  const findAllDescendants = async (parentId) => {
    const directReplies = await prisma.comment.findMany({
      where: { parentCommentId: parentId },
      select: { id: true },
    });

    let allDescendants = [...directReplies];
    for (const reply of directReplies) {
      const subReplies = await findAllDescendants(reply.id);
      allDescendants = [...allDescendants, ...subReplies];
    }

    return allDescendants;
  };

  const descendants = await findAllDescendants(commentId);
  const allIds = [commentId, ...descendants.map((d) => d.id)];

  // Delete all in one go
  await prisma.comment.deleteMany({
    where: { id: { in: allIds } },
  });

  return { deletedCount: allIds.length, postId: comment.postId };
};

// ── Pin comment ─────────────────────────────────────────────────────────
export const pinComment = async (commentId, postId) => {
  // Unpin all other comments on this post first
  await prisma.comment.updateMany({
    where: { postId, isPinned: true },
    data: { isPinned: false },
  });

  // Pin this one
  return prisma.comment.update({
    where: { id: commentId },
    data: { isPinned: true },
  });
};

// ── Unpin comment ───────────────────────────────────────────────────────
export const unpinComment = async (postId) => {
  return prisma.comment.updateMany({
    where: { postId, isPinned: true },
    data: { isPinned: false },
  });
};