

// const onlineUsers = new Map();
// const Message = require("../models/Message");
// const Conversation = require("../models/Conversation");
// const User = require("../models/User");
// module.exports = (io, socket) => {
//   const userId = socket.user.id;

//   if (!onlineUsers.has(userId)) {
//     onlineUsers.set(userId, new Set());
//   }
//   onlineUsers.get(userId).add(socket.id);

//   socket.broadcast.emit("user:online", { userId });
//   socket.emit("online:list", Array.from(onlineUsers.keys()));

//   socket.on("conversation:join", ({ conversationId }) => {
//     if (!conversationId) return;
//     socket.join(conversationId);
//     console.log(`📥 User ${userId} joined conversation: ${conversationId}`);
//   });

//   socket.on("conversation:leave", ({ conversationId }) => {
//     if (!conversationId) return;
//     socket.leave(conversationId);
//     console.log(`📤 User ${userId} left conversation: ${conversationId}`);
//   });

//   socket.on("message:send", async ({ conversationId, message }) => {
//     if (!conversationId || !message) return;
//     try {
//       const newMsg = await Message.create({
//         conversation: conversationId,
//         sender: userId,
//         text: message.text || "",
//         image: message.image || null,
//         replyTo: message.replyTo || null,
//       });

//       await newMsg.populate("sender", "name avatar");
// if (!newMsg.sender) {
//   newMsg.sender = { _id: userId, name: "Unknown", avatar: null };
// }
//       const conv = await Conversation.findById(conversationId);

// const unreadUpdate = { lastMessage: newMsg._id };
// conv.participants.forEach((participantId) => {
//   const pid = participantId.toString();
//   if (pid !== userId) {
//     const current = conv.unreadCount?.get(pid) || 0;
//     unreadUpdate[`unreadCount.${pid}`] = current + 1;
//   }
// });

// await Conversation.findByIdAndUpdate(conversationId, unreadUpdate);

//       console.log(`💬 Message in ${conversationId} from ${userId}`);

//       io.to(conversationId).emit("message:receive", {
//         conversationId,
//         message: newMsg,
//       });
//     } catch (err) {
//       console.error("❌ Message save error:", err);
//     }
//   });

//   socket.on("typing:start", ({ conversationId }) => {
//     if (!conversationId) return;
//     socket.to(conversationId).emit("typing:start", { conversationId, userId });
//   });

//   socket.on("typing:stop", ({ conversationId }) => {
//     if (!conversationId) return;
//     socket.to(conversationId).emit("typing:stop", { conversationId, userId });
//   });

//   socket.on("message:seen", ({ conversationId, messageId }) => {
//     if (!conversationId || !messageId) return;
//     socket.to(conversationId).emit("message:seen", { conversationId, messageId, seenBy: userId });
//   });

//   socket.on("message:delete", async ({ conversationId, messageId }) => {
//     if (!conversationId || !messageId) return;
//     try {
//       await Message.findByIdAndUpdate(messageId, { isDeleted: true });
//       io.to(conversationId).emit("message:delete", { conversationId, messageId, deletedBy: userId });
//     } catch (err) {
//       console.error("❌ Delete error:", err);
//     }
//   });

//   socket.on("message:edit", async ({ conversationId, messageId, newText }) => {
//     if (!conversationId || !messageId || !newText?.trim()) return;
//     try {
//       await Message.findByIdAndUpdate(messageId, { text: newText.trim(), isEdited: true });
//       io.to(conversationId).emit("message:edited", { conversationId, messageId, newText: newText.trim(), editedBy: userId });
//     } catch (err) {
//       console.error("❌ Edit error:", err);
//     }
//   });

//   socket.on("user:isOnline", ({ targetUserId }) => {
//     const isOnline = onlineUsers.has(targetUserId);
//     socket.emit("user:isOnline", { userId: targetUserId, isOnline });
//   });

//   socket.on("disconnect", () => {
//     const sockets = onlineUsers.get(userId);
//     if (sockets) {
//       sockets.delete(socket.id);
//       if (sockets.size === 0) {
//         onlineUsers.delete(userId);
//         io.emit("user:offline", { userId });
//         console.log(`🔴 User fully offline: ${userId}`);
//       }
//     }
//   });
// };



const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

const onlineUsers = new Map();

