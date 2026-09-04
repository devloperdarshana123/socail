import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaWhere, toPrismaData, toMongoFilter, toMongoUpdate, toMongoSort, toMongoDocument } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — refresh-token/session persistence. Postgres: RefreshToken
// model. Mongo: the `sessions` collection (Milestone 2). `search()` is
// intentionally left unimplemented (inherited throw) — free-text search
// over sessions has no product meaning.
export class SessionRepository extends BaseRepository {
  async findByTokenHash(tokenHash, _options) {
    throw new Error(`${this.constructor.name}.findByTokenHash() not implemented`);
  }

  async findByUserId(userId, _options) {
    throw new Error(`${this.constructor.name}.findByUserId() not implemented`);
  }

  // Phase 7A addition (server's settingsHelpers migration) — "log out all
  // devices". Mongo-backed implementation deferred.
  async deleteManyByUserId(userId, _options) {
    throw new Error(`${this.constructor.name}.deleteManyByUserId() not implemented`);
  }

  // Phase 7A additions (server's userHelpers migration — the refresh-token
  // lifecycle). Mongo-backed implementations deferred.
  async deleteManyWhere(filter, _options) {
    throw new Error(`${this.constructor.name}.deleteManyWhere() not implemented`);
  }

  async updateManyWhere(filter, data, _options) {
    throw new Error(`${this.constructor.name}.updateManyWhere() not implemented`);
  }

  async findFirstWhere(filter, _options) {
    throw new Error(`${this.constructor.name}.findFirstWhere() not implemented`);
  }

  async findAllByUserIdOldestFirst(userId, _options) {
    throw new Error(`${this.constructor.name}.findAllByUserIdOldestFirst() not implemented`);
  }

  // Phase 7A addition (server's adminSettingsHelpers migration).
  async findManyWhere(filter, _options) {
    throw new Error(`${this.constructor.name}.findManyWhere() not implemented`);
  }
}

export class PrismaSessionRepository extends SessionRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.refreshToken.findUnique({ where: { id } });
  }

  async findByTokenHash(tokenHash, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.refreshToken.findFirst({ where: { tokenHash } });
  }

  async findByUserId(userId, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.refreshToken.findMany({ where: { userId }, orderBy: { lastUsedAt: "desc" } });
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.refreshToken.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.refreshToken.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.refreshToken.delete({ where: { id } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  // Revoke every session for a user. Returns Prisma's { count } batch
  // payload; unlike delete(), a no-match is not an error.
  async deleteManyByUserId(userId, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.refreshToken.deleteMany({ where: { userId } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  /**
   * Bulk revoke over a caller-supplied filter, passed through VERBATIM.
   * Callers use this for four distinct shapes: expired-for-user, by id set,
   * by (userId, tokenHash), and by (userId, tokenHash NOT current).
   * Returns Prisma's { count }.
   */
  async deleteManyWhere(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.refreshToken.deleteMany({ where: toPrismaWhere(filter) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  /** Bulk field update over a caller-supplied filter. Returns { count }. */
  async updateManyWhere(filter, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.refreshToken.updateMany({ where: toPrismaWhere(filter), data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  // Single-row lookup on a caller-supplied filter, with optional relation
  // include — findByTokenHash above cannot express the additional
  // expiry predicate or the user join that token validation needs.
  async findFirstWhere(filter, { tx, include } = {}) {
    const client = tx ?? this.prismaClient;
    return client.refreshToken.findFirst({
      where: toPrismaWhere(filter),
      ...(include ? { include } : {}),
    });
  }

  /**
   * DELIBERATELY UNBOUNDED read on a caller-assembled filter with
   * caller-owned ordering. Distinct from findByUserId above, which hardcodes
   * `{ userId }` with no expiry predicate — the admin session list must
   * exclude already-expired tokens, which that method cannot express.
   */
  async findManyWhere(filter, { tx, orderBy } = {}) {
    const client = tx ?? this.prismaClient;
    return client.refreshToken.findMany({
      where: toPrismaWhere(filter),
      ...(orderBy ? { orderBy } : {}),
    });
  }

  // Every session for a user, OLDEST FIRST — the order the device-cap
  // eviction depends on. Distinct from findByUserId above, which orders by
  // lastUsedAt desc. DELIBERATELY UNBOUNDED: the caller slices off
  // everything beyond MAX_DEVICES, so a cap would break the eviction math.
  async findAllByUserIdOldestFirst(userId, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  async findMany(filter = {}, { skip, take } = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.refreshToken.findMany({ where: toPrismaWhere(filter), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const count = await client.refreshToken.count({ where: toPrismaWhere(filter) });
    return count > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.refreshToken.count({ where: toPrismaWhere(filter) });
  }
}

export class MongoSessionRepository extends SessionRepository {
  async findById(id, { tx } = {}) {
    return models.Session.findById(id).session(tx ?? null);
  }

  async findByTokenHash(tokenHash, { tx } = {}) {
    return models.Session.findOne({ tokenHash }).session(tx ?? null);
  }

  async findByUserId(userId, { tx } = {}) {
    return models.Session.find({ userId }).sort({ lastUsedAt: -1 }).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Session.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Session.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Session ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Session.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Session ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, { skip, limit } = {}, { tx } = {}) {
    return models.Session.find(toMongoFilter(filter)).skip(skip ?? 0).limit(limit ?? 20).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Session.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Session.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
  async deleteManyByUserId(userId, { tx } = {}) {
    try {
      const r = await models.Session.deleteMany({ userId }, { session: tx });
      return { count: r.deletedCount };
    } catch (err) { throw normalizeMongoError(err); }
  }

  async deleteManyWhere(filter, { tx } = {}) {
    try {
      const r = await models.Session.deleteMany(toMongoFilter(filter), { session: tx });
      return { count: r.deletedCount };
    } catch (err) { throw normalizeMongoError(err); }
  }

  async updateManyWhere(filter, data, { tx } = {}) {
    try {
      const r = await models.Session.updateMany(toMongoFilter(filter), toMongoUpdate(data), { session: tx });
      // Prisma's updateMany count is rows MATCHED by the where clause — it
      // counts a row even when the new value equals the old. Mongo's
      // modifiedCount excludes unchanged documents, so matchedCount is the
      // faithful analogue; modifiedCount would under-report.
      return { count: r.matchedCount };
    } catch (err) { throw normalizeMongoError(err); }
  }

  /** M-10: Prisma's `include: { user: true }` → populate("user"). */
  async findFirstWhere(filter, { tx, include } = {}) {
    let q = models.Session.findOne(toMongoFilter(filter));
    if (include?.user) q = q.populate("user");
    return q.session(tx ?? null);
  }

  async findManyWhere(filter, { tx, orderBy } = {}) {
    let q = models.Session.find(toMongoFilter(filter));
    if (orderBy) q = q.sort(toMongoSort(orderBy));
    return q.session(tx ?? null);
  }

  async findAllByUserIdOldestFirst(userId, { tx } = {}) {
    return models.Session.find({ userId }).sort({ createdAt: 1 }).session(tx ?? null);
  }

}
