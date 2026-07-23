

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import prisma from "../../config/prisma.js";
import logger from "../../config/logger.js";
import { auditLogger, AUDIT_ACTIONS } from "../../utils/auditLogger.js";
import { dateRangeToCreatedAt } from "../../utils/dateRange.js";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const extractAvatar = (avatar) => {
  if (!avatar) return null;
  if (typeof avatar === "string") return avatar;
  if (avatar?.url) return avatar.url;
  return null;
};

const auditComment = ({ req, action, commentId, commentContent, postId, postCaption, postType, newStatus, note }) => {
  auditLogger({
    req,
    action,
    targetId:   commentId,
    targetType: "comment",
    targetMeta: {
      commentId,
      commentText: (commentContent || "").slice(0, 120),
      postId:      postId      || null,
      postCaption: (postCaption || "No caption").slice(0, 80),
      postType:    postType    || "post",
      newStatus:   newStatus   || null,
      reason:      req.body?.reason || null,
    },
    note: note || null,
  });
};

// ─────────────────────────────────────────────────────────────
// GET  /admin/comments  — paginated list with filters
// ─────────────────────────────────────────────────────────────

export const getAllComments = asyncHandler(async (req, res) => {
  const {
    page     = 1,
    limit    = 20,
    search   = "",
    status,
    sort     = "newest",
    postId,
    authorId,
    dateRange,
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;

  // ── Build where ──────────────────────────────────────────
  const where = { isDeleted: false };
  if (status)   where.status   = status;
  if (postId)   where.postId   = postId;
  if (authorId) where.authorId = authorId;

  const createdAt = dateRangeToCreatedAt(dateRange);
  if (createdAt) where.createdAt = createdAt;

  // Search — content, author username/fullName
  if (search.trim()) {
    where.OR = [
      { content:                    { contains: search.trim(), mode: "insensitive" } },
      { author: { username:         { contains: search.trim(), mode: "insensitive" } } },
      { author: { fullName:         { contains: search.trim(), mode: "insensitive" } } },
    ];
  }

  // ── Sort ─────────────────────────────────────────────────
  const sortMap = {
    newest:       { createdAt: "desc" },
    oldest:       { createdAt: "asc"  },
    most_likes:   { likesCount: "desc" },
    most_reports: { repliesCount: "desc" }, // reportsCount field yok Prisma schema mein
  };
  const orderBy = sortMap[sort] ?? { createdAt: "desc" };

  // ── Run query + count in parallel ────────────────────────
  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy,
      skip,
      take: limitNum,
      select: {
        id:              true,
        content:         true,
        status:          true,
        isDeleted:       true,
        isPinned:        true,
        likesCount:      true,
        repliesCount:    true,
        createdAt:       true,
        updatedAt:       true,
        author: {
          select: {
            id:            true,
            username:      true,
            fullName:      true,
            avatar:        true,
            accountStatus: true,
          },
        },
        post: {
          select: {
            id:        true,
            caption:   true,
            type:      true,
            media:     true,
            createdAt: true,
            author: {
              select: {
                id:       true,
                username: true,
                fullName: true,
                avatar:   true,
              },
            },
          },
        },
      },
    }),
    prisma.comment.count({ where }),
  ]);

  // ── Normalise avatars + trim media to first item ─────────
  const normalised = comments.map((c) => ({
    ...c,
    author: c.author
      ? { ...c.author, avatar: extractAvatar(c.author.avatar) }
      : null,
    post: c.post
      ? {
          ...c.post,
          media:  Array.isArray(c.post.media) ? c.post.media.slice(0, 1) : [],
          author: c.post.author
            ? { ...c.post.author, avatar: extractAvatar(c.post.author.avatar) }
            : null,
        }
      : null,
  }));

  logger.info(`Admin fetched comments — page ${pageNum}, total ${total}`);

  return res.status(200).json({
    success: true,
    data:    normalised,
    pagination: {
      total,
      page:        pageNum,
      limit:       limitNum,
      totalPages:  Math.ceil(total / limitNum),
      hasNextPage: pageNum < Math.ceil(total / limitNum),
      hasPrevPage: pageNum > 1,
    },
  });
});

