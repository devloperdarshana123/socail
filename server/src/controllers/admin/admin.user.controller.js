
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError     from "../../utils/AppError.js";
import * as AdminUserHelper from "../../utils/adminUserHelpers.js";
import logger       from "../../config/logger.js";
import { sendMail } from "../../utils/sendMail.js";
import { postDeleted }      from "../../mail/templates/postDeleted.js";
import { accountSuspended } from "../../mail/templates/accountSuspended.js";
import redis from "../../config/redis.js";

// ─────────────────────────────────────────────────────────────
//  Constants
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
  totalPages:  Math.ceil(total / limit),
  hasNextPage: page < Math.ceil(total / limit),
  hasPrevPage: page > 1,
});

// ─────────────────────────────────────────────────────────────
//  GET /admin/users
// ─────────────────────────────────────────────────────────────

export const getAllUsers = asyncHandler(async (req, res, next) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip  = (page - 1) * limit;

  const { search, status, role, sort, sortBy, sortOrder } = req.query;

  // ── Build where — always exclude super_admin ─────────────────
  const where = { role: { not: "super_admin" } };

  if (search?.trim()) {
    where.or = [
      { username:    { like: search.trim(), caseInsensitive: true } },
      { fullName:    { like: search.trim(), caseInsensitive: true } },
      { email:       { like: search.trim(), caseInsensitive: true } },
      { phoneNumber: { like: search.trim(), caseInsensitive: true } },
    ];
  }

  if (status && ALLOWED_STATUSES.includes(status)) where.accountStatus = status;
  if (role && ["user", "moderator"].includes(role)) where.role = role;

  // ── Sort ──────────────────────────────────────────────────────
  let orderBy;
  if (sortBy) {
    const order = sortOrder === "asc" ? "asc" : "desc";
    const allowed = {
      createdAt:      { createdAt: order },
      fullName:       { fullName:  order },
      followersCount: { followersCount: order },
      status:         { accountStatus:  order },
      postsCount:     { postsCount:     order },
    };
    orderBy = allowed[sortBy] ?? { createdAt: "desc" };
  } else {
    const map = {
      newest:        { createdAt:      "desc" },
      oldest:        { createdAt:      "asc"  },
      mostFollowers: { followersCount: "desc" },
      mostPosts:     { postsCount:     "desc" },
      username:      { username:       "asc"  },
    };
    orderBy = map[sort] ?? map.newest;
  }

  // ── Parallel: users + count ───────────────────────────────────
  const [users, total] = await Promise.all([
    AdminUserHelper.findUsers(where, orderBy, skip, limit),
    AdminUserHelper.countUsers(where),
  ]);

  logger.info("Admin fetched users list", { adminId: req.user.id, total });

  const mapped = users.map((u) => ({
    ...u,
    postsCount: u._count?.posts ?? 0,
    _count: undefined,
  }));

  return res.status(200).json({
    success: true,
    data:       mapped,
    pagination: paginationMeta(total, page, limit),
  });
});

// ─────────────────────────────────────────────────────────────
//  GET /admin/users/:id
// ─────────────────────────────────────────────────────────────

export const getUserById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const user = await AdminUserHelper.findUserProfile(id);

  if (!user) return next(new AppError("User not found", 404));

  // Recent posts + report stats in parallel
  const [posts, reportsByStatus] = await Promise.all([
    AdminUserHelper.findRecentUserPosts(id),

    // Report stats grouped by status
    AdminUserHelper.groupUserReportsByStatus(id),
  ]);

  // Shape report stats
  const reportStats = { pending: 0, resolved: 0, dismissed: 0, total: 0 };
  reportsByStatus.forEach(({ key: status, count }) => {
    if (status in reportStats) reportStats[status] = count;
    reportStats.total += count;
  });

  logger.info("Admin viewed user profile", { adminId: req.user.id, targetUserId: id });

  return res.status(200).json({
    success: true,
    data: { user, posts, reportStats },
  });
});

// ─────────────────────────────────────────────────────────────
//  GET /admin/users/:id/posts
// ─────────────────────────────────────────────────────────────

