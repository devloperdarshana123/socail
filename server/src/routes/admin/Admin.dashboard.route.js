// src/routes/admin/Admin.dashboard.route.js
import express from "express";
import {
  getDashboardStats,
  getUserGrowth,
  getPostGrowth,
  getEngagementTrend,
  getTopPosts,
  getHourlyActivity,
} from "../../controllers/admin/Admin.dashboard.controller.js";
import { isAuthenticated, isAdmin } from "../../middlewares/auth.js";

const router = express.Router();

// ─────────────────────────────────────────────
//  Protected Routes — isAuthenticated + isAdmin
// ─────────────────────────────────────────────

router.get("/stats",           isAuthenticated, isAdmin, getDashboardStats);
router.get("/user-growth",     isAuthenticated, isAdmin, getUserGrowth);
router.get("/post-growth",     isAuthenticated, isAdmin, getPostGrowth);
router.get("/engagement",      isAuthenticated, isAdmin, getEngagementTrend);
router.get("/top-posts",       isAuthenticated, isAdmin, getTopPosts);
router.get("/hourly-activity", isAuthenticated, isAdmin, getHourlyActivity);

export default router;