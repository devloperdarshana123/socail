import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/models/user.model.js";
import Post from "../src/models/post.model.js";

await mongoose.connect(process.env.MONGO_URI);

console.log("Repairing postsCount...\n");

const users = await User.find({}).select("_id username postsCount").lean();

let fixed = 0;

for (const u of users) {
  const actual = await Post.countDocuments({
    author:    u._id,
    isDeleted: false,
    isDraft:   false,
  });

  if (actual !== u.postsCount) {
    await User.findByIdAndUpdate(u._id, { postsCount: actual });
    console.log(`✅ Fixed @${u.username ?? u._id}: ${u.postsCount} → ${actual}`);
    fixed++;
  } else {
    console.log(`⏭️  Skipped @${u.username ?? u._id}: already correct (${actual})`);
  }
}

console.log(`\nDone. Fixed ${fixed}/${users.length} users.`);
await mongoose.disconnect();