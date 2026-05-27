

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PAGE_LIMIT = 50;

const VALID_RESOLVE_STATUSES = new Set([
  "under_review",
  "resolved_action_taken",
  "resolved_no_action",
  "dismissed",
]);

// Priority score thresholds — computed from reportCount on target
// Stored as denormalized field, updated on each new report + on resolve
export const PRIORITY = {
  LOW:      "low",      // 1 report
  MEDIUM:   "medium",   // 2–4 reports
  HIGH:     "high",     // 5–9 reports
  CRITICAL: "critical", // 10+ reports
};

export function computePriority(reportCount) {
  if (reportCount >= 10) return PRIORITY.CRITICAL;
  if (reportCount >= 5)  return PRIORITY.HIGH;
  if (reportCount >= 2)  return PRIORITY.MEDIUM;
  return PRIORITY.LOW;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Report Schema — Polymorphic (Post | Comment | User)
// ─────────────────────────────────────────────────────────────────────────────

const reportSchema = new Schema(
  {
    // ── Reporter ──────────────────────────────────────────────────────────────

    reportedBy: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "Reporter is required"],
    },

    // ── Target (polymorphic) ──────────────────────────────────────────────────

    targetId: {
      type:     Schema.Types.ObjectId,
      required: [true, "targetId is required"],
      refPath:  "targetModel",
    },

    targetModel: {
      type:     String,
      required: [true, "targetModel is required"],
      enum:     ["Post", "Comment", "User"],
    },

    // ── Report Reason ─────────────────────────────────────────────────────────

    reason: {
      type:     String,
      required: [true, "Report reason is required"],
      enum: [
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
      ],
    },

    // ── Additional Details ────────────────────────────────────────────────────

    description: {
      type:      String,
      trim:      true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default:   "",
    },

    // ── Moderation Status ─────────────────────────────────────────────────────

    status: {
      type:    String,
      enum:    ["pending", "under_review", "resolved_action_taken", "resolved_no_action", "dismissed"],
      default: "pending",
      index:   true,
    },

    // ── Priority — denormalized from sibling report count ─────────────────────
    // Recalculated on every new report for same target + on resolve
    // Stored so the moderation queue can be sorted without a $lookup

    priority: {
      type:    String,
      enum:    ["low", "medium", "high", "critical"],
      default: "low",
      index:   true,
    },

    // ── Claim System — prevents two moderators working same report ────────────

    claimedBy: {
      type:    Schema.Types.ObjectId,
      ref:     "User",
      default: null,
      index:   true,
    },

    claimedAt: {
      type:    Date,
      default: null,
    },

    // Auto-release claim after this many ms of inactivity (set by controller)
    // Stored so a cron/TTL job can release stale claims
    claimExpiresAt: {
      type:    Date,
      default: null,   // TTL-style queries
    },

    // ── Escalation ────────────────────────────────────────────────────────────

    escalated: {
      type:    Boolean,
      default: false,
      index:   true,
    },

    escalatedBy: {
      type:    Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },

    escalatedAt: {
      type:    Date,
      default: null,
    },

    escalationReason: {
      type:      String,
      trim:      true,
      maxlength: [500, "Escalation reason cannot exceed 500 characters"],
      default:   null,
    },

    // ── Moderator Info ────────────────────────────────────────────────────────

    reviewedBy: {
      type:    Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },

    reviewedAt: {
      type:    Date,
      default: null,
    },

    // Internal moderator notes — never visible to reporter
    moderatorNote: {
      type:      String,
      trim:      true,
      maxlength: [1000, "Moderator note too long"],
      default:   "",
      select:    false,
    },

    // Action taken against the target after review
    actionTaken: {
      type:    String,
      enum:    ["none", "content_removed", "user_warned", "user_suspended", "user_banned", "other"],
      default: "none",
    },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────────────────────────────────────

// Primary uniqueness — one report per (reporter + target) pair
reportSchema.index({ reportedBy: 1, targetId: 1, targetModel: 1 }, { unique: true });

// Moderation queue — priority + status + creation time
// This is the PRIMARY index for the queue — sort by priority DESC, then time ASC
reportSchema.index({ status: 1, priority: -1, createdAt: 1 });

// Escalated reports queue
reportSchema.index({ escalated: 1, status: 1, createdAt: 1 });

// Reports on a specific target (history view)
reportSchema.index({ targetId: 1, targetModel: 1, status: 1, createdAt: -1 });

// All reports by a user (mass-reporter tracking)
reportSchema.index({ reportedBy: 1, createdAt: -1 });

// Moderator audit trail
reportSchema.index({ reviewedBy: 1, reviewedAt: -1 });

// Claim expiry queries (for stale claim cleanup)
reportSchema.index({ claimExpiresAt: 1 }, { sparse: true });

// ─────────────────────────────────────────────────────────────────────────────
//  Pre-validate Hook — prevent self-reporting
// ─────────────────────────────────────────────────────────────────────────────

reportSchema.pre("validate", function () {
  if (
    this.targetModel === "User" &&
    this.targetId?.toString() === this.reportedBy?.toString()
  ) {
    throw Object.assign(new Error("Cannot report yourself"), { statusCode: 400 });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Submit a report atomically.
 * After creation, recalculates priority for all reports on same target.
 */
reportSchema.statics.submitReport = async function ({
  reportedBy,
  targetId,
  targetModel,
  reason,
  description = "",
}) {
  try {
    const report = await this.create({
      reportedBy,
      targetId,
      targetModel,
      reason,
      description,
    });

    // Recalculate priority for all reports on this target
    await this._recalcPriority(targetId, targetModel);

    return { alreadyReported: false, report };
  } catch (err) {
    if (err.code === 11000) {
      const existing = await this.findOne({ reportedBy, targetId, targetModel });
      return { alreadyReported: true, report: existing };
    }
    throw err;
  }
};

/**
 * Recalculate and update priority for all pending/under_review reports on a target.
 * Called after new report submitted or after bulk resolve.
 * @private
 */
reportSchema.statics._recalcPriority = async function (targetId, targetModel) {
  const count = await this.countDocuments({
    targetId,
    targetModel,
    status: { $in: ["pending", "under_review"] },
  });

  const priority = computePriority(count);

  await this.updateMany(
    { targetId, targetModel, status: { $in: ["pending", "under_review"] } },
    { $set: { priority } },
  );

  return priority;
};

/**
 * Claim a report for review — prevents two moderators working same report.
 * Claim expires after `ttlMinutes` of inactivity.
 *
 * Returns:
 *   { claimed: true, report }   — successfully claimed
 *   { claimed: false, report }  — already claimed by another moderator
 */
reportSchema.statics.claimReport = async function (reportId, moderatorId, ttlMinutes = 30) {
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  // Atomic: only claim if unclaimed OR claim has expired
  const report = await this.findOneAndUpdate(
    {
      _id: reportId,
      $or: [
        { claimedBy: null },
        { claimedBy: moderatorId },         // re-claim own report — refreshes TTL
        { claimExpiresAt: { $lte: now } },  // stale claim — take over
      ],
    },
    {
      claimedBy:      moderatorId,
      claimedAt:      now,
      claimExpiresAt: expiresAt,
    },
    { new: true },
  ).populate("claimedBy", "username fullName avatar");

  if (!report) {
    // Fetch the report to return the current claimer info
    const locked = await this.findById(reportId)
      .populate("claimedBy", "username fullName avatar")
      .lean();
    return { claimed: false, report: locked };
  }

  return { claimed: true, report };
};

/**
 * Release a claimed report (moderator done / stepping away).
 * Only the current claimer or a super_admin can release.
 */
reportSchema.statics.releaseReport = async function (reportId, moderatorId, role = "moderator") {
  const filter = role === "super_admin"
    ? { _id: reportId }
    : { _id: reportId, claimedBy: moderatorId };

  const report = await this.findOneAndUpdate(
    filter,
    { claimedBy: null, claimedAt: null, claimExpiresAt: null },
    { new: true },
  );

  return report;
};

/**
 * Release all stale claims (claimExpiresAt <= now).
 * Called by a cron job / scheduled task — not on every request.
 */
reportSchema.statics.releaseStaleClams = function () {
  return this.updateMany(
    { claimedBy: { $ne: null }, claimExpiresAt: { $lte: new Date() } },
    { $set: { claimedBy: null, claimedAt: null, claimExpiresAt: null } },
  );
};

/**
 * Escalate a report for senior admin review.
 */
reportSchema.statics.escalateReport = async function ({
  reportId,
  moderatorId,
  reason = "",
}) {
  const report = await this.findByIdAndUpdate(
    reportId,
    {
      escalated:        true,
      escalatedBy:      moderatorId,
      escalatedAt:      new Date(),
      escalationReason: reason,
      // Move to under_review if still pending
      $set: { status: "under_review" },
    },
    { new: true },
  )
    .populate("escalatedBy", "username fullName avatar")
    .populate("reportedBy",  "username fullName avatar");

  return report;
};

/**
 * Get the full report history for a target (all statuses, paginated).
 * Used in the "History" tab of the detail panel.
 */
reportSchema.statics.getReportHistory = async function (targetId, targetModel, opts = {}) {
  const limit = Math.min(parseInt(opts.limit) || 20, MAX_PAGE_LIMIT);
  const query = { targetId, targetModel };

  if (opts.beforeId) query._id = { $lt: opts.beforeId };

  const [results, total, openCount] = await Promise.all([
    this.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("reportedBy", "username fullName avatar")
      .populate("reviewedBy", "username fullName avatar")
      .lean(),
    this.countDocuments({ targetId, targetModel }),
    this.countDocuments({ targetId, targetModel, status: { $in: ["pending", "under_review"] } }),
  ]);

  const hasMore    = results.length > limit;
  const items      = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore && items.length ? items[items.length - 1]._id : null;

  return { items, total, openCount, hasMore, nextCursor };
};

/**
 * Get pending reports for moderation queue — sorted by priority then age.
 */
reportSchema.statics.getModerationQueue = async function (opts = {}) {
  const limit  = Math.min(parseInt(opts.limit) || 20, MAX_PAGE_LIMIT);
  const status = opts.status || "pending";

  const query = { status };

  if (opts.escalatedOnly)        query.escalated   = true;
  if (opts.priority)             query.priority    = opts.priority;
  if (opts.targetModel)          query.targetModel = opts.targetModel;
  if (opts.unclaimedOnly)        query.claimedBy   = null;
  if (opts.claimedByMe)          query.claimedBy   = opts.moderatorId;
  if (opts.beforeId)             query._id         = { $lt: opts.beforeId };

  const results = await this.find(query)
    // Priority sort: critical → high → medium → low, then oldest first (FIFO)
    .sort({ priority: -1, createdAt: 1, _id: 1 })
    .limit(limit + 1)
    .populate("reportedBy", "username fullName avatar")
    .populate("claimedBy",  "username fullName avatar")
    .lean();

  const hasMore    = results.length > limit;
  const items      = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore && items.length ? items[items.length - 1]._id : null;

  return { items, hasMore, nextCursor };
};

/**
 * Check if a user has already reported a specific target.
 */
reportSchema.statics.hasReported = async function (reportedBy, targetId, targetModel) {
  return !!(await this.exists({ reportedBy, targetId, targetModel }));
};

/**
 * Resolve a single report — validates status transition.
 */
reportSchema.statics.resolveReport = function ({
  reportId,
  moderatorId,
  status,
  actionTaken   = "none",
  moderatorNote = "",
}) {
  if (!VALID_RESOLVE_STATUSES.has(status)) {
    throw Object.assign(
      new Error(`Invalid resolve status: "${status}". Allowed: ${[...VALID_RESOLVE_STATUSES].join(", ")}`),
      { statusCode: 400 },
    );
  }

  return this.findByIdAndUpdate(
    reportId,
    {
      status,
      actionTaken,
      moderatorNote,
      reviewedBy:     moderatorId,
      reviewedAt:     new Date(),
      // Release claim on resolve
      claimedBy:      null,
      claimedAt:      null,
      claimExpiresAt: null,
    },
    { new: true },
  );
};

/**
 * Bulk resolve all reports on a target (e.g. after content removal).
 */
reportSchema.statics.bulkResolveForTarget = async function (
  targetId,
  targetModel,
  moderatorId,
  actionTaken   = "content_removed",
  moderatorNote = "",
) {
  const result = await this.updateMany(
    { targetId, targetModel, status: { $in: ["pending", "under_review"] } },
    {
      status:         "resolved_action_taken",
      actionTaken,
      moderatorNote,
      reviewedBy:     moderatorId,
      reviewedAt:     new Date(),
      claimedBy:      null,
      claimedAt:      null,
      claimExpiresAt: null,
    },
  );

  return result;
};

/**
 * Count how many reports a user has submitted in a recent time window.
 * Used for rate limiting in controllers.
 */
reportSchema.statics.getRecentReportCount = function (userId, windowMs = 60_000) {
  return this.countDocuments({
    reportedBy: userId,
    createdAt:  { $gt: new Date(Date.now() - windowMs) },
  });
};

/**
 * Admin dashboard stats summary.
 * NOTE: Cache this in Redis (TTL ~5 min) — expensive on large collections.
 */
reportSchema.statics.getStatsSummary = function () {
  return this.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort:  { count: -1 } },
  ]);
};

/**
 * Priority breakdown stats for dashboard.
 */
reportSchema.statics.getPriorityStats = function () {
  return this.aggregate([
    { $match: { status: { $in: ["pending", "under_review"] } } },
    { $group: { _id: "$priority", count: { $sum: 1 } } },
    { $sort:  { count: -1 } },
  ]);
};

reportSchema.statics.removeAllByReporter = function (userId) {
  return this.deleteMany({ reportedBy: userId });
};

reportSchema.statics.removeAllByTarget = function (targetId, targetModel) {
  return this.deleteMany({ targetId, targetModel });
};

// ─────────────────────────────────────────────────────────────────────────────
//  Model Export (hot-reload safe)
// ─────────────────────────────────────────────────────────────────────────────

const Report = models.Report || model("Report", reportSchema);
export default Report;
export { VALID_RESOLVE_STATUSES };