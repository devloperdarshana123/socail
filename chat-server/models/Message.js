// const mongoose = require("mongoose");

// const messageSchema = new mongoose.Schema({
//   conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
//   sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//   text: { type: String, default: "" },
//   image: { type: String, default: null },
//   replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
//   isDeleted: { type: Boolean, default: false },
//   readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
// }, { timestamps: true });

// module.exports = mongoose.model("Message", messageSchema);


const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      default: null,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isEdited: {                                    // ✅ add
      type: Boolean,
      default: false,
    },
    seenBy: [                                      // ✅ add
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// ✅ Indexes
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

module.exports = mongoose.model("Message", messageSchema);