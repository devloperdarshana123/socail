import { notificationRepository } from "../config/repositories.js";

// Persistence for the notification inbox now flows through the repository
// layer (Phase 7A) instead of the Prisma client directly. Database/behavior
// are unchanged — every query below is the same shape as the prisma.* call
// it replaces; only the access path moved.
//
// Ownership guards (receiverId checks), the page/limit → skip arithmetic and
// the projection all stay here; the repository only executes the queries.

// The sender projection attached to every inbox row.
const NOTIFICATION_SENDER_SELECT = {
  id: true,
  username: true,
  fullName: true,
  avatar: true,
  isVerifiedBadge: true,
};

// ── Get inbox (paginated) ───────────────────────────────────────────────
export const getInbox = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  return notificationRepository.findManyWithRelations(
    {
      receiverId: userId,
      isDeleted: false,
    },
    {
      take: limit,
      skip,
      select: {
        id: true,
        type: true,
        isRead: true,
        createdAt: true,
        sender: { select: NOTIFICATION_SENDER_SELECT },
        // Add any other fields your Notification model has
        // e.g. postId, commentId, etc.
      },
    }
  );
};

// ── Get unread count ────────────────────────────────────────────────────
export const getUnreadCount = async (userId) => {
  return notificationRepository.count({
    receiverId: userId,
    isRead: false,
    isDeleted: false,
  });
};

// ── Mark all as read ────────────────────────────────────────────────────
export const markAllAsRead = async (userId) => {
  return notificationRepository.updateManyWhere(
    {
      receiverId: userId,
      isRead: false,
      isDeleted: false,
    },
    { isRead: true }
  );
};

// ── Mark one as read ────────────────────────────────────────────────────
export const markOneAsRead = async (notificationId, userId) => {
  const notification = await notificationRepository.findById(notificationId, {
    select: { id: true, receiverId: true, isDeleted: true },
  });

  if (!notification || notification.isDeleted || String(notification.receiverId) !== String(userId)) {
    return null;
  }

  return notificationRepository.update(notificationId, { isRead: true });
};

// ── Soft delete one ─────────────────────────────────────────────────────
export const softDeleteOne = async (notificationId, userId) => {
  const notification = await notificationRepository.findById(notificationId, {
    select: { id: true, receiverId: true, isDeleted: true },
  });

  if (!notification || notification.isDeleted || String(notification.receiverId) !== String(userId)) {
    return null;
  }

  // update(), NOT delete() — the repository's delete() applies its own
  // soft-delete payload; this writes the same two fields explicitly, keeping
  // the decision here rather than in the repository.
  return notificationRepository.update(notificationId, {
    isDeleted: true,
    deletedAt: new Date(),
  });
};

// ── Soft delete all ─────────────────────────────────────────────────────
export const softDeleteAll = async (userId) => {
  return notificationRepository.updateManyWhere(
    {
      receiverId: userId,
      isDeleted: false,
    },
    { isDeleted: true, deletedAt: new Date() }
  );
};
