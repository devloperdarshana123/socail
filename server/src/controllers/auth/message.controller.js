

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import * as MsgHelper from "../../utils/messageHelpers.js";
import { encryptMessage, decryptMessage } from "../../utils/encryption.js";

const isValidUUID = (id) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);


export const getConversations = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page  = Math.max(parseInt(req.query.page)  || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  const { conversations, hasMore } = await MsgHelper.getConversationsList(
    userId, page, limit
  );

  return res.status(200).json({
    success: true,
    data: conversations,
    pagination: { page, limit, hasMore },
  });
});


export const getOrCreateConversation = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { participantId } = req.body;

  if (!participantId)
    return next(new AppError("participantId is required.", 400));

  if (participantId === userId)
    return next(new AppError("Cannot start a conversation with yourself.", 400));

  if (!isValidUUID(participantId))
    return next(new AppError("Invalid participantId.", 400));

  // Check participant exists
  const participant = await MsgHelper.findParticipantById(participantId);
  if (!participant)
    return next(new AppError("User not found.", 404));

  const conversation = await MsgHelper.getOrCreateDM(userId, participantId);

  return res.status(200).json({ success: true, data: conversation });
});


export const getTotalUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await MsgHelper.getTotalUnread(req.user.id);
  return res.status(200).json({ success: true, data: { unreadCount } });
});


export const markConversationRead = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { conversationId } = req.params;

  if (!isValidUUID(conversationId))
    return next(new AppError("Invalid conversationId.", 400));

  const isMember = await MsgHelper.isParticipant(conversationId, userId);
  if (!isMember)
    return next(new AppError("Unauthorized.", 403));

  await MsgHelper.markConversationRead(conversationId, userId);

  return res.status(200).json({ success: true });
});


export const deleteConversation = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { conversationId } = req.params;

  if (!isValidUUID(conversationId))
    return next(new AppError("Invalid conversationId.", 400));

  const conv = await MsgHelper.findConversationExists(conversationId);
  if (!conv)
    return next(new AppError("Conversation not found.", 404));

  const isMember = await MsgHelper.isParticipant(conversationId, userId);
  if (!isMember)
    return next(new AppError("Unauthorized.", 403));

  await MsgHelper.softDeleteConversationForUser(conversationId, userId);

  return res.status(200).json({ success: true });
});


export const getMessages = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { conversationId } = req.params;
  const limit  = Math.min(parseInt(req.query.limit) || 30, 100);
  const before = req.query.before || null;

  if (!isValidUUID(conversationId))
    return next(new AppError("Invalid conversationId.", 400));

  if (before && !isValidUUID(before))
    return next(new AppError("Invalid cursor.", 400));

  const isMember = await MsgHelper.isParticipant(conversationId, userId);
  if (!isMember)
    return next(new AppError("Unauthorized.", 403));

 const { messages, hasMore, nextCursor } = await MsgHelper.getMessages(
    conversationId, userId, { limit, before }
  );

  // Decrypt messages
  const decryptedMessages = messages.map((msg) => ({
    ...msg,
    text: msg.text ? decryptMessage(msg.text) : msg.text,
  }));

  // Background: reset unread
  MsgHelper.markConversationRead(conversationId, userId).catch(() => {});

  return res.status(200).json({
    success: true,
    data: decryptedMessages,
    pagination: { hasMore, nextCursor },
  });
});


export const sendMessage = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { conversationId, text, image, replyTo } = req.body;

  if (!conversationId)
    return next(new AppError("conversationId is required.", 400));
  if (!text?.trim() && !image)
    return next(new AppError("text or image is required.", 400));
  if (text && text.trim().length > 2000)
    return next(new AppError("Message cannot exceed 2000 characters.", 400));

  if (!isValidUUID(conversationId))
    return next(new AppError("Invalid conversationId.", 400));

  if (replyTo && !isValidUUID(replyTo))
    return next(new AppError("Invalid replyTo ID.", 400));

  const isMember = await MsgHelper.isParticipant(conversationId, userId);
  if (!isMember)
    return next(new AppError("Unauthorized.", 403));

  const msg = await MsgHelper.createMessage(conversationId, userId, {
    text: text?.trim() ? encryptMessage(text.trim()) : null,
    image,
    replyTo: replyTo || null,
  });
  // Sync lastMessage + increment unread (parallel)
  await Promise.all([
    MsgHelper.syncLastMessage(conversationId, msg),
    MsgHelper.incrementUnreadForRecipients(conversationId, userId),
  ]);

  return res.status(201).json({
    success: true,
   data: {
      ...msg,
      text: text?.trim() || "", // plain text — encrypted nahi
    },
  });
});


export const editMessage = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { messageId } = req.params;
  const { text } = req.body;

  if (!isValidUUID(messageId))
    return next(new AppError("Invalid messageId.", 400));

  if (!text?.trim())
    return next(new AppError("text is required.", 400));
  if (text.trim().length > 2000)
    return next(new AppError("Message cannot exceed 2000 characters.", 400));

  try {
   const updated = await MsgHelper.editMessage(messageId, userId, encryptMessage(text.trim()));
    await MsgHelper.syncLastMessage(updated.conversationId, updated);

    return res.status(200).json({
      success: true,
      data: {
        messageId: updated.id,
        text: text.trim(), 
        isEdited: true,
        editedAt: updated.editedAt,
      },
    });
  } catch (err) {
    const status = err.message === "Unauthorized" ? 403
      : err.message === "Message not found" ? 404
      : 400;
    return next(new AppError(err.message, status));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/v2/messages/:messageId
// ─────────────────────────────────────────────────────────────────────────────

export const deleteMessage = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { messageId } = req.params;

  if (!isValidUUID(messageId))
    return next(new AppError("Invalid messageId.", 400));

  try {
    const deleted = await MsgHelper.softDeleteMessage(messageId, userId);
    await MsgHelper.syncLastMessage(deleted.conversationId, deleted);

    return res.status(200).json({
      success: true,
      data: { messageId: deleted.id, isDeleted: true },
    });
  } catch (err) {
    const status = err.message === "Unauthorized" ? 403
      : err.message.includes("not found") ? 404
      : 400;
    return next(new AppError(err.message, status));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v2/messages/:messageId/react
//  Body: { emoji } — empty = remove reaction
// ─────────────────────────────────────────────────────────────────────────────

export const reactToMessage = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { messageId } = req.params;
  const { emoji } = req.body;

  if (!isValidUUID(messageId))
    return next(new AppError("Invalid messageId.", 400));

  // Participant check
  const msg = await MsgHelper.getMessageConversationId(messageId);
  if (!msg)
    return next(new AppError("Message not found.", 404));

  const isMember = await MsgHelper.isParticipant(msg.conversationId, userId);
  if (!isMember)
    return next(new AppError("Unauthorized.", 403));

  try {
    const updated = await MsgHelper.reactToMessage(messageId, userId, emoji);
    return res.status(200).json({
      success: true,
      data: { messageId: updated.id, reactions: updated.reactions },
    });
  } catch (err) {
    return next(new AppError(err.message, 400));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/v2/messages/conversations/:conversationId/clear
// ─────────────────────────────────────────────────────────────────────────────

export const clearChat = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { conversationId } = req.params;

  if (!isValidUUID(conversationId))
    return next(new AppError("Invalid conversationId.", 400));

  const isMember = await MsgHelper.isParticipant(conversationId, userId);
  if (!isMember)
    return next(new AppError("Unauthorized.", 403));

  await MsgHelper.clearChatForUser(conversationId, userId);

  return res.status(200).json({ success: true, message: "Chat cleared." });
});