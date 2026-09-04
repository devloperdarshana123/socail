// Characterization test for the `admin.report` domain (Milestone 6G).
// Seventh admin controller — analytics-heavy moderation: 6 groupBy
// aggregations, 1 raw SQL time-series, 4 single updates, 3 updateMany,
// plus lookup/count/list/history reads. ZERO transactions (the
// content_removed side-effects run via Promise.all, not $transaction).
//
// Baseline characterizes current behavior via exact inline mirrors of the
// controller's 27 call-sites; after extraction into the NEW
// adminReportHelpers.js the same assertions run against those helpers.
// (reportHelpers.js from 5H owns the NON-admin report controller — the
// admin convention gives each admin controller its own helper.)
//
// EXTERNAL DEPENDENCIES: none (asyncHandler, AppError, prisma, logger;
// res.locals.auditMeta is plain assignment for downstream middleware).
//
// PRESERVED ODDITIES (characterized as-is, deliberately NOT fixed):
//   • orderBy { priority: "desc" } is ALPHABETICAL string ordering —
//     "medium" > "low" > "high" > "critical" — not severity ordering.
//   • updateReportStatus's `if (!report)` 404 check after prisma.report
//     .update is dead code: update THROWS (P2025) for a missing id.
//   • The user_suspended/user_banned branch reads report.reportedUser?.id
//     but the update's include does NOT fetch reportedUser — so only
//     post-author targets are ever actioned via this path.
//   • getReportStats and getAllReports both group open reports by
//     priority, but only the stats variant has an orderBy — two distinct
//     queries, kept separate.
//   • releaseStaleClams' updateMany is global (claimedById != null AND
//     claimExpiresAt <= now) with no further scoping.
//   • getReportHistory's where spreads { id: { lt: beforeId } } AFTER
//     { id: { not: reportId } } — when beforeId is given, the spread
//     overwrites the self-exclusion clause entirely.
//
// ISOLATION: Report rows are global; tests use delta-scoped assertions
// (measure → create fixtures → measure) and marker reasons, mirroring the
// 6F approach. Report has @@unique([reportedById, postId]) — post reports
// always use fresh reporters; null-postId rows are exempt (NULLs distinct).
import { PrismaClient } from "@prisma/client";
import * as AdminReportHelper from "../../src/utils/adminReportHelpers.js";

const prisma = new PrismaClient();

