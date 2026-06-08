// scripts/fixCounts.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

import User from "../src/models/user.model.js";
import Follow from "../src/models/follow.model.js";

await mongoose.connect(process.env.MONGO_URI);

// Saare users ke counts recalculate karo
const users = await User.find({}).select("_id").lean();

for (const user of users) {
  const [followersCount, followingCount] = await Promise.all([
    Follow.countDocuments({ following: user._id, status: "accepted" }),
    Follow.countDocuments({ follower: user._id, status: "accepted" }),
  ]);

  await User.findByIdAndUpdate(user._id, { followersCount, followingCount });
}

console.log(`Fixed counts for ${users.length} users`);
process.exit(0);