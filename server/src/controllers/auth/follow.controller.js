// import mongoose from "mongoose";
// import asyncHandler from "../../middlewares/asyncHandler.js";
// import AppError from "../../utils/AppError.js";
// import Follow from "../../models/follow.model.js";
// import User from "../../models/user.model.js";
// import { notifyChat } from "../../helper/notifyChat.js";


// // ─────────────────────────────────────────────
// //  POST /api/v2/follow/:userId
// //  Follow ya follow request bhejo
// // ─────────────────────────────────────────────
// export const followUser = asyncHandler(async (req, res, next) => {
//   const followerId  = req.user._id;
//   const followingId = req.params.userId;

//   if (!mongoose.Types.ObjectId.isValid(followingId)) {
//     return next(new AppError("Invalid user ID.", 400));
//   }

//   if (followerId.equals(followingId)) {
//     return next(new AppError("Aap khud ko follow nahi kar sakte.", 400));
//   }

//   const targetUser = await User.findById(followingId);
//   if (!targetUser || targetUser.accountStatus !== "active") {
//     return next(new AppError("User not found.", 404));
//   }

//   const existing = await Follow.findOne({
//     follower:  followerId,
//     following: followingId,
//   });

//   if (existing) {
//     return res.status(200).json({
//       success: true,
//       status:  existing.status,
//       message: existing.status === "accepted" ? "Already following." : "Request already pending.",
//     });
//   }

//   const status = targetUser.isPrivate ? "pending" : "accepted";

//   await Follow.create({ follower: followerId, following: followingId, status });

//   if (status === "accepted") {
//     await User.findByIdAndUpdate(followingId, { $inc: { followersCount: 1 } });
//     await User.findByIdAndUpdate(followerId,  { $inc: { followingCount: 1 } });
//   }

//   notifyChat("/notify/follow", {
//     to:   followingId.toString(),
//     from: followerId.toString(),
//     sender: {
//       fullName: req.user.fullName || req.user.username || "",
//       username: req.user.username || "",
//       avatar:   req.user.avatar?.url || null,
//     },
//   }).catch(() => {});

//   return res.status(200).json({
//     success: true,
//     status,
//     message: "Successfully followed.",
//   });
// });

// // ─────────────────────────────────────────────
// //  DELETE /api/v2/follow/:userId
// //  Unfollow ya request cancel karo
// // ─────────────────────────────────────────────
// export const unfollowUser = asyncHandler(async (req, res, next) => {
//   const followerId  = req.user._id;
//   const followingId = req.params.userId;

//   const existing = await Follow.findOne({
//     follower:  followerId,
//     following: followingId,
//   });

//   if (!existing) {
//     return next(new AppError("You are not following this user.", 404));
//   }

//   const wasAccepted = existing.status === "accepted";
//   await existing.deleteOne();

//   // Count update sirf accepted tha toh
//   if (wasAccepted) {
//     await User.findByIdAndUpdate(followingId, { $inc: { followersCount: -1 } });
//     await User.findByIdAndUpdate(followerId,  { $inc: { followingCount: -1 } });
//   }

//   return res.status(200).json({
//     success: true,
//     message: wasAccepted ? "Unfollowed successfully." : "Follow request cancelled.",
//   });
// });

// // ─────────────────────────────────────────────
// //  GET /api/v2/follow/requests
// //  Apne pending follow requests dekho
// // ─────────────────────────────────────────────
// export const getFollowRequests = asyncHandler(async (req, res, next) => {

// const page  = Math.max(1, parseInt(req.query.page)  || 1);
// const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

//   const requests = await Follow.getPendingRequests(req.user._id, page, limit);
//   const total    = await Follow.countDocuments({ following: req.user._id, status: "pending" });

//   return res.status(200).json({
//     success: true,
//     data: {
//       requests,
//       total,
//       hasMore: page * limit < total,
//     },
//   });
// });

// // ─────────────────────────────────────────────
// //  PATCH /api/v2/follow/requests/:userId/accept
// //  Follow request accept karo
// // ─────────────────────────────────────────────
// export const acceptFollowRequest = asyncHandler(async (req, res, next) => {
//   const followingId = req.user._id;
//   const followerId  = req.params.userId;

