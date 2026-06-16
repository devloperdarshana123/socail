import express from "express";
import { isAdminAuthenticated } from "../../middlewares/authenticateAdmin.js";
import {
  getAuditLogs,
  getAuditLogById,
  getAuditStats,
  getAuditActionConstants,
} from "../../controllers/admin/admin.auditlog.controller.js";

const router = express.Router();

// ── All audit routes: must be logged-in admin ─────────────────────────────
router.use(isAdminAuthenticated);

// Order matters — specific routes before :id

// GET /api/v2/admin/audit-logs/constants  — valid actions + categories
router.get("/constants", getAuditActionConstants);

// GET /api/v2/admin/audit-logs/stats      — category breakdown + daily activity
router.get("/stats", getAuditStats);

// GET /api/v2/admin/audit-logs            — paginated list with filters
router.get("/", getAuditLogs);

// GET /api/v2/admin/audit-logs/:id        — single log detail
router.get("/:id", getAuditLogById);

export default router;
