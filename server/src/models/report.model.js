

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PAGE_LIMIT = 50;

// Valid statuses a moderator can set when resolving a report
// FIX #3 — whitelist for status transition validation
const VALID_RESOLVE_STATUSES = new Set([
  "under_review",
  "resolved_action_taken",
  "resolved_no_action",
  "dismissed",
]);

// ─────────────────────────────────────────────────────────────────────────────
//  Report Schema — Polymorphic
//  Supports: Post | Comment | User
//  One report per (reporter + targetId + targetModel) — unique index enforced
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
    // select:false means it's excluded from all queries unless explicitly requested
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
//  FIX #10 — added reviewedBy index for moderator audit queries
// ─────────────────────────────────────────────────────────────────────────────

// Primary constraint — one report per (reporter + target) pair
reportSchema.index({ reportedBy: 1, targetId: 1, targetModel: 1 }, { unique: true });

// Moderation queue — pending reports sorted by creation time
reportSchema.index({ status: 1, createdAt: -1 });

// Reports on a specific target (moderation dashboard)
reportSchema.index({ targetId: 1, targetModel: 1, status: 1 });

// All reports by a user (abuse / mass-reporter tracking)
reportSchema.index({ reportedBy: 1, createdAt: -1 });

// FIX #10 — moderator workload and audit trail queries
reportSchema.index({ reviewedBy: 1, reviewedAt: -1 });

// ─────────────────────────────────────────────────────────────────────────────
//  Pre-validate Hook
//  FIX #6 — prevent self-reporting
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
 * FIX #1 — upsert + duplicate key catch eliminates TOCTOU race condition.
 * FIX #4 — target existence should be validated in controller before calling this.
 *
 * @returns {{ alreadyReported: boolean, report: Document }}
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
    return { alreadyReported: false, report };
  } catch (err) {
    // Duplicate key (11000) = user already reported this target
    if (err.code === 11000) {
      const existing = await this.findOne({ reportedBy, targetId, targetModel });
      return { alreadyReported: true, report: existing };
    }
    throw err;
  }
};

/**
 * Check if a user has already reported a specific target.
 * FIX #2 — uses exists() instead of findOne() — no document transfer overhead.
 *
 * @returns {boolean}
 */
reportSchema.statics.hasReported = async function (reportedBy, targetId, targetModel) {
  return !!(await this.exists({ reportedBy, targetId, targetModel }));
};

/**
 * Get pending reports for moderation queue (cursor-paginated).
 * FIX #7 — cursor pagination replaces skip() for consistent performance.
 * FIX #5 — removed redundant .select("-moderatorNote"); select:false handles it.
 *
 * @param {object} opts — { limit, beforeId, status }
 * @returns {{ items: Report[], hasMore: boolean, nextCursor: ObjectId|null }}
 */
reportSchema.statics.getPendingReports = async function (opts = {}) {
  const limit  = Math.min(parseInt(opts.limit) || 20, MAX_PAGE_LIMIT);
  const status = opts.status || "pending";

  const query = { status };
  if (opts.beforeId) query._id = { $lt: opts.beforeId };

  const results = await this.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("reportedBy", "username fullName avatar");

  const hasMore    = results.length > limit;
  const items      = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore && items.length ? items[items.length - 1]._id : null;

  return { items, hasMore, nextCursor };
};

/**
 * Get all reports against a specific target (cursor-paginated).
 * FIX #8 — added limit + cursor pagination (was unbounded before).
 * FIX #12 — returns total count alongside results in one response.
 *
 * @param {ObjectId} targetId
 * @param {string}   targetModel
 * @param {object}   opts         — { limit, beforeId }
 * @returns {{ items: Report[], total: number, hasMore: boolean, nextCursor: ObjectId|null }}
 */
