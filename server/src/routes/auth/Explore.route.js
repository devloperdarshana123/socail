import express from "express";
import { getExplorePosts, searchPosts ,getPublicProfile } from "../../controllers/auth/Explore.controller.js";
import { isAuthenticated, isActive } from "../../middlewares/auth.js";

const router = express.Router();

// Saare explore routes — login + active user only
router.use(isAuthenticated, isActive);

// ── Explore feed ─────────────────────────────
// GET /api/v2/explore/posts?cursor=...&limit=24&type=all
router.get("/posts", getExplorePosts);

// ── Search posts ─────────────────────────────
// GET /api/v2/explore/search?q=marble&cursor=...
router.get("/search", searchPosts);
router.get("/user/:username", getPublicProfile);

export default router;