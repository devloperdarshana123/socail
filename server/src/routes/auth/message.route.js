
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
} from "../../controllers/auth/Message.controller.js";

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
router.patch("/messages/:messageId/react", reactToMessage); // ← missing tha

export default router;