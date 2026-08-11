import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toPrismaSearchWhere, toMongoSearchFilter, withNotDeleted, toPrismaWhere, toPrismaData, fromPrismaSum, toMongoFilter, toMongoUpdate, toMongoProjection, toMongoSort, fromMongoSum, toMongoDocument, splitRelationFilter, toAggregateProjection, relationPipeline } from "../queryHelpers/index.js";

// TO_CHAR patterns (Postgres) → $dateToString formats (Mongo). Mapping the
// closed set rather than interpolating also removes the $queryRawUnsafe
// injection surface the Postgres implementation still carries.
const MONGO_DATE_FORMAT = { "YYYY-MM-DD": "%Y-%m-%d", "YYYY-MM": "%Y-%m" };
import { models } from "../../mongodb/index.js";

// Interface — feed posts. Postgres: Post model. Mongo: `socialPosts`
// (Milestone 2). `delete()` is a soft delete on both backends, matching
// each schema's isDeleted/deletedAt fields — neither implementation
// hard-deletes a post row/document.
export class SocialPostRepository extends BaseRepository {
  async findByAuthorId(authorId, _options) {
    throw new Error(`${this.constructor.name}.findByAuthorId() not implemented`);
  }

  // Phase 7A addition (server's settingsHelpers migration) — bulk
  // visibility flips for account deactivation/reactivation. Mongo-backed
  // implementation deferred.
  async updateManyWhere(filter, data, _options) {
    throw new Error(`${this.constructor.name}.updateManyWhere() not implemented`);
  }

  // Phase 7A addition (server's postHelpers migration) — keyset-style feed
  // reads. Distinct from findMany() above, which applies offset pagination
  // and soft-delete scoping and hardcodes its projection.
  async findManyWithCursor(filter, _options) {
    throw new Error(`${this.constructor.name}.findManyWithCursor() not implemented`);
  }

  // Phase 7A addition (server's exploreHelpers migration). Distinct from
  // findManyWithCursor above: explore orders by `id` and uses Prisma's
  // NATIVE cursor + skip:1, not a `createdAt` filter predicate.
  async findManyWithIdCursor(filter, _options) {
    throw new Error(`${this.constructor.name}.findManyWithIdCursor() not implemented`);
  }

  // Phase 7A additions (server's adminDashboardHelpers migration).
  // Mongo-backed implementations deferred — the two raw reads would become
  // $group aggregation pipelines with $dateToString.
  async findManyOrdered(filter, _options) {
    throw new Error(`${this.constructor.name}.findManyOrdered() not implemented`);
  }

  async sumFields(filter, sumSelect, _options) {
    throw new Error(`${this.constructor.name}.sumFields() not implemented`);
  }

  async findPostsByTypeTimeSeriesRaw(groupFormat, startDate, _options) {
    throw new Error(`${this.constructor.name}.findPostsByTypeTimeSeriesRaw() not implemented`);
  }

  async findEngagementTimeSeriesRaw(startDate, _options) {
    throw new Error(`${this.constructor.name}.findEngagementTimeSeriesRaw() not implemented`);
  }

  // Phase 7A addition (server's adminUserHelpers migration) — the admin
  // post-deletion lookup, which matches on id PLUS a visibility predicate
  // and needs the author relation in the same read.
  async findFirstWhere(filter, _options) {
    throw new Error(`${this.constructor.name}.findFirstWhere() not implemented`);
  }
}

