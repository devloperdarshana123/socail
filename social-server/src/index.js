

// import express from "express";
// import cors from "cors";
// import morgan from "morgan";
// import { createServer } from "http";
// import { Server } from "socket.io";

// import connectDB from "./config/db.js";
// import authRoutes     from "./routes/auth.routes.js";
// import postRoutes     from "./routes/post.routes.js";
// import followRoutes   from "./routes/follow.routes.js";
// import marketplaceRoutes from "./routes/marketplace.routes.js";
// import settingsRoutes from "./routes/settings.routes.js";

// import messageRoutes  from "./routes/message.routes.js";   // ← NEW

// import Message      from "./models/Message.model.js";       // ← NEW
// import Conversation from "./models/Conversation.model.js";  // ← NEW

// const app        = express();
// const httpServer = createServer(app);                        // ← HTTP server wraps express
// const PORT       = process.env.PORT || 8001;

// // ── CORS Origins ─────────────────────────────────────────────────────────────
// const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
//   ? process.env.ALLOWED_ORIGINS.split(",")
//   : ["http://localhost:5173", "http://localhost:5174"];

// // ── Socket.io Setup ───────────────────────────────────────────────────────────
// const io = new Server(httpServer, {
//   cors: { origin: ALLOWED_ORIGINS, credentials: true },
// });

// // userId → socketId map (online users)
// const onlineUsers = new Map();

// io.use((socket, next) => {
//   const userId = socket.handshake.auth?.userId;
//   if (!userId) return next(new Error("Unauthorized"));
//   next();
// });
// io.on("connection", (socket) => {
//   const userId = socket.handshake.auth?.userId;

//   if (userId) {
//     onlineUsers.set(userId, socket.id);
//     // Broadcast to everyone that this user is online
//     io.emit("userOnline", userId);
//     console.log(`✅ Socket connected: ${userId}`);
//   }

//   // ── Join a conversation room ──────────────────────────────────────────────
//   socket.on("joinRoom", (conversationId) => {
//     socket.join(conversationId);
//   });

//   // ── Leave a conversation room ─────────────────────────────────────────────
//   socket.on("leaveRoom", (conversationId) => {
//     socket.leave(conversationId);
//   });

//   // ── Send a message ────────────────────────────────────────────────────────
//   socket.on("sendMessage", async ({ conversationId, text, image, replyTo }) => {
//     try {
//       if (!userId) return;
//       if (!text?.trim() && !image) return;

//       const conv = await Conversation.findById(conversationId);
//       if (!conv) return;

//       const isParticipant = conv.participants.some(
//         (p) => p.toString() === userId
//       );
//       if (!isParticipant) return;

//       // Save to DB
//       const message = await Message.create({
//         conversation: conversationId,
//         sender:       userId,
//         text:         text?.trim() || "",
//         image:        image || "",
//         readBy:       [userId],
//         replyTo:      replyTo || null,
//       });

//       await message.populate("sender", "name avatar");
//       if (replyTo) {
//         await message.populate({ path: "replyTo", populate: { path: "sender", select: "name" } });
//       }

//       // Update conversation: lastMessage + unreadCount for other participants
//       const others = conv.participants.filter((p) => p.toString() !== userId);
//       const unreadUpdate = {};
//       for (const otherId of others) {
//         const current = conv.unreadCount?.get(otherId.toString()) || 0;
//         unreadUpdate[`unreadCount.${otherId}`] = current + 1;
//       }

//       await Conversation.findByIdAndUpdate(conversationId, {
//         lastMessage: message._id,
//         ...unreadUpdate,
//       });

//       // Emit to all in room (including sender for confirmation)
//       io.to(conversationId).emit("newMessage", message);

//       // Also notify other participants via their personal room (for sidebar update)
//       for (const otherId of others) {
//         const otherSocketId = onlineUsers.get(otherId.toString());
//         if (otherSocketId) {
//           io.to(otherSocketId).emit("conversationUpdated", {
//             conversationId,
//             lastMessage: message,
//             unread: (conv.unreadCount?.get(otherId.toString()) || 0) + 1,
//           });
//         }
//       }
//     } catch (err) {
//       console.error("Socket sendMessage error:", err);
//       socket.emit("messageError", { error: "Failed to send message" });
//     }
//   });

