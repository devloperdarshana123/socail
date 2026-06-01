
import mongoose from "mongoose";

const { Schema, model } = mongoose;

// ── Reply preview sub-schema ──────────────────────────────────────────────────
// ObjectId ref ki jagah embedded preview — populate ki zaroorat nahi
const replyPreviewSchema = new Schema(
  {
    messageId: { type: Schema.Types.ObjectId, ref: "Message", default: null },
    text:      { type: String, maxlength: 100, default: "" },
    senderId:  { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { _id: false }
);

// ── Reaction sub-schema ───────────────────────────────────────────────────────
const reactionSchema = new Schema(
  {
    emoji:     { type: String, required: true, maxlength: 10 },
    user:      { type: Schema.Types.ObjectId, ref: "User", required: true },
    reactedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────
const messageSchema = new Schema(
  {
    conversation: {
      type:     Schema.Types.ObjectId,
      ref:      "Conversation",
      required: true,
      index:    true,
    },
    sender: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },

    // ── Content ──────────────────────────────────────────────────────────────
    type: {
      type:    String,
      enum:    ["text", "image", "audio", "video", "file", "system"],
      default: "text",
      index:   true,
    },
    text:  { type: String, default: "", maxlength: 2000 },
    image: { type: String, default: null },   // URL / CDN path
    audio: { type: String, default: null },   // ✅ was missing — handler use karta tha
    video: { type: String, default: null },   // future-proof
    file: {                                   // future-proof
      url:  { type: String, default: null },
      name: { type: String, default: null },
      size: { type: Number, default: null },
    },

    // ── Reply ─────────────────────────────────────────────────────────────────
    replyTo: { type: replyPreviewSchema, default: null }, // ✅ embedded, no populate

    // ── Reactions ─────────────────────────────────────────────────────────────
    reactions: { type: [reactionSchema], default: [] },

    // ── Read / seen tracking ──────────────────────────────────────────────────
    seenBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],

    // ── Edit state ────────────────────────────────────────────────────────────
    isEdited:  { type: Boolean, default: false },
    editedAt:  { type: Date,    default: null },  // ✅ was missing

    // ── Delete state ──────────────────────────────────────────────────────────
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date,    default: null },  // ✅ was missing
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
messageSchema.index({ conversation: 1, createdAt: -1 }); // messages fetch (most common)
messageSchema.index({ conversation: 1, isDeleted: 1 });  // undeleted messages filter
messageSchema.index({ sender: 1, createdAt: -1 });       // user ke saare messages

// ── Statics ───────────────────────────────────────────────────────────────────

// Latest message of a conversation (lastMessage sync ke liye)
messageSchema.statics.getLastMessage = function (conversationId) {
  return this.findOne({ conversation: conversationId, isDeleted: false })
    .sort({ createdAt: -1 })
    .select("_id text type image audio createdAt sender")
    .lean();
};

// Unread count for a user in a conversation
messageSchema.statics.getUnreadCount = function (conversationId, userId) {
  return this.countDocuments({
    conversation: conversationId,
    isDeleted:    false,
    seenBy:       { $nin: [userId] },
    sender:       { $ne: userId },
  });
};

export default model("Message", messageSchema);
