

// src/socket/handlers/Chathandler.js
import Message from "../../../models/Message.js";

import Notification from "../../../models/Notification.js";
import { fetchSender, isBlocked } from "../../services/userService.js";
// ✅ Yeh rakho — ab ConversationMember export hoga
import Conversation, { ConversationMember } from "../../../models/Conversation.js";
import {
  addSocket, removeSocket,
  getSockets, isOnline, getAllOnline,
} from "../../services/onlineStore.js";
import logger from "../../utils/logger.js";

// ── Helpers ───────────────────────────────────────────────────────────────────




// ✅ NAYA
const syncLastMessage = async (conversationId, msg) => {
  try {
    await Conversation.findByIdAndUpdate(conversationId, {
      $set: {
        lastMessage: {
          messageId: msg._id,
          text:      msg.isDeleted ? "" : (msg.text?.slice(0, 100) ?? ""),
          senderId:  msg.sender,
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

// const normalizeParticipants = (conv) => ({
//   ...conv,
//   participants: (conv.participants || []).map((p) => ({
//     ...p,
//     avatar: p.avatar?.url ? p.avatar : { url: null, publicId: null },
//   })),
// });



const PARTICIPANT_SELECT = "_id fullName username avatar isVerifiedBadge accountStatus";

const normalizeParticipants = (conv) => {
  if (!conv) return null;
  return {
    ...conv,
    participants: (conv.participants || [])
      .map((p) => {
        if (!p || typeof p !== "object" || !p._id) return null;
        return {
          _id:             p._id.toString(),
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
  reactions.forEach(({ emoji, user }) => {
    if (!map[emoji]) map[emoji] = { emoji, count: 0, users: [] };
    map[emoji].count += 1;
    map[emoji].users.push(user.toString());
  });
  return Object.values(map);
};

const saveOfflineNotification = async ({ receiver, sender, conversationId }) => {
  try {
    await Notification.createNotification({
      receiver,
      sender,
      type: "new_message",
      refId: conversationId,
      refModel: "Conversation",
    });
  } catch (err) {
    logger.error("❌ Offline notification save error", { message: err.message });
  }
};

// ── Main handler ──────────────────────────────────────────────────────────────

export default async (io, socket) => {
  const userId = (socket.user.id || socket.user._id)?.toString();

  // ── Rate limiter ───────────────────────────────────────────────────────────
  const messageTimestamps = [];
  const isRateLimited = () => {
    const now         = Date.now();
    const windowMs    = 10_000;
    const maxMessages = 10;
    const recent      = messageTimestamps.filter((t) => now - t < windowMs);
    messageTimestamps.length = 0;
    recent.forEach((t) => messageTimestamps.push(t));
    if (recent.length >= maxMessages) return true;
    messageTimestamps.push(now);
    return false;
  };

  // ── Online tracking ────────────────────────────────────────────────────────
  await addSocket(userId, socket.id);
  socket.broadcast.emit("user:online", { userId });
  const allOnline = await getAllOnline();
  socket.emit("online:list", allOnline);

  // ── notifyUser — Redis se getSockets ──────────────────────────────────────
  const notifyUser = async (recipientId, event, payload) => {
    const sockets = await getSockets(recipientId.toString());
    if (sockets?.size) {
      sockets.forEach((sid) => io.to(sid).emit(event, payload));
    }
  };

  // const getParticipants = async (conversationId) => {
  //   const conv = await Conversation.findById(conversationId).lean();
  //   return conv?.participants?.map((p) => p.toString()) || [];
  // };

  const getPopulatedConversation = async (conversationId) => {
  const conv = await Conversation.findById(conversationId)
    .populate("participants", PARTICIPANT_SELECT)
    .lean();
  return normalizeParticipants(conv);
};

const getParticipantIds = (conv) =>
  (conv?.participants || []).map((p) =>
    typeof p === "object" ? p._id.toString() : p.toString()
  );

  // ── Conversation join / leave ──────────────────────────────────────────────
  socket.on("conversation:join", ({ conversationId }) =>
    conversationId && socket.join(conversationId)
  );
  socket.on("conversation:leave", ({ conversationId }) =>
    conversationId && socket.leave(conversationId)
  );

  // ── Message send ───────────────────────────────────────────────────────────
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
      // const conv = await Conversation.findById(conversationId).lean();
      // if (!conv) return socket.emit("error", { message: "Conversation not found." });

      // const participants = conv.participants.map((p) => p.toString());

      const conv = await getPopulatedConversation(conversationId);
if (!conv) return socket.emit("error", { message: "Conversation not found." });

const participants = getParticipantIds(conv);
      if (!participants.includes(userId))
        return socket.emit("error", { message: "Unauthorized." });

      const otherParticipant = participants.find((p) => p !== userId);
      if (otherParticipant) {
        const blocked = await isBlocked(userId, otherParticipant);
        if (blocked)
          return socket.emit("error", {
            message: "You cannot message this user.",
            code: "BLOCKED",
          });
      }

      // Reply preview
      let replyPreview = null;
      if (message.replyTo) {
        const parent = await Message.findById(message.replyTo)
          .select("text image audio isDeleted sender")
          .lean();
        if (parent) {
          replyPreview = {
            messageId: parent._id,
            text:      parent.isDeleted ? "" : (parent.text?.slice(0, 100) ?? ""),
            senderId:  parent.sender,
            isDeleted: parent.isDeleted ?? false,
          };
        }
      }

      // Message type
      let msgType = "text";
      if (message.audio && !message.text?.trim()) msgType = "audio";
      else if (message.image && !message.text?.trim()) msgType = "image";

      const newMsg = await Message.create({
        conversation: conversationId,
        sender:       userId,
        text:         message.text?.trim() || "",
        image:        message.image || null,
        audio:        message.audio || null,
        replyTo:      replyPreview,
        type:         msgType,
        seenBy:       [userId],
      });

      const senderDoc = await fetchSender(userId);
      const senderObj = {
        _id:      userId,
        fullName: senderDoc?.fullName || null,
        username: senderDoc?.username || null,
        avatar:   senderDoc?.avatar   || null,
      };

      const msgToEmit = { ...newMsg.toObject(), sender: senderObj };

      await syncLastMessage(conversationId, newMsg);

      const isNewConversation = !conv.lastMessage;

      // Unread count increment
      // ✅ NAYA — ConversationMember mein increment karo
const recipientIds = participants.filter((pid) => pid !== userId);
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

      // message:receive — sab participants ko
      // for (const pid of participants) {
      //   if (pid !== userId) {
      //     const blocked = await isBlocked(userId, pid);
      //     if (blocked) continue;
      //   }
      //   await notifyUser(pid, "message:receive", {
      //     conversationId,
      //     message: msgToEmit,
      //     tempId:  message.tempId || null,
      //   });
      // }


      for (const pid of participants) {
  if (pid !== userId) {
    const blocked = await isBlocked(userId, pid);
    if (blocked) continue;
  }
  await notifyUser(pid, "message:receive", {
    conversationId,
    message: msgToEmit,
    tempId: pid === userId ? (message.tempId || null) : null,
  });
}
      // conversation:new — stranger ka pehla message
//      if (isNewConversation) {
//   const populatedConv = await Conversation.findById(conversationId)
//     .populate("participants", "_id fullName username avatar isVerifiedBadge accountStatus")
//     .lean();

//   const safeNewConv = normalizeParticipants(populatedConv);

//   for (const pid of participants) {
//     await notifyUser(pid, "conversation:new", {
//       conversation: {
//         ...safeNewConv,
//         lastMessage: {
//           messageId: newMsg._id,
//           text:      newMsg.text?.slice(0, 100) ?? "",
//           senderId:  userId,
//           sentAt:    newMsg.createdAt,
//           isDeleted: false,
//         },
//         unreadCount: pid === userId ? 0 : 1,
//         updatedAt:   new Date().toISOString(),
//       },
//     });
//   }
// }


if (isNewConversation) {
  for (const pid of participants) {
    await notifyUser(pid, "conversation:new", {
      conversation: {
        ...conv,
        lastMessage: {
          messageId: newMsg._id,
          text:      newMsg.text?.slice(0, 100) ?? "",
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
// ✅ Har message pe sidebar update — stranger ho ya follow kiya ho
// const updatedConv = await Conversation.findById(conversationId)
//   .populate("participants", "_id fullName username avatar isVerifiedBadge accountStatus")
//   .lean();

// // ✅ avatar nested object fix — frontend ko sahi structure chahiye


// const safeConv = normalizeParticipants(updatedConv);

// for (const pid of participants) {
//   const member = await ConversationMember.findOne({
//     conversationId, userId: pid,
//   }).lean();

//   await notifyUser(pid, "conversation:updated", {
//   conversation: {
//     ...safeConv,
//       lastMessage: {
//         messageId: newMsg._id,
//         text:      newMsg.text?.slice(0, 100) ?? "",
//         senderId:  userId,
//         sentAt:    newMsg.createdAt,
//         isDeleted: false,
//       },
//       unreadCount: pid === userId ? 0 : (member?.unreadCount ?? 0),
//       updatedAt:   new Date().toISOString(),
//     },
//   });
// }
      // notification:message — online users ko toast


      const members = await ConversationMember.find({
  conversationId,
  userId: { $in: participants },
}).lean();

const unreadMap = Object.fromEntries(
  members.map((m) => [m.userId.toString(), m.unreadCount ?? 0])
);

for (const pid of participants) {
  await notifyUser(pid, "conversation:updated", {
    conversation: {
      ...conv,
      lastMessage: {
        messageId: newMsg._id,
        text:      newMsg.text?.slice(0, 100) ?? "",
        senderId:  userId,
        sentAt:    newMsg.createdAt,
        isDeleted: false,
      },
      unreadCount: pid === userId ? 0 : (unreadMap[pid] ?? 0),
      updatedAt:   new Date().toISOString(),
    },
  });
}
      const preview = newMsg.audio
        ? "🎙️ Voice message"
        : newMsg.text
        ? newMsg.text.length > 60 ? newMsg.text.slice(0, 60) + "…" : newMsg.text
        : "📷 Image";

      for (const pid of participants) {
        if (pid === userId) continue;
        const online = await isOnline(pid);
        if (online) {
          await notifyUser(pid, "notification:message", {
            conversationId,
            sender: senderObj,
            preview,
          });
        } else {
          await saveOfflineNotification({
            receiver: pid, sender: userId, conversationId,
          });
        }
      }
    } catch (err) {
      logger.error("❌ message:send error", { message: err.message });
      socket.emit("error", { message: "Failed to send message." });
    }
  });

  // ── Typing ─────────────────────────────────────────────────────────────────
  socket.on("typing:start", ({ conversationId }) => {
    if (!conversationId) return;
    socket.to(conversationId).emit("typing:start", { conversationId, userId });
  });

  socket.on("typing:stop", ({ conversationId }) => {
    if (!conversationId) return;
    socket.to(conversationId).emit("typing:stop", { conversationId, userId });
  });

  // ── Message seen ───────────────────────────────────────────────────────────
  socket.on("message:seen", async ({ conversationId, messageId }) => {
    if (!conversationId || !messageId) return;
    try {
      await Message.findByIdAndUpdate(messageId, { $addToSet: { seenBy: userId } });
     // ✅ NAYA
await ConversationMember.findOneAndUpdate(
  { conversationId, userId },
  { $set: { unreadCount: 0, lastSeenAt: new Date() } },
);
      // const participants = await getParticipants(conversationId);

      const seenConv = await Conversation.findById(conversationId)
  .select("participants")
  .lean();
const participants = (seenConv?.participants || []).map((p) => p.toString());
      for (const pid of participants) {
        if (pid !== userId)
          await notifyUser(pid, "message:seen", { conversationId, messageId, seenBy: userId });
      }
    } catch (err) {
      logger.error("❌ message:seen error", { message: err.message });
    }
  });

  // ── Message edit ───────────────────────────────────────────────────────────
  const EDIT_WINDOW_MS = 15 * 60 * 1000;

  socket.on("message:edit", async ({ conversationId, messageId, newText }) => {
    if (socket.tokenExpired)
      return socket.emit("error", { message: "Session expired. Please refresh." });
    if (!conversationId || !messageId || !newText?.trim()) return;
    if (newText.trim().length > 2000)
      return socket.emit("error", { message: "Message too long." });
    try {
      const msg = await Message.findById(messageId);
      if (!msg) return socket.emit("error", { message: "Message not found." });
      if (msg.isDeleted) return socket.emit("error", { message: "Cannot edit deleted message." });
      if (msg.sender.toString() !== userId) return socket.emit("error", { message: "Unauthorized." });
      if (Date.now() - new Date(msg.createdAt).getTime() > EDIT_WINDOW_MS)
        return socket.emit("error", { message: "Edit window of 15 minutes has passed." });

      msg.text     = newText.trim();
      msg.isEdited = true;
      msg.editedAt = new Date();
      await msg.save();
      await syncLastMessage(conversationId, msg);

      // const participants = await getParticipants(conversationId);

      const editConv = await Conversation.findById(conversationId)
  .select("participants")
  .lean();
const participants = (editConv?.participants || []).map((p) => p.toString());
      for (const pid of participants) {
        await notifyUser(pid, "message:edited", {
          conversationId, messageId,
          newText: msg.text, isEdited: true, editedAt: msg.editedAt,
        });
      }
    } catch (err) {
      logger.error("❌ message:edit error", { message: err.message });
      socket.emit("error", { message: "Failed to edit message." });
    }
  });

  // ── Message delete ─────────────────────────────────────────────────────────
  socket.on("message:delete", async ({ conversationId, messageId }) => {
    if (socket.tokenExpired)
      return socket.emit("error", { message: "Session expired. Please refresh." });
    if (!conversationId || !messageId) return;
    try {
      const msg = await Message.findById(messageId);
      if (!msg) return socket.emit("error", { message: "Message not found." });
      if (msg.isDeleted) return socket.emit("error", { message: "Already deleted." });
      if (msg.sender.toString() !== userId) return socket.emit("error", { message: "Unauthorized." });

      msg.isDeleted = true;
      msg.deletedAt = new Date();
      msg.text = ""; msg.image = null; msg.audio = null; msg.reactions = [];
      await msg.save();
      await syncLastMessage(conversationId, msg);

      // const participants = await getParticipants(conversationId);
      const reactConv = await Conversation.findById(conversationId)
  .select("participants")
  .lean();
const participants = (reactConv?.participants || []).map((p) => p.toString());
      for (const pid of participants) {
        await notifyUser(pid, "message:deleted", { conversationId, messageId, deletedBy: userId });
      }
    } catch (err) {
      logger.error("❌ message:delete error", { message: err.message });
      socket.emit("error", { message: "Failed to delete message." });
    }
  });

  // ── Emoji reaction ─────────────────────────────────────────────────────────
  socket.on("message:react", async ({ conversationId, messageId, emoji }) => {
    if (!conversationId || !messageId) return;
    try {
      const msg = await Message.findById(messageId);
      if (!msg || msg.isDeleted)
        return socket.emit("error", { message: "Message not found." });

      const existingIdx = msg.reactions.findIndex(
        (r) => r.user.toString() === userId && r.emoji === emoji
      );
      if (existingIdx !== -1) {
        msg.reactions.splice(existingIdx, 1);
      } else {
        msg.reactions = msg.reactions.filter((r) => r.user.toString() !== userId);
        if (emoji?.trim())
          msg.reactions.push({ user: userId, emoji: emoji.trim(), reactedAt: new Date() });
      }
      await msg.save();

      // const aggregated   = aggregateReactions(msg.reactions);
      // const participants = await getParticipants(conversationId);


      const aggregated = aggregateReactions(msg.reactions);
const reactConv  = await Conversation.findById(conversationId)
  .select("participants")
  .lean();
const participants = (reactConv?.participants || []).map((p) => p.toString());
      for (const pid of participants) {
        await notifyUser(pid, "message:reaction", {
          conversationId, messageId,
          reactions: aggregated, rawReactions: msg.reactions,
        });
      }
    } catch (err) {
      logger.error("❌ message:react error", { message: err.message });
      socket.emit("error", { message: "Failed to add reaction." });
    }
  });

  // ── Block status ───────────────────────────────────────────────────────────
  socket.on("user:blockStatus", async ({ targetUserId }) => {
    if (!targetUserId) return;
    try {
      const blocked = await isBlocked(userId, targetUserId);
      const me = await import("../../../models/User.js").then((m) =>
        m.default.findById(userId).select("blockedUsers").lean()
      );
      const iBlockedThem = me?.blockedUsers?.map(String).includes(String(targetUserId));
      socket.emit("user:blockStatus", { targetUserId, blocked, iBlockedThem });
    } catch (err) {
      logger.error("❌ user:blockStatus error", { message: err.message });
    }
  });

  // ── Report user ────────────────────────────────────────────────────────────
  socket.on("user:report", async ({ targetUserId, reason }) => {
    if (!targetUserId || targetUserId === userId) return;
    try {
      await Notification.createNotification({
        receiver: targetUserId, sender: userId,
        type: "user_report", refId: targetUserId, refModel: "User",
        meta: { reason: reason || "No reason provided" },
      });
      socket.emit("user:report:success", { targetUserId });
    } catch (err) {
      logger.error("❌ user:report error", { message: err.message });
      socket.emit("error", { message: "Failed to report user." });
    }
  });

  // ── Online check ───────────────────────────────────────────────────────────
  socket.on("user:isOnline", async ({ targetUserId }) => {
    const online = await isOnline(targetUserId);
    socket.emit("user:isOnline", { userId: targetUserId, isOnline: online });
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────
  socket.on("disconnect", async () => {
    const wasLastSocket = await removeSocket(userId, socket.id);
    if (wasLastSocket) {
      io.emit("user:offline", { userId });
      logger.info(`❌ User fully offline: ${userId}`);
    }
  });
};

