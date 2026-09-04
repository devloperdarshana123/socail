import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toPrismaGroupByCount, toMongoGroupByCountPipeline, toPrismaWhere, toPrismaData, fromPrismaGroupBy, toMongoFilter, fromMongoGroupBy, toMongoUpdate, toMongoDocument } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — admin action audit trail. Postgres: AuditLog model. Mongo:
// `auditLogs`. Append-only in practice — `update()`/`delete()` are
// implemented for interface completeness but audit records are not
// expected to be mutated once written; that expectation is a
// service-layer concern, not enforced here. `countByCategory()`
// demonstrates the aggregation query helper.
export class AuditLogRepository extends BaseRepository {
  async findByPerformedById(performedById, _options) {
    throw new Error(`${this.constructor.name}.findByPerformedById() not implemented`);
  }

  async countByCategory(_options) {
    throw new Error(`${this.constructor.name}.countByCategory() not implemented`);
  }

  // Phase 7A additions (server's adminAuditLogHelpers migration).
  //
  // NOTE on countByCategory above: it groups over the WHOLE table with no
  // cutoff and no ordering (toPrismaGroupByCount). The stats endpoint needs
  // a `since` filter AND a count-desc ordering, so it cannot reuse it.
  // Mongo-backed implementations deferred.
  async findManyWithRelations(filter, _options) {
    throw new Error(`${this.constructor.name}.findManyWithRelations() not implemented`);
  }

  async groupByCategorySince(since, _options) {
    throw new Error(`${this.constructor.name}.groupByCategorySince() not implemented`);
  }

  async groupByActionSince(since, _options) {
    throw new Error(`${this.constructor.name}.groupByActionSince() not implemented`);
  }

  /**
   * Daily-activity time-series. PostgreSQL-specific by necessity — Prisma's
   * groupBy cannot express date truncation. See the Prisma implementation.
   */
  async findDailyActivitySince(since, _options) {
    throw new Error(`${this.constructor.name}.findDailyActivitySince() not implemented`);
  }

  // Phase 7E addition (M-7 cleanup) — the audit buffer flushes a batch of
  // rows in one round-trip and tolerates duplicates, which single create()
  // cannot express.
  async createMany(rows, _options) {
    throw new Error(`${this.constructor.name}.createMany() not implemented`);
  }
}

