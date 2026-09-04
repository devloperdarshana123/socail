import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, withNotDeleted, toPrismaWhere, toPrismaData, toMongoFilter, toMongoUpdate, toMongoProjection, toMongoDocument } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — 24h ephemeral stories. Postgres: Story model, with an
// isDeleted/deletedAt soft-delete pair. Mongo: `stories`, with the same pair
// and additionally a TTL index on `expiresAt`.
//
// Milestone 2 originally gave the Mongo collection the TTL index INSTEAD of
// the soft-delete fields, on the reasoning that time-based expiry is what
// stories actually do. Verification showed the two are not alternatives:
// deactivating an account hides a user's stories by flipping isDeleted and
// REACTIVATING RESTORES THEM, which a hard delete cannot express. Worse, with
// the fields absent, mongoose's strict mode dropped both writes in silence.
// The pair is now present on both backends and delete() means the same thing
// on each; the TTL index still reaps genuinely expired documents.
export class StoryRepository extends BaseRepository {
  async findByAuthorId(authorId, _options) {
    throw new Error(`${this.constructor.name}.findByAuthorId() not implemented`);
  }

  // Phase 7A addition (server's storyHelpers migration). Mongo-backed
  // implementation deferred — see MongoStoryRepository below.
  async findPublicActiveWithAuthor(_options) {
    throw new Error(`${this.constructor.name}.findPublicActiveWithAuthor() not implemented`);
  }

  // Phase 7A addition (server's highlightHelpers migration).
  async findOwnedByIds(ids, authorId, _options) {
    throw new Error(`${this.constructor.name}.findOwnedByIds() not implemented`);
  }

  // Phase 7A addition (server's settingsHelpers migration) — bulk
  // visibility flips for account deactivation/reactivation.
  async updateManyWhere(filter, data, _options) {
    throw new Error(`${this.constructor.name}.updateManyWhere() not implemented`);
  }
}

// The author projection attached to feed rows — the exact five fields
// storyHelpers' feed returns.
const STORY_AUTHOR_SELECT = {
  id: true,
  username: true,
  fullName: true,
  avatar: true,
  isVerifiedBadge: true,
};

export class PrismaStoryRepository extends StoryRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx, includeDeleted = false, select } = {}) {
    const client = tx ?? this.prismaClient;
    const story = await client.story.findUnique({ where: { id }, ...(select ? { select } : {}) });
    return !includeDeleted && story?.isDeleted ? null : story;
  }

  // getStoriesFeed: live, non-deleted, public stories with their author.
  // DELIBERATELY UNBOUNDED — the feed query has no take/limit, and routing
  // it through findMany() would silently cap it at toPrismaPagination()'s
  // default limit of 20 (see the pagination-cap hazard documented in
  // FollowRepository.findAllFollowerIds).
  async findPublicActiveWithAuthor({ tx, now = new Date() } = {}) {
    const client = tx ?? this.prismaClient;
    return client.story.findMany({
      where: {
        isDeleted: false,
        expiresAt: { gt: now },
        audience: "public",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        media: true,
        textContent: true,
        caption: true,
        viewsCount: true,
        reactionsCount: true,
        expiresAt: true,
        createdAt: true,
        author: { select: STORY_AUTHOR_SELECT },
      },
    });
  }

  async findByAuthorId(authorId, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.story.findMany({
      where: withNotDeleted({ authorId, expiresAt: { gt: new Date() } }),
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
  }

  // createHighlight: the caller's own live stories from a candidate id
  // list. DELIBERATELY UNBOUNDED — the original query has no take, and a
  // silent cap would drop stories from the highlight being created.
  async findOwnedByIds(ids, authorId, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.story.findMany({
      where: { id: { in: ids }, authorId, isDeleted: false },
      ...(select ? { select } : {}),
    });
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.story.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.story.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  /**
   * Soft delete, matching Postgres's isDeleted/deletedAt fields.
   *
   * NOTE (Phase 7A): storyHelpers.deleteStory does NOT use this method. It
   * writes `{ isDeleted: true }` only, leaving deletedAt null, and calls
   * update() directly to preserve that byte-for-byte. Using delete() there
   * would additionally stamp deletedAt — a silent change to what gets
   * persisted. See the story characterization suite, which pins it.
   */
  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.story.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
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
      return await client.story.updateMany({ where: toPrismaWhere(filter), data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx, includeDeleted = false } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.story.findMany({ where: toPrismaWhere(includeDeleted ? filter : withNotDeleted(filter)), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.story.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx, includeDeleted = false } = {}) {
    const client = tx ?? this.prismaClient;
    return client.story.count({ where: toPrismaWhere(includeDeleted ? filter : withNotDeleted(filter)) });
  }
}

export class MongoStoryRepository extends StoryRepository {
  async findById(id, { tx } = {}) {
    return models.Story.findById(id).session(tx ?? null);
  }

  async findByAuthorId(authorId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Story
      .find({ authorId, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Story.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Story.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Story ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  /** Soft delete, matching Prisma — see the class comment. */
  async delete(id, { tx } = {}) {
    const doc = await models.Story.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true, session: tx },
    );
    if (!doc) throw new NotFoundError(`Story ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Story.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Story.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Story.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
  /** M-10: the author relation becomes a populate with the same projection. */
  async findPublicActiveWithAuthor({ tx, now = new Date() } = {}) {
    return models.Story.find({ isDeleted: false, expiresAt: { $gt: now }, audience: "public" })
      .sort({ createdAt: -1 })
      .select("type media textContent caption viewsCount reactionsCount expiresAt createdAt authorId")
      .populate({ path: "author", select: "username fullName avatar isVerifiedBadge" })
      .session(tx ?? null);
  }

  async findOwnedByIds(ids, authorId, { tx, select } = {}) {
    let q = models.Story.find({ _id: { $in: ids }, authorId, isDeleted: false });
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

  async updateManyWhere(filter, data, { tx } = {}) {
    try {
      const r = await models.Story.updateMany(toMongoFilter(filter), toMongoUpdate(data), { session: tx });
      // Prisma's updateMany count is rows MATCHED by the where clause — it
      // counts a row even when the new value equals the old. Mongo's
      // modifiedCount excludes unchanged documents, so matchedCount is the
      // faithful analogue; modifiedCount would under-report.
      return { count: r.matchedCount };
    } catch (err) { throw normalizeMongoError(err); }
  }

}
