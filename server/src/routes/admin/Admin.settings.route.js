// import { Router }      from "express";
// import multer          from "multer";
// import { isAdminAuthenticated } from "../../middlewares/authenticateAdmin.js";
// import {
//   getAdminProfile,
//   updateAdminProfile,
//   updateAdminAvatar,
//   changeAdminPassword,
//   updateNotificationSettings,
//   getAdminSessions,
//   revokeAdminSession,
//   revokeAllOtherSessions,
// } from "../../controllers/admin/admin.settings.controller.js";

// const router  = Router();

// // Multer — memory storage, image only, 5MB cap
// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits:  { fileSize: 5 * 1024 * 1024 },
//   fileFilter: (_, file, cb) => {
//     if (file.mimetype.startsWith("image/")) cb(null, true);
//     else cb(new Error("Only image files are allowed."), false);
//   },
// });

// // All admin settings routes require authentication + admin role
// router.use(isAdminAuthenticated);

// // ── Profile ────────────────────────────────────────────────────────────────
// router.get  ("/profile",        getAdminProfile);
// router.patch("/profile",        updateAdminProfile);
// router.patch("/profile/avatar", upload.single("avatar"), updateAdminAvatar);

// // ── Password ───────────────────────────────────────────────────────────────
// router.patch("/password", changeAdminPassword);

// // ── Notifications ──────────────────────────────────────────────────────────
// router.patch("/notifications", updateNotificationSettings);

// // ── Sessions ───────────────────────────────────────────────────────────────
// router.get   ("/sessions",          getAdminSessions);
// router.delete("/sessions",          revokeAllOtherSessions);
// router.delete("/sessions/:sessionId", revokeAdminSession);

// export default router;



// server/src/routes/admin/admin.settings.route.js
import { Router }   from "express";
import multer       from "multer";
import { isAdminAuthenticated } from "../../middlewares/authenticateAdmin.js";
import {
  getAdminProfile, updateAdminProfile, updateAdminAvatar,
  changeAdminPassword, updateNotificationSettings,
  getAdminSessions, revokeAdminSession, revokeAllOtherSessions,
} from "../../controllers/admin/admin.settings.controller.js";
import { auditLog } from "../../middlewares/auditMiddleware.js";
import { AUDIT_ACTIONS } from "../../utils/auditLogger.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed."), false);
  },
});

router.use(isAdminAuthenticated);

// ── READ (no audit) ───────────────────────────────────────────────────────────
router.get("/profile",  getAdminProfile);
router.get("/sessions", getAdminSessions);

// ── WRITE (audited) ───────────────────────────────────────────────────────────
router.patch(
  "/profile",
  auditLog({ action: AUDIT_ACTIONS.SETTINGS_PROFILE_UPDATED }),
  updateAdminProfile,
);

router.patch(
  "/profile/avatar",
  upload.single("avatar"),
  auditLog({ action: AUDIT_ACTIONS.SETTINGS_AVATAR_UPDATED }),
  updateAdminAvatar,
);

router.patch(
  "/password",
  auditLog({ action: AUDIT_ACTIONS.ADMIN_PASSWORD_CHANGED }),
  changeAdminPassword,
);

router.patch(
  "/notifications",
  auditLog({ action: AUDIT_ACTIONS.SETTINGS_NOTIFICATIONS_UPDATED }),
  updateNotificationSettings,
);

router.delete(
  "/sessions",
  auditLog({ action: AUDIT_ACTIONS.ADMIN_ALL_SESSIONS_REVOKED }),
  revokeAllOtherSessions,
);

router.delete(
  "/sessions/:sessionId",
  auditLog({
    action:   AUDIT_ACTIONS.ADMIN_SESSION_REVOKED,
    targetMeta: (req) => ({ sessionId: req.params.sessionId }),
  }),
  revokeAdminSession,
);

export default router;
