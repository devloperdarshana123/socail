

// src/controllers/admin/dashboard.controller.js
import asyncHandler from "../../middlewares/asyncHandler.js";
import prisma       from "../../config/prisma.js";
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

// Regular user filter — super_admin exclude
const regularUserWhere = { role: { not: "super_admin" } };

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
    prisma.user.count({ where: regularUserWhere }),

    // Total non-deleted, non-draft posts by non-admins
    prisma.post.count({
      where: {
        isDeleted: false,
        isDraft:   false,
        author:    { role: { not: "super_admin" } },
      },
    }),

    // Pending reports
    prisma.report.count({ where: { status: "pending" } }),

    // Active today
    prisma.user.count({
      where: { ...regularUserWhere, lastActiveAt: { gte: startOfToday } },
    }),

    // New signups this month
    prisma.user.count({
      where: { ...regularUserWhere, createdAt: { gte: startOfThisMonth } },
    }),

    // New signups last month
    prisma.user.count({
      where: { ...regularUserWhere, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
    }),

    // Posts this month
    prisma.post.count({
      where: { isDeleted: false, createdAt: { gte: startOfThisMonth } },
    }),

    // Posts last month
    prisma.post.count({
      where: { isDeleted: false, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
    }),

    // Total comments
    prisma.comment.count({ where: { isDeleted: false } }),

    // Total likes (sum of likesCount on posts)
    prisma.post.aggregate({
      where:   { isDeleted: false },
      _sum:    { likesCount: true },
    }),

    // Total views (sum of viewsCount on posts)
    prisma.post.aggregate({
      where:   { isDeleted: false },
      _sum:    { viewsCount: true },
    }),
  ]);

  logger.info("Admin fetched dashboard stats", { adminId: req.user.id });

  return res.status(200).json({
    success: true,
    data: {
      totalUsers,
      totalPosts,
      totalLikes:       likesAgg._sum.likesCount  ?? 0,
      totalComments,
      totalViews:       viewsAgg._sum.viewsCount  ?? 0,
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
  const newUsers = await prisma.$queryRawUnsafe(`
    SELECT
      TO_CHAR("createdAt" AT TIME ZONE 'UTC', '${groupFormat}') AS label,
      COUNT(*)::int AS "newUsers"
    FROM "User"
    WHERE role != 'super_admin'
      AND "createdAt" >= $1
    GROUP BY label
    ORDER BY label ASC
  `, startDate);

  const cumulativeStart = await prisma.user.count({
    where: { ...regularUserWhere, createdAt: { lt: startDate } },
  });

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

  const raw = await prisma.$queryRawUnsafe(`
    SELECT
      TO_CHAR("createdAt" AT TIME ZONE 'UTC', '${groupFormat}') AS label,
      type,
      COUNT(*)::int AS count
    FROM "Post"
    WHERE "isDeleted" = false
      AND "createdAt" >= $1
    GROUP BY label, type
    ORDER BY label ASC
  `, startDate);

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

  const raw = await prisma.$queryRaw`
    SELECT
      TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS label,
      SUM("likesCount")::int    AS likes,
      SUM("commentsCount")::int AS comments,
      SUM("viewsCount")::int    AS views
    FROM "Post"
    WHERE "isDeleted" = false
      AND "createdAt" >= ${startDate}
    GROUP BY label
    ORDER BY label ASC
  `;

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

  const posts = await prisma.post.findMany({
    where:   { isDeleted: false },
    orderBy: [{ viewsCount: "desc" }, { likesCount: "desc" }],
    take:    limit,
    select: {
      id:            true,
      caption:       true,
      type:          true,
      viewsCount:    true,
      likesCount:    true,
      commentsCount: true,
      createdAt:     true,
      media:         true,
      author: {
        select: { username: true, avatar: true },
      },
    },
  });

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

  const raw = await prisma.$queryRaw`
    SELECT
      EXTRACT(HOUR FROM "lastActiveAt" AT TIME ZONE 'UTC')::int AS hour,
      COUNT(*)::int AS users
    FROM "User"
    WHERE role != 'super_admin'
      AND "lastActiveAt" >= ${since}
    GROUP BY hour
    ORDER BY hour ASC
  `;

  const hourMap = {};
  raw.forEach(({ hour, users }) => { hourMap[hour] = users; });

  // Fill all 24 hours so chart has no gaps
  const data = Array.from({ length: 24 }, (_, h) => ({
    hour:  `${String(h).padStart(2, "0")}:00`,
    users: hourMap[h] ?? 0,
  }));

  return res.status(200).json({ success: true, data });
});