import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocialUser",
      required: true,
    },
    caption: { type: String, default: "" },
    image:   { type: String, default: "" },
    video:   { type: String, default: "" },
    tags:    [{ type: String }],
    likes:   [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
    savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    views:         { type: Number, default: 0 },
    isSuspended:   { type: Boolean, default: false },
    suspendedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "SocialUser", default: null },
    suspendReason: { type: String, default: "" },
  },
  { timestamps: true }
);

const Post = mongoose.model("Post", postSchema);
export default Post;