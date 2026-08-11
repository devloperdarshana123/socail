// Erovians — shared MongoDB enum constants
//
// Every bounded value set used across the schemas in ../schemas lives here,
// once. Import from here instead of re-typing a literal array of strings in
// a schema file — that duplication is exactly what let the Prisma-era
// server/chat-server schemas drift apart (see the Phase 1 audit).

export const ACCOUNT_STATUS = Object.freeze([
  "pending",
  "active",
  "suspended",
  "deactivated",
  "banned",
]);

export const AUTH_PROVIDER = Object.freeze(["email", "phone", "google"]);

export const OTP_PURPOSE = Object.freeze([
  "email_verify",
  "mobile_verify",
  "forgot_password",
]);

export const COMPANY_VERIFICATION_STATUS = Object.freeze([
  "unverified",
  "pending",
  "verified",
  "rejected",
]);

export const COMPANY_STATUS = Object.freeze(["active", "pending", "suspended"]);

export const COMPANY_MEMBER_STATUS = Object.freeze(["invited", "active", "removed"]);

export const ROLE_SCOPE = Object.freeze(["platform", "company"]);

export const PERMISSION_CATEGORY = Object.freeze(["social", "marketplace", "admin"]);

export const VERIFICATION_SUBJECT_TYPE = Object.freeze(["user", "company"]);
export const VERIFICATION_CASE_TYPE = Object.freeze(["kyc", "kyb"]);
export const VERIFICATION_TIER = Object.freeze(["basic", "enhanced"]);
export const VERIFICATION_CASE_STATUS = Object.freeze([
  "pending",
  "in_review",
  "approved",
  "rejected",
  "expired",
]);
export const VERIFICATION_RISK_LEVEL = Object.freeze(["low", "medium", "high"]);
export const VERIFICATION_DOCUMENT_TYPE = Object.freeze([
  "id_card",
  "business_license",
  "proof_of_address",
  "tax_certificate",
]);
export const VERIFICATION_DOCUMENT_STATUS = Object.freeze([
  "pending",
  "accepted",
  "rejected",
]);

export const LOCATION_OWNER_TYPE = Object.freeze(["user", "company", "post", "listing"]);
export const LOCATION_SOURCE = Object.freeze(["geocoded", "manual"]);

export const POST_VISIBILITY = Object.freeze(["public", "followers", "private"]);
export const COMMENT_STATUS = Object.freeze(["active", "hidden", "removed"]);
export const LIKE_TARGET_TYPE = Object.freeze(["post", "comment", "story"]);
export const FOLLOW_STATUS = Object.freeze(["pending", "accepted"]);
export const STORY_TYPE = Object.freeze(["media", "text"]);
export const STORY_AUDIENCE = Object.freeze(["followers", "close_friends", "public"]);

export const MESSAGE_TYPE = Object.freeze(["text", "image", "voice"]);
export const NOTIFICATION_AUDIENCE = Object.freeze(["user", "admin"]);

export const REPORT_TARGET_TYPE = Object.freeze([
  "post",
  "comment",
  "user",
  "listing",
  "company",
]);
export const REPORT_STATUS = Object.freeze([
  "pending",
  "under_review",
  "resolved_actioned",
  "resolved_dismissed",
]);
export const REPORT_PRIORITY = Object.freeze(["low", "medium", "high"]);

export const AUDIT_CATEGORY = Object.freeze([
  "social",
  "marketplace",
  "identity",
  "verification",
  "admin",
]);

export const MARKETPLACE_LISTING_STATUS = Object.freeze([
  "draft",
  "active",
  "paused",
  "sold_out",
  "archived",
]);
export const PRICE_TYPE = Object.freeze(["fixed", "negotiable", "quote_only"]);
export const QUOTE_STATUS = Object.freeze([
  "requested",
  "quoted",
  "accepted",
  "rejected",
  "expired",
]);
export const ORDER_STATUS = Object.freeze([
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
  "disputed",
]);
export const CONTRACT_STATUS = Object.freeze([
  "draft",
  "pending_signature",
  "active",
  "completed",
  "terminated",
]);
export const PAYMENT_STATUS = Object.freeze(["pending", "completed", "failed", "refunded"]);

export const MEDIA_TYPE = Object.freeze(["image", "video", "audio"]);

export const DEFAULT_CURRENCY = "USD";
