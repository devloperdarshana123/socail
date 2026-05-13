// // src/socket.js
// import { Server } from "socket.io";
// import Message      from "./models/Message.model.js";
// import Conversation from "./models/Conversation.model.js";

// let io;
// const onlineUsers = new Map();

// export const initSocket = (httpServer, allowedOrigins) => {
//   io = new Server(httpServer, {
//     cors: { origin: allowedOrigins, credentials: true },
//   });

//   io.use((socket, next) => {
//     const userId = socket.handshake.auth?.userId;
//     if (!userId) return next(new Error("Unauthorized"));
//     next();
//   });

//   io.on("connection", (socket) => {
//     const userId = socket.handshake.auth?.userId;
//     if (userId) {
//       onlineUsers.set(userId, socket.id);
//       io.emit("userOnline", userId);
//       console.log(`✅ Socket connected: ${userId}`);
//     }

//     socket.on("joinRoom",  (id) => socket.join(id));
//     socket.on("leaveRoom", (id) => socket.leave(id));

//     socket.on("sendMessage", async ({ conversationId, text, image, replyTo }) => {
//       try {
//         if (!userId || (!text?.trim() && !image)) return;
//         const conv = await Conversation.findById(conversationId);
//         if (!conv) return;
//         if (!conv.participants.some((p) => p.toString() === userId)) return;

//         const message = await Message.create({
//           conversation: conversationId,
//           sender: userId,
//           text: text?.trim() || "",
//           image: image || "",
//           readBy: [userId],
//           replyTo: replyTo || null,
//         });

//         await message.populate("sender", "name avatar");
//         if (replyTo) {
//           await message.populate({
//             path: "replyTo",
//             populate: { path: "sender", select: "name" },
//           });
//         }

//         const others = conv.participants.filter((p) => p.toString() !== userId);
//         const unreadUpdate = {};
//         for (const otherId of others) {
//           const current = conv.unreadCount?.get(otherId.toString()) || 0;
//           unreadUpdate[`unreadCount.${otherId}`] = current + 1;
//         }

//         await Conversation.findByIdAndUpdate(conversationId, {
//           lastMessage: message._id,
//           ...unreadUpdate,
//         });

//         io.to(conversationId).emit("newMessage", message);

//         for (const otherId of others) {
//           const otherSocketId = onlineUsers.get(otherId.toString());
//           if (otherSocketId) {
//             io.to(otherSocketId).emit("conversationUpdated", {
//               conversationId,
//               lastMessage: message,
//               unread: (conv.unreadCount?.get(otherId.toString()) || 0) + 1,
//             });
//           }
//         }
//       } catch (err) {
//         console.error("sendMessage error:", err);
//         socket.emit("messageError", { error: "Failed to send message" });
//       }
//     });

//     socket.on("typing", ({ conversationId, isTyping }) => {
//       socket.to(conversationId).emit("typingStatus", { userId, isTyping });
//     });

//     socket.on("markRead", async ({ conversationId }) => {
//       try {
//         if (!userId) return;
//         await Conversation.findByIdAndUpdate(conversationId, {
//           [`unreadCount.${userId}`]: 0,
//         });
//         await Message.updateMany(
//           { conversation: conversationId, readBy: { $ne: userId } },
//           { $addToSet: { readBy: userId } }
//         );
//         socket.to(conversationId).emit("messagesRead", { conversationId, readBy: userId });
//       } catch (err) {
//         console.error("markRead error:", err);
//       }
//     });

//     socket.on("deleteMessage", async ({ messageId, conversationId }) => {
//       try {
//         const msg = await Message.findById(messageId);
//         if (!msg || msg.sender.toString() !== userId) return;
//         msg.isDeleted = true;
//         msg.text  = "";
//         msg.image = "";
//         await msg.save();
//         io.to(conversationId).emit("messageDeleted", { messageId });
//       } catch (err) {
//         console.error("deleteMessage error:", err);
//       }
//     });

//     socket.on("disconnect", () => {
//       if (userId) {
//         onlineUsers.delete(userId);
//         io.emit("userOffline", userId);
//         console.log(`❌ Socket disconnected: ${userId}`);
//       }
//     });
//   });
// };

// // ── Utility: kisi bhi controller se call karo ─────────────────────────────
// export const emitToUser = (userId, event, data = {}) => {
//   if (!io) return;
//   const socketId = onlineUsers.get(userId.toString());
//   if (socketId) io.to(socketId).emit(event, data);
// };


import { Server } from "socket.io";
import jwt         from "jsonwebtoken";
import { Message, Conversation } from "./models/Message.model.js";
import SocialUser                from "./models/User.model.js";

let io;
const onlineUsers = new Map(); // userId → socketId

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

