import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, withNotDeleted, toPrismaWhere, toPrismaData, toMongoProjection, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — saved story collections. Postgres: Highlight model, with
// its story list in the separate HighlightStory join table (`stories`
// relation). Mongo: `highlights`, with the story list embedded directly as
// `storyRefs[]` (Milestone 2 absorbed HighlightStory as a collection —
// see the migration plan). `findById` on Prisma includes that relation so
// the caller gets an equivalent shape to Mongo's embedded array, without
// this layer reshaping it into business logic.
export class HighlightRepository extends BaseRepository {
  async findByAuthorId(authorId, _options) {
    throw new Error(`${this.constructor.name}.findByAuthorId() not implemented`);
  }

  // Phase 7A additions (server's highlightHelpers migration). Both are
  // deliberately unbounded — see their Prisma implementations. Distinct
  // from findByAuthorId above, which uses offset pagination and returns
  // bare rows. Mongo-backed implementations deferred.
  async findAllByAuthorWithSnapshots(authorId, _options) {
    throw new Error(`${this.constructor.name}.findAllByAuthorWithSnapshots() not implemented`);
  }

  async findAllOtherByAuthorWithSnapshots(authorId, excludeId, _options) {
    throw new Error(`${this.constructor.name}.findAllOtherByAuthorWithSnapshots() not implemented`);
  }
}

export class PrismaHighlightRepository extends HighlightRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  /**
   * @param {object} [options]
   * @param {object} [options.select] — when supplied, projects those fields
   *   INSTEAD of joining the `stories` relation. Prisma rejects `select` and
   *   `include` together, and callers that ask for a projection do not want
   *   the join. Omitting it preserves the original include-the-relation
   *   behavior exactly.
   */
  async findById(id, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.highlight.findUnique({
      where: { id },
      ...(select ? { select } : { include: { stories: true } }),
    });
  }

  // getMyHighlights: an author's live highlights, newest first.
  // DELIBERATELY UNBOUNDED — the original query has no take/limit, and
  // routing it through findMany() would silently cap it at
  // toPrismaPagination()'s default limit of 20 (see the pagination-cap
  // hazard documented in FollowRepository.findAllFollowerIds).
  async findAllByAuthorWithSnapshots(authorId, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.highlight.findMany({
      where: { authorId, isDeleted: false },
      ...(select ? { select } : {}),
      orderBy: { createdAt: "desc" },
    });
  }

  // addStoryToHighlight's duplicate scan: the author's OTHER live
  // highlights, so the caller can check whether the story is already
  // filed under one of them. Also deliberately unbounded — a cap would
  // let a duplicate slip through undetected.
  async findAllOtherByAuthorWithSnapshots(authorId, excludeId, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.highlight.findMany({
      where: { authorId, isDeleted: false, id: { not: excludeId } },
      ...(select ? { select } : {}),
    });
  }

  async findByAuthorId(authorId, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.highlight.findMany({ where: withNotDeleted({ authorId }), skip, take });
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.highlight.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.highlight.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  /**
   * Soft delete — sets isDeleted AND deletedAt.
   *
   * NOTE (Phase 7A): highlightHelpers.deleteHighlight does NOT use this
   * method. It writes `{ isDeleted: true }` only, leaving deletedAt null,
   * and calls update() directly to preserve that byte-for-byte. Same
   * divergence as StoryRepository.delete() — see the highlight
   * characterization suite, which pins it.
   */
  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.highlight.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx, includeDeleted = false } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.highlight.findMany({ where: toPrismaWhere(includeDeleted ? filter : withNotDeleted(filter)), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.highlight.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx, includeDeleted = false } = {}) {
    const client = tx ?? this.prismaClient;
    return client.highlight.count({ where: toPrismaWhere(includeDeleted ? filter : withNotDeleted(filter)) });
  }
}

export class MongoHighlightRepository extends HighlightRepository {
  async findById(id, { tx } = {}) {
    return models.Highlight.findById(id).session(tx ?? null);
  }

  async findByAuthorId(authorId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Highlight.find(withNotDeleted({ authorId })).skip(skip).limit(limit).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Highlight.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Highlight.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Highlight ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Highlight.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true, session: tx }
    );
    if (!doc) throw new NotFoundError(`Highlight ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx, includeDeleted = false } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    const query = toMongoFilter(includeDeleted ? filter : withNotDeleted(filter));
    return models.Highlight.find(query).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Highlight.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx, includeDeleted = false } = {}) {
    const query = toMongoFilter(includeDeleted ? filter : withNotDeleted(filter));
    return models.Highlight.countDocuments(query).session(tx ?? null);
  }
  async findAllByAuthorWithSnapshots(authorId, { tx, select } = {}) {
    let q = models.Highlight.find({ authorId, isDeleted: false }).sort({ createdAt: -1 });
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

  async findAllOtherByAuthorWithSnapshots(authorId, excludeId, { tx, select } = {}) {
    let q = models.Highlight.find({ authorId, isDeleted: false, _id: { $ne: excludeId } });
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

}
