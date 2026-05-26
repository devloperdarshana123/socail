

import mongoose from "mongoose";
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import Follow from "../../models/follow.model.js";
import User from "../../models/user.model.js";
import { notifyChat } from "../../helper/notifyChat.js";

// ─────────────────────────────────────────────
//  Helper — validate ObjectId
// ─────────────────────────────────────────────
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ═════════════════════════════════════════════
//  POST /api/v2/follow/:userId
//  Send a follow request (auto-accept for public accounts)
// ═════════════════════════════════════════════
export const followUser = asyncHandler(async (req, res, next) => {
  const followerId  = req.user._id;
  const followingId = req.params.userId;

  if (!isValidId(followingId))
    return next(new AppError("Invalid user ID.", 400));

  // Model also guards this — but fail fast in controller for clean 400
  if (followerId.toString() === followingId.toString())
    return next(new AppError("You cannot follow yourself.", 400));

  const targetUser = await User.findById(followingId)
    .select("accountStatus isPrivate username")
    .lean();

  if (!targetUser || targetUser.accountStatus !== "active")
    return next(new AppError("User not found.", 404));

  // Model handles: race condition, E11000, re-request after rejection, count updates
  const { status, alreadyFollowing } = await Follow.sendFollowRequest(
    followerId,
    followingId,
    targetUser.isPrivate,
  );

  if (alreadyFollowing) {
    return res.status(200).json({
      success: true,
      status,
      message: status === "accepted" ? "Already following." : "Follow request already pending.",
    });
  }

  // Notify — only if not already following
  notifyChat("/notify/follow", {
    to:   followingId.toString(),
    from: followerId.toString(),
    type: status === "accepted" ? "follow" : "follow_request",
  }).catch(() => {});

  const message =
    status === "accepted"
      ? `You are now following ${targetUser.username}.`
      : "Follow request sent.";

  return res.status(200).json({ success: true, status, message });
});

// ═════════════════════════════════════════════
//  DELETE /api/v2/follow/:userId
//  Unfollow OR cancel a pending request
// ═════════════════════════════════════════════
export const unfollowUser = asyncHandler(async (req, res, next) => {
  const followerId  = req.user._id;
  const followingId = req.params.userId;

  if (!isValidId(followingId))
    return next(new AppError("Invalid user ID.", 400));

  // Model handles count decrement (only if was accepted)
  const { unfollowed } = await Follow.unfollow(followerId, followingId);

  if (!unfollowed)
    return next(new AppError("You are not following this user.", 404));

  return res.status(200).json({ success: true, message: "Unfollowed successfully." });
});

// ═════════════════════════════════════════════
//  PATCH /api/v2/follow/requests/:userId/accept
//  Accept an incoming follow request
// ═════════════════════════════════════════════
export const acceptFollowRequest = asyncHandler(async (req, res, next) => {
  const recipientId = req.user._id;        // the account being followed — accepting
  const followerId  = req.params.userId;   // the user who sent the request

  if (!isValidId(followerId))
    return next(new AppError("Invalid user ID.", 400));

  // Model handles count increment internally — do NOT increment again here
  const { accepted } = await Follow.acceptRequest(followerId, recipientId);

  if (!accepted)
    return next(new AppError("Follow request not found or already accepted.", 404));

  // Notify the requester their request was accepted
  notifyChat("/notify/follow-accepted", {
    to:   followerId.toString(),
    from: recipientId.toString(),
  }).catch(() => {});

  return res.status(200).json({ success: true, message: "Follow request accepted." });
});

// ═════════════════════════════════════════════
//  DELETE /api/v2/follow/requests/:userId/reject
//  Soft-reject an incoming follow request (audit trail kept 90 days)
// ═════════════════════════════════════════════
export const rejectFollowRequest = asyncHandler(async (req, res, next) => {
  const recipientId = req.user._id;
  const followerId  = req.params.userId;

  if (!isValidId(followerId))
    return next(new AppError("Invalid user ID.", 400));

  const { rejected } = await Follow.rejectRequest(followerId, recipientId);

  if (!rejected)
    return next(new AppError("Follow request not found.", 404));

  return res.status(200).json({ success: true, message: "Follow request rejected." });
});

