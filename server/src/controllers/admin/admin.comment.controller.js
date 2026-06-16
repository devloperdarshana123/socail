
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import Comment from "../../models/comment.model.js";
import Post from "../../models/post.model.js";
import User from "../../models/user.model.js";
import Report from "../../models/report.model.js";
import logger from "../../config/logger.js";
import AuditLog, { AUDIT_ACTIONS } from "../../models/auditlog.model.js";
// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const extractAvatar = (user) => {
  if (!user) return null;
  if (typeof user.avatar === "string") return user.avatar;
  if (user.avatar?.url) return user.avatar.url;
  return null;
};


const auditComment = async ({ req, action, comment, post, newStatus, note }) => {
  try {
    const resolvedPost = post || comment?.post;
    await AuditLog.create({
      performedBy:     req.user._id,
      performedByName: req.user.fullName || req.user.username || "Admin",
      action,
      targetId:        comment._id,
      targetType:      "comment",
      targetMeta: {
        commentId:   comment._id?.toString(),
        commentText: (comment.content || "").slice(0, 120),
        postId:      resolvedPost?._id?.toString(),
        postCaption: (resolvedPost?.caption || "No caption").slice(0, 80),
        postType:    resolvedPost?.type || "post",
        newStatus:   newStatus || comment.status,
        reason:      req.body?.reason,
      },
      ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
      userAgent: req.headers["user-agent"] || null,
      note,
    });
  } catch (err) {
    // Audit failure should never break the main action
    console.error("[AuditLog] comment audit failed:", err.message);
  }
};

const commentListProject = {
  content: 1,
  status: 1,
  isDeleted: 1,
  isPinned: 1,
  likesCount: 1,
  repliesCount: 1,
  reportsCount: 1,
  createdAt: 1,
  updatedAt: 1,
  "author._id": 1,
  "author.username": 1,
  "author.fullName": 1,
  "author.avatar": 1,
  "author.isVerified": 1,
  "author.accountStatus": 1,
  "post._id": 1,
  "post.caption": 1,
  "post.type": 1,
  "post.media": 1,  // ✅ ye add karo
  "post.createdAt": 1,
  "post.author._id": 1,
  "post.author.username": 1,
  "post.author.fullName": 1,
  "post.author.avatar": 1,
};

// ─────────────────────────────────────────────────────────────
// GET  /admin/comments  — paginated list with filters
// ─────────────────────────────────────────────────────────────
export const getAllComments = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search = "",
    status,
    sort = "newest",
    postId,
    authorId,
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;

  // ── Match stage ──────────────────────────────────────────
  const matchStage = { isDeleted: false };
  if (status)   matchStage.status = status;
  if (postId)   matchStage.post   = postId;
  if (authorId) matchStage.author = authorId;

  // ── Sort stage ───────────────────────────────────────────
  const sortMap = {
    newest:       { createdAt: -1 },
    oldest:       { createdAt:  1 },
    most_likes:   { likesCount: -1 },
    most_reports: { reportsCount: -1 },
  };
  const sortStage = sortMap[sort] ?? { createdAt: -1 };

  const pipeline = [
    { $match: matchStage },

    // ── Join author ───────────────────────────────────────
    {
      $lookup: {
        from: "users",
        localField: "author",
        foreignField: "_id",
        as: "_authorArr",
        pipeline: [
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
              isVerified: 1,
              accountStatus: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        author: { $arrayElemAt: ["$_authorArr", 0] },
      },
    },
    { $unset: "_authorArr" },

    // ── Join post (with nested author lookup) ─────────────
    {
      $lookup: {
        from: "posts",
        localField: "post",
        foreignField: "_id",
        as: "_postArr",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "_postAuthorArr",
              pipeline: [
                {
                  $project: {
                    username: 1,
                    fullName: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              author: { $arrayElemAt: ["$_postAuthorArr", 0] },
            },
          },
          { $unset: "_postAuthorArr" },
          {
            $project: {
              caption: 1,
              type: 1,
              createdAt: 1,
               media: { $slice: ["$media", 1] },
              "author._id": 1,
              "author.username": 1,
              "author.fullName": 1,
              "author.avatar": 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        post: { $arrayElemAt: ["$_postArr", 0] },
      },
    },
    { $unset: "_postArr" },

    // ── Text search (post-join so username search works) ──
    ...(search.trim()
      ? [
          {
            $match: {
              $or: [
                { content:           { $regex: search.trim(), $options: "i" } },
                { "author.username": { $regex: search.trim(), $options: "i" } },
                { "author.fullName": { $regex: search.trim(), $options: "i" } },
              ],
            },
          },
        ]
      : []),

    // ── Count reports inline ──────────────────────────────
    {
      $lookup: {
        from: "reports",
        let: { cid: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$contentId", "$$cid"] },
                  { $eq: ["$contentType", "Comment"] },
                ],
              },
            },
          },
          { $count: "n" },
        ],
        as: "_reportsMeta",
      },
    },
    {
      $addFields: {
        reportsCount: {
          $ifNull: [{ $arrayElemAt: ["$_reportsMeta.n", 0] }, 0],
        },
      },
    },
    { $unset: "_reportsMeta" },

    { $sort: sortStage },

    // ── Facet: data + total count in one query ────────────
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limitNum },
          { $project: commentListProject },
        ],
        total: [{ $count: "count" }],
      },
    },
  ];

  const [result] = await Comment.aggregate(pipeline);
  const comments  = result?.data  ?? [];
  const totalDocs = result?.total?.[0]?.count ?? 0;

  // ── Normalise avatars ─────────────────────────────────────
  const normalised = comments.map((c) => ({
    ...c,
    author: c.author
      ? { ...c.author, avatar: extractAvatar(c.author) }
      : null,
    post: c.post
      ? {
          ...c.post,
          author: c.post.author
            ? { ...c.post.author, avatar: extractAvatar(c.post.author) }
            : null,
        }
      : null,
  }));

  logger.info(`Admin fetched comments — page ${pageNum}, total ${totalDocs}`);

  res.status(200).json({
    success: true,
    data: normalised,
    pagination: {
      total:       totalDocs,
      page:        pageNum,
      limit:       limitNum,
      totalPages:  Math.ceil(totalDocs / limitNum),
      hasNextPage: pageNum < Math.ceil(totalDocs / limitNum),
      hasPrevPage: pageNum > 1,
    },
  });
});

