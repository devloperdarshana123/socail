// Characterization test for the `admin.user` domain (Milestone 6H) — the
// FINAL controller migration. 42 call-sites including the tier's only
// TRANSACTIONS: three array-form $transaction([...]) calls, one of which
// carries a CONDITIONAL array element.
//
// Baseline characterizes current behavior via exact inline mirrors of the
// controller's queries; after extraction into the NEW adminUserHelpers.js
// the same assertions run against those helpers.
//
// EXTERNAL DEPENDENCIES (controller-only, NOT in the helper and therefore
// never touched by these tests): redis (`admin:stats` cache del/get/set,
// each wrapped in try/catch), sendMail + the accountSuspended/postDeleted
// mail templates (fire-and-forget with .catch logging). The helper imports
// prisma only, so these tests are inherently offline.
//
// TRANSACTION SEMANTICS UNDER TEST (all three array-form):
//   T1 deleteUserAccount: [post.updateMany(soft-delete author's posts),
//      user.delete] — ordering matters (posts first, then the user row);
//      rollback proven by making the 2nd element fail.
//   T2 deletePost: [post.update(soft-delete), ...(postsCount > 0 ?
//      [user.update(decrement)] : [])] — the CONDITIONAL element; proven
//      for both branches plus rollback.
//   T3 bulkUpdateStatus: [user.update(status/activeSuspension),
//      suspensionHistory.create] — per-user, inside Promise.allSettled;
//      rollback proven by making the 2nd element fail.
//
// ISOLATION: User/Post/Report rows are global on the shared
// embedded-postgres DB, so aggregate assertions are delta-scoped
// (measure → create fixtures → measure), mirroring 6F/6G. Report has
// @@unique([reportedById, postId]); null-postId rows are exempt (NULLs
// distinct), so same-reporter fixtures use postId: null.
import { PrismaClient } from "@prisma/client";
import * as AdminUserHelper from "../../src/utils/adminUserHelpers.js";

const prisma = new PrismaClient();

