// import prisma from "../../config/prisma.js";
// import { fetchSender, isBlocked } from "../../services/userService.js";
// import {
//   addSocket, removeSocket,
//   getSockets, isOnline, getAllOnline,
// } from "../../services/onlineStore.js";
// import logger from "../../utils/logger.js";
// import { encryptMessage, decryptMessage } from "../../utils/encryption.js";

// const syncLastMessage = async (conversationId, msg) => {
//   try {
//     await prisma.conversation.update({
//       where: { id: conversationId },
//       data: {
//         lastMessage: {
//           messageId: msg.id,
//           text:      msg.isDeleted ? "" : (msg.text?.slice(0, 100) ?? ""),
//           senderId:  msg.senderId,
//           sentAt:    msg.createdAt ?? new Date(),
//           isDeleted: msg.isDeleted ?? false,
//         },
//         updatedAt: new Date(),
//       },
//     });
//   } catch (err) {
//     logger.error("❌ syncLastMessage error", { message: err.message });
//   }
// };

// const normalizeParticipants = (conv) => {
//   if (!conv) return null;
//   return {
//     ...conv,
//     participants: (conv.members || [])
//       .map((m) => {
//         const p = m.user;
//         if (!p) return null;
//         return {
//           _id:             p.id,
//           fullName:        p.fullName        ?? null,
//           username:        p.username        ?? null,
//           avatar:          p.avatar?.url
//             ? { url: p.avatar.url, publicId: p.avatar.publicId ?? null }
//             : { url: null, publicId: null },
//           isVerifiedBadge: p.isVerifiedBadge ?? false,
//           accountStatus:   p.accountStatus   ?? "active",
//         };
//       })
//       .filter(Boolean),
//   };
// };

// const aggregateReactions = (reactions = []) => {
//   const map = {};
//   reactions.forEach(({ emoji, userId }) => {
//     if (!map[emoji]) map[emoji] = { emoji, count: 0, users: [] };
//     map[emoji].count += 1;
//     map[emoji].users.push(userId);
//   });
//   return Object.values(map);
// };

// const saveOfflineNotification = async ({ receiver, sender, conversationId }) => {
//   try {
//     await prisma.notification.create({
//       data: {
//         receiverId: receiver,
//         senderId:   sender,
//         type:       "new_message",
//         refId:      conversationId,
//         refModel:   "Conversation",
//       },
//     });
//   } catch (err) {
//     logger.error("❌ Offline notification save error", { message: err.message });
//   }
// };

// export default async (io, socket) => {
//   const userId = (socket.user.id || socket.user._id)?.toString();

//   const messageTimestamps = [];
//   const isRateLimited = () => {
//     const now = Date.now();
//     const windowMs = 10_000;
//     const maxMessages = 10;
//     const recent = messageTimestamps.filter((t) => now - t < windowMs);
//     messageTimestamps.length = 0;
//     recent.forEach((t) => messageTimestamps.push(t));
//     if (recent.length >= maxMessages) return true;
//     messageTimestamps.push(now);
//     return false;
//   };

//   await addSocket(userId, socket.id);
//   socket.broadcast.emit("user:online", { userId });
//   const allOnline = await getAllOnline();
//   socket.emit("online:list", allOnline);

//   const notifyUser = async (recipientId, event, payload) => {
//     const sockets = await getSockets(recipientId.toString());
//     if (sockets?.size) {
//       sockets.forEach((sid) => io.to(sid).emit(event, payload));
//     }
//   };

//   const getPopulatedConversation = async (conversationId) => {
//     const conv = await prisma.conversation.findUnique({
//       where: { id: conversationId },
//       include: {
//         members: {
//           include: {
//             user: {
//               select: {
//                 id: true,
//                 fullName: true,
//                 username: true,
//                 avatar: true,
//                 isVerifiedBadge: true,
//                 accountStatus: true,
//               },
//             },
//           },
//         },
//       },
//     });
//     return normalizeParticipants(conv);
//   };

//   const getParticipantIds = (conv) =>
//     (conv?.participants || []).map((p) =>
//       typeof p === "object" ? p._id.toString() : p.toString()
//     );

