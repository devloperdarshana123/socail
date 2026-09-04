// Phase 7E / M-5 + M-6 + M-10 — batch 3: the aggregation-heavy repositories.
//
// This is where M-6 lands: five of the seven Postgres raw-SQL statements are
// replaced here by native aggregation pipelines, and the assertions pin the
// properties the raw SQL guaranteed — date bucketing, ASC ordering, integer
// counts, and the exact field names the controllers forward to the API.
import { mongoose, models } from "../../../shared/database/mongodb/index.js";
import { startMongo, stopMongo, clearMongo, syncIndexes, seed } from "./harness.js";
import { MongoSocialPostRepository } from "../../../shared/database/repositories/social/SocialPostRepository.js";
import { MongoUserRepository } from "../../../shared/database/repositories/users/UserRepository.js";
import { MongoReportRepository } from "../../../shared/database/repositories/moderation/ReportRepository.js";
import { MongoAuditLogRepository } from "../../../shared/database/repositories/audit/AuditLogRepository.js";
import { MongoAdminNotificationRepository } from "../../../shared/database/repositories/notifications/AdminNotificationRepository.js";

const posts = new MongoSocialPostRepository();
const users = new MongoUserRepository();
const reports = new MongoReportRepository();
const auditLogs = new MongoAuditLogRepository();
const adminNotifs = new MongoAdminNotificationRepository();

beforeAll(async () => { await startMongo(); await syncIndexes(); }, 120_000);
afterAll(async () => { await stopMongo(); });
afterEach(async () => { await clearMongo(); });

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);

describe("SocialPostRepository (Mongo)", () => {
  test("cursor reads: createdAt-desc and the id-cursor equivalent", async () => {
    const a = await seed.user();
    const made = [];
    for (let i = 0; i < 5; i++) {
      made.push(await seed.post(a._id, { caption: `p${i}` }));
      await new Promise((r) => setTimeout(r, 5));
    }
    const byDate = await posts.findManyWithCursor({ authorId: a._id }, { take: 3 });
    expect(byDate).toHaveLength(3);
    expect(byDate[0].caption).toBe("p4");

    // Prisma's NATIVE cursor becomes `_id < cursor` over the same id-desc
    // ordering. The page after a cursor must not repeat it.
    const page1 = await posts.findManyWithIdCursor({ authorId: a._id }, { take: 2 });
    const page2 = await posts.findManyWithIdCursor({ authorId: a._id }, { take: 2, cursor: page1[1]._id });
    expect(page2.map((p) => String(p._id))).not.toContain(String(page1[1]._id));
  });

  test("findManyOrdered honours multi-field ordering and a raw page window", async () => {
    const a = await seed.user();
    await seed.post(a._id, { caption: "lo", viewsCount: 1, likesCount: 9 });
    await seed.post(a._id, { caption: "hi", viewsCount: 9, likesCount: 1 });
    const rows = await posts.findManyOrdered({ authorId: a._id }, {
      orderBy: [{ viewsCount: "desc" }, { likesCount: "desc" }], skip: 0, take: 10,
    });
    expect(rows[0].caption).toBe("hi");
  });

  test("findFirstWhere populates the author (M-10) and returns null on a miss", async () => {
    const a = await seed.user();
    const p = await seed.post(a._id);
    const hit = await posts.findFirstWhere({ _id: p._id, isDeleted: false }, {
      include: { author: { select: { username: true } } },
    });
    expect(hit.author.username).toBe(a.username);
    expect(await posts.findFirstWhere({ caption: "nothing-matches" })).toBeNull();
  });

  test("sumFields returns the NEUTRAL bare-sums object; null on an empty match", async () => {
    const a = await seed.user();
    await seed.post(a._id, { likesCount: 3, viewsCount: 10 });
    await seed.post(a._id, { likesCount: 5, viewsCount: 8 });
    expect(await posts.sumFields({ authorId: a._id }, { likesCount: true, viewsCount: true }))
      .toEqual({ likesCount: 8, viewsCount: 18 });
    // null PRESERVED for a no-match — the controller keeps its `?? 0`.
    const empty = await posts.sumFields({ authorId: new mongoose.Types.ObjectId() }, { likesCount: true });
    expect(empty.likesCount).toBeNull();
  });

  test("updateManyWhere applies neutral counter mutations and returns { count }", async () => {
    const a = await seed.user();
    await seed.post(a._id); await seed.post(a._id);
    expect(await posts.updateManyWhere({ authorId: a._id }, { viewsCount: { inc: 2 } }))
      .toEqual({ count: 2 });
    const rows = await models.SocialPost.find({ authorId: a._id });
    expect(rows.every((r) => r.viewsCount === 2)).toBe(true);
  });

  test("M-6: post-type time series buckets by day, ASC, integer counts", async () => {
    const a = await seed.user();
    await seed.post(a._id, { type: "media", createdAt: daysAgo(2) });
    await seed.post(a._id, { type: "media", createdAt: daysAgo(2) });
    await seed.post(a._id, { type: "text", createdAt: daysAgo(1) });

    const rows = await posts.findPostsByTypeTimeSeriesRaw("YYYY-MM-DD", daysAgo(5));
    expect(rows.length).toBeGreaterThanOrEqual(2);
    // Same label/type/count field names the raw SQL produced
    expect(rows[0]).toHaveProperty("label");
    expect(rows[0]).toHaveProperty("type");
    expect(Number.isInteger(rows[0].count)).toBe(true);
    // YYYY-MM-DD buckets, ascending
    expect(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.label))).toBe(true);
    const labels = rows.map((r) => r.label);
    expect(labels).toEqual([...labels].sort());

    // The month format is MAPPED from the closed set, not interpolated.
    const monthly = await posts.findPostsByTypeTimeSeriesRaw("YYYY-MM", daysAgo(5));
    expect(monthly.every((r) => /^\d{4}-\d{2}$/.test(r.label))).toBe(true);
  });

  test("M-6: engagement time series sums likes/comments/views per day", async () => {
    const a = await seed.user();
    await seed.post(a._id, { likesCount: 2, commentsCount: 1, viewsCount: 5, createdAt: daysAgo(1) });
    await seed.post(a._id, { likesCount: 3, commentsCount: 2, viewsCount: 6, createdAt: daysAgo(1) });
    const rows = await posts.findEngagementTimeSeriesRaw(daysAgo(5));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ likes: 5, comments: 3, views: 11 });
    expect(/^\d{4}-\d{2}-\d{2}$/.test(rows[0].label)).toBe(true);
  });
});

