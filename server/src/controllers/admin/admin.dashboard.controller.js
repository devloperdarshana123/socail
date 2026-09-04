

// src/controllers/admin/dashboard.controller.js
import asyncHandler from "../../middlewares/asyncHandler.js";
import * as AdminDashboardHelper from "../../utils/adminDashboardHelpers.js";
import logger       from "../../config/logger.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
};

const pctChange = (prev, curr) => {
  if (!prev) return curr > 0 ? 100 : 0;
  return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
};

// ─── 1. KPI Stats ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/dashboard/stats

export const getDashboardStats = asyncHandler(async (req, res) => {
  const now              = new Date();
  const startOfToday     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [
    totalUsers,
    totalPosts,
    pendingReports,
    activeToday,
    newSignupsThisMonth,
    newSignupsLastMonth,
    postsThisMonth,
    postsLastMonth,
    totalComments,
    likesAgg,
    viewsAgg,
  ] = await Promise.all([
    // Total regular users
    AdminDashboardHelper.countRegularUsers(),

    // Total non-deleted, non-draft posts by non-admins
    AdminDashboardHelper.countVisibleUserPosts(),

    // Pending reports
    AdminDashboardHelper.countPendingReports(),

    // Active today
    AdminDashboardHelper.countActiveRegularUsersSince(startOfToday),

    // New signups this month
    AdminDashboardHelper.countRegularUsersCreatedSince(startOfThisMonth),

    // New signups last month
    AdminDashboardHelper.countRegularUsersCreatedBetween(startOfLastMonth, endOfLastMonth),

    // Posts this month
    AdminDashboardHelper.countPostsCreatedSince(startOfThisMonth),

    // Posts last month
    AdminDashboardHelper.countPostsCreatedBetween(startOfLastMonth, endOfLastMonth),

    // Total comments
    AdminDashboardHelper.countActiveComments(),

    // Total likes (sum of likesCount on posts)
    AdminDashboardHelper.sumPostLikes(),

    // Total views (sum of viewsCount on posts)
    AdminDashboardHelper.sumPostViews(),
  ]);

  logger.info("Admin fetched dashboard stats", { adminId: req.user.id });

  return res.status(200).json({
    success: true,
    data: {
      totalUsers,
      totalPosts,
      totalLikes:       likesAgg.likesCount  ?? 0,
      totalComments,
      totalViews:       viewsAgg.viewsCount  ?? 0,
      activeToday,
      newSignups:       newSignupsThisMonth,
      newSignupsChange: pctChange(newSignupsLastMonth, newSignupsThisMonth),
      pendingReports,
      postsChange:      pctChange(postsLastMonth, postsThisMonth),
    },
  });
});

// ─── 2. User Growth ───────────────────────────────────────────────────────────
// GET /api/v1/admin/dashboard/user-growth?period=6months|12months|30days

export const getUserGrowth = asyncHandler(async (req, res) => {
  const { period = "6months" } = req.query;

  const startDate   = period === "30days"  ? daysAgo(30)
                    : period === "12months" ? monthsAgo(12)
                    : monthsAgo(6);

  const isDaily     = period === "30days";
  const groupFormat = isDaily ? "YYYY-MM-DD" : "YYYY-MM";

  // Raw SQL — Prisma groupBy can't do date truncation
  const newUsers = await AdminDashboardHelper.findNewUsersTimeSeries(groupFormat, startDate);

  const cumulativeStart = await AdminDashboardHelper.countRegularUsersCreatedBefore(startDate);

  let running = cumulativeStart;
  const data = newUsers.map((point) => {
    running += point.newUsers;
    return {
      label:      point.label,
      newUsers:   point.newUsers,
      totalUsers: running,
    };
  });

  return res.status(200).json({ success: true, data });
});

// ─── 3. Post Growth ───────────────────────────────────────────────────────────
// GET /api/v1/admin/dashboard/post-growth?period=6months|12months|30days

export const getPostGrowth = asyncHandler(async (req, res) => {
  const { period = "6months" } = req.query;

  const startDate   = period === "30days"  ? daysAgo(30)
                    : period === "12months" ? monthsAgo(12)
                    : monthsAgo(6);

  const isDaily     = period === "30days";
  const groupFormat = isDaily ? "YYYY-MM-DD" : "YYYY-MM";

  const raw = await AdminDashboardHelper.findPostsByTypeTimeSeries(groupFormat, startDate);

  // Group by label, pivot types
  const labelMap = {};
  for (const row of raw) {
    if (!labelMap[row.label]) {
      labelMap[row.label] = { label: row.label, photo: 0, reel: 0, text: 0 };
    }
    const t = row.type;
    if (t === "photo" || t === "image")       labelMap[row.label].photo += row.count;
    else if (t === "reel" || t === "video")   labelMap[row.label].reel  += row.count;
    else if (t === "text")                    labelMap[row.label].text  += row.count;
  }

  const data = Object.values(labelMap).map((obj) => ({
    ...obj,
    total: obj.photo + obj.reel + obj.text,
  }));

  return res.status(200).json({ success: true, data });
});

// ─── 4. Engagement Trend ─────────────────────────────────────────────────────
// GET /api/v1/admin/dashboard/engagement?period=7days|14days|30days

export const getEngagementTrend = asyncHandler(async (req, res) => {
  const days      = Math.min(parseInt(req.query.period) || 7, 90);
  const startDate = daysAgo(days);

  const raw = await AdminDashboardHelper.findEngagementTimeSeries(startDate);

  const data = raw.map((r) => ({
    label:    r.label,
    likes:    r.likes    ?? 0,
    comments: r.comments ?? 0,
    views:    r.views    ?? 0,
  }));

  return res.status(200).json({ success: true, data });
});

// ─── 5. Top Posts ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/dashboard/top-posts?limit=5

export const getTopPosts = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 5, 20);

  const posts = await AdminDashboardHelper.findTopPosts(limit);

  const data = posts.map((p) => ({
    id:        p.id,
    title:     p.caption ? p.caption.slice(0, 60) : "Untitled",
    type:      p.type     ?? "text",
    author:    p.author?.username ?? "Unknown",
    avatar:    p.author?.avatar   ?? null,
    views:     p.viewsCount    ?? 0,
    likes:     p.likesCount    ?? 0,
    comments:  p.commentsCount ?? 0,
    createdAt: p.createdAt,
  }));

  return res.status(200).json({ success: true, data });
});

// ─── 6. Hourly Active Users ───────────────────────────────────────────────────
// GET /api/v1/admin/dashboard/hourly-activity

export const getHourlyActivity = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const raw = await AdminDashboardHelper.findHourlyActiveUsers(since);

  const hourMap = {};
  raw.forEach(({ hour, users }) => { hourMap[hour] = users; });

  // Fill all 24 hours so chart has no gaps
  const data = Array.from({ length: 24 }, (_, h) => ({
    hour:  `${String(h).padStart(2, "0")}:00`,
    users: hourMap[h] ?? 0,
  }));

  return res.status(200).json({ success: true, data });
});