//   socket.on("conversation:join", ({ conversationId }) =>
//     conversationId && socket.join(conversationId)
//   );
//   socket.on("conversation:leave", ({ conversationId }) =>
//     conversationId && socket.leave(conversationId)
//   );

//   // ── Message send ──────────────────────────────────────────────────────────
//   socket.on("message:send", async ({ conversationId, message }) => {
//     if (socket.tokenExpired)
//       return socket.emit("error", { message: "Session expired. Please refresh." });
//     if (isRateLimited())
//       return socket.emit("error", { message: "Too many messages. Slow down!" });
//     if (!conversationId || !message) return;
//     if (!message.text?.trim() && !message.image && !message.audio) return;
//     if (message.text && message.text.length > 2000)
//       return socket.emit("error", { message: "Message too long." });

//     try {
//       const conv = await getPopulatedConversation(conversationId);
//       if (!conv) return socket.emit("error", { message: "Conversation not found." });

//       const participants = getParticipantIds(conv);
//       if (!participants.includes(userId))
//         return socket.emit("error", { message: "Unauthorized." });

//       const otherParticipant = participants.find((p) => p !== userId);
//       if (otherParticipant) {
//         const blocked = await isBlocked(userId, otherParticipant);
//         if (blocked)
//           return socket.emit("error", { message: "You cannot message this user.", code: "BLOCKED" });
//       }

//       let replyPreview = null;
//       if (message.replyTo) {
//         const parent = await prisma.message.findUnique({
//           where: { id: message.replyTo },
//           select: { id: true, text: true, isDeleted: true, senderId: true },
//         });
//         if (parent) {
//           replyPreview = {
//             messageId: parent.id,
//             text:      parent.isDeleted ? "" : (parent.text?.slice(0, 100) ?? ""),
//             senderId:  parent.senderId,
//             isDeleted: parent.isDeleted ?? false,
//           };
//         }
//       }

//       let msgType = "text";
//       if (message.audio && !message.text?.trim()) msgType = "audio";
//       else if (message.image && !message.text?.trim()) msgType = "image";

//       const newMsg = await prisma.message.create({
//         data: {
//           conversationId,
//           senderId: userId,
//           text:     message.text?.trim() ? encryptMessage(message.text.trim()) : "",
//           image:    message.image ? { url: message.image?.url || message.image } : null,
//           type:     msgType,
//           replyTo:  replyPreview,
//         },
//       });

//       const senderDoc = await fetchSender(userId);
//       const senderObj = {
//         _id:      userId,
//         fullName: senderDoc?.fullName || null,
//         username: senderDoc?.username || null,
//         avatar:   senderDoc?.avatar   || null,
//       };

//       const msgToEmit = {
//         ...newMsg,
//         text: newMsg.text ? decryptMessage(newMsg.text) : newMsg.text,
//         sender: senderObj,
//       };
//       const isNewConversation = !conv.lastMessage;

//       // Unread count increment
//       const recipientIds = participants.filter((pid) => pid !== userId);
//       if (recipientIds.length) {
//         await prisma.$transaction(
//           recipientIds.map((pid) =>
//             prisma.conversationParticipant.updateMany({
//               where: { conversationId, userId: pid },
//               data:  { unreadCount: { increment: 1 } },
//             })
//           )
//         );
//       }

//       for (const pid of participants) {
//         await notifyUser(pid, "message:receive", {
//           conversationId,
//           message: msgToEmit,
//           tempId: pid === userId ? (message.tempId || null) : null,
//         });
//       }

//       if (isNewConversation) {
//         for (const pid of participants) {
//           await notifyUser(pid, "conversation:new", {
//             conversation: {
//               ...conv,
//               lastMessage: {
//                 messageId: newMsg.id,
//                 text:      newMsg.text?.slice(0, 100) ?? "",
//                 senderId:  userId,
//                 sentAt:    newMsg.createdAt,
//                 isDeleted: false,
//               },
//               unreadCount: pid === userId ? 0 : 1,
//               updatedAt:   new Date().toISOString(),
//             },
//           });
//         }
//       }

//       const members = await prisma.conversationParticipant.findMany({
//         where: { conversationId, userId: { in: participants } },
//       });

