import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import User from "../../models/user.model.js";
import Post from "../../models/post.model.js";
import Report from "../../models/report.model.js";
import logger from "../../config/logger.js";
import {sendMail} from "../../utils/sendMail.js";
import { accountSuspended } from "../../mail/templates/accountSuspended.js";
import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

const ALLOWED_STATUSES = ["active", "pending", "suspended", "deactivated", "banned"];
const DURATION_MAP = {
  "1d":   1,
  "3d":   3,
  "7d":   7,
  "14d":  14,
  "30d":  30,
  "perm": null,
};

const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page < Math.ceil(total / limit),
  hasPrevPage: page > 1,
});

// ─────────────────────────────────────────────────────────────
//  GET /admin/users
//  Query: page, limit, search, status, role, sort
// ─────────────────────────────────────────────────────────────

// admin.user.controller.js mein getAllUsers function replace karo with this:

// admin.user.controller.js — getAllUsers function replace karo

export const getAllUsers = asyncHandler(async (req, res, next) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip  = (page - 1) * limit;

  const { search, status, role, sort, sortBy, sortOrder } = req.query;

  // ── Match stage — always exclude super_admin ─────────────────────────────
  const match = { role: { $ne: "super_admin" } };

  if (search?.trim()) {
    const regex = new RegExp(search.trim(), "i");
    match.$or = [
      { username: regex },
      { fullName: regex },
      { email: regex },
      { phoneNumber: regex },
    ];
  }

  if (status && ALLOWED_STATUSES.includes(status)) match.accountStatus = status;
  if (role && ["user", "moderator"].includes(role)) match.role = role;

  // ── Sort ─────────────────────────────────────────────────────────────────
  let sortStage;
  if (sortBy) {
    const order = sortOrder === "asc" ? 1 : -1;
    const allowed = {
      createdAt:      { createdAt: order },
      fullName:       { fullName: order },
      postsCount:     { actualPostsCount: order },
      followersCount: { followersCount: order },
      status:         { accountStatus: order },
    };
    sortStage = allowed[sortBy] ?? { createdAt: -1 };
  } else {
    const map = {
      newest:        { createdAt: -1 },
      oldest:        { createdAt:  1 },
      mostFollowers: { followersCount: -1 },
      mostPosts:     { actualPostsCount: -1 },
      username:      { username: 1 },
    };
    sortStage = map[sort] ?? map.newest;
  }

  // ── Aggregation pipeline ──────────────────────────────────────────────────
  const pipeline = [
    { $match: match },

    // Live post count from Post collection
    {
      $lookup: {
        from:         "posts",
        let:          { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$author", "$$userId"] },
                  { $ne: ["$isDeleted", true] },
                  { $ne: ["$isDraft",   true] },
                ],
              },
            },
          },
          { $count: "count" },
        ],
        as: "postCountArr",
      },
    },

    // Extract count from array
    {
      $addFields: {
        actualPostsCount: {
          $ifNull: [{ $arrayElemAt: ["$postCountArr.count", 0] }, 0],
        },
      },
    },

    { $unset: "postCountArr" },
    { $sort: sortStage },

    // Count total before pagination
    {
      $facet: {
        metadata: [{ $count: "total" }],
        users: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              username: 1, fullName: 1, email: 1, phoneNumber: 1,
              avatar: 1, accountStatus: 1, role: 1,
              isVerifiedBadge: 1, isEmailVerified: 1, isMobileVerified: 1,
              followersCount: 1, followingCount: 1,
              postsCount: "$actualPostsCount",
              createdAt: 1, businessCategory: 1, location: 1,
              authProvider: 1, isOnboardingComplete: 1,
            },
          },
        ],
      },
    },
  ];

  const [result] = await User.aggregate(pipeline);

  const users = result.users ?? [];
  const total = result.metadata[0]?.total ?? 0;

  logger.info("Admin fetched users list", { adminId: req.user._id, match, total });

  return res.status(200).json({
    success: true,
    data: users,
    pagination: paginationMeta(total, page, limit),
  });
});
// ─────────────────────────────────────────────────────────────
//  GET /admin/users/:id
//  Full user profile for admin
// ─────────────────────────────────────────────────────────────

