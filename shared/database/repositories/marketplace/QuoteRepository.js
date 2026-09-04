import { BaseRepository } from "../base/BaseRepository.js";
import { NotSupportedByPrismaRepository } from "../base/NotSupportedByPrismaRepository.js";
import { normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toMongoPagination, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — greenfield domain, Mongo-only. `search()` not implemented —
// no free-text field on a quote.
export class QuoteRepository extends BaseRepository {
  async findByListingId(listingId, _options) {
    throw new Error(`${this.constructor.name}.findByListingId() not implemented`);
  }

  async findByBuyerId(buyerId, _options) {
    throw new Error(`${this.constructor.name}.findByBuyerId() not implemented`);
  }
}

export class PrismaQuoteRepository extends NotSupportedByPrismaRepository {
  constructor() {
    super("Quote");
  }
}

export class MongoQuoteRepository extends QuoteRepository {
  async findById(id, { tx } = {}) {
    return models.Quote.findById(id).session(tx ?? null);
  }

  async findByListingId(listingId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Quote.find({ listingId }).skip(skip).limit(limit).session(tx ?? null);
  }

  async findByBuyerId(buyerId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Quote.find({ buyerId }).skip(skip).limit(limit).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Quote.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Quote.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Quote ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Quote.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Quote ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Quote.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Quote.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Quote.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
}
