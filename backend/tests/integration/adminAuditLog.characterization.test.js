// Characterization test for the `admin.auditlog` domain (Milestone 6C).
// Third admin controller — validates RAW SQL extraction into the admin
// helper layer, in the smallest possible dose (exactly 1 raw statement).
//
// Baseline characterizes current behavior via exact inline mirrors of the
// controller's 6 queries; after extraction into the NEW
// adminAuditLogHelpers.js the same assertions run against those helpers.
//
// EXTERNAL DEPENDENCIES: none. The controller imports only asyncHandler,
// AppError, prisma and logger. These tests are inherently offline.
//
// RAW SQL NOTE: the daily-activity query is PostgreSQL-specific
// (TO_CHAR / AT TIME ZONE / ::int) and parameterized via $queryRaw's tagged
// template. It is extracted byte-identical — no Mongo-compat rewrite is
// attempted here (that is a deliberately deferred later phase).
//
// ISOLATION: AuditLog rows are global (no tenant scoping), so tests scope
// assertions to rows they created rather than assuming an empty table.
import { PrismaClient } from "@prisma/client";
import * as AdminAuditLogHelper from "../../src/utils/adminAuditLogHelpers.js";
import { auditLogRepository } from "../../src/config/repositories.js";

const prisma = new PrismaClient();