export const getUserPosts = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip  = (page - 1) * limit;

  const user = await AdminUserHelper.findUserIdentity(id);
  if (!user) return next(new AppError("User not found", 404));

  const where = { authorId: id, isDeleted: false };

  const [posts, total] = await Promise.all([
    AdminUserHelper.findUserPosts(where, skip, limit),
    AdminUserHelper.countPosts(where),
  ]);

  return res.status(200).json({
    success: true,
    data:       posts,
    user,
    pagination: paginationMeta(total, page, limit),
  });
});

// ─────────────────────────────────────────────────────────────
//  GET /admin/users/:id/reports
// ─────────────────────────────────────────────────────────────

export const getUserReports = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip  = (page - 1) * limit;

  const user = await AdminUserHelper.findUserIdentity(id);
  if (!user) return next(new AppError("User not found", 404));

  const where = { reportedById: id };

  const [reports, total] = await Promise.all([
    AdminUserHelper.findUserReports(where, skip, limit),
    AdminUserHelper.countReports(where),
  ]);

  return res.status(200).json({
    success: true,
    data:       reports,
    user,
    pagination: paginationMeta(total, page, limit),
  });
});

// ─────────────────────────────────────────────────────────────
//  PATCH /admin/users/:id/status
// ─────────────────────────────────────────────────────────────

export const updateUserStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status, reason, duration } = req.body;

  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return next(new AppError(`Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}`, 400));
  }

  const target = await AdminUserHelper.findUserForStatusChange(id);
  if (!target) return next(new AppError("User not found", 404));

  if (target.role === "super_admin" && req.user.id !== target.id) {
    return next(new AppError("Cannot modify another super admin account", 403));
  }

  const previousStatus = target.accountStatus;

  // Build update data
  const data = { accountStatus: status };

  if (status === "suspended") {
    if (!reason?.trim())
      return next(new AppError("Reason is required for suspension", 400));
    if (!duration || !(duration in DURATION_MAP))
      return next(new AppError("Valid duration required: 1d, 3d, 7d, 14d, 30d, perm", 400));

    const days      = DURATION_MAP[duration];
    const expiresAt = days ? new Date(Date.now() + days * 86_400_000) : null;

    data.activeSuspension = {
      suspendedAt: new Date(),
      suspendedBy: req.user.id,
      reason:      reason.trim(),
      duration:    days,
      expiresAt,
    };

    // Add to suspension history
    await AdminUserHelper.createSuspensionHistory({
      userId:      id,
      action:      "suspended",
      performedBy: req.user.id,
      reason:      reason.trim(),
      duration:    days,
      expiresAt,
    });

  } else if (status === "active" && previousStatus === "suspended") {
    data.activeSuspension = null;

    await AdminUserHelper.createSuspensionHistory({
      userId:      id,
      action:      "unsuspended",
      performedBy: req.user.id,
      reason:      reason?.trim() || "Manually lifted by admin",
      duration:    null,
      expiresAt:   null,
    });

  } else if (status === "banned") {
    if (!reason?.trim())
      return next(new AppError("Reason is required for ban", 400));

    data.activeSuspension = null;

    await AdminUserHelper.createSuspensionHistory({
      userId:      id,
      action:      "banned",
      performedBy: req.user.id,
      reason:      reason.trim(),
      duration:    null,
      expiresAt:   null,
    });
  }

  const updated = await AdminUserHelper.updateUserStatusById(id, data);

  // Clear Redis cache
  try { await redis.del("admin:stats"); } catch { /* ignore */ }

  // Send email notification
  // Send email notification
  if ((status === "suspended" || status === "banned" || status === "deactivated") && target.email) {
    const { subject, html } = accountSuspended({
      fullName:  target.fullName,
      status,
      reason:    reason || "Violation of community guidelines",
      expiresAt: data.activeSuspension?.expiresAt ?? null,
    });

    sendMail({
      to: target.email,
      subject,
      html,
    }).catch((mailErr) => {
      logger.error("Failed to send account status email", {
        to:    target.email,
        status,
        error: mailErr.message,
        stack: mailErr.stack,
      });
    });
  }

  logger.info("Admin updated user status", {
    adminId:      req.user.id,
    targetUserId: id,
    previousStatus,
    newStatus:    status,
    reason,
    duration,
  });

  return res.status(200).json({
    success: true,
    message: `User status updated to '${status}' successfully`,
    data:    updated,
  });
});