export const initSocket = (httpServer, allowedOrigins) => {
  io = new Server(httpServer, {
    cors:              { origin: allowedOrigins, credentials: true },
    pingTimeout:       60000,
    pingInterval:      25000,
    maxHttpBufferSize: 1e6,   // 1MB max payload
  });

  // ── Auth middleware — JWT se userId verify karo ──────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("NO_TOKEN"));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.id;
      next();
    } catch {
      next(new Error("INVALID_TOKEN"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;

    // Online mark karo
    onlineUsers.set(userId, socket.id);
    io.emit("userOnline", userId);

    // User ki saari conversations ke rooms mein join karo
    try {
      const conversations = await Conversation.find({
        participants: userId,
        deletedFor:   { $nin: [userId] },
      }).select("_id");

      conversations.forEach((c) => socket.join(c._id.toString()));
    } catch (err) {
      console.error("Socket room join error:", err.message);
    }

    // ── Join Room manually ───────────────────────────────────────────────────
    socket.on("joinRoom",  (id) => socket.join(id));
    socket.on("leaveRoom", (id) => socket.leave(id));

    // ── Send Message ─────────────────────────────────────────────────────────
    socket.on("sendMessage", async ({ conversationId, text, replyTo }) => {
      try {
        if (!text?.trim()) return;

        const conv = await Conversation.findOne({
          _id:          conversationId,
          participants: userId,
          deletedFor:   { $nin: [userId] },
        });
        if (!conv) return socket.emit("messageError", { error: "Conversation nahi mili" });

        // Message create karo
        const message = await Message.create({
          conversation: conversationId,
          sender:       userId,
          messageType:  "text",
          text:         text.trim(),
          replyTo:      replyTo || null,
          readBy:       [userId],
        });

        await message.populate("sender", "name username avatar");
        if (replyTo) {
          await message.populate({ path: "replyTo", populate: { path: "sender", select: "name username" } });
        }

        // Conversation update — lastMessage + unread increment
        const otherParticipants = conv.participants.filter((p) => p.toString() !== userId);

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          updatedAt:   new Date(),
        });

        for (const otherId of otherParticipants) {
          await conv.incrementUnread(otherId);
        }

        // Room broadcast karo
        io.to(conversationId).emit("newMessage", message);

        // Conversation update event — sirf online users ko
        for (const otherId of otherParticipants) {
          const otherSocketId = onlineUsers.get(otherId.toString());
          if (otherSocketId) {
            io.to(otherSocketId).emit("conversationUpdated", {
              conversationId,
              lastMessage: message,
              unreadCount: conv.unreadCount?.get(otherId.toString()) || 0,
            });
          }
        }
      } catch (err) {
        console.error("sendMessage socket error:", err.message);
        socket.emit("messageError", { error: "Message send nahi hua" });
      }
    });

    // ── Typing Indicator ─────────────────────────────────────────────────────
    socket.on("typing", ({ conversationId, isTyping }) => {
      socket.to(conversationId).emit("typingStatus", { userId, isTyping });
    });

    // ── Mark Messages Read ───────────────────────────────────────────────────
    socket.on("markRead", async ({ conversationId }) => {
      try {
        const conv = await Conversation.findOne({
          _id:          conversationId,
          participants: userId,
        });
        if (!conv) return;

        // Messages read mark karo
        await Message.updateMany(
          {
            conversation: conversationId,
            sender:       { $ne: userId },
            readBy:       { $nin: [userId] },
            isDeleted:    false,
          },
          { $addToSet: { readBy: userId } }
        );

        // Unread count reset
        await conv.resetUnread(userId);

        socket.to(conversationId).emit("messagesRead", { conversationId, readBy: userId });
      } catch (err) {
        console.error("markRead socket error:", err.message);
      }
    });

    // ── Delete Message ───────────────────────────────────────────────────────
    socket.on("deleteMessage", async ({ messageId, conversationId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message || message.isDeleted) return;
        if (message.sender.toString() !== userId) return;

        // 10 minute ke andar hi "for everyone" delete hoga
        const ageMs = Date.now() - new Date(message.createdAt).getTime();
        if (ageMs > 10 * 60 * 1000) return;

        await message.deleteForAll();

        io.to(conversationId).emit("messageDeleted", { messageId, conversationId });
      } catch (err) {
        console.error("deleteMessage socket error:", err.message);
      }
    });

    // ── Message Reaction ─────────────────────────────────────────────────────
    socket.on("reactMessage", async ({ messageId, conversationId, emoji }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message || message.isDeleted) return;

        const existing = message.reactions.findIndex(
          (r) => r.user.toString() === userId
        );

        if (existing !== -1) {
          message.reactions[existing].emoji = emoji;
        } else {
          message.reactions.push({ user: userId, emoji });
        }

        await message.save({ validateBeforeSave: false });

        io.to(conversationId).emit("messageReaction", {
          messageId,
          reactions: message.reactions,
        });
      } catch (err) {
        console.error("reactMessage socket error:", err.message);
      }
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      onlineUsers.delete(userId);
      io.emit("userOffline", userId);

      // lastSeen update karo
      SocialUser.findByIdAndUpdate(userId, { lastSeen: new Date() }).exec();
    });
  });

  console.log("✅ Socket.io initialized");
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilities — controllers se call karo
// ─────────────────────────────────────────────────────────────────────────────

/** Specific user ko event bhejo */
export const emitToUser = (userId, event, data = {}) => {
  if (!io) return;
  const socketId = onlineUsers.get(userId.toString());
  if (socketId) io.to(socketId).emit(event, data);
};

/** Room mein broadcast karo */
export const emitToRoom = (roomId, event, data = {}) => {
  if (!io) return;
  io.to(roomId.toString()).emit(event, data);
};

/** User online hai? */
export const isUserOnline = (userId) => onlineUsers.has(userId.toString());

/** Online users list */
export const getOnlineUsers = () => [...onlineUsers.keys()];