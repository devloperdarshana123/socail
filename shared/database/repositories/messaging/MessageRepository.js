import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { normalizeCursor, toPrismaCursorArgs, toMongoCursorFilter, buildCursorResult, withNotDeleted, toPrismaWhere, toPrismaData, toMongoFilter, toMongoProjection, toMongoUpdate, toMongoDocument } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — chat messages. Postgres: Message model. Mongo: `messages`.
// `findByConversationId` uses CURSOR pagination deliberately — this is the
// highest-volume query either backend serves (Phase 2, §6), and offset
// pagination degrades badly at depth on a large thread. `search()` not
// implemented — message text is encrypted at rest on both backends (see
// Milestone 2), so it was never intended to be searchable server-side.
export class MessageRepository extends BaseRepository {
  async findByConversationId(conversationId, cursorOptions, _options) {
    throw new Error(`${this.constructor.name}.findByConversationId() not implemented`);
  }

  // Phase 7A additions (server's messageHelpers migration). Distinct from
  // findByConversationId above, which owns its own cursor/ordering/filter
  // contract. Mongo-backed implementations deferred.
  async findManyWithCursor(filter, _options) {
    throw new Error(`${this.constructor.name}.findManyWithCursor() not implemented`);
  }

  async findAllByConversationId(conversationId, _options) {
    throw new Error(`${this.constructor.name}.findAllByConversationId() not implemented`);
  }

  /**
   * Row-level pessimistic lock — see the Prisma implementation for why this
   * is expressed as raw SQL and why it MUST be given a transaction.
   */
  async findByIdForUpdate(id, _options) {
    throw new Error(`${this.constructor.name}.findByIdForUpdate() not implemented`);
  }
}

