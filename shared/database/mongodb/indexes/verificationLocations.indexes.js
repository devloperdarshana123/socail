export const applyVerificationLocationsIndexes = {
  verificationCase(schema) {
    schema.index({ subjectType: 1, subjectId: 1 });
    schema.index({ status: 1 }); // reviewer queue
  },

  verificationDocument(schema) {
    schema.index({ caseId: 1 });
  },

  location(schema) {
    schema.index({ coordinates: "2dsphere" }); // canonical geo index — every $geoNear resolves here
    schema.index({ country: 1, state: 1, city: 1 }); // filtered directory browse
    schema.index({ ownerType: 1, ownerId: 1 });
  },
};
