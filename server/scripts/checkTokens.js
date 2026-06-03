import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/models/user.model.js";

await mongoose.connect(process.env.MONGO_URI);

const users = await User.find({}).select("+refreshTokens username refreshTokens").lean();

console.log("\nRefresh tokens per user:\n");
users.forEach(u => {
  console.log(`@${u.username} → tokens: ${u.refreshTokens?.length ?? 0}`);
});

await mongoose.disconnect();