export class PrismaMessageRepository extends MessageRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.message.findUnique({ where: { id }, ...(select ? { select } : {}) });
  }

  /**
   * Cursor-paginated thread read with a caller-supplied filter/projection.
   *
   * The filter passes through VERBATIM (callers assemble their own
   * isDeleted/clearedAt/before predicates) and `take` is RAW, not routed
   * through the cursor helpers — callers pass `limit + 1` and use the extra
   * row to compute hasMore themselves.
   */
  async findManyWithCursor(filter, { tx, take, include } = {}) {
    const client = tx ?? this.prismaClient;
    return client.message.findMany({
      where: toPrismaWhere(filter),
      orderBy: { createdAt: "desc" },
      take,
      ...(include ? { include } : {}),
    });
  }

  // Every non-deleted message in a conversation. DELIBERATELY UNBOUNDED —
  // the caller writes a read-receipt per row, so a silent pagination cap
  // (findMany's default of 20) would leave older messages unread forever.
  async findAllByConversationId(conversationId, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.message.findMany({
      where: { conversationId, isDeleted: false },
      ...(select ? { select } : {}),
    });
  }

  /**
   * SELECT ... FOR UPDATE — a genuine PostgreSQL row lock, preserved
   * byte-identically from the original helper query.
   *
   * WHY RAW SQL: Prisma exposes no FOR UPDATE clause on findUnique/findFirst.
   * There is no equivalent through the ORM, so this is the one place in the
   * repository layer where raw SQL is load-bearing rather than a
   * convenience (contrast the admin analytics raw SQL, which is raw only
   * because Prisma cannot express date truncation).
   *
   * WHY `tx` IS REQUIRED: a row lock lives only for the life of its
   * transaction. Called without one, Prisma runs the statement in its own
   * implicit transaction that commits immediately, releasing the lock
   * before the caller can act on it — the query would appear to work while
   * providing no mutual exclusion at all. The caller MUST supply `tx`.
   *
   * Returns an ARRAY (raw SQL result set), not a single row — the caller's
   * existing empty-check depends on that shape.
   */
  async findByIdForUpdate(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.$queryRaw`
          SELECT id, "isDeleted", reactions FROM "Message"
          WHERE id = ${id}
          FOR UPDATE
        `;
  }

  async findByConversationId(conversationId, cursorOptions = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const normalized = normalizeCursor(cursorOptions);
    const { take, skip, cursor } = toPrismaCursorArgs(normalized);
    const docs = await client.message.findMany({
      where: withNotDeleted({ conversationId }),
      orderBy: { createdAt: "desc" },
      take: take + 1, // fetch one extra to know if there's a next page
      skip,
      cursor,
    });
    return buildCursorResult({ docs, limit: normalized.limit, cursorField: "id" });
  }

  async create(data, { tx, include } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.message.create({ data: toPrismaData(data), ...(include ? { include } : {}) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.message.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.message.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.message.findMany({ where: toPrismaWhere(withNotDeleted(filter)), skip: pagination.skip, take: pagination.take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.message.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.message.count({ where: toPrismaWhere(withNotDeleted(filter)) });
  }
}

export class MongoMessageRepository extends MessageRepository {
  async findById(id, { tx, select } = {}) {
    // `include`/`select` used to be dropped here: the signature did not even
    // accept them, so the caller's author/sender block came back undefined on
    // Mongo while Postgres returned it. Populating the relation ALIAS (see the
    // schema's virtuals) puts the joined document where the caller looks.
    let q = models.Message.findById(id);
    if (select?.sender) {
      q = q.populate({
        path: "sender",
        ...(select.sender?.select ? { select: toMongoProjection(select.sender.select) } : {}),
      });
      const scalars = toMongoProjection(select);
      if (scalars) q = q.select(`${scalars} senderId`);
    } else if (select) {
      q = q.select(toMongoProjection(select));
    }
    return q.session(tx ?? null);
  }

  async findByConversationId(conversationId, cursorOptions = {}, { tx } = {}) {
    const normalized = normalizeCursor(cursorOptions);
    const { filter } = toMongoCursorFilter(normalized, { cursorField: "_id", direction: "desc" });
    const docs = await models.Message
      .find(withNotDeleted({ conversationId, ...filter }))
      .sort({ _id: -1 })
      .limit(normalized.limit + 1)
      .session(tx ?? null);
    return buildCursorResult({ docs, limit: normalized.limit, cursorField: "_id" });
  }

  async create(data, { tx, include } = {}) {
    try {
      const [doc] = await models.Message.create([toMongoDocument(data)], { session: tx });
      if (include?.sender) {
        await doc.populate({
          path: "sender",
          ...(include.sender?.select ? { select: toMongoProjection(include.sender.select) } : {}),
        });
      }
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Message.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Message ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Message.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true, session: tx }
    );
    if (!doc) throw new NotFoundError(`Message ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    return models.Message
      .find(toMongoFilter(withNotDeleted(filter)))
      .skip(pagination.skip ?? 0)
      .limit(pagination.limit ?? 20)
      .session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Message.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Message.countDocuments(toMongoFilter(withNotDeleted(filter))).session(tx ?? null);
  }
  async findManyWithCursor(filter, { tx, take, include } = {}) {
    let q = models.Message.find(toMongoFilter(filter)).sort({ createdAt: -1 });
    if (take !== undefined) q = q.limit(take);
    if (include?.sender) q = q.populate("sender");
    return q.session(tx ?? null);
  }

  /** DELIBERATELY UNBOUNDED — the caller writes a receipt per row. */
  async findAllByConversationId(conversationId, { tx, select } = {}) {
    let q = models.Message.find({ conversationId, isDeleted: false });
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

  /**
   * M-6: the Mongo equivalent of `SELECT … FOR UPDATE`.
   *
   * MongoDB has NO row-level pessimistic lock. The closest true analogue is
   * to take a WRITE lock inside the transaction: WiredTiger locks a document
   * on first write and holds it until commit, so a second transaction
   * touching the same document gets a WriteConflict and
   * `session.withTransaction()` retries it. A no-op `$set` of an existing
   * field is enough to acquire that lock without altering data.
   *
   * BEHAVIOURAL DIFFERENCE, DELIBERATELY DOCUMENTED: Postgres BLOCKS the
   * second transaction until the first commits; Mongo ABORTS and retries it.
   * Net effect is the same (serialised access, both eventually succeed), but
   * under heavy contention Postgres queues where Mongo retries.
   *
   * `tx` is REQUIRED for the same reason as on Postgres — without a
   * transaction the lock is released immediately and provides no mutual
   * exclusion. Returns an ARRAY, matching the raw-SQL result-set shape the
   * caller's empty-check depends on.
   */
  async findByIdForUpdate(id, { tx } = {}) {
    const doc = await models.Message.findOneAndUpdate(
      { _id: id },
      { $set: { lockedAt: new Date() } },
      { new: true, session: tx, projection: { isDeleted: 1, reactions: 1 } },
    );
    return doc ? [doc] : [];
  }

}
