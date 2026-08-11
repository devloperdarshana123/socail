// Index strategy for the Identity & Access group (users, profiles,
// sessions, otps). Kept separate from field definitions per Milestone 2,
// Step 5, so the whole index surface can be reviewed/audited as one unit —
// see the Phase 2 architecture doc, §6, for the reasoning behind each one.
//
// Deduplication check: `username`/`email`/`phoneNumber`/`firebaseUid` are
// each declared unique+sparse exactly once, directly on their own field
// (not repeated here) — nothing below re-declares those. No index in this
// file overlaps another.
export const applyIdentityIndexes = {
  user(schema) {
    schema.index({ accountStatus: 1 }); // admin filtering
    schema.index({ role: 1 }); // explore/admin filter on role
    // People search. Moved here from profile() with the field itself — the
    // profiles collection no longer holds fullName.
    schema.index({ fullName: "text" });
  },

  profile(schema) {
    // Deprecated collection — no indexes. See profileSchema's comment.
  },

  session(schema) {
    // tokenHash is already unique via the field definition (point lookup).
    schema.index({ userId: 1 }); // device/session list
    schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
  },

  otp(schema) {
    schema.index({ userId: 1, purpose: 1 }, { unique: true });
    schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
  },
};
