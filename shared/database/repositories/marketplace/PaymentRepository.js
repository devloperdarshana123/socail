import { BaseRepository } from "../base/BaseRepository.js";
import { NotSupportedByPrismaRepository } from "../base/NotSupportedByPrismaRepository.js";
import { normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toMongoPagination, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — greenfield domain, Mongo-only. `search()` not implemented —
// no free-text field on a payment; look up by providerTransactionId
// instead, which is what a payment-provider webhook actually has.
export class PaymentRepository extends BaseRepository {
  async findByOrderId(orderId, _options) {
    throw new Error(`${this.constructor.name}.findByOrderId() not implemented`);
  }

  async findByProviderTransactionId(providerTransactionId, _options) {
    throw new Error(`${this.constructor.name}.findByProviderTransactionId() not implemented`);
  }
}

export class PrismaPaymentRepository extends NotSupportedByPrismaRepository {
  constructor() {
    super("Payment");
  }
}

export class MongoPaymentRepository extends PaymentRepository {
  async findById(id, { tx } = {}) {
    return models.Payment.findById(id).session(tx ?? null);
  }

  async findByOrderId(orderId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Payment.find({ orderId }).skip(skip).limit(limit).session(tx ?? null);
  }

  async findByProviderTransactionId(providerTransactionId, { tx } = {}) {
    return models.Payment.findOne({ providerTransactionId }).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Payment.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Payment.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Payment ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Payment.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Payment ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Payment.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Payment.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Payment.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
}
