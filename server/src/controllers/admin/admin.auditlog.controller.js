

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import * as AdminAuditLogHelper from "../../utils/adminAuditLogHelpers.js";
import logger from "../../config/logger.js";
import { AUDIT_ACTIONS } from "../../utils/auditLogger.js";

// ─────────────────────────────────────────────────────────────────────────────
//  Valid constants (previously from auditlog.model.js)
//  AUDIT_ACTIONS is re-exported from the canonical source in utils/auditLogger.js
//  so the filter dropdown / validation always matches what's actually written to the DB.
// ─────────────────────────────────────────────────────────────────────────────

export const AUDIT_CATEGORIES = {
  AUTH:     "auth",
  USER:     "user",
  CONTENT:  "content",
  SETTINGS: "settings",
};

export { AUDIT_ACTIONS };

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

const parsePageInt = (val, def, max = Infinity) =>
  Math.min(Math.max(parseInt(val) || def, 1), max);

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/admin/audit-logs
// ─────────────────────────────────────────────────────────────────────────────

export const getAuditLogs = asyncHandler(async (req, res, next) => {
  const {
    page        = 1,
    limit       = 20,
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

  // ── Build Prisma where filter ─────────────────────────────────────────────
  const where = {};

  if (category) {
    if (!Object.values(AUDIT_CATEGORIES).includes(category)) {
      return next(new AppError(`Invalid category. Valid: ${Object.values(AUDIT_CATEGORIES).join(", ")}`, 400));
    }
    where.category = category;
  }

  if (action) {
    if (!Object.values(AUDIT_ACTIONS).includes(action)) {
      return next(new AppError("Invalid action value.", 400));
    }
    where.action = action;
  }

  if (performedBy) where.performedById = performedBy;
  if (targetId)    where.targetId      = targetId;

  // Date range
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start)) return next(new AppError("Invalid startDate.", 400));
      where.createdAt.gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end)) return next(new AppError("Invalid endDate.", 400));
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  // Search — performedByName or targetMeta fields
  if (search?.trim()) {
    const term = search.trim();
    where.or = [
      { performedByName: { like: term, caseInsensitive: true } },
      // targetMeta is Json — search via string cast using raw if needed
      // For now, performedByName search covers most admin use cases
    ];
  }

  // ── Run query + count in parallel ─────────────────────────────────────────
  const [logs, total] = await Promise.all([
    AdminAuditLogHelper.findAuditLogs(where, skip, limitNum),
    AdminAuditLogHelper.countAuditLogs(where),
  ]);

  logger.info("Admin fetched audit logs", {
    adminId: req.user.id,
    filters: { category, action, performedBy, targetId, startDate, endDate, search },
    count:   logs.length,
  });

  return res.status(200).json({
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
// ─────────────────────────────────────────────────────────────────────────────

export const getAuditLogById = asyncHandler(async (req, res, next) => {
  const log = await AdminAuditLogHelper.findAuditLogById(req.params.id);

  if (!log) return next(new AppError("Audit log not found.", 404));

  return res.status(200).json({ success: true, data: log });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/admin/audit-logs/stats
//  Summary counts per category + top actions — dashboard widget
// ─────────────────────────────────────────────────────────────────────────────

export const getAuditStats = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const daysNum = Math.min(Math.max(parseInt(days) || 30, 1), 365);
  const since   = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

  // Category breakdown — neutral { key, count } rows (M-4)
  const categoryRaw = await AdminAuditLogHelper.groupAuditLogsByCategory(since);

  const categoryBreakdown = categoryRaw.map((r) => ({
    _id:   r.key,
    count: r.count,
  }));

  // Top 10 actions
  const actionRaw = await AdminAuditLogHelper.groupAuditLogsByAction(since);

  const actionBreakdown = actionRaw.map((r) => ({
    _id:   r.key,
    count: r.count,
  }));

  // Daily activity — raw SQL for date truncation
  const dailyRaw = await AdminAuditLogHelper.findAuditLogDailyActivity(since);

  const dailyActivity = dailyRaw.map((r) => ({
    _id:   r.date,
    count: r.count,
  }));

  return res.status(200).json({
    success: true,
    data: {
      period: `${daysNum} days`,
      since,
      categoryBreakdown,
      actionBreakdown,
      dailyActivity,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/admin/audit-logs/actions
//  Returns all valid action + category constants for frontend dropdowns
// ─────────────────────────────────────────────────────────────────────────────

export const getAuditActionConstants = asyncHandler(async (_req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      actions:    AUDIT_ACTIONS,
      categories: AUDIT_CATEGORIES,
    },
  });
});