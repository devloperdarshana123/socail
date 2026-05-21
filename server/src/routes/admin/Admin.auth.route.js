import express from "express";
import {
  adminLogin,
  adminLogout,
  adminRefreshToken,
  getAdminMe,
} from "../../controllers/admin/admin.auth.controller.js";
import { isAdmin , isAuthenticated } from "../../middlewares/auth.js";

const router = express.Router();

// ─────────────────────────────────────────────
//  Public Routes — No token required
// ─────────────────────────────────────────────

router.post("/login", adminLogin);
router.post("/refresh-token", adminRefreshToken);

// ─────────────────────────────────────────────
//  Protected Routes — isAuthenticated + isAdmin
// ─────────────────────────────────────────────

router.get("/me", isAuthenticated, isAdmin, getAdminMe);
router.post("/logout", isAuthenticated, isAdmin, adminLogout);

export default router;