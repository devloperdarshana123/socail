
// import express from "express";
// import { isAuthenticated } from "../../middlewares/auth.js";
// import {
//   getConversations,
//   getOrCreateConversation,
//   getMessages,
//   sendMessage,
//   editMessage,
//   deleteMessage,
//   markConversationRead,
//   getTotalUnreadCount,
//   reactToMessage,
//   deleteConversation,
//    clearChat, 
// } from "../../controllers/auth/message.controller.js";

// const router = express.Router();

// // All chat routes require authentication
// router.use(isAuthenticated);

// // ── Conversations ──────────────────────────────────────────────────────────
// router.get("/conversations", getConversations);
// router.post("/conversations", getOrCreateConversation);

// // ⚠️ IMPORTANT: Static routes pehle, dynamic baad mein
// // "unread-count" ko /:conversationId se pehle rakhna zaroori hai
// // warna Express "unread-count" ko conversationId samajh leta
// router.get("/conversations/unread-count", getTotalUnreadCount);
// router.patch("/conversations/:conversationId/read", markConversationRead);
// router.delete("/conversations/:conversationId", deleteConversation); // ← missing tha

// // ── Messages ───────────────────────────────────────────────────────────────
// router.get("/conversations/:conversationId/messages", getMessages);
// router.post("/messages", sendMessage);
// router.patch("/messages/:messageId", editMessage);
// router.delete("/messages/:messageId", deleteMessage);
// router.delete("/conversations/:conversationId/clear", clearChat);
// router.patch("/messages/:messageId/react", reactToMessage); // ← missing tha

// export default router;



import express from "express";
import { isAuthenticated } from "../../middlewares/auth.js";
import {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markConversationRead,
  getTotalUnreadCount,
  reactToMessage,
  deleteConversation,
   clearChat, 
} from "../../controllers/auth/message.controller.js";

import {
  createGroupConversation,
  addGroupMember,
  removeGroupMember,
  leaveGroup,
  renameGroup,
  transferGroupAdmin,
  disbandGroupConversation,
} from "../../controllers/auth/group.controller.js";

const router = express.Router();

// All chat routes require authentication
router.use(isAuthenticated);

// ── Conversations ──────────────────────────────────────────────────────────
router.get("/conversations", getConversations);
router.post("/conversations", getOrCreateConversation);

// ⚠️ IMPORTANT: Static routes pehle, dynamic baad mein
// "unread-count" ko /:conversationId se pehle rakhna zaroori hai
// warna Express "unread-count" ko conversationId samajh leta
router.get("/conversations/unread-count", getTotalUnreadCount);
router.patch("/conversations/:conversationId/read", markConversationRead);
router.delete("/conversations/:conversationId", deleteConversation); // ← missing tha

// ── Messages ───────────────────────────────────────────────────────────────
router.get("/conversations/:conversationId/messages", getMessages);
router.post("/messages", sendMessage);
router.patch("/messages/:messageId", editMessage);
router.delete("/messages/:messageId", deleteMessage);
router.delete("/conversations/:conversationId/clear", clearChat);
router.patch("/messages/:messageId/react", reactToMessage); // ← missing tha

// ── Groups ───────────────────────────────────────────────────────────────────
// ⚠️ "/conversations/group" literal segment hai isliye yeh "/conversations/:conversationId"
// jaisi routes se conflict nahi karega (different segment count + different methods)
router.post("/conversations/group", createGroupConversation);
router.patch("/conversations/group/:conversationId/add", addGroupMember);
router.patch("/conversations/group/:conversationId/remove", removeGroupMember);
router.patch("/conversations/group/:conversationId/leave", leaveGroup);
router.patch("/conversations/group/:conversationId/rename", renameGroup);
router.patch("/conversations/group/:conversationId/transfer-admin", transferGroupAdmin);
router.delete("/conversations/group/:conversationId", disbandGroupConversation);

export default router;