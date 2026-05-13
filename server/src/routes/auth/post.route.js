import express from "express";
import upload from "../../middlewares/upload.js";
import { isAuthenticated , isActive} from "../../middlewares/auth.js";
import {
  createPost,
  getPost,
  getFeedPosts,
  getUserPosts,
  deletePost,
  getPostInteraction,
  recordView,
  getDraftPosts,   // ← add
  publishDraft,
} from "../../controllers/auth/post.controller.js";

const router = express.Router();

// ── All routes protected ──
router.use(isAuthenticated, isActive);
// ── Post CRUD ──
router.post("/", upload.array("media", 10), createPost);   // Create post
router.get("/feed", getFeedPosts);     
router.get("/drafts", getDraftPosts);                      // Feed
router.get("/user/:userId", getUserPosts);  
router.post("/:postId/view", recordView);
router.get("/:postId/interaction", getPostInteraction);                // Profile grid
router.get("/:postId", getPost);                            // Single post
router.delete("/:postId", deletePost); 
router.patch("/:postId/publish", publishDraft);   
            

export default router;