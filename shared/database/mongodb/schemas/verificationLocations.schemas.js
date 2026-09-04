import { Schema } from "mongoose";
import { attachmentSchema, addressFields } from "./subdocuments/index.js";
import { timestampsPlugin, jsonTransformPlugin } from "../plugins/index.js";
import {
  VERIFICATION_SUBJECT_TYPE,
  VERIFICATION_CASE_TYPE,
  VERIFICATION_TIER,
  VERIFICATION_CASE_STATUS,
  VERIFICATION_RISK_LEVEL,
  VERIFICATION_DOCUMENT_TYPE,
  VERIFICATION_DOCUMENT_STATUS,
  LOCATION_OWNER_TYPE,
  LOCATION_SOURCE,
} from "../constants/index.js";
import { applyVerificationLocationsIndexes } from "../indexes/verificationLocations.indexes.js";

// ─────────────────────────────────────────────
//  verificationCases — KYC (individual) / KYB (business). Did not exist in
//  the Postgres schema at all; today "verified" just means an admin
//  flipped User.isVerifiedBadge. This is read constantly for gate checks,
//  so it's kept light — the actual documents live in their own collection.
// ─────────────────────────────────────────────
export const verificationCaseSchema = new Schema(
  {
    subjectType: { type: String, enum: VERIFICATION_SUBJECT_TYPE, required: true },
    // No `refPath` here: subjectType stores the approved lowercase semantic
    // value ("user"/"company"), not a Mongoose model name, so dynamic ref
    // resolution can't key off it directly. Resolving subjectId to the
    // right model is an application-layer concern (a small type→model
    // lookup at query time) — see ../validators/index.js.
    subjectId: { type: Schema.Types.ObjectId, required: true },
    caseType: { type: String, enum: VERIFICATION_CASE_TYPE, required: true },
    tier: { type: String, enum: VERIFICATION_TIER, default: "basic" },
    status: { type: String, enum: VERIFICATION_CASE_STATUS, default: "pending" },
    riskLevel: { type: String, enum: VERIFICATION_RISK_LEVEL, default: "low" },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String },
    expiresAt: { type: Date },
  }
);
verificationCaseSchema.virtual("documents", {
  ref: "VerificationDocument",
  localField: "_id",
  foreignField: "caseId",
});
verificationCaseSchema.plugin(timestampsPlugin);
verificationCaseSchema.plugin(jsonTransformPlugin);
verificationCaseSchema.pre("validate", function caseTypeMatchesSubject() {
  if (this.caseType === "kyb" && this.subjectType !== "company") {
    throw new Error('caseType "kyb" requires subjectType "company"');
  }
  if (this.caseType === "kyc" && this.subjectType !== "user") {
    throw new Error('caseType "kyc" requires subjectType "user"');
  }
});
applyVerificationLocationsIndexes.verificationCase(verificationCaseSchema);

// ─────────────────────────────────────────────
//  verificationDocuments — the sensitive, rarely-read half. Isolated from
//  verificationCases so GDPR-special-category access control/retention can
//  apply here without touching the hot case-status path (Phase 2, §Risk).
// ─────────────────────────────────────────────
export const verificationDocumentSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "VerificationCase", required: true },
    type: { type: String, enum: VERIFICATION_DOCUMENT_TYPE, required: true },
    file: { type: attachmentSchema, required: true },
    status: { type: String, enum: VERIFICATION_DOCUMENT_STATUS, default: "pending" },
    reviewerNote: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    // Retention: no default TTL — the purge window is a legal/product
    // decision (see Phase 2 Risk Assessment), not an engineering default.
    // Once set, a `purgeAt` field + TTL index can be added without a
    // schema-shape change.
  },
  { timestamps: { createdAt: false, updatedAt: false } }
);
verificationDocumentSchema.plugin(jsonTransformPlugin);
applyVerificationLocationsIndexes.verificationDocument(verificationDocumentSchema);

// ─────────────────────────────────────────────
//  locations — a real, structured, 2dsphere-indexable entity replacing the
//  freeform JSON blob + uncached Nominatim calls in the current codebase.
// ─────────────────────────────────────────────
export const locationSchema = new Schema(
  {
    ownerType: { type: String, enum: LOCATION_OWNER_TYPE, required: true },
    // Same reasoning as verificationCases.subjectId above — no `refPath`.
    ownerId: { type: Schema.Types.ObjectId, required: true },
    ...addressFields(),
    source: { type: String, enum: LOCATION_SOURCE, default: "manual" },
    placeId: { type: String }, // geocoder cache key, avoids re-querying
  }
);
locationSchema.plugin(timestampsPlugin);
locationSchema.plugin(jsonTransformPlugin);
applyVerificationLocationsIndexes.location(locationSchema);
