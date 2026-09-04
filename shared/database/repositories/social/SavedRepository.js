import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toPrismaWhere, toPrismaData, toMongoFilter, toMongoUpdate, toMongoDocument } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — bookmarks. Postgres: Saved model. Mongo: `saved`. `search()`
// not implemented — no free-text field on a bookmark.
export class SavedRepository extends BaseRepository {
  async findByUserAndPost(savedById, postId, _options) {
    throw new Error(`${this.constructor.name}.findByUserAndPost() not implemented`);
  }

  async findByUserId(savedById, _options) {
    throw new Error(`${this.constructor.name}.findByUserId() not implemented`);
  }

  // Phase 7A addition (server's savedHelpers migration). Mongo-backed
  // implementation deferred — see MongoSavedRepository below.
  async findByUserIdWithPost(savedById, _options) {
    throw new Error(`${this.constructor.name}.findByUserIdWithPost() not implemented`);
  }
}

export class PrismaSavedRepository extends SavedRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.saved.findUnique({ where: { id } });
  }

  // `savedById` + `postId` is a compound unique in the Postgres schema
  // (Saved @@unique([savedById, postId])), so findFirst returns the same
  // single row or null a compound-key findUnique would.
  async findByUserAndPost(savedById, postId, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.saved.findFirst({
      where: { savedById, postId },
      ...(select ? { select } : {}),
    });
  }

  async findByUserId(savedById, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.saved.findMany({ where: { savedById }, orderBy: { createdAt: "desc" }, skip, take });
  }

  // getSavedPosts: cursor-paginated bookmarks with the saved post and its
  // author attached, excluding saves whose post has been soft-deleted.
  // `beforeId` maps to Prisma's `id: { lt }` — the cursor shape
  // savedHelpers.getSavedPosts used inline.
  async findByUserIdWithPost(savedById, { tx, beforeId = null, limit = 12 } = {}) {
    const client = tx ?? this.prismaClient;
    return client.saved.findMany({
      where: {
        savedById,
        post: { isDeleted: false },
        ...(beforeId ? { id: { lt: beforeId } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        post: {
          select: {
            id: true,
            type: true,
            caption: true,
            media: true,
            visibility: true,
            likesCount: true,
            commentsCount: true,
            viewsCount: true,
            savedCount: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatar: true,
                isVerifiedBadge: true,
              },
            },
          },
        },
      },
    });
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.saved.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.saved.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.saved.delete({ where: { id } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.saved.findMany({
      where: toPrismaWhere(filter),
      skip,
      take,
      ...(select ? { select } : {}),
    });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.saved.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.saved.count({ where: toPrismaWhere(filter) });
  }
}

export class MongoSavedRepository extends SavedRepository {
  async findById(id, { tx } = {}) {
    return models.Saved.findById(id).session(tx ?? null);
  }

  async findByUserAndPost(savedById, postId, { tx } = {}) {
    return models.Saved.findOne({ savedById, postId }).session(tx ?? null);
  }

  async findByUserId(savedById, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Saved.find({ savedById }).sort({ createdAt: -1 }).skip(skip).limit(limit).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Saved.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Saved.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Saved ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Saved.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Saved ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Saved.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Saved.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Saved.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
  /**
   * M-10: the Prisma version uses include+select to attach a projected post
   * with its author. Mongo does the same with populate(), and the SELECT
   * shape is reproduced field-for-field so the caller sees one object shape
   * on both backends. `post: { isDeleted: false }` is a RELATION filter on
   * Postgres; on Mongo the post lives in another collection, so it becomes a
   * populate `match` and the null-post rows are dropped afterwards — that
   * post-filter step is what an INNER JOIN does for free on Postgres.
   */
  async findByUserIdWithPost(savedById, { tx, beforeId = null, limit = 12 } = {}) {
    const query = { savedById, ...(beforeId ? { _id: { $lt: beforeId } } : {}) };
    const rows = await models.Saved.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate({
        path: "post",
        match: { isDeleted: false },
        select: "type caption media visibility likesCount commentsCount viewsCount savedCount createdAt authorId",
        populate: { path: "author", select: "username fullName avatar isVerifiedBadge" },
      })
      .session(tx ?? null);
    // Mongo keeps the row with a null populate; Postgres' relation filter
    // removes it. Drop them so the two return the same set.
    // Tested on `post`, the populated RELATION, not on `postId`. Populating
    // the alias virtual leaves the raw FK in place, so `postId` stayed truthy
    // even when the match excluded the post — and this filter dropped nothing.
    return rows.filter((r) => r.post);
  }

}