export const getUserById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const user = await User.findById(id)
    .select("-password -refreshTokens -firebaseUid -__v")
    .lean();

  if (!user) return next(new AppError("User not found", 404));

  // ── Fetch recent posts ────────────────────────────────────────
  const [posts, reportStats] = await Promise.all([
  Post.find({ author: id, isDeleted: { $ne: true }, isDraft: { $ne: true } })
  .select("caption type media likesCount commentsCount viewsCount createdAt")
  .sort({ createdAt: -1 })
  .limit(10)
  .lean(),

    Report.aggregate([
    { $match: { targetId: new mongoose.Types.ObjectId(id), targetModel: "User" } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },

      },
    ]),
  ]);

  // Shape report stats
  const reports = { pending: 0, resolved: 0, dismissed: 0, total: 0 };
  reportStats.forEach(({ _id, count }) => {
    if (_id in reports) reports[_id] = count;
    reports.total += count;
  });

  logger.info("Admin viewed user profile", {
    adminId: req.user._id,
    targetUserId: id,
  });

  return res.status(200).json({
    success: true,
    data: { user, posts, reportStats: reports },
  });
});

// ─────────────────────────────────────────────────────────────
//  GET /admin/users/:id/posts
//  All posts of a user with pagination
// ─────────────────────────────────────────────────────────────

export const getUserPosts = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip  = (page - 1) * limit;

  const user = await User.findById(id).select("_id username fullName").lean();
  if (!user) return next(new AppError("User not found", 404));

  const filter = { author: id, isDeleted: { $ne: true } };

  const [posts, total] = await Promise.all([
  Post.find(filter)
  .select("caption type media likesCount commentsCount viewsCount createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Post.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    data: posts,
    user,
    pagination: paginationMeta(total, page, limit),
  });
});

// ─────────────────────────────────────────────────────────────
//  GET /admin/users/:id/reports
//  All reports against a user
// ─────────────────────────────────────────────────────────────

export const getUserReports = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip  = (page - 1) * limit;

  const user = await User.findById(id).select("_id username fullName").lean();
  if (!user) return next(new AppError("User not found", 404));

  const filter = { targetId: id, targetModel: "User" };

  const [reports, total] = await Promise.all([
    Report.find(filter)
      .populate("reportedBy", "username fullName avatar")
      .populate("targetId", "caption media createdAt type")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Report.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    data: reports,
    user,
    pagination: paginationMeta(total, page, limit),
  });
});

// ─────────────────────────────────────────────────────────────
//  PATCH /admin/users/:id/status
//  Change accountStatus: suspend / ban / activate / deactivate
// ─────────────────────────────────────────────────────────────

export const updateUserStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status, reason, duration } = req.body;

  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return next(new AppError(`Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}`, 400));
  }

  const target = await User.findById(id)
    .select("email username fullName accountStatus role activeSuspension suspensionHistory");
  if (!target) return next(new AppError("User not found", 404));

  if (target.role === "super_admin" && req.user._id.toString() !== target._id.toString()) {
    return next(new AppError("Cannot modify another super admin account", 403));
  }

  const previousStatus = target.accountStatus;
  target.accountStatus = status;

  if (status === "suspended") {
    if (!reason?.trim()) return next(new AppError("Reason is required for suspension", 400));
    if (!duration || !(duration in DURATION_MAP)) {
      return next(new AppError("Valid duration required: 1d, 3d, 7d, 14d, 30d, perm", 400));
    }

    const days      = DURATION_MAP[duration];
    const expiresAt = days ? new Date(Date.now() + days * 86_400_000) : null;

    target.activeSuspension = {
      suspendedAt: new Date(),
      suspendedBy: req.user._id,
      reason:      reason.trim(),
      duration:    days,
      expiresAt,
    };

    target.suspensionHistory.push({
      action:      "suspended",
      performedBy: req.user._id,
      reason:      reason.trim(),
      duration:    days,
      expiresAt,
    });

  } else if (status === "active" && previousStatus === "suspended") {
    target.activeSuspension = {
      suspendedAt: null, suspendedBy: null,
      reason: null, duration: null, expiresAt: null,
    };
    target.suspensionHistory.push({
      action:      "unsuspended",
      performedBy: req.user._id,
      reason:      reason?.trim() || "Manually lifted by admin",
      duration:    null,
      expiresAt:   null,
    });

  } else if (status === "banned") {
    if (!reason?.trim()) return next(new AppError("Reason is required for ban", 400));
    target.activeSuspension = {
      suspendedAt: null, suspendedBy: null,
      reason: null, duration: null, expiresAt: null,
    };
    target.suspensionHistory.push({
      action:      "banned",
      performedBy: req.user._id,
      reason:      reason.trim(),
      duration:    null,
      expiresAt:   null,
    });
  }

  await target.save({ validateBeforeSave: false });

  if ((status === "suspended" || status === "banned") && target.email) {
    try {
      await sendMail({
        to: target.email,
        subject: status === "banned"
          ? "Your account has been permanently banned"
          : "Your account has been temporarily suspended",
        html: accountSuspended({
          fullName:  target.fullName,
          status,
          reason:    reason || "Violation of community guidelines",
          expiresAt: target.activeSuspension?.expiresAt ?? null,
        }),
      });
    } catch (mailErr) {
      logger.error("Failed to send account status email", { mailErr });
    }
  }

  logger.info("Admin updated user status", {
    adminId:      req.user._id,
    targetUserId: id,
    previousStatus,
    newStatus:    status,
    reason,
    duration,
  });

  return res.status(200).json({
    success: true,
    message: `User status updated to '${status}' successfully`,
    data: {
      _id:              target._id,
      username:         target.username,
      accountStatus:    target.accountStatus,
      activeSuspension: target.activeSuspension,
    },
  });
});

