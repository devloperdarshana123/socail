

import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SocialUser",
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    // userId → unread count
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

// Ensure each pair of participants has only one conversation
conversationSchema.index({ participants: 1, updatedAt: -1 }); // conversations list fast aayegi

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;