import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toPrismaWhere, toPrismaData, fromPrismaGroupBy, toMongoFilter, toMongoUpdate, toMongoProjection, toMongoSort, fromMongoGroupBy, toMongoDocument } from "../queryHelpers/index.js";

/**
 * M-10: Prisma's `include` tree → mongoose populate paths.
 *
 * Postgres joins by relation NAME (`reportedBy`, `post`); Mongo populates by
 * the FK PATH that holds the ObjectId (`reportedById`, `postId`). This maps
 * the relation names the callers already use onto the Mongo paths, so the
 * helpers' include objects keep working untouched.
 */
// Prisma's relation names are also the Mongo populate paths: each one is an
// alias virtual on reportSchema. This map used to translate them to the raw
// FK field (`post` → `postId`), which put the joined document on the FK's
// name — where nothing looks — and, for the three FKs Milestone 2 had omitted
// entirely, raised StrictPopulateError instead.
const REPORT_POPULATE_PATH = {
  reportedBy:   "reportedBy",
  reportedUser: "reportedUser",
  post:         "post",
  comment:      "comment",
  claimedBy:    "claimedBy",
  escalatedBy:  "escalatedBy",
  reviewedBy:   "reviewedBy",
};
const mongoPopulatePaths = (include) =>
  Object.keys(include ?? {}).map((k) => REPORT_POPULATE_PATH[k]).filter(Boolean);
import { models } from "../../mongodb/index.js";

// Interface — content/user reports with a claim/escalation workflow.
// Postgres: Report model — uses `targetModel`/`targetId` as its generic
// discriminator (renamed `targetType` on Mongo for naming consistency
// across the new schema, per the Milestone 2 migration plan; same
// underlying concept). `search()` not implemented — the moderation queue
// is driven by `findQueue()`'s status/priority filter, not free text.
export class ReportRepository extends BaseRepository {
  async findByReporterAndTarget(reportedById, targetType, targetId, _options) {
    throw new Error(`${this.constructor.name}.findByReporterAndTarget() not implemented`);
  }

  async findQueue(_options) {
    throw new Error(`${this.constructor.name}.findQueue() not implemented`);
  }

  // Phase 7A additions (server's reportHelpers migration). Mongo-backed
  // implementations deferred.
  async findFirstWhere(filter, _options) {
    throw new Error(`${this.constructor.name}.findFirstWhere() not implemented`);
  }

  async findManyWithRelations(filter, _options) {
    throw new Error(`${this.constructor.name}.findManyWithRelations() not implemented`);
  }

  async findManyWhere(filter, _options) {
    throw new Error(`${this.constructor.name}.findManyWhere() not implemented`);
  }

  async updateManyWhere(filter, data, _options) {
    throw new Error(`${this.constructor.name}.updateManyWhere() not implemented`);
  }

  // Phase 7A additions (server's adminReportHelpers migration).
  //
  // The five groupBy methods below are kept INDEPENDENT on purpose — they
  // are not merged, re-ordered or generalised into one parameterised
  // aggregate. Two of them (groupByPriorityOpen / groupByPriorityOpenOrdered)
  // differ only by an orderBy clause and are still separate, because the
  // admin stats endpoint and the list sidebar each own their own query.
  // Mongo-backed implementations deferred — each would become its own
  // $group pipeline.
  async findManyOrdered(filter, _options) {
    throw new Error(`${this.constructor.name}.findManyOrdered() not implemented`);
  }

  async groupByStatus(_options) {
    throw new Error(`${this.constructor.name}.groupByStatus() not implemented`);
  }

  async groupByTopReasons(_options) {
    throw new Error(`${this.constructor.name}.groupByTopReasons() not implemented`);
  }

  async groupByTargetModel(_options) {
    throw new Error(`${this.constructor.name}.groupByTargetModel() not implemented`);
  }

  async groupByPriorityOpenOrdered(_options) {
    throw new Error(`${this.constructor.name}.groupByPriorityOpenOrdered() not implemented`);
  }

