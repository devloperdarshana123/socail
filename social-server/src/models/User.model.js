import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import validator from "validator";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

/** Cloudinary ima
 * ge — url + publicId dono store karo */
const imageSchema = new mongoose.Schema(
  {
    url:      { type: String, default: "" },
    publicId: { type: String, default: "" },
  },
  { _id: false }
);

/** OTP — hashed store, expiry, attempt limit */
const otpSchema = new mongoose.Schema(
  {
    hash:      { type: String },               // bcrypt hashed OTP
    expiresAt: { type: Date },                 // 10 min expiry
    attempts:  { type: Number, default: 0 },   // max 5 attempts
    purpose:   {
      type: String,
      
    },
  },
  { _id: false }
);

/** Single suspend event — history ke liye */
const suspendEventSchema = new mongoose.Schema(
  {
    action:    { type: String, enum: ["suspended", "unsuspended", "warned"], required: true },
    reason:    { type: String, default: "" },
    by:        { type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" },
    at:        { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },   // null = permanent
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    // ── Identity ────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Name zaroori hai"],
      trim: true,
      minlength: [2, "Name kam se kam 2 characters ka hona chahiye"],
      maxlength: [50, "Name 50 characters se zyada nahi ho sakta"],
      validate: {
        validator: (v) => /^[\p{L}\s'\-\.0-9]+$/u.test(v),
        message: "Name mein sirf letters, spaces, hyphens allowed hain",
      },
    },

    username: {
      type: String,
      required: [true, "Username zaroori hai"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, "Username kam se kam 3 characters ka hona chahiye"],
      maxlength: [30, "Username 30 characters se zyada nahi ho sakta"],
      validate: {
        validator: (v) => /^(?!.*[_.]{2})[a-z0-9][a-z0-9._]*[a-z0-9]$/.test(v),
        message: "Username mein sirf lowercase letters, numbers, dots, underscores allowed hain. Consecutive dots/underscores nahi.",
      },
    },

    email: {
      type: String,
      required: [true, "Email zaroori hai"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => validator.isEmail(v),
        message: "Valid email address do",
      },
    },

    // ── Auth ─────────────────────────────────────────────────────────────────
    password: {
      type: String,
      minlength: [8, "Password kam se kam 8 characters ka hona chahiye"],
      select: false,   // kabhi bhi accidentally expose nahi hoga
    },

    googleId: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },


    passwordChangedAt: {
      type: Date,
      select: false,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    otp: {
      type: otpSchema,
      select: false,
    },

    // ── Profile ──────────────────────────────────────────────────────────────
    avatar:     { type: imageSchema, default: () => ({}) },
    coverPhoto: { type: imageSchema, default: () => ({}) },

    bio: {
      type: String,
      default: "",
      maxlength: [250, "Bio 250 characters se zyada nahi ho sakti"],
      trim: true,
    },

    designation: {
      type: String,
      default: "",
      maxlength: [60, "Designation 60 characters se zyada nahi ho sakti"],
      trim: true,
    },

    website: {
      type: String,
      default: "",
      validate: {
        validator: (v) => v === "" || validator.isURL(v, { require_protocol: true }),
        message: "Valid URL do (https:// ke saath)",
      },
    },

    interests: {
      type: [String],
      default: [],
      validate: [
        {
          validator: (arr) => arr.length <= 10,
          message: "Zyada se zyada 10 interests allowed hain",
        },
        {
          validator: (arr) => arr.every((i) => i.length <= 30),
          message: "Har interest 30 characters se zyada nahi ho sakta",
        },
      ],
    },

    // ── Role & Status ─────────────────────────────────────────────────────────
    role: {
      type: String,
      enum: ["super_admin", "admin", "user"],
      default: "user",
    },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },

    isSuspended:   { type: Boolean, default: false },
    suspendedAt:   { type: Date, default: null },
    suspendedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "SocialUser", default: null },
    suspendReason: { type: String, default: "" },
    suspendUntil:  { type: Date, default: null },   // null = permanent
    suspendHistory: { type: [suspendEventSchema], default: [] },
    warningCount:  {
      type: Number,
      default: 0,
      max: [5, "Warning count 5 se zyada nahi ho sakta"],
    },

    // ── Follow System ─────────────────────────────────────────────────────────
    followers:      [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
    following:      [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
    blockedUsers:   [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],

    // ── Location ──────────────────────────────────────────────────────────────
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],   // [longitude, latitude]
        default: [0, 0],
        validate: {
          validator: ([lng, lat]) =>
            lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90,
          message: "Invalid coordinates",
        },
      },
      city:    { type: String, default: "", maxlength: 100 },
      state:   { type: String, default: "", maxlength: 100 },
      country: {
        type: String,
        default: "",
        validate: {
          validator: (v) => v === "" || validator.isISO31661Alpha2(v),
          message: "Valid ISO 3166-1 alpha-2 country code do (e.g. IN, US)",
        },
      },
    },

    // ── Business ──────────────────────────────────────────────────────────────
    businessCategory: {
      type: String,
      enum: ["marble", "granite", "limestone", "cnc", "quarry", "supplier", "designer", "other"],
      default: "other",
    },

    // ── Activity ──────────────────────────────────────────────────────────────
    lastSeen: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────────────────────────────────────

