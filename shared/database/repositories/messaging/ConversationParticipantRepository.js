import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, withNotDeleted, toPrismaWhere, toPrismaData, fromPrismaSum, toMongoFilter, toMongoUpdate, toMongoProjection, fromMongoSum, toMongoDocument } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — per-user membership/unread state for a conversation.
// Postgres: ConversationParticipant model. Mongo:
// `conversationParticipants`. `search()` not implemented — no free-text
// field.
export class ConversationParticipantRepository extends BaseRepository {
  async findByConversationAndUser(conversationId, userId, _options) {
    throw new Error(`${this.constructor.name}.findByConversationAndUser() not implemented`);
  }

  async findByUserId(userId, _options) {
    throw new Error(`${this.constructor.name}.findByUserId() not implemented`);
  }

  // Phase 7A additions (server's messageHelpers migration). Mongo-backed
  // implementations deferred.
  async findAllActiveByUserId(userId, _options) {
    throw new Error(`${this.constructor.name}.findAllActiveByUserId() not implemented`);
  }

  async findActiveByConversationAndUser(conversationId, userId, _options) {
    throw new Error(`${this.constructor.name}.findActiveByConversationAndUser() not implemented`);
  }

  async updateManyWhere(filter, data, _options) {
    throw new Error(`${this.constructor.name}.updateManyWhere() not implemented`);
  }

  async upsertByConversationAndUser(conversationId, userId, payload, _options) {
    throw new Error(`${this.constructor.name}.upsertByConversationAndUser() not implemented`);
  }

  async sumUnreadForUser(userId, _options) {
    throw new Error(`${this.constructor.name}.sumUnreadForUser() not implemented`);
  }

  // Phase 7E addition (M-7, chat-server). Distinct from findMany() below,
  // which applies offset pagination AND soft-delete scoping — the chat
  // handler reads the FULL member set of one conversation to build its
  // unread map, so a 20-row cap would silently drop members from a group.
  async findAllWhere(filter, _options) {
    throw new Error(`${this.constructor.name}.findAllWhere() not implemented`);
  }
}

