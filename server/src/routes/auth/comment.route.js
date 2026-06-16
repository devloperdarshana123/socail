

import express from "express";
import { isAuthenticated, isActive } from "../../middlewares/auth.js";
import { commentLimiter } from "../../middlewares/rateLimiter.js";
import {
  addComment,
  getComments,
  getReplies,
  getDirectReplies,
  deleteComment,
  pinComment,
  unpinComment,
} from "../../controllers/auth/comment.controller.js";

const router = express.Router();
router.use(isAuthenticated, isActive);

router.post("/post/:postId", commentLimiter   ,          addComment);         // Add comment or reply
router.get("/post/:postId",               getComments);        // Top-level comments (cursor)
router.get("/:commentId/replies",         getReplies);         // All replies under root comment
router.get("/:commentId/direct-replies",  getDirectReplies);   // Direct replies to a comment
router.delete("/:commentId",  commentLimiter  ,          deleteComment);      // Soft delete (hard for admin)
router.patch("/:commentId/pin",           pinComment);         // Pin comment (post author only)
router.patch("/:commentId/unpin",         unpinComment);       // Unpin comment (post author only)

export default router;