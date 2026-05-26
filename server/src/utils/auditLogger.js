// server/src/utils/auditLogger.js
// ─────────────────────────────────────────────────────────────────────────────
//  Production Audit Logger — In-memory queue with batch flush
//
//  Architecture:
//  1. auditLogger() pushes to an in-memory queue — ZERO DB latency on API call
//  2. A flush loop drains the queue every 2s using insertMany (bulk write)
//  3. If flush fails, items are re-queued (max 3 retries) then dropped+logged
//  4. On process SIGTERM/SIGINT — flush remaining queue before exit
//
//  This means:
//  - API response time: 0ms overhead (no await, no DB call)
//  - DB load: 1 insertMany per 2s instead of N individual inserts
//  - Reliability: retries on transient DB errors
//  - No data loss on graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────

import AuditLog, { AUDIT_ACTIONS } from "../models/auditLog.model.js";
import logger from "../config/logger.js";

export { AUDIT_ACTIONS };

// ── Queue state ───────────────────────────────────────────────────────────────
const queue        = [];          // pending log entries
const FLUSH_MS     = 2000;        // flush every 2 seconds
const MAX_RETRIES  = 3;           // per-item retry limit
const BATCH_SIZE   = 100;         // max items per insertMany

let flushTimer     = null;
let isShuttingDown = false;

// ── Build a log entry from options ───────────────────────────────────────────
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

  return {
    performedBy,
    performedByName,
    action,
    targetId:   targetId  ?? null,
    targetType: targetType ?? null,
    targetMeta: targetMeta ?? {},
    ipAddress,
    userAgent:  req?.headers?.["user-agent"] ?? null,
    note,
    _retries:   0,          // internal — stripped before insert
  };
}

// ── Flush: drain queue → insertMany ──────────────────────────────────────────
async function flush() {
  if (queue.length === 0) return;

  const batch = queue.splice(0, BATCH_SIZE);

  // Strip internal fields before writing to DB
  const docs = batch.map(({ _retries, ...doc }) => doc); // eslint-disable-line no-unused-vars

  try {
    await AuditLog.insertMany(docs, { ordered: false });
    // ordered:false — one bad doc won't block the rest
  } catch (err) {
    logger.error("auditLogger: insertMany failed", { error: err.message, count: batch.length });

    // Re-queue items that haven't hit retry limit
    for (const item of batch) {
      item._retries += 1;
      if (item._retries <= MAX_RETRIES) {
        queue.unshift(item); // front of queue — retry next cycle
      } else {
        logger.error("auditLogger: dropping log after max retries", {
          action: item.action,
          performedBy: item.performedBy,
        });
      }
    }
  }
}

// ── Timer loop ────────────────────────────────────────────────────────────────
function startFlushLoop() {
  if (flushTimer) return; // already running
  flushTimer = setInterval(async () => {
    try { await flush(); } catch { /* never propagate */ }
  }, FLUSH_MS);

  // Don't keep process alive just for this timer
  if (flushTimer.unref) flushTimer.unref();
}

startFlushLoop();

// ── Graceful shutdown — flush before exit ────────────────────────────────────
async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  clearInterval(flushTimer);
  flushTimer = null;

  logger.info(`auditLogger: ${signal} received — flushing ${queue.length} pending logs`);

  // Flush in batches until empty
  while (queue.length > 0) {
    await flush().catch(() => {});
  }
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT",  () => shutdown("SIGINT"));

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * auditLogger — fire-and-forget, zero latency.
 *
 * Usage (no await needed):
 *   auditLogger({
 *     req,
 *     action: AUDIT_ACTIONS.USER_BANNED,
 *     targetId: user._id,
 *     targetType: "user",
 *     targetMeta: { username: user.username, reason, status: "banned" },
 *   });
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
    // Never propagate — logging must be invisible to callers
    logger.error("auditLogger: queue push failed", { error: err.message });
  }
}

export default auditLogger;