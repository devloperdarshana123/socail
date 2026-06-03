import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/models/user.model.js";
import Post from "../src/models/post.model.js";

await mongoose.connect(process.env.MONGO_URI);

console.log("Checking postsCount mismatch...\n");

const users = await User.find({}).select("_id username postsCount").lean();

let mismatchCount = 0;

for (const u of users) {
  const actual = await Post.countDocuments({
    author:    u._id,
    isDeleted: false,
    isDraft:   false,
  });

  if (actual !== u.postsCount) {
    console.log(`❌ @${u.username ?? u._id} | stored: ${u.postsCount} | actual: ${actual}`);
    mismatchCount++;
  } else {
    console.log(`✅ @${u.username ?? u._id} | ${actual} posts — OK`);
  }
}

console.log(`\nTotal mismatches: ${mismatchCount}/${users.length}`);
await mongoose.disconnect();