  async groupByPriorityOpen(_options) {
    throw new Error(`${this.constructor.name}.groupByPriorityOpen() not implemented`);
  }

  // Phase 7A addition (server's adminUserHelpers migration) — the SIXTH and
  // last groupBy in the application. Kept separate from groupByStatus()
  // above for the same reason as the pair before it: same `by`, different
  // `where`, and the admin user profile owns its own query.
  async groupByStatusForReporter(reportedById, _options) {
    throw new Error(`${this.constructor.name}.groupByStatusForReporter() not implemented`);
  }

  /**
   * Daily report-count trend. PostgreSQL-specific by necessity — Prisma's
   * groupBy cannot truncate a timestamp into a date bucket.
   */
  async findDailyTrendRaw(since, _options) {
    throw new Error(`${this.constructor.name}.findDailyTrendRaw() not implemented`);
  }
}

export class PrismaReportRepository extends ReportRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx, select, include } = {}) {
    const client = tx ?? this.prismaClient;
    return client.report.findUnique({
      where: { id },
      ...(select ? { select } : include ? { include } : {}),
    });
  }

  async findByReporterAndTarget(reportedById, targetType, targetId, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.report.findFirst({ where: { reportedById, targetModel: targetType, targetId } });
  }

  // Single-row lookup on a caller-assembled filter — the duplicate-report
  // guard needs the reporter/target/model triple with no other constraints.
  async findFirstWhere(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.report.findFirst({ where: toPrismaWhere(filter) });
  }

  /**
   * Admin listing with caller-owned filter/paging/relations. `take` and
   * `skip` are RAW — the caller supplies its own limit/offset and reports
   * them back unchanged — so this deliberately does not route through
   * toPrismaPagination(). Distinct from findQueue() above, which owns its
   * own filter shape and ordering.
   */
  async findManyWithRelations(filter, { tx, take, skip, include } = {}) {
    const client = tx ?? this.prismaClient;
    return client.report.findMany({
      where: toPrismaWhere(filter),
      orderBy: { createdAt: "desc" },
      take,
      skip,
      ...(include ? { include } : {}),
    });
  }

  /**
   * Projected read on a caller-assembled filter, with NO default ordering.
   * Distinct from findManyWithRelations above, which orders by createdAt desc
   * and attaches relations — the admin comment-report list projects a narrow
   * shape and relies on the database's natural order.
   * DELIBERATELY UNBOUNDED: the caller applies no limit.
   */
  async findManyWhere(filter, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.report.findMany({
      where: toPrismaWhere(filter),
      ...(select ? { select } : {}),
    });
  }

  /**
   * Read with CALLER-OWNED ordering, paging and relations.
   *
   * Distinct from findManyWithRelations above, which hardcodes
   * `orderBy: { createdAt: "desc" }`. The admin report queue sorts by
   * `priority` first and only then by recency, with the recency direction
   * chosen per-request — neither of which that method can express.
   * `skip`/`take` are RAW; the caller computes its own page window.
   */
  async findManyOrdered(filter, { tx, orderBy, skip, take, include } = {}) {
    const client = tx ?? this.prismaClient;
    return client.report.findMany({
      where: toPrismaWhere(filter),
      orderBy,
      skip,
      take,
      ...(include ? { include } : {}),
    });
  }

  // ── Aggregations (5, deliberately independent — see the interface note) ──

  // Stats + list sidebar: status breakdown across ALL reports. No filter,
  // no ordering.
  async groupByStatus({ tx } = {}) {
    const client = tx ?? this.prismaClient;
    const rows = await client.report.groupBy({
      by:     ["status"],
      _count: { _all: true },
    });
    return fromPrismaGroupBy(rows, "status");
  }

  // Stats: the five most-reported reasons.
  async groupByTopReasons({ tx } = {}) {
    const client = tx ?? this.prismaClient;
    const rows = await client.report.groupBy({
      by:      ["reason"],
      _count:  { _all: true },
      orderBy: { _count: { reason: "desc" } },
      take:    5,
    });
    return fromPrismaGroupBy(rows, "reason");
  }

  // Stats: breakdown by the polymorphic target model.
  async groupByTargetModel({ tx } = {}) {
    const client = tx ?? this.prismaClient;
    const rows = await client.report.groupBy({
      by:     ["targetModel"],
      _count: { _all: true },
    });
    return fromPrismaGroupBy(rows, "targetModel");
  }

  // Stats: priority breakdown of OPEN reports, count-desc.
  async groupByPriorityOpenOrdered({ tx } = {}) {
    const client = tx ?? this.prismaClient;
    const rows = await client.report.groupBy({
      by:      ["priority"],
      where:   { status: { in: ["pending", "under_review"] } },
      _count:  { _all: true },
      orderBy: { _count: { priority: "desc" } },
    });
    return fromPrismaGroupBy(rows, "priority");
  }

  // List sidebar: the same open-priority breakdown WITHOUT ordering.
  // Deliberately not merged with the variant above.
  async groupByPriorityOpen({ tx } = {}) {
    const client = tx ?? this.prismaClient;
    const rows = await client.report.groupBy({
      by:    ["priority"],
      where: { status: { in: ["pending", "under_review"] } },
      _count: { _all: true },
    });
    return fromPrismaGroupBy(rows, "priority");
  }

  // Admin user profile: status breakdown of the reports a single user FILED.
  // Same `by` as groupByStatus(), scoped to one reporter — moved unchanged
  // from adminUserHelpers and kept as its own method rather than adding an
  // optional filter to groupByStatus(), which would change that method's
  // contract for its two existing call-sites.
  async groupByStatusForReporter(reportedById, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const rows = await client.report.groupBy({
      by:    ["status"],
      where: { reportedById },
      _count: { _all: true },
    });
    return fromPrismaGroupBy(rows, "status");
  }

  /**
   * Last-N-days daily report trend.
   *
   * RAW SQL, moved BYTE-IDENTICAL from adminReportHelpers in Phase 7A — not
   * rewritten, not optimized, not re-parameterized, and NOT replaced with
   * groupBy (which cannot bucket by a truncated date; that is why it is raw).
   * Uses $queryRaw's tagged template, so `${since7days}` stays a bound
   * parameter. PostgreSQL-specific: TO_CHAR, AT TIME ZONE, ::int.
   *
   * Note the quoted `"_id"` alias — the controller passes these rows through
   * to the API response untouched, so the column name is part of the
   * contract.
   */
  async findDailyTrendRaw(since7days, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.$queryRaw`
      SELECT
        TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "_id",
        COUNT(*)::int AS count
      FROM "Report"
      WHERE "createdAt" >= ${since7days}
      GROUP BY "_id"
      ORDER BY "_id" ASC
    `;
  }

  /** Bulk field update over a caller-supplied filter. Returns { count }. */
  async updateManyWhere(filter, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.report.updateMany({ where: toPrismaWhere(filter), data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  // Note: `priority` is filterable but deliberately not a sort dimension —
  // it's a string enum ("low"/"medium"/"high"), and sorting it
  // alphabetically would not produce severity order. Ranking priority
  // levels for display is a business-rule decision for a later layer, not
  // implemented here; sort is by recency only.
  async findQueue({ tx, status, priority, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.report.findMany({
      where: { ...(status && { status }), ...(priority && { priority }) },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.report.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  /** `select` and `include` are mutually exclusive, per Prisma. */
  async update(id, data, { tx, select, include } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.report.update({
        where: { id },
        data: toPrismaData(data),
        ...(select ? { select } : include ? { include } : {}),
      });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.report.delete({ where: { id } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.report.findMany({ where: toPrismaWhere(filter), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.report.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.report.count({ where: toPrismaWhere(filter) });
  }
}

export class MongoReportRepository extends ReportRepository {
  async findById(id, { tx } = {}) {
    return models.Report.findById(id).session(tx ?? null);
  }

  async findByReporterAndTarget(reportedById, targetType, targetId, { tx } = {}) {
    return models.Report.findOne({ reportedById, targetType, targetId }).session(tx ?? null);
  }

  // See PrismaReportRepository.findQueue()'s comment — same reasoning.
  async findQueue({ tx, status, priority, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Report
      .find({ ...(status && { status }), ...(priority && { priority }) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Report.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Report.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Report ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Report.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Report ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Report.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Report.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Report.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }

  async findFirstWhere(filter, { tx } = {}) {
    return models.Report.findOne(toMongoFilter(filter)).session(tx ?? null);
  }

  /** M-10: the shared report include → nested populate. */
  async findManyWithRelations(filter, { tx, take, skip, include } = {}) {
    let q = models.Report.find(toMongoFilter(filter)).sort({ createdAt: -1 });
    if (skip !== undefined) q = q.skip(skip);
    if (take !== undefined) q = q.limit(take);
    for (const path of mongoPopulatePaths(include)) q = q.populate(path);
    return q.session(tx ?? null);
  }

  /** No default ordering — natural order, matching the Prisma sibling. */
  async findManyWhere(filter, { tx, select } = {}) {
    let q = models.Report.find(toMongoFilter(filter));
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

  async findManyOrdered(filter, { tx, orderBy, skip, take, include } = {}) {
    let q = models.Report.find(toMongoFilter(filter));
    if (orderBy) q = q.sort(toMongoSort(orderBy));
    if (skip !== undefined) q = q.skip(skip);
    if (take !== undefined) q = q.limit(take);
    for (const path of mongoPopulatePaths(include)) q = q.populate(path);
    return q.session(tx ?? null);
  }

  async updateManyWhere(filter, data, { tx } = {}) {
    try {
      const r = await models.Report.updateMany(toMongoFilter(filter), toMongoUpdate(data), { session: tx });
      return { count: r.matchedCount };
    } catch (err) { throw normalizeMongoError(err); }
  }

  // ── Aggregations (M-4 neutral envelope, M-5 pipelines) ──────────────────
  // Kept as six INDEPENDENT methods for the same reason as the Prisma side:
  // each endpoint owns its own query. Two differ only by an ordering stage.

  async groupByStatus({ tx } = {}) {
    return fromMongoGroupBy(await models.Report.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).session(tx ?? null));
  }

  async groupByTopReasons({ tx } = {}) {
    return fromMongoGroupBy(await models.Report.aggregate([
      { $group: { _id: "$reason", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]).session(tx ?? null));
  }

  async groupByTargetModel({ tx } = {}) {
    // Postgres calls the discriminator `targetModel`; Mongo calls it
    // `targetType` (Milestone 2 renamed it). Same concept either side.
    return fromMongoGroupBy(await models.Report.aggregate([
      { $group: { _id: "$targetType", count: { $sum: 1 } } },
    ]).session(tx ?? null));
  }

  async groupByPriorityOpenOrdered({ tx } = {}) {
    return fromMongoGroupBy(await models.Report.aggregate([
      { $match: { status: { $in: ["pending", "under_review"] } } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).session(tx ?? null));
  }

  async groupByPriorityOpen({ tx } = {}) {
    return fromMongoGroupBy(await models.Report.aggregate([
      { $match: { status: { $in: ["pending", "under_review"] } } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]).session(tx ?? null));
  }

  async groupByStatusForReporter(reportedById, { tx } = {}) {
    return fromMongoGroupBy(await models.Report.aggregate([
      { $match: { reportedById } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).session(tx ?? null));
  }

  /**
   * M-6: last-N-days daily report trend.
   *
   * The Postgres version is raw SQL only because Prisma cannot truncate a
   * timestamp into a date bucket. $dateToString does it natively, so the
   * pipeline replaces the raw query outright. The `_id` / `count` field
   * names and the ASC ordering are preserved because the controller passes
   * these rows straight through to the API response.
   */
  async findDailyTrendRaw(since, { tx } = {}) {
    return models.Report.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
          count: { $sum: 1 },
      } },
      { $sort: { _id: 1 } },
    ]).session(tx ?? null);
  }
}