// ─────────────────────────────────────────────────────────────
// GET  /admin/comments/stats
// ─────────────────────────────────────────────────────────────
export const getCommentStats = asyncHandler(async (_req, res) => {
  const [stats] = await Comment.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id:     null,
        total:   { $sum: 1 },
        active:  { $sum: { $cond: [{ $eq: ["$status", "active"]  }, 1, 0] } },
        flagged: { $sum: { $cond: [{ $eq: ["$status", "flagged"] }, 1, 0] } },
        removed: { $sum: { $cond: [{ $eq: ["$status", "removed"] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
      },
    },
    { $project: { _id: 0 } },
  ]);

  res.status(200).json({
    success: true,
    data: stats ?? { total: 0, active: 0, flagged: 0, removed: 0, pending: 0 },
  });
});

// ─────────────────────────────────────────────────────────────
// GET  /admin/comments/:id
// ─────────────────────────────────────────────────────────────
export const getCommentById = asyncHandler(async (req, res) => {
  const comment = await Comment.findOne({ _id: req.params.id, isDeleted: false })
    .populate("author", "username fullName avatar isVerified accountStatus email")
    .populate({
      path: "post",
      select: "caption type createdAt author",
      populate: { path: "author", select: "username fullName avatar" },
    })
    .lean();

  if (!comment) throw new AppError("Comment not found", 404);

  const reports = await Report.find({
    contentId:   comment._id,
    contentType: "Comment",
  })
    .select("reason status createdAt reportedBy")
    .populate("reportedBy", "username")
    .lean();

  if (comment.author) {
    comment.author.avatar = extractAvatar(comment.author);
  }

  logger.info(`Admin viewed comment ${req.params.id}`);

   await auditComment({
    req,
    action:  AUDIT_ACTIONS.COMMENT_VIEWED,
    comment: { _id: req.params.id, content: comment.content, status: comment.status, post: comment.post },
    post:    comment.post,
  });

  res.status(200).json({
    success: true,
    data: { ...comment, reports },
  });
});

