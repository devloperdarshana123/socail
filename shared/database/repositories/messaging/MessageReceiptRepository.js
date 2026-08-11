import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toPrismaWhere, toPrismaData, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — per-participant seen/read receipts. Postgres: MessageReceipt
// model. Mongo: `messageReceipts`. `search()` not implemented — no
// free-text field.
export class MessageReceiptRepository extends BaseRepository {
  async findByMessageAndUser(messageId, userId, _options) {
    throw new Error(`${this.constructor.name}.findByMessageAndUser() not implemented`);
  }

  async findByConversationAndUser(conversationId, userId, _options) {
    throw new Error(`${this.constructor.name}.findByConversationAndUser() not implemented`);
  }

  // Phase 7A addition (server's messageHelpers migration) — idempotent
  // "mark seen". Mongo-backed implementation deferred.
  async upsertByMessageAndUser(messageId, userId, payload, _options) {
    throw new Error(`${this.constructor.name}.upsertByMessageAndUser() not implemented`);
  }
}

export class PrismaMessageReceiptRepository extends MessageReceiptRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.messageReceipt.findUnique({ where: { id } });
  }

  async findByMessageAndUser(messageId, userId, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.messageReceipt.findFirst({ where: { messageId, userId } });
  }

  async findByConversationAndUser(conversationId, userId, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.messageReceipt.findMany({ where: { conversationId, userId }, skip, take });
  }

  /**
   * Idempotent read-receipt write on the (messageId, userId) compound key.
   * `payload` is `{ update, create }`, matching Prisma's upsert shape —
   * marking an already-seen message updates seenAt in place rather than
   * failing on the unique constraint.
   */
  async upsertByMessageAndUser(messageId, userId, { update, create }, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.messageReceipt.upsert({
        where: { messageId_userId: { messageId, userId } },
        update: toPrismaData(update),
        create: toPrismaData(create),
      });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.messageReceipt.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.messageReceipt.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.messageReceipt.delete({ where: { id } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.messageReceipt.findMany({ where: toPrismaWhere(filter), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.messageReceipt.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.messageReceipt.count({ where: toPrismaWhere(filter) });
  }
}

export class MongoMessageReceiptRepository extends MessageReceiptRepository {
  async findById(id, { tx } = {}) {
    return models.MessageReceipt.findById(id).session(tx ?? null);
  }

  async findByMessageAndUser(messageId, userId, { tx } = {}) {
    return models.MessageReceipt.findOne({ messageId, userId }).session(tx ?? null);
  }

  async findByConversationAndUser(conversationId, userId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.MessageReceipt
      .find({ conversationId, userId })
      .skip(skip)
      .limit(limit)
      .session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.MessageReceipt.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.MessageReceipt.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`MessageReceipt ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.MessageReceipt.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`MessageReceipt ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.MessageReceipt.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.MessageReceipt.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.MessageReceipt.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
  /** See OtpRepository.upsertByUserAndPurpose for the upsert translation. */
  async upsertByMessageAndUser(messageId, userId, { update, create }, { tx } = {}) {
    try {
      const u = toMongoUpdate(update);
      const c = toMongoUpdate(create).$set ?? {};
      // Exclude every field the update branch touches under ANY operator
      // ($set, $inc, $push …) — Mongo rejects a path that appears in both an
      // update operator and $setOnInsert.
      const touched = new Set(Object.values(u).flatMap((o) => Object.keys(o ?? {})));
      const onInsert = Object.fromEntries(
        Object.entries({ messageId, userId, ...c }).filter(([k]) => !touched.has(k))
      );
      return await models.MessageReceipt.findOneAndUpdate(
        { messageId, userId },
        { ...u, ...(Object.keys(onInsert).length ? { $setOnInsert: onInsert } : {}) },
        { upsert: true, new: true, runValidators: true, session: tx },
      );
    } catch (err) { throw normalizeMongoError(err); }
  }

}
