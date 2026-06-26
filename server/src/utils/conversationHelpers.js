import prisma from "../config/prisma.js";

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
  // Check existing DM
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

// ── Is participant ──────────────────────────────────────────────────────
export const isParticipant = async (conversationId, userId) => {
  const member = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true, isDeleted: true },
  });

  return !!member && !member.isDeleted;
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

// ── Clear chat for user ─────────────────────────────────────────────────
export const clearChatForUser = async (conversationId, userId) => {
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { clearedAt: new Date() },
  });
};