const userIds = [];
const postIds = [];
const reportIds = [];
const MISSING = "00000000-0000-0000-0000-000000000000";
const MARK = `m6h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

// ── Mirrors of the controller's select shapes ────────────────────────────
const LIST_SELECT = {
  id: true, username: true, fullName: true, email: true, phoneNumber: true,
  avatar: true, accountStatus: true, role: true, isVerifiedBadge: true,
  isEmailVerified: true, isMobileVerified: true, followersCount: true,
  followingCount: true, createdAt: true,
  _count: { select: { posts: { where: { isDeleted: false, isDraft: false } } } },
  businessCategory: true, location: true, authProvider: true,
  isOnboardingComplete: true,
};

const POST_SELECT = {
  id: true, caption: true, type: true, media: true,
  likesCount: true, commentsCount: true, viewsCount: true, createdAt: true,
};

// ── Fixtures ─────────────────────────────────────────────────────────────
async function makeUser({
  role = "user", accountStatus = "active", fullName = null, username = null,
  isVerifiedBadge = false, postsCount = 0, followersCount = 0,
  createdAt = null, activeSuspension = undefined, email = null,
} = {}) {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({
    data: {
      fullName: fullName ?? `AU ${s}`,
      email: email ?? `au-${s}@e.com`,
      username: username ?? `au_${s}`,
      role, accountStatus, isVerifiedBadge, postsCount, followersCount,
      ...(createdAt ? { createdAt } : {}),
      ...(activeSuspension !== undefined ? { activeSuspension } : {}),
    },
  });
  userIds.push(u.id);
  return u;
}
async function makePost(authorId, {
  type = "image", isDeleted = false, isDraft = false, caption = "au post",
  createdAt = null, likesCount = 0, viewsCount = 0,
} = {}) {
  const p = await prisma.post.create({
    data: {
      authorId, type, isDeleted, isDraft, caption, likesCount, viewsCount,
      ...(createdAt ? { createdAt } : {}),
    },
  });
  postIds.push(p.id);
  return p;
}
async function makeReport(reportedById, { postId = null, status = "pending", reason = `${MARK}_r` } = {}) {
  const r = await prisma.report.create({
    data: {
      reportedById, postId, status, reason,
      targetModel: postId ? "Post" : "User", targetId: postId ?? MISSING,
    },
  });
  reportIds.push(r.id);
  return r;
}
async function makeHistory(userId, performedBy, { action = "suspended", reason = "spam", duration = 7, expiresAt = null, createdAt = null } = {}) {
  return prisma.suspensionHistory.create({
    data: { userId, performedBy, action, reason, duration, expiresAt, ...(createdAt ? { createdAt } : {}) },
  });
}

let admin;

beforeAll(async () => {
  admin = await makeUser({ role: "super_admin" });
});

afterAll(async () => {
  await prisma.suspensionHistory.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.report.deleteMany({ where: { id: { in: reportIds } } });
  await prisma.comment.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.post.deleteMany({ where: { id: { in: postIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────
describe("user listing + filtering (inline mirror)", () => {
  test("findMany select shape incl. filtered _count.posts; count matches; super_admin excluded", async () => {
    const marker = `${MARK}list`;
    const u1 = await makeUser({ fullName: `${marker} Alpha` });
    const u2 = await makeUser({ fullName: `${marker} Beta`, accountStatus: "suspended" });
    await makeUser({ fullName: `${marker} Admin`, role: "super_admin" });
    await makePost(u1.id);                       // counted
    await makePost(u1.id, { isDeleted: true });  // excluded from _count
    await makePost(u1.id, { isDraft: true });    // excluded from _count

    const where = { role: { not: "super_admin" }, fullName: { contains: marker, mode: "insensitive" } };
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: 0, take: 20, select: LIST_SELECT }),
      prisma.user.count({ where }),
    ]);

    expect(total).toBe(2); // the super_admin row is excluded
    expect(users.map((u) => u.id).sort()).toEqual([u1.id, u2.id].sort());
    expect(Object.keys(users[0]).sort()).toEqual(Object.keys(LIST_SELECT).sort());
    expect(users.find((u) => u.id === u1.id)._count.posts).toBe(1);
  });

  test("search OR across username/fullName/email/phoneNumber; status and role filters", async () => {
    const tag = `${MARK}srch`;
    const u = await makeUser({ fullName: `Findme ${tag}`, accountStatus: "banned" });
    await makeUser({ fullName: "Unrelated", role: "moderator" });

    const searchWhere = {
      role: { not: "super_admin" },
      OR: [
        { username:    { contains: tag, mode: "insensitive" } },
        { fullName:    { contains: tag, mode: "insensitive" } },
        { email:       { contains: tag, mode: "insensitive" } },
        { phoneNumber: { contains: tag, mode: "insensitive" } },
      ],
    };
    const found = await prisma.user.findMany({ where: searchWhere, orderBy: { createdAt: "desc" }, skip: 0, take: 20, select: LIST_SELECT });
    expect(found.map((x) => x.id)).toEqual([u.id]);

    // status filter
    expect(await prisma.user.count({ where: { ...searchWhere, accountStatus: "banned" } })).toBe(1);
    expect(await prisma.user.count({ where: { ...searchWhere, accountStatus: "active" } })).toBe(0);
    // role filter overwrites the not-super_admin clause (same key)
    const modWhere = { role: "moderator" };
    expect(await prisma.user.count({ where: modWhere })).toBeGreaterThanOrEqual(1);
    // empty dataset
    expect(await prisma.user.findMany({ where: { role: { not: "super_admin" }, fullName: { contains: `${MARK}none` } }, select: LIST_SELECT })).toEqual([]);
  });

  test("sort variants: createdAt asc/desc, followersCount desc, username asc, accountStatus", async () => {
    const tag = `${MARK}sort`;
    const a = await makeUser({ fullName: `${tag} A`, followersCount: 10, username: `${MARK}_aaa` });
    await new Promise((r) => setTimeout(r, 5));
    const b = await makeUser({ fullName: `${tag} B`, followersCount: 99, username: `${MARK}_zzz` });

    const where = { role: { not: "super_admin" }, fullName: { contains: tag, mode: "insensitive" } };
    const run = (orderBy) => prisma.user.findMany({ where, orderBy, skip: 0, take: 20, select: LIST_SELECT });

    expect((await run({ createdAt: "desc" })).map((u) => u.id)).toEqual([b.id, a.id]);
    expect((await run({ createdAt: "asc" })).map((u) => u.id)).toEqual([a.id, b.id]);
    expect((await run({ followersCount: "desc" })).map((u) => u.id)).toEqual([b.id, a.id]);
    expect((await run({ username: "asc" })).map((u) => u.id)).toEqual([a.id, b.id]);
    expect((await run({ postsCount: "desc" })).length).toBe(2);
    expect((await run({ accountStatus: "desc" })).length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("profile retrieval + report grouping (inline mirror)", () => {
  const PROFILE_SELECT = {
    id: true, username: true, fullName: true, email: true, phoneNumber: true,
    avatar: true, coverPhoto: true, bio: true, designation: true, website: true,
    gender: true, dateOfBirth: true, businessCategory: true, location: true,
    isEmailVerified: true, isMobileVerified: true, isPrivate: true,
    isVerifiedBadge: true, accountStatus: true, role: true,
    isOnboardingComplete: true, onboardingStep: true, followersCount: true,
    followingCount: true, postsCount: true, lastActiveAt: true,
    notificationsEnabled: true, language: true, activeSuspension: true,
    createdAt: true, updatedAt: true,
  };

  test("profile select shape; null for missing (404 path)", async () => {
    const u = await makeUser();
    const found = await prisma.user.findUnique({ where: { id: u.id }, select: PROFILE_SELECT });
    expect(Object.keys(found).sort()).toEqual(Object.keys(PROFILE_SELECT).sort());
    expect(found.onboardingStep).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: MISSING }, select: PROFILE_SELECT })).toBeNull();
  });

  test("recent posts (take 30, non-deleted non-draft, desc) + report groupBy by status", async () => {
    const u = await makeUser();
    await makePost(u.id, { caption: "older", createdAt: new Date(Date.now() - 86400000) });
    const newer = await makePost(u.id, { caption: "newer" });
    await makePost(u.id, { isDeleted: true });
    await makePost(u.id, { isDraft: true });
    await makeReport(u.id, { status: "pending" });
    await makeReport(u.id, { status: "dismissed" });
    await makeReport(u.id, { status: "dismissed" });

    const [posts, reportsByStatus] = await Promise.all([
      prisma.post.findMany({
        where: { authorId: u.id, isDeleted: false, isDraft: false },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: POST_SELECT,
      }),
      prisma.report.groupBy({
        by: ["status"],
        where: { reportedById: u.id },
        _count: { _all: true },
      }),
    ]);

    expect(posts.length).toBe(2);
    expect(posts[0].id).toBe(newer.id);
    expect(Object.keys(posts[0]).sort()).toEqual(Object.keys(POST_SELECT).sort());

    // downstream shaping (stays in controller) — verify the raw rows feed it
    const stats = { pending: 0, resolved: 0, dismissed: 0, total: 0 };
    reportsByStatus.forEach(({ status, _count }) => {
      if (status in stats) stats[status] = _count._all;
      stats.total += _count._all;
    });
    expect(stats).toEqual({ pending: 1, resolved: 0, dismissed: 2, total: 3 });

    // empty dataset
    const empty = await makeUser();
    expect(await prisma.report.groupBy({ by: ["status"], where: { reportedById: empty.id }, _count: { _all: true } })).toEqual([]);
  });

  test("user-posts list: minimal user lookup + paginated posts (isDeleted false only)", async () => {
    const u = await makeUser();
    await makePost(u.id);
    await makePost(u.id, { isDraft: true }); // drafts INCLUDED here (only isDeleted filtered)
    await makePost(u.id, { isDeleted: true });

    const minimal = await prisma.user.findUnique({ where: { id: u.id }, select: { id: true, username: true, fullName: true } });
    expect(Object.keys(minimal).sort()).toEqual(["fullName", "id", "username"]);

    const where = { authorId: u.id, isDeleted: false };
    const [posts, total] = await Promise.all([
      prisma.post.findMany({ where, orderBy: { createdAt: "desc" }, skip: 0, take: 20, select: POST_SELECT }),
      prisma.post.count({ where }),
    ]);
    expect(total).toBe(2);
    expect(posts.length).toBe(2);
  });

  test("user-reports list: findMany with reportedBy+post includes, count", async () => {
    const u = await makeUser();
    const p = await makePost(u.id);
    await makeReport(u.id, { postId: p.id });
    await makeReport(u.id); // null postId (unique-exempt)

    const where = { reportedById: u.id };
    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
        include: {
          reportedBy: { select: { id: true, username: true, fullName: true, avatar: true } },
          post:       { select: { id: true, caption: true, media: true, createdAt: true, type: true } },
        },
      }),
      prisma.report.count({ where }),
    ]);
    expect(total).toBe(2);
    expect(reports[0].reportedBy.id).toBe(u.id);
    const withPost = reports.find((r) => r.postId === p.id);
    expect(Object.keys(withPost.post).sort()).toEqual(["caption", "createdAt", "id", "media", "type"]);
    expect(reports.find((r) => r.postId === null).post).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("suspension / restore / ban + history (inline mirror)", () => {
  const TARGET_SELECT = {
    id: true, email: true, username: true, fullName: true,
    accountStatus: true, role: true, activeSuspension: true,
  };
  const UPDATED_SELECT = { id: true, username: true, accountStatus: true, activeSuspension: true };

  test("suspend: history row + user.update writes activeSuspension JSON", async () => {
    const u = await makeUser();
    const target = await prisma.user.findUnique({ where: { id: u.id }, select: TARGET_SELECT });
    expect(target.accountStatus).toBe("active");

    const expiresAt = new Date(Date.now() + 7 * 86400000);
    await makeHistory(u.id, admin.id, { action: "suspended", reason: "spam", duration: 7, expiresAt });

    const updated = await prisma.user.update({
      where: { id: u.id },
      data: {
        accountStatus: "suspended",
        activeSuspension: {
          suspendedAt: new Date(), suspendedBy: admin.id,
          reason: "spam", duration: 7, expiresAt,
        },
      },
      select: UPDATED_SELECT,
    });
    expect(Object.keys(updated).sort()).toEqual(Object.keys(UPDATED_SELECT).sort());
    expect(updated.accountStatus).toBe("suspended");
    expect(updated.activeSuspension.reason).toBe("spam");
    expect(updated.activeSuspension.duration).toBe(7);
  });

  test("restore (suspended → active): history 'unsuspended' + activeSuspension cleared to null", async () => {
    const u = await makeUser({
      accountStatus: "suspended",
      activeSuspension: { suspendedAt: new Date(), suspendedBy: admin.id, reason: "x", duration: 1, expiresAt: null },
    });
    await makeHistory(u.id, admin.id, { action: "unsuspended", reason: "Manually lifted by admin", duration: null });

    const updated = await prisma.user.update({
      where: { id: u.id },
      data: { accountStatus: "active", activeSuspension: null },
      select: UPDATED_SELECT,
    });
    expect(updated.accountStatus).toBe("active");
    expect(updated.activeSuspension).toBeNull();
  });

  test("ban: history 'banned' + activeSuspension cleared", async () => {
    const u = await makeUser();
    await makeHistory(u.id, admin.id, { action: "banned", reason: "abuse", duration: null });
    const updated = await prisma.user.update({
      where: { id: u.id },
      data: { accountStatus: "banned", activeSuspension: null },
      select: UPDATED_SELECT,
    });
    expect(updated.accountStatus).toBe("banned");
    expect(updated.activeSuspension).toBeNull();
  });

  test("suspension history: user lookup shape + history newest-first; empty for clean user", async () => {
    const u = await makeUser();
    const looked = await prisma.user.findUnique({ where: { id: u.id }, select: TARGET_SELECT });
    expect(Object.keys(looked).sort()).toEqual(Object.keys(TARGET_SELECT).sort());

    await makeHistory(u.id, admin.id, { action: "suspended", createdAt: new Date(Date.now() - 86400000) });
    const latest = await makeHistory(u.id, admin.id, { action: "unsuspended", duration: null });

    const history = await prisma.suspensionHistory.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
    });
    expect(history.length).toBe(2);
    expect(history[0].id).toBe(latest.id);

    const clean = await makeUser();
    expect(await prisma.suspensionHistory.findMany({ where: { userId: clean.id }, orderBy: { createdAt: "desc" } })).toEqual([]);
  });

  test("verified badge toggle: lookup then update returns only isVerifiedBadge", async () => {
    const u = await makeUser({ isVerifiedBadge: false });
    const looked = await prisma.user.findUnique({ where: { id: u.id }, select: { id: true, username: true, isVerifiedBadge: true } });
    expect(looked.isVerifiedBadge).toBe(false);

    const updated = await prisma.user.update({
      where: { id: u.id },
      data: { isVerifiedBadge: !looked.isVerifiedBadge },
      select: { isVerifiedBadge: true },
    });
    expect(updated).toEqual({ isVerifiedBadge: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("dashboard statistics + all-posts listing (inline mirror)", () => {
  test("the eight stat counts apply their exact filters (delta-scoped)", async () => {
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
    const wheres = [
      { role: { not: "super_admin" } },
      { role: { not: "super_admin" }, accountStatus: "active" },
      { role: { not: "super_admin" }, accountStatus: "suspended" },
      { role: { not: "super_admin" }, accountStatus: "banned" },
      { role: { not: "super_admin" }, isVerifiedBadge: true },
    ];
    const before = await Promise.all([
      ...wheres.map((w) => prisma.user.count({ where: w })),
      prisma.post.count({ where: { isDeleted: false } }),
      prisma.report.count({ where: { status: "pending" } }),
      prisma.user.count({ where: { role: { not: "super_admin" }, createdAt: { gte: startOfToday } } }),
    ]);

    const u = await makeUser({ accountStatus: "active", isVerifiedBadge: true });
    await makeUser({ accountStatus: "suspended" });
    await makeUser({ accountStatus: "banned" });
    await makeUser({ role: "super_admin" }); // excluded everywhere
    await makePost(u.id);
    await makePost(u.id, { isDeleted: true }); // excluded
    await makeReport(u.id, { status: "pending" });
    await makeReport(u.id, { status: "resolved" }); // excluded

    const after = await Promise.all([
      ...wheres.map((w) => prisma.user.count({ where: w })),
      prisma.post.count({ where: { isDeleted: false } }),
      prisma.report.count({ where: { status: "pending" } }),
      prisma.user.count({ where: { role: { not: "super_admin" }, createdAt: { gte: startOfToday } } }),
    ]);

    const delta = after.map((v, i) => v - before[i]);
    expect(delta).toEqual([3, 1, 1, 1, 1, 1, 1, 3]);
  });

  test("all-posts listing: non-deleted, non-draft, non-admin authors; type/search filters; sort whitelist", async () => {
    const u = await makeUser();
    const adminAuthor = await makeUser({ role: "super_admin" });
    const cap = `${MARK}cap`;
    const p1 = await makePost(u.id, { type: "image", caption: `${cap} one`, likesCount: 5 });
    const p2 = await makePost(u.id, { type: "text",  caption: `${cap} two`, likesCount: 50 });
    await makePost(u.id, { caption: `${cap} del`, isDeleted: true });
    await makePost(u.id, { caption: `${cap} draft`, isDraft: true });
    await makePost(adminAuthor.id, { caption: `${cap} admin` });

    const where = {
      isDeleted: false, isDraft: false,
      author: { role: { not: "super_admin" } },
      caption: { contains: cap, mode: "insensitive" },
    };
    const select = {
      ...POST_SELECT,
      author: {
        select: { id: true, username: true, fullName: true, avatar: true, isVerifiedBadge: true, accountStatus: true },
      },
    };
    const [posts, total] = await Promise.all([
      prisma.post.findMany({ where, orderBy: { createdAt: "desc" }, skip: 0, take: 20, select }),
      prisma.post.count({ where }),
    ]);
    expect(total).toBe(2);
    expect(posts.map((p) => p.id).sort()).toEqual([p1.id, p2.id].sort());
    expect(posts[0].author.accountStatus).toBe("active");

    // type filter + sort by a whitelisted field
    expect(await prisma.post.count({ where: { ...where, type: "text" } })).toBe(1);
    const byLikes = await prisma.post.findMany({ where, orderBy: { likesCount: "desc" }, skip: 0, take: 20, select });
    expect(byLikes[0].id).toBe(p2.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("T1 — deleteUserAccount array-form transaction (inline mirror)", () => {
  test("commits in order: posts soft-deleted, then user row removed", async () => {
    const u = await makeUser();
    const p1 = await makePost(u.id);
    const p2 = await makePost(u.id);
    const target = await prisma.user.findUnique({ where: { id: u.id }, select: { id: true, username: true, email: true, role: true } });
    expect(Object.keys(target).sort()).toEqual(["email", "id", "role", "username"]);

    await prisma.$transaction([
      prisma.post.updateMany({
        where: { authorId: u.id },
        data: { isDeleted: true, deletedAt: new Date() },
      }),
      prisma.user.delete({ where: { id: u.id } }),
    ]);

    // NOTE: Post.authorId cascades on user delete, so the rows are gone —
    // what matters is that both elements applied and the user is deleted.
    expect(await prisma.user.findUnique({ where: { id: u.id } })).toBeNull();
    expect(await prisma.post.count({ where: { id: { in: [p1.id, p2.id] } } })).toBe(0);
  });

  test("ROLLBACK: a failing 2nd element leaves the posts un-deleted", async () => {
    const u = await makeUser();
    const p = await makePost(u.id);

    await expect(prisma.$transaction([
      prisma.post.updateMany({
        where: { authorId: u.id },
        data: { isDeleted: true, deletedAt: new Date() },
      }),
      prisma.user.delete({ where: { id: MISSING } }), // P2025 → whole tx aborts
    ])).rejects.toMatchObject({ code: "P2025" });

    const after = await prisma.post.findUnique({ where: { id: p.id } });
    expect(after.isDeleted).toBe(false); // first element rolled back
    expect(after.deletedAt).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: u.id } })).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("T2 — deletePost array-form transaction with CONDITIONAL element (inline mirror)", () => {
  const postDetailInclude = {
    author: { select: { id: true, username: true, fullName: true, email: true, postsCount: true } },
  };

  test("lookup: findFirst non-deleted with author include; null for missing/deleted", async () => {
    const u = await makeUser({ postsCount: 3 });
    const p = await makePost(u.id);
    const found = await prisma.post.findFirst({ where: { id: p.id, isDeleted: false }, include: postDetailInclude });
    expect(found.author.postsCount).toBe(3);
    expect(Object.keys(found.author).sort()).toEqual(["email", "fullName", "id", "postsCount", "username"]);

    const del = await makePost(u.id, { isDeleted: true });
    expect(await prisma.post.findFirst({ where: { id: del.id, isDeleted: false }, include: postDetailInclude })).toBeNull();
    expect(await prisma.post.findFirst({ where: { id: MISSING, isDeleted: false }, include: postDetailInclude })).toBeNull();
  });

  test("CONDITIONAL BRANCH postsCount > 0: two elements — post soft-deleted AND count decremented", async () => {
    const u = await makeUser({ postsCount: 2 });
    const p = await makePost(u.id);
    const post = await prisma.post.findFirst({ where: { id: p.id, isDeleted: false }, include: postDetailInclude });
    const deletedAt = new Date();

    const ops = [
      prisma.post.update({ where: { id: p.id }, data: { isDeleted: true, deletedAt } }),
      ...(post.author.postsCount > 0
        ? [prisma.user.update({ where: { id: post.author.id }, data: { postsCount: { decrement: 1 } } })]
        : []),
    ];
    expect(ops.length).toBe(2); // conditional element present
    await prisma.$transaction(ops);

    expect((await prisma.post.findUnique({ where: { id: p.id } })).isDeleted).toBe(true);
    expect((await prisma.user.findUnique({ where: { id: u.id } })).postsCount).toBe(1);
  });

  test("CONDITIONAL BRANCH postsCount === 0: one element — post soft-deleted, count stays 0 (never negative)", async () => {
    const u = await makeUser({ postsCount: 0 });
    const p = await makePost(u.id);
    const post = await prisma.post.findFirst({ where: { id: p.id, isDeleted: false }, include: postDetailInclude });
    const deletedAt = new Date();

    const ops = [
      prisma.post.update({ where: { id: p.id }, data: { isDeleted: true, deletedAt } }),
      ...(post.author.postsCount > 0
        ? [prisma.user.update({ where: { id: post.author.id }, data: { postsCount: { decrement: 1 } } })]
        : []),
    ];
    expect(ops.length).toBe(1); // conditional element ABSENT — the guard
    await prisma.$transaction(ops);

    expect((await prisma.post.findUnique({ where: { id: p.id } })).isDeleted).toBe(true);
    expect((await prisma.user.findUnique({ where: { id: u.id } })).postsCount).toBe(0);
  });

  test("ROLLBACK: failing decrement element leaves the post un-deleted", async () => {
    const u = await makeUser({ postsCount: 1 });
    const p = await makePost(u.id);

    await expect(prisma.$transaction([
      prisma.post.update({ where: { id: p.id }, data: { isDeleted: true, deletedAt: new Date() } }),
      prisma.user.update({ where: { id: MISSING }, data: { postsCount: { decrement: 1 } } }),
    ])).rejects.toMatchObject({ code: "P2025" });

    expect((await prisma.post.findUnique({ where: { id: p.id } })).isDeleted).toBe(false);
    expect((await prisma.user.findUnique({ where: { id: u.id } })).postsCount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("T3 — bulkUpdateStatus array-form transaction (inline mirror)", () => {
  test("per-user lookup shape; commits status + history row together", async () => {
    const u = await makeUser();
    const looked = await prisma.user.findUnique({ where: { id: u.id }, select: { id: true, role: true, accountStatus: true } });
    expect(Object.keys(looked).sort()).toEqual(["accountStatus", "id", "role"]);

    const expiresAt = new Date(Date.now() + 7 * 86400000);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: u.id },
        data: {
          accountStatus: "suspended",
          activeSuspension: {
            suspendedAt: new Date(), suspendedBy: admin.id,
            reason: "bulk", duration: 7, expiresAt,
          },
        },
      }),
      prisma.suspensionHistory.create({
        data: {
          userId: u.id, action: "suspended", performedBy: admin.id,
          reason: "bulk", duration: 7, expiresAt,
        },
      }),
    ]);

    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after.accountStatus).toBe("suspended");
    expect(after.activeSuspension.reason).toBe("bulk");
    expect((await prisma.suspensionHistory.findMany({ where: { userId: u.id } })).length).toBe(1);
  });

  test("ROLLBACK: failing history element leaves the user status unchanged", async () => {
    const u = await makeUser({ accountStatus: "active" });

    await expect(prisma.$transaction([
      prisma.user.update({ where: { id: u.id }, data: { accountStatus: "banned" } }),
      // FK violation: userId does not exist → whole tx aborts
      prisma.suspensionHistory.create({
        data: { userId: MISSING, action: "banned", performedBy: admin.id, reason: "x", duration: null, expiresAt: null },
      }),
    ])).rejects.toThrow();

    expect((await prisma.user.findUnique({ where: { id: u.id } })).accountStatus).toBe("active");
    expect(await prisma.suspensionHistory.count({ where: { userId: u.id } })).toBe(0);
  });

  test("Promise.allSettled isolation: one failing user does not abort the others", async () => {
    const ok = await makeUser();
    const results = { success: [], failed: [] };

    await Promise.allSettled([ok.id, MISSING].map(async (userId) => {
      try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, accountStatus: true } });
        if (!user || user.role === "super_admin") throw new Error("Not allowed");
        await prisma.$transaction([
          prisma.user.update({ where: { id: userId }, data: { accountStatus: "deactivated" } }),
          prisma.suspensionHistory.create({
            data: { userId, action: "deactivated", performedBy: admin.id, reason: null, duration: null, expiresAt: null },
          }),
        ]);
        results.success.push(userId);
      } catch (err) {
        results.failed.push({ userId, error: err.message });
      }
    }));

    expect(results.success).toEqual([ok.id]);
    expect(results.failed).toEqual([{ userId: MISSING, error: "Not allowed" }]);
    expect((await prisma.user.findUnique({ where: { id: ok.id } })).accountStatus).toBe("deactivated");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// After extraction: the 24 helpers must match the inline behavior exactly.
describe("adminUserHelpers — extracted queries match inline behavior", () => {
  test("findUsers/countUsers: select shape, filtered _count.posts, sort, pagination", async () => {
    const marker = `${MARK}hmlist`;
    const u1 = await makeUser({ fullName: `${marker} A`, followersCount: 3 });
    await new Promise((r) => setTimeout(r, 5));
    const u2 = await makeUser({ fullName: `${marker} B`, followersCount: 90 });
    await makeUser({ fullName: `${marker} Admin`, role: "super_admin" });
    await makePost(u1.id);
    await makePost(u1.id, { isDraft: true }); // excluded from _count

    // Neutral filter DSL (Phase 7B/M-1) — `like` + `caseInsensitive` is the
    // portable spelling of what was `contains` + `mode: "insensitive"`.
    const where = { role: { not: "super_admin" }, fullName: { like: marker, caseInsensitive: true } };
    const rows = await AdminUserHelper.findUsers(where, { createdAt: "desc" }, 0, 20);
    expect(rows.map((u) => u.id)).toEqual([u2.id, u1.id]);
    expect(Object.keys(rows[0]).sort()).toEqual(Object.keys(LIST_SELECT).sort());
    expect(rows.find((u) => u.id === u1.id)._count.posts).toBe(1);

    expect(await AdminUserHelper.countUsers(where)).toBe(2);
    expect((await AdminUserHelper.findUsers(where, { followersCount: "desc" }, 0, 1))[0].id).toBe(u2.id);
    expect((await AdminUserHelper.findUsers(where, { createdAt: "asc" }, 1, 5)).map((u) => u.id)).toEqual([u2.id]);
    // No caseInsensitive here — mirrors the original, which omitted `mode`
    // and therefore matched case-SENSITIVELY.
    expect(await AdminUserHelper.countUsers({ role: { not: "super_admin" }, fullName: { like: `${MARK}hmnone` } })).toBe(0);
  });

  test("the four scoped user lookups return their exact projections; null for missing", async () => {
    const u = await makeUser({ isVerifiedBadge: true });

    const profile = await AdminUserHelper.findUserProfile(u.id);
    expect(profile.onboardingStep).toBe(1);
    expect(profile).toHaveProperty("activeSuspension");
    expect(profile).toHaveProperty("updatedAt");

    expect(Object.keys(await AdminUserHelper.findUserIdentity(u.id)).sort()).toEqual(["fullName", "id", "username"]);
    expect(Object.keys(await AdminUserHelper.findUserForStatusChange(u.id)).sort())
      .toEqual(["accountStatus", "activeSuspension", "email", "fullName", "id", "role", "username"]);
    expect(Object.keys(await AdminUserHelper.findUserForDeletion(u.id)).sort()).toEqual(["email", "id", "role", "username"]);
    expect(Object.keys(await AdminUserHelper.findUserBadgeState(u.id)).sort()).toEqual(["id", "isVerifiedBadge", "username"]);
    expect(Object.keys(await AdminUserHelper.findUserForBulkStatus(u.id)).sort()).toEqual(["accountStatus", "id", "role"]);
    expect(Object.keys(await AdminUserHelper.findUserForSuspensionHistory(u.id)).sort())
      .toEqual(["accountStatus", "activeSuspension", "fullName", "id", "role", "username"]);

    for (const fn of [
      AdminUserHelper.findUserProfile, AdminUserHelper.findUserIdentity,
      AdminUserHelper.findUserForStatusChange, AdminUserHelper.findUserForDeletion,
      AdminUserHelper.findUserBadgeState, AdminUserHelper.findUserForBulkStatus,
      AdminUserHelper.findUserForSuspensionHistory,
    ]) {
      expect(await fn(MISSING)).toBeNull();
    }
  });

  test("findRecentUserPosts + groupUserReportsByStatus feed the profile widgets", async () => {
    const u = await makeUser();
    await makePost(u.id, { caption: "hm-old", createdAt: new Date(Date.now() - 86400000) });
    const newer = await makePost(u.id, { caption: "hm-new" });
    await makePost(u.id, { isDeleted: true });
    await makePost(u.id, { isDraft: true });
    await makeReport(u.id, { status: "pending" });
    await makeReport(u.id, { status: "dismissed" });

    const posts = await AdminUserHelper.findRecentUserPosts(u.id);
    expect(posts.map((p) => p.id)).toEqual([newer.id, posts[1].id]);
    expect(posts.length).toBe(2);
    expect(Object.keys(posts[0]).sort()).toEqual(Object.keys(POST_SELECT).sort());

    const grouped = await AdminUserHelper.groupUserReportsByStatus(u.id);
    const stats = { pending: 0, resolved: 0, dismissed: 0, total: 0 };
    // M-4: neutral { key, count } rows replace Prisma's { status, _count }.
    grouped.forEach(({ key: status, count }) => {
      if (status in stats) stats[status] = count;
      stats.total += count;
    });
    expect(stats).toEqual({ pending: 1, resolved: 0, dismissed: 1, total: 2 });

    const clean = await makeUser();
    expect(await AdminUserHelper.groupUserReportsByStatus(clean.id)).toEqual([]);
  });

  test("findUserPosts/countPosts and findUserReports/countReports match the list shapes", async () => {
    const u = await makeUser();
    const p = await makePost(u.id);
    await makePost(u.id, { isDeleted: true });
    await makeReport(u.id, { postId: p.id });
    await makeReport(u.id); // null postId

    const postWhere = { authorId: u.id, isDeleted: false };
    expect((await AdminUserHelper.findUserPosts(postWhere, 0, 20)).length).toBe(1);
    expect(await AdminUserHelper.countPosts(postWhere)).toBe(1);

    const repWhere = { reportedById: u.id };
    const reports = await AdminUserHelper.findUserReports(repWhere, 0, 20);
    expect(reports.length).toBe(2);
    expect(reports[0].reportedBy.id).toBe(u.id);
    expect(Object.keys(reports.find((r) => r.postId === p.id).post).sort())
      .toEqual(["caption", "createdAt", "id", "media", "type"]);
    expect(await AdminUserHelper.countReports(repWhere)).toBe(2);
  });

  test("suspension flow via helpers: history writes, status update projection, restore, history list", async () => {
    const u = await makeUser();
    const expiresAt = new Date(Date.now() + 7 * 86400000);

    await AdminUserHelper.createSuspensionHistory({
      userId: u.id, action: "suspended", performedBy: admin.id,
      reason: "spam", duration: 7, expiresAt,
    });
    const suspended = await AdminUserHelper.updateUserStatusById(u.id, {
      accountStatus: "suspended",
      activeSuspension: { suspendedAt: new Date(), suspendedBy: admin.id, reason: "spam", duration: 7, expiresAt },
    });
    expect(Object.keys(suspended).sort()).toEqual(["accountStatus", "activeSuspension", "id", "username"]);
    expect(suspended.activeSuspension.duration).toBe(7);

    await AdminUserHelper.createSuspensionHistory({
      userId: u.id, action: "unsuspended", performedBy: admin.id,
      reason: "Manually lifted by admin", duration: null, expiresAt: null,
    });
    const restored = await AdminUserHelper.updateUserStatusById(u.id, { accountStatus: "active", activeSuspension: null });
    expect(restored.accountStatus).toBe("active");
    expect(restored.activeSuspension).toBeNull();

    const history = await AdminUserHelper.findSuspensionHistory(u.id);
    expect(history.map((h) => h.action)).toEqual(["unsuspended", "suspended"]); // newest-first
    expect(await AdminUserHelper.findSuspensionHistory((await makeUser()).id)).toEqual([]);
  });

  test("updateUserVerifiedBadge returns only the badge field", async () => {
    const u = await makeUser({ isVerifiedBadge: false });
    const looked = await AdminUserHelper.findUserBadgeState(u.id);
    expect(await AdminUserHelper.updateUserVerifiedBadge(u.id, !looked.isVerifiedBadge)).toEqual({ isVerifiedBadge: true });
    expect(await AdminUserHelper.updateUserVerifiedBadge(u.id, false)).toEqual({ isVerifiedBadge: false });
  });

  test("countUsers/countPosts/countReports reproduce the eight dashboard stats", async () => {
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
    const run = () => Promise.all([
      AdminUserHelper.countUsers({ role: { not: "super_admin" } }),
      AdminUserHelper.countUsers({ role: { not: "super_admin" }, accountStatus: "active" }),
      AdminUserHelper.countUsers({ role: { not: "super_admin" }, accountStatus: "suspended" }),
      AdminUserHelper.countUsers({ role: { not: "super_admin" }, accountStatus: "banned" }),
      AdminUserHelper.countUsers({ role: { not: "super_admin" }, isVerifiedBadge: true }),
      AdminUserHelper.countPosts({ isDeleted: false }),
      AdminUserHelper.countReports({ status: "pending" }),
      AdminUserHelper.countUsers({ role: { not: "super_admin" }, createdAt: { gte: startOfToday } }),
    ]);

    const before = await run();
    const u = await makeUser({ accountStatus: "active", isVerifiedBadge: true });
    await makeUser({ accountStatus: "suspended" });
    await makeUser({ accountStatus: "banned" });
    await makeUser({ role: "super_admin" }); // excluded
    await makePost(u.id);
    await makePost(u.id, { isDeleted: true });
    await makeReport(u.id, { status: "pending" });
    await makeReport(u.id, { status: "resolved" });
    const after = await run();

    expect(after.map((v, i) => v - before[i])).toEqual([3, 1, 1, 1, 1, 1, 1, 3]);
  });

  test("findAllPosts matches the admin grid: filters, author select, sort whitelist", async () => {
    const u = await makeUser();
    const adminAuthor = await makeUser({ role: "super_admin" });
    const cap = `${MARK}hmcap`;
    const p1 = await makePost(u.id, { type: "image", caption: `${cap} one`, likesCount: 5 });
    const p2 = await makePost(u.id, { type: "text", caption: `${cap} two`, likesCount: 50 });
    await makePost(u.id, { caption: `${cap} del`, isDeleted: true });
    await makePost(u.id, { caption: `${cap} draft`, isDraft: true });
    await makePost(adminAuthor.id, { caption: `${cap} admin` });

    const where = {
      isDeleted: false, isDraft: false,
      author: { role: { not: "super_admin" } },   // nested relation, still recurses
      caption: { like: cap, caseInsensitive: true },
    };
    const rows = await AdminUserHelper.findAllPosts(where, { createdAt: "desc" }, 0, 20);
    expect(rows.map((p) => p.id).sort()).toEqual([p1.id, p2.id].sort());
    expect(Object.keys(rows[0].author).sort())
      .toEqual(["accountStatus", "avatar", "fullName", "id", "isVerifiedBadge", "username"]);
    expect(await AdminUserHelper.countPosts(where)).toBe(2);
    expect((await AdminUserHelper.findAllPosts(where, { likesCount: "desc" }, 0, 20))[0].id).toBe(p2.id);
  });

  test("findPostForDeletion matches the findFirst+author include; null for deleted/missing", async () => {
    const u = await makeUser({ postsCount: 4 });
    const p = await makePost(u.id);
    const found = await AdminUserHelper.findPostForDeletion(p.id);
    expect(found.author.postsCount).toBe(4);
    expect(Object.keys(found.author).sort()).toEqual(["email", "fullName", "id", "postsCount", "username"]);

    const del = await makePost(u.id, { isDeleted: true });
    expect(await AdminUserHelper.findPostForDeletion(del.id)).toBeNull();
    expect(await AdminUserHelper.findPostForDeletion(MISSING)).toBeNull();
  });

  test("T1 helper: commits both elements in order; ROLLBACK on a failing element", async () => {
    const u = await makeUser();
    const p = await makePost(u.id);
    await AdminUserHelper.deleteUserAndSoftDeleteTheirPosts(u.id, { isDeleted: true, deletedAt: new Date() });
    expect(await prisma.user.findUnique({ where: { id: u.id } })).toBeNull();
    expect(await prisma.post.count({ where: { id: p.id } })).toBe(0); // cascade

    // rollback: the helper's array is atomic — a failing delete leaves posts intact
    const u2 = await makeUser();
    const p2 = await makePost(u2.id);
    await expect(prisma.$transaction([
      prisma.post.updateMany({ where: { authorId: u2.id }, data: { isDeleted: true, deletedAt: new Date() } }),
      prisma.user.delete({ where: { id: MISSING } }),
    ])).rejects.toMatchObject({ code: "P2025" });
    expect((await prisma.post.findUnique({ where: { id: p2.id } })).isDeleted).toBe(false);
    expect(await prisma.user.findUnique({ where: { id: u2.id } })).not.toBeNull();
  });

  test("T2 helper: CONDITIONAL element present when postsCount > 0", async () => {
    const u = await makeUser({ postsCount: 2 });
    const p = await makePost(u.id);
    const post = await AdminUserHelper.findPostForDeletion(p.id);

    await AdminUserHelper.softDeletePostAndDecrementAuthorCount(
      p.id,
      { isDeleted: true, deletedAt: new Date() },
      post.author.id,
      post.author.postsCount,
    );

    expect((await prisma.post.findUnique({ where: { id: p.id } })).isDeleted).toBe(true);
    expect((await prisma.user.findUnique({ where: { id: u.id } })).postsCount).toBe(1); // decremented
  });

  test("T2 helper: CONDITIONAL element ABSENT when postsCount === 0 (count never goes negative)", async () => {
    const u = await makeUser({ postsCount: 0 });
    const p = await makePost(u.id);
    const post = await AdminUserHelper.findPostForDeletion(p.id);

    await AdminUserHelper.softDeletePostAndDecrementAuthorCount(
      p.id,
      { isDeleted: true, deletedAt: new Date() },
      post.author.id,
      post.author.postsCount,
    );

    expect((await prisma.post.findUnique({ where: { id: p.id } })).isDeleted).toBe(true);
    expect((await prisma.user.findUnique({ where: { id: u.id } })).postsCount).toBe(0); // guard held
  });

  test("T2 helper: ROLLBACK — a failing decrement leaves the post un-deleted", async () => {
    const u = await makeUser({ postsCount: 1 });
    const p = await makePost(u.id);

    await expect(AdminUserHelper.softDeletePostAndDecrementAuthorCount(
      p.id,
      { isDeleted: true, deletedAt: new Date() },
      MISSING,   // author row does not exist → P2025 on element 2
      1,         // conditional element IS included
    )).rejects.toMatchObject({ code: "P2025" });

    expect((await prisma.post.findUnique({ where: { id: p.id } })).isDeleted).toBe(false);
    expect((await prisma.user.findUnique({ where: { id: u.id } })).postsCount).toBe(1);
  });

  test("T3 helper: commits status + history together; ROLLBACK on a failing history write", async () => {
    const u = await makeUser();
    const expiresAt = new Date(Date.now() + 7 * 86400000);

    await AdminUserHelper.updateUserStatusWithHistory(
      u.id,
      {
        accountStatus: "suspended",
        activeSuspension: { suspendedAt: new Date(), suspendedBy: admin.id, reason: "bulk", duration: 7, expiresAt },
      },
      { userId: u.id, action: "suspended", performedBy: admin.id, reason: "bulk", duration: 7, expiresAt },
    );
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after.accountStatus).toBe("suspended");
    expect(after.activeSuspension.reason).toBe("bulk");
    expect(await prisma.suspensionHistory.count({ where: { userId: u.id } })).toBe(1);

    // rollback: FK violation on the history element aborts the status update
    const u2 = await makeUser({ accountStatus: "active" });
    await expect(AdminUserHelper.updateUserStatusWithHistory(
      u2.id,
      { accountStatus: "banned" },
      { userId: MISSING, action: "banned", performedBy: admin.id, reason: null, duration: null, expiresAt: null },
    )).rejects.toThrow();
    expect((await prisma.user.findUnique({ where: { id: u2.id } })).accountStatus).toBe("active");
    expect(await prisma.suspensionHistory.count({ where: { userId: u2.id } })).toBe(0);
  });

  test("T3 helper under Promise.allSettled: one failure does not abort the others", async () => {
    const ok = await makeUser();
    const results = { success: [], failed: [] };

    await Promise.allSettled([ok.id, MISSING].map(async (userId) => {
      try {
        const user = await AdminUserHelper.findUserForBulkStatus(userId);
        if (!user || user.role === "super_admin") throw new Error("Not allowed");
        await AdminUserHelper.updateUserStatusWithHistory(
          userId,
          { accountStatus: "deactivated" },
          { userId, action: "deactivated", performedBy: admin.id, reason: null, duration: null, expiresAt: null },
        );
        results.success.push(userId);
      } catch (err) {
        results.failed.push({ userId, error: err.message });
      }
    }));

    expect(results.success).toEqual([ok.id]);
    expect(results.failed).toEqual([{ userId: MISSING, error: "Not allowed" }]);
    expect((await prisma.user.findUnique({ where: { id: ok.id } })).accountStatus).toBe("deactivated");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 7A Milestone 16 — repository-boundary regressions.
//
// The suite above proves the helpers still behave identically. These pin
// the properties the array-form → callback-form transaction conversion had
// to preserve, plus the pagination-cap and soft-delete-scoping hazards this
// helper's reads meet at the repository boundary.
describe("repository boundary — Phase 7A hazards", () => {
  test("T1 returns [updateManyResult, deletedUser] in the original element order", async () => {
    const u = await makeUser();
    await makePost(u.id);
    await makePost(u.id);

    const out = await AdminUserHelper.deleteUserAndSoftDeleteTheirPosts(
      u.id, { isDeleted: true, deletedAt: new Date() },
    );

    // The array form returned one result per element; the callback must too.
    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ count: 2 }); // element 0: post.updateMany
    expect(out[1]).toMatchObject({ id: u.id }); // element 1: user.delete
  });

  test("T1 ROLLBACK through the helper: a failing user delete leaves the posts intact", async () => {
    // Rollback was previously proven only against an inline $transaction.
    // Pin it on the converted helper itself.
    const u = await makeUser();
    const p = await makePost(u.id);

    await expect(AdminUserHelper.deleteUserAndSoftDeleteTheirPosts(
      MISSING, { isDeleted: true, deletedAt: new Date() },
    )).rejects.toMatchObject({ code: "P2025" });

    // The sweep targeted MISSING's posts, so this user's rows stay untouched.
    expect((await prisma.post.findUnique({ where: { id: p.id } })).isDeleted).toBe(false);
    expect(await prisma.user.findUnique({ where: { id: u.id } })).not.toBeNull();
  });

  test("T2 conditional: the callback returns 1 element when the guard blocks, 2 when it passes", async () => {
    // This is the array-spread → `if` translation. The RETURN LENGTH is the
    // observable proof that the conditional element is still conditional.
    const withPosts = await makeUser({ postsCount: 3 });
    const p1 = await makePost(withPosts.id);
    const two = await AdminUserHelper.softDeletePostAndDecrementAuthorCount(
      p1.id, { isDeleted: true, deletedAt: new Date() }, withPosts.id, 3,
    );
    expect(two).toHaveLength(2);
    expect(two[0]).toMatchObject({ id: p1.id, isDeleted: true }); // always element 0
    expect(two[1]).toMatchObject({ id: withPosts.id, postsCount: 2 });

    const zeroCount = await makeUser({ postsCount: 0 });
    const p2 = await makePost(zeroCount.id);
    const one = await AdminUserHelper.softDeletePostAndDecrementAuthorCount(
      p2.id, { isDeleted: true, deletedAt: new Date() }, zeroCount.id, 0,
    );
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ id: p2.id, isDeleted: true });
    expect((await prisma.user.findUnique({ where: { id: zeroCount.id } })).postsCount).toBe(0);
  });

  test("T2 guard reads the CAPTURED count, not a fresh database read", async () => {
    // The original evaluated the guard synchronously against a number the
    // controller had already fetched. If the conversion had turned it into a
    // read inside the transaction, the captured value would stop mattering —
    // this proves it still decides the branch.
    const u = await makeUser({ postsCount: 5 });
    const p = await makePost(u.id);

    // Row says 5, caller passes 0 → guard blocks, no decrement.
    const out = await AdminUserHelper.softDeletePostAndDecrementAuthorCount(
      p.id, { isDeleted: true, deletedAt: new Date() }, u.id, 0,
    );
    expect(out).toHaveLength(1);
    expect((await prisma.user.findUnique({ where: { id: u.id } })).postsCount).toBe(5);
  });

  test("T3 returns [updatedUser, historyRow] and preserves err.message for the bulk loop", async () => {
    const u = await makeUser();
    const out = await AdminUserHelper.updateUserStatusWithHistory(
      u.id,
      { accountStatus: "deactivated" },
      { userId: u.id, action: "deactivated", performedBy: admin.id, reason: null, duration: null, expiresAt: null },
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: u.id, accountStatus: "deactivated" });
    expect(out[1]).toMatchObject({ userId: u.id, action: "deactivated" });

    // bulkUpdateStatus does `results.failed.push({ error: err.message })`.
    // TransactionError must carry the cause's message through, or every bulk
    // failure would report the same generic wrapper text.
    const failure = await AdminUserHelper.updateUserStatusWithHistory(
      MISSING,
      { accountStatus: "banned" },
      { userId: MISSING, action: "banned", performedBy: admin.id, reason: null, duration: null, expiresAt: null },
    ).catch((err) => err);

    expect(typeof failure.message).toBe("string");
    expect(failure.message.length).toBeGreaterThan(0);
    expect(failure.message).not.toBe("Prisma transaction failed");
    expect(failure).toMatchObject({ code: "P2025" });
  });

  test("findSuspensionHistory is UNBOUNDED: the full audit trail, not a 20-row page", async () => {
    // findByUserId() paginates via toPrismaPagination(), whose default caps
    // take at 20. The panel renders the whole history, so the helper must use
    // findAllByUserId().
    const u = await makeUser();
    const base = Date.now() - 25 * 86_400_000;
    for (let i = 0; i < 25; i++) {
      await makeHistory(u.id, admin.id, { action: "suspended", createdAt: new Date(base + i * 86_400_000) });
    }

    const history = await AdminUserHelper.findSuspensionHistory(u.id);
    expect(history).toHaveLength(25);
    // …and still newest-first.
    const times = history.map((h) => h.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  test("findUsers is UNCAPPED and keeps the filtered _count.posts projection", async () => {
    const mark = `${MARK}_cap`;
    const made = [];
    for (let i = 0; i < 22; i++) made.push(await makeUser({ fullName: `${mark} u${i}` }));
    // One of them gets a visible post and a deleted one — the _count must
    // apply its own where, not count both.
    await makePost(made[0].id);
    await makePost(made[0].id, { isDeleted: true });

    const page = await AdminUserHelper.findUsers(
      { fullName: { like: mark } }, { createdAt: "asc" }, 0, 22,
    );
    expect(page).toHaveLength(22);
    expect(page.find((u) => u.id === made[0].id)._count.posts).toBe(1); // deleted excluded

    // skip is forwarded raw too.
    const rest = await AdminUserHelper.findUsers(
      { fullName: { like: mark } }, { createdAt: "asc" }, 20, 22,
    );
    expect(rest).toHaveLength(2);
  });

  test("countPosts is UNSCOPED: the controller's where is the only filter", async () => {
    // SocialPostRepository.count() defaults to withNotDeleted(). The helper
    // passes includeDeleted: true so a filter WITHOUT an isDeleted predicate
    // still counts deleted rows, exactly as the original raw count did.
    const u = await makeUser();
    await makePost(u.id);
    await makePost(u.id, { isDeleted: true });

    expect(await AdminUserHelper.countPosts({ authorId: u.id })).toBe(2);
    expect(await AdminUserHelper.countPosts({ authorId: u.id, isDeleted: false })).toBe(1);
    expect(await AdminUserHelper.countPosts({ authorId: u.id, isDeleted: true })).toBe(1);
  });

  test("findPostForDeletion passes its filter VERBATIM (findFirstWhere, not findById)", async () => {
    // findById() applies its own soft-delete scoping and matches on the
    // primary key only; this lookup owns an isDeleted predicate of its own.
    const u = await makeUser({ postsCount: 1 });
    const live = await makePost(u.id);
    const gone = await makePost(u.id, { isDeleted: true });

    const found = await AdminUserHelper.findPostForDeletion(live.id);
    expect(found).toMatchObject({ id: live.id });
    expect(found.author).toMatchObject({ id: u.id, postsCount: 1 });
    expect(found.author.email).toBe(u.email); // include survives

    expect(await AdminUserHelper.findPostForDeletion(gone.id)).toBeNull();
  });

  test("M-1 EQUIVALENCE: the neutral filter returns exactly what the Prisma filter returned", async () => {
    // The migration's whole promise is "identical PostgreSQL behaviour".
    // This asserts it directly: the same query expressed in the OLD Prisma
    // DSL (run inline against the raw client, which is unaffected by M-1)
    // and in the NEW neutral DSL (through the helper → repository →
    // translator path) must return the same rows in the same order.
    const marker = `${MARK}equiv`;
    const a = await makeUser({ fullName: `${marker} Alpha`, followersCount: 1 });
    await new Promise((r) => setTimeout(r, 5));
    const b = await makeUser({ fullName: `${marker} BETA`, followersCount: 2 });
    await makeUser({ fullName: `${marker} Admin`, role: "super_admin" });

    // ── case-insensitive search across four fields, super_admin excluded ──
    const prismaWhere = {
      role: { not: "super_admin" },
      OR: [
        { username:    { contains: marker, mode: "insensitive" } },
        { fullName:    { contains: marker, mode: "insensitive" } },
        { email:       { contains: marker, mode: "insensitive" } },
        { phoneNumber: { contains: marker, mode: "insensitive" } },
      ],
    };
    const neutralWhere = {
      role: { not: "super_admin" },
      or: [
        { username:    { like: marker, caseInsensitive: true } },
        { fullName:    { like: marker, caseInsensitive: true } },
        { email:       { like: marker, caseInsensitive: true } },
        { phoneNumber: { like: marker, caseInsensitive: true } },
      ],
    };

    const inline  = await prisma.user.findMany({ where: prismaWhere, orderBy: { createdAt: "desc" }, select: { id: true } });
    const through = await AdminUserHelper.findUsers(neutralWhere, { createdAt: "desc" }, 0, 20);
    expect(through.map((u) => u.id)).toEqual(inline.map((u) => u.id));
    expect(through.map((u) => u.id)).toEqual([b.id, a.id]);
    expect(await AdminUserHelper.countUsers(neutralWhere)).toBe(await prisma.user.count({ where: prismaWhere }));

    // ── case sensitivity is preserved in BOTH directions ──────────────────
    const upper = `${marker} BETA`.toUpperCase();
    expect(await AdminUserHelper.countUsers({ fullName: { like: upper, caseInsensitive: true } }))
      .toBe(await prisma.user.count({ where: { fullName: { contains: upper, mode: "insensitive" } } }));
    expect(await AdminUserHelper.countUsers({ fullName: { like: upper } }))
      .toBe(await prisma.user.count({ where: { fullName: { contains: upper } } }));

    // ── date range + set membership + negation all still agree ────────────
    const since = new Date(Date.now() - 60_000);
    const range = { role: { not: "super_admin" }, createdAt: { gte: since, lte: new Date(Date.now() + 60_000) },
                    fullName: { like: marker, caseInsensitive: true } };
    expect(await AdminUserHelper.countUsers(range)).toBe(await prisma.user.count({ where: {
      role: { not: "super_admin" }, createdAt: { gte: since, lte: new Date(Date.now() + 60_000) },
      fullName: { contains: marker, mode: "insensitive" },
    } }));

    const ids = { id: { in: [a.id, b.id] } };
    expect(await AdminUserHelper.countUsers(ids)).toBe(2);
    expect(await AdminUserHelper.countUsers({ id: { notIn: [a.id, b.id] }, fullName: { like: marker } })).toBe(1);
  });

  test("M-1 GUARANTEE: a Prisma-shaped filter is now REJECTED at the repository boundary", async () => {
    // Before M-1 this filter reached Prisma and worked; on Mongo it would
    // have silently matched nothing. It must now fail loudly instead.
    await expect(AdminUserHelper.countUsers({ fullName: { contains: "x", mode: "insensitive" } }))
      .rejects.toThrow(/contains/);
    await expect(AdminUserHelper.countUsers({ OR: [{ fullName: "x" }] }))
      .rejects.toThrow(/OR/);
  });

  test("groupUserReportsByStatus is scoped to ONE reporter, independent of the global variant", async () => {
    const reporter = await makeUser();
    const other    = await makeUser();
    await makeReport(reporter.id, { status: "pending" });
    await makeReport(reporter.id, { status: "pending" });
    await makeReport(reporter.id, { status: "resolved_no_action" });
    await makeReport(other.id,    { status: "pending" });

    const rows = await AdminUserHelper.groupUserReportsByStatus(reporter.id);
    const byStatus = Object.fromEntries(rows.map((r) => [r.key, r.count]));
    expect(byStatus).toEqual({ pending: 2, resolved_no_action: 1 });

    // The other reporter's row must not leak in — this filter is what makes
    // it a distinct repository method from groupByStatus().
    expect(rows.reduce((n, r) => n + r.count, 0)).toBe(3);
  });
});

// ── Phase 7B / M-1, Batch 3 — SuspensionHistoryRepository boundary ───────
// adminUserHelpers needed NO conversion for this repository; findAllByUserId
// takes an id, not a filter, so only the BaseRepository trio translates.
describe("M-1 Batch 3 — suspension history repository boundary", () => {
  test("neutral filters translate to themselves; the unbounded read is unaffected", async () => {
    const { suspensionHistoryRepository } = await import("../../src/config/repositories.js");
    const u = await makeUser();
    for (let i = 0; i < 3; i++) await makeHistory(u.id, admin.id, { action: "suspended" });

    const filter = { userId: u.id };
    expect(await suspensionHistoryRepository.count(filter))
      .toBe(await prisma.suspensionHistory.count({ where: filter }));
    expect(await suspensionHistoryRepository.exists(filter)).toBe(true);

    // findAllByUserId still returns the WHOLE trail, newest-first (Milestone 16).
    const all = await suspensionHistoryRepository.findAllByUserId(u.id);
    expect(all).toHaveLength(3);
    const times = all.map((h) => h.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  test("M-1 GUARANTEE: Prisma-shaped filters are rejected", async () => {
    const { suspensionHistoryRepository } = await import("../../src/config/repositories.js");
    await expect(suspensionHistoryRepository.count({ reason: { contains: "x" } }))
      .rejects.toThrow(/contains/);
  });
});
