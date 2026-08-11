import { Schema } from "mongoose";
import { mediaSchema } from "./subdocuments/index.js";
import { timestampsPlugin, jsonTransformPlugin } from "../plugins/index.js";
import { emailValidator, urlValidator } from "../validators/index.js";
import { ACCOUNT_STATUS, AUTH_PROVIDER, OTP_PURPOSE } from "../constants/index.js";
import { applyIdentityIndexes } from "../indexes/identity.indexes.js";

// ─────────────────────────────────────────────
//  users — the whole user record, matching the Postgres User model field
//  for field.
//
//  Milestone 2 originally split this in two, keeping auth-critical fields
//  here and moving the display half to `profiles`, on the reasoning that a
//  smaller document is cheaper to read on every authenticated request.
//  Final verification retired that split, for three reasons:
//
//   1. It was never wired to anything. `profileRepository` has zero
//      importers, in either service. Nothing has ever read or written a
//      profile document — so the "cheaper auth read" was never paid for by a
//      corresponding profile read, and the display fields were simply
//      missing at runtime.
//   2. Every consumer addresses these as User fields, because the helper
//      layer is shared with Postgres, where they ARE User columns.
//      `userRepository.update(id, { followingCount: { inc: 1 } })` and
//      `select: { fullName: true }` appear across eight helpers and 18
//      relation projections. Serving those from a second collection needs a
//      join on the hottest read paths in the product.
//   3. Mongoose strict mode drops writes to undeclared paths in silence, so
//      the split did not fail loudly — follow counters simply never moved,
//      and author blocks simply came back empty.
//
//  The fields below are small, low-churn and read on nearly every request:
//  the textbook case for keeping them on the document rather than joining
//  for them. `profiles` remains defined but is no longer a source of truth
//  for anything — see its comment.
// ─────────────────────────────────────────────
export const userSchema = new Schema(
  {
    username: { type: String, unique: true, sparse: true, trim: true, minlength: 3, maxlength: 30 },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true, validate: emailValidator },
    phoneNumber: { type: String, unique: true, sparse: true, trim: true },
    passwordHash: { type: String, select: false },
    firebaseUid: { type: String, unique: true, sparse: true },
    authProvider: { type: String, enum: AUTH_PROVIDER, default: "email" },

    isEmailVerified: { type: Boolean, default: false },
    isMobileVerified: { type: Boolean, default: false },

    accountStatus: { type: String, enum: ACCOUNT_STATUS, default: "pending" },

    // Postgres stores `role` as a plain string and the whole application
    // compares it as one (`user.role === "super_admin"`, and filters like
    // `role: { not: "super_admin" }`). Milestone 2 modelled it as an embedded
    // `{ roleId, roleKey }`, which made every one of those comparisons false
    // and every one of those filters a cast error — the repository had to
    // rewrite `role` to `role.roleKey` on the way in, and nothing rewrote it
    // on the way out. The denormalized key IS the field now, and the
    // reference to `roles` sits beside it under its own name, which is what
    // roleReference.schema.js was always caching anyway.
    role: { type: String, default: "user" },
    roleId: { type: Schema.Types.ObjectId, ref: "Role" },

    // ── Profile ───────────────────────────────────────────────────────────
    // These carry the same names and meanings as the Postgres User columns.
    // See the collection comment above for why they are here and not on
    // `profiles`.
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    avatar: { type: mediaSchema },
    coverPhoto: { type: mediaSchema },
    bio: { type: String, default: "", maxlength: 500 },
    designation: { type: String, default: "", maxlength: 120 },
    website: { type: String, default: "", validate: urlValidator },
    gender: { type: String, default: "prefer_not_to_say" },
    dateOfBirth: { type: Date },
    businessCategory: { type: String },
    // Free-form on Postgres (Json). Kept permissive here for the same reason:
    // settingsHelpers writes whatever the client sends plus an optional
    // geocoded `coordinates` point, and pinning a shape would reject rows
    // Postgres accepts.
    location: { type: Schema.Types.Mixed },

    isPrivate: { type: Boolean, default: false },
    isVerifiedBadge: { type: Boolean, default: false },

    followersCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },
    postsCount: { type: Number, default: 0, min: 0 },

    isOnboardingComplete: { type: Boolean, default: false },
    onboardingStep: { type: Number, default: 1, min: 1 },

    notificationsEnabled: { type: Boolean, default: true },
    language: { type: String, default: "en" },

    activeSuspension: {
      reason: { type: String },
      expiresAt: { type: Date },
    },
    deactivatedAt: { type: Date },
    lastActiveAt: { type: Date },
  }
);
// Reverse-populate virtual: User.findById(id).populate('profile')
userSchema.virtual("profile", {
  ref: "Profile",
  localField: "_id",
  foreignField: "userId",
  justOne: true,
});
userSchema.plugin(timestampsPlugin);
userSchema.plugin(jsonTransformPlugin);
userSchema.pre("validate", function requireOneIdentifier() {
  if (!this.email && !this.phoneNumber && !this.firebaseUid) {
    throw new Error("A user must have at least one of email, phoneNumber, or firebaseUid");
  }
  if (this.authProvider === "email" && !this.passwordHash && !this.firebaseUid) {
    throw new Error('authProvider "email" requires a passwordHash (unless linked via OAuth)');
  }
});
applyIdentityIndexes.user(userSchema);