//       await syncLastMessage(conversationId, newMsg);

//       const unreadMap = Object.fromEntries(
//         members.map((m) => [m.userId, m.unreadCount ?? 0])
//       );

//       for (const pid of participants) {
//         await notifyUser(pid, "conversation:updated", {
//           conversation: {
//             ...conv,
//             lastMessage: {
//               messageId: newMsg.id,
//               text:      newMsg.text?.slice(0, 100) ?? "",
//               senderId:  userId,
//               sentAt:    newMsg.createdAt,
//               isDeleted: false,
//             },
//             unreadCount: pid === userId ? 0 : (unreadMap[pid] ?? 0),
//             updatedAt:   new Date().toISOString(),
//           },
//         });
//       }

//       const preview = newMsg.type === "audio"
//         ? "🎙️ Voice message"
//         : newMsg.text
//         ? newMsg.text.length > 60 ? newMsg.text.slice(0, 60) + "…" : newMsg.text
//         : "📷 Image";

//       for (const pid of participants) {
//         if (pid === userId) continue;
//         const online = await isOnline(pid);
//         if (online) {
//           await notifyUser(pid, "notification:message", {
//             conversationId, sender: senderObj, preview,
//           });
//         } else {
//           await saveOfflineNotification({ receiver: pid, sender: userId, conversationId });
//         }
//       }
//     } catch (err) {
//       logger.error("❌ message:send error", { message: err.message });
//       socket.emit("error", { message: "Failed to send message." });
//     }
//   });

//   // ── Typing ────────────────────────────────────────────────────────────────
//   socket.on("typing:start", ({ conversationId }) => {
//     if (!conversationId) return;
//     socket.to(conversationId).emit("typing:start", { conversationId, userId });
//   });
//   socket.on("typing:stop", ({ conversationId }) => {
//     if (!conversationId) return;
//     socket.to(conversationId).emit("typing:stop", { conversationId, userId });
//   });

//   // ── Message seen ──────────────────────────────────────────────────────────
//   socket.on("message:seen", async ({ conversationId, messageId }) => {
//     if (!conversationId || !messageId) return;
//     try {
//       await prisma.messageReceipt.upsert({
//         where: { messageId_userId: { messageId, userId } },
//         update: { seenAt: new Date(), readAt: new Date() },
//         create: { messageId, userId, conversationId, seenAt: new Date(), readAt: new Date() },
//       });

//       await prisma.conversationParticipant.updateMany({
//         where: { conversationId, userId },
//         data:  { unreadCount: 0, lastSeenAt: new Date() },
//       });

//       const seenConv = await prisma.conversation.findUnique({
//         where: { id: conversationId },
//         include: { members: { select: { userId: true } } },
//       });
//       const participants = (seenConv?.members || []).map((m) => m.userId);

//       for (const pid of participants) {
//         if (pid !== userId)
//           await notifyUser(pid, "message:seen", { conversationId, messageId, seenBy: userId });
//       }
//     } catch (err) {
//       logger.error("❌ message:seen error", { message: err.message });
//     }
//   });

//   // ── Message edit ──────────────────────────────────────────────────────────
//   const EDIT_WINDOW_MS = 15 * 60 * 1000;

//   socket.on("message:edit", async ({ conversationId, messageId, newText }) => {
//     if (socket.tokenExpired)
//       return socket.emit("error", { message: "Session expired. Please refresh." });
//     if (!conversationId || !messageId || !newText?.trim()) return;
//     if (newText.trim().length > 2000)
//       return socket.emit("error", { message: "Message too long." });
//     try {
//       const msg = await prisma.message.findUnique({ where: { id: messageId } });
//       if (!msg) return socket.emit("error", { message: "Message not found." });
//       if (msg.isDeleted) return socket.emit("error", { message: "Cannot edit deleted message." });
//       if (msg.senderId !== userId) return socket.emit("error", { message: "Unauthorized." });
//       if (Date.now() - new Date(msg.createdAt).getTime() > EDIT_WINDOW_MS)
//         return socket.emit("error", { message: "Edit window of 15 minutes has passed." });

