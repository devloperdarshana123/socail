export const applyComplianceIndexes = {
  report(schema) {
    schema.index({ status: 1, priority: 1, createdAt: -1 }); // moderation queue ordering
    schema.index({ reportedById: 1, targetType: 1, targetId: 1 }, { unique: true });
  },

  suspensionHistory(schema) {
    schema.index({ userId: 1, createdAt: -1 });
  },

  auditLog(schema) {
    schema.index({ performedById: 1, createdAt: -1 });
    schema.index({ targetType: 1, targetId: 1 });
    schema.index({ category: 1 });
  },

  consent(schema) {
    schema.index({ sessionId: 1, policyVersion: 1 }, { unique: true });
    // Partial TTL: only anonymous/guest consent records expire — a
    // logged-in user's consent history is a retained GDPR record.
    schema.index(
      { guestExpiresAt: 1 },
      { expireAfterSeconds: 0, partialFilterExpression: { userId: null } }
    );
  },
};