userSchema.virtual("followersCount").get(function () {
  return this.followers?.length ?? 0;
});

userSchema.virtual("followingCount").get(function () {
  return this.following?.length ?? 0;
});

/** Temporary suspension active hai ya nahi */
userSchema.virtual("isSuspensionActive").get(function () {
  if (!this.isSuspended) return false;
  if (!this.suspendUntil) return true;          // permanent
  return new Date() < this.suspendUntil;        // time-based
});

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

userSchema.index({ location: "2dsphere" });
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ businessCategory: 1 });
userSchema.index({ isDeleted: 1 });
userSchema.index({ isSuspended: 1 });
userSchema.index({ createdAt: -1 });

// ─────────────────────────────────────────────────────────────────────────────
// Pre-save Hooks
// ─────────────────────────────────────────────────────────────────────────────

userSchema.pre("save", async function (next) {
  // Password hash
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
    this.passwordChangedAt = new Date();
  }

  // Temporary suspension auto-lift
  if (this.isSuspended && this.suspendUntil && new Date() > this.suspendUntil) {
    this.isSuspended   = false;
    this.suspendUntil  = null;
    this.suspendedAt   = null;
    this.suspendReason = "";
  }

  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Instance Methods
// ─────────────────────────────────────────────────────────────────────────────

/** Password compare */
userSchema.methods.comparePassword = async function (entered) {
  if (!this.password) return false;
  return bcrypt.compare(entered, this.password);
};

/** JWT issue hone ke baad password change hua? */
userSchema.methods.isPasswordChangedAfter = function (jwtIssuedAt) {
  if (!this.passwordChangedAt) return false;
  return this.passwordChangedAt.getTime() / 1000 > jwtIssuedAt;
};

/** OTP generate karo (plain return, hashed store) */
userSchema.methods.generateOtp = async function (purpose = "login") {
  const plain = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = {
    hash:      await bcrypt.hash(plain, 10),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),   // 10 min
    attempts:  0,
    purpose,
  };
  await this.save({ validateBeforeSave: false });
  return plain;   // email pe bhejo
};

/** OTP verify karo */
userSchema.methods.verifyOtp = async function (plain, purpose) {
  if (!this.otp?.hash) return { ok: false, reason: "OTP nahi mila" };
  if (this.otp.purpose !== purpose) return { ok: false, reason: "Wrong purpose" };
  if (new Date() > this.otp.expiresAt) return { ok: false, reason: "OTP expire ho gaya" };
  if (this.otp.attempts >= 5) return { ok: false, reason: "Max attempts exceed ho gaye" };

  const match = await bcrypt.compare(plain, this.otp.hash);
  if (!match) {
    this.otp.attempts += 1;
    await this.save({ validateBeforeSave: false });
    return { ok: false, reason: "Galat OTP" };
  }

  this.otp = undefined;
  await this.save({ validateBeforeSave: false });
  return { ok: true };
};

