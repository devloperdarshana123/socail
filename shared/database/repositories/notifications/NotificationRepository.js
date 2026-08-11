import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toPrismaWhere, toPrismaData, toMongoFilter, toMongoUpdate, toMongoProjection, toMongoDocument, toAggregateProjection, relationPipeline } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — notification inbox. Postgres: Notification model (no
// `audience` field — Milestone 2's absorbed AdminNotification concept is
// Mongo-only; Prisma's implementation only ever deals with per-user
// notifications). Mongo: `notifications`. `search()` not implemented — no
// product requirement for free-text notification search.
export class NotificationRepository extends BaseRepository {
  async findByReceiverId(receiverId, _options) {
    throw new Error(`${this.constructor.name}.findByReceiverId() not implemented`);
  }

  async countUnread(receiverId, _options) {
    throw new Error(`${this.constructor.name}.countUnread() not implemented`);
  }

  // Phase 7A additions (server's notificationHelpers migration). Distinct
  // from findByReceiverId above, which hardcodes its filter/ordering and
  // routes through toPrismaPagination(). Mongo-backed implementations
  // deferred.
  async findManyWithRelations(filter, _options) {
    throw new Error(`${this.constructor.name}.findManyWithRelations() not implemented`);
  }

  async updateManyWhere(filter, data, _options) {
    throw new Error(`${this.constructor.name}.updateManyWhere() not implemented`);
  }
}

export class PrismaNotificationRepository extends NotificationRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.notification.findUnique({
      where: { id },
      ...(select ? { select } : {}),
    });
  }

  /**
   * Inbox read with caller-owned filter, projection and paging. `take`/`skip`
   * are RAW — the caller computes its own page window — so this deliberately
   * does not route through toPrismaPagination().
   */
  async findManyWithRelations(filter, { tx, take, skip, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.notification.findMany({
      where: toPrismaWhere(filter),
      orderBy: { createdAt: "desc" },
      take,
      skip,
      ...(select ? { select } : {}),
    });
  }

  /** Bulk field update over a caller-supplied filter. Returns { count }. */
  async updateManyWhere(filter, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.notification.updateMany({ where: toPrismaWhere(filter), data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findByReceiverId(receiverId, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.notification.findMany({
      where: { receiverId, isDeleted: false },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
  }

  async countUnread(receiverId, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.notification.count({ where: { receiverId, isRead: false, isDeleted: false } });
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.notification.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.notification.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.notification.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.notification.findMany({ where: toPrismaWhere(filter), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.notification.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.notification.count({ where: toPrismaWhere(filter) });
  }
}

export class MongoNotificationRepository extends NotificationRepository {
  async findById(id, { tx } = {}) {
    return models.Notification.findById(id).session(tx ?? null);
  }

  async findByReceiverId(receiverId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Notification
      .find({ receiverId, isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .session(tx ?? null);
  }

  async countUnread(receiverId, { tx } = {}) {
    return models.Notification.countDocuments({ receiverId, isRead: false, isDeleted: false }).session(
      tx ?? null
    );
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Notification.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Notification.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Notification ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Notification.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true, session: tx }
    );
    if (!doc) throw new NotFoundError(`Notification ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Notification.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Notification.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Notification.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
  async findManyWithRelations(filter, { tx, take, skip, select } = {}) {
    // The inbox renders each row with its sender. `senderId` points at
    // `users`, so this is the same relation join the feed and comment list
    // use — one implementation, in queryHelpers/relations.js.
    if (select?.sender) {
      return models.Notification.aggregate(relationPipeline({
        match: toMongoFilter(filter),
        sort: { createdAt: -1 },
        relations: [{ as: "sender", from: "users", localField: "senderId" }],
        skip, limit: take,
        project: toAggregateProjection(select, ["sender"]),
      })).session(tx ?? null);
    }
    let q = models.Notification.find(toMongoFilter(filter)).sort({ createdAt: -1 });
    if (skip) q = q.skip(skip);
    if (take) q = q.limit(take);
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

  async updateManyWhere(filter, data, { tx } = {}) {
    try {
      const r = await models.Notification.updateMany(toMongoFilter(filter), toMongoUpdate(data), { session: tx });
      // Prisma's updateMany count is rows MATCHED by the where clause — it
      // counts a row even when the new value equals the old. Mongo's
      // modifiedCount excludes unchanged documents, so matchedCount is the
      // faithful analogue; modifiedCount would under-report.
      return { count: r.matchedCount };
    } catch (err) { throw normalizeMongoError(err); }
  }

}
