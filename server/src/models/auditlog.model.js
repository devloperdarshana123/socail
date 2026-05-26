import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ACTION CATEGORIES
 * auth     — login, logout, password change, token refresh
 * user     — ban, suspend, unsuspend, delete account, verify badge
 * content  — post delete, report resolve, report dismiss
 * settings — profile update, avatar update, notification settings
 */
export const AUDIT_ACTIONS = {
  // Auth
  ADMIN_LOGIN:             "admin.login",
  ADMIN_LOGOUT:            "admin.logout",
  ADMIN_PASSWORD_CHANGED:  "admin.password_changed",
  ADMIN_SESSION_REVOKED:   "admin.session_revoked",
  ADMIN_ALL_SESSIONS_REVOKED: "admin.all_sessions_revoked",

  // User management
  USER_BANNED:             "user.banned",
  USER_SUSPENDED:          "user.suspended",
  USER_UNSUSPENDED:        "user.unsuspended",
  USER_ACTIVATED:          "user.activated",
  USER_DELETED:            "user.deleted",
  USER_BADGE_GRANTED:      "user.badge_granted",
  USER_BADGE_REVOKED:      "user.badge_revoked",

  // Content moderation
  POST_DELETED:            "post.deleted",
  REPORT_RESOLVED:         "report.resolved",
  REPORT_DISMISSED:        "report.dismissed",
  REPORTS_BULK_UPDATED:    "report.bulk_updated",

  // Settings
  SETTINGS_PROFILE_UPDATED:       "settings.profile_updated",
  SETTINGS_AVATAR_UPDATED:        "settings.avatar_updated",
  SETTINGS_NOTIFICATIONS_UPDATED: "settings.notifications_updated",
};

export const AUDIT_CATEGORIES = {
  AUTH:     "auth",
  USER:     "user",
  CONTENT:  "content",
  SETTINGS: "settings",
};

// Map each action to its category — single source of truth
const ACTION_CATEGORY_MAP = {
  [AUDIT_ACTIONS.ADMIN_LOGIN]:                    AUDIT_CATEGORIES.AUTH,
  [AUDIT_ACTIONS.ADMIN_LOGOUT]:                   AUDIT_CATEGORIES.AUTH,
  [AUDIT_ACTIONS.ADMIN_PASSWORD_CHANGED]:         AUDIT_CATEGORIES.AUTH,
  [AUDIT_ACTIONS.ADMIN_SESSION_REVOKED]:          AUDIT_CATEGORIES.AUTH,
  [AUDIT_ACTIONS.ADMIN_ALL_SESSIONS_REVOKED]:     AUDIT_CATEGORIES.AUTH,

  [AUDIT_ACTIONS.USER_BANNED]:                    AUDIT_CATEGORIES.USER,
  [AUDIT_ACTIONS.USER_SUSPENDED]:                 AUDIT_CATEGORIES.USER,
  [AUDIT_ACTIONS.USER_UNSUSPENDED]:               AUDIT_CATEGORIES.USER,
  [AUDIT_ACTIONS.USER_ACTIVATED]:                 AUDIT_CATEGORIES.USER,
  [AUDIT_ACTIONS.USER_DELETED]:                   AUDIT_CATEGORIES.USER,
  [AUDIT_ACTIONS.USER_BADGE_GRANTED]:             AUDIT_CATEGORIES.USER,
  [AUDIT_ACTIONS.USER_BADGE_REVOKED]:             AUDIT_CATEGORIES.USER,

  [AUDIT_ACTIONS.POST_DELETED]:                   AUDIT_CATEGORIES.CONTENT,
  [AUDIT_ACTIONS.REPORT_RESOLVED]:                AUDIT_CATEGORIES.CONTENT,
  [AUDIT_ACTIONS.REPORT_DISMISSED]:               AUDIT_CATEGORIES.CONTENT,
  [AUDIT_ACTIONS.REPORTS_BULK_UPDATED]:           AUDIT_CATEGORIES.CONTENT,

  [AUDIT_ACTIONS.SETTINGS_PROFILE_UPDATED]:       AUDIT_CATEGORIES.SETTINGS,
  [AUDIT_ACTIONS.SETTINGS_AVATAR_UPDATED]:        AUDIT_CATEGORIES.SETTINGS,
  [AUDIT_ACTIONS.SETTINGS_NOTIFICATIONS_UPDATED]: AUDIT_CATEGORIES.SETTINGS,
};

// ─────────────────────────────────────────────────────────────────────────────
//  Schema
// ─────────────────────────────────────────────────────────────────────────────

const auditLogSchema = new Schema(
  {
    // Who performed the action
    performedBy: {
      type: Schema.Types.ObjectId,
      ref:  "User",
      required: true,
      index: true,
    },

    // Denormalized name — so log is readable even if admin account is deleted later
    performedByName: {
      type:    String,
      default: "Unknown Admin",
    },

    // Action identifier — e.g. "user.banned", "post.deleted"
    action: {
      type:     String,
      enum:     Object.values(AUDIT_ACTIONS),
      required: true,
      index:    true,
    },

    // Derived from action — set automatically in pre-save
    category: {
      type:  String,
      enum:  Object.values(AUDIT_CATEGORIES),
      index: true,
    },

    // Target entity (nullable — auth events have no target)
    targetId: {
      type:    Schema.Types.ObjectId,
      default: null,
      index:   true,
    },

    targetType: {
      type:    String,
      enum:    ["user", "post", "report", null],
      default: null,
    },

    // Denormalized target info — readable even if target is deleted
    targetMeta: {
      type: {
        username: String,
        email:    String,
        postId:   String,
        reason:   String,
        duration: Number,       // suspension days
        status:   String,       // new status after action
      },
      default: {},
      _id:     false,
    },

    // Request context — for security audit
    ipAddress: {
      type:    String,
      default: null,
    },

    userAgent: {
      type:    String,
      default: null,
    },

    // Optional extra detail — free-form, not queried
    note: {
      type:    String,
      default: null,
    },
  },
  {
    timestamps: true,   // createdAt = when action happened
    toJSON:     { virtuals: false },
    toObject:   { virtuals: false },
  },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Pre-save: auto-set category from action
// ─────────────────────────────────────────────────────────────────────────────

auditLogSchema.pre("save", function (next) {
  if (this.action && !this.category) {
    this.category = ACTION_CATEGORY_MAP[this.action] ?? null;
  }
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
//  Indexes — optimised for admin panel queries
//  1. Date desc — default list view
//  2. category + date — filter by category
//  3. performedBy + date — "actions by this admin"
//  4. targetId + date — "all actions on this user/post"
// ─────────────────────────────────────────────────────────────────────────────

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ category: 1, createdAt: -1 });
auditLogSchema.index({ performedBy: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1, createdAt: -1 });

// TTL index — auto-delete logs older than 1 year (production data hygiene)
// Remove this if you need permanent audit trail for compliance
auditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60, name: "audit_ttl" },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Model Export
// ─────────────────────────────────────────────────────────────────────────────

const AuditLog = models.AuditLog || model("AuditLog", auditLogSchema);
export default AuditLog;