//      const updated = await prisma.message.update({
//         where: { id: messageId },
//         data: { text: encryptMessage(newText.trim()), isEdited: true, editedAt: new Date() },
//       });
//       await syncLastMessage(conversationId, updated);

//       const editConv = await prisma.conversation.findUnique({
//         where: { id: conversationId },
//         include: { members: { select: { userId: true } } },
//       });
//       const participants = (editConv?.members || []).map((m) => m.userId);

//       for (const pid of participants) {
//         await notifyUser(pid, "message:edited", {
//           conversationId, messageId,
//           newText: decryptMessage(updated.text), isEdited: true, editedAt: updated.editedAt,
//         });
//       }
//     } catch (err) {
//       logger.error("❌ message:edit error", { message: err.message });
//       socket.emit("error", { message: "Failed to edit message." });
//     }
//   });

//   // ── Message delete ────────────────────────────────────────────────────────
//   socket.on("message:delete", async ({ conversationId, messageId }) => {
//     if (socket.tokenExpired)
//       return socket.emit("error", { message: "Session expired. Please refresh." });
//     if (!conversationId || !messageId) return;
//     try {
//       const msg = await prisma.message.findUnique({ where: { id: messageId } });
//       if (!msg) return socket.emit("error", { message: "Message not found." });
//       if (msg.isDeleted) return socket.emit("error", { message: "Already deleted." });
//       if (msg.senderId !== userId) return socket.emit("error", { message: "Unauthorized." });

//       const deleted = await prisma.message.update({
//         where: { id: messageId },
//         data: { isDeleted: true, deletedAt: new Date(), text: "", image: null, reactions: [] },
//       });
//       await syncLastMessage(conversationId, deleted);

//       const delConv = await prisma.conversation.findUnique({
//         where: { id: conversationId },
//         include: { members: { select: { userId: true } } },
//       });
//       const participants = (delConv?.members || []).map((m) => m.userId);

//       for (const pid of participants) {
//         await notifyUser(pid, "message:deleted", { conversationId, messageId, deletedBy: userId });
//       }
//     } catch (err) {
//       logger.error("❌ message:delete error", { message: err.message });
//       socket.emit("error", { message: "Failed to delete message." });
//     }
//   });

//   // ── Emoji reaction ────────────────────────────────────────────────────────
//   socket.on("message:react", async ({ conversationId, messageId, emoji }) => {
//     if (!conversationId || !messageId) return;
//     try {
//       const msg = await prisma.message.findUnique({ where: { id: messageId } });
//       if (!msg || msg.isDeleted)
//         return socket.emit("error", { message: "Message not found." });

//       let reactions = Array.isArray(msg.reactions) ? [...msg.reactions] : [];
//       const existingIdx = reactions.findIndex(
//         (r) => r.userId === userId && r.emoji === emoji
//       );
//       if (existingIdx !== -1) {
//         reactions.splice(existingIdx, 1);
//       } else {
//         reactions = reactions.filter((r) => r.userId !== userId);
//         if (emoji?.trim())
//           reactions.push({ userId, emoji: emoji.trim(), reactedAt: new Date() });
//       }

//       const updated = await prisma.message.update({
//         where: { id: messageId },
//         data: { reactions },
//       });

//       const aggregated = aggregateReactions(updated.reactions);
//       const reactConv = await prisma.conversation.findUnique({
//         where: { id: conversationId },
//         include: { members: { select: { userId: true } } },
//       });
//       const participants = (reactConv?.members || []).map((m) => m.userId);

//       for (const pid of participants) {
//         await notifyUser(pid, "message:reaction", {
//           conversationId, messageId,
//           reactions: aggregated, rawReactions: updated.reactions,
//         });
//       }
//     } catch (err) {
//       logger.error("❌ message:react error", { message: err.message });
//       socket.emit("error", { message: "Failed to add reaction." });
//     }
//   });

//   // ── Block status ──────────────────────────────────────────────────────────
//   socket.on("user:blockStatus", async ({ targetUserId }) => {
//     if (!targetUserId) return;
//     try {
//       const blocked = await isBlocked(userId, targetUserId);
//       const iBlockedThem = await prisma.block.findFirst({
//         where: { blockerId: userId, blockedId: targetUserId },
//         select: { id: true },
//       });
//       socket.emit("user:blockStatus", {
//         targetUserId, blocked, iBlockedThem: !!iBlockedThem,
//       });
//     } catch (err) {
//       logger.error("❌ user:blockStatus error", { message: err.message });
//     }
//   });

