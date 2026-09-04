


import express from "express";
import { isAuthenticated, isActive } from "../../middlewares/auth.js";
import {
  followUser,
  unfollowUser,
  acceptFollowRequest,
  rejectFollowRequest,
  getFollowRequests,
  getFollowers,
  getFollowing,
  getFollowStatus,
  getMutualFollowers,
  blockUser,
} from "../../controllers/auth/follow.controller.js";
import { followLimiter } from "../../middlewares/rateLimiter.js";
const followRouter = express.Router();

followRouter.use(isAuthenticated, isActive);

// ── Specific routes FIRST (before /:userId wildcards) ──────────────────────
followRouter.get("/requests",                   getFollowRequests);
followRouter.patch("/requests/:userId/accept", followLimiter, acceptFollowRequest);
followRouter.delete("/requests/:userId/reject",followLimiter, rejectFollowRequest);

// ── Per-user routes ─────────────────────────────────────────────────────────
followRouter.post("/:userId",followLimiter   ,       followUser);
followRouter.delete("/:userId",  followLimiter  ,    unfollowUser);
followRouter.get("/:userId/status",    getFollowStatus);
followRouter.get("/:userId/followers", getFollowers);
followRouter.get("/:userId/following", getFollowing);
followRouter.get("/:userId/mutual",    getMutualFollowers);
followRouter.post("/:userId/block", followLimiter,  blockUser);

export default followRouter;