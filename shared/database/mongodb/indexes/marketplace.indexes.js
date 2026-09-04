export const applyMarketplaceIndexes = {
  category(schema) {
    // slug is already unique+sparse via the field definition.
    schema.index({ path: 1 }); // ancestor/descendant prefix queries
    schema.index({ parentId: 1 });
  },

  marketplaceListing(schema) {
    schema.index({ companyId: 1, status: 1 }); // seller storefront
    schema.index({ categoryId: 1 });
    schema.index({ "locationSummary.coordinates": "2dsphere" }); // "listings near me"
    schema.index({ title: "text", description: "text" }); // marketplace search
  },

  quote(schema) {
    schema.index({ listingId: 1 });
    schema.index({ buyerId: 1 });
    // Partial TTL: only unresolved quotes expire — an accepted quote must
    // never be silently deleted.
    schema.index(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, partialFilterExpression: { status: "requested" } }
    );
  },

  order(schema) {
    schema.index({ buyerId: 1, createdAt: -1 });
    schema.index({ sellerId: 1, createdAt: -1 });
    schema.index({ status: 1 });
  },

  contract(schema) {
    schema.index({ orderId: 1 });
    schema.index({ status: 1 });
  },

  payment(schema) {
    // providerTransactionId is already unique via the field definition.
    schema.index({ orderId: 1 });
    schema.index({ status: 1 });
  },
};
