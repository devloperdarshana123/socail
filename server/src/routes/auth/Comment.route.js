// import express from "express";
// import { isAuthenticated, isActive } from "../../middlewares/auth.js";
// import {
//   addComment,
//   getComments,
//   getReplies,
//   deleteComment,
// } from "../../controllers/auth/comment.controller.js";

// const router = express.Router();
// router.use(isAuthenticated, isActive);

// router.post("/post/:postId", addComment);               // Add comment
// router.get("/post/:postId", getComments);               // Get comments (paginated)
// router.get("/:commentId/replies", getReplies);          // Get replies
// router.delete("/:commentId", deleteComment);            // Delete comment

// export default router;


import express from "express";
import { isAuthenticated, isActive } from "../../middlewares/auth.js";
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

router.post("/post/:postId",              addComment);         // Add comment or reply
router.get("/post/:postId",               getComments);        // Top-level comments (cursor)
router.get("/:commentId/replies",         getReplies);         // All replies under root comment
router.get("/:commentId/direct-replies",  getDirectReplies);   // Direct replies to a comment
router.delete("/:commentId",              deleteComment);      // Soft delete (hard for admin)
router.patch("/:commentId/pin",           pinComment);         // Pin comment (post author only)
router.patch("/:commentId/unpin",         unpinComment);       // Unpin comment (post author only)

export default router;