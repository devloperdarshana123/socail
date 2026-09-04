import { BaseRepository } from "../base/BaseRepository.js";
import { NotSupportedByPrismaRepository } from "../base/NotSupportedByPrismaRepository.js";
import { normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toMongoPagination, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — greenfield domain, Mongo-only. `search()` not implemented —
// no free-text field on a contract.
export class ContractRepository extends BaseRepository {
  async findByOrderId(orderId, _options) {
    throw new Error(`${this.constructor.name}.findByOrderId() not implemented`);
  }
}

export class PrismaContractRepository extends NotSupportedByPrismaRepository {
  constructor() {
    super("Contract");
  }
}

export class MongoContractRepository extends ContractRepository {
  async findById(id, { tx } = {}) {
    return models.Contract.findById(id).session(tx ?? null);
  }

  async findByOrderId(orderId, { tx } = {}) {
    return models.Contract.findOne({ orderId }).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Contract.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Contract.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Contract ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Contract.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Contract ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Contract.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Contract.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Contract.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
}
