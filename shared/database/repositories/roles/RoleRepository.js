import { BaseRepository } from "../base/BaseRepository.js";
import { NotSupportedByPrismaRepository } from "../base/NotSupportedByPrismaRepository.js";
import { normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toMongoPagination, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — greenfield domain, Mongo-only. Replaces today's scattered
// `role === "super_admin"` string checks (Phase 1 finding).
export class RoleRepository extends BaseRepository {
  async findByKey(key, _options) {
    throw new Error(`${this.constructor.name}.findByKey() not implemented`);
  }
}

export class PrismaRoleRepository extends NotSupportedByPrismaRepository {
  constructor() {
    super("Role");
  }
}

export class MongoRoleRepository extends RoleRepository {
  async findById(id, { tx } = {}) {
    return models.Role.findById(id).session(tx ?? null);
  }

  async findByKey(key, { tx } = {}) {
    return models.Role.findOne({ key }).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Role.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Role.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Role ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    // Note: whether an `isSystem` role should be deletable at all is a
    // business rule, not a persistence concern — deliberately left to the
    // service/controller layer that will call this repository, not
    // enforced here.
    const doc = await models.Role.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Role ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Role.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Role.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Role.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }

  async search(term, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Role.find({ label: { $regex: term, $options: "i" } }).skip(skip).limit(limit).session(tx ?? null);
  }
}
