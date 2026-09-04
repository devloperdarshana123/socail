// Neutral aggregate envelopes (Phase 7C, M-4).
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────
// M-1 removed Prisma's filter vocabulary and M-3 its write vocabulary. The
// third leak was the RESULT shape. Prisma returns aggregates wrapped in its
// own envelope:
//
//     groupBy   →  [{ status: "pending", _count: { _all: 12 } }]
//     aggregate →  { _sum: { likesCount: 340 } }
//
// MongoDB's `$group` returns `[{ _id: "pending", count: 12 }]`, and a sum
// pipeline returns a plain document. Controllers were reading `_count._all`
// and `_sum.likesCount` directly, so every dashboard and moderation widget
// was coupled to Prisma's envelope — on a provider switch each would have
// read `undefined` and rendered zeros with no error, which is the same
// silent-failure class M-1 and M-3 removed.
//
// The neutral envelopes below are the contract every backend must satisfy:
//
//     groupBy  →  [{ key, count }]           — `key` is the grouped value
//     sum      →  { <field>: number|null }   — no wrapper
//
// `null` is deliberately NOT coalesced to 0: Prisma returns null for a sum
// over zero rows, the callers already own their own `?? 0`, and collapsing
// it here would be a behaviour change.

/** Prisma groupBy rows → neutral `[{ key, count }]`. */
export function fromPrismaGroupBy(rows = [], field, countKey = "_all") {
  return rows.map((row) => ({
    key:   row[field],
    count: row._count?.[countKey] ?? 0,
  }));
}

/** Mongo `$group` rows → the same neutral shape. Not wired yet (M-5). */
export function fromMongoGroupBy(rows = []) {
  return rows.map((row) => ({ key: row._id, count: row.count ?? 0 }));
}

/** Prisma `{ _sum: {...} }` → the bare sums object, nulls preserved. */
export function fromPrismaSum(result) {
  return { ...(result?._sum ?? {}) };
}

/** Mongo sum-pipeline document → the same neutral shape. Not wired yet. */
export function fromMongoSum(doc, fields = []) {
  const out = {};
  for (const f of fields) out[f] = doc?.[f] ?? null;
  return out;
}

// ── Query-side builders (pre-existing, unchanged) ────────────────────────
// A "count grouped by field" shape covers most admin-dashboard-style needs
// without trying to abstract Prisma's `groupBy` and Mongo's aggregation
// pipeline into one fully general DSL.
export function toPrismaGroupByCount(field) {
  return { by: [field], _count: { _all: true } };
}

export function toMongoGroupByCountPipeline(field) {
  return [{ $group: { _id: `$${field}`, count: { $sum: 1 } } }];
}
