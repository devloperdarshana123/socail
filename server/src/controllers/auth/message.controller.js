// server/src/controllers/auth/Message.controller.js
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import Conversation from "../../models/conversation.model.js";
import { ConversationMember } from "../../models/conversation.model.js";
import Message from "../../models/message.model.js";
import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Conversation ka lastMessage preview update karo (denormalized sub-schema)
 */
const syncLastMessage = async (conversationId, msg) => {
  await Conversation.findByIdAndUpdate(conversationId, {
    $set: {
      lastMessage: {
        messageId: msg._id,
        text: msg.isDeleted ? "" : (msg.text?.slice(0, 100) ?? ""),
        senderId: msg.sender,
        sentAt: msg.createdAt,
        isDeleted: msg.isDeleted ?? false,
      },
    },
  });
};

/**
 * Participant verification — reusable
 */
const verifyParticipant = (conv, userId) => {
  return conv.participants.map((p) => p.toString()).includes(userId.toString());
};

// ─────────────────────────────────────────────────────────────────────────────
//  CONVERSATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/messages/conversations
 * Logged-in user ki saari conversations — sorted by latest activity.
 * Paginated: ?page=1&limit=20
 */
export const getConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const skip = (page - 1) * limit;

 const members = await ConversationMember.find({ userId, isDeleted: false })
    .select("conversationId unreadCount").lean();
  const convIds = members.map((m) => m.conversationId);
  const memberMap = {};
  members.forEach((m) => { memberMap[m.conversationId.toString()] = m; });

  const conversations = await Conversation.find({
    _id: { $in: convIds },
    isActive: true,
  })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit + 1) // hasMore check ke liye
    .populate("participants", "username fullName avatar isVerifiedBadge accountStatus")
    .lean();

  const hasMore = conversations.length > limit;
  if (hasMore) conversations.pop();

  // Unread count — Map field properly extract karo
const formatted = conversations.map((conv) => {
  const member = memberMap[conv._id.toString()] ?? {};
  return {
    ...conv,
    unreadCount: member.unreadCount ?? 0,
    // ✅ avatar normalize — frontend avatar.url expect karta hai
    participants: (conv.participants || []).map((p) => ({
      ...p,
      avatar: p.avatar?.url !== undefined
        ? p.avatar
        : { url: p.avatar || null, publicId: null },
    })),
  };
});
  res.status(200).json({
    success: true,
    data: formatted,
    pagination: { page, limit, hasMore },
  });
});

/**
 * POST /api/messages/conversations
 * Do users ke beech DM conversation get ya create karo.
 * Body: { participantId }
 */
export const getOrCreateConversation = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { participantId } = req.body;

  if (!participantId)
    return next(new AppError("participantId is required.", 400));

  if (participantId === userId.toString())
    return next(new AppError("Cannot start a conversation with yourself.", 400));

  if (!mongoose.isValidObjectId(participantId))
    return next(new AppError("Invalid participantId.", 400));

  // Existing conversation dhundo
  let conv = await Conversation.findOne({
    isGroup: false,
    participants: { $all: [userId, participantId], $size: 2 },
    isActive: true,
  }).populate("participants", "username fullName avatar isVerifiedBadge accountStatus");


  if (conv) {
  await ConversationMember.bulkWrite([
    {
      updateOne: {
        filter: { conversationId: conv._id, userId },
        update: { $setOnInsert: { conversationId: conv._id, userId, unreadCount: 0, isDeleted: false } },
        upsert: true,
      },
    },
    {
      updateOne: {
        filter: { conversationId: conv._id, userId: new mongoose.Types.ObjectId(participantId) },
        update: { $setOnInsert: { conversationId: conv._id, userId: new mongoose.Types.ObjectId(participantId), unreadCount: 0, isDeleted: false } },
        upsert: true,
      },
    },
  ]);
}
  // Nahi mila toh create karo
 if (!conv) {
    const sorted = [userId, new mongoose.Types.ObjectId(participantId)]
      .sort((a, b) => a.toString().localeCompare(b.toString()));
    conv = await Conversation.create({
      participants: sorted,
      isGroup: false,
    });
    await ConversationMember.insertMany([
      { conversationId: conv._id, userId: sorted[0] },
      { conversationId: conv._id, userId: sorted[1] },
    ]).catch(() => {});
    conv = await conv.populate(
      "participants",
      "username fullName avatar isVerifiedBadge accountStatus",
    );
  }

  res.status(200).json({ success: true, data: conv });
});

/**
 * GET /api/messages/conversations/unread-count
 * Navbar badge ke liye total unread count across all conversations.
 */
export const getTotalUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user._id;

 const members = await ConversationMember.find({ userId, isDeleted: false })
    .select("unreadCount").lean();
  const total = members.reduce((sum, m) => sum + (m.unreadCount ?? 0), 0);
 

  res.status(200).json({ success: true, data: { unreadCount: total } });
});

