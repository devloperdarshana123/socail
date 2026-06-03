

import asyncHandler    from "../../middlewares/asyncHandler.js";
import AppError        from "../../utils/AppError.js";
import Report          from "../../models/report.model.js";
import User            from "../../models/user.model.js";
import Post            from "../../models/post.model.js";
import logger          from "../../config/logger.js";

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_STATUSES = [
  "pending",
  "under_review",
  "resolved_action_taken",
  "resolved_no_action",
  "dismissed",
];

const ALLOWED_ACTIONS = [
  "none",
  "content_removed",
  "user_warned",
  "user_suspended",
  "user_banned",
  "other",
];

const ALLOWED_PRIORITIES = ["low", "medium", "high", "critical"];

// Claim TTL — 30 minutes by default; super_admin can override
const DEFAULT_CLAIM_TTL_MINUTES = 30;

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages:  Math.ceil(total / limit),
  hasNextPage: page < Math.ceil(total / limit),
  hasPrevPage: page > 1,
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /admin/reports/stats
//  Dashboard stat card — status breakdown + priority breakdown + 7-day trend
// ─────────────────────────────────────────────────────────────────────────────

export const getReportStats = asyncHandler(async (req, res) => {
  const [byStatus, byReason, byTarget, byPriority, recentTrend] = await Promise.all([
    Report.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Report.aggregate([
      { $group: { _id: "$reason", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    Report.aggregate([
      { $group: { _id: "$targetModel", count: { $sum: 1 } } },
    ]),
    // Priority breakdown — only open reports matter
    Report.aggregate([
      { $match: { status: { $in: ["pending", "under_review"] } } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
      { $sort:  { count: -1 } },
    ]),
    // Last 7 days daily incoming reports
    Report.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id:   { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return res.status(200).json({
    success: true,
    data: { byStatus, byReason, byTarget, byPriority, recentTrend },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /admin/reports
//  Full paginated list — filterable by status, targetModel, reason, priority,
//  escalated, claimedByMe, unclaimedOnly
// ─────────────────────────────────────────────────────────────────────────────

export const getAllReports = asyncHandler(async (req, res, next) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip  = (page - 1) * limit;

  const {
    status,
    targetModel,
    reason,
    priority,
    escalated,
    claimedByMe,
    unclaimedOnly,
    sortOrder = "desc",
  } = req.query;

  // ── Build filter ──────────────────────────────────────────────────────────
  const filter = {};

  if (status      && ALLOWED_STATUSES.includes(status))                         filter.status      = status;
  if (targetModel && ["Post", "Comment", "User"].includes(targetModel))          filter.targetModel = targetModel;
  if (reason)                                                                    filter.reason      = reason;
  if (priority    && ALLOWED_PRIORITIES.includes(priority))                      filter.priority    = priority;
  if (escalated   === "true")                                                    filter.escalated   = true;
  if (claimedByMe === "true")                                                    filter.claimedBy   = req.user._id;
  if (unclaimedOnly === "true")                                                  filter.claimedBy   = null;

  // ── Sort ──────────────────────────────────────────────────────────────────
  // Default queue sort: priority DESC, then createdAt per sortOrder
  const sortDir = sortOrder === "asc" ? 1 : -1;
  const sort    = { priority: -1, createdAt: sortDir };

  // ── Parallel: data + total + sidebar counts ───────────────────────────────
  const [reports, total, statusCounts, priorityCounts] = await Promise.all([
    Report.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
.populate("reportedBy",  "username fullName avatar")
.populate({
  path:    "targetId",
  select:  "username fullName avatar caption media type author accountStatus likesCount commentsCount",
  populate: { path: "author", select: "username fullName avatar isVerifiedBadge", strictPopulate: false },
})
.populate("reviewedBy",  "username fullName")
.populate("claimedBy",   "username fullName avatar")
.populate("escalatedBy", "username fullName")
      .select("-moderatorNote")
      .lean(),

    Report.countDocuments(filter),

    // Status sidebar counts — always full (ignore current filter)
    Report.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    // Priority counts for open reports — always full
    Report.aggregate([
      { $match: { status: { $in: ["pending", "under_review"] } } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]),
  ]);

  // Shape status counts
  const counts = {
    all: 0, pending: 0, under_review: 0,
    resolved_action_taken: 0, resolved_no_action: 0, dismissed: 0,
  };
  statusCounts.forEach(({ _id, count }) => {
    if (_id in counts) counts[_id] = count;
    counts.all += count;
  });

  // Shape priority counts
  const priorities = { low: 0, medium: 0, high: 0, critical: 0 };
  priorityCounts.forEach(({ _id, count }) => {
    if (_id in priorities) priorities[_id] = count;
  });

  logger.info("Admin fetched reports", {
    adminId: req.user._id,
    filter,
    total,
  });

  return res.status(200).json({
    success: true,
    data:       reports,
    pagination: paginationMeta(total, page, limit),
    counts,
    priorities,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /admin/reports/:id
//  Single report detail — full target context + other reports count
// ─────────────────────────────────────────────────────────────────────────────

export const getReportById = asyncHandler(async (req, res, next) => {
  const report = await Report.findById(req.params.id)
    .populate("reportedBy",  "username fullName avatar accountStatus isVerifiedBadge createdAt")
    .populate({
      path:    "targetId",
      select:  "username fullName avatar caption media type likesCount commentsCount createdAt author accountStatus",
      populate: { path: "author", select: "username fullName avatar isVerifiedBadge", strictPopulate: false },
    })
    .populate("reviewedBy",  "username fullName avatar")
    .populate("claimedBy",   "username fullName avatar")
    .populate("escalatedBy", "username fullName avatar")
    .select("+moderatorNote")
    .lean();

  if (!report) return next(new AppError("Report not found", 404));

  // Sibling reports on same target
  const [otherReportsCount, openReportsCount] = await Promise.all([
    Report.countDocuments({
      targetId:    report.targetId,
      targetModel: report.targetModel,
      _id:         { $ne: report._id },
    }),
    Report.countDocuments({
      targetId:    report.targetId,
      targetModel: report.targetModel,
      _id:         { $ne: report._id },
      status:      { $in: ["pending", "under_review"] },
    }),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      ...report,
      otherReportsOnTarget: otherReportsCount,
      openReportsOnTarget:  openReportsCount,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /admin/reports/:id/history
//  All reports against the same target — for the "History" tab in detail panel
// ─────────────────────────────────────────────────────────────────────────────

export const getReportHistory = asyncHandler(async (req, res, next) => {
  const report = await Report.findById(req.params.id).select("targetId targetModel").lean();
  if (!report) return next(new AppError("Report not found", 404));

  const { beforeId, limit } = req.query;

  const history = await Report.getReportHistory(
    report.targetId,
    report.targetModel,
    { beforeId, limit },
  );

  return res.status(200).json({
    success: true,
    data:    history,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /admin/reports/:id/claim
//  Claim a report for review — atomic, prevents double-moderation
// ─────────────────────────────────────────────────────────────────────────────

export const claimReport = asyncHandler(async (req, res, next) => {
  const reportId    = req.params.id;
  const moderatorId = req.user._id;
  const ttl         = parseInt(req.body?.ttlMinutes) || DEFAULT_CLAIM_TTL_MINUTES;

  const { claimed, report } = await Report.claimReport(reportId, moderatorId, ttl);

  if (!claimed) {
    // Already claimed by someone else — return 409 with who has it
    return res.status(409).json({
      success: false,
      message: `Report is currently claimed by ${report?.claimedBy?.username ?? "another moderator"}`,
      data: {
        claimedBy:      report?.claimedBy ?? null,
        claimedAt:      report?.claimedAt ?? null,
        claimExpiresAt: report?.claimExpiresAt ?? null,
      },
    });
  }

  logger.info("Admin claimed report", {
    adminId:   moderatorId,
    reportId,
    expiresAt: report.claimExpiresAt,
  });

  return res.status(200).json({
    success: true,
    message: "Report claimed successfully",
    data:    report,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /admin/reports/:id/claim
//  Release a claimed report
// ─────────────────────────────────────────────────────────────────────────────

export const releaseReport = asyncHandler(async (req, res, next) => {
  const reportId    = req.params.id;
  const moderatorId = req.user._id;
  const role        = req.user.role;

  const report = await Report.releaseReport(reportId, moderatorId, role);

  if (!report) {
    return next(new AppError("Report not found or you don't own this claim", 403));
  }

  logger.info("Admin released report claim", { adminId: moderatorId, reportId });

  return res.status(200).json({
    success: true,
    message: "Claim released",
    data:    report,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /admin/reports/:id/escalate
//  Escalate to senior admin
// ─────────────────────────────────────────────────────────────────────────────

export const escalateReport = asyncHandler(async (req, res, next) => {
  const reportId    = req.params.id;
  const moderatorId = req.user._id;
  const { reason }  = req.body;

  // Check report exists
  const existing = await Report.findById(reportId).select("_id escalated status").lean();
  if (!existing) return next(new AppError("Report not found", 404));

  if (existing.escalated) {
    return next(new AppError("Report is already escalated", 400));
  }

  if (["resolved_action_taken", "resolved_no_action", "dismissed"].includes(existing.status)) {
    return next(new AppError("Cannot escalate a resolved or dismissed report", 400));
  }

  const report = await Report.escalateReport({ reportId, moderatorId, reason });

  logger.info("Admin escalated report", {
    adminId:   moderatorId,
    reportId,
    reason,
  });

  return res.status(200).json({
    success: true,
    message: "Report escalated successfully",
    data:    report,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /admin/reports/:id/status
//  Update report status + apply side-effects (suspend, remove content, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export const updateReportStatus = asyncHandler(async (req, res, next) => {
  const { status, actionTaken = "none", moderatorNote = "" } = req.body;

  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return next(new AppError(`Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}`, 400));
  }
  if (!ALLOWED_ACTIONS.includes(actionTaken)) {
    return next(new AppError(`Invalid actionTaken. Allowed: ${ALLOWED_ACTIONS.join(", ")}`, 400));
  }

  const report = await Report.findByIdAndUpdate(
    req.params.id,
    {
      status,
      actionTaken,
      moderatorNote,
      reviewedBy:     req.user._id,
      reviewedAt:     new Date(),
      // Release claim on any status update
      claimedBy:      null,
      claimedAt:      null,
      claimExpiresAt: null,
    },
    { new: true, runValidators: true },
  )
    .populate("reportedBy", "username fullName avatar")
    .populate("reviewedBy", "username fullName avatar")
    .lean();

  if (!report) return next(new AppError("Report not found", 404));

  // ── Side-effects ──────────────────────────────────────────────────────────

  if (actionTaken === "content_removed" && report.targetModel === "Post") {
    await Promise.all([
      Post.findByIdAndUpdate(report.targetId, {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user._id,
      }),
      // Bulk resolve all other pending reports on same post
      Report.bulkResolveForTarget(
        report.targetId, "Post", req.user._id, "content_removed",
        "Auto-resolved: content removed",
      ),
    ]);
  }

  if (actionTaken === "user_suspended" && report.targetModel === "User") {
    await User.findByIdAndUpdate(report.targetId, { accountStatus: "suspended" });
  }

  if (actionTaken === "user_banned" && report.targetModel === "User") {
    await User.findByIdAndUpdate(report.targetId, { accountStatus: "banned" });
  }

  // Stash username in res.locals for audit middleware
  res.locals.auditMeta = {
    username:   report.reportedBy?.username ?? null,
    status,
    actionTaken,
  };

  logger.info("Admin updated report status", {
    adminId:    req.user._id,
    reportId:   req.params.id,
    status,
    actionTaken,
  });

  return res.status(200).json({
    success: true,
    message: "Report updated successfully",
    data:    report,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /admin/reports/bulk
//  Bulk status update — body: { ids: [...], status, actionTaken }
// ─────────────────────────────────────────────────────────────────────────────

export const bulkUpdateReports = asyncHandler(async (req, res, next) => {
  const { ids, status, actionTaken = "none" } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return next(new AppError("ids must be a non-empty array", 400));
  }
  if (ids.length > 100) {
    return next(new AppError("Cannot bulk update more than 100 reports at once", 400));
  }
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return next(new AppError("Invalid status", 400));
  }

  const result = await Report.updateMany(
    { _id: { $in: ids } },
    {
      status,
      actionTaken,
      reviewedBy:     req.user._id,
      reviewedAt:     new Date(),
      claimedBy:      null,
      claimedAt:      null,
      claimExpiresAt: null,
    },
  );

  logger.info("Admin bulk-updated reports", {
    adminId: req.user._id,
    count:   result.modifiedCount,
    status,
    actionTaken,
  });

  return res.status(200).json({
    success: true,
    message: `${result.modifiedCount} report(s) updated`,
    data:    { modifiedCount: result.modifiedCount },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /admin/reports/release-stale-claims
//  Admin utility — release all expired claims (call from cron or manually)
// ─────────────────────────────────────────────────────────────────────────────

export const releaseStaleClams = asyncHandler(async (req, res) => {
  const result = await Report.releaseStaleClams();

  logger.info("Admin released stale claims", {
    adminId:  req.user._id,
    released: result.modifiedCount,
  });

  return res.status(200).json({
    success: true,
    message: `${result.modifiedCount} stale claim(s) released`,
    data:    { released: result.modifiedCount },
  });
});
