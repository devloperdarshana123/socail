
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ── Avatar sub-schema ─────────────────────────────────────────────────────────
const avatarSchema = new Schema(
  {
    url:      { type: String, default: null },
    publicId: { type: String, default: null }, // Cloudinary / S3 ke liye
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────
// NOTE: collection "socialusers" — main social server ka collection hai
// Chat server sirf read karta hai — write nahi karta
const userSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    fullName:        { type: String, default: null, trim: true },
    username:        { type: String, default: null, trim: true, lowercase: true },
    email:           { type: String, default: null, trim: true, lowercase: true },
    avatar:          { type: avatarSchema, default: () => ({}) },

    // ── Verification ─────────────────────────────────────────────────────────
    isVerifiedBadge: { type: Boolean, default: false }, // ✅ notification mein use hota

    // ── Block list ────────────────────────────────────────────────────────────
    // ✅ was completely missing — chatHandler.js 3 jagah query karta tha
    blockedUsers: [
      { type: Schema.Types.ObjectId, ref: "User" }
    ],

    // ── Privacy settings ──────────────────────────────────────────────────────
    isPrivate:       { type: Boolean, default: false },
    isActive:        { type: Boolean, default: true },  // soft deactivation

    // ── Follow system (read-only in chat server) ──────────────────────────────
    followers:       [{ type: Schema.Types.ObjectId, ref: "User" }],
    following:       [{ type: Schema.Types.ObjectId, ref: "User" }],
    followRequests:  [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  {
    timestamps:  true,
    collection:  "users", // ✅ main social server ka collection
    toJSON:      { virtuals: true },
    toObject:    { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ username: 1 }, { unique: true, sparse: true });
userSchema.index({ email: 1 },    { unique: true, sparse: true });
userSchema.index({ isActive: 1 });

// ── Virtuals ──────────────────────────────────────────────────────────────────
userSchema.virtual("displayName").get(function () {
  return this.fullName || this.username || "Unknown User";
});

// ── Statics ───────────────────────────────────────────────────────────────────

// Chat server mein sender fetch ke liye — select sirf woh fields jo chahiye
userSchema.statics.findForChat = function (userId) {
  return this.findById(userId)
    .select("_id fullName username avatar isVerifiedBadge")
    .lean();
};

// Block check — O(1) DB query, handler mein manual check ki zaroorat nahi
userSchema.statics.isBlocked = async function (userIdA, userIdB) {
  const count = await this.countDocuments({
    _id: { $in: [userIdA, userIdB] },
    blockedUsers: { $in: [userIdA, userIdB] },
  });
  return count > 0;
};

// mongoose model cache — hot reload safe
const User = models.User || model("User", userSchema, "users");
export default User;
