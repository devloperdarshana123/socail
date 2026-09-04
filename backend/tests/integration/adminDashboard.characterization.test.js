// Characterization test for the `admin.dashboard` domain (Milestone 6F).
// Sixth admin controller — validates extraction of ANALYTICS-HEAVY,
// READ-ONLY persistence: 9 KPI counts, 2 aggregate sums, 4 raw SQL
// time-series (2 × $queryRawUnsafe, 2 × $queryRaw), 1 findMany.
//
// Baseline characterizes current behavior via exact inline mirrors of the
// controller's 17 call-sites; after extraction into the NEW
// adminDashboardHelpers.js the same assertions run against those helpers.
//
// NO WRITES, NO TRANSACTIONS in this controller. EXTERNAL DEPENDENCIES:
// none (asyncHandler, prisma, logger only). Tests are inherently offline.
//
// RAW SQL NOTE: all 4 raw statements are PostgreSQL-specific
// (TO_CHAR / AT TIME ZONE 'UTC' / EXTRACT / ::int) and extracted
// byte-identical. The two $queryRawUnsafe sites (user-growth,
// post-growth) interpolate `groupFormat` into the SQL string and pass
// `startDate` as a $1 positional parameter — preserved EXACTLY as-is per
// milestone rules (no hardening, no re-parameterization). `groupFormat`
// is controller-derived from a closed set ('YYYY-MM-DD' | 'YYYY-MM').
//
// ISOLATION: dashboard queries are GLOBAL (no tenant scoping) and the
// embedded-postgres DB is shared across suites in --runInBand, so these
// tests use DELTA assertions (measure → create fixtures → measure again)
// plus structural assertions (label formats, ::int number types, ASC
// ordering, parameterization) instead of assuming empty tables. Bucket
// labels/hours are NOT pinned to specific values because TO_CHAR/EXTRACT
// render via session-timezone semantics — characterized structurally.
import { PrismaClient } from "@prisma/client";
import * as AdminDashboardHelper from "../../src/utils/adminDashboardHelpers.js";
import { userRepository, socialPostRepository } from "../../src/config/repositories.js";

const prisma = new PrismaClient();

const userIds = [];
const postIds = [];
const reportIds = [];

// ── Mirrors of the controller's date helpers ─────────────────────────────
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
const regularUserWhere = { role: { not: "super_admin" } };

// ── Fixtures ─────────────────────────────────────────────────────────────
async function makeUser({ role = "user", createdAt = null, lastActiveAt = null } = {}) {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({
    data: {
      fullName: `Dash ${s}`, email: `dash-${s}@e.com`, username: `dash_${s}`,
      role, accountStatus: "active",
      ...(createdAt ? { createdAt } : {}),
      ...(lastActiveAt ? { lastActiveAt } : {}),
    },
  });
  userIds.push(u.id);
  return u;
}
async function makePost(authorId, {
  type = "image", isDeleted = false, isDraft = false, createdAt = null,
  likesCount = 0, commentsCount = 0, viewsCount = 0, caption = "dash post",
} = {}) {
  const p = await prisma.post.create({
    data: {
      authorId, type, isDeleted, isDraft, caption,
      likesCount, commentsCount, viewsCount,
      ...(createdAt ? { createdAt } : {}),
    },
  });
  postIds.push(p.id);
  return p;
}
async function makeReport(reportedById, { status = "pending" } = {}) {
  const r = await prisma.report.create({
    data: { reportedById, targetId: "00000000-0000-0000-0000-000000000000", targetModel: "User", reason: "spam", status },
  });
  reportIds.push(r.id);
  return r;
}

let author; // regular user who owns fixture posts

beforeAll(async () => {
  author = await makeUser();
});

