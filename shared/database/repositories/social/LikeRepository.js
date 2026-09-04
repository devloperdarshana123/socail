import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toPrismaWhere, toPrismaData, fromPrismaGroupBy, toMongoFilter, toMongoProjection, fromMongoGroupBy, toMongoUpdate, toMongoDocument } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — polymorphic reaction. This is the sharpest Prisma/Mongo
// shape difference in the layer: Postgres's Like has three nullable FKs
// (postId/commentId/storyId), Mongo's has one {targetType, targetId} pair
// (Milestone 2's re-model). `findByTarget()`/`findByUserAndTarget()` hide
// that behind one interface — Prisma's implementation maps `targetType`
// to the right nullable column internally. `search()` not implemented —
// no free-text field on a like.
//
// `targetType` values are capitalized ("Post"/"Comment"/"Story") to match
// the app-wide targetModel convention used by every real caller (Report,
// admin controllers, likeHelpers) — fixed here (Phase 7A) from an
// unverified lowercase mapping that had never been exercised by a caller
// before this phase's repository-backed likeHelpers migration.
const PRISMA_TARGET_FIELD = { Post: "postId", Comment: "commentId", Story: "storyId" };

export class LikeRepository extends BaseRepository {
  async findByTarget(targetType, targetId, _options) {
    throw new Error(`${this.constructor.name}.findByTarget() not implemented`);
  }

  async findByUserAndTarget(likedById, targetType, targetId, _options) {
    throw new Error(`${this.constructor.name}.findByUserAndTarget() not implemented`);
  }

  // Phase 7A additions (server's likeHelpers migration). Mongo-backed
  // implementations deferred — see MongoLikeRepository below.
  async findLikersWithUser(targetType, targetId, _options) {
    throw new Error(`${this.constructor.name}.findLikersWithUser() not implemented`);
  }

  async groupByReaction(filter, _options) {
    throw new Error(`${this.constructor.name}.groupByReaction() not implemented`);
  }

  async deleteByUserAndTarget(likedById, targetType, targetId, _options) {
    throw new Error(`${this.constructor.name}.deleteByUserAndTarget() not implemented`);
  }

  // Phase 7A addition (server's postHelpers migration). NOT a duplicate of
  // findByUserAndTarget — see the Prisma implementation for the semantic
  // difference in the filter.
  async findExclusivePostLike(likedById, postId, _options) {
    throw new Error(`${this.constructor.name}.findExclusivePostLike() not implemented`);
  }
}

