import express from "express";
import {
  getMyProfile,
  updateProfile,
  updatePassword,
  deactivateAccount,
   reactivateAccount,
} from "../../controllers/auth/setting.controller.js";
import { isAuthenticated, isActive } from "../../middlewares/auth.js";

const router = express.Router();

router.post("/reactivate", reactivateAccount);

// Saare routes: login hona chahiye + account active hona chahiye
router.use(isAuthenticated, isActive);

// ── Profile ──────────────────────────────────
router.get("/me",        getMyProfile);
router.patch("/profile", updateProfile);

// ── Password ─────────────────────────────────
router.patch("/password", updatePassword);

// ── Account ──────────────────────────────────
router.delete("/deactivate", deactivateAccount);

export default router;