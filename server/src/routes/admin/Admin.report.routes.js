import express from "express";
import { isAuthenticated, isAdmin } from "../../middlewares/auth.js";
import {
  getAllReports,
  getReportById,
  updateReportStatus,
  bulkUpdateReports,
  getReportStats,
} from "../../controllers/admin/admin.report.controller.js";

const router = express.Router();

router.use(isAuthenticated, isAdmin);

router.get("/reports/stats",        getReportStats);
router.get("/reports",              getAllReports);
router.get("/reports/:id",          getReportById);
router.patch("/reports/bulk",       bulkUpdateReports);
router.patch("/reports/:id/status", updateReportStatus);

export default router;