// src/controllers/admin/dashboard.controller.js
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError     from "../../utils/AppError.js";
import User         from "../../models/user.model.js";
import Post         from "../../models/post.model.js";
import Report       from "../../models/report.model.js";
import logger       from "../../config/logger.js";
import { REGULAR_USER_FILTER } from "../../utils/adminQueryFilters.js";
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

export const getDashboardStats = asyncHandler(async (req, res, next) => {
  const now             = new Date();
  const startOfToday    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
    likesAgg,
    commentsAgg,
    viewsAgg,
  ] = await Promise.all([
    User.countDocuments({ ...REGULAR_USER_FILTER }),
    Post.countDocuments({ isDeleted: { $ne: true } }),
    Report.countDocuments({ status: "pending" }),
    User.countDocuments({ ...REGULAR_USER_FILTER, lastActiveAt: { $gte: startOfToday } }),
    User.countDocuments({ ...REGULAR_USER_FILTER, createdAt: { $gte: startOfThisMonth } }),
    User.countDocuments({ ...REGULAR_USER_FILTER, createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
    Post.countDocuments({ createdAt: { $gte: startOfThisMonth }, isDeleted: { $ne: true } }),
    Post.countDocuments({ createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }, isDeleted: { $ne: true } }),
    Post.aggregate([{ $group: { _id: null, total: { $sum: "$likesCount" } } }]),
    Post.aggregate([{ $group: { _id: null, total: { $sum: "$commentsCount" } } }]),
   Post.aggregate([{ $group: { _id: null, total: { $sum: "$viewsCount" } } }]),
  ]);

  logger.info("Admin fetched dashboard stats", { adminId: req.user._id });

  return res.status(200).json({
    success: true,
    data: {
      totalUsers,
      totalPosts,
      totalLikes:    likesAgg[0]?.total    ?? 0,
      totalComments: commentsAgg[0]?.total ?? 0,
      totalViews:    viewsAgg[0]?.total    ?? 0,
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

export const getUserGrowth = asyncHandler(async (req, res, next) => {
  const { period = "6months" } = req.query;

  const startDate   = period === "30days"  ? daysAgo(30)
                    : period === "12months" ? monthsAgo(12)
                    : monthsAgo(6);

  const groupFormat = period === "30days" ? "%Y-%m-%d" : "%Y-%m";

  const [newUsers, cumulativeStart] = await Promise.all([
    User.aggregate([
      { $match: { ...REGULAR_USER_FILTER, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id:      { $dateToString: { format: groupFormat, date: "$createdAt" } },
          newUsers: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    User.countDocuments({ ...REGULAR_USER_FILTER, createdAt: { $lt: startDate } }),
  ]);

  let running = cumulativeStart;
  const data = newUsers.map((point) => {
    running += point.newUsers;
    return { label: point._id, newUsers: point.newUsers, totalUsers: running };
  });

  return res.status(200).json({ success: true, data });
});

// ─── 3. Post Growth ───────────────────────────────────────────────────────────
// GET /api/v1/admin/dashboard/post-growth?period=6months|12months|30days

export const getPostGrowth = asyncHandler(async (req, res, next) => {
  const { period = "6months" } = req.query;

  const startDate   = period === "30days"  ? daysAgo(30)
                    : period === "12months" ? monthsAgo(12)
                    : monthsAgo(6);

  const groupFormat = period === "30days" ? "%Y-%m-%d" : "%Y-%m";

  // NOTE: change "postType" to whatever your Post model field is called
  // e.g. "type", "mediaType", "kind" — check your post.model.js
  const raw = await Post.aggregate([
    { $match: { createdAt: { $gte: startDate }, isDeleted: { $ne: true } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: groupFormat, date: "$createdAt" } },
          type: "$type", // ← change to your actual field name if different
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.date": 1 } },
    {
      $group: {
        _id:   "$_id.date",
        types: { $push: { type: "$_id.type", count: "$count" } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const data = raw.map((point) => {
    const obj = { label: point._id, photo: 0, reel: 0, text: 0 };
    point.types.forEach(({ type, count }) => {
      if (type === "photo" || type === "image") obj.photo += count;
      else if (type === "reel" || type === "video") obj.reel += count;
      else if (type === "text") obj.text += count;
    });
    obj.total = obj.photo + obj.reel + obj.text;
    return obj;
  });

  return res.status(200).json({ success: true, data });
});

// ─── 4. Engagement Trend ─────────────────────────────────────────────────────
// GET /api/v1/admin/dashboard/engagement?period=7days|14days|30days

export const getEngagementTrend = asyncHandler(async (req, res, next) => {
  const days      = parseInt(req.query.period) || 7;
  const startDate = daysAgo(days);

  // Using likesCount + commentsCount + viewCount fields on Post model
  // (aggregated per day based on post creation — adjust if you have separate Like/Comment collections)
  const data = await Post.aggregate([
    { $match: { createdAt: { $gte: startDate }, isDeleted: { $ne: true } } },
    {
      $group: {
        _id:      { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        likes:    { $sum: "$likesCount" },
        comments: { $sum: "$commentsCount" },
        views: { $sum: "$viewsCount" },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        label:    "$_id",
        likes:    1,
        comments: 1,
        views:    1,
      },
    },
  ]);

  return res.status(200).json({ success: true, data });
});

// ─── 5. Top Posts ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/dashboard/top-posts?limit=5

export const getTopPosts = asyncHandler(async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 5, 20);

  const posts = await Post.find({ isDeleted: { $ne: true } })
    .sort({ viewsCount: -1, likesCount: -1 })
    .limit(limit)
    .populate("author", "username avatar")
    .select("caption type viewsCount likesCount commentsCount createdAt media")
    .lean();

  const data = posts.map((p) => ({
    _id:      p._id,
    title:    p.caption ? p.caption.slice(0, 60) : "Untitled",
    type:     p.type ?? "text",
    author:   p.author?.username ?? "Unknown",
    avatar:   p.author?.avatar   ?? null,
    views: p.viewsCount ?? 0,
    likes:    p.likesCount   ?? 0,
    comments: p.commentsCount ?? 0,
    createdAt: p.createdAt,
  }));

  return res.status(200).json({ success: true, data });
});

// ─── 6. Hourly Active Users ───────────────────────────────────────────────────
// GET /api/v1/admin/dashboard/hourly-activity

export const getHourlyActivity = asyncHandler(async (req, res, next) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const raw = await User.aggregate([
    { $match: { ...REGULAR_USER_FILTER, lastActiveAt: { $gte: since } } },
    {
      $group: {
        _id:   { $hour: "$lastActiveAt" },
        users: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const hourMap = {};
  raw.forEach(({ _id, users }) => { hourMap[_id] = users; });

  // Fill all 24 hours so chart has no gaps
  const data = Array.from({ length: 24 }, (_, h) => ({
    hour:  `${String(h).padStart(2, "0")}:00`,
    users: hourMap[h] ?? 0,
  }));

  return res.status(200).json({ success: true, data });
});