
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import logger from "../../config/logger.js";
import { notifyAdmin } from "../../utils/adminNotify.js";
import * as ReportHelper from "../../utils/reportHelpers.js";
import prisma from "../../config/prisma.js";

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);



const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 reports per minute per user

const VALID_MODELS = new Set(["Post", "Comment", "User"]);

const VALID_REASONS = new Set([
  "spam",
  "nudity_or_sexual_content",
  "hate_speech",
  "violence_or_dangerous",
  "harassment_or_bullying",
  "false_information",
  "intellectual_property",
  "self_harm_or_suicide",
  "scam_or_fraud",
  "illegal_activity",
  "other",
]);

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v2/user/report
//  Submit a report — polymorphic (Post | Comment | User)
// ─────────────────────────────────────────────────────────────────────────────

export const submitReport = asyncHandler(async (req, res, next) => {
  const { targetId, targetModel, reason, description = "" } = req.body;

  // Input validation
  if (!targetId || !targetModel || !reason) {
    return next(new AppError("targetId, targetModel and reason are required.", 400));
  }

  if (!isValidUUID(targetId)) {
    return next(new AppError("Invalid targetId.", 400));
  }

  if (!VALID_MODELS.has(targetModel)) {
    return next(
      new AppError(`Invalid targetModel. Allowed: ${[...VALID_MODELS].join(", ")}`, 400)
    );
  }

  if (!VALID_REASONS.has(reason)) {
    return next(new AppError("Invalid reason.", 400));
  }

  // Self-report guard (User model)
  if (targetModel === "User" && targetId === req.user.id) {
    return next(new AppError("You cannot report yourself.", 400));
  }

  // Rate limit — prevent spam reporting
  const recentCount = await ReportHelper.getRecentReportCount(req.user.id, RATE_LIMIT_WINDOW_MS);

  if (recentCount >= RATE_LIMIT_MAX) {
    return next(
      new AppError(
        "Too many reports submitted. Please wait a minute before reporting again.",
        429
      )
    );
  }

  // Verify target exists
  if (targetModel === "Post") {
    const post = await prisma.post.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!post) {
      return next(new AppError("Post not found.", 404));
    }
  } else if (targetModel === "Comment") {
    const comment = await prisma.comment.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!comment) {
      return next(new AppError("Comment not found.", 404));
    }
  } else if (targetModel === "User") {
    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!user) {
      return next(new AppError("User not found.", 404));
    }
  }

  // Submit report
  try {
    const { alreadyReported, report } = await ReportHelper.submitReport({
      reportedBy: req.user.id,
      targetId,
      targetModel,
      reason,
      description: description.toString().trim(),
    });

    if (alreadyReported) {
      return res.status(200).json({
        success: true,
        alreadyReported: true,
        message: "You have already reported this. Our team is reviewing it.",
      });
    }

    logger.info("User submitted report", {
      reportedBy: req.user.id,
      targetId,
      targetModel,
      reason,
      reportId: report.id,
    });

    // Notify admins
    notifyAdmin({
      type: "admin_new_report",
      meta: {
        reportId: report.id,
        targetId,
        targetModel,
        reason,
        reportedBy: req.user.id,
      },
    }).catch((err) => logger.error("Admin notification failed", { error: err.message }));

    return res.status(201).json({
      success: true,
      alreadyReported: false,
      message: "Report submitted. Our team will review it within 24 hours.",
      data: { reportId: report.id },
    });
  } catch (err) {
    return next(new AppError(err.message, 400));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/admin/reports
//  List all reports (admin only)
//
//  Query params:
//    status  — pending | reviewed | resolved | dismissed
//    limit   — default 20
//    offset  — default 0
// ─────────────────────────────────────────────────────────────────────────────

export const getReports = asyncHandler(async (req, res, next) => {
  const { status } = req.query;
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = Math.max(0, parseInt(req.query.offset) || 0);

  try {
    const { reports, total } = await ReportHelper.getReports({
      status: status || "pending",
      limit,
      offset,
    });

    return res.status(200).json({
      success: true,
      data: reports,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 400));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v2/admin/reports/:reportId
//  Get report details (admin only)
// ─────────────────────────────────────────────────────────────────────────────

export const getReportDetails = asyncHandler(async (req, res, next) => {
  const { reportId } = req.params;

  if (!isValidUUID(reportId)) {
    return next(new AppError("Invalid report ID.", 400));
  }

  try {
    const report = await ReportHelper.getReportDetails(reportId);

    if (!report) {
      return next(new AppError("Report not found.", 404));
    }

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (err) {
    return next(new AppError(err.message, 400));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/admin/reports/:reportId/status
//  Update report status (admin only)
//
//  Body: { status: "pending" | "reviewed" | "resolved" | "dismissed" }
// ─────────────────────────────────────────────────────────────────────────────

export const updateReportStatus = asyncHandler(async (req, res, next) => {
  const { reportId } = req.params;
  const { status } = req.body;

  if (!isValidUUID(reportId)) {
    return next(new AppError("Invalid report ID.", 400));
  }

  if (!status) {
    return next(new AppError("Status is required.", 400));
  }

  try {
    const updated = await ReportHelper.updateReportStatus(reportId, status);

    logger.info("Report status updated", {
      adminId: req.user.id,
      reportId,
      newStatus: status,
    });

    return res.status(200).json({
      success: true,
      message: "Report status updated.",
      data: updated,
    });
  } catch (err) {
    return next(new AppError(err.message, 400));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v2/admin/reports/:reportId/resolve
//  Resolve report + take action on target (admin only)
//
//  Body: { action: null | "warn" | "suspend" | "ban" }
// ─────────────────────────────────────────────────────────────────────────────

export const resolveReport = asyncHandler(async (req, res, next) => {
  const { reportId } = req.params;
  const { action } = req.body;

  if (!isValidUUID(reportId)) {
    return next(new AppError("Invalid report ID.", 400));
  }

  try {
    const updated = await ReportHelper.resolveReport(reportId, action || null);

    logger.info("Report resolved", {
      adminId: req.user.id,
      reportId,
      action: action || "none",
    });

    return res.status(200).json({
      success: true,
      message: `Report resolved${action ? ` with action: ${action}` : ""}.`,
      data: updated,
    });
  } catch (err) {
    return next(new AppError(err.message, 400));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v2/admin/reports/:reportId/dismiss
//  Dismiss report (admin only)
// ─────────────────────────────────────────────────────────────────────────────

export const dismissReport = asyncHandler(async (req, res, next) => {
  const { reportId } = req.params;

  if (!isValidUUID(reportId)) {
    return next(new AppError("Invalid report ID.", 400));
  }

  try {
    const updated = await ReportHelper.dismissReport(reportId);

    logger.info("Report dismissed", {
      adminId: req.user.id,
      reportId,
    });

    return res.status(200).json({
      success: true,
      message: "Report dismissed.",
      data: updated,
    });
  } catch (err) {
    return next(new AppError(err.message, 400));
  }
});