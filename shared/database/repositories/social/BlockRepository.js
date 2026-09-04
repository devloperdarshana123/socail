import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toPrismaWhere, toPrismaData, toMongoFilter, toMongoUpdate, toMongoProjection, toMongoDocument } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — user-to-user block edge. Postgres: Block model. Mongo:
// `blocks`. `search()` not implemented — no free-text field on a block.
export class BlockRepository extends BaseRepository {
  async findByBlockerAndBlocked(blockerId, blockedId, _options) {
    throw new Error(`${this.constructor.name}.findByBlockerAndBlocked() not implemented`);
  }

  async findByBlockerId(blockerId, _options) {
    throw new Error(`${this.constructor.name}.findByBlockerId() not implemented`);
  }

  // Phase 7A additions (server's userHelpers migration). Mongo-backed
  // implementations deferred.
  async upsertByBlockerAndBlocked(blockerId, blockedId, payload, _options) {
    throw new Error(`${this.constructor.name}.upsertByBlockerAndBlocked() not implemented`);
  }

  async deleteManyWhere(filter, _options) {
    throw new Error(`${this.constructor.name}.deleteManyWhere() not implemented`);
  }

  async findAllByBlockerId(blockerId, _options) {
    throw new Error(`${this.constructor.name}.findAllByBlockerId() not implemented`);
  }
}

export class PrismaBlockRepository extends BlockRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.block.findUnique({ where: { id } });
  }

  async findByBlockerAndBlocked(blockerId, blockedId, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.block.findFirst({ where: { blockerId, blockedId } });
  }

  async findByBlockerId(blockerId, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.block.findMany({ where: { blockerId }, skip, take });
  }

  /**
   * Idempotent block on the (blockerId, blockedId) compound key. `payload`
   * is `{ update, create }`, matching Prisma's upsert shape — re-blocking an
   * already-blocked user is a no-op rather than a unique-constraint failure.
   */
  async upsertByBlockerAndBlocked(blockerId, blockedId, { update, create }, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.block.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        update: toPrismaData(update),
        create: toPrismaData(create),
      });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  /** Bulk unblock over a caller-supplied filter. Returns Prisma's { count }. */
  async deleteManyWhere(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.block.deleteMany({ where: toPrismaWhere(filter) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  // Every block a user has made, with the blocked profile attached.
  // DELIBERATELY UNBOUNDED — findByBlockerId above paginates and returns
  // bare rows; the block list is shown in full.
  async findAllByBlockerId(blockerId, { tx, include } = {}) {
    const client = tx ?? this.prismaClient;
    return client.block.findMany({
      where: { blockerId },
      ...(include ? { include } : {}),
    });
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.block.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.block.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.block.delete({ where: { id } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.block.findMany({ where: toPrismaWhere(filter), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.block.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.block.count({ where: toPrismaWhere(filter) });
  }
}

export class MongoBlockRepository extends BlockRepository {
  async findById(id, { tx } = {}) {
    return models.Block.findById(id).session(tx ?? null);
  }

  async findByBlockerAndBlocked(blockerId, blockedId, { tx } = {}) {
    return models.Block.findOne({ blockerId, blockedId }).session(tx ?? null);
  }

  async findByBlockerId(blockerId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Block.find({ blockerId }).skip(skip).limit(limit).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Block.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Block.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Block ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Block.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Block ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Block.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Block.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Block.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
  /** See OtpRepository.upsertByUserAndPurpose for the upsert translation. */
  async upsertByBlockerAndBlocked(blockerId, blockedId, { update, create }, { tx } = {}) {
    try {
      const u = toMongoUpdate(update);
      const c = toMongoUpdate(create).$set ?? {};
      // Exclude every field the update branch touches under ANY operator
      // ($set, $inc, $push …) — Mongo rejects a path that appears in both an
      // update operator and $setOnInsert.
      const touched = new Set(Object.values(u).flatMap((o) => Object.keys(o ?? {})));
      const onInsert = Object.fromEntries(
        Object.entries({ blockerId, blockedId, ...c }).filter(([k]) => !touched.has(k))
      );
      return await models.Block.findOneAndUpdate(
        { blockerId, blockedId },
        { ...u, ...(Object.keys(onInsert).length ? { $setOnInsert: onInsert } : {}) },
        { upsert: true, new: true, runValidators: true, session: tx },
      );
    } catch (err) { throw normalizeMongoError(err); }
  }

  async deleteManyWhere(filter, { tx } = {}) {
    try {
      const r = await models.Block.deleteMany(toMongoFilter(filter), { session: tx });
      return { count: r.deletedCount };
    } catch (err) { throw normalizeMongoError(err); }
  }

  /** M-10: `include: { blocked: … }` → populate("blocked"). */
  async findAllByBlockerId(blockerId, { tx, include } = {}) {
    let q = models.Block.find({ blockerId });
    if (include?.blocked) {
      q = q.populate({
        path: "blocked",
        ...(include.blocked?.select ? { select: toMongoProjection(include.blocked.select) } : {}),
      });
    }
    return q.session(tx ?? null);
  }

}
