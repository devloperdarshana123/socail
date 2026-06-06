import { Router }              from "express";
import { isAdminAuthenticated } from "../../middlewares/authenticateAdmin.js";
import { internalAuth }         from "../../middlewares/internalAuth.js";
import asyncHandler             from "../../middlewares/asyncHandler.js";
import {
  getAdminNotifications,
  markAllAdminNotificationsRead,
  saveAdminNotification,
} from "../../controllers/admin/adminNotification.controller.js";

const router = Router();

// ── Internal route — chat server se call hoga, admin auth nahi chahiye ──
router.post("/save", internalAuth, saveAdminNotification);

// ── Admin authenticated routes ──
router.use(isAdminAuthenticated);
router.get("/",            getAdminNotifications);
router.patch("/read-all",  markAllAdminNotificationsRead);

export default router;