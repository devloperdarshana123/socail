import { Schema } from "mongoose";
import {
  mediaSchema,
  reactionSchema,
  replyReferenceSchema,
  metadataValidator,
} from "./subdocuments/index.js";
import { timestampsPlugin, jsonTransformPlugin, softDeletePlugin, paginationPlugin } from "../plugins/index.js";
import { MESSAGE_TYPE, NOTIFICATION_AUDIENCE } from "../constants/index.js";
import { applyMessagingIndexes } from "../indexes/messaging.indexes.js";

// ─────────────────────────────────────────────
//  conversations — participantIds embedded (small, bounded, needed on
//  every list query); per-participant state lives in
//  conversationParticipants instead (independently, frequently updated).
// ─────────────────────────────────────────────
export const conversationSchema = new Schema(
  {
    isGroup: { type: Boolean, default: false },
    groupName: { type: String },
    groupAvatar: { type: mediaSchema },
    groupAdminId: { type: Schema.Types.ObjectId, ref: "User" },
    participantIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    participantsKey: { type: String, unique: true, sparse: true }, // sorted-ids hash, dedupes 1:1 threads
    isActive: { type: Boolean, default: true },
    lastMessage: {
      // Chathandler's syncLastMessage writes `{ messageId, text,
      // senderId, sentAt }`; messageId was not declared and was dropped.
      messageId: { type: Schema.Types.ObjectId, ref: "Message" },
      text: { type: String },
      senderId: { type: Schema.Types.ObjectId, ref: "User" },
      sentAt: { type: Date },
    },
    disbandedAt: { type: Date },
  }
);
conversationSchema.virtual("participants", {
  ref: "ConversationParticipant",
  localField: "_id",
  foreignField: "conversationId",
});
conversationSchema.virtual("messages", {
  ref: "Message",
  localField: "_id",
  foreignField: "conversationId",
});
// Relation alias. Prisma calls this relation `members`; the Mongo schema
// exposed it only as `participants`, so every populate("members") — which
// is what the repository issues, because that is the name the callers use
// — targeted a path that did not exist.
conversationSchema.virtual("members", {
  ref: "ConversationParticipant",
  localField: "_id",
  foreignField: "conversationId",
});
conversationSchema.plugin(timestampsPlugin);
conversationSchema.plugin(jsonTransformPlugin);
applyMessagingIndexes.conversation(conversationSchema);

// ─────────────────────────────────────────────
//  conversationParticipants — the independently-updated half of what
//  Postgres modeled as one join table (see Phase 2, Group 5).
// ─────────────────────────────────────────────
export const conversationParticipantSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    unreadCount: { type: Number, default: 0, min: 0 },
    isArchived: { type: Boolean, default: false },
    lastSeenAt: { type: Date },
    clearedAt: { type: Date },
  }
);
// ── Relation aliases ─────────────────────────────────────────────────────
// The application names its relations the way Prisma does — `post.author`,
// `message.sender`, `participant.user`. Mongo stores the FK under
// `authorId`/`senderId`/`userId`, and `populate("authorId")` attaches the
// joined document to THAT name, so `post.author` stayed undefined even on a
// successfully populated read. Every M-10 populate had the same hole.
//
// These virtuals give each relation its Prisma name, so `populate("author")`
// works and the populated document lands where every caller already looks.
conversationParticipantSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});
conversationParticipantSchema.virtual("conversation", {
  ref: "Conversation",
  localField: "conversationId",
  foreignField: "_id",
  justOne: true,
});
conversationParticipantSchema.plugin(timestampsPlugin);
conversationParticipantSchema.plugin(jsonTransformPlugin);
conversationParticipantSchema.plugin(softDeletePlugin);
applyMessagingIndexes.conversationParticipant(conversationParticipantSchema);