// ─────────────────────────────────────────────────────────────
// PATCH  /admin/comments/:id/status
// ─────────────────────────────────────────────────────────────
export const updateCommentStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;

  const ALLOWED = ["active", "flagged", "removed", "pending"];
  if (!status || !ALLOWED.includes(status)) {
    throw new AppError(`status must be one of: ${ALLOWED.join(", ")}`, 400);
  }

  const comment = await Comment.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    {
      $set: {
        status,
        moderatedAt: new Date(),
        moderatedBy: req.user._id,
        ...(reason ? { moderationReason: reason } : {}),
      },
    },
    { new: true }
  )
    .populate("author", "username fullName avatar isVerified")
    .lean();

  if (!comment) throw new AppError("Comment not found", 404);

  if (comment.author) {
    comment.author.avatar = extractAvatar(comment.author);
  }

  logger.info(
    `Admin ${req.user._id} set comment ${req.params.id} status → ${status}`
  );


   const commentActionMap = {
    active:  AUDIT_ACTIONS.COMMENT_APPROVED,
    flagged: AUDIT_ACTIONS.COMMENT_FLAGGED,
    removed: AUDIT_ACTIONS.COMMENT_REMOVED,
  };
  await auditComment({
    req,
    action:    commentActionMap[status] || AUDIT_ACTIONS.COMMENT_REMOVED,
    comment:   { _id: req.params.id, content: comment.content, post: comment.post },
    newStatus: status,
  });

  res.status(200).json({ success: true, data: comment });
});

// ─────────────────────────────────────────────────────────────
// DELETE  /admin/comments/:id   (soft delete)
// ─────────────────────────────────────────────────────────────
export const deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user._id,
        status:    "removed",
      },
    },
    { new: true }
  ).lean();

  if (!comment) throw new AppError("Comment not found", 404);

  logger.info(`Admin ${req.user._id} soft-deleted comment ${req.params.id}`);

   await auditComment({
    req,
    action:    AUDIT_ACTIONS.COMMENT_DELETED,
    comment:   { _id: req.params.id, content: comment.content, post: comment.post },
    newStatus: "removed",
  });

  res.status(200).json({ success: true, message: "Comment deleted successfully" });
});

// ─────────────────────────────────────────────────────────────
// PATCH  /admin/comments/bulk
// Body: { ids: string[], action: "approve"|"flag"|"remove"|"delete", reason?: string }
// ─────────────────────────────────────────────────────────────
export const bulkUpdateComments = asyncHandler(async (req, res) => {
  const { ids, action, reason } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError("ids must be a non-empty array", 400);
  }

  const ALLOWED_ACTIONS = ["approve", "flag", "remove", "delete"];
  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    throw new AppError(`action must be one of: ${ALLOWED_ACTIONS.join(", ")}`, 400);
  }

  const filter = { _id: { $in: ids }, isDeleted: false };

  let updatePayload;
  if (action === "delete") {
    updatePayload = {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user._id,
        status:    "removed",
      },
    };
  } else {
    const statusMap = { approve: "active", flag: "flagged", remove: "removed" };
    updatePayload = {
      $set: {
        status:      statusMap[action],
        moderatedAt: new Date(),
        moderatedBy: req.user._id,
        ...(reason ? { moderationReason: reason } : {}),
      },
    };
  }

  const result = await Comment.updateMany(filter, updatePayload);

  logger.info(
    `Admin ${req.user._id} bulk-${action}: ${result.modifiedCount}/${ids.length} comments`
  );

    const bulkActionMap = {
    approve: AUDIT_ACTIONS.COMMENT_APPROVED,
    flag:    AUDIT_ACTIONS.COMMENT_FLAGGED,
    remove:  AUDIT_ACTIONS.COMMENT_REMOVED,
    delete:  AUDIT_ACTIONS.COMMENT_DELETED,
  };
  await AuditLog.create({
    performedBy:     req.user._id,
    performedByName: req.user.fullName || req.user.username || "Admin",
    action:          AUDIT_ACTIONS.COMMENT_BULK_UPDATED,
    targetId:        null,
    targetType:      "comment",
    targetMeta: {
      actionTaken: action,
      status:      action === "approve" ? "active" : action === "flag" ? "flagged" : "removed",
      reason:      reason || null,
    },
    note: `Bulk ${action}: ${result.modifiedCount}/${ids.length} comments modified`,
    ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
    userAgent: req.headers["user-agent"] || null,
  });

 res.status(200).json({
  success: true,
  message: `Bulk ${action} completed`,
  data: {
    action,                              // ← yeh add karo
    requested: ids.length,
    modified:  result.modifiedCount,
    failed:    ids.length - result.modifiedCount,
  },
});
});