// ─────────────────────────────────────────────────────────────
//  DELETE /admin/users/:id
//  Permanently delete a user account
// ─────────────────────────────────────────────────────────────

export const deleteUserAccount = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const target = await User.findById(id).select("username email role");
  if (!target) return next(new AppError("User not found", 404));

  if (target.role === "super_admin") {
    return next(new AppError("Cannot delete a super admin account", 403));
  }

  // Soft-delete posts (mark isDeleted = true)
  await Post.updateMany(
    { author: id },
    { $set: { isDeleted: true, deletedAt: new Date() } }
  );

  await User.findByIdAndDelete(id);

  logger.warn("Admin DELETED user account", {
    adminId: req.user._id,
    deletedUserId: id,
    deletedUsername: target.username,
  });

  return res.status(200).json({
    success: true,
    message: `User @${target.username} deleted permanently`,
  });
});

// ─────────────────────────────────────────────────────────────
//  DELETE /admin/posts/:postId
//  Delete a specific post
// ─────────────────────────────────────────────────────────────

export const deletePost = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;

  const post = await Post.findById(postId).populate("author", "username");
  if (!post) return next(new AppError("Post not found", 404));

  post.isDeleted  = true;
  post.deletedAt  = new Date();
  post.deletedBy  = req.user._id; // Admin who deleted
  await post.save({ validateBeforeSave: false });

  // Decrement postsCount on user
// REPLACE:
await User.findOneAndUpdate(
  { _id: post.author._id, postsCount: { $gt: 0 } },
  { $inc: { postsCount: -1 } }
);

  logger.warn("Admin deleted post", {
    adminId: req.user._id,
    postId,
    authorUsername: post.author?.username,
  });

  return res.status(200).json({
    success: true,
    message: "Post deleted successfully",
  });
});

// ─────────────────────────────────────────────────────────────
//  PATCH /admin/users/:id/verify-badge
//  Toggle verified badge
// ─────────────────────────────────────────────────────────────

export const toggleVerifiedBadge = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const user = await User.findById(id).select("username isVerifiedBadge");
  if (!user) return next(new AppError("User not found", 404));

  user.isVerifiedBadge = !user.isVerifiedBadge;
  await user.save({ validateBeforeSave: false });

  logger.info("Admin toggled verified badge", {
    adminId: req.user._id,
    targetUserId: id,
    isVerifiedBadge: user.isVerifiedBadge,
  });

  return res.status(200).json({
    success: true,
    message: `Verified badge ${user.isVerifiedBadge ? "granted" : "revoked"} for @${user.username}`,
    data: { isVerifiedBadge: user.isVerifiedBadge },
  });
});

// ─────────────────────────────────────────────────────────────
//  GET /admin/stats
//  Dashboard overview stats
// ─────────────────────────────────────────────────────────────

export const getDashboardStats = asyncHandler(async (req, res, next) => {
  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    bannedUsers,
    totalPosts,
    pendingReports,
    newUsersToday,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ accountStatus: "active" }),
    User.countDocuments({ accountStatus: "suspended" }),
    User.countDocuments({ accountStatus: "banned" }),
    Post.countDocuments({ isDeleted: { $ne: true } }),
    Report.countDocuments({ status: "pending" }),
    User.countDocuments({
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers, banned: bannedUsers },
      posts: { total: totalPosts },
      reports: { pending: pendingReports },
      today: { newUsers: newUsersToday },
    },
  });
});