// ─────────────────────────────────────────────
//  profiles — everything social/display-facing, split out of User.
//  businessCategory/location intentionally do NOT live here — see
//  `companies` and `locations` in ../schemas/companies.schemas.js and
//  verificationLocations.schemas.js.
// ─────────────────────────────────────────────
// DEPRECATED — retained only so existing deployments and the Milestone 2
// design document still resolve the model name. Every field it used to hold
// now lives on `users` (see that comment for why). Nothing reads or writes
// this collection: `profileRepository` has no importers, and the repository's
// Mongo methods are unreachable from the application.
//
// Left in place rather than deleted because removing a collection from the
// 37-collection design is a schema-migration decision, not a bug fix. It
// holds no fields that duplicate `users`, so it cannot drift out of sync.
export const profileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  }
);
profileSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});
profileSchema.plugin(timestampsPlugin);
profileSchema.plugin(jsonTransformPlugin);
applyIdentityIndexes.profile(profileSchema);

// ─────────────────────────────────────────────
//  sessions — from RefreshToken. Point-lookup by tokenHash, TTL cleanup.
// ─────────────────────────────────────────────
export const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true },
    deviceInfo: { type: String, default: "unknown" },
    ipAddress: { type: String },
    isTrusted: { type: Boolean, default: false },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);
// ── Relation aliases ─────────────────────────────────────────────────────
// The application names its relations the way Prisma does — `post.author`,
// `message.sender`, `participant.user`. Mongo stores the FK under
// `authorId`/`senderId`/`userId`, and `populate("authorId")` attaches the
// joined document to THAT name, so `post.author` stayed undefined even on a
// successfully populated read. Every M-10 populate had the same hole.
//
// These virtuals give each relation its Prisma name, so `populate("author")`
// works and the populated document lands where every caller already looks.
sessionSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});
sessionSchema.plugin(jsonTransformPlugin);
applyIdentityIndexes.session(sessionSchema);

// ─────────────────────────────────────────────
//  otps — hashed one-time codes. Authentication-layer verification, not
//  identity verification (see verificationCases in
//  verificationLocations.schemas.js for the KYC/KYB distinction).
// ─────────────────────────────────────────────
export const otpSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    purpose: { type: String, enum: OTP_PURPOSE, required: true },
    hashedOtp: { type: String, required: true, select: false },
    attempts: { type: Number, default: 0, min: 0 },
    resendCount: { type: Number, default: 0, min: 0 },
    lastResendAt: { type: Date },
    isUsed: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  }
);
otpSchema.plugin(timestampsPlugin);
otpSchema.plugin(jsonTransformPlugin);
applyIdentityIndexes.otp(otpSchema);
