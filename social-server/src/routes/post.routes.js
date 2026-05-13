

import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";

import {
  createPost,
  getPost,
  getFeed,
  explorePosts,
  getUserPosts,
  deletePost,
  toggleLike,
  toggleSave,
  getSavedPosts,
  addComment,
  deleteComment,
  addReply,
  toggleCommentLike,
  searchByTag,
  suspendPost,
    getMyPosts,
} from "../controllers/post.controller.js";

import { protect, adminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });   // buffer — Cloudinary ke liye

const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      20,
  message:  { success: false, message: "Too many post requests. Slow down." },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ─────────────────────────────────────────────────────────────────────────────
// Special Routes — MUST be before /:postId
// ─────────────────────────────────────────────────────────────────────────────
router.get("/my",            protect, getMyPosts); 
router.get("/feed",          protect, getFeed);
router.get("/explore",       protect, explorePosts);
router.get("/saved",         protect, getSavedPosts);
router.get("/search",        protect, searchByTag);           // ?tag=marble
router.get("/user/:userId",  protect, getUserPosts);

// ─────────────────────────────────────────────────────────────────────────────
// Post CRUD
// ─────────────────────────────────────────────────────────────────────────────

router.post("/",          protect, postLimiter, upload.array("media", 10), createPost);
router.get ("/:postId",   protect, getPost);
router.delete("/:postId", protect, deletePost);

// ─────────────────────────────────────────────────────────────────────────────
// Engagement
// ─────────────────────────────────────────────────────────────────────────────

router.put("/:postId/like", protect, toggleLike);
router.put("/:postId/save", protect, toggleSave);

// Comments
router.post  ("/:postId/comments",                          protect, addComment);
router.delete("/:postId/comments/:commentId",               protect, deleteComment);
router.put   ("/:postId/comments/:commentId/like",          protect, toggleCommentLike);

// Replies
router.post  ("/:postId/comments/:commentId/replies",       protect, addReply);

// ─────────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────────

router.put("/:postId/suspend", protect, adminOnly, suspendPost);

export default router;