// ─────────────────────────────────────────────────────────────
//  GET /admin/posts
//  All posts with pagination, filters, search
//  Add this at the END of admin.user.controller.js
// ─────────────────────────────────────────────────────────────

export const getAllPosts = asyncHandler(async (req, res, next) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip  = (page - 1) * limit;

  const {
    type,
    search,
    sortBy    = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // ── Build filter ────────────────────────────────────────────
  const filter = {
    isDeleted: { $ne: true },
    isDraft:   { $ne: true },
  };

  if (type && ["image", "reel", "text"].includes(type)) {
    filter.type = type;
  }

  if (search?.trim()) {
    filter.caption = { $regex: search.trim(), $options: "i" };
  }

  // ── Allowed sort fields (prevent injection) ─────────────────
  const SORT_WHITELIST = ["createdAt", "likesCount", "commentsCount", "viewsCount"];
  const sortField = SORT_WHITELIST.includes(sortBy) ? sortBy : "createdAt";
  const sortDir   = sortOrder === "asc" ? 1 : -1;

  // ── Parallel: posts + total count ───────────────────────────
  const [posts, total] = await Promise.all([
    Post.find(filter)
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(limit)
      .populate("author", "username fullName avatar isVerifiedBadge accountStatus")
      .select("caption type media likesCount commentsCount viewsCount createdAt author")
      .lean(),
    Post.countDocuments(filter),
  ]);

  logger.info("Admin fetched all posts", {
    adminId: req.user._id,
    filter,
    total,
    page,
  });

  return res.status(200).json({
    success: true,
    data: posts,
    pagination: paginationMeta(total, page, limit),
  });
});


// ─────────────────────────────────────────────────────────────
//  POST /admin/users/bulk-status
//  Bulk suspend / ban (max 50)
// ─────────────────────────────────────────────────────────────
export const bulkUpdateStatus = asyncHandler(async (req, res, next) => {
  const { userIds, status, reason, duration } = req.body;

  if (!Array.isArray(userIds) || !userIds.length)
    return next(new AppError("userIds array required", 400));
  if (userIds.length > 50)
    return next(new AppError("Max 50 users per bulk action", 400));
  if (!status || !ALLOWED_STATUSES.includes(status))
    return next(new AppError("Invalid status", 400));
  if (status === "suspended" && (!duration || !(duration in DURATION_MAP)))
    return next(new AppError("Valid duration required for suspension", 400));
  if ((status === "suspended" || status === "banned") && !reason?.trim())
    return next(new AppError("Reason is required", 400));

  const days      = status === "suspended" ? DURATION_MAP[duration] : null;
  const expiresAt = days ? new Date(Date.now() + days * 86_400_000) : null;

  const results = { success: [], failed: [] };

  await Promise.allSettled(
    userIds.map(async (userId) => {
      try {
        const user = await User.findById(userId)
          .select("role accountStatus activeSuspension suspensionHistory username");
        if (!user || user.role === "super_admin") throw new Error("Not allowed");

        user.accountStatus = status;

        if (status === "suspended") {
          user.activeSuspension = {
            suspendedAt: new Date(),
            suspendedBy: req.user._id,
            reason:      reason.trim(),
            duration:    days,
            expiresAt,
          };
          user.suspensionHistory.push({
            action:      "suspended",
            performedBy: req.user._id,
            reason:      reason.trim(),
            duration:    days,
            expiresAt,
          });
        }

        await user.save({ validateBeforeSave: false });
        results.success.push(userId);
      } catch (err) {
        results.failed.push({ userId, error: err.message });
      }
    })
  );

  logger.info("Admin bulk status update", {
    adminId: req.user._id, status,
    total: userIds.length, ...results,
  });

  return res.status(200).json({ success: true, data: results });
});

// ─────────────────────────────────────────────────────────────
//  GET /admin/users/:id/suspension-history
// ─────────────────────────────────────────────────────────────
export const getSuspensionHistory = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .select("username fullName accountStatus activeSuspension suspensionHistory")
    .populate("suspensionHistory.performedBy", "username fullName")
    .populate("activeSuspension.suspendedBy",  "username fullName")
    .lean();

  if (!user) return next(new AppError("User not found", 404));

  return res.status(200).json({
    success: true,
    data: {
      activeSuspension:  user.activeSuspension,
      suspensionHistory: [...user.suspensionHistory].reverse(),
    },
  });
});