export class PrismaLikeRepository extends LikeRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.like.findUnique({ where: { id } });
  }

  async findByTarget(targetType, targetId, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    const field = PRISMA_TARGET_FIELD[targetType];
    if (!field) throw new Error(`Unknown targetType "${targetType}"`);
    return client.like.findMany({ where: { [field]: targetId }, skip, take });
  }

  async findByUserAndTarget(likedById, targetType, targetId, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    const field = PRISMA_TARGET_FIELD[targetType];
    if (!field) throw new Error(`Unknown targetType "${targetType}"`);
    return client.like.findFirst({
      where: { likedById, [field]: targetId },
      ...(select ? { select } : {}),
    });
  }

  /**
   * A user's like on a post, requiring the OTHER polymorphic targets to be
   * null.
   *
   * SEMANTIC DIFFERENCE from findByUserAndTarget(): that method filters on
   * `{ likedById, postId }` alone, so it would also match a row that had
   * postId set alongside a non-null commentId/storyId. This one reproduces
   * postHelpers' original filter exactly — `commentId: null, storyId: null`
   * — which treats the like as strictly post-exclusive. The two are NOT
   * interchangeable; the distinction only disappears if the schema is ever
   * changed to enforce a single non-null target.
   */
  async findExclusivePostLike(likedById, postId, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.like.findFirst({
      where: { likedById, postId, commentId: null, storyId: null },
      ...(select ? { select } : {}),
    });
  }

  // getLikers: cursor-paginated likers with the liking user's public
  // profile fields attached. `afterId` maps to Prisma's `id: { lt }` —
  // matches the cursor-pagination shape likeHelpers.getLikers used inline.
  async findLikersWithUser(targetType, targetId, { tx, afterId = null, limit = 20 } = {}) {
    const client = tx ?? this.prismaClient;
    const field = PRISMA_TARGET_FIELD[targetType];
    if (!field) throw new Error(`Unknown targetType "${targetType}"`);
    return client.like.findMany({
      where: { [field]: targetId, ...(afterId ? { id: { lt: afterId } } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      select: {
        id: true,
        reaction: true,
        likedBy: {
          select: { id: true, username: true, fullName: true, avatar: true, isVerifiedBadge: true },
        },
      },
    });
  }

  // getReactionBreakdown: emoji-reaction counts for a target.
  async groupByReaction(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const rows = await client.like.groupBy({ by: ["reaction"], where: toPrismaWhere(filter), _count: { reaction: true } });
    return fromPrismaGroupBy(rows, "reaction", "reaction");
  }

  // deleteLike: remove this user's like on a target, if any.
  async deleteByUserAndTarget(likedById, targetType, targetId, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const field = PRISMA_TARGET_FIELD[targetType];
    if (!field) throw new Error(`Unknown targetType "${targetType}"`);
    return client.like.deleteMany({ where: { likedById, [field]: targetId } });
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.like.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.like.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.like.delete({ where: { id } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.like.findMany({ where: toPrismaWhere(filter), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.like.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.like.count({ where: toPrismaWhere(filter) });
  }
}

// Postgres stores the like target as one of three FK columns keyed by a
// capitalised model name; Mongo stores a single lower-case discriminator
// (Milestone 2). This maps the app-wide vocabulary onto the Mongo one.
// The interface speaks the app-wide capitalised convention ("Post"), which
// is what every caller passes and what Postgres stores in `targetModel`.
// Mongo's LIKE_TARGET_TYPE enum is lower-case. Every method that touches
// targetType has to translate — three of them did not, so a like created
// through the helper failed validation outright and the reads that did
// translate could never have matched them anyway.
const MONGO_TARGET_TYPE = { Post: "post", Comment: "comment", Story: "story" };
const toMongoTargetType = (t) => MONGO_TARGET_TYPE[t] ?? String(t ?? "").toLowerCase();

/**
 * Prisma-shaped like payload -> Mongo's polymorphic pair.
 *
 * likeHelpers builds `{ likedById, reaction, targetModel, postId|commentId }`
 * because that is what the Postgres table needs. The Mongo collection wants
 * `{ targetType, targetId }`, and nothing was converting between them, so
 * `create()` wrote a document with neither field and mongoose rejected it.
 * Same collapse the migration performs (see scripts/migrate-to-mongo/plan.js).
 */
function adaptLikeData(data = {}) {
  if (data.targetType && data.targetId) return data; // already neutral
  const { targetModel, postId, commentId, storyId, ...rest } = data;
  const targetId = postId ?? commentId ?? storyId ?? null;
  if (!targetModel || !targetId) return data; // let validation report it
  return { ...rest, targetType: toMongoTargetType(targetModel), targetId };
}

export class MongoLikeRepository extends LikeRepository {
  async findById(id, { tx } = {}) {
    return models.Like.findById(id).session(tx ?? null);
  }

  async findByTarget(targetType, targetId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Like.find({ targetType: toMongoTargetType(targetType), targetId }).skip(skip).limit(limit).session(tx ?? null);
  }

  async findByUserAndTarget(likedById, targetType, targetId, { tx } = {}) {
    return models.Like.findOne({ likedById, targetType: toMongoTargetType(targetType), targetId }).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Like.create([toMongoDocument(adaptLikeData(data))], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Like.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Like ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Like.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Like ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Like.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Like.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Like.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
  /**
   * Postgres models the polymorphic target as three nullable FK columns and
   * asserts the other two are NULL. Mongo's schema uses a single
   * (targetType, targetId) pair — Milestone 2's design — so "exclusively a
   * post like" is expressed directly rather than by null-checking siblings.
   */
  async findExclusivePostLike(likedById, postId, { tx, select } = {}) {
    let q = models.Like.findOne({ likedById, targetType: "post", targetId: postId });
    if (select) q = q.select(toMongoProjection(select));
    return q.session(tx ?? null);
  }

  /** M-10: `select: { likedBy: { select } }` → populate with a projection. */
  async findLikersWithUser(targetType, targetId, { tx, afterId = null, limit = 20 } = {}) {
    const query = {
      targetType: toMongoTargetType(targetType),
      targetId,
      ...(afterId ? { _id: { $lt: afterId } } : {}),
    };
    return models.Like.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .select("reaction likedById")
      .populate({ path: "likedBy", select: "username fullName avatar isVerifiedBadge" })
      .session(tx ?? null);
  }

  /** M-4: returns the neutral [{ key, count }] envelope, like its sibling. */
  async groupByReaction(filter, { tx } = {}) {
    const rows = await models.Like.aggregate([
      { $match: toMongoFilter(filter) },
      { $group: { _id: "$reaction", count: { $sum: 1 } } },
    ]).session(tx ?? null);
    return fromMongoGroupBy(rows);
  }

  async deleteByUserAndTarget(likedById, targetType, targetId, { tx } = {}) {
    const t = MONGO_TARGET_TYPE[targetType];
    if (!t) throw new Error(`Unknown targetType "${targetType}"`);
    const r = await models.Like.deleteMany({ likedById, targetType: t, targetId }, { session: tx });
    return { count: r.deletedCount };
  }

}