/**
 * PATCH /api/messages/conversations/:conversationId/read
 * Conversation open karne par — unread reset + seenBy + readBy mark karo.
 */
export const markConversationRead = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { conversationId } = req.params;

  if (!mongoose.isValidObjectId(conversationId))
    return next(new AppError("Invalid conversationId.", 400));

  const conv = await Conversation.findById(conversationId).lean();
  if (!conv) return next(new AppError("Conversation not found.", 404));
  if (!verifyParticipant(conv, userId))
    return next(new AppError("Unauthorized.", 403));

  // Unread counter reset
 await ConversationMember.findOneAndUpdate(
    { conversationId, userId },
    { $set: { unreadCount: 0, lastSeenAt: new Date() } },
  );

  // Saare unread messages — seenBy aur readBy dono update karo (blue tick)

  await Message.updateMany(
  {
    conversation: conversationId,
    seenBy: { $ne: userId },
    isDeleted: false,
  },
  { $addToSet: { seenBy: userId } },
);
  

  res.status(200).json({ success: true });
});

/**fgetMessages
 * DELETE /api/messages/conversations/:conversationId
 * Conversation soft-delete (sirf apne liye) — doosre ke liye exist karti rahegi.
 */
export const deleteConversation = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { conversationId } = req.params;

  if (!mongoose.isValidObjectId(conversationId))
    return next(new AppError("Invalid conversationId.", 400));

  const conv = await Conversation.findById(conversationId).lean();
  if (!conv) return next(new AppError("Conversation not found.", 404));
  if (!verifyParticipant(conv, userId))
    return next(new AppError("Unauthorized.", 403));

  await Conversation.softDeleteForUser(conversationId, userId);

  res.status(200).json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
//  MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/messages/conversations/:conversationId/messages
 * Cursor-based paginated messages — stable under concurrent inserts.
 * Query: ?limit=30&before=<messageId>
 */
export const getMessages = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { conversationId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const before = req.query.before; // cursor messageId

  if (!mongoose.isValidObjectId(conversationId))
    return next(new AppError("Invalid conversationId.", 400));

  const conv = await Conversation.findById(conversationId).lean();
  if (!conv) return next(new AppError("Conversation not found.", 404));
  if (!verifyParticipant(conv, userId))
    return next(new AppError("Unauthorized.", 403));

  // Cursor query build karo
  // const query = { conversation: conversationId, isDeleted: false };

  // NAYA
const member = await ConversationMember.findOne({ conversationId, userId }).lean();
const query = { 
  conversation: conversationId, 
  isDeleted: false,
  ...(member?.clearedAt && { createdAt: { $gt: member.clearedAt } }),
};
  if (before && mongoose.isValidObjectId(before)) {
    const cursorMsg = await Message.findById(before).select("createdAt").lean();
    if (cursorMsg) query.createdAt = { $lt: cursorMsg.createdAt };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate("sender", "username fullName avatar isVerifiedBadge")
    .populate({
      path: "replyTo.messageId",
      select: "text image isDeleted sender",
      populate: { path: "sender", select: "username fullName" },
    })
    .lean();

  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();

  // UI ke liye ascending order
  messages.reverse();

  // Background mein read mark karo


  await ConversationMember.findOneAndUpdate(
    { conversationId, userId },
    { $set: { unreadCount: 0, lastSeenAt: new Date() } },
  );

  res.status(200).json({
    success: true,
    data: messages,
    pagination: {
      hasMore,
      nextCursor: hasMore ? messages[0]?._id : null,
    },
  });
});

/**
 * POST /api/messages/send
 * REST fallback — primary path socket hai.
 * Body: { conversationId, text?, image?, replyTo? }
 */
export const sendMessage = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { conversationId, text, image, replyTo } = req.body;

  if (!conversationId)
    return next(new AppError("conversationId is required.", 400));
  if (!text?.trim() && !image)
    return next(new AppError("text or image is required.", 400));
  if (text && text.trim().length > 2000)
    return next(new AppError("Message cannot exceed 2000 characters.", 400));

  const conv = await Conversation.findById(conversationId).lean();
  if (!conv) return next(new AppError("Conversation not found.", 404));
  if (!verifyParticipant(conv, userId))
    return next(new AppError("Unauthorized.", 403));

  // replyTo — denormalized preview banao
  let replyPreview = null;
  if (replyTo && mongoose.isValidObjectId(replyTo)) {
    const parent = await Message.findById(replyTo)
      .select("text image isDeleted sender")
      .lean();
    if (parent) {
      replyPreview = {
        messageId: parent._id,
        text: parent.isDeleted ? "" : (parent.text?.slice(0, 100) ?? ""),
        senderId: parent.sender,
        isDeleted: parent.isDeleted ?? false,
      };
    }
  }

  const msg = await Message.create({
    conversation: conversationId,
    sender: userId,
    text: text?.trim() || "",
    image: image || null,
    replyTo: replyPreview,
    type: image && !text?.trim() ? "image" : "text",
  });

  await msg.populate([
    { path: "sender", select: "username fullName avatar isVerifiedBadge" },
  ]);

  // lastMessage preview + unread increment (doosre participants ke liye)
  await syncLastMessage(conversationId, msg);

 const recipientIds = conv.participants
    .map((p) => p.toString())
    .filter((pid) => pid !== userId.toString());

  if (recipientIds.length) {
    await ConversationMember.bulkWrite(
      recipientIds.map((pid) => ({
        updateOne: {
          filter: { conversationId, userId: pid },
          update: { $inc: { unreadCount: 1 } },
        },
      })),
    );
  }

  res.status(201).json({ success: true, data: msg });
});

