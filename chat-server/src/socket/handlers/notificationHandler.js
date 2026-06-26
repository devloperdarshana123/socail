import prisma from "../../config/prisma.js";
import { fetchSender } from "../../services/userService.js";
import logger from "../../utils/logger.js";

export default (io, socket) => {
  const userId = (socket.user?.id || socket.user?._id)?.toString();
  if (!userId) return;

  socket.join(userId);
  logger.info(`🔔 Notification room joined: ${userId}`);

  const notify = async ({ to, type, refId = null, refModel = null, meta = {} }) => {
    if (!to || to.toString() === userId) return;

    let saved;
    try {
      saved = await prisma.notification.create({
        data: {
          receiverId: to.toString(),
          senderId:   userId,
          type,
          refId,
          refModel,
          meta,
        },
      });
    } catch (err) {
      logger.error(`❌ DB save failed [${type}]`, { message: err.message });
      return;
    }

    let senderObj;
    try {
      senderObj = await fetchSender(userId);
    } catch (err) {
      logger.error(`❌ fetchSender failed`, { message: err.message });
      return;
    }

    const payload = {
      _id:      saved.id,
      type,
      sender:   senderObj,
      receiver: to.toString(),
      refId:    saved.refId    ?? null,
      refModel: saved.refModel ?? null,
      meta:     saved.meta     ?? {},
      isRead:   false,
      createdAt: saved.createdAt,
    };

    io.to(to.toString()).emit("notification:new", payload);
    logger.info(`🔔 notification:new → ${to} [${type}]`);
  };

  // ── Listeners ─────────────────────────────────────────────────────────────
  socket.on("send_follow_request", ({ to }) => {
    if (to) notify({ to, type: "follow_request" });
  });
  socket.on("follow_accepted", ({ to }) => {
    if (to) notify({ to, type: "follow_request_accepted" });
  });
  socket.on("send_follow", ({ to }) => {
    if (to) notify({ to, type: "follow" });
  });
  socket.on("send_like", ({ to, postId }) => {
    if (to && postId) notify({ to, type: "post_like", refId: postId, refModel: "Post" });
  });
  socket.on("send_comment", ({ to, postId, preview = null }) => {
    if (to && postId) notify({
      to, type: "post_comment", refId: postId, refModel: "Post",
      meta: { preview: preview?.slice(0, 100) ?? null },
    });
  });
  socket.on("send_reply", ({ to, postId, commentId, preview = null }) => {
    if (to) notify({
      to, type: "comment_reply",
      refId: commentId || postId, refModel: "Comment",
      meta: { preview: preview?.slice(0, 100) ?? null },
    });
  });
  socket.on("send_comment_like", ({ to, commentId }) => {
    if (to && commentId) notify({ to, type: "comment_like", refId: commentId, refModel: "Comment" });
  });
  socket.on("send_story_reaction", ({ to, storyId, reaction }) => {
    if (to && storyId) notify({
      to, type: "story_reaction", refId: storyId, refModel: "Story",
      meta: { reaction },
    });
  });

  // ── Mark as read ──────────────────────────────────────────────────────────
  socket.on("notification:mark_read", async ({ notificationId }) => {
    try {
      if (notificationId === "all") {
        await prisma.notification.updateMany({
          where: { receiverId: userId, isRead: false },
          data:  { isRead: true, readAt: new Date() },
        });
      } else {
        await prisma.notification.updateMany({
          where: { id: notificationId, receiverId: userId },
          data:  { isRead: true, readAt: new Date() },
        });
      }
      const count = await prisma.notification.count({
        where: { receiverId: userId, isRead: false, isDeleted: false },
      });
      socket.emit("notification:unread_count", { count });
    } catch (err) {
      logger.error("❌ Mark read failed", { message: err.message });
      socket.emit("notification:error", { message: "Failed to mark as read" });
    }
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  socket.on("notification:delete", async ({ notificationId }) => {
    try {
      await prisma.notification.updateMany({
        where: { id: notificationId, receiverId: userId },
        data:  { isDeleted: true, deletedAt: new Date() },
      });
      const count = await prisma.notification.count({
        where: { receiverId: userId, isRead: false, isDeleted: false },
      });
      socket.emit("notification:unread_count", { count });
    } catch (err) {
      logger.error("❌ Delete failed", { message: err.message });
      socket.emit("notification:error", { message: "Failed to delete notification" });
    }
  });
};