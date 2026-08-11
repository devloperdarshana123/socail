import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, withNotDeleted, toPrismaWhere, toPrismaData, toMongoFilter, toMongoUpdate, toMongoProjection, toMongoSort, toMongoDocument, splitRelationFilter, toAggregateProjection, relationPipeline } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — threaded comments. Postgres: Comment model. Mongo:
// `comments`. `search()` not implemented — comment search has no product
// requirement today; add it the same way SocialPostRepository does if
// that changes.
export class CommentRepository extends BaseRepository {
  async findByPostId(postId, _options) {
    throw new Error(`${this.constructor.name}.findByPostId() not implemented`);
  }

  // Phase 7A additions (server's commentHelpers migration). Distinct from
  // findByPostId/findMany above, which apply soft-delete scoping, offset
  // pagination and a fixed ordering. Mongo-backed implementations deferred.
  async findFirstWhere(filter, _options) {
    throw new Error(`${this.constructor.name}.findFirstWhere() not implemented`);
  }

  async findManyWithCursor(filter, _options) {
    throw new Error(`${this.constructor.name}.findManyWithCursor() not implemented`);
  }

  async findAllWhere(filter, _options) {
    throw new Error(`${this.constructor.name}.findAllWhere() not implemented`);
  }

  async updateManyWhere(filter, data, _options) {
    throw new Error(`${this.constructor.name}.updateManyWhere() not implemented`);
  }

  async deleteManyWhere(filter, _options) {
    throw new Error(`${this.constructor.name}.deleteManyWhere() not implemented`);
  }
}

