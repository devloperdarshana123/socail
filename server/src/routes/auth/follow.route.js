


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

const followRouter = express.Router();

followRouter.use(isAuthenticated, isActive);

// ── Specific routes FIRST (before /:userId wildcards) ──────────────────────
followRouter.get("/requests",                   getFollowRequests);
followRouter.patch("/requests/:userId/accept",  acceptFollowRequest);
followRouter.delete("/requests/:userId/reject", rejectFollowRequest);

// ── Per-user routes ─────────────────────────────────────────────────────────
followRouter.post("/:userId",          followUser);
followRouter.delete("/:userId",        unfollowUser);
followRouter.get("/:userId/status",    getFollowStatus);
followRouter.get("/:userId/followers", getFollowers);
followRouter.get("/:userId/following", getFollowing);
followRouter.get("/:userId/mutual",    getMutualFollowers);
followRouter.post("/:userId/block",    blockUser);

export default followRouter;