const userIds = [];
const postIds = [];
const reportIds = [];
const MISSING = "00000000-0000-0000-0000-000000000000";
const MARK = `m6g_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

// ── Mirror of the controller's shared include ────────────────────────────
const reportInclude = {
  reportedBy: {
    select: { id: true, username: true, fullName: true, avatar: true },
  },
  post: {
    select: {
      id: true, caption: true, media: true, type: true,
      likesCount: true, commentsCount: true,
      author: {
        select: { id: true, username: true, fullName: true, avatar: true, isVerifiedBadge: true },
      },
    },
  },
  reportedUser: { select: { id: true, username: true, fullName: true, avatar: true } },
  claimedBy:   { select: { id: true, username: true, fullName: true, avatar: true } },
  escalatedBy: { select: { id: true, username: true, fullName: true } },
  reviewedBy:  { select: { id: true, username: true, fullName: true } },
};

// ── Fixtures ─────────────────────────────────────────────────────────────
async function makeUser(role = "user") {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({
    data: { fullName: `Rep ${s}`, email: `rep-${s}@e.com`, username: `rep_${s}`, role, accountStatus: "active" },
  });
  userIds.push(u.id);
  return u;
}
async function makePost(authorId) {
  const p = await prisma.post.create({ data: { authorId, type: "image", caption: "reported post" } });
  postIds.push(p.id);
  return p;
}
// Post-target report by default; pass postId: null + reportedUserId for
// user-target rows (exempt from the (reportedById, postId) unique).
async function makeReport(reportedById, {
  postId = null, reportedUserId = null, commentId = null,
  targetModel = postId ? "Post" : "User", targetId = postId ?? reportedUserId ?? MISSING,
  reason = `${MARK}_spam`, status = "pending", priority = "low",
  escalated = false, claimedById = null, claimedAt = null, claimExpiresAt = null,
  createdAt = null,
} = {}) {
  const r = await prisma.report.create({
    data: {
      reportedById, postId, reportedUserId, commentId, targetModel, targetId,
      reason, status, priority, escalated, claimedById, claimedAt, claimExpiresAt,
      ...(createdAt ? { createdAt } : {}),
    },
  });
  reportIds.push(r.id);
  return r;
}

let reporter, author, moderator;

beforeAll(async () => {
  reporter = await makeUser();
  author = await makeUser();
  moderator = await makeUser("super_admin");
});

afterAll(async () => {
  await prisma.report.deleteMany({ where: { id: { in: reportIds } } });
  await prisma.comment.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.post.deleteMany({ where: { id: { in: postIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────
describe("report stats — groupBy widgets (inline mirror)", () => {
  test("groupBy status: {status, _count._all} rows; buckets grow with fixtures", async () => {
    const run = () => prisma.report.groupBy({ by: ["status"], _count: { _all: true } });
    const countOf = (rows, s) => rows.find((r) => r.status === s)?._count._all ?? 0;

    const before = await run();
    await makeReport(reporter.id, { status: "pending" });
    await makeReport(reporter.id, { status: "dismissed" });
    const after = await run();

    expect(countOf(after, "pending") - countOf(before, "pending")).toBe(1);
    expect(countOf(after, "dismissed") - countOf(before, "dismissed")).toBe(1);
    for (const row of after) expect(typeof row._count._all).toBe("number");
  });

  test("groupBy reason: take 5, ordered by count desc", async () => {
    for (let i = 0; i < 3; i++) await makeReport(reporter.id, { reason: `${MARK}_dominant` });

    const rows = await prisma.report.groupBy({
      by: ["reason"],
      _count: { _all: true },
      orderBy: { _count: { reason: "desc" } },
      take: 5,
    });
    expect(rows.length).toBeLessThanOrEqual(5);
    const counts = rows.map((r) => r._count._all);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts); // desc
  });

  test("groupBy targetModel: buckets grow per model", async () => {
    const run = () => prisma.report.groupBy({ by: ["targetModel"], _count: { _all: true } });
    const countOf = (rows, m) => rows.find((r) => r.targetModel === m)?._count._all ?? 0;

    const before = await run();
    const p = await makePost(author.id);
    const r1 = await makeUser();
    await makeReport(r1.id, { postId: p.id }); // Post
    await makeReport(reporter.id, { reportedUserId: author.id }); // User
    const after = await run();

    expect(countOf(after, "Post") - countOf(before, "Post")).toBe(1);
    expect(countOf(after, "User") - countOf(before, "User")).toBe(1);
  });

  test("open-priority groupBy (stats variant, WITH orderBy): only pending/under_review counted, desc counts", async () => {
    const run = () => prisma.report.groupBy({
      by: ["priority"],
      where: { status: { in: ["pending", "under_review"] } },
      _count: { _all: true },
      orderBy: { _count: { priority: "desc" } },
    });
    const countOf = (rows, p) => rows.find((r) => r.priority === p)?._count._all ?? 0;

    const before = await run();
    await makeReport(reporter.id, { priority: "critical", status: "pending" });
    await makeReport(reporter.id, { priority: "critical", status: "under_review" });
    await makeReport(reporter.id, { priority: "critical", status: "dismissed" }); // excluded
    const after = await run();

    expect(countOf(after, "critical") - countOf(before, "critical")).toBe(2);
    const counts = after.map((r) => r._count._all);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  test("open-priority groupBy (list-sidebar variant, NO orderBy): same filter, distinct query", async () => {
    const run = () => prisma.report.groupBy({
      by: ["priority"],
      where: { status: { in: ["pending", "under_review"] } },
      _count: { _all: true },
    });
    const countOf = (rows, p) => rows.find((r) => r.priority === p)?._count._all ?? 0;

    const before = await run();
    await makeReport(reporter.id, { priority: "high", status: "under_review" });
    const after = await run();
    expect(countOf(after, "high") - countOf(before, "high")).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("report stats — raw SQL daily trend (inline mirror)", () => {
  const runTrend = (since) => prisma.$queryRaw`
      SELECT
        TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "_id",
        COUNT(*)::int AS count
      FROM "Report"
      WHERE "createdAt" >= ${since}
      GROUP BY "_id"
      ORDER BY "_id" ASC
    `;

  test("rows are {_id: YYYY-MM-DD, count ::int}, ASC; totals grow with fixtures", async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const total = (rows) => rows.reduce((s, r) => s + r.count, 0);

    const before = await runTrend(since);
    await makeReport(reporter.id);
    await makeReport(reporter.id, { createdAt: new Date(Date.now() - 2 * 86400000) });
    const after = await runTrend(since);

    expect(total(after) - total(before)).toBe(2);
    for (const row of after) {
      expect(row._id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof row.count).toBe("number"); // ::int cast, NOT BigInt
    }
    const ids = after.map((r) => r._id);
    expect([...ids].sort()).toEqual(ids); // ASC
  });

  test("parameterized: future since yields empty series", async () => {
    expect(await runTrend(new Date(Date.now() + 86400000))).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("report listing — findMany/count with filters (inline mirror)", () => {
  test("filtering + include shape + count; empty filter set returns []/0", async () => {
    const reason = `${MARK}_listing`;
    const p = await makePost(author.id);
    const u1 = await makeUser();
    const u2 = await makeUser();
    await makeReport(u1.id, { postId: p.id, reason, priority: "high" });
    await makeReport(u2.id, { postId: p.id, reason, priority: "low", escalated: true });

    const where = { reason };
    const [reports, totalCount] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip: 0,
        take: 20,
        include: reportInclude,
      }),
      prisma.report.count({ where }),
    ]);

    expect(totalCount).toBe(2);
    expect(reports.length).toBe(2);
    // include shape
    const keys = Object.keys(reports[0]);
    for (const k of ["reportedBy", "post", "reportedUser", "claimedBy", "escalatedBy", "reviewedBy"]) {
      expect(keys).toContain(k);
    }
    expect(reports[0].post.author.id).toBe(author.id);

    // escalated filter
    expect(await prisma.report.count({ where: { reason, escalated: true } })).toBe(1);
    // claimedById null filter (unclaimedOnly)
    expect(await prisma.report.count({ where: { reason, claimedById: null } })).toBe(2);
    // empty dataset
    expect(await prisma.report.findMany({ where: { reason: `${MARK}_nope` }, include: reportInclude })).toEqual([]);
    expect(await prisma.report.count({ where: { reason: `${MARK}_nope` } })).toBe(0);
  });

  test("PRESERVED ODDITY: priority desc is alphabetical (medium > low > high > critical)", async () => {
    const reason = `${MARK}_prio`;
    for (const priority of ["critical", "medium", "high", "low"]) {
      const u = await makeUser();
      await makeReport(u.id, { reason, priority });
    }
    const rows = await prisma.report.findMany({
      where: { reason },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      skip: 0,
      take: 20,
      include: reportInclude,
    });
    expect(rows.map((r) => r.priority)).toEqual(["medium", "low", "high", "critical"]);
  });

  test("createdAt asc variant orders oldest-first within equal priority", async () => {
    const reason = `${MARK}_asc`;
    const u1 = await makeUser();
    const u2 = await makeUser();
    const first = await makeReport(u1.id, { reason });
    await new Promise((r) => setTimeout(r, 5));
    await makeReport(u2.id, { reason });

    const rows = await prisma.report.findMany({
      where: { reason },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      skip: 0,
      take: 20,
      include: reportInclude,
    });
    expect(rows[0].id).toBe(first.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("report detail + sibling counts (inline mirror)", () => {
  test("findUnique detail includes comment relation; null for missing (404 path)", async () => {
    const p = await makePost(author.id);
    const c = await prisma.comment.create({ data: { postId: p.id, authorId: author.id, content: "rude" } });
    const u = await makeUser();
    const rep = await makeReport(u.id, { postId: p.id, commentId: c.id });

    const detailInclude = {
      reportedBy: {
        select: {
          id: true, username: true, fullName: true, avatar: true,
          accountStatus: true, isVerifiedBadge: true, createdAt: true,
        },
      },
      post: {
        select: {
          id: true, caption: true, media: true, type: true,
          likesCount: true, commentsCount: true, createdAt: true,
          author: {
            select: { id: true, username: true, fullName: true, avatar: true, isVerifiedBadge: true },
          },
        },
      },
      reportedUser: { select: { id: true, username: true, fullName: true, avatar: true } },
      comment: {
        select: {
          id: true,
          content: true,
          author: {
            select: { id: true, username: true, fullName: true, avatar: true, isVerifiedBadge: true },
          },
        },
      },
      reviewedBy:  { select: { id: true, username: true, fullName: true, avatar: true } },
      claimedBy:   { select: { id: true, username: true, fullName: true, avatar: true } },
      escalatedBy: { select: { id: true, username: true, fullName: true, avatar: true } },
    };

    const found = await prisma.report.findUnique({ where: { id: rep.id }, include: detailInclude });
    expect(found.comment.content).toBe("rude");
    expect(found.reportedBy.accountStatus).toBe("active");
    expect(found.post.createdAt).toBeTruthy();

    expect(await prisma.report.findUnique({ where: { id: MISSING }, include: detailInclude })).toBeNull();
  });

  test("sibling counts: others on same post, and open-only subset", async () => {
    const p = await makePost(author.id);
    const [u1, u2, u3] = [await makeUser(), await makeUser(), await makeUser()];
    const mine = await makeReport(u1.id, { postId: p.id, status: "pending" });
    await makeReport(u2.id, { postId: p.id, status: "under_review" });
    await makeReport(u3.id, { postId: p.id, status: "dismissed" });

    const [otherCount, openCount] = await Promise.all([
      prisma.report.count({ where: { postId: p.id, id: { not: mine.id } } }),
      prisma.report.count({
        where: { postId: p.id, id: { not: mine.id }, status: { in: ["pending", "under_review"] } },
      }),
    ]);
    expect(otherCount).toBe(2);
    expect(openCount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("report history (inline mirror)", () => {
  test("postId lookup, then history excluding self, desc, take, beforeId cursor", async () => {
    const p = await makePost(author.id);
    const [u1, u2, u3] = [await makeUser(), await makeUser(), await makeUser()];
    const mine = await makeReport(u1.id, { postId: p.id });
    const sib1 = await makeReport(u2.id, { postId: p.id });
    const sib2 = await makeReport(u3.id, { postId: p.id });

    const lookedUp = await prisma.report.findUnique({ where: { id: mine.id }, select: { postId: true } });
    expect(lookedUp).toEqual({ postId: p.id });
    expect(await prisma.report.findUnique({ where: { id: MISSING }, select: { postId: true } })).toBeNull();

    const history = await prisma.report.findMany({
      where: { postId: lookedUp.postId, id: { not: mine.id } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        reportedBy: { select: { id: true, username: true, fullName: true, avatar: true } },
        reviewedBy: { select: { id: true, username: true, fullName: true } },
      },
    });
    expect(history.map((h) => h.id).sort()).toEqual([sib1.id, sib2.id].sort());
    expect(history[0].reportedBy.username).toBeTruthy();

    // beforeId cursor — PRESERVED ODDITY: the controller assembles
    // { id: { not } , ...(beforeId ? { id: { lt } } : {}) }, so the spread
    // OVERWRITES the self-exclusion whenever beforeId is provided.
    const maxId = [sib1.id, sib2.id].sort()[1];
    const cursorWhere = {
      postId: lookedUp.postId,
      id: { not: mine.id },
      ...(maxId ? { id: { lt: maxId } } : {}),
    };
    expect(cursorWhere.id).toEqual({ lt: maxId }); // `not` clause lost
    const withCursor = await prisma.report.findMany({
      where: cursorWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        reportedBy: { select: { id: true, username: true, fullName: true, avatar: true } },
        reviewedBy: { select: { id: true, username: true, fullName: true } },
      },
    });
    for (const h of withCursor) expect(h.id < maxId).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("claim / release / escalate (inline mirror)", () => {
  test("claim lookup includes claimedBy {id, username}; claim update sets fields + pending→under_review", async () => {
    const u = await makeUser();
    const rep = await makeReport(u.id, { status: "pending" });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    const existing = await prisma.report.findUnique({
      where: { id: rep.id },
      include: { claimedBy: { select: { id: true, username: true } } },
    });
    expect(existing.claimedBy).toBeNull();

    const claimed = await prisma.report.update({
      where: { id: rep.id },
      data: {
        claimedById: moderator.id,
        claimedAt: now,
        claimExpiresAt: expiresAt,
        status: existing.status === "pending" ? "under_review" : existing.status,
      },
      include: reportInclude,
    });
    expect(claimed.status).toBe("under_review");
    expect(claimed.claimedBy.id).toBe(moderator.id);
    expect(claimed.claimExpiresAt.getTime()).toBe(expiresAt.getTime());
  });

  test("release lookup selects {id, claimedById}; release update nulls the claim triple", async () => {
    const u = await makeUser();
    const rep = await makeReport(u.id, {
      claimedById: moderator.id, claimedAt: new Date(), claimExpiresAt: new Date(Date.now() + 600000),
    });

    const existing = await prisma.report.findUnique({
      where: { id: rep.id },
      select: { id: true, claimedById: true },
    });
    expect(existing).toEqual({ id: rep.id, claimedById: moderator.id });

    const released = await prisma.report.update({
      where: { id: rep.id },
      data: { claimedById: null, claimedAt: null, claimExpiresAt: null },
      include: reportInclude,
    });
    expect(released.claimedById).toBeNull();
    expect(released.claimedBy).toBeNull();
  });

  test("escalate lookup selects {id, escalated, status}; escalate update bumps priority to high", async () => {
    const u = await makeUser();
    const rep = await makeReport(u.id, { status: "pending", priority: "low" });

    const existing = await prisma.report.findUnique({
      where: { id: rep.id },
      select: { id: true, escalated: true, status: true },
    });
    expect(existing).toEqual({ id: rep.id, escalated: false, status: "pending" });

    const escalated = await prisma.report.update({
      where: { id: rep.id },
      data: {
        escalated: true,
        escalationReason: "urgent",
        escalatedAt: new Date(),
        escalatedById: moderator.id,
        priority: "high",
      },
      include: reportInclude,
    });
    expect(escalated.escalated).toBe(true);
    expect(escalated.priority).toBe("high");
    expect(escalated.escalatedBy.id).toBe(moderator.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("status update + moderation side-effects (inline mirror)", () => {
  const statusUpdateInclude = {
    reportedBy: { select: { id: true, username: true, fullName: true, avatar: true } },
    reviewedBy: { select: { id: true, username: true, fullName: true, avatar: true } },
    post:       { select: { id: true, authorId: true } },
  };

  test("update applies review fields, releases claim, returns trimmed include; missing id THROWS (dead 404 oddity)", async () => {
    const u = await makeUser();
    const p = await makePost(author.id);
    const rep = await makeReport(u.id, {
      postId: p.id, status: "under_review",
      claimedById: moderator.id, claimedAt: new Date(), claimExpiresAt: new Date(Date.now() + 600000),
    });

    const updated = await prisma.report.update({
      where: { id: rep.id },
      data: {
        status: "resolved_no_action",
        actionTaken: "none",
        moderatorNote: "ok",
        reviewedById: moderator.id,
        reviewedAt: new Date(),
        claimedById: null,
        claimedAt: null,
        claimExpiresAt: null,
      },
      include: statusUpdateInclude,
    });
    expect(updated.status).toBe("resolved_no_action");
    expect(updated.claimedById).toBeNull();
    expect(updated.reviewedBy.id).toBe(moderator.id);
    expect(updated.post).toEqual({ id: p.id, authorId: author.id });
    // reportedUser is NOT in this include — the user-target action oddity
    expect("reportedUser" in updated).toBe(false);

    await expect(prisma.report.update({
      where: { id: MISSING },
      data: { status: "dismissed" },
      include: statusUpdateInclude,
    })).rejects.toMatchObject({ code: "P2025" });
  });

  test("content_removed: soft-deletes post and auto-resolves other OPEN reports on it", async () => {
    const p = await makePost(author.id);
    const [u1, u2, u3, u4] = [await makeUser(), await makeUser(), await makeUser(), await makeUser()];
    const mine = await makeReport(u1.id, { postId: p.id, status: "under_review" });
    const open1 = await makeReport(u2.id, { postId: p.id, status: "pending" });
    const open2 = await makeReport(u3.id, {
      postId: p.id, status: "under_review",
      claimedById: moderator.id, claimedAt: new Date(), claimExpiresAt: new Date(Date.now() + 600000),
    });
    const closed = await makeReport(u4.id, { postId: p.id, status: "dismissed" });

    await Promise.all([
      prisma.post.update({
        where: { id: p.id },
        data: { isDeleted: true, deletedAt: new Date() },
      }),
      prisma.report.updateMany({
        where: {
          postId: p.id,
          id: { not: mine.id },
          status: { in: ["pending", "under_review"] },
        },
        data: {
          status: "resolved_action_taken",
          actionTaken: "content_removed",
          moderatorNote: "Auto-resolved: content removed",
          reviewedById: moderator.id,
          reviewedAt: new Date(),
          claimedById: null,
          claimedAt: null,
          claimExpiresAt: null,
        },
      }),
    ]);

    expect((await prisma.post.findUnique({ where: { id: p.id } })).isDeleted).toBe(true);
    const s1 = await prisma.report.findUnique({ where: { id: open1.id } });
    const s2 = await prisma.report.findUnique({ where: { id: open2.id } });
    expect(s1.status).toBe("resolved_action_taken");
    expect(s1.moderatorNote).toBe("Auto-resolved: content removed");
    expect(s2.claimedById).toBeNull(); // claim released by the bulk data
    expect((await prisma.report.findUnique({ where: { id: closed.id } })).status).toBe("dismissed");
    expect((await prisma.report.findUnique({ where: { id: mine.id } })).status).toBe("under_review"); // self excluded
  });

  test("user_suspended / user_banned set accountStatus on the target author", async () => {
    const target = await makeUser();
    await prisma.user.update({ where: { id: target.id }, data: { accountStatus: "suspended" } });
    expect((await prisma.user.findUnique({ where: { id: target.id } })).accountStatus).toBe("suspended");
    await prisma.user.update({ where: { id: target.id }, data: { accountStatus: "banned" } });
    expect((await prisma.user.findUnique({ where: { id: target.id } })).accountStatus).toBe("banned");
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("bulk update + stale-claim release (inline mirror)", () => {
  test("bulk updateMany by id list applies review data and reports count", async () => {
    const [u1, u2] = [await makeUser(), await makeUser()];
    const a = await makeReport(u1.id);
    const b = await makeReport(u2.id, {
      claimedById: moderator.id, claimedAt: new Date(), claimExpiresAt: new Date(Date.now() + 600000),
    });

    const result = await prisma.report.updateMany({
      where: { id: { in: [a.id, b.id, MISSING] } },
      data: {
        status: "dismissed",
        actionTaken: "none",
        reviewedById: moderator.id,
        reviewedAt: new Date(),
        claimedById: null,
        claimedAt: null,
        claimExpiresAt: null,
      },
    });
    expect(result.count).toBe(2); // missing id contributes nothing

    const bAfter = await prisma.report.findUnique({ where: { id: b.id } });
    expect(bAfter.status).toBe("dismissed");
    expect(bAfter.claimedById).toBeNull();
  });

  test("stale-claim release: expired claims cleared, live claims kept (global updateMany)", async () => {
    const [u1, u2] = [await makeUser(), await makeUser()];
    const stale = await makeReport(u1.id, {
      claimedById: moderator.id, claimedAt: new Date(Date.now() - 3600000), claimExpiresAt: new Date(Date.now() - 60000),
    });
    const live = await makeReport(u2.id, {
      claimedById: moderator.id, claimedAt: new Date(), claimExpiresAt: new Date(Date.now() + 3600000),
    });

    const now = new Date();
    const result = await prisma.report.updateMany({
      where: {
        claimedById: { not: null },
        claimExpiresAt: { lte: now },
      },
      data: { claimedById: null, claimedAt: null, claimExpiresAt: null },
    });
    expect(result.count).toBeGreaterThanOrEqual(1); // global query — at least our stale row

    expect((await prisma.report.findUnique({ where: { id: stale.id } })).claimedById).toBeNull();
    expect((await prisma.report.findUnique({ where: { id: live.id } })).claimedById).toBe(moderator.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// After extraction: the 19 helpers must match the inline behavior exactly.
describe("adminReportHelpers — extracted queries match inline behavior", () => {
  test("the five groupBy helpers reproduce the widget shapes and filters", async () => {
    // M-4: helpers now return neutral { key, count } rows.
    const countOf = (rows, _field, v) => rows.find((r) => r.key === v)?.count ?? 0;

    const [st0, pr0, prU0, tm0] = await Promise.all([
      AdminReportHelper.groupReportsByStatus(),
      AdminReportHelper.groupOpenReportsByPriorityOrdered(),
      AdminReportHelper.groupOpenReportsByPriority(),
      AdminReportHelper.groupReportsByTargetModel(),
    ]);

    await makeReport(reporter.id, { status: "pending", priority: "critical", reason: `${MARK}_hm` });
    await makeReport(reporter.id, { status: "dismissed", priority: "critical", reason: `${MARK}_hm` }); // closed — excluded from priority widgets
    await makeReport(reporter.id, { reportedUserId: author.id, reason: `${MARK}_hm` });

    const [st1, pr1, prU1, tm1, reasons] = await Promise.all([
      AdminReportHelper.groupReportsByStatus(),
      AdminReportHelper.groupOpenReportsByPriorityOrdered(),
      AdminReportHelper.groupOpenReportsByPriority(),
      AdminReportHelper.groupReportsByTargetModel(),
      AdminReportHelper.groupTopReportReasons(),
    ]);

    expect(countOf(st1, "status", "pending") - countOf(st0, "status", "pending")).toBe(2);
    expect(countOf(st1, "status", "dismissed") - countOf(st0, "status", "dismissed")).toBe(1);
    expect(countOf(pr1, "priority", "critical") - countOf(pr0, "priority", "critical")).toBe(1);
    expect(countOf(prU1, "priority", "critical") - countOf(prU0, "priority", "critical")).toBe(1);
    // all three fixtures above are User-model rows (no postId)
    expect(countOf(tm1, "targetModel", "User") - countOf(tm0, "targetModel", "User")).toBe(3);
    // ordered variant: counts desc
    const prCounts = pr1.map((r) => r.count);
    expect([...prCounts].sort((a, b) => b - a)).toEqual(prCounts);
    // top reasons: take 5, desc
    expect(reasons.length).toBeLessThanOrEqual(5);
    const rCounts = reasons.map((r) => r.count);
    expect([...rCounts].sort((a, b) => b - a)).toEqual(rCounts);
  });

  test("findReportDailyTrend matches the raw shape and parameterization", async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const total = (rows) => rows.reduce((s, r) => s + r.count, 0);
    const before = await AdminReportHelper.findReportDailyTrend(since);
    await makeReport(reporter.id);
    const after = await AdminReportHelper.findReportDailyTrend(since);

    expect(total(after) - total(before)).toBe(1);
    for (const row of after) {
      expect(row._id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof row.count).toBe("number");
    }
    expect(await AdminReportHelper.findReportDailyTrend(new Date(Date.now() + 86400000))).toEqual([]);
  });

  test("findReports/countReports: filters, alphabetical-priority oddity, include, empty set", async () => {
    const reason = `${MARK}_hmlist`;
    for (const priority of ["critical", "medium", "high", "low"]) {
      const u = await makeUser();
      await makeReport(u.id, { reason, priority });
    }
    const rows = await AdminReportHelper.findReports(
      { reason },
      [{ priority: "desc" }, { createdAt: "desc" }],
      0,
      20,
    );
    expect(rows.map((r) => r.priority)).toEqual(["medium", "low", "high", "critical"]);
    for (const k of ["reportedBy", "post", "reportedUser", "claimedBy", "escalatedBy", "reviewedBy"]) {
      expect(Object.keys(rows[0])).toContain(k);
    }
    expect(await AdminReportHelper.countReports({ reason })).toBe(4);
    expect((await AdminReportHelper.findReports({ reason }, [{ priority: "desc" }, { createdAt: "desc" }], 1, 2)).length).toBe(2);
    expect(await AdminReportHelper.findReports({ reason: `${MARK}_hmnone` }, [{ priority: "desc" }], 0, 20)).toEqual([]);
    expect(await AdminReportHelper.countReports({ reason: `${MARK}_hmnone` })).toBe(0);
  });

  test("findReportDetail includes the comment relation; null for missing; sibling counts via countReports", async () => {
    const p = await makePost(author.id);
    const c = await prisma.comment.create({ data: { postId: p.id, authorId: author.id, content: "hm-rude" } });
    const [u1, u2] = [await makeUser(), await makeUser()];
    const mine = await makeReport(u1.id, { postId: p.id, commentId: c.id });
    await makeReport(u2.id, { postId: p.id, status: "under_review" });

    const found = await AdminReportHelper.findReportDetail(mine.id);
    expect(found.comment.content).toBe("hm-rude");
    expect(found.reportedBy.accountStatus).toBe("active");
    expect(await AdminReportHelper.findReportDetail(MISSING)).toBeNull();

    expect(await AdminReportHelper.countReports({ postId: p.id, id: { not: mine.id } })).toBe(1);
    expect(await AdminReportHelper.countReports({
      postId: p.id, id: { not: mine.id }, status: { in: ["pending", "under_review"] },
    })).toBe(1);
  });

  test("findReportPostId + findReportHistory (incl. the beforeId-overwrite where)", async () => {
    const p = await makePost(author.id);
    const [u1, u2] = [await makeUser(), await makeUser()];
    const mine = await makeReport(u1.id, { postId: p.id });
    const sib = await makeReport(u2.id, { postId: p.id });

    expect(await AdminReportHelper.findReportPostId(mine.id)).toEqual({ postId: p.id });
    expect(await AdminReportHelper.findReportPostId(MISSING)).toBeNull();

    const history = await AdminReportHelper.findReportHistory(
      { postId: p.id, id: { not: mine.id } },
      20,
    );
    expect(history.map((h) => h.id)).toEqual([sib.id]);
    expect(history[0].reviewedBy).toBeNull();
  });

  test("claim/release/escalate state lookups and updateReportById round-trips", async () => {
    const u = await makeUser();
    const rep = await makeReport(u.id, { status: "pending", priority: "low" });

    expect((await AdminReportHelper.findReportWithClaimer(rep.id)).claimedBy).toBeNull();
    expect(await AdminReportHelper.findReportClaimState(rep.id)).toEqual({ id: rep.id, claimedById: null });
    expect(await AdminReportHelper.findReportEscalationState(rep.id)).toEqual({ id: rep.id, escalated: false, status: "pending" });

    const now = new Date();
    const claimed = await AdminReportHelper.updateReportById(rep.id, {
      claimedById: moderator.id, claimedAt: now,
      claimExpiresAt: new Date(now.getTime() + 30 * 60 * 1000),
      status: "under_review",
    });
    expect(claimed.status).toBe("under_review");
    expect(claimed.claimedBy.id).toBe(moderator.id);

    const escalated = await AdminReportHelper.updateReportById(rep.id, {
      escalated: true, escalationReason: null, escalatedAt: new Date(),
      escalatedById: moderator.id, priority: "high",
    });
    expect(escalated.priority).toBe("high");

    const released = await AdminReportHelper.updateReportById(rep.id, {
      claimedById: null, claimedAt: null, claimExpiresAt: null,
    });
    expect(released.claimedById).toBeNull();
  });

  test("updateReportForResolution: trimmed include, no reportedUser, P2025 on missing", async () => {
    const u = await makeUser();
    const p = await makePost(author.id);
    const rep = await makeReport(u.id, { postId: p.id, status: "under_review" });

    const updated = await AdminReportHelper.updateReportForResolution(rep.id, {
      status: "resolved_no_action", actionTaken: "none", moderatorNote: "",
      reviewedById: moderator.id, reviewedAt: new Date(),
      claimedById: null, claimedAt: null, claimExpiresAt: null,
    });
    expect(updated.post).toEqual({ id: p.id, authorId: author.id });
    expect("reportedUser" in updated).toBe(false); // the user-action oddity

    await expect(AdminReportHelper.updateReportForResolution(MISSING, { status: "dismissed" }))
      .rejects.toMatchObject({ code: "P2025" });
  });

  test("side-effect helpers: soft-delete post, auto-resolve/bulk/stale via updateReportsWhere, accountStatus", async () => {
    const p = await makePost(author.id);
    const [u1, u2] = [await makeUser(), await makeUser()];
    const mine = await makeReport(u1.id, { postId: p.id, status: "under_review" });
    const open = await makeReport(u2.id, { postId: p.id, status: "pending" });

    await AdminReportHelper.softDeleteReportedPost(p.id, { isDeleted: true, deletedAt: new Date() });
    expect((await prisma.post.findUnique({ where: { id: p.id } })).isDeleted).toBe(true);

    const bulk = await AdminReportHelper.updateReportsWhere(
      { postId: p.id, id: { not: mine.id }, status: { in: ["pending", "under_review"] } },
      {
        status: "resolved_action_taken", actionTaken: "content_removed",
        moderatorNote: "Auto-resolved: content removed",
        reviewedById: moderator.id, reviewedAt: new Date(),
        claimedById: null, claimedAt: null, claimExpiresAt: null,
      },
    );
    expect(bulk.count).toBe(1);
    expect((await prisma.report.findUnique({ where: { id: open.id } })).status).toBe("resolved_action_taken");
    expect((await prisma.report.findUnique({ where: { id: mine.id } })).status).toBe("under_review");

    // stale sweep shape (scoped assertion on our own expired row)
    const u3 = await makeUser();
    const stale = await makeReport(u3.id, {
      claimedById: moderator.id, claimedAt: new Date(Date.now() - 3600000),
      claimExpiresAt: new Date(Date.now() - 60000),
    });
    await AdminReportHelper.updateReportsWhere(
      { claimedById: { not: null }, claimExpiresAt: { lte: new Date() } },
      { claimedById: null, claimedAt: null, claimExpiresAt: null },
    );
    expect((await prisma.report.findUnique({ where: { id: stale.id } })).claimedById).toBeNull();

    const target = await makeUser();
    await AdminReportHelper.updateUserAccountStatus(target.id, { accountStatus: "banned" });
    expect((await prisma.user.findUnique({ where: { id: target.id } })).accountStatus).toBe("banned");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 7A Milestone 15 — repository-boundary regressions.
//
// The suite above proves the helpers still behave identically. These pin
// the hazards introduced BY the repository boundary itself, so a future
// change inside ReportRepository (merging the aggregations, routing a read
// through toPrismaPagination, swapping update() for delete(), dropping the
// error normalizer's code passthrough) fails here instead of silently
// altering admin behavior.
describe("repository boundary — Phase 7A hazards", () => {
  test("the two open-priority groupBys stay INDEPENDENT: same buckets, only one ordered", async () => {
    // Skew the open-priority distribution so an ordering difference is
    // observable at all.
    const skew = await makeUser();
    for (let i = 0; i < 4; i++) {
      await makeReport(skew.id, { status: "pending", priority: "critical" });
    }

    const ordered  = await AdminReportHelper.groupOpenReportsByPriorityOrdered();
    const unsorted = await AdminReportHelper.groupOpenReportsByPriority();

    // Same filter → same bucket multiset (compared order-insensitively).
    const norm = (rows) =>
      rows.map((r) => `${r.key}:${r.count}`).sort();
    expect(norm(unsorted)).toEqual(norm(ordered));

    // …but the ordered variant carries the count-desc guarantee. If the two
    // methods were ever merged, this is the property that would be lost.
    const counts = ordered.map((r) => r.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));

    // Neither variant may leak closed reports.
    for (const rows of [ordered, unsorted]) {
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => typeof r.key === "string")).toBe(true);
    }
  });

  test("findReports is UNCAPPED: repository forwards raw skip/take (no 20-row default)", async () => {
    // toPrismaPagination() caps `take` at 20 by default. findManyOrdered
    // deliberately bypasses it — the admin list owns its own page window and
    // echoes it back to the client, so a silent cap would truncate page 1.
    const bulkReporter = await makeUser();
    const mark = `${MARK}_cap`;
    for (let i = 0; i < 25; i++) {
      // postId stays null → exempt from @@unique([reportedById, postId]).
      await makeReport(bulkReporter.id, { reason: mark });
    }

    const page = await AdminReportHelper.findReports(
      { reason: mark }, { createdAt: "desc" }, 0, 25,
    );
    expect(page).toHaveLength(25);
    expect(await AdminReportHelper.countReports({ reason: mark })).toBe(25);

    // skip is forwarded raw too.
    const second = await AdminReportHelper.findReports(
      { reason: mark }, { createdAt: "desc" }, 20, 25,
    );
    expect(second).toHaveLength(5);
  });

  test("findReports honours the caller's orderBy; findReportHistory's ordering is FIXED desc", async () => {
    const u = await makeUser();
    const mark = `${MARK}_ord`;
    const base = Date.now() - 3_600_000;
    const rows = [];
    for (let i = 0; i < 3; i++) {
      rows.push(await makeReport(u.id, { reason: mark, createdAt: new Date(base + i * 60_000) }));
    }
    const [oldest, , newest] = rows;

    // findManyOrdered → caller-owned direction, both ways.
    const asc  = await AdminReportHelper.findReports({ reason: mark }, { createdAt: "asc" },  0, 10);
    const desc = await AdminReportHelper.findReports({ reason: mark }, { createdAt: "desc" }, 0, 10);
    expect(asc[0].id).toBe(oldest.id);
    expect(desc[0].id).toBe(newest.id);

    // findManyWithRelations → hardcoded createdAt desc; the history helper
    // takes no orderBy and must not acquire one.
    const history = await AdminReportHelper.findReportHistory({ reason: mark }, 10);
    expect(history.map((r) => r.id)).toEqual(desc.map((r) => r.id));
    expect(history[0].reportedBy).toMatchObject({ id: u.id });
    expect(history[0].post).toBeUndefined(); // history's include is narrower
  });

  test("update errors normalize to NotFoundError but KEEP code P2025 for the error handler", async () => {
    // globalErrorHandler branches on the Prisma code, not the class — the
    // normalizer must preserve it across the repository boundary.
    await expect(AdminReportHelper.updateReportById(MISSING, { priority: "high" }))
      .rejects.toMatchObject({ name: "NotFoundError", code: "P2025" });
    await expect(AdminReportHelper.updateReportForResolution(MISSING, { status: "dismissed" }))
      .rejects.toMatchObject({ name: "NotFoundError", code: "P2025" });
    await expect(AdminReportHelper.updateUserAccountStatus(MISSING, { accountStatus: "banned" }))
      .rejects.toMatchObject({ name: "NotFoundError", code: "P2025" });
    await expect(AdminReportHelper.softDeleteReportedPost(MISSING, { isDeleted: true }))
      .rejects.toMatchObject({ name: "NotFoundError", code: "P2025" });
  });

  test("softDeleteReportedPost writes the CONTROLLER's bundle verbatim (update, not delete)", async () => {
    // SocialPostRepository.delete() applies its OWN { isDeleted, deletedAt }
    // payload. This helper must route through update() so the controller
    // stays the owner of the soft-delete bundle — and so the same helper can
    // write a bundle that is not a soft delete at all.
    const p = await makePost(author.id);

    await AdminReportHelper.softDeleteReportedPost(p.id, { isDeleted: true });
    let row = await prisma.post.findUnique({ where: { id: p.id } });
    expect(row.isDeleted).toBe(true);
    expect(row.deletedAt).toBeNull(); // delete() would have stamped this

    await AdminReportHelper.softDeleteReportedPost(p.id, { isDeleted: false, deletedAt: null });
    row = await prisma.post.findUnique({ where: { id: p.id } });
    expect(row.isDeleted).toBe(false);
  });

  test("updateReportsWhere keeps updateMany semantics: {count}, 0 on no match, never throws", async () => {
    const zero = await AdminReportHelper.updateReportsWhere(
      { reason: `${MARK}_nothing_matches_this` },
      { priority: "high" },
    );
    expect(zero).toMatchObject({ count: 0 });

    const u = await makeUser();
    const mark = `${MARK}_many`;
    const a = await makeReport(u.id, { reason: mark, status: "pending" });
    const b = await makeReport(u.id, { reason: mark, status: "under_review" });

    const hit = await AdminReportHelper.updateReportsWhere({ reason: mark }, { priority: "critical" });
    expect(hit).toMatchObject({ count: 2 });
    for (const r of [a, b]) {
      expect((await prisma.report.findUnique({ where: { id: r.id } })).priority).toBe("critical");
    }
  });

  test("countReports is UNSCOPED: the caller's where is the only filter applied", async () => {
    // ReportRepository.count() adds no soft-delete/status scoping of its
    // own — the controller assembles the whole filter.
    const inline = await prisma.report.count({ where: { status: "pending" } });
    expect(await AdminReportHelper.countReports({ status: "pending" })).toBe(inline);
    expect(await AdminReportHelper.countReports({})).toBe(await prisma.report.count());
  });

  test("findDailyTrendRaw is still a BOUND parameter, not interpolated text", async () => {
    // The statement moved byte-identical into the repository; it must remain
    // a $queryRaw tagged template (Date in, no string splicing).
    const u = await makeUser();
    await makeReport(u.id, { reason: `${MARK}_trend` });

    const since = new Date(Date.now() - 7 * 86_400_000);
    const rows = await AdminReportHelper.findReportDailyTrend(since);
    const inline = await prisma.$queryRaw`
      SELECT
        TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "_id",
        COUNT(*)::int AS count
      FROM "Report"
      WHERE "createdAt" >= ${since}
      GROUP BY "_id"
      ORDER BY "_id" ASC
    `;
    expect(rows).toEqual(inline);
    expect(rows.every((r) => Number.isInteger(r.count))).toBe(true);
  });
});
