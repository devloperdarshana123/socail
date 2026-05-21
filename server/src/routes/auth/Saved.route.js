import express from "express";
import { isAuthenticated, isActive } from "../../middlewares/auth.js";
import {
  toggleSave,
  getSavedPosts,
  getSaveStatus,
} from "../../controllers/auth/saved.controller.js";

const router = express.Router();
router.use(isAuthenticated, isActive);
router.get("/", getSavedPosts);  
router.get("/:postId/status", getSaveStatus);

router.post("/:postId", toggleSave);   // Check save status

export default router;