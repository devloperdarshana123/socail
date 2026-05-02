import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sender:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type:      { 
    type: String, 
    enum: ["like", "comment", "reply", "comment_like", "reply_like"], // ✅ "like" add kiya
    required: true 
  },
  post:      { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
  text:      { type: String },
  isRead:    { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model("Notification", notificationSchema);