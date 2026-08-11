import { BaseRepository } from "../base/BaseRepository.js";
import { NotSupportedByPrismaRepository } from "../base/NotSupportedByPrismaRepository.js";
import { normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toMongoPagination, toMongoUpdate, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — greenfield domain, Mongo-only. `findDescendants()`
// demonstrates the materialized-path prefix query the category tree was
// designed around (Phase 2, Group 6) — no recursive join needed.
export class CategoryRepository extends BaseRepository {
  async findBySlug(slug, _options) {
    throw new Error(`${this.constructor.name}.findBySlug() not implemented`);
  }

  async findChildren(parentId, _options) {
    throw new Error(`${this.constructor.name}.findChildren() not implemented`);
  }

  async findDescendants(path, _options) {
    throw new Error(`${this.constructor.name}.findDescendants() not implemented`);
  }
}

export class PrismaCategoryRepository extends NotSupportedByPrismaRepository {
  constructor() {
    super("Category");
  }
}

export class MongoCategoryRepository extends CategoryRepository {
  async findById(id, { tx } = {}) {
    return models.Category.findById(id).session(tx ?? null);
  }

  async findBySlug(slug, { tx } = {}) {
    return models.Category.findOne({ slug }).session(tx ?? null);
  }

  async findChildren(parentId, { tx } = {}) {
    return models.Category.find({ parentId }).session(tx ?? null);
  }

  /** Every category at or below `path`, via a prefix match — no recursive join. */
  async findDescendants(path, { tx } = {}) {
    return models.Category.find({ path: { $regex: `^${path}` } }).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.Category.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.Category.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`Category ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.Category.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`Category ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Category.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.Category.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.Category.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }

  async search(term, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.Category.find({ name: { $regex: term, $options: "i" } }).skip(skip).limit(limit).session(tx ?? null);
  }
}
