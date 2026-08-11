import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toPrismaWhere, toPrismaData, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — post view analytics events. Postgres: PostView model. Mongo:
// `postViews`. `search()` not implemented — analytics event, no free-text
// field.
export class PostViewRepository extends BaseRepository {
  async findByPostId(postId, _options) {
    throw new Error(`${this.constructor.name}.findByPostId() not implemented`);
  }

  async findByUserAndPost(userId, postId, _options) {
    throw new Error(`${this.constructor.name}.findByUserAndPost() not implemented`);
  }
}

export class PrismaPostViewRepository extends PostViewRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.postView.findUnique({ where: { id } });
  }

  async findByPostId(postId, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.postView.findMany({ where: { postId }, skip, take });
  }

  async findByUserAndPost(userId, postId, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.postView.findFirst({ where: { userId, postId } });
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.postView.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.postView.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.postView.delete({ where: { id } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.postView.findMany({ where: toPrismaWhere(filter), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.postView.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.postView.count({ where: toPrismaWhere(filter) });
  }
}

export class MongoPostViewRepository extends PostViewRepository {
  async findById(id, { tx } = {}) {
    return models.PostView.findById(id).session(tx ?? null);
  }

  async findByPostId(postId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.PostView.find({ postId }).skip(skip).limit(limit).session(tx ?? null);
  }

  async findByUserAndPost(userId, postId, { tx } = {}) {
    return models.PostView.findOne({ userId, postId }).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.PostView.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.PostView.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`PostView ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.PostView.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`PostView ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.PostView.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.PostView.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.PostView.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
}