//   // ── Typing indicator ──────────────────────────────────────────────────────
//   socket.on("typing", ({ conversationId, isTyping }) => {
//     socket.to(conversationId).emit("typingStatus", { userId, isTyping });
//   });

//   // ── Mark messages as read ─────────────────────────────────────────────────
//   socket.on("markRead", async ({ conversationId }) => {
//     try {
//       if (!userId) return;
//       await Conversation.findByIdAndUpdate(conversationId, {
//         [`unreadCount.${userId}`]: 0,
//       });
//       await Message.updateMany(
//         { conversation: conversationId, readBy: { $ne: userId } },
//         { $addToSet: { readBy: userId } }
//       );
//       // Tell sender their message was read
//       socket.to(conversationId).emit("messagesRead", { conversationId, readBy: userId });
//     } catch (err) {
//       console.error("markRead error:", err);
//     }
//   });

//   // ── Delete message ────────────────────────────────────────────────────────
//   socket.on("deleteMessage", async ({ messageId, conversationId }) => {
//     try {
//       const msg = await Message.findById(messageId);
//       if (!msg || msg.sender.toString() !== userId) return;
//       msg.isDeleted = true;
//       msg.text  = "";
//       msg.image = "";
//       await msg.save();
//       io.to(conversationId).emit("messageDeleted", { messageId });
//     } catch (err) {
//       console.error("deleteMessage error:", err);
//     }
//   });

//   // ── Disconnect ────────────────────────────────────────────────────────────
//   socket.on("disconnect", () => {
//     if (userId) {
//       onlineUsers.delete(userId);
//       io.emit("userOffline", userId);
//       console.log(`❌ Socket disconnected: ${userId}`);
//     }
//   });
// });

// // ── Express Middleware ────────────────────────────────────────────────────────
// app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
// app.use(morgan("dev"));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // ── REST Routes ───────────────────────────────────────────────────────────────
// app.use("/api/auth",     authRoutes);
// app.use("/api/posts",    postRoutes);
// app.use("/api/follow",   followRoutes);
// app.use("/api/settings", settingsRoutes);

// app.use("/api/messages", messageRoutes);      
// app.use("/api/marketplace", marketplaceRoutes);        // ← NEW

// // ── Health Check ──────────────────────────────────────────────────────────────
// app.get("/", (_, res) => {
//   res.json({ success: true, message: "🚀 EroSocial Server Running!" });
// });
// // ── Global Error Handler ──────────────────────────────────────────────────────
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(err.status || 500).json({
//     success: false,
//     message: err.message || "Server Error",
//   });
// });

// // ── Start ─────────────────────────────────────────────────────────────────────
// connectDB().then(() => {
//   httpServer.listen(PORT, () => {                     // ← httpServer, not app
//     console.log(`✅ EroSocial Server running on http://localhost:${PORT}`);
//   });
// });



import express from "express";
import cors from "cors";
import morgan from "morgan";
import { createServer } from "http";

import connectDB from "./config/db.js";
import { initSocket } from "./socket.js"; // ← NEW

import authRoutes        from "./routes/auth.routes.js";
import postRoutes        from "./routes/post.routes.js";
import followRoutes      from "./routes/follow.routes.js";
import marketplaceRoutes from "./routes/marketplace.routes.js";
import settingsRoutes    from "./routes/settings.routes.js";
import messageRoutes     from "./routes/message.routes.js";

const app        = express();
const httpServer = createServer(app);
const PORT       = process.env.PORT || 8001;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:5174"];

// ── Socket.io Init ────────────────────────────────────────────────────────────
initSocket(httpServer, ALLOWED_ORIGINS); // ← socket.js handle karega

// ── Express Middleware ────────────────────────────────────────────────────────
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── REST Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",        authRoutes);
app.use("/api/posts",       postRoutes);
app.use("/api/follow",      followRoutes);
app.use("/api/settings",    settingsRoutes);
app.use("/api/messages",    messageRoutes);
app.use("/api/marketplace", marketplaceRoutes);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/", (_, res) => {
  res.json({ success: true, message: "🚀 EroSocial Server Running!" });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Server Error",
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`✅ EroSocial Server running on http://localhost:${PORT}`);
  });
});