// backend/src/routes/admin/Admin.comment.routes.js
import express from "express";
import { isAdminAuthenticated } from "../../middlewares/authenticateAdmin.js";
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
router.use(isAdminAuthenticated);

// ── Stats ─────────────────────────────────────────────────────
router.get("/stats", getCommentStats);          // GET  /admin/comments/stats

// ── List ──────────────────────────────────────────────────────
router.get("/",      getAllComments);            // GET  /admin/comments

// ── Bulk (before /:id to avoid conflict) ─────────────────────
router.patch("/bulk", bulkUpdateComments);       // PATCH /admin/comments/bulk

// ── Single comment ────────────────────────────────────────────
router.get(   "/:id",        getCommentById);       // GET   /admin/comments/:id
router.patch( "/:id/status", updateCommentStatus);  // PATCH /admin/comments/:id/status
router.delete("/:id",        deleteComment);        // DELETE /admin/comments/:id

export default router;
