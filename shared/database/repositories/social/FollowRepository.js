import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toPrismaWhere, toPrismaData, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — follow graph edge. Postgres: Follow model. Mongo: `follows`.
// `search()` not implemented — no free-text field on a follow edge.
export class FollowRepository extends BaseRepository {
  async findByFollowerAndFollowing(followerId, followingId, _options) {
    throw new Error(`${this.constructor.name}.findByFollowerAndFollowing() not implemented`);
  }

  async findFollowers(followingId, _options) {
    throw new Error(`${this.constructor.name}.findFollowers() not implemented`);
  }

  async findFollowing(followerId, _options) {
    throw new Error(`${this.constructor.name}.findFollowing() not implemented`);
  }

  // Phase 7A additions (server's followHelpers migration). These are
  // distinct from findFollowers/findFollowing above, which hardcode
  // status:"accepted", use offset pagination, and return bare follow rows
  // with no profile attached — those signatures are left untouched.
  // Mongo-backed implementations deferred — see MongoFollowRepository.
  async findFollowersWithProfile(followingId, _options) {
    throw new Error(`${this.constructor.name}.findFollowersWithProfile() not implemented`);
  }

  async findFollowingWithProfile(followerId, _options) {
    throw new Error(`${this.constructor.name}.findFollowingWithProfile() not implemented`);
  }

  async findAllFollowerIds(followingId, _options) {
    throw new Error(`${this.constructor.name}.findAllFollowerIds() not implemented`);
  }

  async findFollowersAmongWithProfile(followingId, followerIds, _options) {
    throw new Error(`${this.constructor.name}.findFollowersAmongWithProfile() not implemented`);
  }

  async findAllBetween(userAId, userBId, _options) {
    throw new Error(`${this.constructor.name}.findAllBetween() not implemented`);
  }

  // Phase 7A addition (server's postHelpers migration) — the outbound
  // mirror of findAllFollowerIds. Also deliberately unbounded.
  async findAllFollowingIds(followerId, _options) {
    throw new Error(`${this.constructor.name}.findAllFollowingIds() not implemented`);
  }
}

// The profile projection attached to follow rows in list queries — the
// exact five fields followHelpers' list endpoints return.
const FOLLOW_PROFILE_SELECT = {
  id: true,
  username: true,
  fullName: true,
  avatar: true,
  isVerifiedBadge: true,
};

