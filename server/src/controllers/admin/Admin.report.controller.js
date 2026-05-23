import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError      from "../../utils/AppError.js";
import Report        from "../../models/report.model.js";
import User          from "../../models/user.model.js";
import Post          from "../../models/post.model.js";
import logger        from "../../config/logger.js";

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages:  Math.ceil(total / limit),
  hasNextPage: page < Math.ceil(total / limit),
  hasPrevPage: page > 1,
});

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

// ─────────────────────────────────────────────────────────────
//  GET /admin/reports
//  All reports — paginated, filterable by status / targetModel / reason
// ─────────────────────────────────────────────────────────────

export const getAllReports = asyncHandler(async (req, res, next) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip  = (page - 1) * limit;

  const { status, targetModel, reason, search, sortOrder = "desc" } = req.query;

  // ── Build filter ─────────────────────────────────────────────
  const filter = {};

  if (status && ALLOWED_STATUSES.includes(status))         filter.status      = status;
  if (targetModel && ["Post","Comment","User"].includes(targetModel))
                                                            filter.targetModel = targetModel;
  if (reason)                                               filter.reason      = reason;

  // ── Sort ─────────────────────────────────────────────────────
  const sortDir = sortOrder === "asc" ? 1 : -1;

  // ── Parallel: data + total ────────────────────────────────────
  const [reports, total, statusCounts] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: sortDir })
      .skip(skip)
      .limit(limit)
      .populate("reportedBy", "username fullName avatar")
      .populate("targetId", "username fullName avatar caption media type author accountStatus")
      .populate("reviewedBy", "username fullName")
      .select("-moderatorNote")
      .lean(),

    Report.countDocuments(filter),

    // Sidebar counts per status — always full (ignore current filter)
    Report.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  // Shape sidebar counts
  const counts = {
    all: 0, pending: 0, under_review: 0,
    resolved_action_taken: 0, resolved_no_action: 0, dismissed: 0,
  };
  statusCounts.forEach(({ _id, count }) => {
    if (_id in counts) counts[_id] = count;
    counts.all += count;
  });

  logger.info("Admin fetched reports", { adminId: req.user._id, filter, total });

  return res.status(200).json({
    success: true,
    data:       reports,
    pagination: paginationMeta(total, page, limit),
    counts,
  });
});

// ─────────────────────────────────────────────────────────────
//  GET /admin/reports/:id
//  Single report detail with full target context
// ─────────────────────────────────────────────────────────────

export const getReportById = asyncHandler(async (req, res, next) => {
  const report = await Report.findById(req.params.id)
    .populate("reportedBy", "username fullName avatar accountStatus isVerifiedBadge createdAt")
    .populate({
      path:    "targetId",
      select:  "username fullName avatar caption media type likesCount commentsCount createdAt author accountStatus",
      populate: { path: "author", select: "username fullName avatar isVerifiedBadge" },
    })
    .populate("reviewedBy", "username fullName avatar")
    .select("+moderatorNote")   // include hidden field
    .lean();

  if (!report) return next(new AppError("Report not found", 404));

  // How many other reports exist on the same target?
  const otherReportsCount = await Report.countDocuments({
    targetId:    report.targetId,
    targetModel: report.targetModel,
    _id:         { $ne: report._id },
  });

  return res.status(200).json({
    success: true,
    data: { ...report, otherReportsOnTarget: otherReportsCount },
  });
});

// ─────────────────────────────────────────────────────────────
//  PATCH /admin/reports/:id/status
//  Update report status + optional action
// ─────────────────────────────────────────────────────────────

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
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
    },
    { new: true, runValidators: true }
  )
    .populate("reportedBy", "username fullName avatar")
    .populate("reviewedBy", "username fullName avatar")
    .lean();

  if (!report) return next(new AppError("Report not found", 404));

  // ── Side-effects based on actionTaken ────────────────────────
  if (actionTaken === "content_removed" && report.targetModel === "Post") {
    await Post.findByIdAndUpdate(report.targetId, {
      isDeleted: true, deletedAt: new Date(), deletedBy: req.user._id,
    });
    // Bulk resolve all other pending reports on same post
    await Report.bulkResolveForTarget(
      report.targetId, "Post", req.user._id, "content_removed"
    );
  }

  if (actionTaken === "user_suspended" && report.targetModel === "User") {
    await User.findByIdAndUpdate(report.targetId, { accountStatus: "suspended" });
  }

  if (actionTaken === "user_banned" && report.targetModel === "User") {
    await User.findByIdAndUpdate(report.targetId, { accountStatus: "banned" });
  }

  logger.info("Admin updated report status", {
    adminId:   req.user._id,
    reportId:  req.params.id,
    status,
    actionTaken,
  });

  return res.status(200).json({
    success: true,
    message: "Report updated successfully",
    data:    report,
  });
});

// ─────────────────────────────────────────────────────────────
//  PATCH /admin/reports/bulk
//  Bulk status update — body: { ids: [...], status, actionTaken }
// ─────────────────────────────────────────────────────────────

export const bulkUpdateReports = asyncHandler(async (req, res, next) => {
  const { ids, status, actionTaken = "none" } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return next(new AppError("ids must be a non-empty array", 400));
  }
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return next(new AppError(`Invalid status`, 400));
  }

  const result = await Report.updateMany(
    { _id: { $in: ids } },
    {
      status,
      actionTaken,
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
    }
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

// ─────────────────────────────────────────────────────────────
//  GET /admin/reports/stats
//  Quick stats for dashboard card
// ─────────────────────────────────────────────────────────────

export const getReportStats = asyncHandler(async (req, res) => {
  const [byStatus, byReason, byTarget, recentTrend] = await Promise.all([
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
    // Last 7 days daily counts
    Report.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return res.status(200).json({
    success: true,
    data: { byStatus, byReason, byTarget, recentTrend },
  });
});