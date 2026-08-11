import { BaseRepository } from "../base/BaseRepository.js";
import { NotSupportedByPrismaRepository } from "../base/NotSupportedByPrismaRepository.js";
import { normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toMongoPagination, toMongoSearchFilter, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — greenfield domain, Mongo-only (see NotSupportedByPrismaRepository).
export class CompanyRepository extends BaseRepository {
  async findByOwnerId(ownerId, _options) {
    throw new Error(`${this.constructor.name}.findByOwnerId() not implemented`);
  }
}

export class PrismaCompanyRepository extends NotSupportedByPrismaRepository {
  constructor() {
    super("Company");
  }
}

export class MongoCompanyRepository extends CompanyRepository {
  async findById(id, { tx } = {}) {
    return models.Company.findById(id).session(tx ?? null);
  }

  async findByOwnerId(ownerId, { tx } = {}) {
    return models.Company.find({ ownerId }).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Company.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Company.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Company ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Company.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Company ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Company.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Company.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Company.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }

  async search(term, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Company.find(toMongoSearchFilter(term)).skip(skip).limit(limit).session(tx ?? null);
  }
}
