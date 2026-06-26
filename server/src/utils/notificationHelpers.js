import prisma from "../config/prisma.js";

// ── Get inbox (paginated) ───────────────────────────────────────────────
export const getInbox = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  return prisma.notification.findMany({
    where: {
      receiverId: userId,
      isDeleted: false,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip,
    select: {
      id: true,
      type: true,
      isRead: true,
      createdAt: true,
      sender: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          isVerifiedBadge: true,
        },
      },
      // Add any other fields your Notification model has
      // e.g. postId, commentId, etc.
    },
  });
};

// ── Get unread count ────────────────────────────────────────────────────
export const getUnreadCount = async (userId) => {
  return prisma.notification.count({
    where: {
      receiverId: userId,
      isRead: false,
      isDeleted: false,
    },
  });
};

// ── Mark all as read ────────────────────────────────────────────────────
export const markAllAsRead = async (userId) => {
  return prisma.notification.updateMany({
    where: {
      receiverId: userId,
      isRead: false,
      isDeleted: false,
    },
    data: { isRead: true },
  });
};

// ── Mark one as read ────────────────────────────────────────────────────
export const markOneAsRead = async (notificationId, userId) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, receiverId: true, isDeleted: true },
  });

  if (!notification || notification.isDeleted || notification.receiverId !== userId) {
    return null;
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
};

// ── Soft delete one ─────────────────────────────────────────────────────
export const softDeleteOne = async (notificationId, userId) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, receiverId: true, isDeleted: true },
  });

  if (!notification || notification.isDeleted || notification.receiverId !== userId) {
    return null;
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isDeleted: true, deletedAt: new Date() },
  });
};

// ── Soft delete all ─────────────────────────────────────────────────────
export const softDeleteAll = async (userId) => {
  return prisma.notification.updateMany({
    where: {
      receiverId: userId,
      isDeleted: false,
    },
    data: { isDeleted: true, deletedAt: new Date() },
  });
};