

import express from "express";
import multer from "multer";
import { protect } from "../middleware/auth.middleware.js";

import {
  getOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage,
  deleteMessage,
  editMessage,
  deleteConversation,
  reactToMessage,
   getTotalUnread,
    getFollowingForMessages,
} from "../controllers/message.controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ─────────────────────────────────────────────────────────────────────────────
// Conversations
// ─────────────────────────────────────────────────────────────────────────────

router.get  ("/",               protect, getConversations);
router.post ("/with/:userId",   protect, getOrCreateConversation);
router.delete("/:conversationId", protect, deleteConversation);
router.get("/following", protect, getFollowingForMessages);

// ─────────────────────────────────────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────────────────────────────────────

router.get   ("/:conversationId/messages", protect, getMessages);
router.post  ("/:conversationId/messages", protect, upload.single("media"), sendMessage);
router.get("/unread", protect, getTotalUnread); 

// ─────────────────────────────────────────────────────────────────────────────
// Message Actions
// ─────────────────────────────────────────────────────────────────────────────

router.put   ("/messages/:messageId/edit",    protect, editMessage);
router.put   ("/messages/:messageId/react",   protect, reactToMessage);
router.delete("/messages/:messageId",         protect, deleteMessage);  // body: { deleteFor: "me" | "everyone" }

export default router;