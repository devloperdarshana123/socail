import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: String,
    username: String,
    avatar: {
      url: String,
    },
    email: String,
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema, "socialusers");