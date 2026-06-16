
// import AuditLog, { AUDIT_ACTIONS } from "../models/auditLog.model.js";
// import logger from "../config/logger.js";

// export { AUDIT_ACTIONS };

// // ── Queue state ───────────────────────────────────────────────────────────────
// const queue        = [];          // pending log entries
// const FLUSH_MS     = 2000;        // flush every 2 seconds
// const MAX_RETRIES  = 3;           // per-item retry limit
// const BATCH_SIZE   = 100;         // max items per insertMany

// let flushTimer     = null;
// let isShuttingDown = false;

// // ── Build a log entry from options ───────────────────────────────────────────
// function buildEntry({
//   req         = null,
//   action,
//   adminId     = null,
//   adminName   = null,
//   targetId    = null,
//   targetType  = null,
//   targetMeta  = {},
//   note        = null,
// }) {
//   const performedBy =
//     req?.user?._id?.toString() ?? adminId?.toString() ?? null;

//   const performedByName =
//     req?.user?.fullName ??
//     req?.user?.username ??
//     adminName ??
//     "Unknown Admin";

//   if (!performedBy || !action) return null;

//   const ipAddress =
//     req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ??
//     req?.socket?.remoteAddress ??
//     null;

//   return {
//     performedBy,
//     performedByName,
//     action,
//     targetId:   targetId  ?? null,
//     targetType: targetType ?? null,
//     targetMeta: targetMeta ?? {},
//     ipAddress,
//     userAgent:  req?.headers?.["user-agent"] ?? null,
//     note,
//     _retries:   0,          // internal — stripped before insert
//   };
// }

// // ── Flush: drain queue → insertMany ──────────────────────────────────────────
// async function flush() {
//   if (queue.length === 0) return;

//   const batch = queue.splice(0, BATCH_SIZE);

//   // Strip internal fields before writing to DB
//   const docs = batch.map(({ _retries, ...doc }) => doc); // eslint-disable-line no-unused-vars

//   try {
//     await AuditLog.insertMany(docs, { ordered: false });
//     // ordered:false — one bad doc won't block the rest
//   } catch (err) {
//     logger.error("auditLogger: insertMany failed", { error: err.message, count: batch.length });

//     // Re-queue items that haven't hit retry limit
//     for (const item of batch) {
//       item._retries += 1;
//       if (item._retries <= MAX_RETRIES) {
//         queue.unshift(item); // front of queue — retry next cycle
//       } else {
//         logger.error("auditLogger: dropping log after max retries", {
//           action: item.action,
//           performedBy: item.performedBy,
//         });
//       }
//     }
//   }
// }

// // ── Timer loop ────────────────────────────────────────────────────────────────
// function startFlushLoop() {
//   if (flushTimer) return; // already running
//   flushTimer = setInterval(async () => {
//     try { await flush(); } catch { /* never propagate */ }
//   }, FLUSH_MS);

//   // Don't keep process alive just for this timer
//   if (flushTimer.unref) flushTimer.unref();
// }

// startFlushLoop();

// // ── Graceful shutdown — flush before exit ────────────────────────────────────
// async function shutdown(signal) {
//   if (isShuttingDown) return;
//   isShuttingDown = true;

//   clearInterval(flushTimer);
//   flushTimer = null;

//   logger.info(`auditLogger: ${signal} received — flushing ${queue.length} pending logs`);

//   // Flush in batches until empty
//   while (queue.length > 0) {
//     await flush().catch(() => {});
//   }
// }

// process.once("SIGTERM", () => shutdown("SIGTERM"));
// process.once("SIGINT",  () => shutdown("SIGINT"));

// // ── Public API ────────────────────────────────────────────────────────────────

// /**
//  * auditLogger — fire-and-forget, zero latency.
//  *
//  * Usage (no await needed):
//  *   auditLogger({
//  *     req,
//  *     action: AUDIT_ACTIONS.USER_BANNED,
//  *     targetId: user._id,
//  *     targetType: "user",
//  *     targetMeta: { username: user.username, reason, status: "banned" },
//  *   });
//  */
// export function auditLogger(opts) {
//   try {
//     const entry = buildEntry(opts);
//     if (!entry) {
//       logger.warn("auditLogger: skipped — missing action or performedBy", {
//         action: opts?.action,
//       });
//       return;
//     }
//     queue.push(entry);
//   } catch (err) {
//     // Never propagate — logging must be invisible to callers
//     logger.error("auditLogger: queue push failed", { error: err.message });
//   }
// }

// export default auditLogger;




// server/src/utils/auditLogger.js

import AuditLog, { AUDIT_ACTIONS } from "../models/auditlog.model.js";
import logger from "../config/logger.js";

export { AUDIT_ACTIONS };

// ─────────────────────────────────────────────────────────────────────────────
//  Category map — mirrors ACTION_CATEGORY_MAP in auditLog.model.js
//  Must stay in sync. insertMany() bypasses pre-save hooks, so we set
//  category here before pushing to queue.
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_CATEGORY_MAP = {
  // Auth
  "admin.login":                "auth",
  "admin.logout":               "auth",
  "admin.password_changed":     "auth",
  "admin.session_revoked":      "auth",
  "admin.all_sessions_revoked": "auth",

  // User management
  "user.banned":       "user",
  "user.suspended":    "user",
  "user.unsuspended":  "user",
  "user.activated":    "user",
  "user.deleted":      "user",
  "user.badge_granted":"user",
  "user.badge_revoked":"user",

  // Content moderation
  "post.deleted":                  "content",
  "report.resolved":               "content",
  "report.dismissed":              "content",
  "report.bulk_updated":           "content",
  "report.claimed":                "content",
  "report.released":               "content",
  "report.escalated":              "content",
  "report.under_review":           "content",
  "report.stale_claims_released":  "content",

  // Settings
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
  const performedBy =
    req?.user?._id?.toString() ?? adminId?.toString() ?? null;

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

  // Set category here — insertMany bypasses pre-save hooks
  const category = ACTION_CATEGORY_MAP[action] ?? null;

  return {
    performedBy,
    performedByName,
    action,
    category,                     // ← set explicitly, not via hook
    targetId:   targetId  ?? null,
    targetType: targetType ?? null,
    targetMeta: targetMeta ?? {},
    ipAddress,
    userAgent:  req?.headers?.["user-agent"] ?? null,
    note,
    _retries:   0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Flush — drain queue → insertMany
// ─────────────────────────────────────────────────────────────────────────────

async function flush() {
  if (queue.length === 0) return;

  const batch = queue.splice(0, BATCH_SIZE);

  // Strip internal _retries field before writing to DB
  const docs = batch.map(({ _retries, ...doc }) => doc);

  try {
    await AuditLog.insertMany(docs, { ordered: false });
    // ordered:false — one bad doc won't block the rest
  } catch (err) {
    logger.error("auditLogger: insertMany failed", {
      error: err.message,
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
//  Graceful shutdown — flush before exit
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
//  Public API — fire-and-forget, zero latency
// ─────────────────────────────────────────────────────────────────────────────

/**
 * auditLogger — push to in-memory queue, batch-inserted every 2s.
 * Never throws. Never awaited by callers.
 *
 * Usage:
 *   auditLogger({ req, action: AUDIT_ACTIONS.USER_BANNED, targetId, targetType, targetMeta });
 */
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