
import express from "express";
import {
  sendFollowRequest,
  acceptFollowRequest,
  rejectFollowRequest,
  unfollowUser,
  getFollowRequests,
  getFollowers,
  getFollowing,
  cancelFollowRequest,
  getSentFollowRequests,
} from "../controllers/follow.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// ── My Own Followers / Following (no userId param) ───────────────────────────
router.get("/followers",               protect, getFollowers);           // My followers
router.get("/following",               protect, getFollowing);           // My following

// ── Follow Request Actions ───────────────────────────────────────────────────
router.get("/requests",                protect, getFollowRequests);
router.get("/sent",                    protect, getSentFollowRequests);
router.post("/:userId/send",           protect, sendFollowRequest);      // Send request
router.post("/:requesterId/accept",    protect, acceptFollowRequest);    // Accept request
router.post("/:requesterId/reject",    protect, rejectFollowRequest);    // Reject request
router.delete("/:userId/cancel",       protect, cancelFollowRequest);    // Cancel sent request
router.delete("/:userId/unfollow",     protect, unfollowUser);           // Unfollow

// ── Other User's Followers / Following ──────────────────────────────────────
router.get("/:userId/followers",       protect, getFollowers);           // User's followers
router.get("/:userId/following",       protect, getFollowing);           // User's following

export default router;