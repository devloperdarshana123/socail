import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError     from "../../utils/AppError.js";
import Report       from "../../models/report.model.js";
import logger       from "../../config/logger.js";
import { notifyAdmin } from "../../utils/adminNotify.js";
// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000;   // 1 minute
const RATE_LIMIT_MAX       = 5;        // max 5 reports per minute per user

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

  // ── Input validation ──────────────────────────────────────────────────────
  if (!targetId || !targetModel || !reason) {
    return next(new AppError("targetId, targetModel and reason are required.", 400));
  }

  if (!VALID_MODELS.has(targetModel)) {
    return next(new AppError(`Invalid targetModel. Allowed: ${[...VALID_MODELS].join(", ")}`, 400));
  }

  if (!VALID_REASONS.has(reason)) {
    return next(new AppError(`Invalid reason.`, 400));
  }

  // ── Self-report guard (User model) ────────────────────────────────────────
  if (targetModel === "User" && targetId === req.user._id.toString()) {
    return next(new AppError("You cannot report yourself.", 400));
  }

  // ── Rate limit — prevent spam reporting ──────────────────────────────────
  const recentCount = await Report.getRecentReportCount(
    req.user._id,
    RATE_LIMIT_WINDOW_MS
  );

  if (recentCount >= RATE_LIMIT_MAX) {
    return next(
      new AppError("Too many reports submitted. Please wait a minute before reporting again.", 429)
    );
  }

  // ── Submit (duplicate-safe via unique index + static method) ─────────────
  const { alreadyReported, report } = await Report.submitReport({
    reportedBy:  req.user._id,
    targetId,
    targetModel,
    reason,
    description: description.toString().trim().slice(0, 500),
  });

  if (alreadyReported) {
    // Not an error — just inform the user gracefully
    return res.status(200).json({
      success:         true,
      alreadyReported: true,
      message:         "You have already reported this. Our team is reviewing it.",
    });
  }

  logger.info("User submitted report", {
    
    reportedBy:  req.user._id.toString(),
    targetId,
    targetModel,
    reason,
    reportId:    report._id.toString(),
  });

  console.log("🔔 notifyAdmin calling...", process.env.CHAT_SERVER_URL, process.env.CHAT_INTERNAL_SECRET);
  notifyAdmin({
  type: "admin_new_report",
  meta: {
    reportId:    report._id.toString(),
    targetId,
    targetModel,
    reason,
    reportedBy:  req.user._id.toString(),
  },
}).catch(() => {});

  return res.status(201).json({
    success:         true,
    alreadyReported: false,
    message:         "Report submitted. Our team will review it within 24 hours.",
    data:            { reportId: report._id },
  });
});