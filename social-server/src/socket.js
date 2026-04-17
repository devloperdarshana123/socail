// src/socket.js
import { Server } from "socket.io";
import Message      from "./models/Message.model.js";
import Conversation from "./models/Conversation.model.js";

let io;
const onlineUsers = new Map();

export const initSocket = (httpServer, allowedOrigins) => {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
  });

  io.use((socket, next) => {
    const userId = socket.handshake.auth?.userId;
    if (!userId) return next(new Error("Unauthorized"));
    next();
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth?.userId;
    if (userId) {
      onlineUsers.set(userId, socket.id);
      io.emit("userOnline", userId);
      console.log(`✅ Socket connected: ${userId}`);
    }

    socket.on("joinRoom",  (id) => socket.join(id));
    socket.on("leaveRoom", (id) => socket.leave(id));

    socket.on("sendMessage", async ({ conversationId, text, image, replyTo }) => {
      try {
        if (!userId || (!text?.trim() && !image)) return;
        const conv = await Conversation.findById(conversationId);
        if (!conv) return;
        if (!conv.participants.some((p) => p.toString() === userId)) return;

        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          text: text?.trim() || "",
          image: image || "",
          readBy: [userId],
          replyTo: replyTo || null,
        });

        await message.populate("sender", "name avatar");
        if (replyTo) {
          await message.populate({
            path: "replyTo",
            populate: { path: "sender", select: "name" },
          });
        }

        const others = conv.participants.filter((p) => p.toString() !== userId);
        const unreadUpdate = {};
        for (const otherId of others) {
          const current = conv.unreadCount?.get(otherId.toString()) || 0;
          unreadUpdate[`unreadCount.${otherId}`] = current + 1;
        }

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          ...unreadUpdate,
        });

        io.to(conversationId).emit("newMessage", message);

        for (const otherId of others) {
          const otherSocketId = onlineUsers.get(otherId.toString());
          if (otherSocketId) {
            io.to(otherSocketId).emit("conversationUpdated", {
              conversationId,
              lastMessage: message,
              unread: (conv.unreadCount?.get(otherId.toString()) || 0) + 1,
            });
          }
        }
      } catch (err) {
        console.error("sendMessage error:", err);
        socket.emit("messageError", { error: "Failed to send message" });
      }
    });

    socket.on("typing", ({ conversationId, isTyping }) => {
      socket.to(conversationId).emit("typingStatus", { userId, isTyping });
    });

    socket.on("markRead", async ({ conversationId }) => {
      try {
        if (!userId) return;
        await Conversation.findByIdAndUpdate(conversationId, {
          [`unreadCount.${userId}`]: 0,
        });
        await Message.updateMany(
          { conversation: conversationId, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId } }
        );
        socket.to(conversationId).emit("messagesRead", { conversationId, readBy: userId });
      } catch (err) {
        console.error("markRead error:", err);
      }
    });

    socket.on("deleteMessage", async ({ messageId, conversationId }) => {
      try {
        const msg = await Message.findById(messageId);
        if (!msg || msg.sender.toString() !== userId) return;
        msg.isDeleted = true;
        msg.text  = "";
        msg.image = "";
        await msg.save();
        io.to(conversationId).emit("messageDeleted", { messageId });
      } catch (err) {
        console.error("deleteMessage error:", err);
      }
    });

    socket.on("disconnect", () => {
      if (userId) {
        onlineUsers.delete(userId);
        io.emit("userOffline", userId);
        console.log(`❌ Socket disconnected: ${userId}`);
      }
    });
  });
};

// ── Utility: kisi bhi controller se call karo ─────────────────────────────
export const emitToUser = (userId, event, data = {}) => {
  if (!io) return;
  const socketId = onlineUsers.get(userId.toString());
  if (socketId) io.to(socketId).emit(event, data);
};