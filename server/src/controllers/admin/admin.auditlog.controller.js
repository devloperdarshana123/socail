import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError      from "../../utils/AppError.js";
import AuditLog, { AUDIT_ACTIONS, AUDIT_CATEGORIES } from "../../models/auditlog.model.js";
import logger        from "../../config/logger.js";

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Safe positive integer parser with default + ceiling */
const parsePageInt = (val, def, max = Infinity) =>
  Math.min(Math.max(parseInt(val) || def, 1), max);

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/admin/audit-logs
//  Query params:
//    page, limit       — pagination (default 1 / 20, max 100)
//    category          — auth | user | content | settings
//    action            — any AUDIT_ACTIONS value
//    performedBy       — admin ObjectId
//    targetId          — target entity ObjectId
//    startDate         — ISO date string (inclusive)
//    endDate           — ISO date string (inclusive)
//    search            — match on performedByName or targetMeta.username
// ─────────────────────────────────────────────────────────────────────────────

export const getAuditLogs = asyncHandler(async (req, res, next) => {
  const {
    page       = 1,
    limit      = 20,
    category,
    action,
    performedBy,
    targetId,
    startDate,
    endDate,
    search,
  } = req.query;

  const pageNum  = parsePageInt(page, 1);
  const limitNum = parsePageInt(limit, 20, 100);
  const skip     = (pageNum - 1) * limitNum;

  // ── Build filter ──────────────────────────────────────────────────────────
  const filter = {};

  if (category) {
    if (!Object.values(AUDIT_CATEGORIES).includes(category)) {
      return next(new AppError(`Invalid category. Valid: ${Object.values(AUDIT_CATEGORIES).join(", ")}`, 400));
    }
    filter.category = category;
  }

  if (action) {
    if (!Object.values(AUDIT_ACTIONS).includes(action)) {
      return next(new AppError("Invalid action value.", 400));
    }
    filter.action = action;
  }

  if (performedBy) {
    filter.performedBy = performedBy;
  }

  if (targetId) {
    filter.targetId = targetId;
  }

  // Date range — both optional, can use either or both
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start)) return next(new AppError("Invalid startDate.", 400));
      filter.createdAt.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end)) return next(new AppError("Invalid endDate.", 400));
      // Include the whole endDate day
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  // Search — match admin name or target username (case-insensitive)
  if (search?.trim()) {
    const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { performedByName:        regex },
      { "targetMeta.username":  regex },
      { "targetMeta.email":     regex },
    ];
  }

  // ── Run query + count in parallel ─────────────────────────────────────────
  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("performedBy", "username fullName avatar role")
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  logger.info("Admin fetched audit logs", {
    adminId: req.user._id,
    filters: { category, action, performedBy, targetId, startDate, endDate, search },
    count: logs.length,
  });

  res.status(200).json({
    success: true,
    data: {
      logs,
      pagination: {
        page:       pageNum,
        limit:      limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext:    pageNum < Math.ceil(total / limitNum),
        hasPrev:    pageNum > 1,
      },
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/admin/audit-logs/:id
//  Single log detail
// ─────────────────────────────────────────────────────────────────────────────

export const getAuditLogById = asyncHandler(async (req, res, next) => {
  const log = await AuditLog.findById(req.params.id)
    .populate("performedBy", "username fullName avatar role")
    .lean();

  if (!log) return next(new AppError("Audit log not found.", 404));

  res.status(200).json({ success: true, data: log });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/admin/audit-logs/stats
//  Summary counts per category + top actions — used for dashboard widget
// ─────────────────────────────────────────────────────────────────────────────

export const getAuditStats = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const daysNum  = Math.min(Math.max(parseInt(days) || 30, 1), 365);
  const since    = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

  const [categoryBreakdown, actionBreakdown, dailyActivity] = await Promise.all([
    // Count per category
    AuditLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // Top 10 actions
    AuditLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$action", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),

    // Daily activity for the period (for sparkline chart)
    AuditLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      period:    `${daysNum} days`,
      since,
      categoryBreakdown,
      actionBreakdown,
      dailyActivity,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/admin/audit-logs/actions
//  Returns all valid action constants — frontend uses for filter dropdown
// ─────────────────────────────────────────────────────────────────────────────

export const getAuditActionConstants = asyncHandler(async (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      actions:    AUDIT_ACTIONS,
      categories: AUDIT_CATEGORIES,
    },
  });
});