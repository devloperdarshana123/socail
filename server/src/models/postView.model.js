// models/postView.model.js
import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const postViewSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
  viewedAt: { type: Date, default: Date.now },
});

// ✅ Unique — same user same post sirf ek baar
postViewSchema.index({ user: 1, post: 1 }, { unique: true });

const PostView = models.PostView || model("PostView", postViewSchema);
export default PostView;