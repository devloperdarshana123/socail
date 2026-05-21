
// // // chat-server/socket/Chathandler.js
// // import Message from "../models/Message.js";
// // import Conversation from "../models/Conversation.js";
// // import Notification from "../models/Notification.js";
// // import User from "../models/User.js";

// // const onlineUsers = new Map(); // userId → Set<socketId>

// // // ── Helpers ──────────────────────────────────────────────────────────────────

// // const syncLastMessage = async (conversationId, msg) => {
// //   try {
// //     await Conversation.findByIdAndUpdate(conversationId, {
// //       $set: { lastMessage: msg._id },
// //     });
// //   } catch (err) {
// //     console.error("❌ syncLastMessage error:", err.message);
// //   }
// // };

// // function aggregateReactions(reactions = []) {
// //   const map = {};
// //  reactions.forEach(({ emoji, user }) => {
// //   if (!map[emoji]) map[emoji] = { emoji, count: 0, users: [] };
// //   map[emoji].count += 1;
// //   map[emoji].users.push(user.toString());
// // });
// //   return Object.values(map);
// // }

// // const saveOfflineNotification = async ({ receiver, sender, conversationId }) => {
// //   try {
// //     await Notification.createNotification({
// //       receiver,
// //       sender,
// //       type: "new_message",
// //       refId: conversationId,
// //       refModel: "Conversation",
// //     });
// //   } catch (err) {
// //     console.error("❌ Offline notification save error:", err.message);
// //   }
// // };

// // // ── Main handler ─────────────────────────────────────────────────────────────

// // export default (io, socket) => {
// //   const userId = (socket.user.id || socket.user._id)?.toString();

// //   // ── Rate limiter ────────────────────────────────────────────────────────
// //   const messageTimestamps = [];
// //   const isRateLimited = () => {
// //     const now = Date.now();
// //     const windowMs = 10_000;
// //     const maxMessages = 10;
// //     const recent = messageTimestamps.filter((t) => now - t < windowMs);
// //     messageTimestamps.length = 0;
// //     recent.forEach((t) => messageTimestamps.push(t));
// //     if (recent.length >= maxMessages) return true;
// //     messageTimestamps.push(now);
// //     return false;
// //   };

// //   // ── Online tracking ─────────────────────────────────────────────────────
// //   if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
// //   onlineUsers.get(userId).add(socket.id);

// //   socket.broadcast.emit("user:online", { userId });
// //   socket.emit("online:list", Array.from(onlineUsers.keys()));

// //   // ── notifyUser ──────────────────────────────────────────────────────────
// //   const notifyUser = (recipientId, event, payload) => {
// //     const sockets = onlineUsers.get(recipientId.toString());
// //     if (sockets?.size) {
// //       sockets.forEach((sid) => io.to(sid).emit(event, payload));
// //     }
// //   };

// //   // ── getParticipants ─────────────────────────────────────────────────────
// //   const getParticipants = async (conversationId) => {
// //     const conv = await Conversation.findById(conversationId).lean();
// //     return conv?.participants?.map((p) => p.toString()) || [];
// //   };

// //   // ── isBlocked check ─────────────────────────────────────────────────────
// //   // Returns true agar A ne B ko block kiya hai ya B ne A ko
// //   const isBlocked = async (userIdA, userIdB) => {
// //     const userA = await User.findById(userIdA).select("blockedUsers").lean();
// //     const userB = await User.findById(userIdB).select("blockedUsers").lean();
// //     const aBlockedB = userA?.blockedUsers?.map(String).includes(String(userIdB));
// //     const bBlockedA = userB?.blockedUsers?.map(String).includes(String(userIdA));
// //     return aBlockedB || bBlockedA;
// //   };

// //   // ── Conversation join / leave ───────────────────────────────────────────
// //   socket.on("conversation:join", ({ conversationId }) => {
// //     if (!conversationId) return;
// //     socket.join(conversationId);
// //   });

// //   socket.on("conversation:leave", ({ conversationId }) => {
// //     if (!conversationId) return;
// //     socket.leave(conversationId);
// //   });

// //   // ── Message send ────────────────────────────────────────────────────────
// //   socket.on("message:send", async ({ conversationId, message }) => {
// //     if (isRateLimited())
// //       return socket.emit("error", { message: "Too many messages. Slow down!" });
// //     if (!conversationId || !message) return;
// //     if (!message.text?.trim() && !message.image && !message.audio) return;
// //     if (message.text && message.text.length > 2000)
// //       return socket.emit("error", { message: "Message too long." });

// //     try {
// //       const conv = await Conversation.findById(conversationId).lean();
// //       if (!conv) return socket.emit("error", { message: "Conversation not found." });

// //       const participants = conv.participants.map((p) => p.toString());
// //       if (!participants.includes(userId))
// //         return socket.emit("error", { message: "Unauthorized." });

// //       // ── Block check ────────────────────────────────────────────────────
// //       const otherParticipant = participants.find((p) => p !== userId);
// //       if (otherParticipant) {
// //         const blocked = await isBlocked(userId, otherParticipant);
// //         if (blocked)
// //           return socket.emit("error", { message: "You cannot message this user.", code: "BLOCKED" });
// //       }

