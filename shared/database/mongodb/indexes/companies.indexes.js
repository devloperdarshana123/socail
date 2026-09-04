export const applyCompaniesIndexes = {
  company(schema) {
    schema.index({ ownerId: 1 });
    schema.index({ name: "text", description: "text" }); // directory/marketplace search
    schema.index({ businessCategory: 1 });
    schema.index({ "locationSummary.coordinates": "2dsphere" }); // map view, "near me"
  },

  companyMember(schema) {
    schema.index({ companyId: 1, userId: 1 }, { unique: true });
    schema.index({ userId: 1 }); // "my companies"
  },

  role(schema) {
    // `key` is already unique via the field definition.
    schema.index({ scope: 1 });
  },

  permission(schema) {
    // `key` is already unique via the field definition.
    schema.index({ category: 1 });
  },
};
