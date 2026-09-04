import { BaseRepository } from "../base/BaseRepository.js";
import { NotSupportedByPrismaRepository } from "../base/NotSupportedByPrismaRepository.js";
import { normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toMongoPagination, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — greenfield domain, Mongo-only. `search()` not implemented —
// no free-text field on verification cases; use findMany with a status
// filter for the reviewer queue instead.
export class VerificationCaseRepository extends BaseRepository {
  async findBySubject(subjectType, subjectId, _options) {
    throw new Error(`${this.constructor.name}.findBySubject() not implemented`);
  }
}

export class PrismaVerificationCaseRepository extends NotSupportedByPrismaRepository {
  constructor() {
    super("VerificationCase");
  }
}

export class MongoVerificationCaseRepository extends VerificationCaseRepository {
  async findById(id, { tx } = {}) {
    return models.VerificationCase.findById(id).session(tx ?? null);
  }

  async findBySubject(subjectType, subjectId, { tx } = {}) {
    return models.VerificationCase.find({ subjectType, subjectId }).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.VerificationCase.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.VerificationCase.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`VerificationCase ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.VerificationCase.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`VerificationCase ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.VerificationCase.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.VerificationCase.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.VerificationCase.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
}