export class PrismaAuditLogRepository extends AuditLogRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx, select, include } = {}) {
    const client = tx ?? this.prismaClient;
    return client.auditLog.findUnique({
      where: { id },
      ...(select ? { select } : include ? { include } : {}),
    });
  }

  /**
   * Filtered, ordered, paginated read with caller-owned relations. `skip`
   * and `take` are RAW — the controller computes its own page window — so
   * this deliberately does not route through toPrismaPagination().
   */
  async findManyWithRelations(filter, { tx, skip, take, include } = {}) {
    const client = tx ?? this.prismaClient;
    return client.auditLog.findMany({
      where: toPrismaWhere(filter),
      orderBy: { createdAt: "desc" },
      skip,
      take,
      ...(include ? { include } : {}),
    });
  }

  // Category breakdown since a cutoff, most-frequent first.
  async groupByCategorySince(since, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const rows = await client.auditLog.groupBy({
      by:      ["category"],
      where:   { createdAt: { gte: since } },
      _count:  { _all: true },
      orderBy: { _count: { category: "desc" } },
    });
    return fromPrismaGroupBy(rows, "category");
  }

  // Top 10 actions since a cutoff.
  async groupByActionSince(since, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const rows = await client.auditLog.groupBy({
      by:      ["action"],
      where:   { createdAt: { gte: since } },
      _count:  { _all: true },
      orderBy: { _count: { action: "desc" } },
      take:    10,
    });
    return fromPrismaGroupBy(rows, "action");
  }

  /**
   * Daily activity time-series.
   *
   * RAW SQL, moved BYTE-IDENTICAL from adminAuditLogHelpers (Milestone 6C,
   * re-homed here in Phase 7A): not optimized, not rewritten, not
   * re-parameterized, and NOT replaced with Prisma groupBy — Prisma cannot
   * express date truncation, which is why this is raw in the first place.
   *
   * PostgreSQL-specific by design (TO_CHAR / AT TIME ZONE / ::int). It uses
   * $queryRaw's tagged template, so `${since}` stays a bound parameter
   * rather than string interpolation. Mongo portability is deliberately not
   * attempted here — that is a later phase.
   */
  async findDailyActivitySince(since, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.$queryRaw`
    SELECT
      TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
      COUNT(*)::int AS count
    FROM "AuditLog"
    WHERE "createdAt" >= ${since}
    GROUP BY date
    ORDER BY date ASC
  `;
  }

  async findByPerformedById(performedById, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.auditLog.findMany({ where: { performedById }, orderBy: { createdAt: "desc" }, skip, take });
  }

  async countByCategory({ tx } = {}) {
    const client = tx ?? this.prismaClient;
    const rows = await client.auditLog.groupBy(toPrismaGroupByCount("category"));
    return fromPrismaGroupBy(rows, "category");
  }

  /**
   * Batch insert, duplicate-tolerant. `skipDuplicates` is what lets the
   * audit buffer retry a flush without exploding on rows that already
   * landed. Returns Prisma's { count }.
   */
  async createMany(rows, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.auditLog.createMany({
        data: rows.map((r) => toPrismaData(r)),
        skipDuplicates: true,
      });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.auditLog.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.auditLog.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.auditLog.delete({ where: { id } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.auditLog.findMany({ where: toPrismaWhere(filter), orderBy: { createdAt: "desc" }, skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.auditLog.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.auditLog.count({ where: toPrismaWhere(filter) });
  }
}

export class MongoAuditLogRepository extends AuditLogRepository {
  async findById(id, { tx, include } = {}) {
    // The single-log view asks for its admin the same way the list does.
    let q = models.AuditLog.findById(id);
    if (include?.performedBy) q = q.populate("performedBy");
    return q.session(tx ?? null);
  }

  async findByPerformedById(performedById, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.AuditLog
      .find({ performedById })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .session(tx ?? null);
  }

  async countByCategory({ tx } = {}) {
    // M-4: same neutral { key, count } envelope its Prisma sibling returns.
    return fromMongoGroupBy(
      await models.AuditLog.aggregate(toMongoGroupByCountPipeline("category")).session(tx ?? null)
    );
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.AuditLog.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.AuditLog.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`AuditLog ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.AuditLog.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`AuditLog ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.AuditLog.find(toMongoFilter(filter)).sort({ createdAt: -1 }).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.AuditLog.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.AuditLog.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }

  /** M-10: `include: { performedBy }` → populate the relation ALIAS. */
  async findManyWithRelations(filter, { tx, skip, take, include } = {}) {
    let q = models.AuditLog.find(toMongoFilter(filter)).sort({ createdAt: -1 });
    if (skip !== undefined) q = q.skip(skip);
    if (take !== undefined) q = q.limit(take);
    if (include?.performedBy) q = q.populate("performedBy");
    return q.session(tx ?? null);
  }

  /** M-4 neutral envelope; count-desc, matching the Prisma sibling. */
  async groupByCategorySince(since, { tx } = {}) {
    return fromMongoGroupBy(await models.AuditLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).session(tx ?? null));
  }

  /** Same, plus the take:10 cap the top-actions widget relies on. */
  async groupByActionSince(since, { tx } = {}) {
    return fromMongoGroupBy(await models.AuditLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$action", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).session(tx ?? null));
  }

  /**
   * M-6: daily audit-activity trend. $dateToString replaces TO_CHAR; the
   * `_id` / `count` field names and ASC ordering are preserved because the
   * controller forwards these rows to the API response unchanged.
   */
  async findDailyActivitySince(since, { tx } = {}) {
    return models.AuditLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
          count: { $sum: 1 },
      } },
      { $sort: { _id: 1 } },
    ]).session(tx ?? null);
  }
  /**
   * Mongo equivalent of createMany({ skipDuplicates: true }): an UNORDERED
   * insertMany, which continues past duplicate-key errors instead of
   * aborting the batch. Returns { count } to match the Prisma payload.
   */
  async createMany(rows, { tx } = {}) {
    try {
      const docs = await models.AuditLog.insertMany(rows, {
        ordered: false, session: tx, rawResult: false,
      });
      return { count: docs.length };
    } catch (err) {
      // An unordered insertMany reports partial success on the error; a
      // duplicate is not a failure for this caller.
      if (err?.insertedDocs) return { count: err.insertedDocs.length };
      throw normalizeMongoError(err);
    }
  }

}
