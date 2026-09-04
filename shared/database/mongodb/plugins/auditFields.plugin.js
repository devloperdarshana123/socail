import { Schema } from "mongoose";

// Adds createdBy/updatedBy actor references — applied to admin-managed
// reference-data collections (roles, permissions, categories) where
// knowing who last touched a record matters and isn't already captured by
// a more specific field (verificationCases already has its own
// reviewedBy/reviewedAt, for example, so this plugin isn't applied there).
export function auditFieldsPlugin(schema) {
  schema.add({
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  });
}
