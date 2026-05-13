// ── like.route.js ──
import express from "express";
import { isAuthenticated, isActive } from "../../middlewares/auth.js";
import {
  togglePostLike,
  toggleCommentLike,
  getPostLikeStatus,
  getPostLikers,
} from "../../controllers/auth/like.controller.js";

const router = express.Router();
router.use(isAuthenticated, isActive);

router.post("/post/:postId", togglePostLike);           // Toggle like on post
router.post("/comment/:commentId", toggleCommentLike);  // Toggle like on comment
router.get("/post/:postId/status", getPostLikeStatus);  // Check like status
router.get("/post/:postId/likers", getPostLikers);      // Get likers list

export default router;