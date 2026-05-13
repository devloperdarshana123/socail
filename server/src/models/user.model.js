import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const { Schema, model, models } = mongoose;

// ─────────────────────────────────────────────
//  Sub-schema: Cloudinary Media
// ─────────────────────────────────────────────
const cloudinaryMediaSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false },
);

// ─────────────────────────────────────────────
//  Sub-schema: Refresh Token (per device)
// ─────────────────────────────────────────────
const refreshTokenSchema = new Schema(
  {
    token: { type: String, required: true, select: false },
    deviceInfo: { type: String, default: "unknown" },
    ipAddress: { type: String, default: null },
    isTrusted: { type: Boolean, default: false },
    lastUsedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  },
  { _id: true },
);

// ─────────────────────────────────────────────
//  User Schema
// ─────────────────────────────────────────────
const userSchema = new Schema(
  {
    // ── Identity ──────────────────────────────
    username: {
      type: String,
      unique: true,
      sparse: true, // null allowed jab tak onboarding complete nahi
      trim: true,
      lowercase: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      match: [
        /^[a-z0-9._]+$/,
        "Username can only contain letters, numbers, dots and underscores",
      ],
      index: true,
      default: null,
    },

    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [60, "Full name cannot exceed 60 characters"],
    },

    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
      index: true,
    },

    phoneNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      match: [
        /^\+[1-9]\d{6,14}$/,
        "Phone number must be in E.164 format e.g. +919876543210",
      ],
      index: true,
    },

    password: {
      type: String,
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },

    // ── Firebase / OAuth ──────────────────────
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    authProvider: {
      type: String,
      enum: ["email", "phone", "google", "apple"],
      default: "email",
    },

    // ── Profile ───────────────────────────────
    avatar: {
      type: cloudinaryMediaSchema,
      default: null,
    },
    coverPhoto: {
  type: cloudinaryMediaSchema,
  default: null,
},

    bio: {
      type: String,
      trim: true,
      maxlength: [150, "Bio cannot exceed 150 characters"],
      default: "",
    },
designation: {
  type: String,
  trim: true,
  maxlength: [100, "Designation cannot exceed 100 characters"],
  default: "",
},
    website: {
      type: String,
      trim: true,
      maxlength: [100, "Website URL too long"],
      default: "",
    },

    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      default: "prefer_not_to_say",
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    // ── Verification ──────────────────────────
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isMobileVerified: {
      type: Boolean,
      default: false,
    },

    // ── Account Status ────────────────────────
    isPrivate: {
      type: Boolean,
      default: false,
    },

    isVerifiedBadge: {
      type: Boolean,
      default: false,
    },

    accountStatus: {
      type: String,
      enum: ["active", "pending", "suspended", "deactivated", "banned"],
      default: "pending", // pending jab tak email verify nahi
      index: true,
    },

    // ── Role ─────────────────────────────────
    role: {
      type: String,
      enum: ["user", "admin", "moderator"],
      default: "user",
    },

    // ── Onboarding ────────────────────────────
    isOnboardingComplete: {
      type: Boolean,
      default: false,
    },

    // 1 = Step 1 done (registered), waiting for email verify
    // 2 = Email verified, waiting for username
    // 3 = Complete
    onboardingStep: {
      type: Number,
      enum: [1, 2, 3],
      default: 1,
    },

    // ── Counts (denormalized for performance) ──
    followersCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    followingCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    postsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Tokens ────────────────────────────────
    refreshTokens: {
      type: [refreshTokenSchema],
      select: false,
      default: [],
    },

    // ── Preferences ───────────────────────────
    notificationsEnabled: {
      type: Boolean,
      default: true,
    },

    language: {
      type: String,
      default: "en",
      maxlength: 10,
    },


 // ── Business Info ─────────────────────────  ← YAHAN ADD KARO
    businessCategory: {
      type: String,
      enum: ["marble", "granite", "limestone", "cnc", "quarry", "supplier", "designer", "other"],
      default: null,
      index: true,
    },

    // ── Location ──────────────────────────────
 location: {
  city:    { type: String, trim: true, default: null },
  state:   { type: String, trim: true, default: null },
  country: { type: String, trim: true, default: null }, // ← "India" hata do
  coordinates: {
    type: {
      type: String,
      enum: ["Point"],
    },
    coordinates: {
      type: [Number],
    },
  },
},
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────
userSchema.index({ username: "text", fullName: "text" });
userSchema.index({ accountStatus: 1, createdAt: -1 });
userSchema.index(
  { "location.coordinates": "2dsphere" },
  { sparse: true }  // ← sirf tab index karo jab field exist kare
);// ← ADD
userSchema.index({ businessCategory: 1, accountStatus: 1 });
// ─────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────

