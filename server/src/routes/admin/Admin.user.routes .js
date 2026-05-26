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
//   bulkUpdateStatus,
//   getSuspensionHistory,
// } from "../../controllers/admin/admin.user.controller.js";

// const router = express.Router();

// // ── All routes protected: must be logged in + super_admin ────
// router.use(isAuthenticated, isAdmin);

// // ── Dashboard ────────────────────────────────────────────────
// router.get("/stats", getDashboardStats);

// // ── Users ────────────────────────────────────────────────────
// router.post("/users/bulk-status",             bulkUpdateStatus);  
// router.get("/users",              getAllUsers);
// router.get("/users/:id",          getUserById);
// router.get("/users/:id/posts",    getUserPosts);
// router.get("/users/:id/reports",  getUserReports);
// router.get("/users/:id/suspension-history",   getSuspensionHistory); 
// router.get("/posts", getAllPosts);

// // ── User Actions ─────────────────────────────────────────────
// router.patch("/users/:id/status",       updateUserStatus);
// router.patch("/users/:id/verify-badge", toggleVerifiedBadge);
// router.delete("/users/:id",             deleteUserAccount);

// // ── Post Actions ─────────────────────────────────────────────
// router.delete("/posts/:postId", deletePost);

// export default router;



// server/src/routes/admin/Admin.user.routes.js
import express from "express";
import { isAuthenticated, isAdmin } from "../../middlewares/auth.js";
import {
  getAllUsers, getUserById, getUserPosts, getUserReports,
  updateUserStatus, deleteUserAccount, deletePost,
  toggleVerifiedBadge, getDashboardStats, getAllPosts,
  bulkUpdateStatus, getSuspensionHistory,
} from "../../controllers/admin/admin.user.controller.js";
import { auditLog } from "../../middlewares/auditMiddleware.js";
import { AUDIT_ACTIONS } from "../../utils/auditLogger.js";

const router = express.Router();
router.use(isAuthenticated, isAdmin);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get("/stats", getDashboardStats);

// ── Users — READ (no audit needed) ───────────────────────────────────────────
router.get("/users",                          getAllUsers);
router.get("/users/:id",                      getUserById);
router.get("/users/:id/posts",                getUserPosts);
router.get("/users/:id/reports",              getUserReports);
router.get("/users/:id/suspension-history",   getSuspensionHistory);
router.get("/posts",                          getAllPosts);

// ── Users — WRITE (audit each action) ────────────────────────────────────────

// Bulk status — action depends on body.status
router.post(
  "/users/bulk-status",
  auditLog({
    action: (req) => {
      const map = {
        banned:      AUDIT_ACTIONS.USER_BANNED,
        suspended:   AUDIT_ACTIONS.USER_SUSPENDED,
        active:      AUDIT_ACTIONS.USER_UNSUSPENDED,
        deactivated: AUDIT_ACTIONS.USER_ACTIVATED,
      };
      return map[req.body?.status] ?? AUDIT_ACTIONS.USER_ACTIVATED;
    },
    targetType: "user",
    targetMeta: (req) => ({
      reason:   req.body?.reason  ?? null,
      status:   req.body?.status  ?? null,
      duration: req.body?.duration ?? null,
      userIds:  req.body?.userIds ?? [],
    }),
  }),
  bulkUpdateStatus,
);

// Status change — ban / suspend / unsuspend / activate
router.patch(
  "/users/:id/status",
  auditLog({
    action: (req) => {
      const map = {
        banned:      AUDIT_ACTIONS.USER_BANNED,
        suspended:   AUDIT_ACTIONS.USER_SUSPENDED,
        active:      AUDIT_ACTIONS.USER_UNSUSPENDED,
        deactivated: AUDIT_ACTIONS.USER_ACTIVATED,
      };
      return map[req.body?.status] ?? AUDIT_ACTIONS.USER_ACTIVATED;
    },
    targetId:   (req) => req.params.id,
    targetType: "user",
    targetMeta: (req, resBody) => ({
      username: resBody?.data?.username   ?? null,
      status:   resBody?.data?.accountStatus ?? req.body?.status ?? null,
      reason:   req.body?.reason  ?? null,
      duration: req.body?.duration ?? null,
    }),
  }),
  updateUserStatus,
);

// Verify badge toggle
router.patch(
  "/users/:id/verify-badge",
  auditLog({
    action: (req, resBody) =>
      resBody?.data?.isVerifiedBadge
        ? AUDIT_ACTIONS.USER_BADGE_GRANTED
        : AUDIT_ACTIONS.USER_BADGE_REVOKED,
    targetId:   (req) => req.params.id,
    targetType: "user",
    targetMeta: (req, resBody) => ({
      isVerifiedBadge: resBody?.data?.isVerifiedBadge ?? null,
    }),
  }),
  toggleVerifiedBadge,
);

// Delete user account
router.delete(
  "/users/:id",
  auditLog({
    action:     AUDIT_ACTIONS.USER_DELETED,
    targetId:   (req) => req.params.id,
    targetType: "user",
    targetMeta: (req, resBody) => ({
      username: resBody?.data?.username ?? null,
    }),
  }),
  deleteUserAccount,
);

// Delete post
router.delete(
  "/posts/:postId",
  auditLog({
    action:     AUDIT_ACTIONS.POST_DELETED,
    targetId:   (req) => req.params.postId,
    targetType: "post",
    targetMeta: (req) => ({
      postId: req.params.postId,
    }),
  }),
  deletePost,
);

export default router;