//   // ── Online check ──────────────────────────────────────────────────────────
//   socket.on("user:isOnline", async ({ targetUserId }) => {
//     const online = await isOnline(targetUserId);
//     socket.emit("user:isOnline", { userId: targetUserId, isOnline: online });
//   });

//   // ── Disconnect ────────────────────────────────────────────────────────────
//   socket.on("disconnect", async () => {
//     const wasLastSocket = await removeSocket(userId, socket.id);
//     if (wasLastSocket) {
//       io.emit("user:offline", { userId });
//       logger.info(`❌ User fully offline: ${userId}`);
//     }
//   });
// };




import prisma from "../../config/prisma.js";
import { fetchSender, isBlocked } from "../../services/userService.js";
import {
  addSocket, removeSocket,
  getSockets, isOnline, getAllOnline,
} from "../../services/onlineStore.js";
import logger from "../../utils/logger.js";
import { encryptMessage, decryptMessage } from "../../utils/encryption.js";

const syncLastMessage = async (conversationId, msg) => {
  try {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: {
          messageId: msg.id,
          text:      msg.isDeleted ? "" : (msg.text?.slice(0, 100) ?? ""),
          senderId:  msg.senderId,
          sentAt:    msg.createdAt ?? new Date(),
          isDeleted: msg.isDeleted ?? false,
        },
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    logger.error("❌ syncLastMessage error", { message: err.message });
  }
};

const normalizeParticipants = (conv) => {
  if (!conv) return null;
  return {
    ...conv,
    participants: (conv.members || [])
      .map((m) => {
        const p = m.user;
        if (!p) return null;
        return {
          _id:             p.id,
          fullName:        p.fullName        ?? null,
          username:        p.username        ?? null,
          avatar:          p.avatar?.url
            ? { url: p.avatar.url, publicId: p.avatar.publicId ?? null }
            : { url: null, publicId: null },
          isVerifiedBadge: p.isVerifiedBadge ?? false,
          accountStatus:   p.accountStatus   ?? "active",
        };
      })
      .filter(Boolean),
  };
};

const aggregateReactions = (reactions = []) => {
  const map = {};
  reactions.forEach(({ emoji, userId }) => {
    if (!map[emoji]) map[emoji] = { emoji, count: 0, users: [] };
    map[emoji].count += 1;
    map[emoji].users.push(userId);
  });
  return Object.values(map);
};

const saveOfflineNotification = async ({ receiver, sender, conversationId }) => {
  try {
    await prisma.notification.create({
      data: {
        receiverId: receiver,
        senderId:   sender,
        type:       "new_message",
        refId:      conversationId,
        refModel:   "Conversation",
      },
    });
  } catch (err) {
    logger.error("❌ Offline notification save error", { message: err.message });
  }
};

