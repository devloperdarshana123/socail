

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import * as AdminCommentHelper from "../../utils/adminCommentHelpers.js";
import logger from "../../config/logger.js";
import { AUDIT_ACTIONS } from "../../utils/auditLogger.js";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const extractAvatar = (avatar) => {
  if (!avatar) return null;
  if (typeof avatar === "string") return avatar;
  if (avatar?.url) return avatar.url;
  return null;
};

const auditComment = async ({ req, action, commentId, commentContent, postId, postCaption, postType, newStatus, note }) => {
  try {
    await AdminCommentHelper.createCommentAuditLog({
      performedById:   req.user.id,
      performedByName: req.user.fullName || req.user.username || "Admin",
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
      ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
      userAgent: req.headers["user-agent"] || null,
      note:      note || null,
    });
  } catch (err) {
    console.error("[AuditLog] comment audit failed:", err.message);
  }
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
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;

  // ── Build where ──────────────────────────────────────────
  const where = { isDeleted: false };
  if (status)   where.status   = status;
  if (postId)   where.postId   = postId;
  if (authorId) where.authorId = authorId;

  // Search — content, author username/fullName
  if (search.trim()) {
    where.or = [
      { content:            { like: search.trim(), caseInsensitive: true } },
      { author: { username: { like: search.trim(), caseInsensitive: true } } },
      { author: { fullName: { like: search.trim(), caseInsensitive: true } } },
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
    AdminCommentHelper.findComments(where, orderBy, skip, limitNum),
    AdminCommentHelper.countComments(where),
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
    AdminCommentHelper.countComments({ isDeleted: false }),
    AdminCommentHelper.countComments({ isDeleted: false, status: "active"  }),
    AdminCommentHelper.countComments({ isDeleted: false, status: "flagged" }),
    AdminCommentHelper.countComments({ isDeleted: false, status: "removed" }),
    AdminCommentHelper.countComments({ isDeleted: false, status: "pending" }),
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
  const comment = await AdminCommentHelper.findCommentDetail(req.params.id);

  if (!comment) return next(new AppError("Comment not found", 404));

  // Fetch reports for this comment
  const reports = await AdminCommentHelper.findCommentLevelReports();

  const normalised = {
    ...comment,
    author: comment.author
      ? { ...comment.author, avatar: extractAvatar(comment.author.avatar) }
      : null,
  };

  logger.info(`Admin viewed comment ${req.params.id}`);

  await auditComment({
    req,
    action:       AUDIT_ACTIONS.COMMENT_VIEWED ?? "comment_viewed",
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

  const existing = await AdminCommentHelper.findModeratableComment(req.params.id);
  if (!existing) return next(new AppError("Comment not found", 404));

  // commentsCount adjust
  if (existing.postId) {
    if ((status === "removed" || status === "flagged") && existing.status === "active") {
      await AdminCommentHelper.decrementPostCommentsCount(existing.postId).catch(() => {});
    } else if (status === "active" && (existing.status === "removed" || existing.status === "flagged")) {
      await AdminCommentHelper.incrementPostCommentsCount(existing.postId).catch(() => {});
    }
  }

  const comment = await AdminCommentHelper.updateCommentModeration(req.params.id, {
    status,
    moderatedAt:      new Date(),
    moderatedBy:      req.user.id,
    ...(reason ? { moderationReason: reason } : {}),
  });

  const normalised = {
    ...comment,
    author: comment.author
      ? { ...comment.author, avatar: extractAvatar(comment.author.avatar) }
      : null,
  };

  logger.info(`Admin ${req.user.id} set comment ${req.params.id} status → ${status}`);

  const commentActionMap = {
    active:  AUDIT_ACTIONS.COMMENT_APPROVED ?? "comment_approved",
    flagged: AUDIT_ACTIONS.COMMENT_FLAGGED  ?? "comment_flagged",
    removed: AUDIT_ACTIONS.COMMENT_REMOVED  ?? "comment_removed",
  };

  await auditComment({
    req,
    action:        commentActionMap[status] || "comment_removed",
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
  const existing = await AdminCommentHelper.findModeratableComment(req.params.id);
  if (!existing) return next(new AppError("Comment not found", 404));

  const comment = await AdminCommentHelper.softDeleteCommentById(req.params.id, {
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: req.user.id,
    status:    "removed",
  });

  // commentsCount decrement
  if (existing.postId) {
    await AdminCommentHelper.decrementPostCommentsCount(existing.postId).catch(() => {});
  }

  logger.info(`Admin ${req.user.id} soft-deleted comment ${req.params.id}`);

  await auditComment({
    req,
    action:        AUDIT_ACTIONS.COMMENT_DELETED ?? "comment_deleted",
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

  const result = await AdminCommentHelper.bulkUpdateComments(where, data);

  logger.info(`Admin ${req.user.id} bulk-${action}: ${result.count}/${ids.length} comments`);

  await AdminCommentHelper.createCommentAuditLog({
    performedById:   req.user.id,
    performedByName: req.user.fullName || req.user.username || "Admin",
    action:          AUDIT_ACTIONS.COMMENT_BULK_UPDATED ?? "comment_bulk_updated",
    targetId:        null,
    targetType:      "comment",
    targetMeta: {
      actionTaken: action,
      status:      action === "approve" ? "active" : action === "flag" ? "flagged" : "removed",
      reason:      reason || null,
    },
    note:      `Bulk ${action}: ${result.count}/${ids.length} comments modified`,
    ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
    userAgent: req.headers["user-agent"] || null,
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