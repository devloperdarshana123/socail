// import express from "express";
// import { isAuthenticated, isAdmin } from "../../middlewares/auth.js";
// import {
//   getAllUsers,
//   getUserById,
//   getUserPosts,
//   getUserReports,
//   updateUserStatus,
//   deleteUserAccount,
//   deletePost,
//   toggleVerifiedBadge,
//   getDashboardStats,
//   getAllPosts,
// } from "../../controllers/admin/admin.user.controller.js";
// import {
//   getAllReports,
//   getReportById,
//   updateReportStatus,
//   bulkUpdateReports,
//   getReportStats,
// } from "../../controllers/admin/admin.report.controller.js";

// const router = express.Router();

// // ── All routes protected: must be logged in + super_admin ────
// router.use(isAuthenticated, isAdmin);

// // ── Dashboard ────────────────────────────────────────────────
// router.get("/stats", getDashboardStats);

// // ── Users ────────────────────────────────────────────────────
// router.get("/users",             getAllUsers);
// router.get("/users/:id",         getUserById);
// router.get("/users/:id/posts",   getUserPosts);
// router.get("/users/:id/reports", getUserReports);

// // ── User Actions ─────────────────────────────────────────────
// router.patch("/users/:id/status",       updateUserStatus);
// router.patch("/users/:id/verify-badge", toggleVerifiedBadge);
// router.delete("/users/:id",             deleteUserAccount);

// // ── Posts ────────────────────────────────────────────────────
// router.get("/posts",           getAllPosts);
// router.delete("/posts/:postId", deletePost);

// // ── Reports ──────────────────────────────────────────────────
// router.get("/reports/stats",        getReportStats);       // before /:id
// router.get("/reports",              getAllReports);
// router.get("/reports/:id",          getReportById);
// router.patch("/reports/bulk",       bulkUpdateReports);    // before /:id
// router.patch("/reports/:id/status", updateReportStatus);

// export default router;


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
  getAllPosts,
} from "../../controllers/admin/admin.user.controller.js";
import {
  getAllReports,
  getReportById,
  updateReportStatus,
  bulkUpdateReports,
  getReportStats,
} from "../../controllers/admin/admin.report.controller.js";
import {
  getAllComments,
  getCommentStats,
  getCommentById,
  updateCommentStatus,
  deleteComment,
  bulkUpdateComments,
} from "../../controllers/admin/admin.comment.controller.js";

const router = express.Router();

// ── All routes protected: must be logged in + super_admin ────
router.use(isAuthenticated, isAdmin);

// ── Dashboard ────────────────────────────────────────────────
router.get("/stats", getDashboardStats);

// ── Users ────────────────────────────────────────────────────
router.get("/users",             getAllUsers);
router.get("/users/:id",         getUserById);
router.get("/users/:id/posts",   getUserPosts);
router.get("/users/:id/reports", getUserReports);

// ── User Actions ─────────────────────────────────────────────
router.patch("/users/:id/status",       updateUserStatus);
router.patch("/users/:id/verify-badge", toggleVerifiedBadge);
router.delete("/users/:id",             deleteUserAccount);

// ── Posts ────────────────────────────────────────────────────
router.get("/posts",            getAllPosts);
router.delete("/posts/:postId", deletePost);

// ── Reports ──────────────────────────────────────────────────
router.get("/reports/stats",        getReportStats);       // before /:id
router.get("/reports",              getAllReports);
router.get("/reports/:id",          getReportById);
router.patch("/reports/bulk",       bulkUpdateReports);    // before /:id
router.patch("/reports/:id/status", updateReportStatus);

// ── Comments ──────────────────────────────────────────────────
router.get("/comments/stats",        getCommentStats);     // before /:id
router.get("/comments",              getAllComments);
router.patch("/comments/bulk",       bulkUpdateComments);  // before /:id
router.get("/comments/:id",          getCommentById);
router.patch("/comments/:id/status", updateCommentStatus);
router.delete("/comments/:id",       deleteComment);

export default router;