export class PrismaConversationParticipantRepository extends ConversationParticipantRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.conversationParticipant.findUnique({ where: { id } });
  }

  // `conversationId` + `userId` is a compound unique in the Postgres schema,
  // so findFirst returns the same single row or null a compound-key
  // findUnique would.
  async findByConversationAndUser(conversationId, userId, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.conversationParticipant.findFirst({
      where: { conversationId, userId },
      ...(select ? { select } : {}),
    });
  }

  // addGroupMember's guard: is this user an ACTIVE member? Distinct from
  // findByConversationAndUser, which matches soft-deleted rows too.
  async findActiveByConversationAndUser(conversationId, userId, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.conversationParticipant.findFirst({
      where: { conversationId, userId, isDeleted: false },
    });
  }

  // Every live membership row for a user. DELIBERATELY UNBOUNDED — the
  // caller uses this set as the id list for its conversations query, so a
  // silent cap (findMany's default of 20) would hide threads entirely
  // rather than merely paginating them.
  async findAllActiveByUserId(userId, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.conversationParticipant.findMany({
      where: { userId, isDeleted: false },
      ...(select ? { select } : {}),
    });
  }

  /**
   * Bulk field update over a caller-supplied filter, passed through
   * VERBATIM — callers use this to flip isDeleted in both directions and to
   * target "everyone except the sender". Returns Prisma's { count }.
   */
  async updateManyWhere(filter, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.conversationParticipant.updateMany({ where: toPrismaWhere(filter), data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  /**
   * Idempotent membership write on the (conversationId, userId) compound
   * key. `payload` is `{ update, create }`, matching Prisma's own upsert
   * shape — this is what makes re-adding a previously removed member safe
   * without a read-then-write race.
   */
  async upsertByConversationAndUser(conversationId, userId, { update, create }, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.conversationParticipant.upsert({
        where: { conversationId_userId: { conversationId, userId } },
        update: toPrismaData(update),
        create: toPrismaData(create),
      });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  // Total unread across a user's live conversations. Returns Prisma's
  // aggregate envelope ({ _sum: { unreadCount } }); the caller owns the
  // null-coalescing for a user with no rows.
  async sumUnreadForUser(userId, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const agg = await client.conversationParticipant.aggregate({
      where: { userId, isDeleted: false },
      _sum: { unreadCount: true },
    });
    return fromPrismaSum(agg);
  }

  /**
   * DELIBERATELY UNBOUNDED read on a caller-assembled filter, with NO
   * soft-delete scoping — the caller's filter is authoritative. See the
   * interface note for why findMany() cannot be reused here.
   */
  async findAllWhere(filter, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.conversationParticipant.findMany({
      where: toPrismaWhere(filter),
      ...(select ? { select } : {}),
    });
  }

  async findByUserId(userId, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.conversationParticipant.findMany({ where: withNotDeleted({ userId }), skip, take });
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.conversationParticipant.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.conversationParticipant.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.conversationParticipant.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx, includeDeleted = false } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.conversationParticipant.findMany({
      where: toPrismaWhere(includeDeleted ? filter : withNotDeleted(filter)),
      skip,
      take,
    });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.conversationParticipant.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx, includeDeleted = false } = {}) {
    const client = tx ?? this.prismaClient;
    return client.conversationParticipant.count({ where: toPrismaWhere(includeDeleted ? filter : withNotDeleted(filter)) });
  }
}

export class MongoConversationParticipantRepository extends ConversationParticipantRepository {
  async findById(id, { tx } = {}) {
    return models.ConversationParticipant.findById(id).session(tx ?? null);
  }

  async findByConversationAndUser(conversationId, userId, { tx } = {}) {
    return models.ConversationParticipant.findOne({ conversationId, userId }).session(tx ?? null);
  }

  async findByUserId(userId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.ConversationParticipant
      .find(withNotDeleted({ userId }))
      .skip(skip)
      .limit(limit)
      .session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.ConversationParticipant.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.ConversationParticipant.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`ConversationParticipant ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.ConversationParticipant.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true, session: tx }
    );
    if (!doc) throw new NotFoundError(`ConversationParticipant ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx, includeDeleted = false } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    const query = toMongoFilter(includeDeleted ? filter : withNotDeleted(filter));
    return models.ConversationParticipant.find(query).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.ConversationParticipant.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx, includeDeleted = false } = {}) {
    const query = toMongoFilter(includeDeleted ? filter : withNotDeleted(filter));
    return models.ConversationParticipant.countDocuments(query).session(tx ?? null);
  }
  async findActiveByConversationAndUser(conversationId, userId, { tx } = {}) {
    return models.ConversationParticipant
      .findOne({ conversationId, userId, isDeleted: false })
      .session(tx ?? null);
  }

  /** DELIBERATELY UNBOUNDED — the caller uses this as its conversation id set. */
  async findAllActiveByUserId(userId, { tx, select, include } = {}) {
    // `include`/`select` used to be dropped here: the signature did not even
    // accept them, so the caller's author/sender block came back undefined on
    // Mongo while Postgres returned it. Populating the relation ALIAS (see the
    // schema's virtuals) puts the joined document where the caller looks.
    let q = models.ConversationParticipant.find({ userId, isArchived: false });
    if (include?.conversation) q = q.populate("conversation");
    if (include?.user) q = q.populate("user");
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

  async updateManyWhere(filter, data, { tx } = {}) {
    try {
      const r = await models.ConversationParticipant.updateMany(
        toMongoFilter(filter), toMongoUpdate(data), { session: tx },
      );
      return { count: r.matchedCount };
    } catch (err) { throw normalizeMongoError(err); }
  }

  /** See OtpRepository.upsertByUserAndPurpose for the upsert translation. */
  async upsertByConversationAndUser(conversationId, userId, { update, create }, { tx } = {}) {
    try {
      const u = toMongoUpdate(update);
      const c = toMongoUpdate(create).$set ?? {};
      const touched = new Set(Object.values(u).flatMap((o) => Object.keys(o ?? {})));
      const onInsert = Object.fromEntries(
        Object.entries({ conversationId, userId, ...c }).filter(([k]) => !touched.has(k))
      );
      return await models.ConversationParticipant.findOneAndUpdate(
        { conversationId, userId },
        { ...u, ...(Object.keys(onInsert).length ? { $setOnInsert: onInsert } : {}) },
        { upsert: true, new: true, runValidators: true, session: tx },
      );
    } catch (err) { throw normalizeMongoError(err); }
  }

  /** M-4: neutral bare-sums object, null preserved for an empty match. */
  async sumUnreadForUser(userId, { tx } = {}) {
    const rows = await models.ConversationParticipant.aggregate([
      { $match: { userId, isDeleted: false } },
      { $group: { _id: null, unreadCount: { $sum: "$unreadCount" } } },
    ]).session(tx ?? null);
    return fromMongoSum(rows[0], ["unreadCount"]);
  }

  /** DELIBERATELY UNBOUNDED — see the Prisma implementation. */
  async findAllWhere(filter, { tx, select } = {}) {
    let q = models.ConversationParticipant.find(toMongoFilter(filter));
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

}
