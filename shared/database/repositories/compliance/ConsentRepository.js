import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toPrismaWhere, toPrismaData, toMongoFilter, toMongoUpdate, toMongoSort, toMongoProjection, toMongoDocument } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — GDPR/cookie consent. Postgres: Consent model. Mongo:
// `consents`. `search()` not implemented — no free-text field. `delete()`
// exists for interface completeness but consent records are a compliance
// record — whether they should ever actually be deleted (vs withdrawn via
// `update()`) is a business decision for a later layer, not enforced here.
export class ConsentRepository extends BaseRepository {
  async findBySessionAndPolicyVersion(sessionId, policyVersion, _options) {
    throw new Error(`${this.constructor.name}.findBySessionAndPolicyVersion() not implemented`);
  }

  async findByUserId(userId, _options) {
    throw new Error(`${this.constructor.name}.findByUserId() not implemented`);
  }

  // Phase 7A additions (server's consentHelpers migration). Mongo-backed
  // implementations deferred.
  async upsertBySessionAndPolicyVersion(sessionId, policyVersion, payload, _options) {
    throw new Error(`${this.constructor.name}.upsertBySessionAndPolicyVersion() not implemented`);
  }

  async findFirstWhere(filter, _options) {
    throw new Error(`${this.constructor.name}.findFirstWhere() not implemented`);
  }
}

export class PrismaConsentRepository extends ConsentRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.consent.findUnique({ where: { id } });
  }

  async findBySessionAndPolicyVersion(sessionId, policyVersion, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.consent.findFirst({ where: { sessionId, policyVersion } });
  }

  async findByUserId(userId, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.consent.findMany({ where: { userId }, skip, take });
  }

  /**
   * Idempotent consent write on the (sessionId, policyVersion) compound key.
   * `payload` is `{ update, create }`, matching Prisma's upsert shape — a
   * visitor re-submitting their choices for the same policy version updates
   * the existing record rather than accumulating duplicates.
   */
  async upsertBySessionAndPolicyVersion(sessionId, policyVersion, { update, create }, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.consent.upsert({
        where: { sessionId_policyVersion: { sessionId, policyVersion } },
        update: toPrismaData(update),
        create: toPrismaData(create),
      });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  // Single-row lookup with caller-owned ordering and projection — "the most
  // recent consent for this session, across policy versions".
  async findFirstWhere(filter, { tx, orderBy, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.consent.findFirst({
      where: toPrismaWhere(filter),
      ...(orderBy ? { orderBy } : {}),
      ...(select ? { select } : {}),
    });
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.consent.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.consent.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.consent.delete({ where: { id } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.consent.findMany({ where: toPrismaWhere(filter), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.consent.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.consent.count({ where: toPrismaWhere(filter) });
  }
}

export class MongoConsentRepository extends ConsentRepository {
  async findById(id, { tx } = {}) {
    return models.Consent.findById(id).session(tx ?? null);
  }

  async findBySessionAndPolicyVersion(sessionId, policyVersion, { tx } = {}) {
    return models.Consent.findOne({ sessionId, policyVersion }).session(tx ?? null);
  }

  async findByUserId(userId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Consent.find({ userId }).skip(skip).limit(limit).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Consent.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Consent.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Consent ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Consent.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Consent ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Consent.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Consent.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Consent.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
  /** See OtpRepository.upsertByUserAndPurpose for the upsert translation. */
  async upsertBySessionAndPolicyVersion(sessionId, policyVersion, { update, create }, { tx } = {}) {
    try {
      const u = toMongoUpdate(update);
      const c = toMongoUpdate(create).$set ?? {};
      // Exclude every field the update branch touches under ANY operator
      // ($set, $inc, $push …) — Mongo rejects a path that appears in both an
      // update operator and $setOnInsert.
      const touched = new Set(Object.values(u).flatMap((o) => Object.keys(o ?? {})));
      const onInsert = Object.fromEntries(
        Object.entries({ sessionId, policyVersion, ...c }).filter(([k]) => !touched.has(k))
      );
      return await models.Consent.findOneAndUpdate(
        { sessionId, policyVersion },
        { ...u, ...(Object.keys(onInsert).length ? { $setOnInsert: onInsert } : {}) },
        { upsert: true, new: true, runValidators: true, session: tx },
      );
    } catch (err) { throw normalizeMongoError(err); }
  }

  async findFirstWhere(filter, { tx, orderBy, select } = {}) {
    let q = models.Consent.findOne(toMongoFilter(filter));
    if (orderBy) q = q.sort(toMongoSort(orderBy));
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

}