// //       // Reply preview
// //       let replyPreview = null;
// //       if (message.replyTo) {
// //         const parent = await Message.findById(message.replyTo)
// //           .select("text image audio isDeleted sender")
// //           .lean();
// //         if (parent) {
// //           replyPreview = {
// //             messageId: parent._id,
// //             text: parent.isDeleted ? "" : (parent.text?.slice(0, 100) ?? ""),
// //             senderId: parent.sender,
// //             isDeleted: parent.isDeleted ?? false,
// //           };
// //         }
// //       }

// //       // Determine message type
// //       let msgType = "text";
// //       if (message.audio && !message.text?.trim()) msgType = "audio";
// //       else if (message.image && !message.text?.trim()) msgType = "image";

// //       const newMsg = await Message.create({
// //         conversation: conversationId,
// //         sender: userId,
// //         text: message.text?.trim() || "",
// //         image: message.image || null,
// //         audio: message.audio || null,   // { url, publicId, duration }
// //         replyTo: replyPreview,
// //         type: msgType,
// //         seenBy: [userId],
// //       });

// //       await newMsg.populate([
// //         { path: "sender", select: "fullName username avatar isVerifiedBadge" },
// //       ]);

// //       await syncLastMessage(conversationId, newMsg);

// //       // Unread count increment
// //       const incUpdate = {};
// //       participants.forEach((pid) => {
// //         if (pid !== userId) incUpdate[`unreadCount.${pid}`] = 1;
// //       });
// //       if (Object.keys(incUpdate).length) {
// //         await Conversation.findByIdAndUpdate(conversationId, { $inc: incUpdate });
// //       }

// //       // Emit to all participants
// //      // Emit to all participants — blocked users ko deliver mat karo
// // for (const pid of participants) {
// //   if (pid !== userId) {
// //     const recipientUser = await User.findById(pid).select("blockedUsers").lean();
// //     const recipientBlockedSender = recipientUser?.blockedUsers
// //       ?.map(String).includes(String(userId));
// //     if (recipientBlockedSender) continue;
// //   }
// //   notifyUser(pid, "message:receive", {
// //     conversationId,
// //     message: newMsg,
// //     tempId: message.tempId || null,
// //   });
// // }

// //       // Notifications
// //       for (const pid of participants) {
// //         if (pid === userId) continue;
// //         if (onlineUsers.has(pid)) {
// //           notifyUser(pid, "notification:message", {
// //             conversationId,
// //             sender: {
// //               _id: userId,
// //               fullName: newMsg.sender?.fullName,
// //               avatar: newMsg.sender?.avatar,
// //             },
// //             preview: newMsg.audio
// //               ? "🎙️ Voice message"
// //               : newMsg.text
// //               ? newMsg.text.length > 60 ? newMsg.text.slice(0, 60) + "…" : newMsg.text
// //               : "📷 Image",
// //           });
// //         } else {
// //           await saveOfflineNotification({ receiver: pid, sender: userId, conversationId });
// //         }
// //       }
// //     } catch (err) {
// //       console.error("❌ message:send error:", err);
// //       socket.emit("error", { message: "Failed to send message." });
// //     }
// //   });

// //   // ── Typing ──────────────────────────────────────────────────────────────
// //   socket.on("typing:start", ({ conversationId }) => {
// //     if (!conversationId) return;
// //     socket.to(conversationId).emit("typing:start", { conversationId, userId });
// //   });

// //   socket.on("typing:stop", ({ conversationId }) => {
// //     if (!conversationId) return;
// //     socket.to(conversationId).emit("typing:stop", { conversationId, userId });
// //   });

// //   // ── Message seen ────────────────────────────────────────────────────────
// //   socket.on("message:seen", async ({ conversationId, messageId }) => {
// //     if (!conversationId || !messageId) return;
// //     try {
// //       await Message.findByIdAndUpdate(messageId, { $addToSet: { seenBy: userId } });
// //       await Conversation.findByIdAndUpdate(conversationId, {
// //         $set: { [`unreadCount.${userId}`]: 0 },
// //       });
// //       const participants = await getParticipants(conversationId);
// //       participants.forEach((pid) => {
// //         if (pid !== userId) {
// //           notifyUser(pid, "message:seen", { conversationId, messageId, seenBy: userId });
// //         }
// //       });
// //     } catch (err) {
// //       console.error("❌ message:seen error:", err);
// //     }
// //   });

// //   // ── Message edit ─────────────────────────────────────────────────────────
// //   const EDIT_WINDOW_MS = 15 * 60 * 1000;

// //   socket.on("message:edit", async ({ conversationId, messageId, newText }) => {
// //     if (!conversationId || !messageId || !newText?.trim()) return;
// //     if (newText.trim().length > 2000)
// //       return socket.emit("error", { message: "Message too long." });

// //     try {
// //       const msg = await Message.findById(messageId);
// //       if (!msg) return socket.emit("error", { message: "Message not found." });
// //       if (msg.isDeleted) return socket.emit("error", { message: "Cannot edit deleted message." });
// //       if (msg.sender.toString() !== userId) return socket.emit("error", { message: "Unauthorized." });
// //       if (Date.now() - new Date(msg.createdAt).getTime() > EDIT_WINDOW_MS)
// //         return socket.emit("error", { message: "Message can only be edited within 15 minutes." });

// //       msg.text = newText.trim();
// //       msg.isEdited = true;
// //       msg.editedAt = new Date();
// //       await msg.save();
// //       await syncLastMessage(conversationId, msg);

