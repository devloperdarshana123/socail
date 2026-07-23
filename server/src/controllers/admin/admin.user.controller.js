
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError     from "../../utils/AppError.js";
import prisma       from "../../config/prisma.js";
import logger       from "../../config/logger.js";
import { sendMail } from "../../utils/sendMail.js";
import { postDeleted }      from "../../mail/templates/postDeleted.js";
import { accountSuspended } from "../../mail/templates/accountSuspended.js";
import redis from "../../config/redis.js";
import { dateRangeToCreatedAt } from "../../utils/dateRange.js";

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

  const { search, status, role, sort, sortBy, sortOrder, dateRange } = req.query;

  // ── Build where — always exclude super_admin ─────────────────
  const where = { role: { not: "super_admin" } };

  const createdAt = dateRangeToCreatedAt(dateRange);
  if (createdAt) where.createdAt = createdAt;

  if (search?.trim()) {
    where.OR = [
      { username:    { contains: search.trim(), mode: "insensitive" } },
      { fullName:    { contains: search.trim(), mode: "insensitive" } },
      { email:       { contains: search.trim(), mode: "insensitive" } },
      { phoneNumber: { contains: search.trim(), mode: "insensitive" } },
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
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id:                   true,
        username:             true,
        fullName:             true,
        email:                true,
        phoneNumber:          true,
        avatar:               true,
        accountStatus:        true,
        role:                 true,
        isVerifiedBadge:      true,
        isEmailVerified:      true,
        isMobileVerified:     true,
        followersCount:       true,
        followingCount:       true,
        createdAt:            true,
        _count: { select: { posts: { where: { isDeleted: false, isDraft: false } } } },
        businessCategory:     true,
        location:             true,
        authProvider:         true,
        isOnboardingComplete: true,
      },
    }),
    prisma.user.count({ where }),
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

  const user = await prisma.user.findUnique({
    where:  { id },
    select: {
      id:                   true,
      username:             true,
      fullName:             true,
      email:                true,
      phoneNumber:          true,
      avatar:               true,
      coverPhoto:           true,
      bio:                  true,
      designation:          true,
      website:              true,
      gender:               true,
      dateOfBirth:          true,
      businessCategory:     true,
      location:             true,
      isEmailVerified:      true,
      isMobileVerified:     true,
      isPrivate:            true,
      isVerifiedBadge:      true,
      accountStatus:        true,
      role:                 true,
      isOnboardingComplete: true,
      onboardingStep:       true,
      followersCount:       true,
      followingCount:       true,
      postsCount:           true,
      lastActiveAt:         true,
      notificationsEnabled: true,
      language:             true,
      activeSuspension:     true,
      createdAt:            true,
      updatedAt:            true,
    },
  });

  if (!user) return next(new AppError("User not found", 404));

  // Recent posts + report stats in parallel
  const [posts, reportsByStatus] = await Promise.all([
    prisma.post.findMany({
      where:   { authorId: id, isDeleted: false, isDraft: false },
      orderBy: { createdAt: "desc" },
      take:    30,
      select: {
        id:            true,
        caption:       true,
        type:          true,
        media:         true,
        likesCount:    true,
        commentsCount: true,
        viewsCount:    true,
        createdAt:     true,
      },
    }),

    // Report stats grouped by status
    prisma.report.groupBy({
      by:    ["status"],
      where: { reportedById: id },
      _count: { _all: true },
    }),
  ]);

  // Shape report stats
  const reportStats = { pending: 0, resolved: 0, dismissed: 0, total: 0 };
  reportsByStatus.forEach(({ status, _count }) => {
    if (status in reportStats) reportStats[status] = _count._all;
    reportStats.total += _count._all;
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

  const user = await prisma.user.findUnique({
    where:  { id },
    select: { id: true, username: true, fullName: true },
  });
  if (!user) return next(new AppError("User not found", 404));

  const where = { authorId: id, isDeleted: false };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take:    limit,
      select: {
        id:            true,
        caption:       true,
        type:          true,
        media:         true,
        likesCount:    true,
        commentsCount: true,
        viewsCount:    true,
        createdAt:     true,
      },
    }),
    prisma.post.count({ where }),
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

  const user = await prisma.user.findUnique({
    where:  { id },
    select: { id: true, username: true, fullName: true },
  });
  if (!user) return next(new AppError("User not found", 404));

  const where = { reportedById: id };

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take:    limit,
      include: {
        reportedBy: { select: { id: true, username: true, fullName: true, avatar: true } },
        post:       { select: { id: true, caption: true, media: true, createdAt: true, type: true } },
      },
    }),
    prisma.report.count({ where }),
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

  const target = await prisma.user.findUnique({
    where:  { id },
    select: {
      id:               true,
      email:            true,
      username:         true,
      fullName:         true,
      accountStatus:    true,
      role:             true,
      activeSuspension: true,
    },
  });
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
    await prisma.suspensionHistory.create({
      data: {
        userId:      id,
        action:      "suspended",
        performedBy: req.user.id,
        reason:      reason.trim(),
        duration:    days,
        expiresAt,
      },
    });

  } else if (status === "active" && previousStatus === "suspended") {
    data.activeSuspension = null;

    await prisma.suspensionHistory.create({
      data: {
        userId:      id,
        action:      "unsuspended",
        performedBy: req.user.id,
        reason:      reason?.trim() || "Manually lifted by admin",
        duration:    null,
        expiresAt:   null,
      },
    });

  } else if (status === "banned") {
    if (!reason?.trim())
      return next(new AppError("Reason is required for ban", 400));

    data.activeSuspension = null;

    await prisma.suspensionHistory.create({
      data: {
        userId:      id,
        action:      "banned",
        performedBy: req.user.id,
        reason:      reason.trim(),
        duration:    null,
        expiresAt:   null,
      },
    });
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id:               true,
      username:         true,
      accountStatus:    true,
      activeSuspension: true,
    },
  });

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

  const target = await prisma.user.findUnique({
    where:  { id },
    select: { id: true, username: true, email: true, role: true },
  });
  if (!target) return next(new AppError("User not found", 404));

  if (target.role === "super_admin") {
    return next(new AppError("Cannot delete a super admin account", 403));
  }

  // Soft-delete all posts + hard-delete user in transaction
  await prisma.$transaction([
    prisma.post.updateMany({
      where: { authorId: id },
      data:  { isDeleted: true, deletedAt: new Date() },
    }),
    prisma.user.delete({ where: { id } }),
  ]);

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

  const post = await prisma.post.findFirst({
    where:   { id: postId, isDeleted: false },
    include: {
      author: { select: { id: true, username: true, fullName: true, email: true, postsCount: true } },
    },
  });

  if (!post) return next(new AppError("Post not found", 404));

  const deletedAt = new Date();

  // Soft-delete post + decrement postsCount (guard: never below 0) in transaction
  await prisma.$transaction([
    prisma.post.update({
      where: { id: postId },
      data:  { isDeleted: true, deletedAt },
    }),
    ...(post.author.postsCount > 0
      ? [prisma.user.update({
          where: { id: post.author.id },
          data:  { postsCount: { decrement: 1 } },
        })]
      : []),
  ]);

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

  const user = await prisma.user.findUnique({
    where:  { id },
    select: { id: true, username: true, isVerifiedBadge: true },
  });
  if (!user) return next(new AppError("User not found", 404));

  const updated = await prisma.user.update({
    where: { id },
    data:  { isVerifiedBadge: !user.isVerifiedBadge },
    select: { isVerifiedBadge: true },
  });

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
      prisma.user.count({ where: { role: { not: "super_admin" } } }),
      prisma.user.count({ where: { role: { not: "super_admin" }, accountStatus: "active"    } }),
      prisma.user.count({ where: { role: { not: "super_admin" }, accountStatus: "suspended" } }),
      prisma.user.count({ where: { role: { not: "super_admin" }, accountStatus: "banned"    } }),
      prisma.user.count({ where: { role: { not: "super_admin" }, isVerifiedBadge: true      } }),
      prisma.post.count({ where: { isDeleted: false } }),
      prisma.report.count({ where: { status: "pending" } }),
      prisma.user.count({ where: { role: { not: "super_admin" }, createdAt: { gte: startOfToday } } }),
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

  const { type, search, sortBy = "createdAt", sortOrder = "desc", dateRange } = req.query;

  const where = {
    isDeleted: false,
    isDraft:   false,
    author:    { role: { not: "super_admin" } },
  };

  const createdAt = dateRangeToCreatedAt(dateRange);
  if (createdAt) where.createdAt = createdAt;

  if (type && ["image", "reel", "text"].includes(type)) {
    where.type = type;
  }

  if (search?.trim()) {
    where.caption = { contains: search.trim(), mode: "insensitive" };
  }

  const SORT_WHITELIST = ["createdAt", "likesCount", "commentsCount", "viewsCount"];
  const sortField = SORT_WHITELIST.includes(sortBy) ? sortBy : "createdAt";

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { [sortField]: sortOrder === "asc" ? "asc" : "desc" },
      skip,
      take:    limit,
      select: {
        id:            true,
        caption:       true,
        type:          true,
        media:         true,
        likesCount:    true,
        commentsCount: true,
        viewsCount:    true,
        createdAt:     true,
        author: {
          select: {
            id:             true,
            username:       true,
            fullName:       true,
            avatar:         true,
            isVerifiedBadge: true,
            accountStatus:  true,
          },
        },
      },
    }),
    prisma.post.count({ where }),
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
        const user = await prisma.user.findUnique({
          where:  { id: userId },
          select: { id: true, role: true, accountStatus: true },
        });

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

        await prisma.$transaction([
          prisma.user.update({ where: { id: userId }, data }),
          prisma.suspensionHistory.create({
            data: {
              userId,
              action:      status === "suspended" ? "suspended" : status,
              performedBy: req.user.id,
              reason:      reason?.trim() || null,
              duration:    days,
              expiresAt,
            },
          }),
        ]);

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

  const user = await prisma.user.findUnique({
    where:  { id },
    select: {
      id:               true,
      username:         true,
      fullName:         true,
      accountStatus:    true,
      role:             true,
      activeSuspension: true,
    },
  });

  if (!user || user.role === "super_admin")
    return next(new AppError("User not found", 404));

  const history = await prisma.suspensionHistory.findMany({
    where:   { userId: id },
    orderBy: { createdAt: "desc" },
  });

  return res.status(200).json({
    success: true,
    data: {
      activeSuspension:  user.activeSuspension,
      suspensionHistory: history,
    },
  });
});