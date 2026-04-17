

import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  getOrCreateConversation,
  getMyConversations,
  getFollowingForMessages,
  getMessages,
  sendMessage,
  deleteMessage,
  getTotalUnread,
} from "../controllers/message.controller.js";

const router = express.Router();

router.get   ("/",                          protect, getMyConversations);
router.get   ("/unread",                    protect, getTotalUnread);
router.get   ("/following",                 protect, getFollowingForMessages);   // ← NEW
router.post  ("/with/:userId",              protect, getOrCreateConversation);
router.get   ("/:conversationId/messages",  protect, getMessages);
router.post  ("/:conversationId/messages",  protect, sendMessage);
router.delete("/messages/:messageId",       protect, deleteMessage);

export default router;