// //       const participants = await getParticipants(conversationId);
// //       participants.forEach((pid) => {
// //         notifyUser(pid, "message:edited", {
// //           conversationId, messageId,
// //           newText: msg.text, isEdited: true, editedAt: msg.editedAt,
// //         });
// //       });
// //     } catch (err) {
// //       console.error("❌ message:edit error:", err);
// //       socket.emit("error", { message: "Failed to edit message." });
// //     }
// //   });

// //   // ── Message delete ───────────────────────────────────────────────────────
// //   socket.on("message:delete", async ({ conversationId, messageId }) => {
// //     if (!conversationId || !messageId) return;
// //     try {
// //       const msg = await Message.findById(messageId);
// //       if (!msg) return socket.emit("error", { message: "Message not found." });
// //       if (msg.isDeleted) return socket.emit("error", { message: "Already deleted." });
// //       if (msg.sender.toString() !== userId) return socket.emit("error", { message: "Unauthorized." });

// //       msg.isDeleted = true;
// //       msg.deletedAt = new Date();
// //       msg.text = "";
// //       msg.image = null;
// //       msg.audio = null;
// //       msg.reactions = [];
// //       await msg.save();
// //       await syncLastMessage(conversationId, msg);

// //       const participants = await getParticipants(conversationId);
// //       participants.forEach((pid) => {
// //         notifyUser(pid, "message:deleted", { conversationId, messageId, deletedBy: userId });
// //       });
// //     } catch (err) {
// //       console.error("❌ message:delete error:", err);
// //       socket.emit("error", { message: "Failed to delete message." });
// //     }
// //   });

// //   // ── Emoji reaction ───────────────────────────────────────────────────────
// //   socket.on("message:react", async ({ conversationId, messageId, emoji }) => {
// //     if (!conversationId || !messageId) return;
// //     try {
// //       const msg = await Message.findById(messageId);
// //       if (!msg || msg.isDeleted) return socket.emit("error", { message: "Message not found." });

// //      const existingIdx = msg.reactions.findIndex(
// //   (r) => r.user.toString() === userId && r.emoji === emoji
// // );
// //       if (existingIdx !== -1) {
// //         msg.reactions.splice(existingIdx, 1);
// //       } else {
// //        msg.reactions = msg.reactions.filter((r) => r.user.toString() !== userId);
// // if (emoji?.trim()) msg.reactions.push({ user: userId, emoji: emoji.trim(), reactedAt: new Date() });
// //       }
// //       await msg.save();

// //       const aggregated = aggregateReactions(msg.reactions);
// //       const participants = await getParticipants(conversationId);
// //       participants.forEach((pid) => {
// //         notifyUser(pid, "message:reaction", {
// //           conversationId, messageId,
// //           reactions: aggregated, rawReactions: msg.reactions,
// //         });
// //       });
// //     } catch (err) {
// //       console.error("❌ message:react error:", err);
// //       socket.emit("error", { message: "Failed to add reaction." });
// //     }
// //   });



// //   // ── Check block status ───────────────────────────────────────────────────
// //   socket.on("user:blockStatus", async ({ targetUserId }) => {
// //     if (!targetUserId) return;
// //     try {
// //       const blocked = await isBlocked(userId, targetUserId);
// //       const me = await User.findById(userId).select("blockedUsers").lean();
// //       const iBlockedThem = me?.blockedUsers?.map(String).includes(String(targetUserId));
// //       socket.emit("user:blockStatus", { targetUserId, blocked, iBlockedThem });
// //     } catch (err) {
// //       console.error("❌ user:blockStatus error:", err);
// //     }
// //   });

// //   // ── Report user ──────────────────────────────────────────────────────────
// //   socket.on("user:report", async ({ targetUserId, reason }) => {
// //     if (!targetUserId || targetUserId === userId) return;
// //     try {
// //       // Notification model ya separate Report model mein save karo
// //       await Notification.createNotification({
// //         receiver: targetUserId, // admin ko bhejna chahiye production mein
// //         sender: userId,
// //         type: "user_report",
// //         refId: targetUserId,
// //         refModel: "User",
// //         meta: { reason: reason || "No reason provided" },
// //       }).catch(() => {}); // Silent fail agar model support nahi karta

// //       socket.emit("user:report:success", { targetUserId });
// //     } catch (err) {
// //       console.error("❌ user:report error:", err);
// //       socket.emit("error", { message: "Failed to report user." });
// //     }
// //   });

// //   // ── Online check ─────────────────────────────────────────────────────────
// //   socket.on("user:isOnline", ({ targetUserId }) => {
// //     socket.emit("user:isOnline", {
// //       userId: targetUserId,
// //       isOnline: onlineUsers.has(targetUserId),
// //     });
// //   });

// //   // ── Disconnect ───────────────────────────────────────────────────────────
// //   socket.on("disconnect", () => {
// //     const sockets = onlineUsers.get(userId);
// //     if (sockets) {
// //       sockets.delete(socket.id);
// //       if (sockets.size === 0) {
// //         onlineUsers.delete(userId);
// //         io.emit("user:offline", { userId });
// //         console.log(`❌ User disconnected: ${userId}`);
// //       }
// //     }
// //   });
// // };




// // chat-server/socket/Chathandler.js
// import Message from "../models/Message.js";
// import Conversation from "../models/Conversation.js";
// import Notification from "../models/Notification.js";
// import User from "../models/User.js";

// const onlineUsers = new Map(); // userId → Set<socketId>

// // ── Helpers ──────────────────────────────────────────────────────────────────

