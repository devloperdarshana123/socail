import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toPrismaSearchWhere, toPrismaData, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — the profile-shaped subset of identity data. This is the
// clearest Prisma/Mongo asymmetry in the whole repository layer: Postgres
// has no separate Profile table (it's fields on User), so
// PrismaProfileRepository operates on `prisma.user` the whole time,
// projected to just the profile fields; Mongo has a real, separate
// `profiles` collection (Milestone 2's split). `findById(id)` therefore
// means "by user id" on the Prisma side and "by the profile document's own
// _id" on the Mongo side — use `findByUserId()` when you specifically mean
// the user, which works identically on both.
export class ProfileRepository extends BaseRepository {
  async findByUserId(userId, _options) {
    throw new Error(`${this.constructor.name}.findByUserId() not implemented`);
  }
}

const PRISMA_PROFILE_FIELDS = {
  id: true,
  fullName: true,
  bio: true,
  avatar: true,
  coverPhoto: true,
  designation: true,
  website: true,
  gender: true,
  dateOfBirth: true,
  isPrivate: true,
  isVerifiedBadge: true,
  followersCount: true,
  followingCount: true,
  postsCount: true,
  createdAt: true,
  updatedAt: true,
};

export class PrismaProfileRepository extends ProfileRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.user.findUnique({ where: { id }, select: PRISMA_PROFILE_FIELDS });
  }

  async findByUserId(userId, options) {
    return this.findById(userId, options); // same row on Postgres
  }

  async create(_data, _options) {
    throw new Error(
      "PrismaProfileRepository.create() not applicable — a profile is created implicitly with its User row; use UserRepository.create()"
    );
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.user.update({ where: { id }, data: toPrismaData(data), select: PRISMA_PROFILE_FIELDS });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(_id, _options) {
    throw new Error(
      "PrismaProfileRepository.delete() not applicable — deleting a profile means deleting the User; use UserRepository.delete()"
    );
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.user.findMany({ where: filter, skip, take, select: PRISMA_PROFILE_FIELDS });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.user.count({ where: filter })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.user.count({ where: filter });
  }

  async search(term, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    const where = toPrismaSearchWhere(term, ["fullName"]);
    return client.user.findMany({ where, skip, take, select: PRISMA_PROFILE_FIELDS });
  }
}

export class MongoProfileRepository extends ProfileRepository {
  async findById(id, { tx } = {}) {
    return models.Profile.findById(id).session(tx ?? null);
  }

  async findByUserId(userId, { tx } = {}) {
    return models.Profile.findOne({ userId }).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Profile.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Profile.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Profile ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Profile.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Profile ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Profile.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Profile.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Profile.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }

  async search(term, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Profile.find({ fullName: { $regex: term, $options: "i" } })
      .skip(skip)
      .limit(limit)
      .session(tx ?? null);
  }
}
