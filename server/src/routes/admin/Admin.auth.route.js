// import express from "express";
// import {
//   adminLogin,
//   adminLogout,
//   adminRefreshToken,
//   getAdminMe,
// } from "../../controllers/admin/admin.auth.controller.js";
// import { isAdmin , isAuthenticated } from "../../middlewares/auth.js";

// const router = express.Router();

// // ─────────────────────────────────────────────
// //  Public Routes — No token required
// // ─────────────────────────────────────────────

// router.post("/login", adminLogin);
// router.post("/refresh-token", adminRefreshToken);

// // ─────────────────────────────────────────────
// //  Protected Routes — isAuthenticated + isAdmin
// // ─────────────────────────────────────────────

// router.get("/me", isAuthenticated, isAdmin, getAdminMe);
// router.post("/logout", isAuthenticated, isAdmin, adminLogout);

// export default router;



// server/src/routes/admin/Admin.auth.route.js
import express from "express";
import {
  adminLogin, adminLogout, adminRefreshToken, getAdminMe,
} from "../../controllers/admin/admin.auth.controller.js";
import { isAdmin, isAuthenticated } from "../../middlewares/auth.js";
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
router.get("/me", isAuthenticated, isAdmin, getAdminMe);

// Logout — audit on success
router.post(
  "/logout",
  isAuthenticated,
  isAdmin,
  auditLog({ action: AUDIT_ACTIONS.ADMIN_LOGOUT }),
  adminLogout,
);

export default router;