/**
 * PATCH /api/messages/:messageId
 * Message edit — sirf sender kar sakta hai, deleted message edit nahi hoga.
 * Body: { text }
 */
export const editMessage = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { messageId } = req.params;
  const { text } = req.body;

  if (!text?.trim()) return next(new AppError("text is required.", 400));
  if (text.trim().length > 2000)
    return next(new AppError("Message cannot exceed 2000 characters.", 400));

  const msg = await Message.findById(messageId);
  if (!msg) return next(new AppError("Message not found.", 404));
  if (msg.isDeleted)
    return next(new AppError("Cannot edit a deleted message.", 400));
  if (msg.sender.toString() !== userId.toString())
    return next(new AppError("Unauthorized.", 403));

  msg.text = text.trim();
  msg.isEdited = true;
  msg.editedAt = new Date(); // ← missing tha pehle
  await msg.save();

  // Agar lastMessage tha toh preview bhi update karo
  await syncLastMessage(msg.conversation, msg);

  res.status(200).json({
    success: true,
    data: {
      messageId: msg._id,
      text: msg.text,
      isEdited: true,
      editedAt: msg.editedAt,
    },
  });
});

/**
 * DELETE /api/messages/:messageId
 * Soft delete — text/image clear, lastMessage preview update.
 */
export const deleteMessage = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { messageId } = req.params;

  const msg = await Message.findById(messageId);
  if (!msg) return next(new AppError("Message not found.", 404));
  if (msg.isDeleted)
    return next(new AppError("Message already deleted.", 400));
  if (msg.sender.toString() !== userId.toString())
    return next(new AppError("Unauthorized.", 403));

  msg.isDeleted = true;
  msg.deletedAt = new Date();
  msg.text = "";      // content clear karo
  msg.image = null;   // image bhi remove
  msg.reactions = []; // reactions bhi clear
  await msg.save();

  // lastMessage tha toh preview update karo
  await syncLastMessage(msg.conversation, msg);

  res.status(200).json({
    success: true,
    data: { messageId: msg._id, isDeleted: true },
  });
});

/**
 * PATCH /api/messages/:messageId/react
 * Emoji reaction add/change/remove.
 * Body: { emoji } — empty string = remove reaction
 */
export const reactToMessage = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { messageId } = req.params;
  const { emoji } = req.body;

  if (!mongoose.isValidObjectId(messageId))
    return next(new AppError("Invalid messageId.", 400));

  const msg = await Message.findById(messageId);
  if (!msg) return next(new AppError("Message not found.", 404));
  if (msg.isDeleted)
    return next(new AppError("Cannot react to a deleted message.", 400));

  // Participant check
  const conv = await Conversation.findById(msg.conversation).lean();
  if (!conv || !verifyParticipant(conv, userId))
    return next(new AppError("Unauthorized.", 403));

  // Purani reaction remove karo
  msg.reactions = msg.reactions.filter(
    (r) => r.userId.toString() !== userId.toString(),
  );

  // Nai reaction add karo (agar emoji empty nahi hai)
  if (emoji?.trim()) {
    msg.reactions.push({ userId, emoji: emoji.trim(), reactedAt: new Date() });
  }

  await msg.save();

  res.status(200).json({
    success: true,
    data: { messageId: msg._id, reactions: msg.reactions },
  });
});

/**
 * DELETE /api/messages/conversations/:conversationId/clear
 * Sirf apne liye chat clear karo — doosre ke messages rahenge
 */
export const clearChat = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { conversationId } = req.params;

  if (!mongoose.isValidObjectId(conversationId))
    return next(new AppError("Invalid conversationId.", 400));

  const conv = await Conversation.findById(conversationId).lean();
  if (!conv) return next(new AppError("Conversation not found.", 404));
  if (!verifyParticipant(conv, userId))
    return next(new AppError("Unauthorized.", 403));

  // Sirf is user ke liye clearedAt timestamp set karo
  await ConversationMember.findOneAndUpdate(
    { conversationId, userId },
    { $set: { clearedAt: new Date() } },
  );

  return res.status(200).json({ success: true, message: "Chat cleared." });
});