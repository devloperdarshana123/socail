import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError, RepositoryError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toPrismaSearchWhere, toPrismaWhere, toPrismaData, toMongoFilter, toMongoProjection, toMongoSort, toMongoUpdate, toMongoDocument } from "../queryHelpers/index.js";

// See SocialPostRepository — the same closed TO_CHAR → $dateToString map.
const MONGO_DATE_FORMAT = { "YYYY-MM-DD": "%Y-%m-%d", "YYYY-MM": "%Y-%m" };

// A search term is user input; escaping keeps a stray "(" or "." from
// changing the pattern's meaning or throwing. Same rule toMongoFilter
// applies to its `like` operator.
const RE_SPECIALS = /[.*+?^${}()|[\]\\]/g;
const escapeTerm = (v) => String(v).replace(RE_SPECIALS, "\\$&");
import { models } from "../../mongodb/index.js";

// Interface — core identity CRUD. Postgres: User. Mongo: `users`.
//
// The two are now field-for-field equivalent. Milestone 2 had split the Mongo
// side, keeping auth fields here and moving the display half to `profiles`;
// final verification retired that split (see identity.schemas.js for the full
// reasoning). The practical consequence for this file is that every method
// below means the same thing on both backends — `search()` matches username
// OR fullName on both, projections resolve on both, and no method needs to
// rewrite a field name on the way in.
export class UserRepository extends BaseRepository {
  async findByEmail(email, _options) {
    throw new Error(`${this.constructor.name}.findByEmail() not implemented`);
  }

  async findByUsername(username, _options) {
    throw new Error(`${this.constructor.name}.findByUsername() not implemented`);
  }

  async findByPhoneNumber(phoneNumber, _options) {
    throw new Error(`${this.constructor.name}.findByPhoneNumber() not implemented`);
  }

  // Phase 7A addition (server's postHelpers migration) — deliberately
  // unbounded, see the Prisma implementation. Mongo-backed implementation
  // deferred.
  async findAllByRole(role, _options) {
    throw new Error(`${this.constructor.name}.findAllByRole() not implemented`);
  }

  // Phase 7A addition (server's messageHelpers migration) — deliberately
  // unbounded, see the Prisma implementation.
  async findAllByIds(ids, _options) {
    throw new Error(`${this.constructor.name}.findAllByIds() not implemented`);
  }

  // Phase 7A addition (server's userHelpers migration).
  //
  // Contract in DOMAIN terms: "users that have a location set", narrowed by
  // whatever additional conditions the caller supplies. Each backend
  // expresses "has a location" in its own way — Postgres needs Prisma's
  // JsonNull sentinel, Mongo would use `location: { $ne: null }` — so the
  // mechanism stays inside the implementations and never reaches callers.
  async findUsersWithLocation(additionalConditions, _options) {
    throw new Error(`${this.constructor.name}.findUsersWithLocation() not implemented`);
  }

  async searchActiveUsers(term, _options) {
    throw new Error(`${this.constructor.name}.searchActiveUsers() not implemented`);
  }

  async findByFirebaseUid(firebaseUid, _options) {
    throw new Error(`${this.constructor.name}.findByFirebaseUid() not implemented`);
  }

  async findByFirebaseUidOrEmail(firebaseUid, email, _options) {
    throw new Error(`${this.constructor.name}.findByFirebaseUidOrEmail() not implemented`);
  }

  // Phase 7A addition (server's exploreHelpers migration).
  async findFirstWhere(filter, _options) {
    throw new Error(`${this.constructor.name}.findFirstWhere() not implemented`);
  }

  // Phase 7A addition (server's adminUserHelpers migration) — the admin
  // user grid, which owns its own sort, page window and projection.
  // Mongo-backed implementation deferred.
  async findManyOrdered(filter, _options) {
    throw new Error(`${this.constructor.name}.findManyOrdered() not implemented`);
  }

  // Phase 7A additions (server's adminDashboardHelpers migration) — the two
  // raw-SQL analytics reads over the User table. PostgreSQL-specific by
  // necessity; see the Prisma implementations. The Mongo equivalents would
  // be $group aggregation pipelines with $dateToString / $hour, which is a
  // deliberately deferred phase.
  async findNewUsersTimeSeriesRaw(groupFormat, startDate, _options) {
    throw new Error(`${this.constructor.name}.findNewUsersTimeSeriesRaw() not implemented`);
  }

