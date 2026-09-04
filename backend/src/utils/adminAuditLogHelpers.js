import { auditLogRepository } from "../config/repositories.js";

// Persistence owner for the admin-auditlog domain (Milestone 6C; migrated to
// the repository layer in Phase 7A).
//
// Follows the convention from 6A/6B: one <domain>Helpers.js per admin
// controller, owning that controller's persistence ONLY. The controller
// keeps all orchestration: query-param parsing, `where`-filter assembly,
// category/action validation, date parsing, response shaping, the
// `_id`/`count` result mapping, pagination math, and logging.
//
// Scope note: prisma.auditLog is also written elsewhere —
// admin.comment.controller.js (that controller's own domain, migrated
// separately) and utils/auditLogger.js (write-side middleware). Neither
// owns THIS controller's read/stats persistence, so those are untouched.
//
// ── RAW SQL ──────────────────────────────────────────────────────────────
// The PostgreSQL-specific daily-activity query (TO_CHAR / AT TIME ZONE /
// ::int) has moved one layer down into
// AuditLogRepository.findDailyActivitySince — BYTE-IDENTICAL, md5-verified
// against this file's previous contents. It was not optimized, not
// rewritten, not re-parameterized, and NOT replaced with Prisma groupBy
// (which cannot express date truncation — that is why it is raw). Only
// ownership changed: raw SQL now lives in the persistence layer, where the
// eventual Mongo aggregation-pipeline equivalent will also live. Mongo
// portability is still deliberately NOT attempted — that is a later phase.

// getAuditLogs: filtered, ordered, paginated page of audit logs.
// `where`, `skip` and `take` are assembled by the controller.
export const findAuditLogs = (where, skip, take) => {
  return auditLogRepository.findManyWithRelations(where, {
    skip,
    take,
    include: {
      performedBy: {
        select: { id: true, username: true, fullName: true, avatar: true, role: true },
      },
    },
  });
};

// getAuditLogs: total matching the same `where`, for pagination.
export const countAuditLogs = (where) => {
  return auditLogRepository.count(where);
};

// getAuditLogById: single log with its performing admin.
export const findAuditLogById = (id) => {
  return auditLogRepository.findById(id, {
    include: {
      performedBy: {
        select: { id: true, username: true, fullName: true, avatar: true, role: true },
      },
    },
  });
};

// getAuditStats: category breakdown since a cutoff.
export const groupAuditLogsByCategory = (since) => {
  return auditLogRepository.groupByCategorySince(since);
};

// getAuditStats: top 10 actions since a cutoff.
export const groupAuditLogsByAction = (since) => {
  return auditLogRepository.groupByActionSince(since);
};

// getAuditStats: daily activity time-series. Raw SQL — see the header note.
export const findAuditLogDailyActivity = (since) => {
  return auditLogRepository.findDailyActivitySince(since);
};
