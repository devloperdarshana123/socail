// scripts/checkDarshana.js
import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/models/user.model.js";

await mongoose.connect(process.env.MONGO_URI);

const user = await User.findOne({ username: "darshana.mehra" })
  .select("+refreshTokens +password")
  .lean();

console.log("accountStatus:", user.accountStatus);
console.log("authProvider:", user.authProvider);
console.log("isOnboardingComplete:", user.isOnboardingComplete);
console.log("firebaseUid:", user.firebaseUid);
console.log("refreshTokens:", user.refreshTokens?.length ?? 0);

await mongoose.disconnect();