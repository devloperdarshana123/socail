import express from "express";
import {
  suggestUsernames,
  checkUsername,
  setUsername,
} from "../../controllers/auth/auth.controller.js";
import {
  isAuthenticated,
  isOnboardingPending,
} from "../../middlewares/auth.js";

const router = express.Router();

// ─────────────────────────────────────────────
//  All onboarding routes:
//    - isAuthenticated  → valid token chahiye
//    - isOnboardingPending → sirf step 2 wale users (OTP verified, username baaki)
// ─────────────────────────────────────────────

router.use(isAuthenticated, isOnboardingPending);

// Username suggestions — name + email se generate + DB availability check
router.get("/username/suggestions", suggestUsernames);

// Check if a specific username is available
router.get("/username/check/:username", checkUsername);

// Set username — onboarding complete karo
router.patch("/username", setUsername);

export default router;
