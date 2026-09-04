// Adds the isDeleted/deletedAt pair used by socialPosts, comments, stories,
// highlights, marketplaceListings and notifications, plus an opt-in query
// helper. Deliberately does NOT install a default pre-find filter — always
// excluding soft-deleted docs automatically is a business-rule decision
// for the repository layer (Milestone 3+) to make explicitly, not a schema
// default to bake in silently here.
export function softDeletePlugin(schema) {
  schema.add({
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  });

  // Opt-in: Model.find().notDeleted()
  schema.query.notDeleted = function notDeleted() {
    return this.where({ isDeleted: false });
  };
}