describe("UserRepository (Mongo)", () => {
  test("findUsersWithLocation selects only located users, ANDing caller conditions", async () => {
    // This used to throw: Milestone 2 had moved `location` out of users into
    // locations/companies, neither of which anything read, so there was no
    // field to test. `location` is back on the user document (where Postgres
    // has always kept it) and the predicate is a plain one again.
    const hit = await seed.user({ accountStatus: "pending", location: { city: "Kishangarh" } });
    await seed.user({ accountStatus: "pending" });                    // no location
    await seed.user({ accountStatus: "active", location: { city: "Jaipur" } }); // wrong status

    const rows = await users.findUsersWithLocation([{ accountStatus: "pending" }]);
    expect(rows).toHaveLength(1);
    expect(String(rows[0]._id)).toBe(String(hit._id));
  });

  test("searchActiveUsers ESCAPES the term and excludes admins", async () => {
    await seed.user({ username: "marble_co", accountStatus: "active" });
    await seed.user({ username: "admin_marble", accountStatus: "active", role: "super_admin" });
    expect(await users.searchActiveUsers("marble")).toHaveLength(1);
    // A regex metacharacter must be a literal, not a pattern — and must not throw.
    await expect(users.searchActiveUsers("mar(ble")).resolves.toEqual([]);
  });

  test("id/role/firebase lookups and the ordered read", async () => {
    const a = await seed.user({ firebaseUid: "fb-1", role: "moderator" });
    const b = await seed.user();
    expect(await users.findByFirebaseUid("fb-1")).not.toBeNull();
    expect(await users.findByFirebaseUidOrEmail("nope", a.email)).not.toBeNull();
    expect(await users.findAllByIds([a._id, b._id])).toHaveLength(2);
    expect(await users.findAllByRole("moderator")).toHaveLength(1);
    const ordered = await users.findManyOrdered({}, { orderBy: { createdAt: "desc" }, take: 1 });
    expect(ordered).toHaveLength(1);
  });

  test("M-6: new-user and hourly-active series replace their raw SQL", async () => {
    await seed.user({ createdAt: daysAgo(2) });
    await seed.user({ createdAt: daysAgo(2) });
    await seed.user({ createdAt: daysAgo(1) });

    const daily = await users.findNewUsersTimeSeriesRaw("YYYY-MM-DD", daysAgo(5));
    expect(daily.length).toBeGreaterThanOrEqual(2);
    expect(daily[0]).toHaveProperty("newUsers"); // same field name as the SQL alias
    expect(Number.isInteger(daily[0].newUsers)).toBe(true);
    const labels = daily.map((r) => r.label);
    expect(labels).toEqual([...labels].sort()); // ASC

    await seed.user({ lastActiveAt: new Date() });
    const hourly = await users.findHourlyActiveUsersRaw(daysAgo(1));
    expect(hourly[0]).toHaveProperty("hour");
    expect(Number.isInteger(hourly[0].hour)).toBe(true);
    expect(hourly[0].hour).toBeGreaterThanOrEqual(0);
    expect(hourly[0].hour).toBeLessThanOrEqual(23);
  });
});

