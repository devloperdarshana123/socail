import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const postViewSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  post: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
  viewedAt: { type: Date, default: Date.now },
}, { timestamps: true });

postViewSchema.index({ user: 1, post: 1 }, { unique: true });

// Auto-delete after 90 days — DB bhar nahi badhega
postViewSchema.index({ viewedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const PostView = models.PostView || model("PostView", postViewSchema);
export default PostView;