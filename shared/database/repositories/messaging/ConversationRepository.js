import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toPrismaWhere, toPrismaData, toMongoProjection, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — chat threads. Postgres: Conversation (participants via the
// separate ConversationParticipant join table). Mongo: `conversations`
// (participantIds embedded directly — Milestone 2's design). Same
// `findByParticipant()` method, two different query shapes underneath —
// that asymmetry is exactly the point of this interface. `search()` not
// implemented — conversations aren't free-text searched.
export class ConversationRepository extends BaseRepository {
  async findByParticipant(userId, _options) {
    throw new Error(`${this.constructor.name}.findByParticipant() not implemented`);
  }

  // Phase 7A additions (server's messageHelpers migration). Mongo-backed
  // implementations deferred.
  async findByParticipantsKey(participantsKey, _options) {
    throw new Error(`${this.constructor.name}.findByParticipantsKey() not implemented`);
  }

  async findActiveByIds(ids, _options) {
    throw new Error(`${this.constructor.name}.findActiveByIds() not implemented`);
  }
}

export class PrismaConversationRepository extends ConversationRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  /** `select` and `include` are mutually exclusive, per Prisma. */
  async findById(id, { tx, select, include } = {}) {
    const client = tx ?? this.prismaClient;
    return client.conversation.findUnique({
      where: { id },
      ...(select ? { select } : include ? { include } : {}),
    });
  }

  // getOrCreateDM's race recovery: look the thread up by its deterministic
  // participants key (a unique column) rather than by id.
  async findByParticipantsKey(participantsKey, { tx, include } = {}) {
    const client = tx ?? this.prismaClient;
    return client.conversation.findUnique({
      where: { participantsKey },
      ...(include ? { include } : {}),
    });
  }

  // getConversationsList: the active threads among a supplied id set,
  // most-recently-updated first. `skip`/`take` are RAW — the caller computes
  // its own page window and passes `limit + 1` to detect hasMore.
  async findActiveByIds(ids, { tx, skip, take, include } = {}) {
    const client = tx ?? this.prismaClient;
    return client.conversation.findMany({
      where: { id: { in: ids }, isActive: true },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      ...(include ? { include } : {}),
    });
  }

  async findByParticipant(userId, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.conversation.findMany({
      where: { members: { some: { userId } }, isActive: true },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    });
  }

  /**
   * `data` passes through verbatim, so Prisma NESTED WRITES (members.create,
   * groupAdmin.connect) work exactly as they did inline — the nested rows
   * are still created in the same implicit transaction as the parent.
   */
  async create(data, { tx, include } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.conversation.create({ data: toPrismaData(data), ...(include ? { include } : {}) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  /** Same verbatim-`data` and `include` contract as create(). */
  async update(id, data, { tx, include } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.conversation.update({
        where: { id },
        data: toPrismaData(data),
        ...(include ? { include } : {}),
      });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.conversation.update({ where: { id }, data: { isActive: false, disbandedAt: new Date() } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.conversation.findMany({ where: toPrismaWhere(filter), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.conversation.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.conversation.count({ where: toPrismaWhere(filter) });
  }
}

export class MongoConversationRepository extends ConversationRepository {
  /**
   * M-10. `include: { members: { include: { user: { select } } } }`.
   *
   * This option was being IGNORED, which broke chat outright rather than
   * subtly: every socket handler resolves a conversation this way and then
   * checks that the sender is among its members. With no members returned the
   * check failed for everyone, so `message:send` answered "Unauthorized" for
   * every message on Mongo. Found by the chat-server suite.
   *
   * Two shape differences have to be reconciled here, because the caller is
   * shared and must not know which backend it is on:
   *   • Prisma calls the relation `members` and puts the user on `.user`;
   *     the Mongo schema exposes a `participants` virtual with the user on
   *     `.userId`.
   *   • Prisma returns a plain object. A mongoose document spreads to its
   *     internals, and the caller does `{ ...conv }` — so this path returns
   *     a plain object too.
   */
  async findById(id, { tx, include } = {}) {
    if (!include?.members) {
      return models.Conversation.findById(id).session(tx ?? null);
    }
    const userSelect = include.members?.include?.user?.select;
    const doc = await models.Conversation.findById(id)
      .populate({
        path: "participants",
        populate: {
          path: "user",
          ...(userSelect ? { select: toMongoProjection(userSelect) } : {}),
        },
      })
      .session(tx ?? null);
    if (!doc) return null;

    const plain = doc.toObject({ virtuals: true });
    plain.members = plain.participants ?? [];
    return plain;
  }

  async findByParticipant(userId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Conversation
      .find({ participantIds: userId, isActive: true })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Conversation.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Conversation.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Conversation ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Conversation.findByIdAndUpdate(
      id,
      { isActive: false, disbandedAt: new Date() },
      { new: true, session: tx }
    );
    if (!doc) throw new NotFoundError(`Conversation ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Conversation.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Conversation.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Conversation.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
  /** M-10: `include: { members: … }` → populate on the members path. */
  async findByParticipantsKey(participantsKey, { tx, include } = {}) {
    let q = models.Conversation.findOne({ participantsKey });
    if (include?.members) q = q.populate({ path: "members", populate: { path: "user" } });
    return q.session(tx ?? null);
  }

  async findActiveByIds(ids, { tx, skip, take, include } = {}) {
    let q = models.Conversation.find({ _id: { $in: ids }, isActive: true })
      .sort({ updatedAt: -1 });
    if (skip) q = q.skip(skip);
    if (take) q = q.limit(take);
    if (include?.members) q = q.populate({ path: "members", populate: { path: "user" } });
    return q.session(tx ?? null);
  }

}
