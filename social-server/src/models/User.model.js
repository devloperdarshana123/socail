// src/models/User.model.js

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
      match: [/^\S+@\S+\.\S+$/, "Valid email do"],
  },
  password: {
    type: String,
    required: false, // ✅ Google users ka password nahi hoga
    minlength: 6,
  },
  // ✅ Google Auth ke liye — pehle missing tha
  googleId: {
    type: String,
    default: null,
  },
  designation: {
    type: String,
    default: "",
    maxlength: 60,
  },
  role: {
    type: String,
    enum: ["super_admin", "user"],
    default: "user",
  },
  avatar: {
    type: String,
    default: "",
  },
  bio: {
    type: String,
    default: "",
  },
  isSuspended: {
    type: Boolean,
    default: false,
  },
  warningCount: {
    type: Number,
    default: 0,
  },

  // ── Follow System ──────────────────────────────────────────────────────────
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "SocialUser",
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "SocialUser",
  }],
followRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "SocialUser",
  }],

  // ── Location ──────────────────────────────────────────────
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
 city: { type: String, default: "" },
country: { type: String, default: "" },
state: { type: String, default: "" },
  },

  // ── Business Category ─────────────────────────────────────
  businessCategory: {
    type: String,
    enum: ["marble", "granite", "limestone", "cnc", "quarry", "supplier", "designer", "other"],
    default: "other",
  },

}, { timestamps: true });

// Geospatial index
userSchema.index({ "location": "2dsphere" });
userSchema.index({ followers: 1 });
userSchema.index({ following: 1 });
userSchema.index({ followRequests: 1 });
userSchema.index({ email: 1 });


// ── Password hash karo save se pehle ──────────────────────────────────────────
// ✅ Google users ka password nahi hoga, isliye check zaroori hai
userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// ── Password compare ───────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false; // Google user ke paas password nahi
  return await bcrypt.compare(enteredPassword, this.password);
};

const SocialUser = mongoose.model("SocialUser", userSchema);
export default SocialUser;