  async findHourlyActiveUsersRaw(since, _options) {
    throw new Error(`${this.constructor.name}.findHourlyActiveUsersRaw() not implemented`);
  }
}

export class PrismaUserRepository extends UserRepository {
  /**
   * @param {object} prismaClient
   * @param {object} [runtime] — Prisma-specific runtime values that this
   *   package cannot import for itself. `shared/` deliberately does NOT
   *   depend on @prisma/client (the client is injected, see the class
   *   comments throughout this layer), but `Prisma.JsonNull` is a singleton
   *   sentinel object reachable only from that package and not from a client
   *   instance. So the composition root — server-side infrastructure wiring
   *   that legitimately imports Prisma, alongside config/prisma.js and
   *   config/transaction.js — supplies it here.
   * @param {object} [runtime.jsonNull] — Prisma.JsonNull, required only by
   *   findUsersWithLocation().
   */
  constructor(prismaClient, runtime = {}) {
    super();
    this.jsonNull = runtime.jsonNull;
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.user.findUnique({ where: { id }, ...(select ? { select } : {}) });
  }

  async findByEmail(email, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.user.findUnique({ where: { email }, ...(select ? { select } : {}) });
  }

  async findByUsername(username, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.user.findUnique({ where: { username } });
  }

  /**
   * Users that have a location set, narrowed by caller-supplied conditions.
   *
   * "Has a location" is expressed here with Prisma's JsonNull sentinel,
   * which is why it is injected (see the constructor). Callers pass only
   * plain conditions and never touch the sentinel — that is the whole point
   * of this method existing rather than exposing the predicate.
   *
   * `take` and `select` stay caller-owned, matching the projection/pagination
   * ownership convention used throughout the Phase 7A migration.
   */
  async findUsersWithLocation(additionalConditions = [], { tx, select, take } = {}) {
    if (!this.jsonNull) {
      throw new Error(
        "PrismaUserRepository.findUsersWithLocation() requires the Prisma.JsonNull " +
          "sentinel — construct the repository with { jsonNull: Prisma.JsonNull }."
      );
    }
    const client = tx ?? this.prismaClient;
    return client.user.findMany({
      where: {
        // The JsonNull predicate is built HERE, in Prisma's own vocabulary —
        // it is the repository's private mechanism for "has a location" and
        // never passes through the neutral DSL. The caller's conditions do.
        AND: [
          { NOT: { location: { equals: this.jsonNull } } },
          ...additionalConditions.map((c) => toPrismaWhere(c)),
        ],
      },
      ...(select ? { select } : {}),
      take,
    });
  }

  // searchUsers: active, non-admin users matching a term on username or
  // fullName. Distinct from search() above, which has no status/role filter
  // and uses offset pagination.
  async searchActiveUsers(term, { tx, select, take } = {}) {
    const client = tx ?? this.prismaClient;
    return client.user.findMany({
      where: {
        accountStatus: "active",
        role: { not: "super_admin" },
        OR: [
          { username: { contains: term, mode: "insensitive" } },
          { fullName: { contains: term, mode: "insensitive" } },
        ],
      },
      take,
      ...(select ? { select } : {}),
    });
  }

  async findByFirebaseUid(firebaseUid, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.user.findUnique({ where: { firebaseUid } });
  }