module.exports = (io, socket) => {
  const userId = socket.user.id || socket.user._id?.toString();

  // ── Online tracking ──
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socket.id);

  socket.broadcast.emit("user:online", { userId });
  socket.emit("online:list", Array.from(onlineUsers.keys()));

  // ── Conversation join/leave ──
  socket.on("conversation:join", ({ conversationId }) => {
    if (!conversationId) return;
    socket.join(conversationId);
    console.log(`📥 User ${userId} joined conversation: ${conversationId}`);
  });

  socket.on("conversation:leave", ({ conversationId }) => {
    if (!conversationId) return;
    socket.leave(conversationId);
    console.log(`📤 User ${userId} left conversation: ${conversationId}`);
  });

  // ── Message send ──
  socket.on("message:send", async ({ conversationId, message }) => {
    if (!conversationId || !message) return;

    try {
      const newMsg = await Message.create({
        conversation: conversationId,
        sender: userId,
        text: message.text || "",
        image: message.image || null,
        replyTo: message.replyTo || null,
      });

      await newMsg.populate("sender", "name avatar");

      if (!newMsg.sender) {
        newMsg.sender = { _id: userId, name: "Unknown", avatar: null };
      }

      const conv = await Conversation.findById(conversationId);
      if (!conv) return socket.emit("error", { message: "Conversation not found" });

      const unreadUpdate = { lastMessage: newMsg._id };
      conv.participants.forEach((participantId) => {
        const pid = participantId.toString();
        if (pid !== userId) {
          const current = conv.unreadCount?.get(pid) || 0;
          unreadUpdate[`unreadCount.${pid}`] = current + 1;
        }
      });

      await Conversation.findByIdAndUpdate(conversationId, unreadUpdate);

      io.to(conversationId).emit("message:receive", {
        conversationId,
        message: newMsg,
      });

      console.log(`💬 Message in ${conversationId} from ${userId}`);
    } catch (err) {
      console.error("❌ Message save error:", err);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // ── Typing ──
  socket.on("typing:start", ({ conversationId }) => {
    if (!conversationId) return;
    socket.to(conversationId).emit("typing:start", { conversationId, userId });
  });

  socket.on("typing:stop", ({ conversationId }) => {
    if (!conversationId) return;
    socket.to(conversationId).emit("typing:stop", { conversationId, userId });
  });

  // ── Message seen ──
  socket.on("message:seen", async ({ conversationId, messageId }) => {
    if (!conversationId || !messageId) return;

    try {
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { seenBy: userId },
      });

      await Conversation.findByIdAndUpdate(conversationId, {
        [`unreadCount.${userId}`]: 0,
      });

      socket.to(conversationId).emit("message:seen", {
        conversationId,
        messageId,
        seenBy: userId,
      });
    } catch (err) {
      console.error("❌ Seen update error:", err);
    }
  });

  // ── Message delete ──
  socket.on("message:delete", async ({ conversationId, messageId }) => {
    if (!conversationId || !messageId) return;

    try {
      const msg = await Message.findById(messageId);
      if (!msg) return socket.emit("error", { message: "Message not found" });
      if (msg.sender.toString() !== userId)
        return socket.emit("error", { message: "Unauthorized" });

      await Message.findByIdAndUpdate(messageId, { isDeleted: true });

      io.to(conversationId).emit("message:delete", {
        conversationId,
        messageId,
        deletedBy: userId,
      });
    } catch (err) {
      console.error("❌ Delete error:", err);
      socket.emit("error", { message: "Failed to delete message" });
    }
  });

  // ── Message edit ──
  socket.on("message:edit", async ({ conversationId, messageId, newText }) => {
    if (!conversationId || !messageId || !newText?.trim()) return;

    try {
      const msg = await Message.findById(messageId);
      if (!msg) return socket.emit("error", { message: "Message not found" });
      if (msg.sender.toString() !== userId)
        return socket.emit("error", { message: "Unauthorized" });

      await Message.findByIdAndUpdate(messageId, {
        text: newText.trim(),
        isEdited: true,
      });

      io.to(conversationId).emit("message:edited", {
        conversationId,
        messageId,
        newText: newText.trim(),
        editedBy: userId,
      });
    } catch (err) {
      console.error("❌ Edit error:", err);
      socket.emit("error", { message: "Failed to edit message" });
    }
  });

  // ── Online check ──
  socket.on("user:isOnline", ({ targetUserId }) => {
    const isOnline = onlineUsers.has(targetUserId);
    socket.emit("user:isOnline", { userId: targetUserId, isOnline });
  });

  // ── Disconnect ──
  socket.on("disconnect", () => {
    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsers.delete(userId);
        io.emit("user:offline", { userId });
        console.log(`🔴 User fully offline: ${userId}`);
      }
    }
  });
};