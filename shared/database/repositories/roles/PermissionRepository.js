import { BaseRepository } from "../base/BaseRepository.js";
import { NotSupportedByPrismaRepository } from "../base/NotSupportedByPrismaRepository.js";
import { normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toMongoPagination, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — greenfield domain, Mongo-only. Completes the `roles` domain
// alongside RoleRepository — this is the flat permission vocabulary
// roles.permissions[] draws from (Milestone 2, Group 2).
export class PermissionRepository extends BaseRepository {
  async findByKey(key, _options) {
    throw new Error(`${this.constructor.name}.findByKey() not implemented`);
  }

  async findByCategory(category, _options) {
    throw new Error(`${this.constructor.name}.findByCategory() not implemented`);
  }
}

export class PrismaPermissionRepository extends NotSupportedByPrismaRepository {
  constructor() {
    super("Permission");
  }
}

export class MongoPermissionRepository extends PermissionRepository {
  async findById(id, { tx } = {}) {
    return models.Permission.findById(id).session(tx ?? null);
  }

  async findByKey(key, { tx } = {}) {
    return models.Permission.findOne({ key }).session(tx ?? null);
  }

  async findByCategory(category, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Permission.find({ category }).skip(skip).limit(limit).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Permission.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Permission.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Permission ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Permission.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Permission ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Permission.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Permission.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Permission.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
}
