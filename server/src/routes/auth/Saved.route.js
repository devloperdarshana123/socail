import express from "express";
import { isAuthenticated, isActive } from "../../middlewares/auth.js";
import {
  toggleSave,
  getSavedPosts,
  getSaveStatus,
} from "../../controllers/auth/saved.controller.js";

const router = express.Router();
router.use(isAuthenticated, isActive);

router.post("/:postId", toggleSave);           // Toggle save
router.get("/", getSavedPosts);                // Get all saved posts
router.get("/:postId/status", getSaveStatus);  // Check save status

export default router;