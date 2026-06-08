// scripts/cleanSuperAdmin.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

import User from "../src/models/user.model.js";
import Follow from "../src/models/follow.model.js";

await mongoose.connect(process.env.MONGO_URI);  // ← MONGO_URI

const superAdmin = await User.findOne({ role: "super_admin" }).select("_id username").lean();

if (!superAdmin) {
  console.log("No super admin found");
  process.exit(0);
}

console.log(`Found super admin: ${superAdmin.username}`);

const { deletedCount } = await Follow.removeAllForUser(superAdmin._id);

await User.findByIdAndUpdate(superAdmin._id, {
  followersCount: 0,
  followingCount: 0,
});

console.log(`Deleted ${deletedCount} follow relationships`);
process.exit(0);