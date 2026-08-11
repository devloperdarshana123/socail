import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toMongoSearchFilter, toPrismaData, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — hashtag aggregate/trending table. Postgres: Hashtag model
// (unchanged shape from Mongo — see Milestone 2, this was already
// well-modeled). No FK relations either side (Post.hashtags is a plain
// string array on both backends).
export class HashtagRepository extends BaseRepository {
  async findByName(name, _options) {
    throw new Error(`${this.constructor.name}.findByName() not implemented`);
  }

  async findTrending(_options) {
    throw new Error(`${this.constructor.name}.findTrending() not implemented`);
  }
}

export class PrismaHashtagRepository extends HashtagRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.hashtag.findUnique({ where: { id } });
  }

  async findByName(name, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.hashtag.findUnique({ where: { name } });
  }

  async findTrending({ tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.hashtag.findMany({ where: { isBanned: false }, orderBy: { trendingScore: "desc" }, skip, take });
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.hashtag.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.hashtag.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.hashtag.delete({ where: { id } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.hashtag.findMany({ where: filter, skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.hashtag.count({ where: filter })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.hashtag.count({ where: filter });
  }

  async search(term, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.hashtag.findMany({ where: { name: { contains: term, mode: "insensitive" } }, skip, take });
  }
}

export class MongoHashtagRepository extends HashtagRepository {
  async findById(id, { tx } = {}) {
    return models.Hashtag.findById(id).session(tx ?? null);
  }

  async findByName(name, { tx } = {}) {
    return models.Hashtag.findOne({ name: name.toLowerCase() }).session(tx ?? null);
  }

  async findTrending({ tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Hashtag
      .find({ isBanned: false })
      .sort({ trendingScore: -1 })
      .skip(skip)
      .limit(limit)
      .session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Hashtag.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Hashtag.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Hashtag ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Hashtag.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Hashtag ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Hashtag.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Hashtag.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Hashtag.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }

  async search(term, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Hashtag.find(toMongoSearchFilter(term)).skip(skip).limit(limit).session(tx ?? null);
  }
}
