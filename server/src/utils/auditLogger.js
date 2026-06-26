
// server/src/utils/auditLogger.js

import prisma from "../config/prisma.js";
import logger from "../config/logger.js";

// ─────────────────────────────────────────────────────────────────────────────
//  AUDIT_ACTIONS — central constants
// ─────────────────────────────────────────────────────────────────────────────

export const AUDIT_ACTIONS = {
  // Auth
  ADMIN_LOGIN:                "admin.login",
  ADMIN_LOGOUT:               "admin.logout",
  ADMIN_PASSWORD_CHANGED:     "admin.password_changed",
  ADMIN_SESSION_REVOKED:      "admin.session_revoked",
  ADMIN_ALL_SESSIONS_REVOKED: "admin.all_sessions_revoked",

  // User management
  USER_BANNED:        "user.banned",
  USER_SUSPENDED:     "user.suspended",
  USER_UNSUSPENDED:   "user.unsuspended",
  USER_ACTIVATED:     "user.activated",
  USER_DELETED:       "user.deleted",
  USER_BADGE_GRANTED: "user.badge_granted",
  USER_BADGE_REVOKED: "user.badge_revoked",

  // Content moderation
  POST_DELETED:                 "post.deleted",
  REPORT_RESOLVED:              "report.resolved",
  REPORT_DISMISSED:             "report.dismissed",
  REPORT_BULK_UPDATED:          "report.bulk_updated",
  REPORT_CLAIMED:               "report.claimed",
  REPORT_RELEASED:              "report.released",
  REPORT_ESCALATED:             "report.escalated",
  REPORT_UNDER_REVIEW:          "report.under_review",
  REPORT_STALE_CLAIMS_RELEASED: "report.stale_claims_released",

  // Settings
  SETTINGS_PROFILE_UPDATED:       "settings.profile_updated",
  SETTINGS_AVATAR_UPDATED:        "settings.avatar_updated",
  SETTINGS_NOTIFICATIONS_UPDATED: "settings.notifications_updated",
};

// ─────────────────────────────────────────────────────────────────────────────
//  Category map
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_CATEGORY_MAP = {
  "admin.login":                "auth",
  "admin.logout":               "auth",
  "admin.password_changed":     "auth",
  "admin.session_revoked":      "auth",
  "admin.all_sessions_revoked": "auth",

  "user.banned":        "user",
  "user.suspended":     "user",
  "user.unsuspended":   "user",
  "user.activated":     "user",
  "user.deleted":       "user",
  "user.badge_granted": "user",
  "user.badge_revoked": "user",

  "post.deleted":                  "content",
  "report.resolved":               "content",
  "report.dismissed":              "content",
  "report.bulk_updated":           "content",
  "report.claimed":                "content",
  "report.released":               "content",
  "report.escalated":              "content",
  "report.under_review":           "content",
  "report.stale_claims_released":  "content",

  "settings.profile_updated":       "settings",
  "settings.avatar_updated":        "settings",
  "settings.notifications_updated": "settings",
};

// ─────────────────────────────────────────────────────────────────────────────
//  Queue state
// ─────────────────────────────────────────────────────────────────────────────

const queue        = [];
const FLUSH_MS     = 2000;
const MAX_RETRIES  = 3;
const BATCH_SIZE   = 100;

let flushTimer     = null;
let isShuttingDown = false;

// ─────────────────────────────────────────────────────────────────────────────
//  Build a log entry from options
// ─────────────────────────────────────────────────────────────────────────────

function buildEntry({
  req         = null,
  action,
  adminId     = null,
  adminName   = null,
  targetId    = null,
  targetType  = null,
  targetMeta  = {},
  note        = null,
}) {
  // Prisma: user.id (not user._id)
  const performedBy =
    req?.user?.id ?? adminId?.toString() ?? null;

  const performedByName =
    req?.user?.fullName ??
    req?.user?.username ??
    adminName ??
    "Unknown Admin";

  if (!performedBy || !action) return null;

  const ipAddress =
    req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ??
    req?.socket?.remoteAddress ??
    null;

  const category = ACTION_CATEGORY_MAP[action] ?? null;

  return {
     performedById: performedBy,
    performedByName,
    action,
    category,
    targetId:   targetId   ?? null,
    targetType: targetType ?? null,
    targetMeta: targetMeta ?? {},
    ipAddress,
    userAgent:  req?.headers?.["user-agent"] ?? null,
    note,
    _retries:   0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Flush — drain queue → Prisma createMany
// ─────────────────────────────────────────────────────────────────────────────

async function flush() {
  if (queue.length === 0) return;

  const batch = queue.splice(0, BATCH_SIZE);

  // Strip internal _retries field before writing to DB
  const data = batch.map(({ _retries, ...doc }) => doc);

  try {
    await prisma.auditLog.createMany({ data, skipDuplicates: true });
  } catch (err) {
    logger.error("auditLogger: createMany failed", {
      error: err.message,
      stack: err.stack,
      code: err.code,
      meta: err.meta,
      count: batch.length,
    });

    // Re-queue items under retry limit
    for (const item of batch) {
      item._retries += 1;
      if (item._retries <= MAX_RETRIES) {
        queue.unshift(item);
      } else {
        logger.error("auditLogger: dropping log after max retries", {
          action:      item.action,
          performedBy: item.performedBy,
        });
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Timer loop
// ─────────────────────────────────────────────────────────────────────────────

function startFlushLoop() {
  if (flushTimer) return;
  flushTimer = setInterval(async () => {
    try { await flush(); } catch { /* never propagate */ }
  }, FLUSH_MS);

  if (flushTimer.unref) flushTimer.unref();
}

startFlushLoop();

// ─────────────────────────────────────────────────────────────────────────────
//  Graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  clearInterval(flushTimer);
  flushTimer = null;

  logger.info(`auditLogger: ${signal} received — flushing ${queue.length} pending logs`);

  while (queue.length > 0) {
    await flush().catch(() => {});
  }
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT",  () => shutdown("SIGINT"));

// ─────────────────────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────────────────────

export function auditLogger(opts) {
  try {
    const entry = buildEntry(opts);
    if (!entry) {
      logger.warn("auditLogger: skipped — missing action or performedBy", {
        action: opts?.action,
      });
      return;
    }
    queue.push(entry);
  } catch (err) {
    logger.error("auditLogger: queue push failed", { error: err.message });
  }
}

export default auditLogger;