// ─────────────────────────────────────────────────────────────
// GET  /admin/comments/stats
// ─────────────────────────────────────────────────────────────

export const getCommentStats = asyncHandler(async (_req, res) => {
  const [total, active, flagged, removed, pending] = await Promise.all([
    prisma.comment.count({ where: { isDeleted: false } }),
    prisma.comment.count({ where: { isDeleted: false, status: "active"  } }),
    prisma.comment.count({ where: { isDeleted: false, status: "flagged" } }),
    prisma.comment.count({ where: { isDeleted: false, status: "removed" } }),
    prisma.comment.count({ where: { isDeleted: false, status: "pending" } }),
  ]);

  return res.status(200).json({
    success: true,
    data: { total, active, flagged, removed, pending },
  });
});

// ─────────────────────────────────────────────────────────────
// GET  /admin/comments/:id
// ─────────────────────────────────────────────────────────────

export const getCommentById = asyncHandler(async (req, res, next) => {
  const comment = await prisma.comment.findFirst({
    where: { id: req.params.id, isDeleted: false },
    include: {
      author: {
        select: {
          id:            true,
          username:      true,
          fullName:      true,
          avatar:        true,
          accountStatus: true,
          email:         true,
        },
      },
      post: {
        select: {
          id:        true,
          caption:   true,
          type:      true,
          createdAt: true,
          author: {
            select: { id: true, username: true, fullName: true, avatar: true },
          },
        },
      },
    },
  });

  if (!comment) return next(new AppError("Comment not found", 404));

  // Fetch reports for this comment
  const reports = await prisma.report.findMany({
    where:  { postId: null }, // Comment-level reports — adjust if schema has commentId
    select: {
      id:        true,
      reason:    true,
      status:    true,
      createdAt: true,
      reportedBy: { select: { username: true } },
    },
  });

  const normalised = {
    ...comment,
    author: comment.author
      ? { ...comment.author, avatar: extractAvatar(comment.author.avatar) }
      : null,
  };

  logger.info(`Admin viewed comment ${req.params.id}`);

  auditComment({
    req,
    action:       AUDIT_ACTIONS.COMMENT_VIEWED,
    commentId:    comment.id,
    commentContent: comment.content,
    postId:       comment.post?.id,
    postCaption:  comment.post?.caption,
    postType:     comment.post?.type,
    newStatus:    comment.status,
  });

  return res.status(200).json({
    success: true,
    data:    { ...normalised, reports },
  });
});

// ─────────────────────────────────────────────────────────────
// PATCH  /admin/comments/:id/status
// ─────────────────────────────────────────────────────────────

export const updateCommentStatus = asyncHandler(async (req, res, next) => {
  const { status, reason } = req.body;

  const ALLOWED = ["active", "flagged", "removed", "pending"];
  if (!status || !ALLOWED.includes(status)) {
    return next(new AppError(`status must be one of: ${ALLOWED.join(", ")}`, 400));
  }

  const existing = await prisma.comment.findFirst({
    where: { id: req.params.id, isDeleted: false },
  });
  if (!existing) return next(new AppError("Comment not found", 404));

  // commentsCount adjust
  if (existing.postId) {
    if ((status === "removed" || status === "flagged") && existing.status === "active") {
      await prisma.post.update({
        where: { id: existing.postId },
        data: { commentsCount: { decrement: 1 } },
      }).catch(() => {});
    } else if (status === "active" && (existing.status === "removed" || existing.status === "flagged")) {
      await prisma.post.update({
        where: { id: existing.postId },
        data: { commentsCount: { increment: 1 } },
      }).catch(() => {});
    }
  }

  const comment = await prisma.comment.update({
    where: { id: req.params.id },
    data: {
      status,
      moderatedAt:      new Date(),
      moderatedBy:      req.user.id,
      ...(reason ? { moderationReason: reason } : {}),
    },
    include: {
      author: {
        select: { id: true, username: true, fullName: true, avatar: true },
      },
    },
  });

  const normalised = {
    ...comment,
    author: comment.author
      ? { ...comment.author, avatar: extractAvatar(comment.author.avatar) }
      : null,
  };

  logger.info(`Admin ${req.user.id} set comment ${req.params.id} status → ${status}`);

  const commentActionMap = {
    active:  AUDIT_ACTIONS.COMMENT_APPROVED,
    flagged: AUDIT_ACTIONS.COMMENT_FLAGGED,
    removed: AUDIT_ACTIONS.COMMENT_REMOVED,
  };

  auditComment({
    req,
    action:        commentActionMap[status] ?? AUDIT_ACTIONS.COMMENT_REMOVED,
    commentId:     comment.id,
    commentContent: comment.content,
    newStatus:     status,
  });

  return res.status(200).json({ success: true, data: normalised });
});

