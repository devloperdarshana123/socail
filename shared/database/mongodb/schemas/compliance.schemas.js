import { Schema } from "mongoose";
import { auditMetadataFields, metadataValidator } from "./subdocuments/index.js";
import { timestampsPlugin, jsonTransformPlugin, paginationPlugin } from "../plugins/index.js";
import { REPORT_TARGET_TYPE, REPORT_STATUS, REPORT_PRIORITY, AUDIT_CATEGORY } from "../constants/index.js";
import { applyComplianceIndexes } from "../indexes/compliance.indexes.js";

// ─────────────────────────────────────────────
//  reports — widened from Postgres's Report model: targetType now also
//  covers "listing"/"company", so Social and Marketplace share one
//  notice-and-action mechanism (the DSA requirement translated directly
//  into schema — see Phase 2, Group 7).
// ─────────────────────────────────────────────
export const reportSchema = new Schema(
  {
    reportedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: REPORT_TARGET_TYPE, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true }, // no refPath — see ../validators/index.js
    reason: { type: String, required: true },
    description: { type: String, default: "" },
    status: { type: String, enum: REPORT_STATUS, default: "pending" },
    priority: { type: String, enum: REPORT_PRIORITY, default: "low" },
    actionTaken: { type: String, default: "none" },
    escalated: { type: Boolean, default: false },
    escalationReason: { type: String },
    escalatedAt: { type: Date },
    escalatedById: { type: Schema.Types.ObjectId, ref: "User" },
    claimedAt: { type: Date },
    claimExpiresAt: { type: Date },
    claimedById: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    rejectedAt: { type: Date },
    reviewedById: { type: Schema.Types.ObjectId, ref: "User" },

    // ── Explicit target FKs, mirroring the Postgres Report model ─────────
    // Postgres carries BOTH the polymorphic `targetModel`/`targetId` pair
    // AND these three nullable FKs, and the admin moderation UI reads the
    // FKs: adminReportHelpers/reportHelpers request
    // `include: { post, comment, reportedUser }`, which ReportRepository
    // resolves through REPORT_POPULATE_PATH. Milestone 2 kept only the
    // polymorphic pair, so those populates targeted paths that did not
    // exist — mongoose's strictPopulate raises StrictPopulateError — and
    // three Postgres columns had no migration destination.
    postId: { type: Schema.Types.ObjectId, ref: "SocialPost" },
    commentId: { type: Schema.Types.ObjectId, ref: "Comment" },
    reportedUserId: { type: Schema.Types.ObjectId, ref: "User" },
    moderatorNote: { type: String, default: "" },
  }
);
// Relation aliases — see identity.schemas.js. ReportRepository's
// REPORT_POPULATE_PATH now targets these names rather than raw FK fields.
reportSchema.virtual("reportedBy", {
  ref: "User",
  localField: "reportedById",
  foreignField: "_id",
  justOne: true,
});
reportSchema.virtual("reportedUser", {
  ref: "User",
  localField: "reportedUserId",
  foreignField: "_id",
  justOne: true,
});
reportSchema.virtual("post", {
  ref: "SocialPost",
  localField: "postId",
  foreignField: "_id",
  justOne: true,
});
reportSchema.virtual("comment", {
  ref: "Comment",
  localField: "commentId",
  foreignField: "_id",
  justOne: true,
});
reportSchema.virtual("claimedBy", {
  ref: "User",
  localField: "claimedById",
  foreignField: "_id",
  justOne: true,
});
reportSchema.virtual("escalatedBy", {
  ref: "User",
  localField: "escalatedById",
  foreignField: "_id",
  justOne: true,
});
reportSchema.virtual("reviewedBy", {
  ref: "User",
  localField: "reviewedById",
  foreignField: "_id",
  justOne: true,
});
reportSchema.plugin(timestampsPlugin);
reportSchema.plugin(jsonTransformPlugin);
reportSchema.plugin(paginationPlugin);
applyComplianceIndexes.report(reportSchema);

// ─────────────────────────────────────────────
//  suspensionHistory — own collection so cross-user moderator queries stay
//  simple index scans instead of an array-unwind across all users.
// ─────────────────────────────────────────────
export const suspensionHistorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    reason: { type: String },
    duration: { type: Number },
    expiresAt: { type: Date },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);
suspensionHistorySchema.plugin(jsonTransformPlugin);
applyComplianceIndexes.suspensionHistory(suspensionHistorySchema);

// ─────────────────────────────────────────────
//  auditLogs — widened `category` to cover marketplace/identity/
//  verification actions, feeding one shared audit trail instead of a
//  separate one per domain (see Phase 2, Group 7 and §5).
// ─────────────────────────────────────────────
export const auditLogSchema = new Schema(
  {
    performedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
    performedByName: { type: String, default: "Unknown Admin" }, // denormalized snapshot
    action: { type: String, required: true }, // e.g. "user.ban","listing.remove","order.refund"
    category: { type: String, enum: AUDIT_CATEGORY },
    targetId: { type: Schema.Types.ObjectId },
    targetType: { type: String },
    targetMeta: { type: Schema.Types.Mixed, validate: metadataValidator },
    ...auditMetadataFields(),
    note: { type: String },
  }
);
// Relation alias — see identity.schemas.js. The admin audit grid renders
// `log.performedBy` for every row.
auditLogSchema.virtual("performedBy", {
  ref: "User",
  localField: "performedById",
  foreignField: "_id",
  justOne: true,
});
auditLogSchema.plugin(timestampsPlugin);
auditLogSchema.plugin(jsonTransformPlugin);
auditLogSchema.plugin(paginationPlugin);
applyComplianceIndexes.auditLog(auditLogSchema);

// ─────────────────────────────────────────────
//  consents — GDPR/cookie consent, supports anonymous sessions. TTL is
//  partial-filtered so only guest records ever auto-expire.
// ─────────────────────────────────────────────
export const consentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" }, // null = anonymous session
    sessionId: { type: String, required: true },
    essential: { type: Boolean, default: true },
    analytics: { type: Boolean, default: false },
    marketing: { type: Boolean, default: false },
    policyVersion: { type: String, default: "1.0" },
    ...auditMetadataFields(),
    consentGivenAt: { type: Date },
    withdrawnAt: { type: Date },
    guestExpiresAt: { type: Date },
  }
);
consentSchema.plugin(timestampsPlugin);
consentSchema.plugin(jsonTransformPlugin);
applyComplianceIndexes.consent(consentSchema);