export class PrismaSocialPostRepository extends SocialPostRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx, includeDeleted = false, select } = {}) {
    const client = tx ?? this.prismaClient;
    const post = await client.post.findUnique({ where: { id }, ...(select ? { select } : {}) });
    return !includeDeleted && post?.isDeleted ? null : post;
  }

  async findByAuthorId(authorId, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.post.findMany({
      where: withNotDeleted({ authorId }),
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
  }

  /**
   * @param {object} [options]
   * @param {object} [options.include] — relations to attach to the created
   *   row (e.g. its author). Mutually exclusive with `select`, per Prisma.
   * @param {object} [options.select] — projection for the created row.
   *   Omitting both returns the whole row, as before.
   */
  async create(data, { tx, include, select } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.post.create({
        data: toPrismaData(data),
        ...(select ? { select } : include ? { include } : {}),
      });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  /** Same `include` / `select` options as create(). */
  async update(id, data, { tx, include, select } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.post.update({
        where: { id },
        data: toPrismaData(data),
        ...(select ? { select } : include ? { include } : {}),
      });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  /**
   * Cursor-paginated read for the feed / profile / drafts lists.
   *
   * The filter is passed through VERBATIM — no soft-delete scoping — because
   * callers assemble their own isDeleted/isDraft/visibility predicates (the
   * drafts list, for instance, needs isDraft: true).
   *
   * `take` is likewise raw, NOT routed through toPrismaPagination(): callers
   * pass `limit + 1` and use the extra row to compute hasMore, so a
   * normalized/defaulted limit would break their pagination math.
   */
  async findManyWithCursor(filter, { tx, take, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.post.findMany({
      where: toPrismaWhere(filter),
      orderBy: { createdAt: "desc" },
      take,
      ...(select ? { select } : {}),
    });
  }

  /** Soft delete — sets isDeleted/deletedAt, does not remove the row. */
  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.post.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  /**
   * Bulk field update over a caller-supplied filter. The filter is passed
   * through VERBATIM — no soft-delete scoping is applied, because callers
   * use this precisely to flip isDeleted in both directions.
   * Returns Prisma's { count } batch payload.
   */
  async updateManyWhere(filter, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.post.updateMany({ where: toPrismaWhere(filter), data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  /**
   * Explore-style read: filter and projection pass through VERBATIM, ordered
   * by `id` desc, using Prisma's NATIVE cursor pagination (`cursor` + skip:1)
   * rather than a comparison predicate. `take` is raw (callers pass
   * `limit + 1` to detect hasMore themselves).
   */
  async findManyWithIdCursor(filter, { tx, take, cursor, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.post.findMany({
      where: toPrismaWhere(filter),
      orderBy: { id: "desc" },
      take,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      ...(select ? { select } : {}),
    });
  }

  /**
   * Read with caller-owned multi-field ordering, page window, limit and
   * projection, and a VERBATIM filter. Distinct from the two cursor readers
   * above, which each hardcode a single sort key — the top-posts widget ranks
   * by viewsCount then likesCount, which neither can express.
   *
   * `skip` is optional and forwarded RAW (Phase 7A Milestone 16 addition for
   * the admin post grids, which page by offset). Callers that omit it — such
   * as the top-posts widget — pass `skip: undefined`, which Prisma treats
   * exactly as an absent key, so their behaviour is unchanged.
   */
  async findManyOrdered(filter, { tx, orderBy, skip, take, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.post.findMany({
      where: toPrismaWhere(filter),
      orderBy,
      skip,
      take,
      ...(select ? { select } : {}),
    });
  }

  /**
   * Single-row lookup on a caller-assembled filter, with optional relations.
   *
   * Distinct from findById(), which matches on the primary key and applies
   * its own soft-delete scoping — the admin delete-post lookup carries its
   * own `isDeleted: false` predicate and needs the author's counters in the
   * same read, so the filter passes through VERBATIM.
   */
  async findFirstWhere(filter, { tx, select, include } = {}) {
    const client = tx ?? this.prismaClient;
    return client.post.findFirst({
      where: toPrismaWhere(filter),
      ...(select ? { select } : include ? { include } : {}),
    });
  }

  /**
   * Numeric aggregation over a caller-supplied filter. `sumSelect` is
   * Prisma's `_sum` shape (e.g. `{ likesCount: true }`); the whole aggregate
   * envelope is returned so the caller keeps its own null-coalescing.
   * The filter passes through VERBATIM — no soft-delete scoping.
   */
  async sumFields(filter, sumSelect, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const agg = await client.post.aggregate({
      where: toPrismaWhere(filter),
      _sum: sumSelect,
    });
    return fromPrismaSum(agg);
  }

  /**
   * Post-count time-series split by post type.
   *
   * RAW SQL, moved BYTE-IDENTICAL from adminDashboardHelpers in Phase 7A.
   * USES $queryRawUnsafe DELIBERATELY, PRESERVED AS-IS: `groupFormat` is
   * interpolated (Prisma cannot bind a TO_CHAR format), `startDate` is bound
   * as $1. Callers pass groupFormat from a closed set, never user input.
   * Hardening is a flagged, deferred follow-up.
   *
   * PostgreSQL-specific: TO_CHAR, AT TIME ZONE, ::int. Prisma's groupBy
   * cannot truncate a timestamp into a bucket, hence raw.
   */
  async findPostsByTypeTimeSeriesRaw(groupFormat, startDate, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.$queryRawUnsafe(`
    SELECT
      TO_CHAR("createdAt" AT TIME ZONE 'UTC', '${groupFormat}') AS label,
      type,
      COUNT(*)::int AS count
    FROM "Post"
    WHERE "isDeleted" = false
      AND "createdAt" >= $1
    GROUP BY label, type
    ORDER BY label ASC
  `, startDate);
  }

  /**
   * Daily engagement sums (likes / comments / views).
   *
   * RAW SQL, moved BYTE-IDENTICAL from adminDashboardHelpers in Phase 7A.
   * Uses $queryRaw's tagged template, so `${startDate}` stays bound.
   * PostgreSQL-specific: TO_CHAR, AT TIME ZONE, SUM(...)::int. Prisma's
   * aggregate cannot group by a truncated date, hence raw.
   */
  async findEngagementTimeSeriesRaw(startDate, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.$queryRaw`
    SELECT
      TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS label,
      SUM("likesCount")::int    AS likes,
      SUM("commentsCount")::int AS comments,
      SUM("viewsCount")::int    AS views
    FROM "Post"
    WHERE "isDeleted" = false
      AND "createdAt" >= ${startDate}
    GROUP BY label
    ORDER BY label ASC
  `;
  }

  async findMany(filter = {}, pagination = {}, { tx, includeDeleted = false } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.post.findMany({
      where: toPrismaWhere(includeDeleted ? filter : withNotDeleted(filter)),
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.post.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx, includeDeleted = false } = {}) {
    const client = tx ?? this.prismaClient;
    return client.post.count({ where: toPrismaWhere(includeDeleted ? filter : withNotDeleted(filter)) });
  }

  async search(term, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    const where = { ...withNotDeleted({}), ...toPrismaSearchWhere(term, ["caption"]) };
    return client.post.findMany({ where, orderBy: { createdAt: "desc" }, skip, take });
  }
}

export class MongoSocialPostRepository extends SocialPostRepository {
  async findById(id, { tx, includeDeleted = false, select } = {}) {
    // `include`/`select` used to be dropped here: the signature did not even
    // accept them, so the caller's author/sender block came back undefined on
    // Mongo while Postgres returned it. Populating the relation ALIAS (see the
    // schema's virtuals) puts the joined document where the caller looks.
    let q = models.SocialPost.findById(id);
    if (select?.author) {
      q = q.populate({
        path: "author",
        ...(select.author?.select ? { select: toMongoProjection(select.author.select) } : {}),
      });
      const scalars = toMongoProjection(select);
      if (scalars) q = q.select(`${scalars} authorId`);
    } else if (select) {
      q = q.select(toMongoProjection(select));
    }
    const doc = await q.session(tx ?? null);
    return !includeDeleted && doc?.isDeleted ? null : doc;
  }

  async findByAuthorId(authorId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.SocialPost
      .find(withNotDeleted({ authorId }))
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .session(tx ?? null);
  }

  async create(data, { tx, include } = {}) {
    try {
      const [doc] = await models.SocialPost.create([toMongoDocument(data)], { session: tx });
      if (include?.author) {
        await doc.populate({
          path: "author",
          ...(include.author?.select ? { select: toMongoProjection(include.author.select) } : {}),
        });
      }
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx, include } = {}) {
    try {
      const doc = await models.SocialPost.findByIdAndUpdate(id, toMongoUpdate(data), {
        new: true, runValidators: true, session: tx,
      });
      if (!doc) throw new NotFoundError(`SocialPost ${id} not found`);
      if (include?.author) {
        await doc.populate({
          path: "author",
          ...(include.author?.select ? { select: toMongoProjection(include.author.select) } : {}),
        });
      }
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  /** Soft delete — sets isDeleted/deletedAt, does not remove the document. */
  async delete(id, { tx } = {}) {
    const doc = await models.SocialPost.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true, session: tx }
    );
    if (!doc) throw new NotFoundError(`SocialPost ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx, includeDeleted = false } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    const query = toMongoFilter(includeDeleted ? filter : withNotDeleted(filter));
    return models.SocialPost.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.SocialPost.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx, includeDeleted = false } = {}) {
    const query = toMongoFilter(includeDeleted ? filter : withNotDeleted(filter));
    return models.SocialPost.countDocuments(query).session(tx ?? null);
  }

  async search(term, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    const query = { ...withNotDeleted({}), ...toMongoSearchFilter(term) };
    return models.SocialPost.find(query).skip(skip).limit(limit).session(tx ?? null);
  }

  async findManyWithCursor(filter, { tx, take, select } = {}) {
    const { own, relations } = splitRelationFilter(filter, ["author"]);
    if (!relations.author && !select?.author) {
      let q = models.SocialPost.find(toMongoFilter(own));
      if (take !== undefined) q = q.limit(take);
      if (select) q = q.select(toMongoProjection(select));
      return q.session(tx ?? null);
    }
    // The feed renders each post with its author. Same shared relation
    // pipeline explore uses — see queryHelpers/relations.js.
    return models.SocialPost.aggregate(relationPipeline({
      match: toMongoFilter(own),
      relations: [{ as: "author", from: "users", localField: "authorId", filter: relations.author }],
      limit: take,
      project: toAggregateProjection(select, ["author"]),
    })).session(tx ?? null);
  }

  async updateManyWhere(filter, data, { tx } = {}) {
    try {
      const r = await models.SocialPost.updateMany(toMongoFilter(filter), toMongoUpdate(data), { session: tx });
      return { count: r.matchedCount };
    } catch (err) { throw normalizeMongoError(err); }
  }

  /**
   * Postgres uses Prisma's NATIVE cursor (`cursor` + skip:1) over `id desc`.
   * Mongo has no cursor primitive, so the equivalent is `_id < cursor` over
   * the same ordering — which is what the native cursor compiles to anyway.
   */
  async findManyWithIdCursor(filter, { tx, take, cursor, select } = {}) {
    const { own, relations } = splitRelationFilter(filter, ["author"]);
    const match = { ...toMongoFilter(own), ...(cursor ? { _id: { $lt: cursor } } : {}) };

    // No author predicate and no author projection → an ordinary find, which
    // stays cheaper and keeps returning mongoose documents.
    if (!relations.author && !select?.author) {
      let q = models.SocialPost.find(match).sort({ _id: -1 });
      if (take !== undefined) q = q.limit(take);
      if (select) q = q.select(toMongoProjection(select));
      return q.session(tx ?? null);
    }

    // Otherwise the author has to be joined — see queryHelpers/relations.js
    // for why populate() cannot do this and why the stage order matters.
    const pipeline = relationPipeline({
      match,
      sort: { _id: -1 },
      relations: [{
        as: "author", from: "users", localField: "authorId",
        filter: relations.author,
      }],
      limit: take,
      project: toAggregateProjection(select, ["author"]),
    });
    return models.SocialPost.aggregate(pipeline).session(tx ?? null);
  }

  async findManyOrdered(filter, { tx, orderBy, skip, take, select } = {}) {
    const { own, relations } = splitRelationFilter(filter, ["author"]);
    if (!relations.author && !select?.author) {
      let q = models.SocialPost.find(toMongoFilter(own));
      if (orderBy) q = q.sort(toMongoSort(orderBy));
      if (skip !== undefined) q = q.skip(skip);
      if (take !== undefined) q = q.limit(take);
      if (select) q = q.select(toMongoProjection(select));
      return q.session(tx ?? null);
    }
    const pipeline = relationPipeline({
      match: toMongoFilter(own),
      sort: orderBy ? toMongoSort(orderBy) : undefined,
      relations: [{
        as: "author", from: "users", localField: "authorId",
        filter: relations.author,
      }],
      skip,
      limit: take,
      project: toAggregateProjection(select, ["author"]),
    });
    return models.SocialPost.aggregate(pipeline).session(tx ?? null);
  }

  /** M-10: `include: { author: { select } }` → populate with a projection. */
  async findFirstWhere(filter, { tx, select, include } = {}) {
    let q = models.SocialPost.findOne(toMongoFilter(filter));
    if (select) q = q.select(toMongoProjection(select));
    else if (include?.author) {
      q = q.populate({
        path: "author",
        ...(include.author?.select ? { select: toMongoProjection(include.author.select) } : {}),
      });
    }
    return q.session(tx ?? null);
  }

  /** M-4: neutral bare-sums object; null preserved for an empty match. */
  async sumFields(filter, sumSelect, { tx } = {}) {
    const fields = Object.keys(sumSelect ?? {});
    const group = { _id: null };
    for (const f of fields) group[f] = { $sum: `$${f}` };
    const rows = await models.SocialPost.aggregate([
      { $match: toMongoFilter(filter) },
      { $group: group },
    ]).session(tx ?? null);
    return fromMongoSum(rows[0], fields);
  }

  /**
   * M-6: per-type post counts bucketed by day/month.
   *
   * The Postgres version is raw SQL because Prisma cannot truncate a
   * timestamp. Mongo expresses the same thing natively with $dateToString,
   * so no raw query is needed at all. `groupFormat` arrives as a TO_CHAR
   * pattern ('YYYY-MM-DD' | 'YYYY-MM') and is MAPPED to the equivalent Mongo
   * format rather than interpolated — which also removes the
   * $queryRawUnsafe injection surface the Postgres side still carries.
   * The ::int cast is unnecessary: $sum already yields an integer.
   */
  async findPostsByTypeTimeSeriesRaw(groupFormat, startDate, { tx } = {}) {
    return models.SocialPost.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: {
          _id: {
            label: { $dateToString: { format: MONGO_DATE_FORMAT[groupFormat] ?? "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
            type: "$type",
          },
          count: { $sum: 1 },
      } },
      { $project: { _id: 0, label: "$_id.label", type: "$_id.type", count: 1 } },
      { $sort: { label: 1 } },
    ]).session(tx ?? null);
  }

  /** M-6: daily likes/comments/views sums. Same reasoning as above. */
  async findEngagementTimeSeriesRaw(startDate, { tx } = {}) {
    return models.SocialPost.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
          likes: { $sum: "$likesCount" },
          comments: { $sum: "$commentsCount" },
          views: { $sum: "$viewsCount" },
      } },
      { $project: { _id: 0, label: "$_id", likes: 1, comments: 1, views: 1 } },
      { $sort: { label: 1 } },
    ]).session(tx ?? null);
  }
}
