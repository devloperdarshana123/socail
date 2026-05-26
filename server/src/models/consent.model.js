
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Validators
// ─────────────────────────────────────────────

// FIX #6 — IPv4 / IPv6 only (null allowed — field is optional)
const isValidIp = (v) =>
  v === null ||
  /^(\d{1,3}\.){3}\d{1,3}$/.test(v) ||          // IPv4
  /^[\da-fA-F:]+$/.test(v);                       // IPv6 (simplified; full RFC regex is ~800 chars)

// FIX #8 — policyVersion must be semver-style: "1.0", "2.11", etc.
const isValidPolicyVersion = (v) => /^\d+\.\d+$/.test(v);

// FIX #9 — block HTML chars that enable stored XSS in admin dashboards
const noHtmlChars = (v) => !v || !/[<>"']/.test(v);

// ─────────────────────────────────────────────
//  Consent Schema
// ─────────────────────────────────────────────
const consentSchema = new Schema(
  {
    // ── Identity ─────────────────────────────

    // Authenticated user — null for guests
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      sparse: true,
      // FIX #12 — standalone index removed; covered by compound { userId, policyVersion }
    },

    // FIX #7 — sessionId length-capped; frontend sends a UUID (36 chars)
    sessionId: {
      type: String,
      required: [true, "SessionId is required"],
      maxlength: [128, "SessionId too long"],
      // FIX #12 — standalone index removed; covered by compound { sessionId, policyVersion }
    },

    // ── Consent Flags ─────────────────────────

    // FIX #10 — essential is ALWAYS true; immutable prevents client override
    essential: {
      type: Boolean,
      default: true,
      immutable: true,    // Mongoose: field cannot be changed after first set
    },

    analytics: {
      type: Boolean,
      default: false,
    },

    marketing: {
      type: Boolean,
      default: false,
    },

    // ── Policy Version ────────────────────────

    // FIX #8 — semver-style validation
    policyVersion: {
      type: String,
      required: [true, "policyVersion is required"],
      default: "1.0",
      validate: {
        validator: isValidPolicyVersion,
        message: 'policyVersion must be in "X.Y" format (e.g. "1.0", "2.11")',
      },
    },

    // ── Legal Audit Trail ─────────────────────

    // FIX #6 — IP validated to IPv4/IPv6 format only
    ipAddress: {
      type: String,
      default: null,
      validate: {
        validator: isValidIp,
        message: "ipAddress must be a valid IPv4 or IPv6 address",
      },
    },

    // FIX #9 — HTML chars blocked; keeps admin dashboard safe
    userAgent: {
      type: String,
      default: null,
      maxlength: [500, "User agent too long"],
      validate: {
        validator: noHtmlChars,
        message: "userAgent contains invalid characters",
      },
    },

    // FIX #17 — explicit consent timestamps for GDPR legal proof
    // createdAt ≠ consent given (record may exist with analytics: false)
    consentGivenAt: {
      type: Date,
      default: null,
      // Set when analytics or marketing is toggled to true
    },

    withdrawnAt: {
      type: Date,
      default: null,
      // Set by withdrawConsent() — analytics & marketing both go false
    },

    // FIX #5 — TTL field: set on creation, unset (null) when linked to a real user
    // MongoDB TTL index fires when guestExpiresAt <= now AND userId is null
    // We handle the null-check in the partial TTL index below.
    guestExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────

// FIX #1 — Unique constraint: one consent record per (sessionId, policyVersion)
// This is the primary write target; upsertConsent uses this as the filter key.
consentSchema.index(
  { sessionId: 1, policyVersion: 1 },
  { unique: true, name: "unique_session_policy" },
);

// FIX #11 — Compound index for getLatest / hasValidConsent (userId-based lookups)
consentSchema.index(
  { userId: 1, policyVersion: 1 },
  { sparse: true, name: "user_policy_lookup" },
);

// FIX #5 — TTL index for orphaned guest records
// Fires on guestExpiresAt field; only documents where the field is set (non-null)
// are eligible. Documents linked to a real user have guestExpiresAt: null → TTL
// index ignores them automatically (MongoDB TTL skips null date fields).
consentSchema.index(
  { guestExpiresAt: 1 },
  { expireAfterSeconds: 0, sparse: true, name: "guest_record_ttl" },
);

// ─────────────────────────────────────────────
//  Pre-save Hook
// ─────────────────────────────────────────────

// FIX #10 — belt-and-suspenders: reset essential to true even if immutable was bypassed
consentSchema.pre("save", function (next) {
  if (this.essential !== true) this.essential = true;
  next();
});

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

/**
 * FIX #4 — Atomic upsert: create or update consent for a session.
 * This is the ONLY way consent should be written — never call .create() directly.
 *
 * @param {string}    sessionId
 * @param {string}    policyVersion
 * @param {object}    flags           — { analytics, marketing }
 * @param {object}    meta            — { ipAddress, userAgent, userId? }
 * @returns {Promise<Document>}       lean consent record
 */
consentSchema.statics.upsertConsent = async function (
  sessionId,
  policyVersion,
  { analytics = false, marketing = false } = {},
  { ipAddress = null, userAgent = null, userId = null } = {},
) {
  const consentGivenAt =
    analytics || marketing ? new Date() : null;

  // Guest records get a 90-day expiry; linked records get null (TTL skips them)
  const guestExpiresAt = userId
    ? null
    : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  return this.findOneAndUpdate(
    { sessionId, policyVersion },
    {
      $set: {
        analytics,
        marketing,
        essential: true,          // always reset — FIX #10
        ipAddress,
        userAgent,
        consentGivenAt,
        withdrawnAt: null,        // clear any prior withdrawal on fresh consent
        guestExpiresAt,
        ...(userId ? { userId } : {}),
      },
      $setOnInsert: {
        sessionId,
        policyVersion,
        createdAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).lean();
};

/**
 * FIX #2 — Link a specific guest session to an authenticated user.
 * Uses updateOne (not updateMany) to target exactly one sessionId.
 * Clears the TTL field so the record is kept permanently.
 *
 * @param {string}    sessionId
 * @param {ObjectId}  userId
 * @returns {Promise<object>}   MongoDB update result
 */
consentSchema.statics.linkToUser = function (sessionId, userId) {
  return this.updateOne(
    { sessionId, userId: null },
    {
      $set: {
        userId,
        guestExpiresAt: null,   // FIX #5: remove TTL so record is kept
      },
    },
  );
};

/**
 * FIX #3 FIX #13 — Get latest consent for an authenticated user.
 * Returns lean object. Use getForGuest() for unauthenticated lookups.
 *
 * @param {ObjectId}  userId
 * @param {string}    policyVersion
 * @returns {Promise<object|null>}
 */
consentSchema.statics.getLatest = function (userId, policyVersion) {
  return this.findOne({ userId, policyVersion })
    .sort({ createdAt: -1 })
    .lean();
};

/**
 * FIX #13 — Get consent for a guest session (no userId).
 *
 * @param {string}  sessionId
 * @param {string}  policyVersion
 * @returns {Promise<object|null>}
 */
consentSchema.statics.getForGuest = function (sessionId, policyVersion) {
  return this.findOne({ sessionId, policyVersion }).lean();
};

/**
 * FIX #15 — Middleware helper: does this user have valid consent for the current policy?
 * Returns true/false — safe to use in Express middleware without async overhead.
 *
 * Usage in middleware:
 *   const ok = await Consent.hasValidConsent(req.user._id, CURRENT_POLICY_VERSION);
 *   if (!ok) return res.status(451).json({ error: "Consent required" });
 *
 * @param {ObjectId}  userId
 * @param {string}    policyVersion
 * @returns {Promise<boolean>}
 */
consentSchema.statics.hasValidConsent = async function (userId, policyVersion) {
  const record = await this.findOne(
    { userId, policyVersion, withdrawnAt: null },
    { _id: 1 },   // minimal projection — we only need existence
  ).lean();
  return record !== null;
};

/**
 * FIX #14 — Update analytics / marketing preferences only.
 * Never touches essential, ipAddress, policyVersion — caller can't override them.
 *
 * @param {string}    sessionId
 * @param {string}    policyVersion
 * @param {object}    prefs         — { analytics?, marketing? }
 * @returns {Promise<object|null>}  updated lean record
 */
consentSchema.statics.updatePreferences = function (
  sessionId,
  policyVersion,
  { analytics, marketing } = {},
) {
  const update = {};
  if (typeof analytics === "boolean") update.analytics = analytics;
  if (typeof marketing === "boolean") update.marketing = marketing;

  if (!Object.keys(update).length) return Promise.resolve(null);

  // Update consentGivenAt if any flag is being turned on
  const turningOn = update.analytics || update.marketing;
  if (turningOn) update.consentGivenAt = new Date();

  return this.findOneAndUpdate(
    { sessionId, policyVersion },
    { $set: update },
    { new: true, runValidators: true },
  ).lean();
};

/**
 * FIX #16 — GDPR withdraw consent.
 * Sets analytics and marketing to false, records withdrawnAt timestamp.
 *
 * @param {string}    sessionId
 * @param {string}    policyVersion
 * @returns {Promise<object|null>}  updated lean record
 */
consentSchema.statics.withdrawConsent = function (sessionId, policyVersion) {
  return this.findOneAndUpdate(
    { sessionId, policyVersion },
    {
      $set: {
        analytics: false,
        marketing: false,
        withdrawnAt: new Date(),
      },
    },
    { new: true },
  ).lean();
};

/**
 * Delete all consent records for a user — account deletion GDPR cascade.
 *
 * @param {ObjectId}  userId
 * @returns {Promise<{ deletedCount: number }>}
 */
consentSchema.statics.deleteAllForUser = async function (userId) {
  const result = await this.deleteMany({ userId });
  return { deletedCount: result.deletedCount };
};

/**
 * Admin helper: count records by type (for compliance dashboard).
 *
 * @returns {Promise<object>}
 */
consentSchema.statics.getStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        linked: {
          $sum: { $cond: [{ $ne: ["$userId", null] }, 1, 0] },
        },
        guests: {
          $sum: { $cond: [{ $eq: ["$userId", null] }, 1, 0] },
        },
        analyticsOptIn: {
          $sum: { $cond: ["$analytics", 1, 0] },
        },
        marketingOptIn: {
          $sum: { $cond: ["$marketing", 1, 0] },
        },
        withdrawn: {
          $sum: { $cond: [{ $ne: ["$withdrawnAt", null] }, 1, 0] },
        },
      },
    },
    { $project: { _id: 0 } },
  ]);
};

// ─────────────────────────────────────────────
const Consent = models.Consent || model("Consent", consentSchema);
export default Consent;