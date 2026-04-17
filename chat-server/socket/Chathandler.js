// // socket/chatHandler.js

// const onlineUsers = new Map(); // userId -> Set of socketIds

// module.exports = (io, socket) => {
//   const userId = socket.user.id;

//   // ─── Online Status ───────────────────────────────────────────────

//   // Track this socket
//   if (!onlineUsers.has(userId)) {
//     onlineUsers.set(userId, new Set());
//   }
//   onlineUsers.get(userId).add(socket.id);

//   // Broadcast to everyone that this user is online
//   socket.broadcast.emit("user:online", { userId });

//   // Let this user know who is currently online
//   socket.emit("online:list", Array.from(onlineUsers.keys()));

//   // ─── Join a Conversation Room ────────────────────────────────────

//   // Client emits: { conversationId }
//   socket.on("conversation:join", ({ conversationId }) => {
//     if (!conversationId) return;
//     socket.join(conversationId);
//     console.log(`📥 User ${userId} joined conversation: ${conversationId}`);
//   });

//   // Client emits: { conversationId }
//   socket.on("conversation:leave", ({ conversationId }) => {
//     if (!conversationId) return;
//     socket.leave(conversationId);
//     console.log(`📤 User ${userId} left conversation: ${conversationId}`);
//   });

//   // ─── Send Message ────────────────────────────────────────────────

//   // Client emits: { conversationId, message }
//   // message: { _id, senderId, text, createdAt, ... }
//   socket.on("message:send", ({ conversationId, message }) => {
//     if (!conversationId || !message) return;

//     console.log(`💬 Message in ${conversationId} from ${userId}`);

//     // Broadcast to everyone in the conversation room (including sender)
//     io.to(conversationId).emit("message:receive", {
//       conversationId,
//       message,
//     });
//   });

//   // ─── Typing Indicators ───────────────────────────────────────────

//   // Client emits: { conversationId }
//   socket.on("typing:start", ({ conversationId }) => {
//     if (!conversationId) return;
//     socket.to(conversationId).emit("typing:start", {
//       conversationId,
//       userId,
//     });
//   });

//   // Client emits: { conversationId }
//   socket.on("typing:stop", ({ conversationId }) => {
//     if (!conversationId) return;
//     socket.to(conversationId).emit("typing:stop", {
//       conversationId,
//       userId,
//     });
//   });

//   // ─── Message Seen / Read Receipt ────────────────────────────────

//   // Client emits: { conversationId, messageId }
//   socket.on("message:seen", ({ conversationId, messageId }) => {
//     if (!conversationId || !messageId) return;
//     socket.to(conversationId).emit("message:seen", {
//       conversationId,
//       messageId,
//       seenBy: userId,
//     });
//   });

//   // ─── Message Delete ──────────────────────────────────────────────

//   // Client emits: { conversationId, messageId }
//   socket.on("message:delete", ({ conversationId, messageId }) => {
//     if (!conversationId || !messageId) return;
//     io.to(conversationId).emit("message:delete", {
//       conversationId,
//       messageId,
//       deletedBy: userId,
//     });
//   });

//   // Message Edit
// socket.on("message:edit", ({ conversationId, messageId, newText }) => {
//   if (!conversationId || !messageId || !newText?.trim()) return;
//   io.to(conversationId).emit("message:edited", {
//     conversationId,
//     messageId,
//     newText: newText.trim(),
//     editedBy: userId,
//   });
// });
//   // ─── Check if a specific user is online ─────────────────────────

//   // Client emits: { targetUserId }
//   socket.on("user:isOnline", ({ targetUserId }) => {
//     const isOnline = onlineUsers.has(targetUserId);
//     socket.emit("user:isOnline", { userId: targetUserId, isOnline });
//   });

//   // ─── Disconnect ──────────────────────────────────────────────────

//   socket.on("disconnect", () => {
//     const sockets = onlineUsers.get(userId);
//     if (sockets) {
//       sockets.delete(socket.id);
//       // Only mark offline when ALL tabs/devices disconnect
//       if (sockets.size === 0) {
//         onlineUsers.delete(userId);
//         io.emit("user:offline", { userId });
//         console.log(`🔴 User fully offline: ${userId}`);
//       }
//     }
//   });
// };



const onlineUsers = new Map();
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const User = require("../models/User");
module.exports = (io, socket) => {
  const userId = socket.user.id;

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socket.id);

  socket.broadcast.emit("user:online", { userId });
  socket.emit("online:list", Array.from(onlineUsers.keys()));

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
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: newMsg._id,
      });

      console.log(`💬 Message in ${conversationId} from ${userId}`);

      io.to(conversationId).emit("message:receive", {
        conversationId,
        message: newMsg,
      });
    } catch (err) {
      console.error("❌ Message save error:", err);
    }
  });

  socket.on("typing:start", ({ conversationId }) => {
    if (!conversationId) return;
    socket.to(conversationId).emit("typing:start", { conversationId, userId });
  });

  socket.on("typing:stop", ({ conversationId }) => {
    if (!conversationId) return;
    socket.to(conversationId).emit("typing:stop", { conversationId, userId });
  });

  socket.on("message:seen", ({ conversationId, messageId }) => {
    if (!conversationId || !messageId) return;
    socket.to(conversationId).emit("message:seen", { conversationId, messageId, seenBy: userId });
  });

  socket.on("message:delete", async ({ conversationId, messageId }) => {
    if (!conversationId || !messageId) return;
    try {
      await Message.findByIdAndUpdate(messageId, { isDeleted: true });
      io.to(conversationId).emit("message:delete", { conversationId, messageId, deletedBy: userId });
    } catch (err) {
      console.error("❌ Delete error:", err);
    }
  });

  socket.on("message:edit", async ({ conversationId, messageId, newText }) => {
    if (!conversationId || !messageId || !newText?.trim()) return;
    try {
      await Message.findByIdAndUpdate(messageId, { text: newText.trim(), isEdited: true });
      io.to(conversationId).emit("message:edited", { conversationId, messageId, newText: newText.trim(), editedBy: userId });
    } catch (err) {
      console.error("❌ Edit error:", err);
    }
  });

  socket.on("user:isOnline", ({ targetUserId }) => {
    const isOnline = onlineUsers.has(targetUserId);
    socket.emit("user:isOnline", { userId: targetUserId, isOnline });
  });

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