// ─────────────────────────────────────────────────────────────
// DELETE  /admin/comments/:id   (soft delete)
// ─────────────────────────────────────────────────────────────

export const deleteComment = asyncHandler(async (req, res, next) => {
  const existing = await prisma.comment.findFirst({
    where: { id: req.params.id, isDeleted: false },
  });
  if (!existing) return next(new AppError("Comment not found", 404));

  const comment = await prisma.comment.update({
    where: { id: req.params.id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: req.user.id,
      status:    "removed",
    },
  });

  // commentsCount decrement
  if (existing.postId) {
    await prisma.post.update({
      where: { id: existing.postId },
      data: { commentsCount: { decrement: 1 } },
    }).catch(() => {});
  }

  logger.info(`Admin ${req.user.id} soft-deleted comment ${req.params.id}`);

  auditComment({
    req,
    action:        AUDIT_ACTIONS.COMMENT_DELETED,
    commentId:     comment.id,
    commentContent: comment.content,
    newStatus:     "removed",
  });

  return res.status(200).json({ success: true, message: "Comment deleted successfully" });
});

// ─────────────────────────────────────────────────────────────
// PATCH  /admin/comments/bulk
// Body: { ids: string[], action: "approve"|"flag"|"remove"|"delete", reason?: string }
// ─────────────────────────────────────────────────────────────

export const bulkUpdateComments = asyncHandler(async (req, res, next) => {
  const { ids, action, reason } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return next(new AppError("ids must be a non-empty array", 400));
  }

  const ALLOWED_ACTIONS = ["approve", "flag", "remove", "delete"];
  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return next(new AppError(`action must be one of: ${ALLOWED_ACTIONS.join(", ")}`, 400));
  }

  const where = { id: { in: ids }, isDeleted: false };

  let data;
  if (action === "delete") {
    data = {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: req.user.id,
      status:    "removed",
    };
  } else {
    const statusMap = { approve: "active", flag: "flagged", remove: "removed" };
    data = {
      status:      statusMap[action],
      moderatedAt: new Date(),
      moderatedBy: req.user.id,
      ...(reason ? { moderationReason: reason } : {}),
    };
  }

  const result = await prisma.comment.updateMany({ where, data });

  logger.info(`Admin ${req.user.id} bulk-${action}: ${result.count}/${ids.length} comments`);

  auditLogger({
    req,
    action:     AUDIT_ACTIONS.COMMENT_BULK_UPDATED,
    targetType: "comment",
    targetMeta: {
      actionTaken: action,
      status:      action === "approve" ? "active" : action === "flag" ? "flagged" : "removed",
      reason:      reason || null,
    },
    note: `Bulk ${action}: ${result.count}/${ids.length} comments modified`,
  });

  return res.status(200).json({
    success: true,
    message: `Bulk ${action} completed`,
    data: {
      action,
      requested: ids.length,
      modified:  result.count,
      failed:    ids.length - result.count,
    },
  });
});