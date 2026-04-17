import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocialUser",
      required: true,
    },
    text: { type: String, default: "" },
    image: { type: String, default: "" },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });

const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
export default Message;