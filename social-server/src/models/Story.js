import mongoose from "mongoose";

const storySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocialUser",
      required: true,
      index: true,
    },
    mediaUrl: { type: String, default: "" },
    mediaPublicId: { type: String, default: "" },
    mediaType: {
      type: String,
      enum: ["image", "video", "text"],
      required: true,
    },
    textContent: { type: String, default: "" },
    textBg: { type: String, default: "#6366f1" },
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Story", storySchema);