/** OTP clear karo */
userSchema.methods.clearOtp = async function () {
  this.otp = undefined;
  await this.save({ validateBeforeSave: false });
};

/** User suspend karo */
userSchema.methods.suspend = async function ({ reason, by, days = null }) {
  const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;

  this.isSuspended   = true;
  this.suspendedAt   = new Date();
  this.suspendedBy   = by;
  this.suspendReason = reason;
  this.suspendUntil  = expiresAt;

  this.suspendHistory.push({ action: "suspended", reason, by, at: new Date(), expiresAt });
  await this.save({ validateBeforeSave: false });
};

/** User unsuspend karo */
userSchema.methods.unsuspend = async function (by) {
  this.isSuspended   = false;
  this.suspendedAt   = null;
  this.suspendedBy   = null;
  this.suspendReason = "";
  this.suspendUntil  = null;

  this.suspendHistory.push({ action: "unsuspended", by, at: new Date() });
  await this.save({ validateBeforeSave: false });
};

/** Warning add karo — 3 warnings pe auto-suspend */
userSchema.methods.addWarning = async function (reason, by) {
  this.warningCount += 1;
  this.suspendHistory.push({ action: "warned", reason, by, at: new Date() });

  if (this.warningCount >= 3) {
    await this.suspend({ reason: "3 warnings ke baad auto-suspend", by, days: 7 });
  } else {
    await this.save({ validateBeforeSave: false });
  }
};

/** Soft delete */
userSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save({ validateBeforeSave: false });
};

/** Restore */
userSchema.methods.restore = async function () {
  this.isDeleted = false;
  this.deletedAt = null;
  await this.save({ validateBeforeSave: false });
};

// ─────────────────────────────────────────────────────────────────────────────
// Static Methods
// ─────────────────────────────────────────────────────────────────────────────

/** Login ke liye — password field bhi chahiye */
userSchema.statics.findByEmailWithPassword = function (email) {
  return this.findOne({ email, isDeleted: false }).select("+password +otp");
};

/** Public profile lookup */
userSchema.statics.findByUsername = function (username) {
  return this.findOne({ username, isDeleted: false }).select("-refreshToken -otp -passwordChangedAt");
};

/** Google OAuth — find ya create */
userSchema.statics.findOrCreateGoogleUser = async function ({ googleId, email, name, avatar }) {
  let user = await this.findOne({ $or: [{ googleId }, { email }] });

  if (user) {
    if (!user.googleId) {
      user.googleId = googleId;
      await user.save({ validateBeforeSave: false });
    }
    return user;
  }

  // Username auto-generate
  const base     = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix   = crypto.randomBytes(3).toString("hex");
  const username = `${base.slice(0, 20)}${suffix}`;

  user = await this.create({
    name,
    email,
    username,
    googleId,
    isEmailVerified: true,
    avatar: { url: avatar || "", publicId: "" },
  });

  return user;
};

/** Admin panel — suspended users */
userSchema.statics.findSuspended = function () {
  return this.find({ isSuspended: true, isDeleted: false }).sort({ suspendedAt: -1 });
};

/** Geolocation nearby search */
userSchema.statics.findNearby = function ({ lng, lat, maxDistance = 50000 }) {
  return this.find({
    isDeleted: false,
    isSuspended: false,
    location: {
      $near: {
        $geometry:    { type: "Point", coordinates: [lng, lat] },
        $maxDistance: maxDistance,
      },
    },
  }).select("name username avatar designation location");
};

// ─────────────────────────────────────────────────────────────────────────────

const SocialUser = mongoose.model("SocialUser", userSchema);
export default SocialUser;