describe("ReportRepository (Mongo) — six aggregations + M-6 trend", () => {
  const mkReport = async (over = {}) => {
    const u = await seed.user();
    return models.Report.create({
      reportedById: u._id, targetType: "post", targetId: new mongoose.Types.ObjectId(),
      reason: "spam", status: "pending", priority: "low", ...over,
    });
  };

  test("the six groupBys all return the NEUTRAL { key, count } envelope", async () => {
    await mkReport({ status: "pending", priority: "high" });
    await mkReport({ status: "pending", priority: "low" });
    await mkReport({ status: "resolved_dismissed", priority: "low" });

    for (const rows of [
      await reports.groupByStatus(),
      await reports.groupByTopReasons(),
      await reports.groupByTargetModel(),
      await reports.groupByPriorityOpenOrdered(),
      await reports.groupByPriorityOpen(),
    ]) {
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0]).toHaveProperty("key");
      expect(typeof rows[0].count).toBe("number");
      expect(rows[0]).not.toHaveProperty("_count"); // no Prisma envelope
    }

    const byStatus = Object.fromEntries((await reports.groupByStatus()).map((r) => [r.key, r.count]));
    expect(byStatus).toEqual({ pending: 2, resolved_dismissed: 1 });

    // Open-priority variants: same buckets, only one ordered count-desc.
    const ordered = await reports.groupByPriorityOpenOrdered();
    const counts = ordered.map((r) => r.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    const norm = (rs) => rs.map((r) => `${r.key}:${r.count}`).sort();
    expect(norm(await reports.groupByPriorityOpen())).toEqual(norm(ordered));
  });

  test("groupByStatusForReporter scopes to one reporter", async () => {
    const r1 = await seed.user();
    const r2 = await seed.user();
    const base = () => ({ targetType: "post", targetId: new mongoose.Types.ObjectId(), reason: "spam" });
    await models.Report.create({ ...base(), reportedById: r1._id, status: "pending" });
    await models.Report.create({ ...base(), reportedById: r1._id, status: "pending" });
    await models.Report.create({ ...base(), reportedById: r2._id, status: "pending" });
    const rows = await reports.groupByStatusForReporter(r1._id);
    expect(rows.reduce((n, r) => n + r.count, 0)).toBe(2);
  });

  test("M-6: daily trend keeps the _id/count names and ASC ordering", async () => {
    await mkReport({ createdAt: daysAgo(2) });
    await mkReport({ createdAt: daysAgo(1) });
    const rows = await reports.findDailyTrendRaw(daysAgo(5));
    // The controller forwards these rows verbatim, so the shape is contract.
    expect(rows[0]).toHaveProperty("_id");
    expect(Number.isInteger(rows[0].count)).toBe(true);
    expect(/^\d{4}-\d{2}-\d{2}$/.test(rows[0]._id)).toBe(true);
    const ids = rows.map((r) => r._id);
    expect(ids).toEqual([...ids].sort());
  });

  test("reads/writes: relations, ordering, paging, { count }", async () => {
    const r = await mkReport({ status: "pending" });
    expect(await reports.findFirstWhere({ status: "pending" })).not.toBeNull();
    expect(await reports.findManyWhere({ status: "pending" }, { select: { status: true } })).toHaveLength(1);
    const ordered = await reports.findManyOrdered({}, {
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }], skip: 0, take: 10,
      include: { reportedBy: true },
    });
    expect(ordered).toHaveLength(1);
    expect(ordered[0].reportedById).toBeDefined(); // populate resolved
    expect(await reports.updateManyWhere({ _id: r._id }, { status: "resolved_dismissed" })).toEqual({ count: 1 });
  });
});

