// import mongoose from "mongoose";

// const messageSchema = new mongoose.Schema(
//   {
//     conversation: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Conversation",
//       required: true,
//     },
//     sender: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "SocialUser",
//       required: true,
//     },
//     text: { type: String, default: "" },
//     image: { type: String, default: "" },
//     readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
//     replyTo: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Message",
//       default: null,
//     },
//     isDeleted: { type: Boolean, default: false },
//   },
//   { timestamps: true }
// );

// messageSchema.index({ conversation: 1, createdAt: -1 });

// const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
// export default Message;

import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// Message Schema
// ─────────────────────────────────────────────────────────────────────────────

/** Cloudinary media */
const mediaSchema = new mongoose.Schema(
  {
    url:      { type: String, default: "" },
    publicId: { type: String, default: "" },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: [true, "Conversation ID zaroori hai"],
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocialUser",
      required: [true, "Sender zaroori hai"],
    },

    // ── Content ───────────────────────────────────────────────────────────────
    messageType: {
      type: String,
      enum: ["text", "image", "video", "file", "system"],
      default: "text",
    },

    text: {
      type: String,
      default: "",
      trim: true,
      maxlength: [4000, "Message 4000 characters se zyada nahi ho sakta"],
    },

    media: { type: mediaSchema, default: null },

    // ── Features ──────────────────────────────────────────────────────────────
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    reactions: [
      {
        user:  { type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" },
        emoji: { type: String, maxlength: 10 },
        _id:   false,
      },
    ],

    // ── Status ────────────────────────────────────────────────────────────────
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],

    /** "Sirf mere liye delete" — WhatsApp style */
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],

    /** "Sabke liye delete" — sender ke liye */
    isDeleted:  { type: Boolean, default: false },
    deletedAt:  { type: Date, default: null },

    /** Edit history */
    isEdited:   { type: Boolean, default: false },
    editedAt:   { type: Date, default: null },
    originalText: { type: String, default: "" },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

// ── Instance Methods ──────────────────────────────────────────────────────────

/** Sabke liye delete */
messageSchema.methods.deleteForAll = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.text      = "";
  this.media     = null;
  await this.save({ validateBeforeSave: false });
};

/** Sirf ek user ke liye delete */
messageSchema.methods.deleteForUser = async function (userId) {
  this.deletedFor.addToSet(userId);
  await this.save({ validateBeforeSave: false });
};

/** Message edit karo */
messageSchema.methods.editMessage = async function (newText) {
  if (!this.originalText) this.originalText = this.text;
  this.text     = newText;
  this.isEdited = true;
  this.editedAt = new Date();
  await this.save({ validateBeforeSave: false });
};

const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);

// ─────────────────────────────────────────────────────────────────────────────
// Conversation Schema
// ─────────────────────────────────────────────────────────────────────────────

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
      validate: {
        validator: (arr) => arr.length >= 2,
        message: "Conversation mein kam se kam 2 participants hone chahiye",
      },
    },

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    /** userId → unread count */
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },

    /** Future-proof: group chat ke liye */
    isGroup:   { type: Boolean, default: false },
    groupName: { type: String, default: "", maxlength: 100 },
    groupAdmin:[{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
    groupAvatar: {
      url:      { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    /** Conversation sirf ek user ke liye delete */
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],

    isMuted: [{ type: mongoose.Schema.Types.ObjectId, ref: "SocialUser" }],
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
conversationSchema.index({ participants: 1, updatedAt: -1 });

// ── Static Methods ────────────────────────────────────────────────────────────

/** Do users ke beech conversation dhundo ya banao */
conversationSchema.statics.findOrCreate = async function (userIdA, userIdB) {
  const existing = await this.findOne({
    participants: { $all: [userIdA, userIdB] },
    isGroup: false,
  });
  if (existing) return { conversation: existing, isNew: false };

  const conversation = await this.create({
    participants: [userIdA, userIdB],
  });
  return { conversation, isNew: true };
};

/** Unread count update */
conversationSchema.methods.incrementUnread = async function (forUserId) {
  const key     = forUserId.toString();
  const current = this.unreadCount.get(key) || 0;
  this.unreadCount.set(key, current + 1);
  await this.save({ validateBeforeSave: false });
};

/** Unread reset karo (user ne messages padh liye) */
conversationSchema.methods.resetUnread = async function (forUserId) {
  this.unreadCount.set(forUserId.toString(), 0);
  await this.save({ validateBeforeSave: false });
};

const Conversation =
  mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);

export { Message, Conversation };