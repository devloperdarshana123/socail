
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { ENV } from "../config/env.js";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const MAX_DEVICES             = 5;
const COUNTABLE_FIELDS        = new Set(["followersCount", "followingCount", "postsCount"]);

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-schema: Cloudinary Media
// ─────────────────────────────────────────────────────────────────────────────

const cloudinaryMediaSchema = new Schema(
  {
    url:      { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-schema: Refresh Token (per device)
//  FIX #2 — store SHA-256 hash of token, never the raw JWT string
// ─────────────────────────────────────────────────────────────────────────────

const refreshTokenSchema = new Schema(
  {
    tokenHash:  { type: String, required: true, select: false },
    deviceInfo: { type: String, default: "unknown" },
    ipAddress:  { type: String, default: null },
    isTrusted:  { type: Boolean, default: false },
    lastUsedAt: { type: Date, default: Date.now },
    createdAt:  { type: Date, default: Date.now },
    expiresAt: {
      type:    Date,
      default: () => new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    },
  },
  { _id: true },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-schema: Active Suspension
//  FIX #6 — proper sub-schema with _id:false so Mongoose validates fields
// ─────────────────────────────────────────────────────────────────────────────

const activeSuspensionSchema = new Schema(
  {
    suspendedAt: { type: Date,                        default: null },
    suspendedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reason:      { type: String,                      default: null },
    duration:    { type: Number,                      default: null }, // days
    expiresAt:   { type: Date,                        default: null },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-schema: Suspension History Entry
//  FIX #7 — select:false prevents leaking in any find() unless explicitly asked
// ─────────────────────────────────────────────────────────────────────────────

const suspensionHistorySchema = new Schema(
  {
    action:      { type: String, enum: ["suspended", "unsuspended", "banned"], required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason:      { type: String, default: null },
    duration:    { type: Number, default: null },
    expiresAt:   { type: Date,   default: null },
    createdAt:   { type: Date,   default: Date.now },
  },
  { _id: true },
);

// ─────────────────────────────────────────────────────────────────────────────
//  User Schema
// ─────────────────────────────────────────────────────────────────────────────

const userSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────

    username: {
      type:      String,
      unique:    true,
      sparse:    true,
      trim:      true,
      lowercase: true,
      minlength: [3,  "Username must be at least 3 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      match: [
        /^[a-z0-9._]+$/,
        "Username can only contain letters, numbers, dots and underscores",
      ],
      index:   true,
      default: null,
    },

    fullName: {
      type:      String,
      required:  [true, "Full name is required"],
      trim:      true,
      maxlength: [60, "Full name cannot exceed 60 characters"],
    },

    email: {
      type:      String,
      unique:    true,
      sparse:    true,
      trim:      true,
      lowercase: true,
      match:     [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
      index:     true,
    },

    phoneNumber: {
      type:   String,
      unique: true,
      sparse: true,
      trim:   true,
      match: [
        /^\+[1-9]\d{6,14}$/,
        "Phone number must be in E.164 format e.g. +919876543210",
      ],
      index: true,
    },

    password: {
      type:      String,
      minlength: [8, "Password must be at least 8 characters"],
      select:    false,
    },

    // ── Firebase / OAuth ──────────────────────────────────────────────────────

    firebaseUid: {
      type:   String,
      unique: true,
      sparse: true,
      index:  true,
    },

    authProvider: {
      type:    String,
      enum:    ["email", "phone", "google", "apple"],
      default: "email",
    },

    // ── Profile ───────────────────────────────────────────────────────────────

    avatar:     { type: cloudinaryMediaSchema, default: null },
    coverPhoto: { type: cloudinaryMediaSchema, default: null },

    bio: {
      type:      String,
      trim:      true,
      maxlength: [150, "Bio cannot exceed 150 characters"],
      default:   "",
    },

    designation: {
      type:      String,
      trim:      true,
      maxlength: [100, "Designation cannot exceed 100 characters"],
      default:   "",
    },

    website: {
      type:      String,
      trim:      true,
      maxlength: [100, "Website URL too long"],
      default:   "",
    },

    gender: {
      type:    String,
      enum:    ["male", "female", "other", "prefer_not_to_say"],
      default: "prefer_not_to_say",
    },

    dateOfBirth: { type: Date, default: null },

    // ── Verification ──────────────────────────────────────────────────────────

    isEmailVerified:  { type: Boolean, default: false },
    isMobileVerified: { type: Boolean, default: false },

    // ── Account Status ────────────────────────────────────────────────────────

    isPrivate:       { type: Boolean, default: false },
    isVerifiedBadge: { type: Boolean, default: false },

    accountStatus: {
      type:    String,
      enum:    ["active", "pending", "suspended", "deactivated", "banned"],
      default: "pending",
      index:   true,
    },

    // ── Suspension ────────────────────────────────────────────────────────────

    // FIX #6 — proper sub-schema, not raw inline object
    activeSuspension: {
      type:    activeSuspensionSchema,
      default: () => ({}),
    },

    // FIX #7 — select:false so it never appears in regular queries
    suspensionHistory: {
      type:    [suspensionHistorySchema],
      select:  false,
      default: [],
    },

    // ── Role ──────────────────────────────────────────────────────────────────

    role: {
      type:    String,
      enum:    ["user", "moderator", "admin", "super_admin"],
      default: "user",
    },

    // ── Onboarding ────────────────────────────────────────────────────────────

    isOnboardingComplete: { type: Boolean, default: false },

    // FIX #13 — Number enum is fragile; custom validator is reliable
    // 1 = registered, waiting for email verify
    // 2 = email verified, waiting for username
    // 3 = complete
    onboardingStep: {
      type:    Number,
      default: 1,
      validate: {
        validator: (v) => [1, 2, 3].includes(v),
        message:   "onboardingStep must be 1, 2, or 3",
      },
    },

    // ── Denormalized Counts (for performance) ─────────────────────────────────

    followersCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },
    postsCount:     { type: Number, default: 0, min: 0 },
    lastActiveAt: { type: Date, default: null, index: true },

    // ── Tokens ────────────────────────────────────────────────────────────────

    refreshTokens: {
      type:    [refreshTokenSchema],
      select:  false,
      default: [],
    },

    // ── Preferences ───────────────────────────────────────────────────────────

    notificationsEnabled: { type: Boolean, default: true },

    language: {
      type:      String,
      default:   "en",
      maxlength: 10,
    },

    // FIX #4  — select:false so it never leaks in responses
    // FIX #8  — select:false prevents bloating every query result
    // FIX #14 — default:[] must be at array level, not inside element definition
    blockedUsers: {
      type:    [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
      select:  false,
    },

    // ── Business Info ─────────────────────────────────────────────────────────

    businessCategory: {
      type:    String,
      enum:    ["marble", "granite", "limestone", "cnc", "quarry", "supplier", "designer", "other"],
      default: null,
      index:   true,
    },

    // ── Location ──────────────────────────────────────────────────────────────

    location: {
      city:    { type: String, trim: true, default: null },
      state:   { type: String, trim: true, default: null },
      country: { type: String, trim: true, default: null },

      // FIX #12 — validate GeoJSON shape so 2dsphere index never rejects a write
      coordinates: {
        type: {
          type:    String,
          enum:    ["Point"],
        },
        coordinates: {
          type: [Number],
          validate: {
            validator: (v) =>
              !v ||
              v.length === 0 ||
              (v.length === 2 &&
                v[0] >= -180 && v[0] <= 180 &&   // longitude
                v[1] >= -90  && v[1] <= 90),      // latitude
            message: "coordinates must be [longitude, latitude] with valid ranges",
          },
        },
      },
    },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Indexes
//  FIX #9  — added role+accountStatus compound index for admin panel queries
//  FIX #10 — username B-tree (exact lookup) + text index both intentionally kept
// ─────────────────────────────────────────────────────────────────────────────

// Full-text search on username + fullName
userSchema.index({ username: "text", fullName: "text" });

// Compound query indexes
userSchema.index({ accountStatus: 1, createdAt: -1 });
userSchema.index({ businessCategory: 1, accountStatus: 1 });
userSchema.index({ role: 1, accountStatus: 1 }); // FIX #9 — admin panel queries

// Geo index — sparse so docs without coordinates are skipped cleanly
userSchema.index({ "location.coordinates": "2dsphere" }, { sparse: true });

// NOTE: username has both a B-tree index (field-level, exact lookups) and
// appears in the text index (for search). Both are intentional:
// - B-tree → used by findByUsername() for O(log n) exact match
// - Text   → used by searchUsers() for ranked full-text search

// ─────────────────────────────────────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────────────────────────────────────

userSchema.virtual("hasPassword").get(function () {
  return !!this.password;
});

userSchema.virtual("avatarUrl").get(function () {
  return this.avatar?.url || null;
});

// ─────────────────────────────────────────────────────────────────────────────
//  Pre-save Hook — password hashing
//  FIX #15 — wrapped in try/catch so bcrypt errors surface properly
// ─────────────────────────────────────────────────────────────────────────────

userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  try {
    const salt    = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (err) {
    throw new Error(`Password hashing failed: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Private Helper
// ─────────────────────────────────────────────────────────────────────────────

/** SHA-256 hash of a raw token string — used for secure storage & lookup */
function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
//  Instance Methods
// ─────────────────────────────────────────────────────────────────────────────

/** Compare plain-text password with stored bcrypt hash */
userSchema.methods.isPasswordCorrect = async function (plainPassword) {
  if (!this.password) return false;
  return bcrypt.compare(plainPassword, this.password);
};

/**
 * Generate short-lived Access Token.
 * FIX #5 — payload contains only _id + role (no PII that can go stale or leak in logs)
 * Controllers must fetch fresh user data from DB/cache — never trust token payload for PII.
 */
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { _id: this._id, role: this.role },
   ENV.ACCESS_TOKEN_SECRET,
{ expiresIn: ENV.ACCESS_TOKEN_EXPIRY },
  );
};


userSchema.methods.generateRefreshToken = async function (
  deviceInfo = "unknown",
  ipAddress  = null,
) {
  try {
    const rawToken = jwt.sign(
      { _id: this._id },
    ENV.REFRESH_TOKEN_SECRET,
{ expiresIn: ENV.REFRESH_TOKEN_EXPIRY },
    );

    const tokenHash = hashToken(rawToken);
    const now       = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRY_MS);

    await this.constructor.findByIdAndUpdate(this._id, {
      $pull: { refreshTokens: { expiresAt: { $lte: now } } },
    });

    await this.constructor.findByIdAndUpdate(this._id, {
      $push: {
        refreshTokens: {
          $each : [{ tokenHash, deviceInfo, ipAddress, isTrusted: false, lastUsedAt: now, createdAt: now, expiresAt }],
          $slice: -MAX_DEVICES,
        },
      },
    });

    return rawToken;

  } catch (err) {
    console.error("=== generateRefreshToken CRASH ===", err.message, err.stack);
    throw err;
  }
};
/**
 * Update lastUsedAt on token use.
 * FIX #1 — atomic positional update; no double-load
 */
userSchema.methods.touchRefreshToken = function (rawToken) {
  const tokenHash = hashToken(rawToken);
  return this.constructor.findOneAndUpdate(
    { _id: this._id, "refreshTokens.tokenHash": tokenHash },
    { $set: { "refreshTokens.$.lastUsedAt": new Date() } },
  );
};

/**
 * Remove a single refresh token (logout from one device).
 * FIX #1 — atomic $pull; no double-load
 */
userSchema.methods.removeRefreshToken = function (rawToken) {
  const tokenHash = hashToken(rawToken);
  return this.constructor.findByIdAndUpdate(this._id, {
    $pull: { refreshTokens: { tokenHash } },
  });
};

/**
 * Remove all refresh tokens (logout from all devices).
 * FIX #1 — atomic $set; no double-load
 */
userSchema.methods.removeAllRefreshTokens = function () {
  return this.constructor.findByIdAndUpdate(this._id, {
    $set: { refreshTokens: [] },
  });
};

userSchema.methods.removeOtherRefreshTokens = function (currentRawToken) {
  if (!currentRawToken) {
    // No current token identifiable — wipe everything
    return this.removeAllRefreshTokens();
  }
  const currentHash = hashToken(currentRawToken);
  return this.constructor.findByIdAndUpdate(this._id, {
    $pull: { refreshTokens: { tokenHash: { $ne: currentHash } } },
  });
};



/**
 * Safe public object for API responses.
 * FIX #4 — blockedUsers excluded (privacy: blocked user must not know they're blocked)
 * FIX #7 — suspensionHistory excluded (admin-only via select("+suspensionHistory"))
 */
userSchema.methods.toSafeObject = function () {
  return {
    _id:                  this._id,
    username:             this.username,
    fullName:             this.fullName,
    email:                this.email            || null,
    phoneNumber:          this.phoneNumber      || null,
    avatar:               this.avatar           || null,
    avatarUrl:            this.avatarUrl,
    coverPhoto:           this.coverPhoto       || null,
    bio:                  this.bio,
    designation:          this.designation      || "",
    website:              this.website,
    gender:               this.gender,
    dateOfBirth:          this.dateOfBirth,
    isEmailVerified:      this.isEmailVerified,
    isMobileVerified:     this.isMobileVerified,
    isPrivate:            this.isPrivate,
    isVerifiedBadge:      this.isVerifiedBadge,
    accountStatus:        this.accountStatus,
    isOnboardingComplete: this.isOnboardingComplete,
    onboardingStep:       this.onboardingStep,
    role:                 this.role,
    authProvider:         this.authProvider,
    followersCount:       this.followersCount,
    followingCount:       this.followingCount,
    postsCount:           this.postsCount,
    notificationsEnabled: this.notificationsEnabled,
    language:             this.language,
    businessCategory:     this.businessCategory || null,
    location:             this.location         || null,
    createdAt:            this.createdAt,
    // ❌ Intentionally excluded:
    // password            → never expose
    // refreshTokens       → select:false + server-only
    // firebaseUid         → internal identifier
    // blockedUsers        → privacy: use dedicated GET /me/blocked endpoint
    // suspensionHistory   → admin-only: use .select("+suspensionHistory")
    // __v                 → internal Mongoose version key
  };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────────────────────────────────────

userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

userSchema.statics.findByUsername = function (username) {
  return this.findOne({ username: username.toLowerCase().trim() });
};

userSchema.statics.findByPhone = function (phoneNumber) {
  return this.findOne({ phoneNumber });
};

userSchema.statics.findByFirebaseUid = function (firebaseUid) {
  return this.findOne({ firebaseUid });
};

/**
 * Find user by raw refresh token (hashes it first for DB lookup).
 * FIX #2 — lookup by tokenHash, never by raw token value
 */
userSchema.statics.findByRefreshToken = function (rawToken) {
  const tokenHash = hashToken(rawToken);
  return this.findOne({ "refreshTokens.tokenHash": tokenHash }).select("+refreshTokens");
};

/**
 * Public profile — excludes all sensitive fields.
 * FIX #16 — also excludes suspensionHistory and blockedUsers
 */
userSchema.statics.getPublicProfile = function (userId) {
  return this.findById(userId).select(
    "-password -refreshTokens -firebaseUid -__v -suspensionHistory -blockedUsers",
  );
};

/**
 * Full-text user search with safety guards.
 * FIX #10 — minimum query length prevents empty/single-char $text queries crashing MongoDB
 */
userSchema.statics.searchUsers = function (query, limit = 20) {
  const q = query?.trim();
  if (!q || q.length < 2) return Promise.resolve([]);

  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50);

  return this.find(
    { $text: { $search: q }, accountStatus: "active" },
    { score: { $meta: "textScore" } },
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(safeLimit)
    .select("username fullName avatar isVerifiedBadge isPrivate followersCount");
};

/**
 * Safely increment/decrement a denormalized count field.
 * FIX #3 — whitelist check prevents arbitrary field writes / NoSQL injection
 */
userSchema.statics.updateCount = function (userId, field, value) {
  if (!COUNTABLE_FIELDS.has(field)) {
    throw new Error(
      `Invalid count field: "${field}". Allowed: ${[...COUNTABLE_FIELDS].join(", ")}`,
    );
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("updateCount: value must be a finite number");
  }
  return this.findByIdAndUpdate(
    userId,
    { $inc: { [field]: value } },
    { returnDocument: "after", new: true },
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Model Export (hot-reload safe for Next.js / serverless)
// ─────────────────────────────────────────────────────────────────────────────

const User = models.User || model("User", userSchema);
export default User;