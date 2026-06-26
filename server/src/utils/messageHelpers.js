import prisma from "../config/prisma.js";
import { encryptMessage, decryptMessage } from "./encryption.js";

// ── Sync lastMessage preview ────────────────────────────────────────────
export const syncLastMessage = async (conversationId, msg) => {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessage: {
        messageId: msg.id,
        text: msg.isDeleted ? "" : encryptMessage((msg.text ?? "").slice(0, 100)),
        senderId: msg.senderId,
        sentAt: msg.createdAt,
        isDeleted: msg.isDeleted ?? false,
      },
    },
  });
};

// ── Get conversations list ──────────────────────────────────────────────
export const getConversationsList = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const members = await prisma.conversationParticipant.findMany({
    where: { userId, isDeleted: false },
    select: { conversationId: true, unreadCount: true },
  });

  const convIds = members.map((m) => m.conversationId);
  const memberMap = new Map(members.map((m) => [m.conversationId, m]));

  const conversations = await prisma.conversation.findMany({
    where: {
      id: { in: convIds },
      isActive: true,
    },
    orderBy: { updatedAt: "desc" },
    skip,
    take: limit + 1,
    include: {
      members: {
        where: { isDeleted: false },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true,
              isVerifiedBadge: true,
              accountStatus: true,
            },
          },
        },
      },
    },
  });

  const hasMore = conversations.length > limit;
  const items = hasMore ? conversations.slice(0, limit) : conversations;

  const formatted = items.map((conv) => ({
    ...conv,
    unreadCount: memberMap.get(conv.id)?.unreadCount ?? 0,
    participants: conv.members.map((m) => m.user),
  }));

  return { conversations: formatted, hasMore };
};

// ── Get or create DM ────────────────────────────────────────────────────
export const getOrCreateDM = async (userId, participantId) => {
  const existing = await prisma.conversation.findFirst({
    where: {
      isGroup: false,
      isActive: true,
      AND: [
        { members: { some: { userId, isDeleted: false } } },
        { members: { some: { userId: participantId, isDeleted: false } } },
      ],
    },
    include: {
      members: {
        where: { isDeleted: false },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true,
              isVerifiedBadge: true,
              accountStatus: true,
            },
          },
        },
      },
    },
  });

  if (existing) {
    return {
      ...existing,
      participants: existing.members.map((m) => m.user),
    };
  }

  // Create new DM
  const conversation = await prisma.conversation.create({
    data: {
      isGroup: false,
      members: {
        create: [
          { userId },
          { userId: participantId },
        ],
      },
    },
    include: {
      members: {
        where: { isDeleted: false },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true,
              isVerifiedBadge: true,
              accountStatus: true,
            },
          },
        },
      },
    },
  });

  return {
    ...conversation,
    participants: conversation.members.map((m) => m.user),
  };
};

// ── Get total unread count ──────────────────────────────────────────────
export const getTotalUnread = async (userId) => {
  const result = await prisma.conversationParticipant.aggregate({
    where: { userId, isDeleted: false },
    _sum: { unreadCount: true },
  });

  return result._sum.unreadCount ?? 0;
};

// ── Mark conversation read ──────────────────────────────────────────────
export const markConversationRead = async (conversationId, userId) => {
  // Reset unread counter
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { unreadCount: 0, lastSeenAt: new Date() },
  });

  // Mark all messages as seen via MessageReceipt
  const unreadMessages = await prisma.message.findMany({
    where: { conversationId, isDeleted: false },
    select: { id: true },
  });

  await Promise.all(
    unreadMessages.map((msg) =>
      prisma.messageReceipt.upsert({
        where: { messageId_userId: { messageId: msg.id, userId } },
        update: { seenAt: new Date() },
        create: {
          messageId: msg.id,
          userId,
          conversationId,
          seenAt: new Date(),
        },
      })
    )
  );
};

// ── Soft delete conversation for user ───────────────────────────────────
export const softDeleteConversationForUser = async (conversationId, userId) => {
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { isDeleted: true, deletedAt: new Date() },
  });
};