  /**
   * Read with CALLER-OWNED filter, ordering, page window and projection.
   *
   * Distinct from findMany() below, which routes through toPrismaPagination()
   * — that would cap `take` at 20 and silently truncate the admin user grid,
   * whose page size is chosen per-request and echoed back to the client. Here
   * `skip`/`take` are forwarded RAW.
   *
   * The projection is passed through verbatim, including Prisma relation
   * aggregates (`_count`) — the admin list counts each user's visible posts
   * in the same query, and the caller owns that shape.
   */
  async findManyOrdered(filter, { tx, orderBy, skip, take, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.user.findMany({
      where: toPrismaWhere(filter),
      orderBy,
      skip,
      take,
      ...(select ? { select } : {}),
    });
  }

  // Single-row lookup on a caller-assembled filter — the public-profile
  // lookup matches on username PLUS visibility predicates, which no
  // single-field finder covers.
  async findFirstWhere(filter, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.user.findFirst({
      where: toPrismaWhere(filter),
      ...(select ? { select } : {}),
    });
  }

  /**
   * New-signup time-series, bucketed by a caller-supplied TO_CHAR format.
   *
   * RAW SQL, moved BYTE-IDENTICAL from adminDashboardHelpers in Phase 7A —
   * not rewritten, not optimized, not re-parameterized, not replaced with
   * Prisma. Prisma's groupBy cannot truncate a timestamp to a day/month
   * bucket, which is why this is raw at all.
   *
   * USES $queryRawUnsafe DELIBERATELY, PRESERVED AS-IS: `groupFormat` is
   * interpolated into the SQL string (Prisma has no way to bind a TO_CHAR
   * format as a parameter), while `startDate` IS bound, as $1. Callers pass
   * groupFormat from a closed set ('YYYY-MM-DD' | 'YYYY-MM'), never user
   * input. Hardening this is a flagged, deliberately deferred follow-up —
   * Phase 7A moves ownership only.
   *
   * PostgreSQL-specific: TO_CHAR, AT TIME ZONE, ::int.
   */
  async findNewUsersTimeSeriesRaw(groupFormat, startDate, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.$queryRawUnsafe(`
    SELECT
      TO_CHAR("createdAt" AT TIME ZONE 'UTC', '${groupFormat}') AS label,
      COUNT(*)::int AS "newUsers"
    FROM "User"
    WHERE role != 'super_admin'
      AND "createdAt" >= $1
    GROUP BY label
    ORDER BY label ASC
  `, startDate);
  }

  /**
   * Active-user counts bucketed by hour of day.
   *
   * RAW SQL, moved BYTE-IDENTICAL from adminDashboardHelpers in Phase 7A.
   * Uses $queryRaw's tagged template, so `${since}` stays a bound parameter.
   * PostgreSQL-specific: EXTRACT(HOUR FROM ... AT TIME ZONE), ::int —
   * none of which Prisma can express.
   */
  async findHourlyActiveUsersRaw(since, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.$queryRaw`
    SELECT
      EXTRACT(HOUR FROM "lastActiveAt" AT TIME ZONE 'UTC')::int AS hour,
      COUNT(*)::int AS users
    FROM "User"
    WHERE role != 'super_admin'
      AND "lastActiveAt" >= ${since}
    GROUP BY hour
    ORDER BY hour ASC
  `;
  }

  // googleAuth: match an existing account on EITHER identifier.
  async findByFirebaseUidOrEmail(firebaseUid, email, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.user.findFirst({
      where: { OR: [{ firebaseUid }, { email }] },
    });
  }

  // Existence check across a supplied id set. DELIBERATELY UNBOUNDED — the
  // caller compares the returned count against the requested list to decide
  // whether every id was real, so a silent cap would make a valid request
  // look like it contained non-existent users.
  async findAllByIds(ids, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.user.findMany({
      where: { id: { in: ids } },
      ...(select ? { select } : {}),
    });
  }

  // Every user holding a role. DELIBERATELY UNBOUNDED — the caller
  // subtracts this whole set from a feed's author list, so a silent
  // pagination cap would let excluded authors leak back into the feed.
  // (findMany() would cap at toPrismaPagination()'s default of 20.)
  async findAllByRole(role, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.user.findMany({
      where: { role },
      ...(select ? { select } : {}),
    });
  }

  async findByPhoneNumber(phoneNumber, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.user.findUnique({ where: { phoneNumber } });
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.user.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.user.update({
        where: { id },
        data: toPrismaData(data),
        ...(select ? { select } : {}),
      });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.user.delete({ where: { id } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.user.findMany({ where: toPrismaWhere(filter), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.user.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.user.count({ where: toPrismaWhere(filter) });
  }

  async search(term, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    const where = toPrismaSearchWhere(term, ["username", "fullName"]);
    return client.user.findMany({ where, skip, take });
  }
}


export class MongoUserRepository extends UserRepository {
  async findById(id, { tx } = {}) {
    return models.User.findById(id).session(tx ?? null);
  }

  async findByEmail(email, { tx } = {}) {
    return models.User.findOne({ email }).session(tx ?? null);
  }

  async findByUsername(username, { tx } = {}) {
    return models.User.findOne({ username }).session(tx ?? null);
  }

  async findByPhoneNumber(phoneNumber, { tx } = {}) {
    return models.User.findOne({ phoneNumber }).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.User.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.User.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`User ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.User.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`User ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.User.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.User.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.User.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }

  async search(term, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    // username OR fullName, matching the Prisma implementation. Both
    // fields are on `users` now, so the asymmetry the class comment used
    // to record is gone.
    const rx = { $regex: escapeTerm(term), $options: "i" };
    return models.User
      .find({ $or: [{ username: rx }, { fullName: rx }] })
      .skip(skip)
      .limit(limit)
      .session(tx ?? null);
  }

  /**
   * "Users that have a location set", narrowed by caller conditions.
   *
   * Postgres needs Prisma's JsonNull sentinel to express this; Mongo says it
   * directly. That divergence is exactly why the method exists as a DOMAIN
   * contract instead of exposing the predicate to callers.
   *
   * This used to throw. Milestone 2 had moved `location` off the users
   * collection into `locations`/`companies`, neither of which any code ever
   * read, so there was no field to test and no owner for a seller's pin.
   * `location` is back on the user document (see identity.schemas.js), where
   * Postgres has always kept it, and the predicate is a plain one again.
   *
   * `$ne: null` also excludes MISSING, which is what Prisma's
   * `NOT: { location: { equals: JsonNull } }` does — a user who never set a
   * location has no key at all here and a JSON null there.
   */
  async findUsersWithLocation(additionalConditions = [], { tx, select, take } = {}) {
    const filter = {
      location: { $ne: null },
      ...(additionalConditions.length
        ? { $and: additionalConditions.map((c) => toMongoFilter(c)) }
        : {}),
    };
    let q = models.User.find(filter);
    if (take !== undefined) q = q.limit(take);
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

  /** Matches username OR fullName on both backends. */
  async searchActiveUsers(term, { tx, select, take } = {}) {
    const rx = { $regex: escapeTerm(term), $options: "i" };
    let q = models.User.find({
      accountStatus: "active",
      role: { $ne: "super_admin" },
      $or: [{ username: rx }, { fullName: rx }],
    });
    if (take !== undefined) q = q.limit(take);
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

  async findByFirebaseUid(firebaseUid, { tx } = {}) {
    return models.User.findOne({ firebaseUid }).session(tx ?? null);
  }

  async findByFirebaseUidOrEmail(firebaseUid, email, { tx } = {}) {
    return models.User.findOne({ $or: [{ firebaseUid }, { email }] }).session(tx ?? null);
  }

  async findManyOrdered(filter, { tx, orderBy, skip, take, select } = {}) {
    let q = models.User.find(toMongoFilter(filter));
    if (orderBy) q = q.sort(toMongoSort(orderBy));
    if (skip !== undefined) q = q.skip(skip);
    if (take !== undefined) q = q.limit(take);
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

  async findFirstWhere(filter, { tx, select } = {}) {
    let q = models.User.findOne(toMongoFilter(filter));
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

  /** DELIBERATELY UNBOUNDED — see the Prisma implementations. */
  async findAllByIds(ids, { tx, select } = {}) {
    let q = models.User.find({ _id: { $in: ids } });
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

  async findAllByRole(role, { tx, select } = {}) {
    let q = models.User.find({ role });
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

  /**
   * M-6: new-signup time series. $dateToString replaces TO_CHAR, so no raw
   * query is needed — and `groupFormat` is MAPPED from a closed set rather
   * than interpolated, removing the $queryRawUnsafe surface the Postgres
   * implementation still carries.
   */
  async findNewUsersTimeSeriesRaw(groupFormat, startDate, { tx } = {}) {
    return models.User.aggregate([
      { $match: { role: { $ne: "super_admin" }, createdAt: { $gte: startDate } } },
      { $group: {
          _id: { $dateToString: { format: MONGO_DATE_FORMAT[groupFormat] ?? "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
          newUsers: { $sum: 1 },
      } },
      { $project: { _id: 0, label: "$_id", newUsers: 1 } },
      { $sort: { label: 1 } },
    ]).session(tx ?? null);
  }

  /** M-6: active users bucketed by hour. $hour replaces EXTRACT(HOUR …). */
  async findHourlyActiveUsersRaw(since, { tx } = {}) {
    return models.User.aggregate([
      { $match: { role: { $ne: "super_admin" }, lastActiveAt: { $gte: since } } },
      { $group: { _id: { $hour: { date: "$lastActiveAt", timezone: "UTC" } }, users: { $sum: 1 } } },
      { $project: { _id: 0, hour: "$_id", users: 1 } },
      { $sort: { hour: 1 } },
    ]).session(tx ?? null);
  }
}
