import express from "express";
import upload from "../../middlewares/upload.js";
import { isAuthenticated, isActive } from "../../middlewares/auth.js";
import { uploadRateLimiter } from "../../middlewares/rateLimit.js";
import { createPostLimiter, generalLimiter } from "../../middlewares/rateLimiter.js"; 
import {
  createPost,
  getPost,
  getFeedPosts,
  getUserPosts,
  deletePost,
  getPostInteraction,
  recordView,
  getDraftPosts,
  publishDraft,
  updatePost,
} from "../../controllers/auth/post.controller.js";

const router = express.Router();

router.use(isAuthenticated, isActive);

// ── Specific routes PEHLE ──
router.post("/", createPostLimiter,createPost);
router.get("/feed", getFeedPosts);
router.get("/drafts", getDraftPosts);
router.get("/user/:userId", getUserPosts);

// ── Param routes — specific pehle, generic baad mein ──
router.post("/:postId/view",generalLimiter, recordView);
router.get("/:postId/interaction", getPostInteraction);
router.patch("/:postId/publish", publishDraft);
router.get("/:postId", getPost);
router.delete("/:postId", deletePost);
router.patch("/:postId", updatePost);

export default router;