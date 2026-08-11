import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaWhere, toPrismaData, toMongoFilter, toMongoUpdate, toMongoDocument } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — one-time-code persistence. Postgres: OTP model (Prisma
// client property is `oTP` — Prisma lowercases only the model name's first
// letter). Mongo: the `otps` collection. `search()` not implemented — no
// product meaning for OTP records.
export class OtpRepository extends BaseRepository {
  async findActiveByUserAndPurpose(userId, purpose, _options) {
    throw new Error(`${this.constructor.name}.findActiveByUserAndPurpose() not implemented`);
  }

  // Phase 7A additions (server's otpHelpers migration). Mongo-backed
  // implementations deferred.
  //
  // NOTE on findActiveByUserAndPurpose above: it filters BOTH `isUsed: false`
  // AND `expiresAt > now`. otpHelpers deliberately does NOT want the expiry
  // predicate — verification has to be able to SEE an expired row so it can
  // report "OTP has expired" (and delete it) rather than the misleading "OTP
  // not found or already used". The two methods below preserve that.
  async findByUserAndPurpose(userId, purpose, _options) {
    throw new Error(`${this.constructor.name}.findByUserAndPurpose() not implemented`);
  }

  async findFirstWhere(filter, _options) {
    throw new Error(`${this.constructor.name}.findFirstWhere() not implemented`);
  }

  async upsertByUserAndPurpose(userId, purpose, payload, _options) {
    throw new Error(`${this.constructor.name}.upsertByUserAndPurpose() not implemented`);
  }

  async deleteManyWhere(filter, _options) {
    throw new Error(`${this.constructor.name}.deleteManyWhere() not implemented`);
  }
}

export class PrismaOtpRepository extends OtpRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.oTP.findUnique({ where: { id } });
  }

  async findActiveByUserAndPurpose(userId, purpose, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.oTP.findFirst({
      where: { userId, purpose, isUsed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * The OTP row for a (userId, purpose) pair in ANY state — used, expired or
   * live. Deliberately distinct from findActiveByUserAndPurpose(), which
   * excludes both; resend guards and status reporting need to see rows that
   * method would hide.
   */
  async findByUserAndPurpose(userId, purpose, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.oTP.findUnique({ where: { userId_purpose: { userId, purpose } } });
  }

  /**
   * Single-row lookup on a caller-assembled filter. Verification uses
   * `{ userId, purpose, isUsed: false }` with NO expiry predicate, so an
   * expired OTP is still found and can be reported as expired rather than
   * missing.
   */
  async findFirstWhere(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.oTP.findFirst({ where: toPrismaWhere(filter) });
  }

  /**
   * Idempotent write on the (userId, purpose) compound key. `payload` is
   * `{ update, create }`, matching Prisma's upsert shape — re-issuing an OTP
   * replaces the existing row instead of failing on the unique constraint.
   */
  async upsertByUserAndPurpose(userId, purpose, { update, create }, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.oTP.upsert({
        where: { userId_purpose: { userId, purpose } },
        update: toPrismaData(update),
        create: toPrismaData(create),
      });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  /** Bulk delete over a caller-supplied filter. Returns Prisma's { count }. */
  async deleteManyWhere(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.oTP.deleteMany({ where: toPrismaWhere(filter) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.oTP.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.oTP.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.oTP.delete({ where: { id } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, { skip, take } = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.oTP.findMany({ where: toPrismaWhere(filter), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.oTP.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.oTP.count({ where: toPrismaWhere(filter) });
  }
}

export class MongoOtpRepository extends OtpRepository {
  async findById(id, { tx } = {}) {
    return models.Otp.findById(id).session(tx ?? null);
  }

  async findActiveByUserAndPurpose(userId, purpose, { tx } = {}) {
    return models.Otp
      .findOne({ userId, purpose, isUsed: false, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Otp.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Otp.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Otp ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Otp.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Otp ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, { skip, limit } = {}, { tx } = {}) {
    return models.Otp.find(toMongoFilter(filter)).skip(skip ?? 0).limit(limit ?? 20).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Otp.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Otp.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
  async findByUserAndPurpose(userId, purpose, { tx } = {}) {
    return models.Otp.findOne({ userId, purpose }).session(tx ?? null);
  }

  async findFirstWhere(filter, { tx } = {}) {
    return models.Otp.findOne(toMongoFilter(filter)).session(tx ?? null);
  }

  /**
   * Prisma's compound-key upsert. Mongo's equivalent is findOneAndUpdate
   * with upsert:true — but the two payloads differ: Prisma has separate
   * update/create branches, Mongo has one document. `$setOnInsert` carries
   * the create-only fields so an existing row is updated exactly as the
   * Prisma `update` branch would, and a new row gets the `create` branch.
   */
  async upsertByUserAndPurpose(userId, purpose, { update, create }, { tx } = {}) {
    try {
      const u = toMongoUpdate(update);
      const c = toMongoUpdate(create).$set ?? {};
      // Never $setOnInsert a field the update branch already $sets — Mongo
      // rejects that as a conflicting path.
      // Exclude every field the update branch touches under ANY operator
      // ($set, $inc, $push …) — Mongo rejects a path that appears in both an
      // update operator and $setOnInsert.
      const touched = new Set(Object.values(u).flatMap((o) => Object.keys(o ?? {})));
      const onInsert = Object.fromEntries(
        Object.entries({ userId, purpose, ...c }).filter(([k]) => !touched.has(k))
      );
      return await models.Otp.findOneAndUpdate(
        { userId, purpose },
        { ...u, ...(Object.keys(onInsert).length ? { $setOnInsert: onInsert } : {}) },
        { upsert: true, new: true, runValidators: true, session: tx },
      );
    } catch (err) { throw normalizeMongoError(err); }
  }

  async deleteManyWhere(filter, { tx } = {}) {
    try {
      const r = await models.Otp.deleteMany(toMongoFilter(filter), { session: tx });
      return { count: r.deletedCount };
    } catch (err) { throw normalizeMongoError(err); }
  }

}