export class PrismaFollowRepository extends FollowRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.follow.findUnique({ where: { id } });
  }

  // `followerId` + `followingId` is a compound unique in the Postgres
  // schema (Follow @@unique([followerId, followingId])), so findFirst
  // returns the same single row or null a compound-key findUnique would.
  async findByFollowerAndFollowing(followerId, followingId, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.follow.findFirst({
      where: { followerId, followingId },
      ...(select ? { select } : {}),
    });
  }

  async findFollowers(followingId, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.follow.findMany({ where: { followingId, status: "accepted" }, skip, take });
  }

  async findFollowing(followerId, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.follow.findMany({ where: { followerId, status: "accepted" }, skip, take });
  }

  // getFollowers / getPendingRequests: inbound follow rows for a user at a
  // given status, with the requesting user's profile attached. Uses
  // Prisma's native `cursor` + `skip: 1` keyset pagination ordered by the
  // same `id` field the cursor points at, so pages are gap-free.
  async findFollowersWithProfile(followingId, { tx, status, afterId = null, limit = 20 } = {}) {
    const client = tx ?? this.prismaClient;
    return client.follow.findMany({
      where: { followingId, status },
      orderBy: { id: "desc" },
      take: limit + 1,
      ...(afterId && { cursor: { id: afterId }, skip: 1 }),
      include: { follower: { select: FOLLOW_PROFILE_SELECT } },
    });
  }

  // getFollowing: outbound follow rows for a user, with the followed
  // user's profile attached. Same keyset pagination as above.
  async findFollowingWithProfile(followerId, { tx, status, afterId = null, limit = 20 } = {}) {
    const client = tx ?? this.prismaClient;
    return client.follow.findMany({
      where: { followerId, status },
      orderBy: { id: "desc" },
      take: limit + 1,
      ...(afterId && { cursor: { id: afterId }, skip: 1 }),
      include: { following: { select: FOLLOW_PROFILE_SELECT } },
    });
  }

  // getMutualFollowers step 1 — every follower id at a given status.
  // DELIBERATELY UNBOUNDED: the mutual-followers intersection is computed
  // from this full set, so it must not be silently capped. Note this is
  // why it is NOT expressed as findMany(filter) — findMany routes through
  // toPrismaPagination(), which defaults to take: 20 when no pagination is
  // supplied and would quietly truncate the input set.
  async findAllFollowerIds(followingId, { tx, status } = {}) {
    const client = tx ?? this.prismaClient;
    return client.follow.findMany({
      where: { followingId, status },
      select: { followerId: true },
    });
  }

  // Every id this user follows at a given status — the outbound mirror of
  // findAllFollowerIds. DELIBERATELY UNBOUNDED: the caller uses this whole
  // set as a feed's author list, so a silent cap would truncate the feed's
  // source rather than just its page.
  async findAllFollowingIds(followerId, { tx, status } = {}) {
    const client = tx ?? this.prismaClient;
    return client.follow.findMany({
      where: { followerId, status },
      select: { followingId: true },
    });
  }

  // getMutualFollowers step 2 — of a candidate follower-id set, those who
  // also follow this user, with profiles attached.
  async findFollowersAmongWithProfile(followingId, followerIds, { tx, status, limit } = {}) {
    const client = tx ?? this.prismaClient;
    return client.follow.findMany({
      where: { followingId, status, followerId: { in: followerIds } },
      take: limit,
      include: { follower: { select: FOLLOW_PROFILE_SELECT } },
    });
  }

  // removeAllBetween — every follow row between two users, in either
  // direction, at any status. Also deliberately unbounded (see
  // findAllFollowerIds): the caller deletes all of them, so a silent
  // pagination cap would leave rows behind.
  async findAllBetween(userAId, userBId, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.follow.findMany({
      where: {
        OR: [
          { followerId: userAId, followingId: userBId },
          { followerId: userBId, followingId: userAId },
        ],
      },
    });
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.follow.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.follow.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.follow.delete({ where: { id } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.follow.findMany({ where: toPrismaWhere(filter), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.follow.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.follow.count({ where: toPrismaWhere(filter) });
  }
}

// Mirror of FOLLOW_PROFILE_SELECT, in mongoose projection syntax.
const FOLLOW_PROFILE_FIELDS = "username fullName avatar isVerifiedBadge isPrivate";

export class MongoFollowRepository extends FollowRepository {
  async findById(id, { tx } = {}) {
    return models.Follow.findById(id).session(tx ?? null);
  }

  async findByFollowerAndFollowing(followerId, followingId, { tx } = {}) {
    return models.Follow.findOne({ followerId, followingId }).session(tx ?? null);
  }

  async findFollowers(followingId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Follow.find({ followingId, status: "accepted" }).skip(skip).limit(limit).session(tx ?? null);
  }

  async findFollowing(followerId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Follow.find({ followerId, status: "accepted" }).skip(skip).limit(limit).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Follow.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Follow.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Follow ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Follow.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Follow ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Follow.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Follow.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Follow.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
  /**
   * M-10: `include: { follower: { select } }` → populate. Postgres paginates
   * with a NATIVE cursor (`cursor` + skip:1); Mongo has no cursor primitive,
   * so the equivalent is an `_id < afterId` predicate over the same `id desc`
   * ordering — which is what Prisma's cursor compiles to anyway.
   */
  async findFollowersWithProfile(followingId, { tx, status, afterId = null, limit = 20 } = {}) {
    return models.Follow.find({ followingId, status, ...(afterId ? { _id: { $lt: afterId } } : {}) })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate({ path: "follower", select: FOLLOW_PROFILE_FIELDS })
      .session(tx ?? null);
  }

  async findFollowingWithProfile(followerId, { tx, status, afterId = null, limit = 20 } = {}) {
    return models.Follow.find({ followerId, status, ...(afterId ? { _id: { $lt: afterId } } : {}) })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate({ path: "following", select: FOLLOW_PROFILE_FIELDS })
      .session(tx ?? null);
  }

  /** DELIBERATELY UNBOUNDED — the caller uses the whole id set. */
  async findAllFollowerIds(followingId, { tx, status } = {}) {
    return models.Follow.find({ followingId, status }).select("followerId").session(tx ?? null);
  }

  async findAllFollowingIds(followerId, { tx, status } = {}) {
    return models.Follow.find({ followerId, status }).select("followingId").session(tx ?? null);
  }

  async findFollowersAmongWithProfile(followingId, followerIds, { tx, status, limit } = {}) {
    let q = models.Follow.find({ followingId, status, followerId: { $in: followerIds } });
    if (limit !== undefined) q = q.limit(limit);
    return q.populate({ path: "follower", select: FOLLOW_PROFILE_FIELDS }).session(tx ?? null);
  }

  /** Both directions of a pair, in one read. */
  async findAllBetween(userAId, userBId, { tx } = {}) {
    return models.Follow.find({
      $or: [
        { followerId: userAId, followingId: userBId },
        { followerId: userBId, followingId: userAId },
      ],
    }).session(tx ?? null);
  }

}