export default async (io, socket) => {
  const userId = (socket.user.id || socket.user._id)?.toString();

  const messageTimestamps = [];
  const isRateLimited = () => {
    const now = Date.now();
    const windowMs = 10_000;
    const maxMessages = 10;
    const recent = messageTimestamps.filter((t) => now - t < windowMs);
    messageTimestamps.length = 0;
    recent.forEach((t) => messageTimestamps.push(t));
    if (recent.length >= maxMessages) return true;
    messageTimestamps.push(now);
    return false;
  };

  await addSocket(userId, socket.id);
  socket.broadcast.emit("user:online", { userId });
  const allOnline = await getAllOnline();
  socket.emit("online:list", allOnline);

  const notifyUser = async (recipientId, event, payload) => {
    const sockets = await getSockets(recipientId.toString());
    if (sockets?.size) {
      sockets.forEach((sid) => io.to(sid).emit(event, payload));
    }
  };

  const getPopulatedConversation = async (conversationId) => {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                username: true,
                avatar: true,
                isVerifiedBadge: true,
                accountStatus: true,
              },
            },
          },
        },
      },
    });
    return normalizeParticipants(conv);
  };

  const getParticipantIds = (conv) =>
    (conv?.participants || []).map((p) =>
      typeof p === "object" ? p._id.toString() : p.toString()
    );

  socket.on("conversation:join", ({ conversationId }) =>
    conversationId && socket.join(conversationId)
  );
  socket.on("conversation:leave", ({ conversationId }) =>
    conversationId && socket.leave(conversationId)
  );

  // ── Message send ──────────────────────────────────────────────────────────
  socket.on("message:send", async ({ conversationId, message }) => {
    if (socket.tokenExpired)
      return socket.emit("error", { message: "Session expired. Please refresh." });
    if (isRateLimited())
      return socket.emit("error", { message: "Too many messages. Slow down!" });
    if (!conversationId || !message) return;
    if (!message.text?.trim() && !message.image && !message.audio) return;
    if (message.text && message.text.length > 2000)
      return socket.emit("error", { message: "Message too long." });

    try {
      const conv = await getPopulatedConversation(conversationId);
      if (!conv) return socket.emit("error", { message: "Conversation not found." });

      const participants = getParticipantIds(conv);
      if (!participants.includes(userId))
        return socket.emit("error", { message: "Unauthorized." });

      const otherParticipant = participants.find((p) => p !== userId);
      if (otherParticipant) {
        const blocked = await isBlocked(userId, otherParticipant);
        if (blocked)
          return socket.emit("error", { message: "You cannot message this user.", code: "BLOCKED" });
      }

      let replyPreview = null;
      if (message.replyTo) {
        const parent = await prisma.message.findUnique({
          where: { id: message.replyTo },
          select: { id: true, text: true, isDeleted: true, senderId: true },
        });
        if (parent) {
          replyPreview = {
            messageId: parent.id,
            text:      parent.isDeleted ? "" : (parent.text ? decryptMessage(parent.text).slice(0, 100) : ""),
            senderId:  parent.senderId,
            isDeleted: parent.isDeleted ?? false,
          };
        }
      }

      let msgType = "text";
      if (message.audio && !message.text?.trim()) msgType = "audio";
      else if (message.image && !message.text?.trim()) msgType = "image";

      const newMsg = await prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          text:     message.text?.trim() ? encryptMessage(message.text.trim()) : "",
          image:    message.image ? { url: message.image?.url || message.image } : null,
          type:     msgType,
          replyTo:  replyPreview,
        },
      });

      // Plain decrypted text — used everywhere we show/preview/store last message
      const decryptedText = newMsg.text ? decryptMessage(newMsg.text) : "";

      const senderDoc = await fetchSender(userId);
      const senderObj = {
        _id:      userId,
        fullName: senderDoc?.fullName || null,
        username: senderDoc?.username || null,
        avatar:   senderDoc?.avatar   || null,
      };

      const msgToEmit = {
        ...newMsg,
        text: decryptedText,
        sender: senderObj,
      };
      const isNewConversation = !conv.lastMessage;

      // Unread count increment
      const recipientIds = participants.filter((pid) => pid !== userId);
      if (recipientIds.length) {
        await prisma.$transaction(
          recipientIds.map((pid) =>
            prisma.conversationParticipant.updateMany({
              where: { conversationId, userId: pid },
              data:  { unreadCount: { increment: 1 } },
            })
          )
        );
      }

      for (const pid of participants) {
        await notifyUser(pid, "message:receive", {
          conversationId,
          message: msgToEmit,
          tempId: pid === userId ? (message.tempId || null) : null,
        });
      }

      if (isNewConversation) {
        for (const pid of participants) {
          await notifyUser(pid, "conversation:new", {
            conversation: {
              ...conv,
              lastMessage: {
                messageId: newMsg.id,
                text:      decryptedText.slice(0, 100),
                senderId:  userId,
                sentAt:    newMsg.createdAt,
                isDeleted: false,
              },
              unreadCount: pid === userId ? 0 : 1,
              updatedAt:   new Date().toISOString(),
            },
          });
        }
      }

      const members = await prisma.conversationParticipant.findMany({
        where: { conversationId, userId: { in: participants } },
      });

      // Save lastMessage in DB with the DECRYPTED text (so REST API fetches show plain text too)
      await syncLastMessage(conversationId, { ...newMsg, text: decryptedText });

      const unreadMap = Object.fromEntries(
        members.map((m) => [m.userId, m.unreadCount ?? 0])
      );

      for (const pid of participants) {
        await notifyUser(pid, "conversation:updated", {
          conversation: {
            ...conv,
            lastMessage: {
              messageId: newMsg.id,
              text:      decryptedText.slice(0, 100),
              senderId:  userId,
              sentAt:    newMsg.createdAt,
              isDeleted: false,
            },
            unreadCount: pid === userId ? 0 : (unreadMap[pid] ?? 0),
            updatedAt:   new Date().toISOString(),
          },
        });
      }

      const preview = newMsg.type === "audio"
        ? "🎙️ Voice message"
        : decryptedText
        ? decryptedText.length > 60 ? decryptedText.slice(0, 60) + "…" : decryptedText
        : "📷 Image";

      for (const pid of participants) {
        if (pid === userId) continue;
        const online = await isOnline(pid);
        if (online) {
          await notifyUser(pid, "notification:message", {
            conversationId, sender: senderObj, preview,
          });
        } else {
          await saveOfflineNotification({ receiver: pid, sender: userId, conversationId });
        }
      }
    } catch (err) {
      logger.error("❌ message:send error", { message: err.message });
      socket.emit("error", { message: "Failed to send message." });
    }
  });

  // ── Typing ────────────────────────────────────────────────────────────────
  socket.on("typing:start", ({ conversationId }) => {
    if (!conversationId) return;
    socket.to(conversationId).emit("typing:start", { conversationId, userId });
  });
  socket.on("typing:stop", ({ conversationId }) => {
    if (!conversationId) return;
    socket.to(conversationId).emit("typing:stop", { conversationId, userId });
  });

  // ── Message seen ──────────────────────────────────────────────────────────
  socket.on("message:seen", async ({ conversationId, messageId }) => {
    if (!conversationId || !messageId) return;
    try {
      await prisma.messageReceipt.upsert({
        where: { messageId_userId: { messageId, userId } },
        update: { seenAt: new Date(), readAt: new Date() },
        create: { messageId, userId, conversationId, seenAt: new Date(), readAt: new Date() },
      });

      await prisma.conversationParticipant.updateMany({
        where: { conversationId, userId },
        data:  { unreadCount: 0, lastSeenAt: new Date() },
      });

      const seenConv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { members: { select: { userId: true } } },
      });
      const participants = (seenConv?.members || []).map((m) => m.userId);

      for (const pid of participants) {
        if (pid !== userId)
          await notifyUser(pid, "message:seen", { conversationId, messageId, seenBy: userId });
      }
    } catch (err) {
      logger.error("❌ message:seen error", { message: err.message });
    }
  });

  // ── Message edit ──────────────────────────────────────────────────────────
  const EDIT_WINDOW_MS = 15 * 60 * 1000;

  socket.on("message:edit", async ({ conversationId, messageId, newText }) => {
    if (socket.tokenExpired)
      return socket.emit("error", { message: "Session expired. Please refresh." });
    if (!conversationId || !messageId || !newText?.trim()) return;
    if (newText.trim().length > 2000)
      return socket.emit("error", { message: "Message too long." });
    try {
      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (!msg) return socket.emit("error", { message: "Message not found." });
      if (msg.isDeleted) return socket.emit("error", { message: "Cannot edit deleted message." });
      if (msg.senderId !== userId) return socket.emit("error", { message: "Unauthorized." });
      if (Date.now() - new Date(msg.createdAt).getTime() > EDIT_WINDOW_MS)
        return socket.emit("error", { message: "Edit window of 15 minutes has passed." });

      const updated = await prisma.message.update({
        where: { id: messageId },
        data: { text: encryptMessage(newText.trim()), isEdited: true, editedAt: new Date() },
      });

      const decryptedEditedText = decryptMessage(updated.text);

      // Keep lastMessage in DB as plain text too
      await syncLastMessage(conversationId, { ...updated, text: decryptedEditedText });

      const editConv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { members: { select: { userId: true } } },
      });
      const participants = (editConv?.members || []).map((m) => m.userId);

      for (const pid of participants) {
        await notifyUser(pid, "message:edited", {
          conversationId, messageId,
          newText: decryptedEditedText, isEdited: true, editedAt: updated.editedAt,
        });
      }
    } catch (err) {
      logger.error("❌ message:edit error", { message: err.message });
      socket.emit("error", { message: "Failed to edit message." });
    }
  });

  // ── Message delete ────────────────────────────────────────────────────────
  socket.on("message:delete", async ({ conversationId, messageId }) => {
    if (socket.tokenExpired)
      return socket.emit("error", { message: "Session expired. Please refresh." });
    if (!conversationId || !messageId) return;
    try {
      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (!msg) return socket.emit("error", { message: "Message not found." });
      if (msg.isDeleted) return socket.emit("error", { message: "Already deleted." });
      if (msg.senderId !== userId) return socket.emit("error", { message: "Unauthorized." });

      const deleted = await prisma.message.update({
        where: { id: messageId },
        data: { isDeleted: true, deletedAt: new Date(), text: "", image: null, reactions: [] },
      });
      await syncLastMessage(conversationId, deleted);

      const delConv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { members: { select: { userId: true } } },
      });
      const participants = (delConv?.members || []).map((m) => m.userId);

      for (const pid of participants) {
        await notifyUser(pid, "message:deleted", { conversationId, messageId, deletedBy: userId });
      }
    } catch (err) {
      logger.error("❌ message:delete error", { message: err.message });
      socket.emit("error", { message: "Failed to delete message." });
    }
  });

  // ── Emoji reaction ────────────────────────────────────────────────────────
  socket.on("message:react", async ({ conversationId, messageId, emoji }) => {
    if (!conversationId || !messageId) return;
    try {
      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (!msg || msg.isDeleted)
        return socket.emit("error", { message: "Message not found." });

      let reactions = Array.isArray(msg.reactions) ? [...msg.reactions] : [];
      const existingIdx = reactions.findIndex(
        (r) => r.userId === userId && r.emoji === emoji
      );
      if (existingIdx !== -1) {
        reactions.splice(existingIdx, 1);
      } else {
        reactions = reactions.filter((r) => r.userId !== userId);
        if (emoji?.trim())
          reactions.push({ userId, emoji: emoji.trim(), reactedAt: new Date() });
      }

      const updated = await prisma.message.update({
        where: { id: messageId },
        data: { reactions },
      });

      const aggregated = aggregateReactions(updated.reactions);
      const reactConv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { members: { select: { userId: true } } },
      });
      const participants = (reactConv?.members || []).map((m) => m.userId);

      for (const pid of participants) {
        await notifyUser(pid, "message:reaction", {
          conversationId, messageId,
          reactions: aggregated, rawReactions: updated.reactions,
        });
      }
    } catch (err) {
      logger.error("❌ message:react error", { message: err.message });
      socket.emit("error", { message: "Failed to add reaction." });
    }
  });

  // ── Block status ──────────────────────────────────────────────────────────
  socket.on("user:blockStatus", async ({ targetUserId }) => {
    if (!targetUserId) return;
    try {
      const blocked = await isBlocked(userId, targetUserId);
      const iBlockedThem = await prisma.block.findFirst({
        where: { blockerId: userId, blockedId: targetUserId },
        select: { id: true },
      });
      socket.emit("user:blockStatus", {
        targetUserId, blocked, iBlockedThem: !!iBlockedThem,
      });
    } catch (err) {
      logger.error("❌ user:blockStatus error", { message: err.message });
    }
  });

  // ── Online check ──────────────────────────────────────────────────────────
  socket.on("user:isOnline", async ({ targetUserId }) => {
    const online = await isOnline(targetUserId);
    socket.emit("user:isOnline", { userId: targetUserId, isOnline: online });
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", async () => {
    const wasLastSocket = await removeSocket(userId, socket.id);
    if (wasLastSocket) {
      io.emit("user:offline", { userId });
      logger.info(`❌ User fully offline: ${userId}`);
    }
  });
};