// ═════════════════════════════════════════════
//  GET /api/v2/follow/requests
//  Incoming pending follow requests (cursor-based)
// ═════════════════════════════════════════════
export const getFollowRequests = asyncHandler(async (req, res) => {
  const { afterId } = req.query;
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  const afterIdVal = afterId && isValidId(afterId) ? afterId : null;

  // Model: getPendingRequests(userId, afterId, limit)
  const { requests, nextCursor } = await Follow.getPendingRequests(
    req.user._id,
    afterIdVal,
    limit,
  );

  return res.status(200).json({
    success: true,
    data: requests,
    nextCursor,
  });
});

// ═════════════════════════════════════════════
//  GET /api/v2/follow/:userId/followers
//  Paginated followers list (cursor-based)
// ═════════════════════════════════════════════
export const getFollowers = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { afterId } = req.query;
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  if (!isValidId(userId))
    return next(new AppError("Invalid user ID.", 400));

  const afterIdVal = afterId && isValidId(afterId) ? afterId : null;

  // Model: getFollowers(userId, afterId, limit)
  const { followers, nextCursor } = await Follow.getFollowers(userId, afterIdVal, limit);

  // Shape: return the populated user objects, not the follow doc wrappers
  return res.status(200).json({
    success: true,
    data: followers.map((f) => f.follower),
    nextCursor,
  });
});

// ═════════════════════════════════════════════
//  GET /api/v2/follow/:userId/following
//  Paginated following list (cursor-based)
// ═════════════════════════════════════════════
export const getFollowing = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { afterId } = req.query;
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  if (!isValidId(userId))
    return next(new AppError("Invalid user ID.", 400));

  const afterIdVal = afterId && isValidId(afterId) ? afterId : null;

  // Model: getFollowing(userId, afterId, limit)
  const { following, nextCursor } = await Follow.getFollowing(userId, afterIdVal, limit);

  return res.status(200).json({
    success: true,
    data: following.map((f) => f.following),
    nextCursor,
  });
});

// ═════════════════════════════════════════════
//  GET /api/v2/follow/:userId/status
//  Follow status between logged-in user and target
//  Used by frontend follow button to show: Follow / Following / Requested
// ═════════════════════════════════════════════
export const getFollowStatus = asyncHandler(async (req, res, next) => {
  const viewerId = req.user._id;
  const { userId } = req.params;

  if (!isValidId(userId))
    return next(new AppError("Invalid user ID.", 400));

  if (viewerId.toString() === userId.toString()) {
    return res.status(200).json({ success: true, status: "self" });
  }

  // Model: getFollowStatus(followerId, followingId) → "pending"|"accepted"|"rejected"|null
  const status = await Follow.getFollowStatus(viewerId, userId);

  return res.status(200).json({
    success: true,
    status: status ?? "none",          // null → "none" for frontend clarity
    isFollowing: status === "accepted",
  });
});

// ═════════════════════════════════════════════
//  GET /api/v2/follow/:userId/mutual
//  Mutual followers between viewer and target (DB-side aggregation)
// ═════════════════════════════════════════════
export const getMutualFollowers = asyncHandler(async (req, res, next) => {
  const viewerId = req.user._id;
  const { userId } = req.params;
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 6));

  if (!isValidId(userId))
    return next(new AppError("Invalid user ID.", 400));

  // Model: getMutualFollowers(userAId, userBId, limit) — $setIntersection in DB
  const mutuals = await Follow.getMutualFollowers(viewerId, userId, limit);

  return res.status(200).json({
    success: true,
    data: mutuals,
    count: mutuals.length,
  });
});

// ═════════════════════════════════════════════
//  POST /api/v2/follow/:userId/block
//  Block a user — removes all follow relationships bidirectionally
// ═════════════════════════════════════════════
export const blockUser = asyncHandler(async (req, res, next) => {
  const blockerId = req.user._id;
  const { userId: blockedId } = req.params;

  if (!isValidId(blockedId))
    return next(new AppError("Invalid user ID.", 400));

  if (blockerId.toString() === blockedId.toString())
    return next(new AppError("You cannot block yourself.", 400));

  // Model: removeAllBetween cleans both directions + adjusts counts
  await Follow.removeAllBetween(blockerId, blockedId);

  return res.status(200).json({ success: true, message: "User blocked." });
});