// ─────────────────────────────────────────────────────────────
//  DELETE /admin/users/:id
// ─────────────────────────────────────────────────────────────

export const deleteUserAccount = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const target = await AdminUserHelper.findUserForDeletion(id);
  if (!target) return next(new AppError("User not found", 404));

  if (target.role === "super_admin") {
    return next(new AppError("Cannot delete a super admin account", 403));
  }

  // Soft-delete all posts + hard-delete user in transaction
  await AdminUserHelper.deleteUserAndSoftDeleteTheirPosts(id, {
    isDeleted: true, deletedAt: new Date(),
  });

  logger.warn("Admin DELETED user account", {
    adminId:         req.user.id,
    deletedUserId:   id,
    deletedUsername: target.username,
  });

  return res.status(200).json({
    success: true,
    message: `User @${target.username} deleted permanently`,
  });
});

// ─────────────────────────────────────────────────────────────
//  DELETE /admin/posts/:postId
// ─────────────────────────────────────────────────────────────

export const deletePost = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const { reason }  = req.body;

  const post = await AdminUserHelper.findPostForDeletion(postId);

  if (!post) return next(new AppError("Post not found", 404));

  const deletedAt = new Date();

  // Soft-delete post + decrement postsCount (guard: never below 0) in transaction
  await AdminUserHelper.softDeletePostAndDecrementAuthorCount(
    postId,
    { isDeleted: true, deletedAt },
    post.author.id,
    post.author.postsCount,
  );

  // Send email (fire-and-forget)
  if (post.author?.email) {
    sendMail({
      to:      post.author.email,
      toName:  post.author.fullName,
      subject: "Your post has been removed by our moderation team",
      html: postDeleted({
        fullName:    post.author.fullName,
        postCaption: post.caption ?? "",
        reason:      reason?.trim() || "Violation of community guidelines",
        deletedAt,
      }),
    }).catch((mailErr) => {
      logger.error("Failed to send post deletion email", {
        adminId:  req.user.id,
        postId,
        authorId: post.author.id,
        error:    mailErr.message,
      });
    });
  }

  logger.warn("Admin deleted post", {
    adminId:        req.user.id,
    postId,
    authorId:       post.author.id,
    authorUsername: post.author.username,
    reason:         reason?.trim() || null,
  });

  return res.status(200).json({ success: true, message: "Post deleted successfully" });
});

// ─────────────────────────────────────────────────────────────
//  PATCH /admin/users/:id/verify-badge
// ─────────────────────────────────────────────────────────────

export const toggleVerifiedBadge = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const user = await AdminUserHelper.findUserBadgeState(id);
  if (!user) return next(new AppError("User not found", 404));

  const updated = await AdminUserHelper.updateUserVerifiedBadge(id, !user.isVerifiedBadge);

  logger.info("Admin toggled verified badge", {
    adminId:        req.user.id,
    targetUserId:   id,
    isVerifiedBadge: updated.isVerifiedBadge,
  });

  return res.status(200).json({
    success: true,
    message: `Verified badge ${updated.isVerifiedBadge ? "granted" : "revoked"} for @${user.username}`,
    data:    { isVerifiedBadge: updated.isVerifiedBadge },
  });
});

// ─────────────────────────────────────────────────────────────
//  GET /admin/stats
// ─────────────────────────────────────────────────────────────

export const getDashboardStats = asyncHandler(async (req, res, next) => {
  try {
    const cached = await redis.get("admin:stats");
    if (cached) {
      return res.status(200).json({ success: true, data: JSON.parse(cached), fromCache: true });
    }
  } catch { /* ignore */ }

  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));

