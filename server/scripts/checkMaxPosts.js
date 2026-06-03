import "dotenv/config";
import mongoose from "mongoose";
import Post from "../src/models/post.model.js";
import User from "../src/models/user.model.js";

await mongoose.connect(process.env.MONGO_URI);

const results = await Post.aggregate([
  { $match: { isDeleted: false, isDraft: false } },
  { $group: { _id: "$author", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);

// User details fetch karo
const userIds = results.map(r => r._id);
const users = await User.find({ _id: { $in: userIds } })
  .select("_id username fullName")
  .lean();

const userMap = {};
users.forEach(u => { userMap[u._id.toString()] = u; });

console.log("\nUser wise post count:\n");
results.forEach(r => {
  const u = userMap[r._id.toString()];
  console.log(`@${u?.username ?? "unknown"} (${u?.fullName ?? "-"}) | Posts: ${r.count}`);
});

console.log(`\nMax posts by single user: ${results[0]?.count ?? 0}`);
console.log(`Total users with posts: ${results.length}`);

await mongoose.disconnect();