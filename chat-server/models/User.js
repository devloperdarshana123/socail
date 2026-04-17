const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  avatar: String,
  email: String,
}, { timestamps: true });

// ✅ "socialusers" — same collection jo social-server use karta hai
module.exports = mongoose.model("User", userSchema, "socialusers");