// src/routes/admin/Admin.dashboard.route.js
import express from "express";
import {
  getDashboardStats,
  getUserGrowth,
  getPostGrowth,
  getEngagementTrend,
  getTopPosts,
  getHourlyActivity,
} from "../../controllers/admin/admin.dashboard.controller.js";
import { isAdminAuthenticated } from "../../middlewares/authenticateAdmin.js";

const router = express.Router();

// ─────────────────────────────────────────────
//  Protected Routes — isAuthenticated + isAdmin
// ─────────────────────────────────────────────

router.get("/stats",           isAdminAuthenticated, getDashboardStats);
router.get("/user-growth",     isAdminAuthenticated, getUserGrowth);
router.get("/post-growth",     isAdminAuthenticated, getPostGrowth);
router.get("/engagement",      isAdminAuthenticated, getEngagementTrend);
router.get("/top-posts",       isAdminAuthenticated, getTopPosts);
router.get("/hourly-activity", isAdminAuthenticated, getHourlyActivity);

export default router;
