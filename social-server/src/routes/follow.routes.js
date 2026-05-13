
import express from "express";
import rateLimit from "express-rate-limit";

import {
  toggleFollow,
  removeFollower,
  toggleBlock,
  getFollowers,
  getFollowing,
  getSuggestions,
} from "../controllers/follow.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

const followLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      30,
  message:  { success: false, message: "Too many follow actions. Slow down." },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ─────────────────────────────────────────────────────────────────────────────
// Suggestions
// ─────────────────────────────────────────────────────────────────────────────

router.get("/suggestions", protect, getSuggestions);

// ─────────────────────────────────────────────────────────────────────────────
// My own followers / following
// ─────────────────────────────────────────────────────────────────────────────

// follow.routes.js mein
router.get("/followers", protect, (req, res, next) => {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  req.params.userId = req.user._id.toString();
  next();
}, getFollowers);

router.get("/following", protect, (req, res, next) => {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  req.params.userId = req.user._id.toString();
  next();
}, getFollowing);

// ─────────────────────────────────────────────────────────────────────────────
// Actions on other users
// ─────────────────────────────────────────────────────────────────────────────

router.post(   "/:userId/toggle",          protect, followLimiter, toggleFollow);    // follow / unfollow
router.delete( "/:userId/remove-follower", protect, removeFollower);                 // follower hatao
router.post(   "/:userId/block",           protect, toggleBlock);                    // block / unblock

// ─────────────────────────────────────────────────────────────────────────────
// Other user's followers / following
// ─────────────────────────────────────────────────────────────────────────────

router.get("/:userId/followers", protect, getFollowers);
router.get("/:userId/following", protect, getFollowing);

export default router;