reportSchema.statics.getReportsForTarget = async function (targetId, targetModel, opts = {}) {
  const limit = Math.min(parseInt(opts.limit) || 20, MAX_PAGE_LIMIT);
  const query = { targetId, targetModel };

  if (opts.beforeId) query._id = { $lt: opts.beforeId };

  // Run paginated fetch and total count in parallel — FIX #12
  const [results, total] = await Promise.all([
    this.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("reportedBy", "username fullName avatar"),
    this.countDocuments({ targetId, targetModel }),
  ]);

  const hasMore    = results.length > limit;
  const items      = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore && items.length ? items[items.length - 1]._id : null;

  return { items, total, hasMore, nextCursor };
};

/**
 * Resolve a single report (moderator action).
 * FIX #3 — status transition validated against whitelist before update.
 *
 * @param {object} opts — { reportId, moderatorId, status, actionTaken, moderatorNote }
 */
reportSchema.statics.resolveReport = function ({
  reportId,
  moderatorId,
  status,
  actionTaken   = "none",
  moderatorNote = "",
}) {
  // FIX #3 — reject invalid or illegal status transitions
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
      reviewedBy: moderatorId,
      reviewedAt: new Date(),
    },
    { new: true },
  );
};

/**
 * Bulk resolve all reports on a target (e.g. after content removal).
 * FIX #11 — accepts optional moderatorNote for audit trail completeness.
 *
 * @param {ObjectId} targetId
 * @param {string}   targetModel
 * @param {ObjectId} moderatorId
 * @param {string}   actionTaken
 * @param {string}   moderatorNote
 */
reportSchema.statics.bulkResolveForTarget = function (
  targetId,
  targetModel,
  moderatorId,
  actionTaken   = "content_removed",
  moderatorNote = "",
) {
  return this.updateMany(
    { targetId, targetModel, status: { $in: ["pending", "under_review"] } },
    {
      status: "resolved_action_taken",
      actionTaken,
      moderatorNote, // FIX #11 — was missing before
      reviewedBy: moderatorId,
      reviewedAt: new Date(),
    },
  );
};

/**
 * Count how many reports a user has submitted in a recent time window.
 * FIX #13 — rate limiting helper for controllers to check before submitReport.
 *
 * Usage in controller:
 *   const recentCount = await Report.getRecentReportCount(userId, 60_000); // last 60s
 *   if (recentCount >= 10) throw new Error("Rate limit exceeded");
 *
 * @param {ObjectId} userId
 * @param {number}   windowMs  — time window in milliseconds (default: 1 minute)
 * @returns {number}
 */
reportSchema.statics.getRecentReportCount = function (userId, windowMs = 60_000) {
  return this.countDocuments({
    reportedBy: userId,
    createdAt:  { $gt: new Date(Date.now() - windowMs) },
  });
};

/**
 * Admin dashboard stats summary.
 * FIX #9 — documented: cache this result in Redis (TTL ~5 min) in production.
 *          Do NOT call on every page load — run as a scheduled job or cache it.
 *
 * @returns {Array<{ _id: string, count: number }>}
 */
reportSchema.statics.getStatsSummary = function () {
  // ⚠️ PRODUCTION NOTE: This aggregation is expensive on large collections.
  // Cache the result in Redis with a 5-minute TTL. Example:
  //   const cached = await redis.get("report:stats");
  //   if (cached) return JSON.parse(cached);
  //   const stats = await Report.getStatsSummary();
  //   await redis.setEx("report:stats", 300, JSON.stringify(stats));
  return this.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort:  { count: -1 } },
  ]);
};

/**
 * Remove all reports submitted by a user (account deletion).
 */
reportSchema.statics.removeAllByReporter = function (userId) {
  return this.deleteMany({ reportedBy: userId });
};

/**
 * Remove all reports targeting a specific content (content deletion).
 */
reportSchema.statics.removeAllByTarget = function (targetId, targetModel) {
  return this.deleteMany({ targetId, targetModel });
};

// ─────────────────────────────────────────────────────────────────────────────
//  Model Export (hot-reload safe)
// ─────────────────────────────────────────────────────────────────────────────

const Report = models.Report || model("Report", reportSchema);
export default Report;