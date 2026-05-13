import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Report Schema — Polymorphic
//
//  Supports:   Post | Comment | User
//  One report per (reporter + target) to prevent spam
// ─────────────────────────────────────────────

const reportSchema = new Schema(
  {
    // ── Reporter ──────────────────────────────
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Reporter is required"],
      index: true,
    },

    // ── Target (polymorphic) ──────────────────
    targetId: {
      type: Schema.Types.ObjectId,
      required: [true, "targetId is required"],
      refPath: "targetModel",
      index: true,
    },

    targetModel: {
      type: String,
      required: [true, "targetModel is required"],
      enum: ["Post", "Comment", "User"],
    },

    // ── Report Reason ─────────────────────────
    reason: {
      type: String,
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

    // ── Additional details from reporter ──────
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },

    // ── Moderation Status ─────────────────────
    status: {
      type: String,
      enum: ["pending", "under_review", "resolved_action_taken", "resolved_no_action", "dismissed"],
      default: "pending",
      index: true,
    },

    // ── Moderator Info ────────────────────────
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",   // admin/moderator user
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    // Internal moderator notes (not visible to reporter)
    moderatorNote: {
      type: String,
      trim: true,
      maxlength: [1000, "Moderator note too long"],
      default: "",
      select: false,
    },

    // Action taken against the target
    actionTaken: {
      type: String,
      enum: [
        "none",
        "content_removed",
        "user_warned",
        "user_suspended",
        "user_banned",
        "other",
      ],
      default: "none",
    },
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────

// Prevent duplicate report by same user on same target
reportSchema.index({ reportedBy: 1, targetId: 1, targetModel: 1 }, { unique: true });

// Moderation queue — pending reports by creation time
reportSchema.index({ status: 1, createdAt: -1 });

// Reports on a specific target (for moderation dashboard)
reportSchema.index({ targetId: 1, targetModel: 1, status: 1 });

// All reports by a user (abuse tracking)
reportSchema.index({ reportedBy: 1, createdAt: -1 });

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * Submit a report (upsert — prevents duplicate)
 * Returns { alreadyReported: boolean, report: Document }
 */
reportSchema.statics.submitReport = async function ({
  reportedBy,
  targetId,
  targetModel,
  reason,
  description = "",
}) {
  const existing = await this.findOne({ reportedBy, targetId, targetModel });
  if (existing) {
    return { alreadyReported: true, report: existing };
  }

  const report = await this.create({
    reportedBy,
    targetId,
    targetModel,
    reason,
    description,
  });

  return { alreadyReported: false, report };
};

/**
 * Get pending reports for moderation queue (paginated)
 */
reportSchema.statics.getPendingReports = function (page = 1, limit = 20) {
  return this.find({ status: "pending" })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("reportedBy", "username fullName avatar")
    .select("-moderatorNote");
};

/**
 * Get all reports against a specific target
 */
reportSchema.statics.getReportsForTarget = function (targetId, targetModel) {
  return this.find({ targetId, targetModel })
    .sort({ createdAt: -1 })
    .populate("reportedBy", "username fullName");
};

/**
 * Get report count for a target (how many times reported)
 */
reportSchema.statics.getReportCount = function (targetId, targetModel) {
  return this.countDocuments({ targetId, targetModel });
};

/**
 * Resolve a report (moderator action)
 */
reportSchema.statics.resolveReport = function ({
  reportId,
  moderatorId,
  status,
  actionTaken = "none",
  moderatorNote = "",
}) {
  return this.findByIdAndUpdate(
    reportId,
    {
      status,
      actionTaken,
      moderatorNote,
      reviewedBy: moderatorId,
      reviewedAt: new Date(),
    },
    { new: true }
  );
};

/**
 * Bulk resolve all reports on a target (e.g., after content removal)
 */
reportSchema.statics.bulkResolveForTarget = function (
  targetId,
  targetModel,
  moderatorId,
  actionTaken = "content_removed"
) {
  return this.updateMany(
    { targetId, targetModel, status: { $in: ["pending", "under_review"] } },
    {
      status: "resolved_action_taken",
      actionTaken,
      reviewedBy: moderatorId,
      reviewedAt: new Date(),
    }
  );
};

/**
 * Check if a user has already reported a target
 */
reportSchema.statics.hasReported = async function (reportedBy, targetId, targetModel) {
  const doc = await this.findOne({ reportedBy, targetId, targetModel });
  return !!doc;
};

/**
 * Get report stats summary (for admin dashboard)
 */
reportSchema.statics.getStatsSummary = function () {
  return this.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

const Report = models.Report || model("Report", reportSchema);
export default Report;