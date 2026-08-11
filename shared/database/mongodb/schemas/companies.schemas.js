import { Schema } from "mongoose";
import { mediaSchema, locationSummarySchema, roleReferenceSchema } from "./subdocuments/index.js";
import {
  timestampsPlugin,
  jsonTransformPlugin,
  auditFieldsPlugin,
  searchNormalizationPlugin,
} from "../plugins/index.js";
import { urlValidator } from "../validators/index.js";
import {
  COMPANY_VERIFICATION_STATUS,
  COMPANY_STATUS,
  COMPANY_MEMBER_STATUS,
  ROLE_SCOPE,
  PERMISSION_CATEGORY,
} from "../constants/index.js";
import { applyCompaniesIndexes } from "../indexes/companies.indexes.js";

// ─────────────────────────────────────────────
//  companies — the business identity Postgres never had; today a "seller"
//  is just a User row with businessCategory set (getMapSellers). This is
//  the real entity that owns marketplace listings.
// ─────────────────────────────────────────────
export const companySchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    legalName: { type: String, trim: true, maxlength: 200 },
    businessCategory: { type: String, required: true },
    description: { type: String, default: "", maxlength: 2000 },
    logo: { type: mediaSchema },
    coverImage: { type: mediaSchema },
    website: { type: String, validate: urlValidator },
    contactEmail: { type: String },
    contactPhone: { type: String },
    locationId: { type: Schema.Types.ObjectId, ref: "Location" },
    locationSummary: { type: locationSummarySchema },
    verificationStatus: { type: String, enum: COMPANY_VERIFICATION_STATUS, default: "unverified" },
    status: { type: String, enum: COMPANY_STATUS, default: "pending" },
  }
);
companySchema.virtual("members", {
  ref: "CompanyMember",
  localField: "_id",
  foreignField: "companyId",
});
companySchema.virtual("listings", {
  ref: "MarketplaceListing",
  localField: "_id",
  foreignField: "companyId",
});
companySchema.plugin(timestampsPlugin);
companySchema.plugin(jsonTransformPlugin);
companySchema.plugin(searchNormalizationPlugin, { sourceField: "name" }); // nameNormalized, keeps display casing intact
applyCompaniesIndexes.company(companySchema);

// ─────────────────────────────────────────────
//  companyMembers — team membership join, since a company account can
//  have more than one user (multi-seat B2B account).
// ─────────────────────────────────────────────
export const companyMemberSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: roleReferenceSchema, default: () => ({}) },
    status: { type: String, enum: COMPANY_MEMBER_STATUS, default: "invited" },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User" },
    joinedAt: { type: Date },
  }
);
companyMemberSchema.plugin(timestampsPlugin);
companyMemberSchema.plugin(jsonTransformPlugin);
applyCompaniesIndexes.companyMember(companyMemberSchema);

// ─────────────────────────────────────────────
//  roles — formalizes what was previously a free-text User.role string
//  compared with `=== "super_admin"` scattered across middleware.
// ─────────────────────────────────────────────
export const roleSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    scope: { type: String, enum: ROLE_SCOPE, required: true },
    label: { type: String, required: true },
    description: { type: String, default: "" },
    permissions: [{ type: String, ref: "Permission" }], // permission keys
    isSystem: { type: Boolean, default: false }, // protects platform roles from deletion
  }
);
roleSchema.plugin(timestampsPlugin);
roleSchema.plugin(jsonTransformPlugin);
roleSchema.plugin(auditFieldsPlugin);
applyCompaniesIndexes.role(roleSchema);

// ─────────────────────────────────────────────
//  permissions — the flat vocabulary roles.permissions[] draws from.
// ─────────────────────────────────────────────
export const permissionSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    category: { type: String, enum: PERMISSION_CATEGORY, required: true },
    description: { type: String, default: "" },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);
permissionSchema.plugin(jsonTransformPlugin);
permissionSchema.plugin(auditFieldsPlugin);
applyCompaniesIndexes.permission(permissionSchema);