// const syncLastMessage = async (conversationId, msg) => {
//   try {
//     await Conversation.findByIdAndUpdate(conversationId, {
//       $set: { lastMessage: msg._id },
//     });
//   } catch (err) {
//     console.error("❌ syncLastMessage error:", err.message);
//   }
// };

// function aggregateReactions(reactions = []) {
//   const map = {};
//   reactions.forEach(({ emoji, user }) => {
//     if (!map[emoji]) map[emoji] = { emoji, count: 0, users: [] };
//     map[emoji].count += 1;
//     map[emoji].users.push(user.toString());
//   });
//   return Object.values(map);
// }

// const saveOfflineNotification = async ({ receiver, sender, conversationId }) => {
//   try {
//     await Notification.createNotification({
//       receiver,
//       sender,
//       type: "new_message",
//       refId: conversationId,
//       refModel: "Conversation",
//     });
//   } catch (err) {
//     console.error("❌ Offline notification save error:", err.message);
//   }
// };

// // ── Main handler ─────────────────────────────────────────────────────────────

// export default (io, socket) => {
//   const userId = (socket.user.id || socket.user._id)?.toString();

//   // ── Rate limiter ────────────────────────────────────────────────────────
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

//   // ── Online tracking ─────────────────────────────────────────────────────
//   if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
//   onlineUsers.get(userId).add(socket.id);

//   socket.broadcast.emit("user:online", { userId });
//   socket.emit("online:list", Array.from(onlineUsers.keys()));

//   // ── notifyUser ──────────────────────────────────────────────────────────
//   const notifyUser = (recipientId, event, payload) => {
//     const sockets = onlineUsers.get(recipientId.toString());
//     if (sockets?.size) {
//       sockets.forEach((sid) => io.to(sid).emit(event, payload));
//     }
//   };

//   // ── getParticipants ─────────────────────────────────────────────────────
//   const getParticipants = async (conversationId) => {
//     const conv = await Conversation.findById(conversationId).lean();
//     return conv?.participants?.map((p) => p.toString()) || [];
//   };

//   // ── isBlocked check ─────────────────────────────────────────────────────
//   const isBlocked = async (userIdA, userIdB) => {
//     const userA = await User.findById(userIdA).select("blockedUsers").lean();
//     const userB = await User.findById(userIdB).select("blockedUsers").lean();
//     const aBlockedB = userA?.blockedUsers?.map(String).includes(String(userIdB));
//     const bBlockedA = userB?.blockedUsers?.map(String).includes(String(userIdA));
//     return aBlockedB || bBlockedA;
//   };

//   // ── Conversation join / leave ───────────────────────────────────────────
//   socket.on("conversation:join", ({ conversationId }) => {
//     if (!conversationId) return;
//     socket.join(conversationId);
//   });

//   socket.on("conversation:leave", ({ conversationId }) => {
//     if (!conversationId) return;
//     socket.leave(conversationId);
//   });

//   // ── Message send ────────────────────────────────────────────────────────
//   socket.on("message:send", async ({ conversationId, message }) => {
//     if (isRateLimited())
//       return socket.emit("error", { message: "Too many messages. Slow down!" });
//     if (!conversationId || !message) return;
//     if (!message.text?.trim() && !message.image && !message.audio) return;
//     if (message.text && message.text.length > 2000)
//       return socket.emit("error", { message: "Message too long." });

//     try {
//       const conv = await Conversation.findById(conversationId).lean();
//       if (!conv) return socket.emit("error", { message: "Conversation not found." });

//       const participants = conv.participants.map((p) => p.toString());
//       if (!participants.includes(userId))
//         return socket.emit("error", { message: "Unauthorized." });

//       const otherParticipant = participants.find((p) => p !== userId);
//       if (otherParticipant) {
//         const blocked = await isBlocked(userId, otherParticipant);
//         if (blocked)
//           return socket.emit("error", { message: "You cannot message this user.", code: "BLOCKED" });
//       }

//       // Reply preview
//       let replyPreview = null;
//       if (message.replyTo) {
//         const parent = await Message.findById(message.replyTo)
//           .select("text image audio isDeleted sender")
//           .lean();
//         if (parent) {
//           replyPreview = {
//             messageId: parent._id,
//             text:      parent.isDeleted ? "" : (parent.text?.slice(0, 100) ?? ""),
//             senderId:  parent.sender,
//             isDeleted: parent.isDeleted ?? false,
//           };
//         }
//       }

//       // Message type
//       let msgType = "text";
//       if (message.audio && !message.text?.trim()) msgType = "audio";
//       else if (message.image && !message.text?.trim()) msgType = "image";

//       const newMsg = await Message.create({
//         conversation: conversationId,
//         sender:       userId,
//         text:         message.text?.trim() || "",
//         image:        message.image || null,
//         audio:        message.audio || null,
//         replyTo:      replyPreview,
//         type:         msgType,
//         seenBy:       [userId],
//       });

//       await newMsg.populate([
//         { path: "sender", select: "fullName username avatar isVerifiedBadge" },
//       ]);

//       await syncLastMessage(conversationId, newMsg);

//       // Unread count increment
//       const incUpdate = {};
//       participants.forEach((pid) => {
//         if (pid !== userId) incUpdate[`unreadCount.${pid}`] = 1;
//       });
//       if (Object.keys(incUpdate).length) {
//         await Conversation.findByIdAndUpdate(conversationId, { $inc: incUpdate });
//       }

