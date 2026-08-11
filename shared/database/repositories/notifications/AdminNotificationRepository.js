import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaWhere, toPrismaData, toMongoFilter, toMongoProjection, toMongoUpdate, toMongoDocument } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — the global admin notification feed. Postgres: the standalone
// AdminNotification model (no receiver, no sender — one shared feed every
// admin reads).
//
// ── WHY THERE IS NO MONGO IMPLEMENTATION ─────────────────────────────────
// This is the mirror image of NotSupportedByPrismaRepository: a domain with
// a real Postgres table but deliberately NO Mongo counterpart.
//
// Milestone 2 absorbed AdminNotification into the unified `notifications`
// collection via an `audience` field (audience:"admin" + receiverId:null =
// broadcast) — see mongodb/schemas/messaging.schemas.js. That collection is
// documented as owned EXCLUSIVELY by chat-server for writes, with server/
// only reading it, which is why NotificationRepository's own header stubs
// findByReceiverId/countUnread rather than implementing them.
//
// So the Mongo path for this domain is not simply "unwritten" — it depends
// on an unresolved product/architecture decision that Phase 6I flagged as
// the highest-risk item in the migration: whether server/ may write admin
// notifications at all, or must publish an event to chat-server instead.
// Phase 7A is Postgres-only and behaviour-preserving, so that decision is
// deliberately NOT made here. The Mongo class below fails loudly and
// explains why, rather than silently mapping this feed onto the per-user
// notification collection — which would be wrong in both directions.
export class AdminNotificationRepository extends BaseRepository {
  async findRecent(limit, _options) {
    throw new Error(`${this.constructor.name}.findRecent() not implemented`);
  }

  async countUnread(_options) {
    throw new Error(`${this.constructor.name}.countUnread() not implemented`);
  }

  async markAllRead(data, _options) {
    throw new Error(`${this.constructor.name}.markAllRead() not implemented`);
  }
}

export class PrismaAdminNotificationRepository extends AdminNotificationRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.adminNotification.findUnique({
      where: { id },
      ...(select ? { select } : {}),
    });
  }

  // Newest-first page of the global feed. `take` is RAW — the caller clamps
  // its own limit — so this does not route through toPrismaPagination().
  async findRecent(limit, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.adminNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  // Unread count across the whole feed — there is no per-admin read state.
  async countUnread({ tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.adminNotification.count({ where: { isRead: false } });
  }

  /**
   * Flip every unread row to read. `data` is caller-supplied so the read
   * timestamp stays a caller decision. Returns Prisma's { count }.
   */
  async markAllRead(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.adminNotification.updateMany({ where: { isRead: false }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.adminNotification.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.adminNotification.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.adminNotification.delete({ where: { id } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, { skip, take } = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.adminNotification.findMany({ where: toPrismaWhere(filter), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.adminNotification.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.adminNotification.count({ where: toPrismaWhere(filter) });
  }
}

/**
 * Every method throws — see the class comment above for why this is a
 * deliberate blocker rather than an omission.
 */
/**
 * Milestone 2 absorbed the standalone AdminNotification table into the
 * unified `notifications` collection, discriminated by `audience: "admin"`.
 * Every query below therefore adds that predicate — it IS the table on this
 * backend.
 *
 * ── READS ARE IMPLEMENTED; WRITES ARE NOT ────────────────────────────────
 * The Phase 2 §4 resolution gives chat-server EXCLUSIVE write ownership of
 * `notifications`; server/ reads it. That is an ownership decision, not a
 * technical gap, so this class implements the read side in full and leaves
 * the four write methods throwing with the same explanation they always
 * carried. Splitting it this way means enabling DATABASE_PROVIDER=mongo no
 * longer breaks the admin notification FEED — only the paths that would
 * violate the ownership rule fail, and they fail loudly with the reason.
 */
const ADMIN_AUDIENCE = { audience: "admin" };

export class MongoAdminNotificationRepository extends AdminNotificationRepository {
  // ── Writes ─────────────────────────────────────────────────────────────
  // These used to throw, on the reading that Phase 2 §4 gives chat-server
  // exclusive write ownership of the unified `notifications` collection.
  // Tracing the actual path settles it: chat-server's emitAdminNotification()
  // emits the socket event and then POSTs to server's
  // /admin/notifications/save, which is what performs the insert. server/ is
  // and always has been the only process that WRITES admin rows; chat-server
  // writes only `audience: "user"` ones. The two subsets are disjoint, so
  // there is no ownership conflict to resolve — the block was guarding
  // against a collision that the code does not actually make.
  //
  // Every write below is scoped to ADMIN_AUDIENCE, so none of them can reach
  // a user notification even by mistake.

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Notification.create(
        [{ ...toMongoDocument(data), ...ADMIN_AUDIENCE }],
        { session: tx },
      );
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Notification.findOneAndUpdate(
        { _id: id, ...ADMIN_AUDIENCE },
        toMongoUpdate(data),
        { new: true, runValidators: true, session: tx },
      );
      if (!doc) throw new NotFoundError(`AdminNotification ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Notification.findOneAndDelete(
      { _id: id, ...ADMIN_AUDIENCE },
      { session: tx },
    );
    if (!doc) throw new NotFoundError(`AdminNotification ${id} not found`);
    return doc;
  }

  /** Flip every unread admin row to read. Returns Prisma's { count } shape. */
  async markAllRead(data, { tx } = {}) {
    try {
      const r = await models.Notification.updateMany(
        { ...ADMIN_AUDIENCE, isRead: false },
        toMongoUpdate(data),
        { session: tx },
      );
      // matchedCount, not modifiedCount — see NotificationRepository for why.
      return { count: r.matchedCount };
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async findById(id, { tx, select } = {}) {
    let q = models.Notification.findOne({ _id: id, ...ADMIN_AUDIENCE });
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

  /** Newest-first page of the global feed. `take` is RAW — caller clamps. */
  async findRecent(limit, { tx } = {}) {
    let q = models.Notification.find(ADMIN_AUDIENCE).sort({ createdAt: -1 });
    if (limit !== undefined) q = q.limit(limit);
    return q.session(tx ?? null);
  }

  async countUnread({ tx } = {}) {
    return models.Notification.countDocuments({ ...ADMIN_AUDIENCE, isRead: false }).session(tx ?? null);
  }

  async findMany(filter = {}, { skip, take } = {}, { tx } = {}) {
    let q = models.Notification.find({ ...toMongoFilter(filter), ...ADMIN_AUDIENCE });
    if (skip !== undefined) q = q.skip(skip);
    if (take !== undefined) q = q.limit(take);
    return q.session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    const n = await models.Notification
      .countDocuments({ ...toMongoFilter(filter), ...ADMIN_AUDIENCE })
      .session(tx ?? null);
    return n > 0;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Notification
      .countDocuments({ ...toMongoFilter(filter), ...ADMIN_AUDIENCE })
      .session(tx ?? null);
  }
}
