// import express from "express";
// import { isAuthenticated, isAdmin } from "../../middlewares/auth.js";
// import {
//   getAllReports,
//   getReportById,
//   updateReportStatus,
//   bulkUpdateReports,
//   getReportStats,
// } from "../../controllers/admin/admin.report.controller.js";

// const router = express.Router();

// router.use(isAuthenticated, isAdmin);

// router.get("/reports/stats",        getReportStats);
// router.get("/reports",              getAllReports);
// router.get("/reports/:id",          getReportById);
// router.patch("/reports/bulk",       bulkUpdateReports);
// router.patch("/reports/:id/status", updateReportStatus);

// export default router;



// server/src/routes/admin/Admin.report.routes.js
import express from "express";
import { isAuthenticated, isAdmin } from "../../middlewares/auth.js";
import {
  getAllReports, getReportById, updateReportStatus,
  bulkUpdateReports, getReportStats,
} from "../../controllers/admin/admin.report.controller.js";
import { auditLog } from "../../middlewares/auditMiddleware.js";
import { AUDIT_ACTIONS } from "../../utils/auditLogger.js";

const router = express.Router();
router.use(isAuthenticated, isAdmin);

// ── READ (no audit) ───────────────────────────────────────────────────────────
router.get("/reports/stats", getReportStats);
router.get("/reports",       getAllReports);
router.get("/reports/:id",   getReportById);

// ── Bulk update ───────────────────────────────────────────────────────────────
router.patch(
  "/reports/bulk",
  auditLog({
    action:     AUDIT_ACTIONS.REPORTS_BULK_UPDATED,
    targetType: "report",
    targetMeta: (req) => ({
      status:    req.body?.status   ?? null,
      reason:    req.body?.reason   ?? null,
      reportIds: req.body?.ids      ?? [],
    }),
  }),
  bulkUpdateReports,
);

// ── Single report status ──────────────────────────────────────────────────────
router.patch(
  "/reports/:id/status",
  auditLog({
    action: (req) =>
      req.body?.status === "resolved"
        ? AUDIT_ACTIONS.REPORT_RESOLVED
        : AUDIT_ACTIONS.REPORT_DISMISSED,
    targetId:   (req) => req.params.id,
    targetType: "report",
    targetMeta: (req) => ({
      status: req.body?.status ?? null,
      reason: req.body?.reason ?? null,
    }),
  }),
  updateReportStatus,
);

export default router;