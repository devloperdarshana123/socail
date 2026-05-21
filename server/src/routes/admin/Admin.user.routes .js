import express from "express";
import { isAuthenticated, isAdmin } from "../../middlewares/auth.js";
import {
  getAllUsers,
  getUserById,
  getUserPosts,
  getUserReports,
  updateUserStatus,
  deleteUserAccount,
  deletePost,
  toggleVerifiedBadge,
  getDashboardStats,
} from "../../controllers/admin/admin.user.controller.js";

const router = express.Router();

// ── All routes protected: must be logged in + super_admin ────
router.use(isAuthenticated, isAdmin);

// ── Dashboard ────────────────────────────────────────────────
router.get("/stats", getDashboardStats);

// ── Users ────────────────────────────────────────────────────
router.get("/users",              getAllUsers);
router.get("/users/:id",          getUserById);
router.get("/users/:id/posts",    getUserPosts);
router.get("/users/:id/reports",  getUserReports);

// ── User Actions ─────────────────────────────────────────────
router.patch("/users/:id/status",       updateUserStatus);
router.patch("/users/:id/verify-badge", toggleVerifiedBadge);
router.delete("/users/:id",             deleteUserAccount);

// ── Post Actions ─────────────────────────────────────────────
router.delete("/posts/:postId", deletePost);

export default router;