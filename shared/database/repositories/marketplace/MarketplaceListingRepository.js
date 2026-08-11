import { BaseRepository } from "../base/BaseRepository.js";
import { NotSupportedByPrismaRepository } from "../base/NotSupportedByPrismaRepository.js";
import { normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toMongoPagination, toMongoSearchFilter, withNotDeleted, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — greenfield domain, Mongo-only. The only repository in this
// layer that combines text search and a geo filter in one method
// (`search()` accepts an optional `near` — "marble slabs near me").
export class MarketplaceListingRepository extends BaseRepository {
  async findByCompanyId(companyId, _options) {
    throw new Error(`${this.constructor.name}.findByCompanyId() not implemented`);
  }
}

export class PrismaMarketplaceListingRepository extends NotSupportedByPrismaRepository {
  constructor() {
    super("MarketplaceListing");
  }
}

export class MongoMarketplaceListingRepository extends MarketplaceListingRepository {
  async findById(id, { tx, includeDeleted = false } = {}) {
    const query = includeDeleted ? {} : { isDeleted: false };
    return models.MarketplaceListing.findOne({ _id: id, ...query }).session(tx ?? null);
  }

  async findByCompanyId(companyId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.MarketplaceListing
      .find(withNotDeleted({ companyId }))
      .skip(skip)
      .limit(limit)
      .session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.MarketplaceListing.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.MarketplaceListing.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`MarketplaceListing ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  /** Soft delete — sets isDeleted/deletedAt, does not remove the document. */
  async delete(id, { tx } = {}) {
    const doc = await models.MarketplaceListing.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true, session: tx }
    );
    if (!doc) throw new NotFoundError(`MarketplaceListing ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx, includeDeleted = false } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    const query = toMongoFilter(includeDeleted ? filter : withNotDeleted(filter));
    return models.MarketplaceListing.find(query).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.MarketplaceListing.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx, includeDeleted = false } = {}) {
    const query = toMongoFilter(includeDeleted ? filter : withNotDeleted(filter));
    return models.MarketplaceListing.countDocuments(query).session(tx ?? null);
  }

  /**
   * @param {{near?: {lng,lat,maxDistanceMeters}}} [options] — optional geo
   * filter. MongoDB does not allow combining `$text` with `$near`/`$geoNear`
   * in one query, so these are two genuinely different code paths, not a
   * merged filter: with `near`, this runs a $geoNear aggregation (falling
   * back to a case-insensitive regex on `title` instead of `$text` for the
   * text portion, since $match after $geoNear can't use $text either);
   * without `near`, it's a plain `$text` find, identical to every other
   * repository's search().
   */
  async search(term, pagination = {}, { tx, near } = {}) {
    const { skip, limit } = toMongoPagination(pagination);

    if (near) {
      const pipeline = [
        {
          $geoNear: {
            near: { type: "Point", coordinates: [near.lng, near.lat] },
            distanceField: "distanceMeters",
            maxDistance: near.maxDistanceMeters ?? 50000,
            key: "locationSummary.coordinates",
            query: withNotDeleted({}),
          },
        },
      ];
      if (term) {
        pipeline.push({ $match: { title: { $regex: term, $options: "i" } } });
      }
      pipeline.push({ $skip: skip }, { $limit: limit });
      return models.MarketplaceListing.aggregate(pipeline).session(tx ?? null);
    }

    const query = { ...withNotDeleted({}), ...toMongoSearchFilter(term) };
    return models.MarketplaceListing.find(query).skip(skip).limit(limit).session(tx ?? null);
  }
}
