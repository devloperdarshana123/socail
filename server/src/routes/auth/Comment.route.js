import express from "express";
import { isAuthenticated, isActive } from "../../middlewares/auth.js";
import {
  addComment,
  getComments,
  getReplies,
  deleteComment,
} from "../../controllers/auth/comment.controller.js";

const router = express.Router();
router.use(isAuthenticated, isActive);

router.post("/post/:postId", addComment);               // Add comment
router.get("/post/:postId", getComments);               // Get comments (paginated)
router.get("/:commentId/replies", getReplies);          // Get replies
router.delete("/:commentId", deleteComment);            // Delete comment

export default router;