//   const result = await Follow.acceptRequest(followerId, followingId);
//   if (!result) {
//     return next(new AppError("Follow request not found.", 404));
//   }

//   // Count update
//   await User.findByIdAndUpdate(followingId, { $inc: { followersCount: 1 } });
//   await User.findByIdAndUpdate(followerId,  { $inc: { followingCount: 1 } });

//   return res.status(200).json({
//     success: true,
//     message: "Follow request accepted.",
//   });
// });

// // ─────────────────────────────────────────────
// //  DELETE /api/v2/follow/requests/:userId/reject
// //  Follow request reject karo
// // ─────────────────────────────────────────────
// export const rejectFollowRequest = asyncHandler(async (req, res, next) => {
//   const followingId = req.user._id;
//   const followerId  = req.params.userId;

//   const result = await Follow.rejectRequest(followerId, followingId);
//   if (!result) {
//     return next(new AppError("Follow request not found.", 404));
//   }

//   return res.status(200).json({
//     success: true,
//     message: "Follow request rejected.",
//   });
// });

// // ─────────────────────────────────────────────
// //  GET /api/v2/follow/:userId/followers
// //  Kisi user ke followers
// // ─────────────────────────────────────────────
// export const getFollowers = asyncHandler(async (req, res, next) => {
//   const { userId } = req.params;
//   const page  = Math.max(1, parseInt(req.query.page)  || 1);
// const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

//   const followers = await Follow.find({ following: userId, status: "accepted" })
//     .sort({ createdAt: -1 })
//     .skip((page - 1) * limit)
//     .limit(limit)
//     .populate("follower", "username fullName avatar isVerifiedBadge isPrivate followersCount");

//   const total = await Follow.countDocuments({ following: userId, status: "accepted" });

//   return res.status(200).json({
//     success: true,
//     data: {
//       followers: followers.map((f) => f.follower),
//       total,
//       hasMore: page * limit < total,
//     },
//   });
// });

// // ─────────────────────────────────────────────
// //  GET /api/v2/follow/:userId/following
// //  Kisi user ke following
// // ─────────────────────────────────────────────
// export const getFollowing = asyncHandler(async (req, res, next) => {
//   const { userId } = req.params;
//   const page  = Math.max(1, parseInt(req.query.page)  || 1);
// const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

//   const following = await Follow.find({ follower: userId, status: "accepted" })
//     .sort({ createdAt: -1 })
//     .skip((page - 1) * limit)
//     .limit(limit)
//     .populate("following", "username fullName avatar isVerifiedBadge isPrivate followersCount");

//   const total = await Follow.countDocuments({ follower: userId, status: "accepted" });

//   return res.status(200).json({
//     success: true,
//     data: {
//       following: following.map((f) => f.following),
//       total,
//       hasMore: page * limit < total,
//     },
//   });
// });


// server/src/controllers/follow.controller.js
import mongoose from "mongoose";
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import Follow from "../../models/follow.model.js";
import User from "../../models/user.model.js";
import { notifyChat } from "../../helper/notifyChat.js";