export class PrismaCommentRepository extends CommentRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.comment.findUnique({ where: { id }, ...(select ? { select } : {}) });
  }

  async findByPostId(postId, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.comment.findMany({
      where: withNotDeleted({ postId }),
      orderBy: { createdAt: "asc" },
      skip,
      take,
    });
  }

  async create(data, { tx, include } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.comment.create({ data: toPrismaData(data), ...(include ? { include } : {}) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  // Single-row lookup on a caller-assembled filter (e.g. "the pinned,
  // active, non-deleted comment on this post"). `select` and `include` are
  // mutually exclusive, per Prisma; omitting both returns the whole row.
  async findFirstWhere(filter, { tx, select, include } = {}) {
    const client = tx ?? this.prismaClient;
    return client.comment.findFirst({
      where: toPrismaWhere(filter),
      ...(select ? { select } : include ? { include } : {}),
    });
  }

  /**
   * Cursor-paginated thread read.
   *
   * Filter, `orderBy` AND `take` are all caller-owned and pass through
   * VERBATIM: the three comment lists use three different orderings (one
   * leads with isPinned) and three different projections, and each passes
   * `limit + 1` to compute its own hasMore/nextCursor. Routing any of this
   * through findMany() would impose a fixed ordering, a soft-delete scope
   * and a 20-row cap.
   */
  async findManyWithCursor(filter, { tx, orderBy, take, skip, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.comment.findMany({
      where: toPrismaWhere(filter),
      ...(orderBy ? { orderBy } : {}),
      take,
      skip,
      ...(select ? { select } : {}),
    });
  }

  /**
   * Every row matching the filter. DELIBERATELY UNBOUNDED — the caller is
   * collecting a whole comment subtree for deletion, and a silent page cap
   * would orphan the rest of it.
   */
  async findAllWhere(filter, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.comment.findMany({
      where: toPrismaWhere(filter),
      ...(select ? { select } : {}),
    });
  }

  /**
   * `include` is caller-owned: the admin moderation update returns the row
   * with its author block so the response can render it without a second
   * read. Omitting it returns the bare row.
   */
  async update(id, data, { tx, include } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.comment.update({
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
      return await client.comment.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  /** Bulk field update over a caller-supplied filter. Returns { count }. */
  async updateManyWhere(filter, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.comment.updateMany({
        where: toPrismaWhere(filter),
        data: toPrismaData(data),
      });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  /** HARD delete over a caller-supplied filter. Returns { count }. */
  async deleteManyWhere(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.comment.deleteMany({ where: toPrismaWhere(filter) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.comment.findMany({ where: toPrismaWhere(withNotDeleted(filter)), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.comment.count({ where: toPrismaWhere(filter) })) > 0;
  }

  /**
   * Soft-delete scoped BY DEFAULT — a bare count() means "live comments".
   * The admin grid opts out with includeDeleted so its totals match the rows
   * it lists.
   */
  async count(filter = {}, { tx, includeDeleted = false } = {}) {
    const client = tx ?? this.prismaClient;
    return client.comment.count({
      where: toPrismaWhere(includeDeleted ? filter : withNotDeleted(filter)),
    });
  }
}

export class MongoCommentRepository extends CommentRepository {
  async findById(id, { tx, select } = {}) {
    let q = models.Comment.findById(id);
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

  async findByPostId(postId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Comment
      .find({ postId, isDeleted: false })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .session(tx ?? null);
  }

  /** M-10: `include: { author: { select } }` becomes a populate. */
  async create(data, { tx, include } = {}) {
    try {
      const [doc] = await models.Comment.create([toMongoDocument(data)], { session: tx });
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
      const doc = await models.Comment.findByIdAndUpdate(id, toMongoUpdate(data), {
        new: true, runValidators: true, session: tx,
      });
      if (!doc) throw new NotFoundError(`Comment ${id} not found`);
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

  /** Soft delete, matching Prisma's isDeleted/deletedAt pair. */
  async delete(id, { tx } = {}) {
    const doc = await models.Comment.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true, session: tx },
    );
    if (!doc) throw new NotFoundError(`Comment ${id} not found`);
    return doc;
  }

  async findFirstWhere(filter, { tx, select, include } = {}) {
    let q = models.Comment.findOne(toMongoFilter(filter));
    if (select) q = q.select(toMongoProjection(select));
    else if (include?.author) {
      q = q.populate({
        path: "author",
        ...(include.author?.select ? { select: toMongoProjection(include.author.select) } : {}),
      });
    }
    return q.session(tx ?? null);
  }

  /**
   * Keyset read. `take` is RAW (callers pass limit + 1 to detect hasMore)
   * and the caller owns the sort, exactly as on Postgres.
   */
  async findManyWithCursor(filter, { tx, orderBy, take, skip, select } = {}) {
    const { own, relations } = splitRelationFilter(filter, ["author"]);
    if (!relations.author && !select?.author) {
      let q = models.Comment.find(toMongoFilter(own));
      if (orderBy) q = q.sort(toMongoSort(orderBy));
      if (skip !== undefined) q = q.skip(skip);
      if (take !== undefined) q = q.limit(take);
      if (select) q = q.select(toMongoProjection(select));
      return q.session(tx ?? null);
    }
    // The comment list renders each row with its author inline. Same shared
    // relation pipeline the feed uses — see queryHelpers/relations.js.
    return models.Comment.aggregate(relationPipeline({
      match: toMongoFilter(own),
      sort: orderBy ? toMongoSort(orderBy) : undefined,
      relations: [{ as: "author", from: "users", localField: "authorId", filter: relations.author }],
      skip, limit: take,
      project: toAggregateProjection(select, ["author"]),
    })).session(tx ?? null);
  }

  /** DELIBERATELY UNBOUNDED — see the Prisma implementation. */
  async findAllWhere(filter, { tx, select } = {}) {
    if (select?.author) {
      return models.Comment.aggregate(relationPipeline({
        match: toMongoFilter(filter),
        relations: [{ as: "author", from: "users", localField: "authorId" }],
        project: toAggregateProjection(select, ["author"]),
      })).session(tx ?? null);
    }
    let q = models.Comment.find(toMongoFilter(filter));
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

  async updateManyWhere(filter, data, { tx } = {}) {
    try {
      const r = await models.Comment.updateMany(toMongoFilter(filter), toMongoUpdate(data), { session: tx });
      // matchedCount, not modifiedCount — Prisma's count is rows MATCHED.
      return { count: r.matchedCount };
    } catch (err) { throw normalizeMongoError(err); }
  }

  async deleteManyWhere(filter, { tx } = {}) {
    try {
      const r = await models.Comment.deleteMany(toMongoFilter(filter), { session: tx });
      return { count: r.deletedCount };
    } catch (err) { throw normalizeMongoError(err); }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Comment
      .find({ ...toMongoFilter(filter), isDeleted: false })
      .skip(skip)
      .limit(limit)
      .session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Comment.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  /** Soft-delete scoped by default — see the Prisma sibling. */
  async count(filter = {}, { tx, includeDeleted = false } = {}) {
    const where = includeDeleted
      ? toMongoFilter(filter)
      : { ...toMongoFilter(filter), isDeleted: false };
    return models.Comment.countDocuments(where).session(tx ?? null);
  }
}