//       // Emit message:receive to all participants
//       for (const pid of participants) {
//         if (pid !== userId) {
//           const recipientUser = await User.findById(pid).select("blockedUsers").lean();
//           const recipientBlockedSender = recipientUser?.blockedUsers
//             ?.map(String).includes(String(userId));
//           if (recipientBlockedSender) continue;
//         }
//         notifyUser(pid, "message:receive", {
//           conversationId,
//           message: newMsg,
//           tempId:  message.tempId || null,
//         });
//       }

//       // notification:message — toast ke liye, sender ka fullName + username dono bhejo
//       const preview = newMsg.audio
//         ? "🎙️ Voice message"
//         : newMsg.text
//         ? newMsg.text.length > 60 ? newMsg.text.slice(0, 60) + "…" : newMsg.text
//         : "📷 Image";

//       for (const pid of participants) {
//         if (pid === userId) continue;
//         if (onlineUsers.has(pid)) {
//           notifyUser(pid, "notification:message", {
//             conversationId,
//             sender: {
//               _id:      userId,
//               fullName: newMsg.sender?.fullName  || null,  // ← populated value
//               username: newMsg.sender?.username  || null,  // ← populated value
//               avatar:   newMsg.sender?.avatar    || null,
//             },
//             preview,
//           });
//         } else {
//           await saveOfflineNotification({ receiver: pid, sender: userId, conversationId });
//         }
//       }
//     } catch (err) {
//       console.error("❌ message:send error:", err);
//       socket.emit("error", { message: "Failed to send message." });
//     }
//   });

//   // ── Typing ──────────────────────────────────────────────────────────────
//   socket.on("typing:start", ({ conversationId }) => {
//     if (!conversationId) return;
//     socket.to(conversationId).emit("typing:start", { conversationId, userId });
//   });

//   socket.on("typing:stop", ({ conversationId }) => {
//     if (!conversationId) return;
//     socket.to(conversationId).emit("typing:stop", { conversationId, userId });
//   });

//   // ── Message seen ────────────────────────────────────────────────────────
//   socket.on("message:seen", async ({ conversationId, messageId }) => {
//     if (!conversationId || !messageId) return;
//     try {
//       await Message.findByIdAndUpdate(messageId, { $addToSet: { seenBy: userId } });
//       await Conversation.findByIdAndUpdate(conversationId, {
//         $set: { [`unreadCount.${userId}`]: 0 },
//       });
//       const participants = await getParticipants(conversationId);
//       participants.forEach((pid) => {
//         if (pid !== userId) {
//           notifyUser(pid, "message:seen", { conversationId, messageId, seenBy: userId });
//         }
//       });
//     } catch (err) {
//       console.error("❌ message:seen error:", err);
//     }
//   });

//   // ── Message edit ─────────────────────────────────────────────────────────
//   const EDIT_WINDOW_MS = 15 * 60 * 1000;

//   socket.on("message:edit", async ({ conversationId, messageId, newText }) => {
//     if (!conversationId || !messageId || !newText?.trim()) return;
//     if (newText.trim().length > 2000)
//       return socket.emit("error", { message: "Message too long." });

//     try {
//       const msg = await Message.findById(messageId);
//       if (!msg) return socket.emit("error", { message: "Message not found." });
//       if (msg.isDeleted) return socket.emit("error", { message: "Cannot edit deleted message." });
//       if (msg.sender.toString() !== userId) return socket.emit("error", { message: "Unauthorized." });
//       if (Date.now() - new Date(msg.createdAt).getTime() > EDIT_WINDOW_MS)
//         return socket.emit("error", { message: "Message can only be edited within 15 minutes." });

//       msg.text     = newText.trim();
//       msg.isEdited = true;
//       msg.editedAt = new Date();
//       await msg.save();
//       await syncLastMessage(conversationId, msg);

//       const participants = await getParticipants(conversationId);
//       participants.forEach((pid) => {
//         notifyUser(pid, "message:edited", {
//           conversationId, messageId,
//           newText: msg.text, isEdited: true, editedAt: msg.editedAt,
//         });
//       });
//     } catch (err) {
//       console.error("❌ message:edit error:", err);
//       socket.emit("error", { message: "Failed to edit message." });
//     }
//   });

//   // ── Message delete ───────────────────────────────────────────────────────
//   socket.on("message:delete", async ({ conversationId, messageId }) => {
//     if (!conversationId || !messageId) return;
//     try {
//       const msg = await Message.findById(messageId);
//       if (!msg) return socket.emit("error", { message: "Message not found." });
//       if (msg.isDeleted) return socket.emit("error", { message: "Already deleted." });
//       if (msg.sender.toString() !== userId) return socket.emit("error", { message: "Unauthorized." });

//       msg.isDeleted = true;
//       msg.deletedAt = new Date();
//       msg.text      = "";
//       msg.image     = null;
//       msg.audio     = null;
//       msg.reactions = [];
//       await msg.save();
//       await syncLastMessage(conversationId, msg);

//       const participants = await getParticipants(conversationId);
//       participants.forEach((pid) => {
//         notifyUser(pid, "message:deleted", { conversationId, messageId, deletedBy: userId });
//       });
//     } catch (err) {
//       console.error("❌ message:delete error:", err);
//       socket.emit("error", { message: "Failed to delete message." });
//     }
//   });

//   // ── Emoji reaction ───────────────────────────────────────────────────────
//   socket.on("message:react", async ({ conversationId, messageId, emoji }) => {
//     if (!conversationId || !messageId) return;
//     try {
//       const msg = await Message.findById(messageId);
//       if (!msg || msg.isDeleted) return socket.emit("error", { message: "Message not found." });