// ─────────────────────────────────────────────
//  POST /api/v2/follow/:userId
// ─────────────────────────────────────────────
export const followUser = asyncHandler(async (req, res, next) => {
  const followerId  = req.user._id;
  const followingId = req.params.userId;

  if (!mongoose.Types.ObjectId.isValid(followingId))
    return next(new AppError("Invalid user ID.", 400));

  if (followerId.equals(followingId))
    return next(new AppError("Aap khud ko follow nahi kar sakte.", 400));

  const targetUser = await User.findById(followingId);
  if (!targetUser || targetUser.accountStatus !== "active")
    return next(new AppError("User not found.", 404));

  const existing = await Follow.findOne({ follower: followerId, following: followingId });
  if (existing) {
    return res.status(200).json({
      success: true,
      status:  existing.status,
      message: existing.status === "accepted" ? "Already following." : "Request already pending.",
    });
  }

  const status = targetUser.isPrivate ? "pending" : "accepted";
  await Follow.create({ follower: followerId, following: followingId, status });

  if (status === "accepted") {
    await User.findByIdAndUpdate(followingId, { $inc: { followersCount: 1 } });
    await User.findByIdAndUpdate(followerId,  { $inc: { followingCount: 1 } });
  }

  // type pass karo — chat-server decide karega follow ya follow_request
  notifyChat("/notify/follow", {
    to:   followingId.toString(),
    from: followerId.toString(),
    type: status === "accepted" ? "follow" : "follow_request",
  }).catch(() => {});

  return res.status(200).json({ success: true, status, message: "Successfully followed." });
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/follow/:userId
// ─────────────────────────────────────────────
export const unfollowUser = asyncHandler(async (req, res, next) => {
  const followerId  = req.user._id;
  const followingId = req.params.userId;

  const existing = await Follow.findOne({ follower: followerId, following: followingId });
  if (!existing) return next(new AppError("You are not following this user.", 404));

  const wasAccepted = existing.status === "accepted";
  await existing.deleteOne();

  if (wasAccepted) {
    await User.findByIdAndUpdate(followingId, { $inc: { followersCount: -1 } });
    await User.findByIdAndUpdate(followerId,  { $inc: { followingCount: -1 } });
  }

  return res.status(200).json({
    success: true,
    message: wasAccepted ? "Unfollowed successfully." : "Follow request cancelled.",
  });
});

// ─────────────────────────────────────────────
//  GET /api/v2/follow/requests
// ─────────────────────────────────────────────
export const getFollowRequests = asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  const requests = await Follow.getPendingRequests(req.user._id, page, limit);
  const total    = await Follow.countDocuments({ following: req.user._id, status: "pending" });

  return res.status(200).json({
    success: true,
    data: { requests, total, hasMore: page * limit < total },
  });
});

// ─────────────────────────────────────────────
//  PATCH /api/v2/follow/requests/:userId/accept
// ─────────────────────────────────────────────
export const acceptFollowRequest = asyncHandler(async (req, res, next) => {
  const followingId = req.user._id;   // jo accept kar raha hai
  const followerId  = req.params.userId; // jisne request bheja tha

  const result = await Follow.acceptRequest(followerId, followingId);
  if (!result) return next(new AppError("Follow request not found.", 404));

  await User.findByIdAndUpdate(followingId, { $inc: { followersCount: 1 } });
  await User.findByIdAndUpdate(followerId,  { $inc: { followingCount: 1 } });

  // followerId ko batao ki unki request accept ho gayi
  notifyChat("/notify/follow-accepted", {
    to:   followerId.toString(),   // jisne request bheja — use notification jaayegi
    from: followingId.toString(),  // jo accept kar raha hai
  }).catch(() => {});

  return res.status(200).json({ success: true, message: "Follow request accepted." });
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/follow/requests/:userId/reject
// ─────────────────────────────────────────────
export const rejectFollowRequest = asyncHandler(async (req, res, next) => {
  const followingId = req.user._id;
  const followerId  = req.params.userId;

  const result = await Follow.rejectRequest(followerId, followingId);
  if (!result) return next(new AppError("Follow request not found.", 404));

  return res.status(200).json({ success: true, message: "Follow request rejected." });
});

// ─────────────────────────────────────────────
//  GET /api/v2/follow/:userId/followers
// ─────────────────────────────────────────────
export const getFollowers = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  const followers = await Follow.find({ following: userId, status: "accepted" })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("follower", "username fullName avatar isVerifiedBadge isPrivate followersCount");

  const total = await Follow.countDocuments({ following: userId, status: "accepted" });

  return res.status(200).json({
    success: true,
    data: {
      followers: followers.map((f) => f.follower),
      total,
      hasMore: page * limit < total,
    },
  });
});

// ─────────────────────────────────────────────
//  GET /api/v2/follow/:userId/following
// ─────────────────────────────────────────────
export const getFollowing = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  const following = await Follow.find({ follower: userId, status: "accepted" })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("following", "username fullName avatar isVerifiedBadge isPrivate followersCount");

  const total = await Follow.countDocuments({ follower: userId, status: "accepted" });

  return res.status(200).json({
    success: true,
    data: {
      following: following.map((f) => f.following),
      total,
      hasMore: page * limit < total,
    },
  });
});