const [totalUsers, activeUsers, suspendedUsers, bannedUsers, verifiedUsers, totalPosts, pendingReports, newUsersToday] =
    await Promise.all([
      AdminUserHelper.countUsers({ role: { not: "super_admin" } }),
      AdminUserHelper.countUsers({ role: { not: "super_admin" }, accountStatus: "active"    }),
      AdminUserHelper.countUsers({ role: { not: "super_admin" }, accountStatus: "suspended" }),
      AdminUserHelper.countUsers({ role: { not: "super_admin" }, accountStatus: "banned"    }),
      AdminUserHelper.countUsers({ role: { not: "super_admin" }, isVerifiedBadge: true      }),
      AdminUserHelper.countPosts({ isDeleted: false }),
      AdminUserHelper.countReports({ status: "pending" }),
      AdminUserHelper.countUsers({ role: { not: "super_admin" }, createdAt: { gte: startOfToday } }),
    ]);

  const statsData = {
    users:   { total: totalUsers, active: activeUsers, suspended: suspendedUsers, banned: bannedUsers, verified: verifiedUsers },
    posts:   { total: totalPosts },
    reports: { pending: pendingReports },
    today:   { newUsers: newUsersToday },
  };

  try {
    await redis.set("admin:stats", JSON.stringify(statsData), { ex: 300 });
  } catch { /* ignore */ }

  return res.status(200).json({ success: true, data: statsData });
});

// ─────────────────────────────────────────────────────────────
//  GET /admin/posts
// ─────────────────────────────────────────────────────────────

export const getAllPosts = asyncHandler(async (req, res, next) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip  = (page - 1) * limit;

  const { type, search, sortBy = "createdAt", sortOrder = "desc" } = req.query;

  const where = {
    isDeleted: false,
    isDraft:   false,
    author:    { role: { not: "super_admin" } },
  };

  if (type && ["image", "reel", "text"].includes(type)) {
    where.type = type;
  }

  if (search?.trim()) {
    where.caption = { like: search.trim(), caseInsensitive: true };
  }

  const SORT_WHITELIST = ["createdAt", "likesCount", "commentsCount", "viewsCount"];
  const sortField = SORT_WHITELIST.includes(sortBy) ? sortBy : "createdAt";

  const [posts, total] = await Promise.all([
    AdminUserHelper.findAllPosts(
      where,
      { [sortField]: sortOrder === "asc" ? "asc" : "desc" },
      skip,
      limit,
    ),
    AdminUserHelper.countPosts(where),
  ]);

  logger.info("Admin fetched all posts", { adminId: req.user.id, total, page });

  return res.status(200).json({
    success: true,
    data:       posts,
    pagination: paginationMeta(total, page, limit),
  });
});

// ─────────────────────────────────────────────────────────────
//  POST /admin/users/bulk-status
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
        const user = await AdminUserHelper.findUserForBulkStatus(userId);

        if (!user || user.role === "super_admin") throw new Error("Not allowed");

        const data = { accountStatus: status };

        if (status === "suspended") {
          data.activeSuspension = {
            suspendedAt: new Date(),
            suspendedBy: req.user.id,
            reason:      reason.trim(),
            duration:    days,
            expiresAt,
          };
        }

        await AdminUserHelper.updateUserStatusWithHistory(userId, data, {
          userId,
          action:      status === "suspended" ? "suspended" : status,
          performedBy: req.user.id,
          reason:      reason?.trim() || null,
          duration:    days,
          expiresAt,
        });

        results.success.push(userId);
      } catch (err) {
        results.failed.push({ userId, error: err.message });
      }
    })
  );

  logger.info("Admin bulk status update", {
    adminId: req.user.id, status,
    total: userIds.length, ...results,
  });

  return res.status(200).json({ success: true, data: results });
});

// ─────────────────────────────────────────────────────────────
//  GET /admin/users/:id/suspension-history
// ─────────────────────────────────────────────────────────────

export const getSuspensionHistory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const user = await AdminUserHelper.findUserForSuspensionHistory(id);

  if (!user || user.role === "super_admin")
    return next(new AppError("User not found", 404));

  const history = await AdminUserHelper.findSuspensionHistory(id);

  return res.status(200).json({
    success: true,
    data: {
      activeSuspension:  user.activeSuspension,
      suspensionHistory: history,
    },
  });
});