

import express from "express";
import multer from "multer";
import {
  createPost,
  getFeed,
  getExplore,
  getPost,
  likePost,
  addComment,
  deleteComment,
  savePost,
  getSavedPosts,
  deletePost,
  suspendPost,
  unsuspendPost,
  getMyPosts,
  getTrendingPosts,
  searchPosts,
  getUserPosts,
  likeComment, replyToComment, likeReply , deleteReply,
} from "../controllers/post.controller.js";
import { protect, superAdminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ── Special Routes (MUST be before /:id) ─────────────────────────────────────
router.get("/feed",     protect, getFeed);
router.get("/explore",  protect, getExplore);
router.get("/my",       protect, getMyPosts);
router.get("/user/:userId", protect, getUserPosts);
router.get("/trending", protect, getTrendingPosts);
router.get("/search",   protect, searchPosts);
router.get("/saved",    protect, getSavedPosts);

// ── Single Post ───────────────────────────────────────────────────────────────
router.get("/:id", protect, getPost);

// ── Post CRUD ─────────────────────────────────────────────────────────────────
router.post("/",          protect, upload.single("media"), createPost);
router.delete("/:id",     protect, deletePost);

// ── Like, Save, Comment ───────────────────────────────────────────────────────
router.put("/:id/like",                      protect, likePost);
router.put("/:id/save",                      protect, savePost);
router.post("/:id/comment",                  protect, addComment);
router.delete("/:postId/comment/:commentId", protect, deleteComment);

// Comment like/reply routes
router.put("/:postId/comments/:commentId/like", protect, likeComment);
router.post("/:postId/comments/:commentId/reply", protect, replyToComment);
router.put("/:postId/comments/:commentId/replies/:replyId/like", protect, likeReply);
router.delete("/:postId/comments/:commentId/replies/:replyId",         protect, deleteReply); 

// ── Admin Routes ──────────────────────────────────────────────────────────────
router.put("/:id/suspend",   protect, superAdminOnly, suspendPost);
router.put("/:id/unsuspend", protect, superAdminOnly, unsuspendPost);

export default router;