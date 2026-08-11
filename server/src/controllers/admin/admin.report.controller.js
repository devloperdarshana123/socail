

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError     from "../../utils/AppError.js";
import * as AdminReportHelper from "../../utils/adminReportHelpers.js";
import logger       from "../../config/logger.js";

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
// ─────────────────────────────────────────────────────────────────────────────

export const getReportStats = asyncHandler(async (req, res) => {
  const since7days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [byStatusRaw, byReasonRaw, byTargetRaw, byPriorityRaw, recentTrendRaw] = await Promise.all([
    // Status breakdown
    AdminReportHelper.groupReportsByStatus(),

    // Top 5 reasons
    AdminReportHelper.groupTopReportReasons(),

    // By target model
    AdminReportHelper.groupReportsByTargetModel(),

    // Priority breakdown — open reports only
    AdminReportHelper.groupOpenReportsByPriorityOrdered(),

    // Last 7 days daily trend — raw SQL for date grouping
    AdminReportHelper.findReportDailyTrend(since7days),
  ]);

  const byStatus   = byStatusRaw.map((r)  => ({ _id: r.key, count: r.count }));
  const byReason   = byReasonRaw.map((r)  => ({ _id: r.key, count: r.count }));
  const byTarget   = byTargetRaw.map((r)  => ({ _id: r.key, count: r.count }));
  const byPriority = byPriorityRaw.map((r) => ({ _id: r.key, count: r.count }));

  return res.status(200).json({
    success: true,
    data: { byStatus, byReason, byTarget, byPriority, recentTrend: recentTrendRaw },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /admin/reports
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

  // ── Build where ──────────────────────────────────────────────────────────
  const where = {};

 if (status && ALLOWED_STATUSES.includes(status)) where.status = status;
  if (targetModel && ["Post", "Comment", "User"].includes(targetModel)) where.targetModel  = targetModel;
  if (reason)                                                           where.reason       = reason;
  if (priority    && ALLOWED_PRIORITIES.includes(priority))             where.priority     = priority;
  if (escalated   === "true")                                           where.escalated    = true;
  if (claimedByMe === "true")                                           where.claimedById  = req.user.id;
  if (unclaimedOnly === "true")                                         where.claimedById  = null;

  // ── Parallel: reports + count + sidebar counts ───────────────────────────
  const [reports, total, statusCountsRaw, priorityCountsRaw] = await Promise.all([
    AdminReportHelper.findReports(
      where,
      [{ priority: "desc" }, { createdAt: sortOrder === "asc" ? "asc" : "desc" }],
      skip,
      limit,
    ),

    AdminReportHelper.countReports(where),

    // Full status counts (no filter)
    AdminReportHelper.groupReportsByStatus(),

    // Open priority counts (no filter)
    AdminReportHelper.groupOpenReportsByPriority(),
  ]);

  // Shape status counts
  const counts = {
    all: 0, pending: 0, under_review: 0,
    resolved_action_taken: 0, resolved_no_action: 0, dismissed: 0,
  };
  statusCountsRaw.forEach(({ key: s, count }) => {
    if (s in counts) counts[s] = count;
    counts.all += count;
  });

  // Shape priority counts
  const priorities = { low: 0, medium: 0, high: 0, critical: 0 };
  priorityCountsRaw.forEach(({ key: p, count }) => {
    if (p in priorities) priorities[p] = count;
  });

  logger.info("Admin fetched reports", { adminId: req.user.id, total });

  return res.status(200).json({
    success: true,
    data: reports.map(r => ({ ...r, targetId: r.post ?? r.reportedUser ?? null })),
    pagination: paginationMeta(total, page, limit),
    counts,
    priorities,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /admin/reports/:id
// ─────────────────────────────────────────────────────────────────────────────

export const getReportById = asyncHandler(async (req, res, next) => {
  const report = await AdminReportHelper.findReportDetail(req.params.id);

  if (!report) return next(new AppError("Report not found", 404));

  // Sibling reports on same post
  const [otherReportsCount, openReportsCount] = await Promise.all([
    AdminReportHelper.countReports({ postId: report.postId, id: { not: report.id } }),
    AdminReportHelper.countReports({
      postId: report.postId,
      id:     { not: report.id },
      status: { in: ["pending", "under_review"] },
    }),
  ]);

  return res.status(200).json({
    success: true,
    data: {
  ...report,
  targetId: report.post ?? report.reportedUser ?? null,
  comment: report.comment ?? null,
  otherReportsOnTarget: otherReportsCount,
      openReportsOnTarget:  openReportsCount,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /admin/reports/:id/history
//  All reports against the same post target
// ─────────────────────────────────────────────────────────────────────────────

export const getReportHistory = asyncHandler(async (req, res, next) => {
  const report = await AdminReportHelper.findReportPostId(req.params.id);
  if (!report) return next(new AppError("Report not found", 404));

  const { beforeId, limit = 20 } = req.query;
  const take = Math.min(50, Math.max(1, parseInt(limit)));

  const where = {
    postId: report.postId,
    id:     { not: req.params.id },
    ...(beforeId ? { id: { lt: beforeId } } : {}),
  };

  const history = await AdminReportHelper.findReportHistory(where, take);

  return res.status(200).json({ success: true, data: history });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /admin/reports/:id/claim
//  Atomic claim — prevents double-moderation
// ─────────────────────────────────────────────────────────────────────────────

export const claimReport = asyncHandler(async (req, res, next) => {
  const reportId    = req.params.id;
  const moderatorId = req.user.id;
  const ttl         = parseInt(req.body?.ttlMinutes) || DEFAULT_CLAIM_TTL_MINUTES;
  const now         = new Date();
  const expiresAt   = new Date(now.getTime() + ttl * 60 * 1000);

  // Check existing claim
  const existing = await AdminReportHelper.findReportWithClaimer(reportId);

  if (!existing) return next(new AppError("Report not found", 404));

  // Already claimed by someone else and not expired
  if (
    existing.claimedById &&
    existing.claimedById !== moderatorId &&
    existing.claimExpiresAt &&
    existing.claimExpiresAt > now
  ) {
    return res.status(409).json({
      success: false,
      message: `Report is currently claimed by ${existing.claimedBy?.username ?? "another moderator"}`,
      data: {
        claimedBy:      existing.claimedBy      ?? null,
        claimedAt:      existing.claimedAt      ?? null,
        claimExpiresAt: existing.claimExpiresAt ?? null,
      },
    });
  }

  // Claim it
  const report = await AdminReportHelper.updateReportById(reportId, {
    claimedById:    moderatorId,
    claimedAt:      now,
    claimExpiresAt: expiresAt,
    status:         existing.status === "pending" ? "under_review" : existing.status,
  });

  logger.info("Admin claimed report", { adminId: moderatorId, reportId, expiresAt });

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
  const moderatorId = req.user.id;
  const isSuperAdmin = req.user.role === "super_admin";

  const existing = await AdminReportHelper.findReportClaimState(reportId);

  if (!existing) return next(new AppError("Report not found", 404));

  // Only claim owner or super_admin can release
  if (!isSuperAdmin && existing.claimedById !== moderatorId) {
    return next(new AppError("Report not found or you don't own this claim", 403));
  }

  const report = await AdminReportHelper.updateReportById(reportId, {
    claimedById: null, claimedAt: null, claimExpiresAt: null,
  });

  logger.info("Admin released report claim", { adminId: moderatorId, reportId });

  return res.status(200).json({ success: true, message: "Claim released", data: report });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /admin/reports/:id/escalate
// ─────────────────────────────────────────────────────────────────────────────

export const escalateReport = asyncHandler(async (req, res, next) => {
  const reportId    = req.params.id;
  const moderatorId = req.user.id;
  const { reason }  = req.body;

  const existing = await AdminReportHelper.findReportEscalationState(reportId);

  if (!existing) return next(new AppError("Report not found", 404));

  if (existing.escalated) {
    return next(new AppError("Report is already escalated", 400));
  }

  if (["resolved_action_taken", "resolved_no_action", "dismissed"].includes(existing.status)) {
    return next(new AppError("Cannot escalate a resolved or dismissed report", 400));
  }

  const report = await AdminReportHelper.updateReportById(reportId, {
    escalated:      true,
    escalationReason: reason || null,
    escalatedAt:    new Date(),
    escalatedById:  moderatorId,
    priority:       "high", // bump priority on escalation
  });

  logger.info("Admin escalated report", { adminId: moderatorId, reportId, reason });

  return res.status(200).json({
    success: true,
    message: "Report escalated successfully",
    data:    report,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /admin/reports/:id/status
// ─────────────────────────────────────────────────────────────────────────────

export const updateReportStatus = asyncHandler(async (req, res, next) => {
  const { status, actionTaken = "none", moderatorNote = "" } = req.body;

  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return next(new AppError(`Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}`, 400));
  }
  if (!ALLOWED_ACTIONS.includes(actionTaken)) {
    return next(new AppError(`Invalid actionTaken. Allowed: ${ALLOWED_ACTIONS.join(", ")}`, 400));
  }

  const report = await AdminReportHelper.updateReportForResolution(req.params.id, {
    status,
    actionTaken,
    moderatorNote,
    reviewedById:   req.user.id,
    reviewedAt:     new Date(),
    // Release claim on resolution
    claimedById:    null,
    claimedAt:      null,
    claimExpiresAt: null,
  });

  if (!report) return next(new AppError("Report not found", 404));

  // ── Side-effects ─────────────────────────────────────────────────────────

  if (actionTaken === "content_removed" && report.postId) {
    await Promise.all([
      // Soft-delete the post
      AdminReportHelper.softDeleteReportedPost(report.postId, {
        isDeleted: true, deletedAt: new Date(),
      }),
      // Bulk resolve all other pending reports on same post
      AdminReportHelper.updateReportsWhere(
        {
          postId: report.postId,
          id:     { not: report.id },
          status: { in: ["pending", "under_review"] },
        },
        {
          status:        "resolved_action_taken",
          actionTaken:   "content_removed",
          moderatorNote: "Auto-resolved: content removed",
          reviewedById:  req.user.id,
          reviewedAt:    new Date(),
          claimedById:   null,
          claimedAt:     null,
          claimExpiresAt: null,
        },
      ),
    ]);
  }

  if (actionTaken === "user_suspended") {
    const targetUserId = report.post?.authorId ?? report.reportedUser?.id;
    if (targetUserId) {
      await AdminReportHelper.updateUserAccountStatus(targetUserId, { accountStatus: "suspended" });
    }
  }

  if (actionTaken === "user_banned") {
    const targetUserId = report.post?.authorId ?? report.reportedUser?.id;
    if (targetUserId) {
      await AdminReportHelper.updateUserAccountStatus(targetUserId, { accountStatus: "banned" });
    }
  }

  res.locals.auditMeta = {
    username:   report.reportedBy?.username ?? null,
    status,
    actionTaken,
  };

  logger.info("Admin updated report status", {
    adminId:    req.user.id,
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

  const result = await AdminReportHelper.updateReportsWhere(
    { id: { in: ids } },
    {
      status,
      actionTaken,
      reviewedById:   req.user.id,
      reviewedAt:     new Date(),
      claimedById:    null,
      claimedAt:      null,
      claimExpiresAt: null,
    },
  );

  logger.info("Admin bulk-updated reports", {
    adminId: req.user.id,
    count:   result.count,
    status,
    actionTaken,
  });

  return res.status(200).json({
    success: true,
    message: `${result.count} report(s) updated`,
    data:    { modifiedCount: result.count },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /admin/reports/release-stale-claims
//  Release all expired claims — call from cron or manually
// ─────────────────────────────────────────────────────────────────────────────

export const releaseStaleClams = asyncHandler(async (req, res) => {
  const now = new Date();

  const result = await AdminReportHelper.updateReportsWhere(
    {
      claimedById:    { not: null },
      claimExpiresAt: { lte: now },
    },
    {
      claimedById:    null,
      claimedAt:      null,
      claimExpiresAt: null,
    },
  );

  logger.info("Admin released stale claims", {
    adminId:  req.user.id,
    released: result.count,
  });

  return res.status(200).json({
    success: true,
    message: `${result.count} stale claim(s) released`,
    data:    { released: result.count },
  });
});