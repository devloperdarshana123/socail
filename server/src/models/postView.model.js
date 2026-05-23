import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const postViewSchema = new Schema({
  user:      { type: Schema.Types.ObjectId, ref: "User", required: true },
  post:      { type: Schema.Types.ObjectId, ref: "Post", required: true },
  viewedAt:  { type: Date, default: Date.now },
  // ── Analytics ──
  source:    { type: String, enum: ["feed", "explore", "profile", "direct", "modal"], default: "modal" },
  duration:  { type: Number, default: 0 }, // seconds — kitni der dekha
  device:    { type: String, enum: ["mobile", "desktop", "tablet"], default: "desktop" },
}, { timestamps: false });

// Unique — ek user ek post ek baar (90 din mein)
postViewSchema.index({ user: 1, post: 1 }, { unique: true });

// Auto-delete after 90 days
postViewSchema.index({ viewedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Analytics queries ke liye
postViewSchema.index({ post: 1, viewedAt: -1 });
postViewSchema.index({ source: 1, viewedAt: -1 });

const PostView = models.PostView || model("PostView", postViewSchema);
export default PostView;