// ── Get messages (cursor-paginated) ────────────────────────────────────
export const getMessages = async (conversationId, userId, { limit = 30, before = null } = {}) => {
  const member = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { clearedAt: true },
  });

  const where = {
    conversationId,
    isDeleted: false,
    ...(member?.clearedAt && { createdAt: { gt: member.clearedAt } }),
  };

  if (before) {
    const cursorMsg = await prisma.message.findUnique({
      where: { id: before },
      select: { createdAt: true },
    });
    if (cursorMsg) {
      where.createdAt = {
        ...where.createdAt,
        lt: cursorMsg.createdAt,
      };
    }
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          isVerifiedBadge: true,
        },
      },
    },
  });

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;

  items.reverse();

  const decrypted = items.map((msg) => ({
    ...msg,
    text: msg.text ? decryptMessage(msg.text) : "",
  }));

  return {
    messages: decrypted,
    hasMore,
    nextCursor: hasMore ? items[0]?.id : null,
  };
};

// ── Send message ────────────────────────────────────────────────────────
export const createMessage = async (conversationId, senderId, { text, image, replyTo } = {}) => {
  let replyPreview = null;
  if (replyTo) {
    const parent = await prisma.message.findUnique({
      where: { id: replyTo },
      select: {
        id: true,
        text: true,
        image: true,
        isDeleted: true,
        senderId: true,
      },
    });

    if (parent) {
      replyPreview = {
        messageId: parent.id,
        text: parent.isDeleted ? "" : (parent.text?.slice(0, 100) ?? ""),
        senderId: parent.senderId,
        isDeleted: parent.isDeleted ?? false,
      };
    }
  }

  const msg = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      text: text?.trim() ? encryptMessage(text.trim()) : "",
      image: image || null,
      replyTo: replyPreview || undefined,
      type: image && !text?.trim() ? "image" : "text",
    },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          isVerifiedBadge: true,
        },
      },
    },
  });

  return msg;
};

// ── Increment unread for recipients ────────────────────────────────────
export const incrementUnreadForRecipients = async (conversationId, senderId) => {
  await prisma.conversationParticipant.updateMany({
    where: {
      conversationId,
      userId: { not: senderId },
      isDeleted: false,
    },
    data: { unreadCount: { increment: 1 } },
  });
};

// ── Edit message ────────────────────────────────────────────────────────
export const editMessage = async (messageId, userId, newText) => {
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, senderId: true, isDeleted: true, conversationId: true },
  });

  if (!msg) throw new Error("Message not found");
  if (msg.isDeleted) throw new Error("Cannot edit a deleted message");
  if (msg.senderId !== userId) throw new Error("Unauthorized");

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: {
      text: encryptMessage(newText.trim()),
      isEdited: true,
      editedAt: new Date(),
    },
  });

  return updated;
};

// ── Soft delete message ─────────────────────────────────────────────────
export const softDeleteMessage = async (messageId, userId) => {
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, senderId: true, isDeleted: true, conversationId: true },
  });

  if (!msg) throw new Error("Message not found");
  if (msg.isDeleted) throw new Error("Message already deleted");
  if (msg.senderId !== userId) throw new Error("Unauthorized");

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      text: "",
      image: null,
      reactions: [],
    },
  });

  return updated;
};

// ── React to message ────────────────────────────────────────────────────
export const reactToMessage = async (messageId, userId, emoji) => {
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, isDeleted: true, reactions: true, conversationId: true },
  });

  if (!msg) throw new Error("Message not found");
  if (msg.isDeleted) throw new Error("Cannot react to a deleted message");

  const filtered = (msg.reactions || []).filter((r) => r.userId !== userId);

  if (emoji?.trim()) {
    filtered.push({ userId, emoji: emoji.trim(), reactedAt: new Date() });
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { reactions: filtered },
  });

  return updated;
};

// ── Clear chat for user ─────────────────────────────────────────────────
export const clearChatForUser = async (conversationId, userId) => {
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { clearedAt: new Date() },
  });
};

// ── Verify participant ──────────────────────────────────────────────────
export const isParticipant = async (conversationId, userId) => {
  const member = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true, isDeleted: true },
  });

  return !!member && !member.isDeleted;
};