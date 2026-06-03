// // import express from "express";
// // import { isAdminAuthenticated } from "../../middlewares/authenticateAdmin.js";
// // import {
// //   getAllReports,
// //   getReportById,
// //   updateReportStatus,
// //   bulkUpdateReports,
// //   getReportStats,
// // } from "../../controllers/admin/admin.report.controller.js";

// // const router = express.Router();

// // router.use(isAdminAuthenticated);

// // router.get("/reports/stats",        getReportStats);
// // router.get("/reports",              getAllReports);
// // router.get("/reports/:id",          getReportById);
// // router.patch("/reports/bulk",       bulkUpdateReports);
// // router.patch("/reports/:id/status", updateReportStatus);

// // export default router;



// // server/src/routes/admin/Admin.report.routes.js
// import express from "express";
// import { isAdminAuthenticated } from "../../middlewares/authenticateAdmin.js";
// import {
//   getAllReports, getReportById, updateReportStatus,
//   bulkUpdateReports, getReportStats,
// } from "../../controllers/admin/admin.report.controller.js";
// import { auditLog } from "../../middlewares/auditMiddleware.js";
// import { AUDIT_ACTIONS } from "../../utils/auditLogger.js";

// const router = express.Router();
// router.use(isAdminAuthenticated);

// // ── READ (no audit) ───────────────────────────────────────────────────────────
// router.get("/reports/stats", getReportStats);
// router.get("/reports",       getAllReports);
// router.get("/reports/:id",   getReportById);

// // ── Bulk update ───────────────────────────────────────────────────────────────
// router.patch(
//   "/reports/bulk",
//   auditLog({
//     action:     AUDIT_ACTIONS.REPORTS_BULK_UPDATED,
//     targetType: "report",
//     targetMeta: (req) => ({
//       status:    req.body?.status   ?? null,
//       reason:    req.body?.reason   ?? null,
//       reportIds: req.body?.ids      ?? [],
//     }),
//   }),
//   bulkUpdateReports,
// );

// // ── Single report status ──────────────────────────────────────────────────────
// router.patch(
//   "/reports/:id/status",
//   auditLog({
//     action: (req) =>
//       req.body?.status === "resolved"
//         ? AUDIT_ACTIONS.REPORT_RESOLVED
//         : AUDIT_ACTIONS.REPORT_DISMISSED,
//     targetId:   (req) => req.params.id,
//     targetType: "report",
//     targetMeta: (req) => ({
//       status: req.body?.status ?? null,
//       reason: req.body?.reason ?? null,
//     }),
//   }),
//   updateReportStatus,
// );

// export default router;



// server/src/routes/admin/Admin.report.routes.js

import express from "express";
import { isAdminAuthenticated } from "../../middlewares/authenticateAdmin.js";
import {
  getAllReports,
  getReportById,
  getReportHistory,
  updateReportStatus,
  bulkUpdateReports,
  getReportStats,
  claimReport,
  releaseReport,
  escalateReport,
  releaseStaleClams,
} from "../../controllers/admin/admin.report.controller.js";
import { auditLog }      from "../../middlewares/auditMiddleware.js";
import { AUDIT_ACTIONS } from "../../utils/auditLogger.js";

const router = express.Router();

router.use(isAdminAuthenticated);

// ─────────────────────────────────────────────────────────────────────────────
//  READ — no audit
// ─────────────────────────────────────────────────────────────────────────────

router.get("/reports/stats",      getReportStats);
router.get("/reports",            getAllReports);
router.get("/reports/:id",        getReportById);
router.get("/reports/:id/history",getReportHistory);

// ─────────────────────────────────────────────────────────────────────────────
//  CLAIM / RELEASE — audit
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  "/reports/:id/claim",
  auditLog({
    action:     AUDIT_ACTIONS.REPORT_CLAIMED,
    targetId:   (req) => req.params.id,
    targetType: "report",
    targetMeta: (req, resBody) => ({
      reportId:   req.params.id,
      claimedBy:  resBody?.data?.claimedBy?.username ?? null,
      expiresAt:  resBody?.data?.claimExpiresAt ?? null,
    }),
  }),
  claimReport,
);

router.delete(
  "/reports/:id/claim",
  auditLog({
    action:     AUDIT_ACTIONS.REPORT_RELEASED,
    targetId:   (req) => req.params.id,
    targetType: "report",
    targetMeta: (req) => ({ reportId: req.params.id }),
  }),
  releaseReport,
);

// ─────────────────────────────────────────────────────────────────────────────
//  ESCALATE — audit
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  "/reports/:id/escalate",
  auditLog({
    action:     AUDIT_ACTIONS.REPORT_ESCALATED,
    targetId:   (req) => req.params.id,
    targetType: "report",
    targetMeta: (req) => ({
      reportId: req.params.id,
      reason:   req.body?.reason ?? null,
    }),
  }),
  escalateReport,
);

// ─────────────────────────────────────────────────────────────────────────────
//  STATUS UPDATE — audit (action-aware)
// ─────────────────────────────────────────────────────────────────────────────

router.patch(
  "/reports/:id/status",
  auditLog({
    // Dynamically pick action based on resolved status
    action: (req) => {
      const s = req.body?.status;
      if (s === "resolved_action_taken" || s === "resolved_no_action") return AUDIT_ACTIONS.REPORT_RESOLVED;
      if (s === "dismissed")   return AUDIT_ACTIONS.REPORT_DISMISSED;
      if (s === "under_review")return AUDIT_ACTIONS.REPORT_UNDER_REVIEW;
      return AUDIT_ACTIONS.REPORT_RESOLVED; // fallback
    },
    targetId:   (req) => req.params.id,
    targetType: "report",
    targetMeta: (req, resBody) => ({
      reportId:    req.params.id,
      status:      req.body?.status      ?? null,
      actionTaken: req.body?.actionTaken ?? null,
      // Pull extra info stashed by controller via res.locals.auditMeta
      username:    resBody?.data?.reportedBy?.username ?? null,
    }),
  }),
  updateReportStatus,
);

// ─────────────────────────────────────────────────────────────────────────────
//  BULK UPDATE — audit
// ─────────────────────────────────────────────────────────────────────────────

router.patch(
  "/reports/bulk",
  auditLog({
    action:     AUDIT_ACTIONS.REPORTS_BULK_UPDATED,
    targetType: "report",
    targetMeta: (req) => ({
      status:      req.body?.status      ?? null,
      actionTaken: req.body?.actionTaken ?? null,
      reportIds:   req.body?.ids         ?? [],
      count:       req.body?.ids?.length ?? 0,
    }),
  }),
  bulkUpdateReports,
);

// ─────────────────────────────────────────────────────────────────────────────
//  UTILITY — release stale claims (admin / cron)
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  "/reports/release-stale-claims",
  auditLog({
    action:     AUDIT_ACTIONS.REPORT_STALE_CLAIMS_RELEASED,
    targetType: "report",
    targetMeta: (req, resBody) => ({
      released: resBody?.data?.released ?? 0,
    }),
  }),
  releaseStaleClams,
);

export default router;