//       const existingIdx = msg.reactions.findIndex(
//         (r) => r.user.toString() === userId && r.emoji === emoji
//       );
//       if (existingIdx !== -1) {
//         msg.reactions.splice(existingIdx, 1);
//       } else {
//         msg.reactions = msg.reactions.filter((r) => r.user.toString() !== userId);
//         if (emoji?.trim()) msg.reactions.push({ user: userId, emoji: emoji.trim(), reactedAt: new Date() });
//       }
//       await msg.save();

//       const aggregated   = aggregateReactions(msg.reactions);
//       const participants = await getParticipants(conversationId);
//       participants.forEach((pid) => {
//         notifyUser(pid, "message:reaction", {
//           conversationId, messageId,
//           reactions: aggregated, rawReactions: msg.reactions,
//         });
//       });
//     } catch (err) {
//       console.error("❌ message:react error:", err);
//       socket.emit("error", { message: "Failed to add reaction." });
//     }
//   });

//   // ── Check block status ───────────────────────────────────────────────────
//   socket.on("user:blockStatus", async ({ targetUserId }) => {
//     if (!targetUserId) return;
//     try {
//       const blocked = await isBlocked(userId, targetUserId);
//       const me = await User.findById(userId).select("blockedUsers").lean();
//       const iBlockedThem = me?.blockedUsers?.map(String).includes(String(targetUserId));
//       socket.emit("user:blockStatus", { targetUserId, blocked, iBlockedThem });
//     } catch (err) {
//       console.error("❌ user:blockStatus error:", err);
//     }
//   });

//   // ── Report user ──────────────────────────────────────────────────────────
//   socket.on("user:report", async ({ targetUserId, reason }) => {
//     if (!targetUserId || targetUserId === userId) return;
//     try {
//       await Notification.createNotification({
//         receiver: targetUserId,
//         sender:   userId,
//         type:     "user_report",
//         refId:    targetUserId,
//         refModel: "User",
//         meta:     { reason: reason || "No reason provided" },
//       }).catch(() => {});
//       socket.emit("user:report:success", { targetUserId });
//     } catch (err) {
//       console.error("❌ user:report error:", err);
//       socket.emit("error", { message: "Failed to report user." });
//     }
//   });

//   // ── Online check ─────────────────────────────────────────────────────────
//   socket.on("user:isOnline", ({ targetUserId }) => {
//     socket.emit("user:isOnline", {
//       userId:   targetUserId,
//       isOnline: onlineUsers.has(targetUserId),
//     });
//   });

//   // ── Disconnect ───────────────────────────────────────────────────────────
//   socket.on("disconnect", () => {
//     const sockets = onlineUsers.get(userId);
//     if (sockets) {
//       sockets.delete(socket.id);
//       if (sockets.size === 0) {
//         onlineUsers.delete(userId);
//         io.emit("user:offline", { userId });
//         console.log(`❌ User disconnected: ${userId}`);
//       }
//     }
//   });
// };




// chat-server/socket/Chathandler.js
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import mongoose from "mongoose";

const onlineUsers = new Map(); // userId → Set<socketId>

// ── Helpers ──────────────────────────────────────────────────────────────────

const syncLastMessage = async (conversationId, msg) => {
  try {
    await Conversation.findByIdAndUpdate(conversationId, {
      $set: { lastMessage: msg._id },
    });
  } catch (err) {
    console.error("❌ syncLastMessage error:", err.message);
  }
};

function aggregateReactions(reactions = []) {
  const map = {};
  reactions.forEach(({ emoji, user }) => {
    if (!map[emoji]) map[emoji] = { emoji, count: 0, users: [] };
    map[emoji].count += 1;
    map[emoji].users.push(user.toString());
  });
  return Object.values(map);
}

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
    console.error("❌ Offline notification save error:", err.message);
  }
};

// ── fetchSenderDirect ─────────────────────────────────────────────────────────
// populate() pe kabhi depend mat karo — direct DB query guaranteed naam deta hai
// socialusers aur users dono collections check karta hai
const fetchSenderDirect = async (senderId) => {
  try {
    const oid = new mongoose.Types.ObjectId(senderId.toString());
    const db  = mongoose.connection.db;

    for (const col of ["socialusers", "users"]) {
      const doc = await db.collection(col).findOne(
        { _id: oid },
        { projection: { _id: 1, fullName: 1, username: 1, avatar: 1 } }
      );
      if (doc) {
        console.log(`✅ Sender found in "${col}": ${doc.fullName || doc.username}`);
        return doc;
      }
    }

    console.warn(`⚠️ fetchSenderDirect: sender ${senderId} not found`);
    return null;
  } catch (err) {
    console.error("❌ fetchSenderDirect error:", err.message);
    return null;
  }
};

// ── Main handler ─────────────────────────────────────────────────────────────

