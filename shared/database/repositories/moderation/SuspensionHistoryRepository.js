import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toPrismaWhere, toPrismaData, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — ban/suspend action log. Postgres: SuspensionHistory model
// (`performedBy` is a plain string, not a relation). Mongo:
// `suspensionHistory` (`performedBy` is an ObjectId ref — Milestone 2's
// design tightened this; the repository passes whatever value it's given
// through as-is on both sides rather than papering over the difference).
// `search()` not implemented — no free-text field.
export class SuspensionHistoryRepository extends BaseRepository {
  async findByUserId(userId, _options) {
    throw new Error(`${this.constructor.name}.findByUserId() not implemented`);
  }

  // Phase 7A addition (server's adminUserHelpers migration) — the COMPLETE
  // moderation history for one user, unpaginated. See the Prisma
  // implementation for why this cannot reuse findByUserId(). Mongo-backed
  // implementation deferred.
  async findAllByUserId(userId, _options) {
    throw new Error(`${this.constructor.name}.findAllByUserId() not implemented`);
  }
}

export class PrismaSuspensionHistoryRepository extends SuspensionHistoryRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.suspensionHistory.findUnique({ where: { id } });
  }

  async findByUserId(userId, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.suspensionHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
  }

  /**
   * The user's COMPLETE moderation history, newest first.
   *
   * DELIBERATELY UNBOUNDED, and therefore a separate method from
   * findByUserId() above: that one routes through toPrismaPagination(), whose
   * default caps `take` at 20. The admin suspension-history panel renders the
   * whole audit trail with no paging controls, so a silent 20-row cap would
   * hide older bans and quietly misrepresent a moderation record.
   */
  async findAllByUserId(userId, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.suspensionHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.suspensionHistory.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.suspensionHistory.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.suspensionHistory.delete({ where: { id } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.suspensionHistory.findMany({ where: toPrismaWhere(filter), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.suspensionHistory.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.suspensionHistory.count({ where: toPrismaWhere(filter) });
  }
}

export class MongoSuspensionHistoryRepository extends SuspensionHistoryRepository {
  async findById(id, { tx } = {}) {
    return models.SuspensionHistory.findById(id).session(tx ?? null);
  }

  async findByUserId(userId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.SuspensionHistory
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.SuspensionHistory.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.SuspensionHistory.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`SuspensionHistory ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.SuspensionHistory.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`SuspensionHistory ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.SuspensionHistory.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.SuspensionHistory.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.SuspensionHistory.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
  /** DELIBERATELY UNBOUNDED — see the Prisma implementation. */
  async findAllByUserId(userId, { tx } = {}) {
    return models.SuspensionHistory.find({ userId }).sort({ createdAt: -1 }).session(tx ?? null);
  }

}