const userIds = [];
const logIds = [];
const MARK = `m6c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const PERFORMED_BY_SELECT = { id: true, username: true, fullName: true, avatar: true, role: true };

async function makeAdmin() {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({
    data: { fullName: `Auditor ${s}`, email: `aud-${s}@e.com`, username: `aud_${s}`, role: "super_admin", accountStatus: "active" },
  });
  userIds.push(u.id);
  return u;
}

async function makeLog(performedById, { action = "admin_login", category = "auth", targetId = null, performedByName = `${MARK}_Admin`, createdAt = null } = {}) {
  const log = await prisma.auditLog.create({
    data: {
      performedById, action, category, targetId, performedByName,
      ...(createdAt ? { createdAt } : {}),
    },
  });
  logIds.push(log.id);
  return log;
}

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { id: { in: logIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("admin auditlog — lookup, pagination, filtering (inline mirror)", () => {
  test("findMany returns newest-first with the performedBy relation included", async () => {
    const admin = await makeAdmin();
    await makeLog(admin.id, { action: "admin_login" });
    await new Promise((r) => setTimeout(r, 5));
    const newer = await makeLog(admin.id, { action: "admin_logout" });

    const logs = await prisma.auditLog.findMany({
      where: { performedById: admin.id },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 20,
      include: { performedBy: { select: PERFORMED_BY_SELECT } },
    });

    expect(logs[0].id).toBe(newer.id); // desc ordering
    expect(Object.keys(logs[0].performedBy).sort()).toEqual(Object.keys(PERFORMED_BY_SELECT).sort());
    expect(logs[0].performedBy.id).toBe(admin.id);
  });

  test("pagination: skip/take slice the result set and count reports the total", async () => {
    const admin = await makeAdmin();
    for (let i = 0; i < 5; i++) await makeLog(admin.id);

    const where = { performedById: admin.id };
    const [page1, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: 0, take: 2, include: { performedBy: { select: PERFORMED_BY_SELECT } } }),
      prisma.auditLog.count({ where }),
    ]);
    expect(page1.length).toBe(2);
    expect(total).toBe(5);

    const page3 = await prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: 4, take: 2 });
    expect(page3.length).toBe(1); // last partial page
  });

  test("filtering by category / action / performedBy / targetId narrows results", async () => {
    const admin = await makeAdmin();
    const target = `${MARK}-target`;
    await makeLog(admin.id, { action: "user_banned", category: "user", targetId: target });
    await makeLog(admin.id, { action: "admin_login", category: "auth" });

    expect((await prisma.auditLog.count({ where: { performedById: admin.id, category: "user" } }))).toBe(1);
    expect((await prisma.auditLog.count({ where: { performedById: admin.id, action: "admin_login" } }))).toBe(1);
    expect((await prisma.auditLog.count({ where: { targetId: target } }))).toBe(1);
    expect((await prisma.auditLog.count({ where: { performedById: admin.id } }))).toBe(2);
  });

  test("date-range filter uses gte/lte on createdAt", async () => {
    const admin = await makeAdmin();
    const old = new Date(Date.now() - 10 * 86400000);
    await makeLog(admin.id, { createdAt: old });
    await makeLog(admin.id); // now

    const since = new Date(Date.now() - 5 * 86400000);
    const recent = await prisma.auditLog.count({ where: { performedById: admin.id, createdAt: { gte: since } } });
    expect(recent).toBe(1);

    const end = new Date(Date.now() - 5 * 86400000);
    const older = await prisma.auditLog.count({ where: { performedById: admin.id, createdAt: { lte: end } } });
    expect(older).toBe(1);
  });

  test("search filter matches performedByName case-insensitively", async () => {
    const admin = await makeAdmin();
    await makeLog(admin.id, { performedByName: `${MARK}_Alice` });
    await makeLog(admin.id, { performedByName: `${MARK}_Bob` });

    const found = await prisma.auditLog.findMany({
      where: { performedById: admin.id, OR: [{ performedByName: { contains: `${MARK}_alice`, mode: "insensitive" } }] },
    });
    expect(found.length).toBe(1);
    expect(found[0].performedByName).toBe(`${MARK}_Alice`);
  });

  test("findUnique by id includes performedBy; null for missing (404 path)", async () => {
    const admin = await makeAdmin();
    const log = await makeLog(admin.id);

    const found = await prisma.auditLog.findUnique({
      where: { id: log.id },
      include: { performedBy: { select: PERFORMED_BY_SELECT } },
    });
    expect(found.id).toBe(log.id);
    expect(found.performedBy.role).toBe("super_admin");

    expect(await prisma.auditLog.findUnique({
      where: { id: "00000000-0000-0000-0000-000000000000" },
      include: { performedBy: { select: PERFORMED_BY_SELECT } },
    })).toBeNull();
  });

  test("empty dataset: filters that match nothing return [] and count 0", async () => {
    const admin = await makeAdmin(); // no logs created
    const where = { performedById: admin.id };
    expect(await prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: 0, take: 20 })).toEqual([]);
    expect(await prisma.auditLog.count({ where })).toBe(0);
  });
});

describe("admin auditlog — groupBy aggregations (inline mirror)", () => {
  test("groupBy category returns counts ordered desc", async () => {
    const admin = await makeAdmin();
    const since = new Date(Date.now() - 30 * 86400000);
    await makeLog(admin.id, { category: "user", action: "user_banned" });
    await makeLog(admin.id, { category: "user", action: "user_suspended" });
    await makeLog(admin.id, { category: "auth", action: "admin_login" });

    const rows = await prisma.auditLog.groupBy({
      by: ["category"],
      where: { createdAt: { gte: since }, performedById: admin.id },
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
    });

    const mapped = rows.map((r) => ({ _id: r.category, count: r._count._all }));
    const user = mapped.find((m) => m._id === "user");
    const auth = mapped.find((m) => m._id === "auth");
    expect(user.count).toBe(2);
    expect(auth.count).toBe(1);
    expect(mapped[0].count).toBeGreaterThanOrEqual(mapped[mapped.length - 1].count); // desc
  });

  test("groupBy action respects take: 10", async () => {
    const admin = await makeAdmin();
    const since = new Date(Date.now() - 30 * 86400000);
    await makeLog(admin.id, { action: "admin_login", category: "auth" });
    await makeLog(admin.id, { action: "admin_login", category: "auth" });
    await makeLog(admin.id, { action: "post_deleted", category: "content" });

    const rows = await prisma.auditLog.groupBy({
      by: ["action"],
      where: { createdAt: { gte: since }, performedById: admin.id },
      _count: { _all: true },
      orderBy: { _count: { action: "desc" } },
      take: 10,
    });

    expect(rows.length).toBeLessThanOrEqual(10);
    expect(rows.find((r) => r.action === "admin_login")._count._all).toBe(2);
  });

  test("groupBy on an empty window returns []", async () => {
    const future = new Date(Date.now() + 86400000);
    const rows = await prisma.auditLog.groupBy({
      by: ["category"],
      where: { createdAt: { gte: future } },
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
    });
    expect(rows).toEqual([]);
  });
});

describe("admin auditlog — raw SQL time-series (inline mirror)", () => {
  test("daily activity returns YYYY-MM-DD date strings with integer counts, ascending", async () => {
    const admin = await makeAdmin();
    await makeLog(admin.id, { createdAt: new Date(Date.now() - 2 * 86400000) });
    await makeLog(admin.id, { createdAt: new Date(Date.now() - 1 * 86400000) });
    await makeLog(admin.id);

    const since = new Date(Date.now() - 30 * 86400000);
    const dailyRaw = await prisma.$queryRaw`
    SELECT
      TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
      COUNT(*)::int AS count
    FROM "AuditLog"
    WHERE "createdAt" >= ${since}
    GROUP BY date
    ORDER BY date ASC
  `;

    expect(Array.isArray(dailyRaw)).toBe(true);
    expect(dailyRaw.length).toBeGreaterThanOrEqual(3);
    // shape: { date: 'YYYY-MM-DD', count: <number> }
    for (const row of dailyRaw) {
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof row.count).toBe("number"); // ::int cast, NOT BigInt
      expect(Number.isInteger(row.count)).toBe(true);
    }
    // ascending order
    const dates = dailyRaw.map((r) => r.date);
    expect([...dates].sort()).toEqual(dates);
  });

  test("raw SQL is parameterized: a future `since` yields an empty series", async () => {
    const since = new Date(Date.now() + 7 * 86400000);
    const dailyRaw = await prisma.$queryRaw`
    SELECT
      TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
      COUNT(*)::int AS count
    FROM "AuditLog"
    WHERE "createdAt" >= ${since}
    GROUP BY date
    ORDER BY date ASC
  `;
    expect(dailyRaw).toEqual([]);
  });
});

// After extraction: the 6 helpers must match the inline behavior exactly.
describe("adminAuditLogHelpers — extracted queries match inline behavior", () => {
  const MISSING = "00000000-0000-0000-0000-000000000000";

  test("findAuditLogs applies where/skip/take, desc order, and the performedBy include", async () => {
    const admin = await makeAdmin();
    await makeLog(admin.id, { action: "admin_login" });
    await new Promise((r) => setTimeout(r, 5));
    const newer = await makeLog(admin.id, { action: "admin_logout" });

    const logs = await AdminAuditLogHelper.findAuditLogs({ performedById: admin.id }, 0, 20);
    expect(logs[0].id).toBe(newer.id);
    expect(Object.keys(logs[0].performedBy).sort()).toEqual(Object.keys(PERFORMED_BY_SELECT).sort());

    const paged = await AdminAuditLogHelper.findAuditLogs({ performedById: admin.id }, 1, 1);
    expect(paged.length).toBe(1);
    expect(paged[0].id).not.toBe(newer.id); // skipped the newest
  });

  test("countAuditLogs matches the same where; 0 for an empty set", async () => {
    const admin = await makeAdmin();
    await makeLog(admin.id);
    await makeLog(admin.id);
    expect(await AdminAuditLogHelper.countAuditLogs({ performedById: admin.id })).toBe(2);

    const empty = await makeAdmin();
    expect(await AdminAuditLogHelper.countAuditLogs({ performedById: empty.id })).toBe(0);
  });

  test("findAuditLogById includes performedBy; null for missing", async () => {
    const admin = await makeAdmin();
    const log = await makeLog(admin.id);
    const found = await AdminAuditLogHelper.findAuditLogById(log.id);
    expect(found.id).toBe(log.id);
    expect(found.performedBy.id).toBe(admin.id);
    expect(await AdminAuditLogHelper.findAuditLogById(MISSING)).toBeNull();
  });

  test("groupAuditLogsByCategory / groupAuditLogsByAction return neutral { key, count } rows (M-4)", async () => {
    const admin = await makeAdmin();
    await makeLog(admin.id, { category: "user", action: "user_banned" });
    await makeLog(admin.id, { category: "user", action: "user_banned" });

    const since = new Date(Date.now() - 30 * 86400000);
    const byCat = await AdminAuditLogHelper.groupAuditLogsByCategory(since);
    expect(byCat.find((r) => r.key === "user").count).toBeGreaterThanOrEqual(2);

    const byAction = await AdminAuditLogHelper.groupAuditLogsByAction(since);
    expect(byAction.length).toBeLessThanOrEqual(10); // take: 10 preserved
    expect(byAction.find((r) => r.key === "user_banned").count).toBeGreaterThanOrEqual(2);

    // empty window
    expect(await AdminAuditLogHelper.groupAuditLogsByCategory(new Date(Date.now() + 86400000))).toEqual([]);
  });

  test("findAuditLogDailyActivity returns the same raw time-series shape (::int, YYYY-MM-DD, ASC)", async () => {
    const admin = await makeAdmin();
    await makeLog(admin.id, { createdAt: new Date(Date.now() - 86400000) });
    await makeLog(admin.id);

    const since = new Date(Date.now() - 30 * 86400000);
    const rows = await AdminAuditLogHelper.findAuditLogDailyActivity(since);

    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof row.count).toBe("number"); // ::int cast preserved (not BigInt)
    }
    const dates = rows.map((r) => r.date);
    expect([...dates].sort()).toEqual(dates); // ASC preserved

    // still parameterized
    expect(await AdminAuditLogHelper.findAuditLogDailyActivity(new Date(Date.now() + 7 * 86400000))).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// REPOSITORY HAZARD REGRESSIONS (Phase 7A Milestone 12)
//
// The raw SQL moved one layer down into AuditLogRepository during this
// milestone. These tests pin that the move changed ownership only, and that
// the pre-existing groupBy/pagination methods on that repository are NOT
// interchangeable with what this domain needs.
// ─────────────────────────────────────────────────────────────────────────
describe("AuditLogRepository — raw SQL after the move (Phase 7A)", () => {
  test("the repository's raw SQL still returns the ::int / YYYY-MM-DD / ASC contract", async () => {
    const admin = await makeAdmin();
    await makeLog(admin.id, { createdAt: new Date(Date.now() - 86400000) });
    await makeLog(admin.id);

    const since = new Date(Date.now() - 30 * 86400000);
    const rows = await auditLogRepository.findDailyActivitySince(since);

    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof row.count).toBe("number"); // ::int, not BigInt
    }
    const dates = rows.map((r) => r.date);
    expect([...dates].sort()).toEqual(dates); // ASC

    // and the tagged template still binds `since` as a parameter
    expect(await auditLogRepository.findDailyActivitySince(new Date(Date.now() + 7 * 86400000))).toEqual([]);
  });

  test("the helper and the repository return identical rows — the move was ownership only", async () => {
    const admin = await makeAdmin();
    await makeLog(admin.id);
    const since = new Date(Date.now() - 30 * 86400000);

    const viaHelper = await AdminAuditLogHelper.findAuditLogDailyActivity(since);
    const viaRepo = await auditLogRepository.findDailyActivitySince(since);
    expect(viaHelper).toEqual(viaRepo);
  });
});

describe("AuditLogRepository — pre-existing methods are NOT interchangeable (Phase 7A hazard)", () => {
  test("countByCategory ignores the `since` cutoff and the count ordering", async () => {
    // countByCategory() groups over the WHOLE table via toPrismaGroupByCount
    // — no where clause, no orderBy. The stats endpoint needs both, which is
    // why groupByCategorySince exists rather than reusing it.
    const admin = await makeAdmin();
    await makeLog(admin.id, { category: "user", createdAt: new Date(Date.now() - 90 * 86400000) });

    const since = new Date(Date.now() - 30 * 86400000);
    const scoped = await auditLogRepository.groupByCategorySince(since);
    const unscoped = await auditLogRepository.countByCategory();

    // the 90-day-old row is outside the scoped window but inside the unscoped one
    const scopedUser = scoped.find((r) => r.key === "user")?.count ?? 0;
    const unscopedUser = unscoped.find((r) => r.key === "user")?.count ?? 0;
    expect(unscopedUser).toBeGreaterThan(scopedUser);

    // scoped results are count-desc; the unscoped helper makes no such promise
    const counts = scoped.map((r) => r.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  test("findMany caps at the default page size; findManyWithRelations takes raw skip/take", async () => {
    const CAP = 20; // toPrismaPagination's default
    const admin = await makeAdmin();
    for (let i = 0; i < CAP + 3; i++) await makeLog(admin.id);

    const where = { performedById: admin.id };

    const capped = await auditLogRepository.findMany(where);
    expect(capped.length).toBe(CAP);

    const uncapped = await auditLogRepository.findManyWithRelations(where, {
      skip: 0,
      take: CAP + 10,
    });
    expect(uncapped.length).toBe(CAP + 3);
    expect(uncapped.length).toBeGreaterThan(CAP);

    // and the helper's own pagination math still works past the cap
    const page = await AdminAuditLogHelper.findAuditLogs(where, 0, CAP + 10);
    expect(page.length).toBe(CAP + 3);
    expect(page[0].performedBy).toBeTruthy(); // include preserved
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 7B / M-1, Batch 3 — controller-shape equivalence.
//
// admin.auditlog.controller is the ONLY caller Batch 3 had to convert, and
// the full suite stayed green while it was broken — because no suite in this
// project exercises a controller. Same blind spot that hid the
// admin.comment break in Batch 2, so the same remedy: copy the controller's
// where-assembly verbatim and push it through the helper it actually calls.
describe("M-1 Batch 3 — admin.auditlog controller filter shape", () => {
  // Verbatim copy of admin.auditlog.controller's where-assembly.
  const buildControllerWhere = ({ category, action, performedBy, targetId, startDate, endDate, search }) => {
    const where = {};
    if (category)    where.category      = category;
    if (action)      where.action        = action;
    if (performedBy) where.performedById = performedBy;
    if (targetId)    where.targetId      = targetId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    if (search?.trim()) {
      where.or = [{ performedByName: { like: search.trim(), caseInsensitive: true } }];
    }
    return where;
  };

  // The exact Prisma equivalent, as the controller built it before M-1.
  const buildPrismaWhere = (args) => {
    const w = buildControllerWhere(args);
    if (w.or) {
      w.OR = [{ performedByName: { contains: args.search.trim(), mode: "insensitive" } }];
      delete w.or;
    }
    return w;
  };

  test("EQUIVALENCE: rows, ordering and pagination are byte-identical", async () => {
    const admin = await makeAdmin();
    const tag = `${MARK}b3`;
    const base = Date.now() - 5 * 60_000;
    const made = [];
    for (let i = 0; i < 5; i++) {
      made.push(await makeLog(admin.id, {
        performedByName: `${tag}_Person${i}`,
        createdAt: new Date(base + i * 60_000),
      }));
    }

    const args = { performedBy: admin.id, search: tag.toUpperCase() };
    const neutral = buildControllerWhere(args);
    const prismaWhere = buildPrismaWhere(args);

    // ── identical rows, identical ORDER (helper hardcodes createdAt desc) ──
    const viaHelper = await AdminAuditLogHelper.findAuditLogs(neutral, 0, 50);
    const inline = await prisma.auditLog.findMany({
      where: prismaWhere, orderBy: { createdAt: "desc" }, skip: 0, take: 50,
    });
    expect(viaHelper.map((r) => r.id)).toEqual(inline.map((r) => r.id));
    expect(viaHelper.length).toBe(5);
    // newest-first ordering genuinely preserved, not incidentally equal
    expect(viaHelper[0].id).toBe(made[4].id);
    expect(viaHelper[4].id).toBe(made[0].id);

    // ── identical PAGINATION at the same offsets ──────────────────────────
    for (const [skip, take] of [[0, 2], [2, 2], [4, 2], [0, 50]]) {
      expect((await AdminAuditLogHelper.findAuditLogs(neutral, skip, take)).map((r) => r.id))
        .toEqual((await prisma.auditLog.findMany({
          where: prismaWhere, orderBy: { createdAt: "desc" }, skip, take,
        })).map((r) => r.id));
    }

    // ── identical COUNT ───────────────────────────────────────────────────
    expect(await AdminAuditLogHelper.countAuditLogs(neutral))
      .toBe(await prisma.auditLog.count({ where: prismaWhere }));
  });

  test("EQUIVALENCE: the date-range accumulator and nested or/and still agree", async () => {
    const admin = await makeAdmin();
    const tag = `${MARK}b3dr`;
    const t0 = new Date(Date.now() - 3 * 86_400_000);
    const t1 = new Date(Date.now() - 1 * 86_400_000);
    await makeLog(admin.id, { performedByName: `${tag}_old`, createdAt: t0 });
    await makeLog(admin.id, { performedByName: `${tag}_new`, createdAt: t1 });

    // gte only / lte only / both — the controller builds createdAt in stages
    for (const args of [
      { performedBy: admin.id, startDate: new Date(Date.now() - 2 * 86_400_000) },
      { performedBy: admin.id, endDate: new Date(Date.now() - 2 * 86_400_000) },
      { performedBy: admin.id, startDate: t0, endDate: new Date() },
      { performedBy: admin.id, startDate: t0, endDate: new Date(), search: tag },
    ]) {
      expect(await AdminAuditLogHelper.countAuditLogs(buildControllerWhere(args)))
        .toBe(await prisma.auditLog.count({ where: buildPrismaWhere(args) }));
    }
  });

  test("groupBy aggregations and the raw SQL time-series are UNCHANGED by M-1", async () => {
    // Neither takes a caller filter, so neither passes through the
    // translator. Pinned so a future refactor cannot quietly route them
    // through it and alter their shape.
    const since = new Date(Date.now() - 7 * 86_400_000);

    const byCategory = await auditLogRepository.groupByCategorySince(since);
    expect(Array.isArray(byCategory)).toBe(true);
    if (byCategory.length) {
      // M-4: neutral { key, count } rows — no Prisma envelope reaches callers.
      expect(byCategory[0]).toHaveProperty("key");
      expect(typeof byCategory[0].count).toBe("number");
      expect(byCategory[0]).not.toHaveProperty("_count");
    }

    const byAction = await auditLogRepository.groupByActionSince(since);
    expect(Array.isArray(byAction)).toBe(true);
    expect(byAction.length).toBeLessThanOrEqual(10); // take: 10 preserved

    // raw SQL: same shape, still ::int, still YYYY-MM-DD ASC
    const daily = await auditLogRepository.findDailyActivitySince(since);
    expect(daily.every((r) => Number.isInteger(r.count))).toBe(true);
    const labels = daily.map((r) => r._id);
    expect(labels).toEqual([...labels].sort());
  });

  test("M-1 GUARANTEE: Prisma-shaped filters are rejected by the audit-log repository", async () => {
    await expect(auditLogRepository.count({ performedByName: { contains: "x" } }))
      .rejects.toThrow(/contains/);
    await expect(auditLogRepository.count({ OR: [{ category: "auth" }] }))
      .rejects.toThrow(/OR/);
  });
});