export default (io, socket) => {
  const userId = (socket.user.id || socket.user._id)?.toString();

  // ── Rate limiter ────────────────────────────────────────────────────────
  const messageTimestamps = [];
  const isRateLimited = () => {
    const now       = Date.now();
    const windowMs  = 10_000;
    const maxMessages = 10;
    const recent    = messageTimestamps.filter((t) => now - t < windowMs);
    messageTimestamps.length = 0;
    recent.forEach((t) => messageTimestamps.push(t));
    if (recent.length >= maxMessages) return true;
    messageTimestamps.push(now);
    return false;
  };

  // ── Online tracking ─────────────────────────────────────────────────────
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socket.id);
  socket.broadcast.emit("user:online", { userId });
  socket.emit("online:list", Array.from(onlineUsers.keys()));

  // ── notifyUser ──────────────────────────────────────────────────────────
  const notifyUser = (recipientId, event, payload) => {
    const sockets = onlineUsers.get(recipientId.toString());
    if (sockets?.size) {
      sockets.forEach((sid) => io.to(sid).emit(event, payload));
    }
  };

  const getParticipants = async (conversationId) => {
    const conv = await Conversation.findById(conversationId).lean();
    return conv?.participants?.map((p) => p.toString()) || [];
  };

  const isBlocked = async (userIdA, userIdB) => {
    const userA = await User.findById(userIdA).select("blockedUsers").lean();
    const userB = await User.findById(userIdB).select("blockedUsers").lean();
    return (
      userA?.blockedUsers?.map(String).includes(String(userIdB)) ||
      userB?.blockedUsers?.map(String).includes(String(userIdA))
    );
  };

  // ── Conversation join / leave ───────────────────────────────────────────
  socket.on("conversation:join",  ({ conversationId }) => conversationId && socket.join(conversationId));
  socket.on("conversation:leave", ({ conversationId }) => conversationId && socket.leave(conversationId));

  // ── Message send ────────────────────────────────────────────────────────
  socket.on("message:send", async ({ conversationId, message }) => {
    if (isRateLimited())
      return socket.emit("error", { message: "Too many messages. Slow down!" });
    if (!conversationId || !message) return;
    if (!message.text?.trim() && !message.image && !message.audio) return;
    if (message.text && message.text.length > 2000)
      return socket.emit("error", { message: "Message too long." });

    try {
      const conv = await Conversation.findById(conversationId).lean();
      if (!conv) return socket.emit("error", { message: "Conversation not found." });

      const participants = conv.participants.map((p) => p.toString());
      if (!participants.includes(userId))
        return socket.emit("error", { message: "Unauthorized." });

      const otherParticipant = participants.find((p) => p !== userId);
      if (otherParticipant) {
        const blocked = await isBlocked(userId, otherParticipant);
        if (blocked)
          return socket.emit("error", { message: "You cannot message this user.", code: "BLOCKED" });
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

      // Message create — sender sirf ObjectId save hoga
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

      // ── Direct DB query — populate pe BILKUL depend mat karo ─────────────
      const senderDoc = await fetchSenderDirect(userId);
      const senderObj = {
        _id:      userId,
        fullName: senderDoc?.fullName || null,
        username: senderDoc?.username || null,
        avatar:   senderDoc?.avatar   || null,
      };

      // Plain object banao emit ke liye — Mongoose document nahi
      const msgToEmit = {
        ...newMsg.toObject(),
        sender: senderObj,   // ← populated sender replace karo
      };

      await syncLastMessage(conversationId, newMsg);

      // Unread count increment
      const incUpdate = {};
      participants.forEach((pid) => {
        if (pid !== userId) incUpdate[`unreadCount.${pid}`] = 1;
      });
      if (Object.keys(incUpdate).length) {
        await Conversation.findByIdAndUpdate(conversationId, { $inc: incUpdate });
      }

      // ── message:receive emit — sab participants ko ────────────────────
      for (const pid of participants) {
        if (pid !== userId) {
          const recipientUser = await User.findById(pid).select("blockedUsers").lean();
          if (recipientUser?.blockedUsers?.map(String).includes(String(userId))) continue;
        }
        notifyUser(pid, "message:receive", {
          conversationId,
          message: msgToEmit,   // plain object with sender.fullName
          tempId:  message.tempId || null,
        });
      }

      // ── notification:message — toast ke liye (online users only) ─────
      const preview = newMsg.audio
        ? "🎙️ Voice message"
        : newMsg.text
        ? newMsg.text.length > 60 ? newMsg.text.slice(0, 60) + "…" : newMsg.text
        : "📷 Image";

      for (const pid of participants) {
        if (pid === userId) continue;
        if (onlineUsers.has(pid)) {
          notifyUser(pid, "notification:message", {
            conversationId,
            sender:  senderObj,   // fullName + username guaranteed
            preview,
          });
        } else {
          await saveOfflineNotification({ receiver: pid, sender: userId, conversationId });
        }
      }
    } catch (err) {
      console.error("❌ message:send error:", err);
      socket.emit("error", { message: "Failed to send message." });
    }
  });

  // ── Typing ──────────────────────────────────────────────────────────────
  socket.on("typing:start", ({ conversationId }) => {
    if (!conversationId) return;
    socket.to(conversationId).emit("typing:start", { conversationId, userId });
  });

  socket.on("typing:stop", ({ conversationId }) => {
    if (!conversationId) return;
    socket.to(conversationId).emit("typing:stop", { conversationId, userId });
  });

  // ── Message seen ────────────────────────────────────────────────────────
  socket.on("message:seen", async ({ conversationId, messageId }) => {
    if (!conversationId || !messageId) return;
    try {
      await Message.findByIdAndUpdate(messageId, { $addToSet: { seenBy: userId } });
      await Conversation.findByIdAndUpdate(conversationId, {
        $set: { [`unreadCount.${userId}`]: 0 },
      });
      const participants = await getParticipants(conversationId);
      participants.forEach((pid) => {
        if (pid !== userId)
          notifyUser(pid, "message:seen", { conversationId, messageId, seenBy: userId });
      });
    } catch (err) {
      console.error("❌ message:seen error:", err);
    }
  });

  // ── Message edit ─────────────────────────────────────────────────────────
  const EDIT_WINDOW_MS = 15 * 60 * 1000;

  socket.on("message:edit", async ({ conversationId, messageId, newText }) => {
    if (!conversationId || !messageId || !newText?.trim()) return;
    if (newText.trim().length > 2000)
      return socket.emit("error", { message: "Message too long." });
    try {
      const msg = await Message.findById(messageId);
      if (!msg)                             return socket.emit("error", { message: "Message not found." });
      if (msg.isDeleted)                    return socket.emit("error", { message: "Cannot edit deleted message." });
      if (msg.sender.toString() !== userId) return socket.emit("error", { message: "Unauthorized." });
      if (Date.now() - new Date(msg.createdAt).getTime() > EDIT_WINDOW_MS)
        return socket.emit("error", { message: "Message can only be edited within 15 minutes." });

      msg.text = newText.trim(); msg.isEdited = true; msg.editedAt = new Date();
      await msg.save();
      await syncLastMessage(conversationId, msg);

      const participants = await getParticipants(conversationId);
      participants.forEach((pid) => {
        notifyUser(pid, "message:edited", {
          conversationId, messageId,
          newText: msg.text, isEdited: true, editedAt: msg.editedAt,
        });
      });
    } catch (err) {
      console.error("❌ message:edit error:", err);
      socket.emit("error", { message: "Failed to edit message." });
    }
  });

  // ── Message delete ───────────────────────────────────────────────────────
  socket.on("message:delete", async ({ conversationId, messageId }) => {
    if (!conversationId || !messageId) return;
    try {
      const msg = await Message.findById(messageId);
      if (!msg)                             return socket.emit("error", { message: "Message not found." });
      if (msg.isDeleted)                    return socket.emit("error", { message: "Already deleted." });
      if (msg.sender.toString() !== userId) return socket.emit("error", { message: "Unauthorized." });

      msg.isDeleted = true; msg.deletedAt = new Date();
      msg.text = ""; msg.image = null; msg.audio = null; msg.reactions = [];
      await msg.save();
      await syncLastMessage(conversationId, msg);

      const participants = await getParticipants(conversationId);
      participants.forEach((pid) => {
        notifyUser(pid, "message:deleted", { conversationId, messageId, deletedBy: userId });
      });
    } catch (err) {
      console.error("❌ message:delete error:", err);
      socket.emit("error", { message: "Failed to delete message." });
    }
  });

  // ── Emoji reaction ───────────────────────────────────────────────────────
  socket.on("message:react", async ({ conversationId, messageId, emoji }) => {
    if (!conversationId || !messageId) return;
    try {
      const msg = await Message.findById(messageId);
      if (!msg || msg.isDeleted) return socket.emit("error", { message: "Message not found." });

      const existingIdx = msg.reactions.findIndex(
        (r) => r.user.toString() === userId && r.emoji === emoji
      );
      if (existingIdx !== -1) {
        msg.reactions.splice(existingIdx, 1);
      } else {
        msg.reactions = msg.reactions.filter((r) => r.user.toString() !== userId);
        if (emoji?.trim()) msg.reactions.push({ user: userId, emoji: emoji.trim(), reactedAt: new Date() });
      }
      await msg.save();

      const aggregated   = aggregateReactions(msg.reactions);
      const participants = await getParticipants(conversationId);
      participants.forEach((pid) => {
        notifyUser(pid, "message:reaction", {
          conversationId, messageId,
          reactions: aggregated, rawReactions: msg.reactions,
        });
      });
    } catch (err) {
      console.error("❌ message:react error:", err);
      socket.emit("error", { message: "Failed to add reaction." });
    }
  });

  // ── Block status ─────────────────────────────────────────────────────────
  socket.on("user:blockStatus", async ({ targetUserId }) => {
    if (!targetUserId) return;
    try {
      const blocked = await isBlocked(userId, targetUserId);
      const me = await User.findById(userId).select("blockedUsers").lean();
      const iBlockedThem = me?.blockedUsers?.map(String).includes(String(targetUserId));
      socket.emit("user:blockStatus", { targetUserId, blocked, iBlockedThem });
    } catch (err) {
      console.error("❌ user:blockStatus error:", err);
    }
  });

  // ── Report user ──────────────────────────────────────────────────────────
  socket.on("user:report", async ({ targetUserId, reason }) => {
    if (!targetUserId || targetUserId === userId) return;
    try {
      await Notification.createNotification({
        receiver: targetUserId, sender: userId,
        type: "user_report", refId: targetUserId, refModel: "User",
        meta: { reason: reason || "No reason provided" },
      }).catch(() => {});
      socket.emit("user:report:success", { targetUserId });
    } catch (err) {
      console.error("❌ user:report error:", err);
      socket.emit("error", { message: "Failed to report user." });
    }
  });

  // ── Online check ─────────────────────────────────────────────────────────
  socket.on("user:isOnline", ({ targetUserId }) => {
    socket.emit("user:isOnline", {
      userId:   targetUserId,
      isOnline: onlineUsers.has(targetUserId),
    });
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsers.delete(userId);
        io.emit("user:offline", { userId });
        console.log(`❌ User disconnected: ${userId}`);
      }
    }
  });
};