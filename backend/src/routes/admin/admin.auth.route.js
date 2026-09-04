
// backend/src/routes/admin/Admin.auth.route.js
import express from "express";
import {
  adminLogin, adminLogout, adminRefreshToken, getAdminMe, getAdminSocketToken,
} from "../../controllers/admin/admin.auth.controller.js";

import { isAdminAuthenticated } from "../../middlewares/authenticateAdmin.js";
// import { isAdmin, isAuthenticated } from "../../middlewares/auth.js";
import { auditLog } from "../../middlewares/auditMiddleware.js";
import { AUDIT_ACTIONS } from "../../utils/auditLogger.js";

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.post("/refresh-token", adminRefreshToken);

// Login — audit on success
router.post(
  "/login",
  auditLog({
    action:     AUDIT_ACTIONS.ADMIN_LOGIN,
    targetMeta: (req, resBody) => ({
      username: resBody?.admin?.username ?? null,
    }),
  }),
  adminLogin,
);

// ── Protected ─────────────────────────────────────────────────────────────────
router.get("/me", isAdminAuthenticated, getAdminMe);

// Logout — audit on success
router.post(
  "/logout",
  isAdminAuthenticated,
  auditLog({ action: AUDIT_ACTIONS.ADMIN_LOGOUT }),
  adminLogout,
);
router.get("/socket-token", isAdminAuthenticated, getAdminSocketToken);
export default router;