describe("AuditLogRepository (Mongo)", () => {
  const mkLog = async (over = {}) => {
    const a = await seed.user();
    return models.AuditLog.create({
      performedById: a._id, action: "admin_login", category: "identity", ...over,
    });
  };

  test("groupBy since-cutoff aggregations return neutral rows, count-desc", async () => {
    await mkLog({ category: "admin", action: "user_banned" });
    await mkLog({ category: "admin", action: "user_banned" });
    await mkLog({ category: "identity" });

    const byCat = await auditLogs.groupByCategorySince(daysAgo(5));
    expect(byCat[0]).toHaveProperty("key");
    expect(byCat[0].count).toBeGreaterThanOrEqual(byCat[byCat.length - 1].count); // desc
    expect(Object.fromEntries(byCat.map((r) => [r.key, r.count])).admin).toBe(2);

    const byAction = await auditLogs.groupByActionSince(daysAgo(5));
    expect(byAction.length).toBeLessThanOrEqual(10); // the take:10 cap
    expect(byAction[0]).not.toHaveProperty("_count");

    // countByCategory is unscoped/unordered but must use the same envelope.
    const all = await auditLogs.countByCategory();
    expect(all[0]).toHaveProperty("key");
  });

  test("M-6: daily activity keeps the _id/count names and ASC ordering", async () => {
    await mkLog({ createdAt: daysAgo(2) });
    await mkLog({ createdAt: daysAgo(1) });
    const rows = await auditLogs.findDailyActivitySince(daysAgo(5));
    expect(rows[0]).toHaveProperty("_id");
    expect(Number.isInteger(rows[0].count)).toBe(true);
    const ids = rows.map((r) => r._id);
    expect(ids).toEqual([...ids].sort());
  });

  test("findManyWithRelations pages, orders and populates", async () => {
    await mkLog(); await mkLog();
    const rows = await auditLogs.findManyWithRelations({ category: "identity" }, {
      skip: 0, take: 5, include: { performedBy: true },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].performedById).toBeDefined();
  });
});

describe("AdminNotificationRepository (Mongo) — reads implemented, writes owned by chat-server", () => {
  const mkAdminNotif = (over = {}) =>
    models.Notification.create({ audience: "admin", type: "report:new", ...over });

  test("reads see ONLY audience:admin rows", async () => {
    const u = await seed.user();
    await mkAdminNotif();
    await mkAdminNotif({ isRead: true });
    // a per-user notification must NOT leak into the admin feed
    await models.Notification.create({ audience: "user", receiverId: u._id, type: "like" });

    expect(await adminNotifs.count({})).toBe(2);
    expect(await adminNotifs.countUnread()).toBe(1);
    expect(await adminNotifs.findRecent(10)).toHaveLength(2);
    expect(await adminNotifs.exists({ type: "report:new" })).toBe(true);
  });

  test("findRecent is newest-first with a RAW take", async () => {
    for (let i = 0; i < 4; i++) {
      await mkAdminNotif({ createdAt: daysAgo(4 - i) });
    }
    const rows = await adminNotifs.findRecent(2);
    expect(rows).toHaveLength(2);
    expect(rows[0].createdAt.getTime()).toBeGreaterThan(rows[1].createdAt.getTime());
  });

  test("writes round-trip and stay scoped to the admin audience", async () => {
    // These threw, on the reading that Phase 2 §4 gives chat-server exclusive
    // write ownership of the unified notifications collection. Tracing the
    // path settled it: chat-server emits the socket event and POSTs back to
    // server, which performs the insert — server/ is the only writer of admin
    // rows. Every write below is scoped to { audience: "admin" }, which is
    // what keeps the two subsets disjoint.
    const made = await adminNotifs.create({ type: "report:new", label: "New report" });
    expect(made.audience).toBe("admin");

    const edited = await adminNotifs.update(made._id, { isRead: true });
    expect(edited.isRead).toBe(true);

    await adminNotifs.create({ type: "user:new", label: "New user" });
    expect(await adminNotifs.markAllRead({ isRead: true })).toEqual({ count: 1 });
    expect(await adminNotifs.countUnread()).toBe(0);

    await adminNotifs.delete(made._id);
    expect(await adminNotifs.findById(made._id)).toBeNull();
  });

  test("admin writes cannot reach a user notification", async () => {
    const u = await seed.user();
    const userRow = await models.Notification.create({
      receiverId: u._id, type: "follow", audience: "user",
    });
    await adminNotifs.create({ type: "report:new", label: "x" });
    await adminNotifs.markAllRead({ isRead: true });

    expect((await models.Notification.findById(userRow._id)).isRead).toBe(false);
    await expect(adminNotifs.update(userRow._id, { isRead: true })).rejects.toThrow();
  });
});
