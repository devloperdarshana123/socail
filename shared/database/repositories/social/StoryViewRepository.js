import { BaseRepository } from "../base/BaseRepository.js";
import { normalizePrismaError, normalizeMongoError, NotFoundError } from "../errors/index.js";
import { toPrismaPagination, toMongoPagination, toPrismaWhere, toPrismaData, toMongoUpdate, toMongoProjection, toMongoDocument, toMongoFilter } from "../queryHelpers/index.js";
import { models } from "../../mongodb/index.js";

// Interface — story view/reaction events. Postgres: StoryView model.
// Mongo: `storyViews`. `search()` not implemented — analytics event, no
// free-text field.
export class StoryViewRepository extends BaseRepository {
  async findByStoryId(storyId, _options) {
    throw new Error(`${this.constructor.name}.findByStoryId() not implemented`);
  }

  async findByStoryAndViewer(storyId, viewerId, _options) {
    throw new Error(`${this.constructor.name}.findByStoryAndViewer() not implemented`);
  }

  // Phase 7A additions (server's storyHelpers migration). Distinct from
  // findByStoryId above, which returns bare rows with offset pagination and
  // no ordering. Mongo-backed implementations deferred — see
  // MongoStoryViewRepository below.
  async findViewedByViewer(storyIds, viewerId, _options) {
    throw new Error(`${this.constructor.name}.findViewedByViewer() not implemented`);
  }

  async findViewersWithProfile(storyId, _options) {
    throw new Error(`${this.constructor.name}.findViewersWithProfile() not implemented`);
  }

  async updateByStoryAndViewer(storyId, viewerId, data, _options) {
    throw new Error(`${this.constructor.name}.updateByStoryAndViewer() not implemented`);
  }
}

// The viewer projection attached to story-viewer rows.
const STORY_VIEWER_SELECT = {
  id: true,
  username: true,
  fullName: true,
  avatar: true,
  isVerifiedBadge: true,
};

export class PrismaStoryViewRepository extends StoryViewRepository {
  constructor(prismaClient) {
    super();
    this.prismaClient = prismaClient;
  }

  async findById(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.storyView.findUnique({ where: { id } });
  }

  async findByStoryId(storyId, { tx, pagination = {} } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.storyView.findMany({ where: { storyId }, skip, take });
  }

  // `storyId` + `viewerId` is a compound unique in the Postgres schema
  // (StoryView @@unique([storyId, viewerId])), so findFirst returns the
  // same single row or null a compound-key findUnique would.
  async findByStoryAndViewer(storyId, viewerId, { tx, select } = {}) {
    const client = tx ?? this.prismaClient;
    return client.storyView.findFirst({
      where: { storyId, viewerId },
      ...(select ? { select } : {}),
    });
  }

  // getViewedStories: batch viewed/reaction lookup for one viewer across
  // many stories. DELIBERATELY UNBOUNDED — the caller builds a Map of the
  // full result, so routing this through findMany() would silently cap it
  // at toPrismaPagination()'s default limit of 20.
  async findViewedByViewer(storyIds, viewerId, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.storyView.findMany({
      where: { storyId: { in: storyIds }, viewerId },
      select: { storyId: true, reaction: true },
    });
  }

  // getStoryViewers: most-recent viewers of a story with their profiles.
  async findViewersWithProfile(storyId, { tx, limit } = {}) {
    const client = tx ?? this.prismaClient;
    return client.storyView.findMany({
      where: { storyId },
      orderBy: { viewedAt: "desc" },
      take: limit,
      select: {
        viewer: { select: STORY_VIEWER_SELECT },
        reaction: true,
        viewedAt: true,
      },
    });
  }

  // reactToStory's duplicate-race recovery: update by the compound key
  // rather than by row id, since the id is unknown when the race is lost.
  async updateByStoryAndViewer(storyId, viewerId, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.storyView.update({
        where: { storyId_viewerId: { storyId, viewerId } },
        data: toPrismaData(data),
      });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async create(data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.storyView.create({ data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.storyView.update({ where: { id }, data: toPrismaData(data) });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    try {
      return await client.storyView.delete({ where: { id } });
    } catch (err) {
      throw normalizePrismaError(err);
    }
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    const { skip, take } = toPrismaPagination(pagination);
    return client.storyView.findMany({ where: toPrismaWhere(filter), skip, take });
  }

  async exists(filter, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return (await client.storyView.count({ where: toPrismaWhere(filter) })) > 0;
  }

  async count(filter = {}, { tx } = {}) {
    const client = tx ?? this.prismaClient;
    return client.storyView.count({ where: toPrismaWhere(filter) });
  }
}

export class MongoStoryViewRepository extends StoryViewRepository {
  async findById(id, { tx } = {}) {
    return models.StoryView.findById(id).session(tx ?? null);
  }

  async findByStoryId(storyId, { tx, pagination = {} } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.StoryView.find({ storyId }).skip(skip).limit(limit).session(tx ?? null);
  }

  async findByStoryAndViewer(storyId, viewerId, { tx } = {}) {
    return models.StoryView.findOne({ storyId, viewerId }).session(tx ?? null);
  }

  async create(data, { tx } = {}) {
    try {
      const [doc] = await models.StoryView.create([toMongoDocument(data)], { session: tx });
      return doc;
    } catch (err) {
      throw normalizeMongoError(err);
    }
  }

  async update(id, data, { tx } = {}) {
    try {
      const doc = await models.StoryView.findByIdAndUpdate(id, toMongoUpdate(data), { new: true, runValidators: true, session: tx });
      if (!doc) throw new NotFoundError(`StoryView ${id} not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

  async delete(id, { tx } = {}) {
    const doc = await models.StoryView.findByIdAndDelete(id, { session: tx });
    if (!doc) throw new NotFoundError(`StoryView ${id} not found`);
    return doc;
  }

  async findMany(filter = {}, pagination = {}, { tx } = {}) {
    const { skip, limit } = toMongoPagination(pagination);
    return models.StoryView.find(toMongoFilter(filter)).skip(skip).limit(limit).session(tx ?? null);
  }

  async exists(filter, { tx } = {}) {
    return (await models.StoryView.exists(toMongoFilter(filter)).session(tx ?? null)) !== null;
  }

  async count(filter = {}, { tx } = {}) {
    return models.StoryView.countDocuments(toMongoFilter(filter)).session(tx ?? null);
  }
  async findViewedByViewer(storyIds, viewerId, { tx } = {}) {
    return models.StoryView.find({ storyId: { $in: storyIds }, viewerId })
      .select("storyId reaction")
      .session(tx ?? null);
  }

  /** M-10: `select: { viewer: { select: … } }` → populate + projection. */
  async findViewersWithProfile(storyId, { tx, limit } = {}) {
    return models.StoryView.find({ storyId })
      .sort({ viewedAt: -1 })
      .limit(limit)
      .select("viewerId reaction viewedAt")
      .populate({ path: "viewer", select: "username fullName avatar isVerifiedBadge" })
      .session(tx ?? null);
  }

  async updateByStoryAndViewer(storyId, viewerId, data, { tx } = {}) {
    try {
      const doc = await models.StoryView.findOneAndUpdate(
        { storyId, viewerId },
        toMongoUpdate(data),
        { new: true, runValidators: true, session: tx },
      );
      if (!doc) throw new NotFoundError(`StoryView (${storyId}, ${viewerId}) not found`);
      return doc;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw normalizeMongoError(err);
    }
  }

}
