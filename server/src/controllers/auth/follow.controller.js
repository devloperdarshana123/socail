

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import prisma from "../../config/prisma.js";
import * as FollowHelper from "../../utils/followHelpers.js";
import { notifyChat } from "../../helper/notifyChat.js";
import redis from "../../config/redis.js";

export const followUser = asyncHandler(async (req, res, next) => {
  const followerId = req.user.id;
  const followingId = req.params.userId;

  if (followerId === followingId)
    return next(new AppError("You cannot follow yourself.", 400));

  const targetUser = await prisma.user.findUnique({
    where: { id: followingId },
    select: { accountStatus: true, isPrivate: true, username: true },
  });

  if (!targetUser || targetUser.accountStatus !== "active")
    return next(new AppError("User not found.", 404));

  const { status, alreadyFollowing } = await FollowHelper.sendFollowRequest(
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

  notifyChat("/notify/follow", {
    to: followingId,
    from: followerId,
    type: status === "accepted" ? "follow" : "follow_request",
  }).catch(() => {});

  const message =
    status === "accepted"
      ? `You are now following ${targetUser.username}.`
      : "Follow request sent.";

  await redis.del(`user:auth:${followerId}`).catch(() => {});
  await redis.del(`user:auth:${followingId}`).catch(() => {});

  return res.status(200).json({ success: true, status, message });
});

export const unfollowUser = asyncHandler(async (req, res, next) => {
  const followerId = req.user.id;
  const followingId = req.params.userId;

  const { unfollowed } = await FollowHelper.unfollow(followerId, followingId);

  if (!unfollowed)
    return next(new AppError("You are not following this user.", 404));

  await redis.del(`user:auth:${followerId}`).catch(() => {});
  await redis.del(`user:auth:${followingId}`).catch(() => {});

  return res.status(200).json({ success: true, message: "Unfollowed successfully." });
});

export const acceptFollowRequest = asyncHandler(async (req, res, next) => {
  const recipientId = req.user.id;
  const followerId = req.params.userId;

  const { accepted } = await FollowHelper.acceptRequest(followerId, recipientId);

  if (!accepted)
    return next(new AppError("Follow request not found or already accepted.", 404));

  notifyChat("/notify/follow-accepted", {
    to: followerId,
    from: recipientId,
  }).catch(() => {});

  await redis.del(`user:auth:${followerId}`).catch(() => {});
  await redis.del(`user:auth:${recipientId}`).catch(() => {});

  return res.status(200).json({ success: true, message: "Follow request accepted." });
});

export const rejectFollowRequest = asyncHandler(async (req, res, next) => {
  const recipientId = req.user.id;
  const followerId = req.params.userId;

  const { rejected } = await FollowHelper.rejectRequest(followerId, recipientId);

  if (!rejected)
    return next(new AppError("Follow request not found.", 404));

  return res.status(200).json({ success: true, message: "Follow request rejected." });
});

export const getFollowRequests = asyncHandler(async (req, res) => {
  const { afterId } = req.query;
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  const { requests, nextCursor } = await FollowHelper.getPendingRequests(
    req.user.id,
    afterId || null,
    limit,
  );

  return res.status(200).json({ success: true, data: requests, nextCursor });
});

export const getFollowers = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { afterId } = req.query;
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  const { followers, nextCursor } = await FollowHelper.getFollowers(userId, afterId || null, limit);

  return res.status(200).json({
    success: true,
    data: followers.map((f) => f.follower),
    nextCursor,
  });
});

export const getFollowing = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { afterId } = req.query;
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  const { following, nextCursor } = await FollowHelper.getFollowing(userId, afterId || null, limit);

  return res.status(200).json({
    success: true,
    data: following.map((f) => f.following),
    nextCursor,
  });
});

export const getFollowStatus = asyncHandler(async (req, res, next) => {
  const viewerId = req.user.id;
  const { userId } = req.params;

  if (viewerId === userId) {
    return res.status(200).json({ success: true, status: "self" });
  }

  const status = await FollowHelper.getFollowStatus(viewerId, userId);

  return res.status(200).json({
    success: true,
    status: status ?? "none",
    isFollowing: status === "accepted",
  });
});

export const getMutualFollowers = asyncHandler(async (req, res, next) => {
  const viewerId = req.user.id;
  const { userId } = req.params;
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 6));

  const mutuals = await FollowHelper.getMutualFollowers(viewerId, userId, limit);

  return res.status(200).json({ success: true, data: mutuals, count: mutuals.length });
});

export const blockUser = asyncHandler(async (req, res, next) => {
  const blockerId = req.user.id;
  const { userId: blockedId } = req.params;

  if (blockerId === blockedId)
    return next(new AppError("You cannot block yourself.", 400));

  await FollowHelper.removeAllBetween(blockerId, blockedId);

  return res.status(200).json({ success: true, message: "User blocked." });
});