import { BaseRepository } from "../base/BaseRepository.js";
import { NotSupportedByPrismaRepository } from "../base/NotSupportedByPrismaRepository.js";
import { normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toMongoPagination, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — greenfield domain, Mongo-only. Completes the `verification`
// domain alongside VerificationCaseRepository — this is the sensitive,
// rarely-read half isolated for stricter access control/retention
// (Milestone 2, Group 3 — GDPR special-category data).
export class VerificationDocumentRepository extends BaseRepository {
  async findByCaseId(caseId, _options) {
    throw new Error(`${this.constructor.name}.findByCaseId() not implemented`);
  }
}

export class PrismaVerificationDocumentRepository extends NotSupportedByPrismaRepository {
  constructor() {
    super("VerificationDocument");
  }
}

export class MongoVerificationDocumentRepository extends VerificationDocumentRepository {
  async findById(id, { tx } = {}) {
    return models.VerificationDocument.findById(id).session(tx ?? null);
  }

  async findByCaseId(caseId, { tx } = {}) {
    return models.VerificationDocument.find({ caseId }).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.VerificationDocument.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.VerificationDocument.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`VerificationDocument ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.VerificationDocument.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`VerificationDocument ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.VerificationDocument.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.VerificationDocument.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.VerificationDocument.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
}