userSchema.virtual("hasPassword").get(function () {
  return !!this.password;
});

userSchema.virtual("avatarUrl").get(function () {
  return this.avatar?.url || null;
});

// ─────────────────────────────────────────────
//  Pre-save Hooks
// ─────────────────────────────────────────────
userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ─────────────────────────────────────────────
//  Instance Methods
// ─────────────────────────────────────────────

/** Compare plain password with hashed */
userSchema.methods.isPasswordCorrect = async function (plainPassword) {
  if (!this.password) return false;
  return bcrypt.compare(plainPassword, this.password);
};

/** Generate short-lived Access Token */
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      username: this.username,
      email: this.email,
      phoneNumber: this.phoneNumber,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m" },
  );
};

/** Generate long-lived Refresh Token and save to DB (device-aware) */
userSchema.methods.generateRefreshToken = async function (
  deviceInfo = "unknown",
  ipAddress = null,
) {
  const token = jwt.sign({ _id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  });

  const user = await this.constructor
    .findById(this._id)
    .select("+refreshTokens");

  // Expired tokens clean karo
  user.refreshTokens = (user.refreshTokens || []).filter(
    (t) => t.expiresAt > new Date(),
  );

  // Max 5 devices
  if (user.refreshTokens.length >= 5) {
    user.refreshTokens.shift();
  }

  user.refreshTokens.push({
    token,
    deviceInfo,
    ipAddress,
    isTrusted: false,
    lastUsedAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  await user.save({ validateBeforeSave: false });
  return token;
};

/** Update lastUsedAt on token use */
userSchema.methods.touchRefreshToken = async function (token) {
  const user = await this.constructor
    .findById(this._id)
    .select("+refreshTokens");
  const t = user.refreshTokens.find((t) => t.token === token);
  if (t) {
    t.lastUsedAt = new Date();
    await user.save({ validateBeforeSave: false });
  }
};

userSchema.methods.removeRefreshToken = async function (token) {
  const user = await this.constructor
    .findById(this._id)
    .select("+refreshTokens");
  user.refreshTokens = (user.refreshTokens || []).filter(
    (t) => t.token !== token,
  );
  await user.save({ validateBeforeSave: false });
};

/** Remove all refresh tokens (logout from all devices) */
userSchema.methods.removeAllRefreshTokens = async function () {
  const user = await this.constructor
    .findById(this._id)
    .select("+refreshTokens");
  user.refreshTokens = [];
  await user.save({ validateBeforeSave: false });
};

/** Safe object for sending to frontend */
userSchema.methods.toSafeObject = function () {
  return {
    _id: this._id,
    username: this.username,
    fullName: this.fullName,
    email: this.email || null,
    phoneNumber: this.phoneNumber || null,
    avatar: this.avatar || null,
    avatarUrl: this.avatarUrl,
    coverPhoto: this.coverPhoto || null,
    bio: this.bio,
    designation: this.designation || "",
    website: this.website,
    gender: this.gender,
    dateOfBirth: this.dateOfBirth,
    isEmailVerified: this.isEmailVerified,
    isMobileVerified: this.isMobileVerified,
    isPrivate: this.isPrivate,
    isVerifiedBadge: this.isVerifiedBadge,
    accountStatus: this.accountStatus,
    isOnboardingComplete: this.isOnboardingComplete,
    onboardingStep: this.onboardingStep,
    role: this.role,
    authProvider: this.authProvider,
    followersCount: this.followersCount,
    followingCount: this.followingCount,
    postsCount: this.postsCount,
    notificationsEnabled: this.notificationsEnabled,
    language: this.language,
    createdAt: this.createdAt,
    businessCategory: this.businessCategory || null, // ← ADD
    location: this.location || null,  
    // ❌ password, refreshTokens, firebaseUid, __v — never sent
  };
};

// ─────────────────────────────────────────────
//  Static Methods
// ─────────────────────────────────────────────

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

userSchema.statics.getPublicProfile = function (userId) {
  return this.findById(userId).select(
    "-password -refreshTokens -firebaseUid -__v",
  );
};

userSchema.statics.searchUsers = function (query, limit = 20) {
  return this.find(
    {
      $text: { $search: query },
      accountStatus: "active",
    },
    { score: { $meta: "textScore" } },
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(limit)
    .select(
      "username fullName avatar isVerifiedBadge isPrivate followersCount",
    );
};

userSchema.statics.updateCount = function (userId, field, value) {
  return this.findByIdAndUpdate(
    userId,
    { $inc: { [field]: value } },
    { returnDocument: "after" }
  );
};

const User = models.User || model("User", userSchema);
export default User;
