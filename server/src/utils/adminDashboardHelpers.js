import {
  userRepository,
  socialPostRepository,
  commentRepository,
  reportRepository,
} from "../config/repositories.js";

// Persistence owner for the admin-dashboard domain (Milestone 6F).
//
// Follows the convention from 6A–6E: one <domain>Helpers.js per admin
// controller, owning that controller's persistence ONLY. This domain is
// entirely READ-ONLY analytics — no writes, no transactions. Deliberately
// NOT here (controller responsibilities, unchanged): date-window
// computation (monthsAgo/daysAgo/month boundaries), period → groupFormat
// mapping, pctChange math, cumulative running totals, type pivoting,
// 24-hour gap filling, null-coalescing (`?? 0`), logging, and response
// shaping.
//
// ── RAW SQL (4 statements — now owned by the repositories) ───────────────
// Phase 7A moved all four one layer down, BYTE-IDENTICAL and md5-verified
// against this file's previous contents (the same four hashes recorded in
// Milestone 6F). None were rewritten, optimized, re-parameterized, or
// replaced with Prisma/JavaScript. Ownership changed only: each statement
// now lives in the repository that owns its table, which is also where the
// eventual Mongo aggregation-pipeline equivalent will live.
//
//   • UserRepository.findNewUsersTimeSeriesRaw          ($queryRawUnsafe)
//   • SocialPostRepository.findPostsByTypeTimeSeriesRaw ($queryRawUnsafe)
//   • SocialPostRepository.findEngagementTimeSeriesRaw  ($queryRaw)
//   • UserRepository.findHourlyActiveUsersRaw           ($queryRaw)
//
// All four are PostgreSQL-specific by design (TO_CHAR, AT TIME ZONE 'UTC',
// EXTRACT, ::int casts) — no Mongo-compat rewrite is attempted here (that
// is a deliberately deferred later phase). The two $queryRawUnsafe sites
// still interpolate `groupFormat` and still bind `startDate` as $1;
// hardening remains a flagged, deferred follow-up.

// getDashboardStats: total regular (non-super_admin) users.
export const countRegularUsers = () => {
  return userRepository.count({ role: { not: "super_admin" } });
};

// getDashboardStats: total non-deleted, non-draft posts by non-admins.
// `includeDeleted: true` throughout the post counts below — the filters
// already carry their own `isDeleted` predicate, so the helper's assembled
// where stays authoritative rather than being re-scoped by the repository.
export const countVisibleUserPosts = () => {
  return socialPostRepository.count(
    {
      isDeleted: false,
      isDraft:   false,
      author:    { role: { not: "super_admin" } },
    },
    { includeDeleted: true }
  );
};

// getDashboardStats: pending reports.
export const countPendingReports = () => {
  return reportRepository.count({ status: "pending" });
};

// getDashboardStats: regular users active since start of today.
export const countActiveRegularUsersSince = (since) => {
  return userRepository.count({ role: { not: "super_admin" }, lastActiveAt: { gte: since } });
};

// getDashboardStats: new signups since a boundary (this-month window).
export const countRegularUsersCreatedSince = (since) => {
  return userRepository.count({ role: { not: "super_admin" }, createdAt: { gte: since } });
};

// getDashboardStats: new signups inside a closed window (last-month window).
export const countRegularUsersCreatedBetween = (gte, lte) => {
  return userRepository.count({ role: { not: "super_admin" }, createdAt: { gte, lte } });
};

// getUserGrowth: cumulative starting point — regular users created before
// the chart window.
export const countRegularUsersCreatedBefore = (before) => {
  return userRepository.count({ role: { not: "super_admin" }, createdAt: { lt: before } });
};

// getDashboardStats: non-deleted posts since a boundary (this-month window).
export const countPostsCreatedSince = (since) => {
  return socialPostRepository.count(
    { isDeleted: false, createdAt: { gte: since } },
    { includeDeleted: true }
  );
};

// getDashboardStats: non-deleted posts inside a closed window (last month).
export const countPostsCreatedBetween = (gte, lte) => {
  return socialPostRepository.count(
    { isDeleted: false, createdAt: { gte, lte } },
    { includeDeleted: true }
  );
};

// getDashboardStats: total non-deleted comments.
export const countActiveComments = () => {
  return commentRepository.count({ isDeleted: false }, { includeDeleted: true });
};

// getDashboardStats: total likes — _sum of likesCount over non-deleted
// posts. The `?? 0` null-coalescing stays in the controller.
export const sumPostLikes = () => {
  return socialPostRepository.sumFields({ isDeleted: false }, { likesCount: true });
};

// getDashboardStats: total views — _sum of viewsCount over non-deleted posts.
export const sumPostViews = () => {
  return socialPostRepository.sumFields({ isDeleted: false }, { viewsCount: true });
};

// getUserGrowth: new-user time-series. Raw SQL — Prisma groupBy can't do
// date truncation. $queryRawUnsafe preserved as-is — see header.
export const findNewUsersTimeSeries = (groupFormat, startDate) => {
  return userRepository.findNewUsersTimeSeriesRaw(groupFormat, startDate);
};

// getPostGrowth: per-type post time-series. $queryRawUnsafe preserved
// as-is — see header. Type pivoting stays in the controller.
export const findPostsByTypeTimeSeries = (groupFormat, startDate) => {
  return socialPostRepository.findPostsByTypeTimeSeriesRaw(groupFormat, startDate);
};

// getEngagementTrend: daily likes/comments/views sums ($queryRaw tagged
// template, parameterized).
export const findEngagementTimeSeries = (startDate) => {
  return socialPostRepository.findEngagementTimeSeriesRaw(startDate);
};

// getTopPosts: top non-deleted posts by views, then likes.
export const findTopPosts = (limit) => {
  return socialPostRepository.findManyOrdered(
    { isDeleted: false },
    {
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
    }
  );
};

// getHourlyActivity: regular users grouped by hour of lastActiveAt
// ($queryRaw tagged template, parameterized). 24-hour gap filling stays
// in the controller.
export const findHourlyActiveUsers = (since) => {
  return userRepository.findHourlyActiveUsersRaw(since);
};