// ─────────────────────────────────────────────
//  messages — editHistory/reactions/replyTo embedded (small, bounded,
//  always read alongside the message — a direct fit for what Postgres
//  already stored as Json/Json[] columns).
// ─────────────────────────────────────────────
export const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, default: "" }, // app-layer AES-256-CBC encrypted at rest — unchanged from Postgres-era behavior
    image: { type: mediaSchema },
    type: { type: String, enum: MESSAGE_TYPE, default: "text" },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    editHistory: [
      {
        text: { type: String },
        editedAt: { type: Date, default: Date.now },
      },
    ],
    reactions: [{ type: reactionSchema }],
    replyTo: { type: replyReferenceSchema },
  }
);
// ── Relation aliases ─────────────────────────────────────────────────────
// The application names its relations the way Prisma does — `post.author`,
// `message.sender`, `participant.user`. Mongo stores the FK under
// `authorId`/`senderId`/`userId`, and `populate("authorId")` attaches the
// joined document to THAT name, so `post.author` stayed undefined even on a
// successfully populated read. Every M-10 populate had the same hole.
//
// These virtuals give each relation its Prisma name, so `populate("author")`
// works and the populated document lands where every caller already looks.
messageSchema.virtual("sender", {
  ref: "User",
  localField: "senderId",
  foreignField: "_id",
  justOne: true,
});
messageSchema.plugin(timestampsPlugin);
messageSchema.plugin(jsonTransformPlugin);
messageSchema.plugin(softDeletePlugin);
applyMessagingIndexes.message(messageSchema);

// ─────────────────────────────────────────────
//  messageReceipts — per-participant seen/read state, high write volume.
// ─────────────────────────────────────────────
export const messageReceiptSchema = new Schema(
  {
    messageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    seenAt: { type: Date },
    readAt: { type: Date },
  },
  { timestamps: false }
);
messageReceiptSchema.plugin(jsonTransformPlugin);
applyMessagingIndexes.messageReceipt(messageReceiptSchema);

// ─────────────────────────────────────────────
//  notifications — absorbs AdminNotification via an `audience` field
//  (audience:"admin" + receiverId:null = broadcast). Owned exclusively by
//  chat-server per the Phase 2 §4 resolution — server reads this
//  collection but does not write it (see Milestone 3+ repository layer).
// ─────────────────────────────────────────────
export const notificationSchema = new Schema(
  {
    audience: { type: String, enum: NOTIFICATION_AUDIENCE, default: "user" },
    receiverId: { type: Schema.Types.ObjectId, ref: "User" }, // null + audience:"admin" = broadcast
    senderId: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, required: true }, // "like","comment","follow","order:new","quote:received", …
    // AdminNotification.label on Postgres — a real column with data, and
    // adminNotificationHelpers.createAdminNotification writes it on every
    // admin notification. It had no destination here, so the write was
    // dropped and the column had nowhere to migrate.
    label: { type: String },
    refType: { type: String }, // polymorphic target — no refPath, see ../validators/index.js
    refId: { type: Schema.Types.ObjectId },
    meta: { type: Schema.Types.Mixed, validate: metadataValidator },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    ttlExpiresAt: { type: Date },
  }
);
// ── Relation aliases ─────────────────────────────────────────────────────
// The application names its relations the way Prisma does — `post.author`,
// `message.sender`, `participant.user`. Mongo stores the FK under
// `authorId`/`senderId`/`userId`, and `populate("authorId")` attaches the
// joined document to THAT name, so `post.author` stayed undefined even on a
// successfully populated read. Every M-10 populate had the same hole.
//
// These virtuals give each relation its Prisma name, so `populate("author")`
// works and the populated document lands where every caller already looks.
notificationSchema.virtual("sender", {
  ref: "User",
  localField: "senderId",
  foreignField: "_id",
  justOne: true,
});
notificationSchema.virtual("receiver", {
  ref: "User",
  localField: "receiverId",
  foreignField: "_id",
  justOne: true,
});
notificationSchema.plugin(timestampsPlugin);
notificationSchema.plugin(jsonTransformPlugin);
notificationSchema.plugin(softDeletePlugin);
notificationSchema.plugin(paginationPlugin);
applyMessagingIndexes.notification(notificationSchema);
