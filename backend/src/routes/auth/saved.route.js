

import express from "express";
import { isAuthenticated, isActive } from "../../middlewares/auth.js";
import {
  toggleSave,
  getSavedPosts,
  getSaveStatus,
  getBulkSaveStatus,
} from "../../controllers/auth/saved.controller.js";
import { generalLimiter } from "../../middlewares/rateLimiter.js";
const router = express.Router();
router.use(isAuthenticated, isActive);

router.get("/",                  getSavedPosts);
router.get("/:postId/status",    getSaveStatus);
router.post("/status/bulk",   generalLimiter,   getBulkSaveStatus);  // specific FIRST
router.post("/:postId",  generalLimiter ,       toggleSave);

export default router;