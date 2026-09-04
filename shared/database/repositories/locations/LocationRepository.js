import { BaseRepository } from "../base/BaseRepository.js";
import { NotSupportedByPrismaRepository } from "../base/NotSupportedByPrismaRepository.js";
import { normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toMongoPagination, toMongoNearFilter, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — greenfield domain, Mongo-only. `findNear()` is the one
// repository method in this whole layer with no Prisma equivalent even in
// principle (Postgres has no geospatial type in the current schema) — see
// ../queryHelpers/geoQuery.js's comment.
export class LocationRepository extends BaseRepository {
  async findByOwner(ownerType, ownerId, _options) {
    throw new Error(`${this.constructor.name}.findByOwner() not implemented`);
  }

  async findNear(point, _options) {
    throw new Error(`${this.constructor.name}.findNear() not implemented`);
  }
}

export class PrismaLocationRepository extends NotSupportedByPrismaRepository {
  constructor() {
    super("Location");
  }
}

export class MongoLocationRepository extends LocationRepository {
  async findById(id, { tx } = {}) {
    return models.Location.findById(id).session(tx ?? null);
  }

  async findByOwner(ownerType, ownerId, { tx } = {}) {
    return models.Location.findOne({ ownerType, ownerId }).session(tx ?? null);
  }

  async findNear({ lng, lat, maxDistanceMeters }, { tx } = {}) {
    return models.Location.find(toMongoNearFilter({ lng, lat, maxDistanceMeters })).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Location.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Location.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Location ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Location.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Location ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Location.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Location.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Location.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
}
