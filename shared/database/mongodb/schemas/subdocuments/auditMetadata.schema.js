import { Schema } from "mongoose";

// {ipAddress, userAgent} — reused by auditLogs and consents, the two
// collections that record this pair identically per the Phase 2 design.
export const auditMetadataFields = () => ({
  ipAddress: { type: String },
  userAgent: { type: String },
});

// Also exported as a standalone Schema for callers that want it nested
// under one key rather than spread flat.
export const auditMetadataSchema = new Schema(auditMetadataFields(), { _id: false });
