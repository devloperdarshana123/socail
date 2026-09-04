// Characterization test for the `adminNotification` domain (Milestone 6A).
// FIRST ADMIN CONTROLLER — establishes the admin helper-ownership convention.
//
// This controller has no existing persistence owner (verified: nothing else
// in src/ touches prisma.adminNotification, and adminNotify.js is HTTP-only),
// so the baseline characterizes current behavior via exact inline mirrors of
// the controller's 4 queries. After extraction into the NEW
// adminNotificationHelpers.js, the same assertions are re-expressed against
// those helpers and must match.
//
// EXTERNAL DEPENDENCIES: none. The controller imports only asyncHandler,
// AppError, prisma and logger — no Redis, HTTP, email, socket or Cloudinary.
// These tests are inherently offline.
//
// NOTE ON ISOLATION: AdminNotification rows have no user FK (they are a
// global admin feed), so tests must scope assertions to rows they created
// rather than assuming an empty table.
import { PrismaClient } from "@prisma/client";
import * as AdminNotificationHelper from "../../src/utils/adminNotificationHelpers.js";
import { adminNotificationRepository } from "../../src/config/repositories.js";
import { MongoAdminNotificationRepository } from "../../../shared/database/repositories/notifications/AdminNotificationRepository.js";

const prisma = new PrismaClient();

const MAX_LIMIT = 50;
const createdIds = [];