afterAll(async () => {
  await prisma.report.deleteMany({ where: { id: { in: reportIds } } });
  await prisma.comment.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.post.deleteMany({ where: { id: { in: postIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────
describe("dashboard KPI counts (inline mirror)", () => {
  test("total regular users excludes super_admin", async () => {
    const c0 = await prisma.user.count({ where: regularUserWhere });
    await makeUser();
    await makeUser();
    await makeUser({ role: "super_admin" });
    const c1 = await prisma.user.count({ where: regularUserWhere });
    expect(c1 - c0).toBe(2);
  });

  test("total posts excludes deleted, drafts, and super_admin authors", async () => {
    const where = {
      isDeleted: false,
      isDraft: false,
      author: { role: { not: "super_admin" } },
    };
    const admin = await makeUser({ role: "super_admin" });
    const c0 = await prisma.post.count({ where });
    await makePost(author.id); // counted
    await makePost(author.id, { isDeleted: true });
    await makePost(author.id, { isDraft: true });
    await makePost(admin.id); // admin-authored — excluded
    const c1 = await prisma.post.count({ where });
    expect(c1 - c0).toBe(1);
  });

  test("pending reports counts only status=pending", async () => {
    const c0 = await prisma.report.count({ where: { status: "pending" } });
    const r1 = await makeUser();
    const r2 = await makeUser();
    const r3 = await makeUser();
    await makeReport(r1.id); // pending (default)
    await makeReport(r2.id); // pending
    await makeReport(r3.id, { status: "resolved" });
    const c1 = await prisma.report.count({ where: { status: "pending" } });
    expect(c1 - c0).toBe(2);
  });

  test("active today uses lastActiveAt >= startOfToday on regular users", async () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const where = { ...regularUserWhere, lastActiveAt: { gte: startOfToday } };
    const c0 = await prisma.user.count({ where });
    await makeUser({ lastActiveAt: new Date() }); // counted
    await makeUser({ lastActiveAt: new Date(Date.now() - 2 * 86400000) }); // stale
    await makeUser(); // null lastActiveAt
    await makeUser({ role: "super_admin", lastActiveAt: new Date() }); // excluded
    const c1 = await prisma.user.count({ where });
    expect(c1 - c0).toBe(1);
  });

  test("signup windows: this month (gte) vs last month (gte+lte)", async () => {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const whereThis = { ...regularUserWhere, createdAt: { gte: startOfThisMonth } };
    const whereLast = { ...regularUserWhere, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } };

    const [t0, l0] = await Promise.all([
      prisma.user.count({ where: whereThis }),
      prisma.user.count({ where: whereLast }),
    ]);

    await makeUser(); // now → this month
    const midLastMonth = new Date(startOfLastMonth.getTime() + 3 * 86400000);
    await makeUser({ createdAt: midLastMonth }); // last month
    await makeUser({ createdAt: new Date(now.getFullYear(), now.getMonth() - 3, 15) }); // older — neither

    const [t1, l1] = await Promise.all([
      prisma.user.count({ where: whereThis }),
      prisma.user.count({ where: whereLast }),
    ]);
    expect(t1 - t0).toBe(1);
    expect(l1 - l0).toBe(1);
  });

  test("post windows: this month vs last month, non-deleted only", async () => {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const whereThis = { isDeleted: false, createdAt: { gte: startOfThisMonth } };
    const whereLast = { isDeleted: false, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } };

    const [t0, l0] = await Promise.all([
      prisma.post.count({ where: whereThis }),
      prisma.post.count({ where: whereLast }),
    ]);

    await makePost(author.id); // now
    await makePost(author.id, { createdAt: new Date(startOfLastMonth.getTime() + 3 * 86400000) });
    await makePost(author.id, { isDeleted: true }); // now, deleted — excluded

    const [t1, l1] = await Promise.all([
      prisma.post.count({ where: whereThis }),
      prisma.post.count({ where: whereLast }),
    ]);
    expect(t1 - t0).toBe(1);
    expect(l1 - l0).toBe(1);
  });

  test("total comments counts only non-deleted", async () => {
    const p = await makePost(author.id);
    const c0 = await prisma.comment.count({ where: { isDeleted: false } });
    await prisma.comment.create({ data: { postId: p.id, authorId: author.id, content: "dash-c1" } });
    await prisma.comment.create({ data: { postId: p.id, authorId: author.id, content: "dash-c2", isDeleted: true } });
    const c1 = await prisma.comment.count({ where: { isDeleted: false } });
    expect(c1 - c0).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("dashboard aggregate sums (inline mirror)", () => {
  test("_sum of likesCount / viewsCount over non-deleted posts", async () => {
    const [likes0, views0] = await Promise.all([
      prisma.post.aggregate({ where: { isDeleted: false }, _sum: { likesCount: true } }),
      prisma.post.aggregate({ where: { isDeleted: false }, _sum: { viewsCount: true } }),
    ]);

    await makePost(author.id, { likesCount: 5, viewsCount: 7 });
    await makePost(author.id, { likesCount: 3, viewsCount: 11 });
    await makePost(author.id, { likesCount: 100, viewsCount: 100, isDeleted: true }); // excluded

    const [likes1, views1] = await Promise.all([
      prisma.post.aggregate({ where: { isDeleted: false }, _sum: { likesCount: true } }),
      prisma.post.aggregate({ where: { isDeleted: false }, _sum: { viewsCount: true } }),
    ]);

    // INLINE MIRROR — raw client, so Prisma's _sum envelope is still correct
    // here. Only repository/helper results were neutralised by M-4.
    expect((likes1._sum.likesCount ?? 0) - (likes0._sum.likesCount ?? 0)).toBe(8);
    expect((views1._sum.viewsCount ?? 0) - (views0._sum.viewsCount ?? 0)).toBe(18);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("user growth — $queryRawUnsafe time-series (inline mirror)", () => {
  const runUserGrowth = (groupFormat, startDate) => prisma.$queryRawUnsafe(`
    SELECT
      TO_CHAR("createdAt" AT TIME ZONE 'UTC', '${groupFormat}') AS label,
      COUNT(*)::int AS "newUsers"
    FROM "User"
    WHERE role != 'super_admin'
      AND "createdAt" >= $1
    GROUP BY label
    ORDER BY label ASC
  `, startDate);

  const totalOf = (rows) => rows.reduce((s, r) => s + r.newUsers, 0);

  test("monthly format: YYYY-MM labels, ::int numbers, ASC, super_admin excluded", async () => {
    const startDate = monthsAgo(6);
    const before = await runUserGrowth("YYYY-MM", startDate);
    await makeUser();
    await makeUser();
    await makeUser({ role: "super_admin" }); // must not count
    const after = await runUserGrowth("YYYY-MM", startDate);

    expect(totalOf(after) - totalOf(before)).toBe(2);
    for (const row of after) {
      expect(row.label).toMatch(/^\d{4}-\d{2}$/);
      expect(typeof row.newUsers).toBe("number"); // ::int cast, NOT BigInt
    }
    const labels = after.map((r) => r.label);
    expect([...labels].sort()).toEqual(labels); // ASC
  });

  test("daily format variant: YYYY-MM-DD labels over 30 days", async () => {
    const startDate = daysAgo(30);
    const before = await runUserGrowth("YYYY-MM-DD", startDate);
    await makeUser();
    const after = await runUserGrowth("YYYY-MM-DD", startDate);

    expect(totalOf(after) - totalOf(before)).toBe(1);
    for (const row of after) expect(row.label).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const labels = after.map((r) => r.label);
    expect([...labels].sort()).toEqual(labels);
  });

  test("cumulative start: count of regular users created before startDate", async () => {
    const startDate = daysAgo(30);
    const where = { ...regularUserWhere, createdAt: { lt: startDate } };
    const c0 = await prisma.user.count({ where });
    await makeUser({ createdAt: new Date(startDate.getTime() - 86400000) }); // before window
    await makeUser(); // now — not before
    const c1 = await prisma.user.count({ where });
    expect(c1 - c0).toBe(1);
  });

  test("startDate is a $1 parameter: future date yields empty series", async () => {
    const future = new Date(Date.now() + 7 * 86400000);
    expect(await runUserGrowth("YYYY-MM", future)).toEqual([]);
    expect(await runUserGrowth("YYYY-MM-DD", future)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("post growth — $queryRawUnsafe time-series (inline mirror)", () => {
  const runPostGrowth = (groupFormat, startDate) => prisma.$queryRawUnsafe(`
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

  const totalOfType = (rows, type) =>
    rows.filter((r) => r.type === type).reduce((s, r) => s + r.count, 0);

  test("groups by label+type, excludes deleted, ::int, ASC", async () => {
    const startDate = monthsAgo(6);
    const before = await runPostGrowth("YYYY-MM", startDate);
    await makePost(author.id, { type: "image" });
    await makePost(author.id, { type: "video" });
    await makePost(author.id, { type: "text" });
    await makePost(author.id, { type: "image", isDeleted: true }); // excluded
    const after = await runPostGrowth("YYYY-MM", startDate);

    expect(totalOfType(after, "image") - totalOfType(before, "image")).toBe(1);
    expect(totalOfType(after, "video") - totalOfType(before, "video")).toBe(1);
    expect(totalOfType(after, "text") - totalOfType(before, "text")).toBe(1);
    for (const row of after) {
      expect(row.label).toMatch(/^\d{4}-\d{2}$/);
      expect(typeof row.count).toBe("number");
    }
    const labels = after.map((r) => r.label);
    expect([...labels].sort()).toEqual(labels);
  });

  test("daily variant + parameterized startDate (future → empty)", async () => {
    const daily = await runPostGrowth("YYYY-MM-DD", daysAgo(30));
    for (const row of daily) expect(row.label).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(await runPostGrowth("YYYY-MM", new Date(Date.now() + 7 * 86400000))).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("engagement trend — $queryRaw time-series (inline mirror)", () => {
  const runEngagement = (startDate) => prisma.$queryRaw`
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

  const sums = (rows) => rows.reduce(
    (a, r) => ({ likes: a.likes + (r.likes ?? 0), comments: a.comments + (r.comments ?? 0), views: a.views + (r.views ?? 0) }),
    { likes: 0, comments: 0, views: 0 },
  );

  test("sums likes/comments/views per day, excludes deleted, ::int, ASC", async () => {
    const startDate = daysAgo(7);
    const before = await runEngagement(startDate);
    await makePost(author.id, { likesCount: 3, commentsCount: 2, viewsCount: 11 });
    await makePost(author.id, { likesCount: 4, commentsCount: 1, viewsCount: 9 });
    await makePost(author.id, { likesCount: 50, commentsCount: 50, viewsCount: 50, isDeleted: true });
    const after = await runEngagement(startDate);

    const d = sums(after), b = sums(before);
    expect(d.likes - b.likes).toBe(7);
    expect(d.comments - b.comments).toBe(3);
    expect(d.views - b.views).toBe(20);
    for (const row of after) {
      expect(row.label).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof row.likes).toBe("number");
    }
    const labels = after.map((r) => r.label);
    expect([...labels].sort()).toEqual(labels);
  });

  test("parameterized: future startDate yields empty series", async () => {
    expect(await runEngagement(new Date(Date.now() + 7 * 86400000))).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("top posts — findMany (inline mirror)", () => {
  const TOP_SELECT = {
    id: true, caption: true, type: true, viewsCount: true, likesCount: true,
    commentsCount: true, createdAt: true, media: true,
    author: { select: { username: true, avatar: true } },
  };

  test("orders by viewsCount desc then likesCount desc, honors take", async () => {
    // Huge viewsCount so fixtures dominate the global ordering
    const a = await makePost(author.id, { viewsCount: 9000003, likesCount: 1, caption: "top-a" });
    const b = await makePost(author.id, { viewsCount: 9000002, likesCount: 50, caption: "top-b" });
    const c = await makePost(author.id, { viewsCount: 9000002, likesCount: 40, caption: "top-c" });
    await makePost(author.id, { viewsCount: 9000010, isDeleted: true }); // excluded

    const top = await prisma.post.findMany({
      where: { isDeleted: false },
      orderBy: [{ viewsCount: "desc" }, { likesCount: "desc" }],
      take: 3,
      select: TOP_SELECT,
    });
    expect(top.map((p) => p.id)).toEqual([a.id, b.id, c.id]); // tie broken by likes
    expect(Object.keys(top[0]).sort()).toEqual(Object.keys(TOP_SELECT).sort());
    expect(top[0].author.username).toBe(author.username);

    const top2 = await prisma.post.findMany({
      where: { isDeleted: false },
      orderBy: [{ viewsCount: "desc" }, { likesCount: "desc" }],
      take: 2,
      select: TOP_SELECT,
    });
    expect(top2.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("hourly activity — $queryRaw (inline mirror)", () => {
  const runHourly = (since) => prisma.$queryRaw`
    SELECT
      EXTRACT(HOUR FROM "lastActiveAt" AT TIME ZONE 'UTC')::int AS hour,
      COUNT(*)::int AS users
    FROM "User"
    WHERE role != 'super_admin'
      AND "lastActiveAt" >= ${since}
    GROUP BY hour
    ORDER BY hour ASC
  `;

  const totalOf = (rows) => rows.reduce((s, r) => s + r.users, 0);

  test("groups regular users by hour over the window; super_admin excluded", async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const before = await runHourly(since);
    await makeUser({ lastActiveAt: new Date() });
    await makeUser({ lastActiveAt: new Date(Date.now() - 3 * 3600000) });
    await makeUser({ role: "super_admin", lastActiveAt: new Date() }); // excluded
    await makeUser({ lastActiveAt: new Date(Date.now() - 48 * 3600000) }); // outside window
    const after = await runHourly(since);

    expect(totalOf(after) - totalOf(before)).toBe(2);
    for (const row of after) {
      expect(typeof row.hour).toBe("number");
      expect(row.hour).toBeGreaterThanOrEqual(0);
      expect(row.hour).toBeLessThan(24);
      expect(typeof row.users).toBe("number");
    }
    const hours = after.map((r) => r.hour);
    expect([...hours].sort((x, y) => x - y)).toEqual(hours); // ASC
  });

  test("parameterized: future since yields empty result", async () => {
    expect(await runHourly(new Date(Date.now() + 3600000))).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// After extraction: the 17 helpers must match the inline behavior exactly.
describe("adminDashboardHelpers — extracted queries match inline behavior", () => {
  test("KPI count helpers reproduce the same filters (delta assertions)", async () => {
    const [ru0, vp0, pr0, cc0] = await Promise.all([
      AdminDashboardHelper.countRegularUsers(),
      AdminDashboardHelper.countVisibleUserPosts(),
      AdminDashboardHelper.countPendingReports(),
      AdminDashboardHelper.countActiveComments(),
    ]);

    const u = await makeUser();
    const admin = await makeUser({ role: "super_admin" });
    const p = await makePost(u.id); // visible
    await makePost(u.id, { isDraft: true });
    await makePost(admin.id);
    await makeReport(u.id); // pending
    await prisma.comment.create({ data: { postId: p.id, authorId: u.id, content: "hm-c" } });

    const [ru1, vp1, pr1, cc1] = await Promise.all([
      AdminDashboardHelper.countRegularUsers(),
      AdminDashboardHelper.countVisibleUserPosts(),
      AdminDashboardHelper.countPendingReports(),
      AdminDashboardHelper.countActiveComments(),
    ]);
    expect(ru1 - ru0).toBe(1); // super_admin excluded
    expect(vp1 - vp0).toBe(1); // draft + admin-authored excluded
    expect(pr1 - pr0).toBe(1);
    expect(cc1 - cc0).toBe(1);
  });

  test("windowed count helpers: since / between / before / activeSince", async () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const windowStart = daysAgo(30);

    const [a0, s0, b0, before0, ps0, pb0] = await Promise.all([
      AdminDashboardHelper.countActiveRegularUsersSince(startOfToday),
      AdminDashboardHelper.countRegularUsersCreatedSince(startOfThisMonth),
      AdminDashboardHelper.countRegularUsersCreatedBetween(startOfLastMonth, endOfLastMonth),
      AdminDashboardHelper.countRegularUsersCreatedBefore(windowStart),
      AdminDashboardHelper.countPostsCreatedSince(startOfThisMonth),
      AdminDashboardHelper.countPostsCreatedBetween(startOfLastMonth, endOfLastMonth),
    ]);

    const lastMonthDate = new Date(startOfLastMonth.getTime() + 3 * 86400000);
    const wayBeforeDate = new Date(windowStart.getTime() - 40 * 86400000);
    const u = await makeUser({ lastActiveAt: new Date() }); // today + this month
    await makeUser({ createdAt: lastMonthDate }); // last month
    await makeUser({ createdAt: wayBeforeDate }); // before window
    await makePost(u.id); // this month
    await makePost(u.id, { createdAt: lastMonthDate });
    await makePost(u.id, { isDeleted: true }); // excluded from both

    // The last-month fixture may or may not fall before the 30-day window
    // start depending on today's date — compute the expected delta.
    const expectedBefore = [lastMonthDate, wayBeforeDate].filter((d) => d < windowStart).length;

    const [a1, s1, b1, before1, ps1, pb1] = await Promise.all([
      AdminDashboardHelper.countActiveRegularUsersSince(startOfToday),
      AdminDashboardHelper.countRegularUsersCreatedSince(startOfThisMonth),
      AdminDashboardHelper.countRegularUsersCreatedBetween(startOfLastMonth, endOfLastMonth),
      AdminDashboardHelper.countRegularUsersCreatedBefore(windowStart),
      AdminDashboardHelper.countPostsCreatedSince(startOfThisMonth),
      AdminDashboardHelper.countPostsCreatedBetween(startOfLastMonth, endOfLastMonth),
    ]);
    expect(a1 - a0).toBe(1);
    expect(s1 - s0).toBe(1);
    expect(b1 - b0).toBe(1);
    expect(before1 - before0).toBe(expectedBefore);
    expect(ps1 - ps0).toBe(1);
    expect(pb1 - pb0).toBe(1);
  });

  test("sumPostLikes / sumPostViews return the neutral bare-sums shape (M-4)", async () => {
    const [l0, v0] = await Promise.all([
      AdminDashboardHelper.sumPostLikes(),
      AdminDashboardHelper.sumPostViews(),
    ]);
    await makePost(author.id, { likesCount: 6, viewsCount: 13 });
    await makePost(author.id, { likesCount: 99, viewsCount: 99, isDeleted: true });
    const [l1, v1] = await Promise.all([
      AdminDashboardHelper.sumPostLikes(),
      AdminDashboardHelper.sumPostViews(),
    ]);
    expect((l1.likesCount ?? 0) - (l0.likesCount ?? 0)).toBe(6);
    expect((v1.viewsCount ?? 0) - (v0.viewsCount ?? 0)).toBe(13);
  });

  test("findNewUsersTimeSeries matches the $queryRawUnsafe behavior (both formats, param'd)", async () => {
    const startDate = monthsAgo(6);
    const before = await AdminDashboardHelper.findNewUsersTimeSeries("YYYY-MM", startDate);
    await makeUser();
    await makeUser({ role: "super_admin" }); // excluded
    const after = await AdminDashboardHelper.findNewUsersTimeSeries("YYYY-MM", startDate);

    const total = (rows) => rows.reduce((s, r) => s + r.newUsers, 0);
    expect(total(after) - total(before)).toBe(1);
    for (const row of after) {
      expect(row.label).toMatch(/^\d{4}-\d{2}$/);
      expect(typeof row.newUsers).toBe("number");
    }
    const labels = after.map((r) => r.label);
    expect([...labels].sort()).toEqual(labels);

    const daily = await AdminDashboardHelper.findNewUsersTimeSeries("YYYY-MM-DD", daysAgo(30));
    for (const row of daily) expect(row.label).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(await AdminDashboardHelper.findNewUsersTimeSeries("YYYY-MM", new Date(Date.now() + 7 * 86400000))).toEqual([]);
  });

  test("findPostsByTypeTimeSeries matches label+type grouping and parameterization", async () => {
    const startDate = monthsAgo(6);
    const before = await AdminDashboardHelper.findPostsByTypeTimeSeries("YYYY-MM", startDate);
    await makePost(author.id, { type: "video" });
    await makePost(author.id, { type: "video", isDeleted: true }); // excluded
    const after = await AdminDashboardHelper.findPostsByTypeTimeSeries("YYYY-MM", startDate);

    const ofType = (rows, t) => rows.filter((r) => r.type === t).reduce((s, r) => s + r.count, 0);
    expect(ofType(after, "video") - ofType(before, "video")).toBe(1);
    for (const row of after) {
      expect(row.label).toMatch(/^\d{4}-\d{2}$/);
      expect(typeof row.count).toBe("number");
    }

    expect(await AdminDashboardHelper.findPostsByTypeTimeSeries("YYYY-MM", new Date(Date.now() + 7 * 86400000))).toEqual([]);
  });

  test("findEngagementTimeSeries matches daily sums and parameterization", async () => {
    const startDate = daysAgo(7);
    const before = await AdminDashboardHelper.findEngagementTimeSeries(startDate);
    await makePost(author.id, { likesCount: 2, commentsCount: 5, viewsCount: 8 });
    const after = await AdminDashboardHelper.findEngagementTimeSeries(startDate);

    const sum = (rows, k) => rows.reduce((s, r) => s + (r[k] ?? 0), 0);
    expect(sum(after, "likes") - sum(before, "likes")).toBe(2);
    expect(sum(after, "comments") - sum(before, "comments")).toBe(5);
    expect(sum(after, "views") - sum(before, "views")).toBe(8);
    for (const row of after) expect(row.label).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(await AdminDashboardHelper.findEngagementTimeSeries(new Date(Date.now() + 7 * 86400000))).toEqual([]);
  });

  test("findTopPosts matches ordering (views desc, likes desc), select shape, and take", async () => {
    const a = await makePost(author.id, { viewsCount: 9100003, likesCount: 1, caption: "hm-top-a" });
    const b = await makePost(author.id, { viewsCount: 9100002, likesCount: 50, caption: "hm-top-b" });
    const c = await makePost(author.id, { viewsCount: 9100002, likesCount: 40, caption: "hm-top-c" });

    const top = await AdminDashboardHelper.findTopPosts(3);
    expect(top.map((p) => p.id)).toEqual([a.id, b.id, c.id]);
    expect(Object.keys(top[0]).sort()).toEqual(
      ["id", "caption", "type", "viewsCount", "likesCount", "commentsCount", "createdAt", "media", "author"].sort(),
    );
    expect(top[0].author.username).toBe(author.username);
    expect((await AdminDashboardHelper.findTopPosts(2)).length).toBe(2);
  });

  test("findHourlyActiveUsers matches hourly grouping and parameterization", async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const before = await AdminDashboardHelper.findHourlyActiveUsers(since);
    await makeUser({ lastActiveAt: new Date() });
    await makeUser({ role: "super_admin", lastActiveAt: new Date() }); // excluded
    const after = await AdminDashboardHelper.findHourlyActiveUsers(since);

    const total = (rows) => rows.reduce((s, r) => s + r.users, 0);
    expect(total(after) - total(before)).toBe(1);
    for (const row of after) {
      expect(typeof row.hour).toBe("number");
      expect(row.hour).toBeGreaterThanOrEqual(0);
      expect(row.hour).toBeLessThan(24);
    }

    expect(await AdminDashboardHelper.findHourlyActiveUsers(new Date(Date.now() + 3600000))).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// REPOSITORY MIGRATION REGRESSIONS (Phase 7A Milestone 14)
//
// All four raw statements moved one layer down into the repository that owns
// their table. These tests prove the move was ownership-only, and that the
// count/aggregate paths did not pick up the repositories' default
// soft-delete scoping.
// ─────────────────────────────────────────────────────────────────────────
describe("adminDashboard — raw SQL after the move (Phase 7A)", () => {
  test("helper and repository return identical rows for all four statements", async () => {
    const u = await makeUser({ lastActiveAt: new Date() });
    await makePost(u.id, { likesCount: 3, commentsCount: 1, viewsCount: 7 });

    const monthly = monthsAgo(6);
    const daily = daysAgo(7);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    expect(await AdminDashboardHelper.findNewUsersTimeSeries("YYYY-MM", monthly)).toEqual(
      await userRepository.findNewUsersTimeSeriesRaw("YYYY-MM", monthly)
    );
    expect(await AdminDashboardHelper.findPostsByTypeTimeSeries("YYYY-MM", monthly)).toEqual(
      await socialPostRepository.findPostsByTypeTimeSeriesRaw("YYYY-MM", monthly)
    );
    expect(await AdminDashboardHelper.findEngagementTimeSeries(daily)).toEqual(
      await socialPostRepository.findEngagementTimeSeriesRaw(daily)
    );
    expect(await AdminDashboardHelper.findHourlyActiveUsers(since)).toEqual(
      await userRepository.findHourlyActiveUsersRaw(since)
    );
  });

  test("the two $queryRawUnsafe sites still bind startDate while interpolating the format", async () => {
    // Interpolation is preserved (both bucket formats still work) AND the
    // date is still a bound parameter (a future date yields an empty series).
    const monthly = await userRepository.findNewUsersTimeSeriesRaw("YYYY-MM", monthsAgo(6));
    for (const row of monthly) expect(row.label).toMatch(/^\d{4}-\d{2}$/);

    const dailyFmt = await userRepository.findNewUsersTimeSeriesRaw("YYYY-MM-DD", daysAgo(30));
    for (const row of dailyFmt) expect(row.label).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const future = new Date(Date.now() + 7 * 86400000);
    expect(await userRepository.findNewUsersTimeSeriesRaw("YYYY-MM", future)).toEqual([]);
    expect(await socialPostRepository.findPostsByTypeTimeSeriesRaw("YYYY-MM", future)).toEqual([]);
  });

  test("the two $queryRaw sites keep their ::int casts and ASC ordering", async () => {
    const u = await makeUser({ lastActiveAt: new Date() });
    await makePost(u.id, { likesCount: 2, commentsCount: 1, viewsCount: 5 });

    const engagement = await socialPostRepository.findEngagementTimeSeriesRaw(daysAgo(7));
    for (const row of engagement) {
      expect(row.label).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof row.likes).toBe("number"); // ::int, not BigInt
    }
    const labels = engagement.map((r) => r.label);
    expect([...labels].sort()).toEqual(labels);

    const hourly = await userRepository.findHourlyActiveUsersRaw(new Date(Date.now() - 86400000));
    for (const row of hourly) {
      expect(typeof row.hour).toBe("number");
      expect(row.hour).toBeGreaterThanOrEqual(0);
      expect(row.hour).toBeLessThan(24);
    }
    const hours = hourly.map((r) => r.hour);
    expect([...hours].sort((a, b) => a - b)).toEqual(hours);
  });
});

describe("adminDashboard — counts & aggregates vs repository defaults (Phase 7A hazard)", () => {
  test("post counts are NOT re-scoped by the repository's soft-delete default", async () => {
    // SocialPostRepository.count() applies withNotDeleted unless told
    // otherwise. The dashboard's filters already carry their own isDeleted
    // predicate, so includeDeleted:true keeps the helper's where authoritative
    // — and the results must match the unscoped raw truth either way.
    const u = await makeUser();
    const since = daysAgo(1);
    const before = await AdminDashboardHelper.countPostsCreatedSince(since);

    await makePost(u.id);
    await makePost(u.id, { isDeleted: true }); // must NOT be counted

    expect(await AdminDashboardHelper.countPostsCreatedSince(since)).toBe(before + 1);

    // the repository call the helper makes, verified directly
    const direct = await socialPostRepository.count(
      { isDeleted: false, createdAt: { gte: since } },
      { includeDeleted: true }
    );
    expect(direct).toBe(before + 1);
  });

  test("comment count likewise honours the helper's own isDeleted predicate", async () => {
    const u = await makeUser();
    const p = await makePost(u.id);
    const before = await AdminDashboardHelper.countActiveComments();

    await prisma.comment.create({ data: { postId: p.id, authorId: u.id, content: "live" } });
    await prisma.comment.create({
      data: { postId: p.id, authorId: u.id, content: "gone", isDeleted: true },
    });

    expect(await AdminDashboardHelper.countActiveComments()).toBe(before + 1);
  });

  test("sumFields returns the NEUTRAL sums object, leaving null-coalescing to the caller", async () => {
    const u = await makeUser();
    const before = await AdminDashboardHelper.sumPostLikes();
    await makePost(u.id, { likesCount: 4, viewsCount: 9 });

    const after = await AdminDashboardHelper.sumPostLikes();
    // M-4: the repository now returns the BARE sums object, no _sum wrapper.
    expect(after).not.toHaveProperty("_sum");
    expect((after.likesCount ?? 0) - (before.likesCount ?? 0)).toBe(4);

    // a filter matching nothing yields _sum.<field> === null, NOT 0 — which
    // is exactly why the controller keeps its `?? 0`.
    const empty = await socialPostRepository.sumFields(
      { isDeleted: false, id: "00000000-0000-0000-0000-000000000000" },
      { likesCount: true }
    );
    // null is PRESERVED, not coalesced — the controller keeps its `?? 0`.
    expect(empty.likesCount).toBeNull();
  });

  test("findManyOrdered honours multi-field ordering that neither cursor reader can express", async () => {
    const u = await makeUser();
    const a = await makePost(u.id, { viewsCount: 9300003, likesCount: 1 });
    const b = await makePost(u.id, { viewsCount: 9300002, likesCount: 50 });
    const c = await makePost(u.id, { viewsCount: 9300002, likesCount: 40 });

    const top = await socialPostRepository.findManyOrdered(
      { isDeleted: false },
      { orderBy: [{ viewsCount: "desc" }, { likesCount: "desc" }], take: 3, select: { id: true } }
    );
    expect(top.map((p) => p.id)).toEqual([a.id, b.id, c.id]); // tie broken by likes
  });
});
