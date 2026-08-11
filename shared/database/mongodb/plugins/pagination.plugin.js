// Adds a generic Model.paginate(filter, { page, limit, sort }) static.
// Applied to the high-volume, list-rendered collections: socialPosts,
// comments, marketplaceListings, orders, notifications, auditLogs,
// reports. Deliberately generic (no collection-specific filtering rules —
// those are repository-layer concerns for Milestone 3+).
export function paginationPlugin(schema) {
  schema.statics.paginate = async function paginate(filter = {}, options = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(options.limit || 20, 100));
    const sort = options.sort || { createdAt: -1 };

    const [docs, total] = await Promise.all([
      this.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      this.countDocuments(filter),
    ]);

    return {
      docs,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  };
}