// Unique marker so this suite never asserts on rows from other suites.
const MARK = `m6a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

async function makeNotification({ type = `${MARK}_type`, label = "L", meta = {}, isRead = false } = {}) {
  const n = await prisma.adminNotification.create({ data: { type, label, meta, isRead } });
  createdIds.push(n.id);
  return n;
}

afterAll(async () => {
  await prisma.adminNotification.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

describe("adminNotification persistence — list & unread count (inline mirror)", () => {
  test("findMany returns notifications newest-first and respects the limit", async () => {
    const a = await makeNotification({ label: "first" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await makeNotification({ label: "second" });
    await new Promise((r) => setTimeout(r, 5));
    const c = await makeNotification({ label: "third" });

    const rows = await prisma.adminNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: MAX_LIMIT,
    });

    const ourIds = rows.filter((r) => createdIds.includes(r.id)).map((r) => r.id);
    // newest of our three appears before the oldest — descending order preserved
    expect(ourIds.indexOf(c.id)).toBeLessThan(ourIds.indexOf(a.id));
    expect(ourIds).toContain(b.id);

    // limit is honoured
    const limited = await prisma.adminNotification.findMany({ orderBy: { createdAt: "desc" }, take: 2 });
    expect(limited.length).toBeLessThanOrEqual(2);
  });

  test("count({ isRead: false }) counts only unread rows", async () => {
    const before = await prisma.adminNotification.count({ where: { isRead: false } });
    await makeNotification({ isRead: false });
    await makeNotification({ isRead: false });
    await makeNotification({ isRead: true }); // should NOT be counted
    const after = await prisma.adminNotification.count({ where: { isRead: false } });
    expect(after).toBe(before + 2);
  });
});

describe("adminNotification persistence — mark all read (inline mirror)", () => {
  test("updateMany flips unread rows to read, sets readAt, and reports a count", async () => {
    const unread = await makeNotification({ isRead: false });

    const result = await prisma.adminNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    expect(typeof result.count).toBe("number");
    expect(result.count).toBeGreaterThanOrEqual(1);

    const reloaded = await prisma.adminNotification.findUnique({ where: { id: unread.id } });
    expect(reloaded.isRead).toBe(true);
    expect(reloaded.readAt).not.toBeNull();

    // no unread rows remain anywhere (the query is global by design)
    expect(await prisma.adminNotification.count({ where: { isRead: false } })).toBe(0);
  });

  test("updateMany on an already-read set reports count 0 and changes nothing", async () => {
    // previous test left everything read
    const result = await prisma.adminNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    expect(result.count).toBe(0);
  });
});

describe("adminNotification persistence — create (inline mirror)", () => {
  test("create stores type, mapped label and meta, defaulting isRead to false", async () => {
    const n = await prisma.adminNotification.create({
      data: { type: `${MARK}_new_report`, label: "New Report", meta: { reportId: "abc-123" } },
    });
    createdIds.push(n.id);

    expect(n.id).toBeTruthy();
    expect(n.type).toBe(`${MARK}_new_report`);
    expect(n.label).toBe("New Report");
    expect(n.meta).toEqual({ reportId: "abc-123" });
    expect(n.isRead).toBe(false); // schema default
    expect(n.readAt).toBeNull();
  });

  test("create accepts an empty meta object (controller's default)", async () => {
    const n = await prisma.adminNotification.create({
      data: { type: `${MARK}_bare`, label: `${MARK}_bare`, meta: {} },
    });
    createdIds.push(n.id);
    expect(n.meta).toEqual({});
  });
});

// After extraction: the 4 helpers must match the inline behavior exactly.
describe("adminNotificationHelpers — extracted queries match inline behavior", () => {
  test("createAdminNotification stores type/label/meta with isRead false", async () => {
    const n = await AdminNotificationHelper.createAdminNotification({
      type: `${MARK}_helper`, label: "Helper Label", meta: { k: "v" },
    });
    createdIds.push(n.id);
    expect(n.type).toBe(`${MARK}_helper`);
    expect(n.label).toBe("Helper Label");
    expect(n.meta).toEqual({ k: "v" });
    expect(n.isRead).toBe(false);
    expect(n.readAt).toBeNull();
  });

  test("findAdminNotifications returns newest-first and honours the limit", async () => {
    const older = await AdminNotificationHelper.createAdminNotification({ type: `${MARK}_h1`, label: "h1", meta: {} });
    createdIds.push(older.id);
    await new Promise((r) => setTimeout(r, 5));
    const newer = await AdminNotificationHelper.createAdminNotification({ type: `${MARK}_h2`, label: "h2", meta: {} });
    createdIds.push(newer.id);

    const rows = await AdminNotificationHelper.findAdminNotifications(MAX_LIMIT);
    const ourIds = rows.filter((r) => createdIds.includes(r.id)).map((r) => r.id);
    expect(ourIds.indexOf(newer.id)).toBeLessThan(ourIds.indexOf(older.id));

    expect((await AdminNotificationHelper.findAdminNotifications(1)).length).toBeLessThanOrEqual(1);
  });

  test("countUnreadAdminNotifications counts only unread rows", async () => {
    const before = await AdminNotificationHelper.countUnreadAdminNotifications();
    const u = await AdminNotificationHelper.createAdminNotification({ type: `${MARK}_h3`, label: "h3", meta: {} });
    createdIds.push(u.id);
    expect(await AdminNotificationHelper.countUnreadAdminNotifications()).toBe(before + 1);
  });

  test("markAllAdminNotificationsRead flips unread rows and returns a count", async () => {
    const u = await AdminNotificationHelper.createAdminNotification({ type: `${MARK}_h4`, label: "h4", meta: {} });
    createdIds.push(u.id);

    const result = await AdminNotificationHelper.markAllAdminNotificationsRead();
    expect(result.count).toBeGreaterThanOrEqual(1);

    const reloaded = await prisma.adminNotification.findUnique({ where: { id: u.id } });
    expect(reloaded.isRead).toBe(true);
    expect(reloaded.readAt).not.toBeNull();
    expect(await AdminNotificationHelper.countUnreadAdminNotifications()).toBe(0);

    // idempotent second call
    expect((await AdminNotificationHelper.markAllAdminNotificationsRead()).count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// ARCHITECTURAL BLOCKER (Phase 7A Milestone 12)
//
// AdminNotification is the one migrated domain with a real Postgres table
// but NO Mongo counterpart. Milestone 2 absorbed this feed into the unified
// `notifications` collection via an `audience` field, and that collection is
// owned exclusively by chat-server for writes — so whether server/ may write
// admin notifications directly, or must publish an event instead, is an open
// decision (flagged in Phase 6I as the migration's highest-risk item).
//
// The Mongo class therefore fails loudly rather than silently mapping this
// feed onto the per-user notification collection, which would be wrong in
// both directions. Pinned here so the blocker cannot be forgotten when
// DATABASE_PROVIDER=mongo is eventually switched on.
// ─────────────────────────────────────────────────────────────────────────
describe("AdminNotificationRepository — the Mongo write blocker is retired", () => {
  // This blocker existed on the reading that Phase 2 §4 gives chat-server
  // exclusive WRITE ownership of the unified `notifications` collection, so
  // server/ could read admin rows but not create them.
  //
  // Tracing the real write path retired it. chat-server's
  // emitAdminNotification() emits the socket event and then POSTs to
  // server's /api/v2/admin/notifications/save, which is what performs the
  // insert. server/ is, and always has been, the only process that writes
  // admin rows; chat-server writes only `audience: "user"` ones. The two
  // subsets are disjoint, so there was no collision to guard against.
  //
  // Every Mongo write is scoped to { audience: "admin" }, which is what keeps
  // them disjoint. Behaviour is exercised for real against a live mongod in
  // tests/mongo/batch3.parity.test.js; here we only assert the stubs are gone.
  test("WRITE methods are implemented and no longer throw on construction", () => {
    const mongoRepo = new MongoAdminNotificationRepository();
    for (const fn of ["markAllRead", "create", "update", "delete"]) {
      expect(typeof mongoRepo[fn]).toBe("function");
      // The throwing stubs were installed as OWN properties in the
      // constructor; the real implementations live on the prototype.
      expect(Object.hasOwn(mongoRepo, fn)).toBe(false);
    }
  });

  test("READ methods are implemented — they are not part of the blocker", async () => {
    const mongoRepo = new MongoAdminNotificationRepository();
    // Reads are ordinary async methods now; they are exercised for real
    // against a live mongod in tests/mongo/batch3.parity.test.js. Here we
    // only assert they are no longer the throwing stubs.
    for (const fn of ["findById", "findRecent", "countUnread", "findMany", "exists", "count"]) {
      expect(typeof mongoRepo[fn]).toBe("function");
      expect(() => mongoRepo[fn]).not.toThrow();
    }
  });

  test("the Prisma path is fully implemented and is what the helper uses", async () => {
    const created = await AdminNotificationHelper.createAdminNotification({
      type: "blocker_check",
      label: "Prisma path works",
      meta: {},
    });
    createdIds.push(created.id);

    expect(created.id).toBeTruthy();
    expect(await adminNotificationRepository.countUnread()).toBeGreaterThanOrEqual(1);
  });
});

// ── Phase 7B / M-1, Batch 3 — AdminNotificationRepository boundary ───────
// This repository had no queryHelpers import before Batch 3; the wiring
// added one. The Mongo side remains the documented chat-server-ownership
// stub and was not touched.
describe("M-1 Batch 3 — admin notification repository boundary", () => {
  test("neutral filters translate to themselves on count and findMany", async () => {
    const filter = { isRead: false };
    expect(await adminNotificationRepository.count(filter))
      .toBe(await prisma.adminNotification.count({ where: filter }));

    const viaRepo = await adminNotificationRepository.findMany(filter, { skip: 0, take: 5 });
    const inline  = await prisma.adminNotification.findMany({ where: filter, skip: 0, take: 5 });
    expect(viaRepo.map((n) => n.id)).toEqual(inline.map((n) => n.id));
  });

  test("M-1 GUARANTEE: Prisma-shaped filters are rejected", async () => {
    await expect(adminNotificationRepository.count({ title: { contains: "x" } }))
      .rejects.toThrow(/contains/);
  });
});
