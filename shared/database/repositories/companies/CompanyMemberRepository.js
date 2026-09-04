import { BaseRepository } from "../base/BaseRepository.js";
import { NotSupportedByPrismaRepository } from "../base/NotSupportedByPrismaRepository.js";
import { normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toMongoPagination, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — greenfield domain, Mongo-only. Completes the `companies`
// domain alongside CompanyRepository (Milestone 3 built the company
// itself; this is the team-membership join). `search()` not implemented —
// no free-text field.
export class CompanyMemberRepository extends BaseRepository {
  async findByCompanyAndUser(companyId, userId, _options) {
    throw new Error(`${this.constructor.name}.findByCompanyAndUser() not implemented`);
  }

  async findByCompanyId(companyId, _options) {
    throw new Error(`${this.constructor.name}.findByCompanyId() not implemented`);
  }

  async findByUserId(userId, _options) {
    throw new Error(`${this.constructor.name}.findByUserId() not implemented`);
  }
}

export class PrismaCompanyMemberRepository extends NotSupportedByPrismaRepository {
  constructor() {
    super("CompanyMember");
  }
}

export class MongoCompanyMemberRepository extends CompanyMemberRepository {
  async findById(id, { tx } = {}) {
    return models.CompanyMember.findById(id).session(tx ?? null);
  }

  async findByCompanyAndUser(companyId, userId, { tx } = {}) {
    return models.CompanyMember.findOne({ companyId, userId }).session(tx ?? null);
  }

  async findByCompanyId(companyId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.CompanyMember.find({ companyId }).skip(skip).limit(limit).session(tx ?? null);
  }

  async findByUserId(userId, { tx } = {}) {
    return models.CompanyMember.find({ userId }).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.CompanyMember.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.CompanyMember.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`CompanyMember ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.CompanyMember.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`CompanyMember ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.CompanyMember.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.CompanyMember.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.CompanyMember.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
}
