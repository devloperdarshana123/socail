import { BaseRepository } from "../base/BaseRepository.js";
import { NotSupportedByPrismaRepository } from "../base/NotSupportedByPrismaRepository.js";
import { normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toMongoPagination, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — greenfield domain, Mongo-only. `search()` not implemented —
// no free-text field on an order.
export class OrderRepository extends BaseRepository {
  async findByBuyerId(buyerId, _options) {
    throw new Error(`${this.constructor.name}.findByBuyerId() not implemented`);
  }

  async findBySellerId(sellerId, _options) {
    throw new Error(`${this.constructor.name}.findBySellerId() not implemented`);
  }
}

export class PrismaOrderRepository extends NotSupportedByPrismaRepository {
  constructor() {
    super("Order");
  }
}

export class MongoOrderRepository extends OrderRepository {
  async findById(id, { tx } = {}) {
    return models.Order.findById(id).session(tx ?? null);
  }

  async findByBuyerId(buyerId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Order.find({ buyerId }).sort({ createdAt: -1 }).skip(skip).limit(limit).session(tx ?? null);
  }

  async findBySellerId(sellerId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Order.find({ sellerId }).sort({ createdAt: -1 }).skip(skip).limit(limit).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Order.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Order.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Order ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Order.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Order ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Order.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Order.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Order.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
}
