// Characterization test for the `admin.comment` domain (Milestone 6E).
// Fifth admin controller — the last CRUD-heavy one before the
// analytics-heavy tail (dashboard/report/user).
//
// Baseline characterizes current behavior via exact inline mirrors of the
// controller's 19 call-sites; after extraction into the NEW
// adminCommentHelpers.js the same assertions run against those helpers.
//
// OWNERSHIP BOUNDARY (audit log): this controller's inline
// prisma.auditLog.create writes are THIS domain's write-side persistence
// and are extracted into adminCommentHelpers.js — NOT into
// adminAuditLogHelpers.js, which owns the auditlog controller's
// read/statistics persistence only.
//
// CONTROLLER-LEVEL TRANSACTIONS: none. EXTERNAL DEPENDENCIES: none
// (AUDIT_ACTIONS is a constants import; no Redis/HTTP/email/Cloudinary).
//
// PRESERVED ODDITIES (characterized as-is, deliberately NOT fixed):
//   • getCommentById's reports query filters { postId: null } globally —
//     it returns ALL comment/user-level reports, not this comment's.
//   • sortMap.most_reports orders by repliesCount (no reportsCount field).
//
// AUTHORIZATION NOTE: admin access is enforced by middleware outside this
// controller; the in-controller "unauthorized-ish" paths are the 404s for
// missing/already-deleted comments, characterized below.
import { PrismaClient } from "@prisma/client";
import * as AdminCommentHelper from "../../src/utils/adminCommentHelpers.js";

const prisma = new PrismaClient();

const userIds = [];
const postIds = [];
const MISSING = "00000000-0000-0000-0000-000000000000";

async function makeUser(role = "user") {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({
    data: { fullName: `AC ${s}`, email: `ac-${s}@e.com`, username: `ac_${s}`, role, accountStatus: "active" },
  });
  userIds.push(u.id);
  return u;
}
async function makePost(authorId) {
  const p = await prisma.post.create({ data: { type: "image", authorId, caption: "mod post" } });
  postIds.push(p.id);
  return p;
}
async function makeComment(postId, authorId, { content = "hello", status = "active", isDeleted = false } = {}) {
  return prisma.comment.create({ data: { postId, authorId, content, status, isDeleted } });
}
async function commentsCountOf(postId) {
  return (await prisma.post.findUnique({ where: { id: postId }, select: { commentsCount: true } })).commentsCount;
}

let admin, author, post;

beforeAll(async () => {
  admin = await makeUser("super_admin");
  author = await makeUser();
  post = await makePost(author.id);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { performedById: { in: userIds } } });
  await prisma.comment.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.post.deleteMany({ where: { id: { in: postIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

const LIST_SELECT = {
  id: true, content: true, status: true, isDeleted: true, isPinned: true,
  likesCount: true, repliesCount: true, createdAt: true, updatedAt: true,
  author: { select: { id: true, username: true, fullName: true, avatar: true, accountStatus: true } },
  post: {
    select: {
      id: true, caption: true, type: true, media: true, createdAt: true,
      author: { select: { id: true, username: true, fullName: true, avatar: true } },
    },
  },
};

describe("admin comments — listing, filtering, counts (inline mirror)", () => {
  test("findMany returns the nested select shape, filtered and paginated; count matches", async () => {
    const p = await makePost(author.id);
    await makeComment(p.id, author.id, { content: "list-a" });
    await makeComment(p.id, author.id, { content: "list-b", status: "flagged" });
    await makeComment(p.id, author.id, { content: "deleted", isDeleted: true });

    const where = { isDeleted: false, postId: p.id };
    const [comments, total] = await Promise.all([
      prisma.comment.findMany({ where, orderBy: { createdAt: "desc" }, skip: 0, take: 20, select: LIST_SELECT }),
      prisma.comment.count({ where }),
    ]);
    expect(total).toBe(2); // deleted excluded
    expect(comments.length).toBe(2);
    expect(comments[0].author.username).toBeTruthy();
    expect(comments[0].post.id).toBe(p.id);
    expect(comments[0].post.author.id).toBe(author.id);

    // status filter narrows
    expect(await prisma.comment.count({ where: { isDeleted: false, postId: p.id, status: "flagged" } })).toBe(1);
  });

  test("search OR-filter matches content and author name, case-insensitively", async () => {
    const p = await makePost(author.id);
    await makeComment(p.id, author.id, { content: "UniqueSearchNeedle" });

    const where = {
      isDeleted: false, postId: p.id,
      OR: [
        { content: { contains: "uniquesearchneedle", mode: "insensitive" } },
        { author: { username: { contains: "uniquesearchneedle", mode: "insensitive" } } },
        { author: { fullName: { contains: "uniquesearchneedle", mode: "insensitive" } } },
      ],
    };
    expect(await prisma.comment.count({ where })).toBe(1);
  });

  test("sort variants: oldest asc; most_reports maps to repliesCount desc (preserved oddity)", async () => {
    const p = await makePost(author.id);
    const first = await makeComment(p.id, author.id, { content: "older" });
    await new Promise((r) => setTimeout(r, 5));
    await makeComment(p.id, author.id, { content: "newer" });
    await prisma.comment.update({ where: { id: first.id }, data: { repliesCount: 5 } });

    const oldest = await prisma.comment.findMany({ where: { isDeleted: false, postId: p.id }, orderBy: { createdAt: "asc" }, skip: 0, take: 20, select: LIST_SELECT });
    expect(oldest[0].content).toBe("older");

    const mostReports = await prisma.comment.findMany({ where: { isDeleted: false, postId: p.id }, orderBy: { repliesCount: "desc" }, skip: 0, take: 20, select: LIST_SELECT });
    expect(mostReports[0].id).toBe(first.id);
  });

  test("stats: the five status counts (non-deleted scope)", async () => {
    const p = await makePost(author.id);
    await makeComment(p.id, author.id, { status: "active" });
    await makeComment(p.id, author.id, { status: "flagged" });
    await makeComment(p.id, author.id, { status: "removed" });
    // scope to this post to be isolation-safe (controller queries globally; shape is identical)
    const base = { isDeleted: false, postId: p.id };
    expect(await prisma.comment.count({ where: base })).toBe(3);
    expect(await prisma.comment.count({ where: { ...base, status: "active" } })).toBe(1);
    expect(await prisma.comment.count({ where: { ...base, status: "flagged" } })).toBe(1);
    expect(await prisma.comment.count({ where: { ...base, status: "removed" } })).toBe(1);
    expect(await prisma.comment.count({ where: { ...base, status: "pending" } })).toBe(0);
  });
});

describe("admin comments — detail & moderation lookups (inline mirror)", () => {
  test("detail findFirst returns includes; null for deleted or missing (404 paths)", async () => {
    const c = await makeComment(post.id, author.id, { content: "detail" });
    const found = await prisma.comment.findFirst({
      where: { id: c.id, isDeleted: false },
      include: {
        author: { select: { id: true, username: true, fullName: true, avatar: true, accountStatus: true, email: true } },
        post: { select: { id: true, caption: true, type: true, createdAt: true, author: { select: { id: true, username: true, fullName: true, avatar: true } } } },
      },
    });
    expect(found.author.email).toBeTruthy();
    expect(found.post.id).toBe(post.id);

    const del = await makeComment(post.id, author.id, { isDeleted: true });
    expect(await prisma.comment.findFirst({ where: { id: del.id, isDeleted: false } })).toBeNull();
    expect(await prisma.comment.findFirst({ where: { id: MISSING, isDeleted: false } })).toBeNull();
  });

  test("PRESERVED ODDITY: the detail reports query filters { postId: null } globally", async () => {
    const reporter = await makeUser();
    // a comment-level report (postId null) — MATCHES the query even though unrelated
    const r = await prisma.report.create({
      data: { reportedById: reporter.id, targetId: MISSING, targetModel: "User", reportedUserId: author.id, reason: "spam" },
    });
    const rows = await prisma.report.findMany({
      where: { postId: null },
      select: { id: true, reason: true, status: true, createdAt: true, reportedBy: { select: { username: true } } },
    });
    expect(rows.map((x) => x.id)).toContain(r.id); // global, not scoped to the comment
    await prisma.report.delete({ where: { id: r.id } });
  });
});

describe("admin comments — status update, delete, restore (inline mirror)", () => {
  test("remove: active→removed decrements post count; moderation fields written", async () => {
    const p = await makePost(author.id);
    const c = await makeComment(p.id, author.id, { status: "active" });
    await prisma.post.update({ where: { id: p.id }, data: { commentsCount: 1 } });

    await prisma.post.update({ where: { id: p.id }, data: { commentsCount: { decrement: 1 } } }).catch(() => {});
    const updated = await prisma.comment.update({
      where: { id: c.id },
      data: { status: "removed", moderatedAt: new Date(), moderatedBy: admin.id, moderationReason: "spam" },
      include: { author: { select: { id: true, username: true, fullName: true, avatar: true } } },
    });
    expect(updated.status).toBe("removed");
    expect(updated.moderatedBy).toBe(admin.id);
    expect(updated.author.id).toBe(author.id);
    expect(await commentsCountOf(p.id)).toBe(0);
  });

  test("restore (approve): removed→active increments post count", async () => {
    const p = await makePost(author.id);
    const c = await makeComment(p.id, author.id, { status: "removed" });

    await prisma.post.update({ where: { id: p.id }, data: { commentsCount: { increment: 1 } } }).catch(() => {});
    const updated = await prisma.comment.update({
      where: { id: c.id },
      data: { status: "active", moderatedAt: new Date(), moderatedBy: admin.id },
      include: { author: { select: { id: true, username: true, fullName: true, avatar: true } } },
    });
    expect(updated.status).toBe("active");
    expect(await commentsCountOf(p.id)).toBe(1);
  });

  test("count-adjust failure is swallowed by the controller's .catch (missing post)", async () => {
    await expect(
      prisma.post.update({ where: { id: MISSING }, data: { commentsCount: { decrement: 1 } } }).catch(() => {})
    ).resolves.toBeUndefined(); // swallowed, flow continues
  });

  test("soft delete writes isDeleted/deletedAt/deletedBy/status and decrements count", async () => {
    const p = await makePost(author.id);
    const c = await makeComment(p.id, author.id);
    await prisma.post.update({ where: { id: p.id }, data: { commentsCount: 1 } });

    const deleted = await prisma.comment.update({
      where: { id: c.id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: admin.id, status: "removed" },
    });
    await prisma.post.update({ where: { id: p.id }, data: { commentsCount: { decrement: 1 } } }).catch(() => {});
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.deletedBy).toBe(admin.id);
    expect(await commentsCountOf(p.id)).toBe(0);
    // repeat: findFirst no longer moderatable → controller's 404 path
    expect(await prisma.comment.findFirst({ where: { id: c.id, isDeleted: false } })).toBeNull();
  });
});

describe("admin comments — bulk operations & audit writes (inline mirror)", () => {
  test("bulk remove updates only non-deleted matching ids; count reports modified", async () => {
    const p = await makePost(author.id);
    const a = await makeComment(p.id, author.id);
    const b = await makeComment(p.id, author.id);
    const del = await makeComment(p.id, author.id, { isDeleted: true });

    const result = await prisma.comment.updateMany({
      where: { id: { in: [a.id, b.id, del.id] }, isDeleted: false },
      data: { status: "removed", moderatedAt: new Date(), moderatedBy: admin.id },
    });
    expect(result.count).toBe(2); // deleted one skipped → "failed" in the response math
    expect((await prisma.comment.findUnique({ where: { id: a.id } })).status).toBe("removed");
  });

  test("bulk delete sets the soft-delete field bundle", async () => {
    const p = await makePost(author.id);
    const a = await makeComment(p.id, author.id);
    const result = await prisma.comment.updateMany({
      where: { id: { in: [a.id] }, isDeleted: false },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: admin.id, status: "removed" },
    });
    expect(result.count).toBe(1);
    const reloaded = await prisma.comment.findUnique({ where: { id: a.id } });
    expect(reloaded.isDeleted).toBe(true);
    expect(reloaded.status).toBe("removed");
  });

  test("per-comment audit write persists action, target and meta shape", async () => {
    const c = await makeComment(post.id, author.id, { content: "audited comment" });
    const log = await prisma.auditLog.create({
      data: {
        performedById: admin.id,
        performedByName: "Admin",
        action: "comment_removed",
        targetId: c.id,
        targetType: "comment",
        targetMeta: {
          commentId: c.id, commentText: "audited comment", postId: post.id,
          postCaption: "mod post", postType: "image", newStatus: "removed", reason: "spam",
        },
        ipAddress: "127.0.0.1",
        userAgent: "jest",
        note: null,
      },
    });
    expect(log.action).toBe("comment_removed");
    expect(log.targetType).toBe("comment");
    expect(log.targetMeta.newStatus).toBe("removed");
    expect(log.performedById).toBe(admin.id);
  });

  test("bulk audit write persists null targetId and the bulk note", async () => {
    const log = await prisma.auditLog.create({
      data: {
        performedById: admin.id,
        performedByName: "Admin",
        action: "comment_bulk_updated",
        targetId: null,
        targetType: "comment",
        targetMeta: { actionTaken: "remove", status: "removed", reason: null },
        note: "Bulk remove: 2/3 comments modified",
        ipAddress: "127.0.0.1",
        userAgent: "jest",
      },
    });
    expect(log.targetId).toBeNull();
    expect(log.note).toMatch(/Bulk remove/);
  });
});

// After extraction: the 11 helpers must match the inline behavior exactly.
describe("adminCommentHelpers — extracted queries match inline behavior", () => {
  test("findComments + countComments apply controller-assembled where/orderBy/pagination", async () => {
    const p = await makePost(author.id);
    await makeComment(p.id, author.id, { content: "h-old" });
    await new Promise((r) => setTimeout(r, 5));
    await makeComment(p.id, author.id, { content: "h-new", status: "flagged" });
    await makeComment(p.id, author.id, { isDeleted: true });

    const where = { isDeleted: false, postId: p.id };
    const rows = await AdminCommentHelper.findComments(where, { createdAt: "desc" }, 0, 20);
    expect(rows.length).toBe(2);
    expect(rows[0].content).toBe("h-new"); // desc
    expect(rows[0].author.username).toBeTruthy();
    expect(rows[0].post.author.id).toBe(author.id); // nested select preserved

    expect(await AdminCommentHelper.countComments(where)).toBe(2);
    expect(await AdminCommentHelper.countComments({ ...where, status: "flagged" })).toBe(1);
    // pagination slice
    expect((await AdminCommentHelper.findComments(where, { createdAt: "desc" }, 1, 1)).length).toBe(1);
  });

  test("findCommentDetail includes author email + post; null for deleted/missing", async () => {
    const c = await makeComment(post.id, author.id, { content: "h-detail" });
    const found = await AdminCommentHelper.findCommentDetail(c.id);
    expect(found.author.email).toBeTruthy();
    expect(found.post.id).toBe(post.id);

    const del = await makeComment(post.id, author.id, { isDeleted: true });
    expect(await AdminCommentHelper.findCommentDetail(del.id)).toBeNull();
    expect(await AdminCommentHelper.findCommentDetail(MISSING)).toBeNull();
  });

  test("findCommentLevelReports preserves the global postId:null oddity", async () => {
    const reporter = await makeUser();
    const r = await prisma.report.create({
      data: { reportedById: reporter.id, targetId: MISSING, targetModel: "User", reportedUserId: author.id, reason: "spam" },
    });
    const rows = await AdminCommentHelper.findCommentLevelReports();
    expect(rows.map((x) => x.id)).toContain(r.id);
    expect(rows[0]).toHaveProperty("reportedBy");
    await prisma.report.delete({ where: { id: r.id } });
  });

  test("findModeratableComment finds only non-deleted; moderation update round-trip with count adjust", async () => {
    const p = await makePost(author.id);
    const c = await makeComment(p.id, author.id, { status: "active" });
    await prisma.post.update({ where: { id: p.id }, data: { commentsCount: 1 } });

    expect((await AdminCommentHelper.findModeratableComment(c.id)).id).toBe(c.id);

    // remove: decrement + moderation update (controller's flow through helpers)
    await AdminCommentHelper.decrementPostCommentsCount(p.id).catch(() => {});
    const updated = await AdminCommentHelper.updateCommentModeration(c.id, {
      status: "removed", moderatedAt: new Date(), moderatedBy: admin.id, moderationReason: "spam",
    });
    expect(updated.status).toBe("removed");
    expect(updated.author.id).toBe(author.id);
    expect(await commentsCountOf(p.id)).toBe(0);

    // restore: increment + back to active
    await AdminCommentHelper.incrementPostCommentsCount(p.id).catch(() => {});
    const restored = await AdminCommentHelper.updateCommentModeration(c.id, {
      status: "active", moderatedAt: new Date(), moderatedBy: admin.id,
    });
    expect(restored.status).toBe("active");
    expect(await commentsCountOf(p.id)).toBe(1);

    // failed count adjust still swallowed by the controller-side .catch
    await expect(AdminCommentHelper.decrementPostCommentsCount(MISSING).catch(() => {})).resolves.toBeUndefined();
  });

  test("softDeleteCommentById applies the bundle; findModeratableComment then misses it", async () => {
    const p = await makePost(author.id);
    const c = await makeComment(p.id, author.id);
    const deleted = await AdminCommentHelper.softDeleteCommentById(c.id, {
      isDeleted: true, deletedAt: new Date(), deletedBy: admin.id, status: "removed",
    });
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.deletedBy).toBe(admin.id);
    expect(await AdminCommentHelper.findModeratableComment(c.id)).toBeNull();
  });

  test("bulkUpdateComments skips already-deleted rows exactly like inline", async () => {
    const p = await makePost(author.id);
    const a = await makeComment(p.id, author.id);
    const del = await makeComment(p.id, author.id, { isDeleted: true });
    const result = await AdminCommentHelper.bulkUpdateComments(
      { id: { in: [a.id, del.id] }, isDeleted: false },
      { status: "flagged", moderatedAt: new Date(), moderatedBy: admin.id },
    );
    expect(result.count).toBe(1);
    expect((await prisma.comment.findUnique({ where: { id: a.id } })).status).toBe("flagged");
  });

  test("createCommentAuditLog persists both per-comment and bulk audit shapes", async () => {
    const c = await makeComment(post.id, author.id, { content: "h-audit" });
    const single = await AdminCommentHelper.createCommentAuditLog({
      performedById: admin.id, performedByName: "Admin", action: "comment_removed",
      targetId: c.id, targetType: "comment",
      targetMeta: { commentId: c.id, commentText: "h-audit", postId: post.id, postCaption: "mod post", postType: "image", newStatus: "removed", reason: null },
      ipAddress: "127.0.0.1", userAgent: "jest", note: null,
    });
    expect(single.targetId).toBe(c.id);
    expect(single.targetMeta.newStatus).toBe("removed");

    const bulk = await AdminCommentHelper.createCommentAuditLog({
      performedById: admin.id, performedByName: "Admin", action: "comment_bulk_updated",
      targetId: null, targetType: "comment",
      targetMeta: { actionTaken: "flag", status: "flagged", reason: null },
      note: "Bulk flag: 1/1 comments modified", ipAddress: "127.0.0.1", userAgent: "jest",
    });
    expect(bulk.targetId).toBeNull();
    expect(bulk.note).toMatch(/Bulk flag/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// MODERATION-BEHAVIOUR REGRESSIONS (Phase 7A Milestone 13)
//
// The migration must not "fix" any of this domain's existing oddities.
// Each one below is pinned so a future change to the repository layer or the
// helper surfaces it as a failure rather than a silent behaviour shift.
// ─────────────────────────────────────────────────────────────────────────
describe("adminComment — preserved moderation oddities (Phase 7A)", () => {
  test("count helpers still REJECT on a missing post — the swallow lives in the controller", async () => {
    // The controller wraps these in `.catch(() => {})`. The helper itself
    // must keep rejecting, or that swallow would be masking nothing and a
    // real failure elsewhere would go unnoticed.
    await expect(AdminCommentHelper.decrementPostCommentsCount(MISSING)).rejects.toMatchObject({
      code: "P2025",
    });
    await expect(AdminCommentHelper.incrementPostCommentsCount(MISSING)).rejects.toMatchObject({
      code: "P2025",
    });

    // and the controller-side swallow still turns that into a no-op
    await expect(
      AdminCommentHelper.decrementPostCommentsCount(MISSING).catch(() => {})
    ).resolves.toBeUndefined();
  });

  test("countComments counts DELETED rows too — no soft-delete scoping is applied", async () => {
    // CommentRepository.count() applies withNotDeleted by default. The admin
    // stats deliberately count whatever `where` the controller assembles,
    // including deleted rows when it asks for them.
    const p = await makePost(author.id);
    await makeComment(p.id, author.id, { content: "live" });
    await makeComment(p.id, author.id, { content: "gone", isDeleted: true });

    expect(await AdminCommentHelper.countComments({ postId: p.id })).toBe(2);
    expect(await AdminCommentHelper.countComments({ postId: p.id, isDeleted: false })).toBe(1);
    expect(await AdminCommentHelper.countComments({ postId: p.id, isDeleted: true })).toBe(1);
  });

  test("softDeleteCommentById writes ONLY the controller's bundle", async () => {
    // The repository's delete() would apply its own soft-delete payload;
    // this path must persist exactly the fields the controller assembled.
    const p = await makePost(author.id);
    const c = await makeComment(p.id, author.id);
    const at = new Date();

    const deleted = await AdminCommentHelper.softDeleteCommentById(c.id, {
      isDeleted: true,
      deletedAt: at,
      deletedBy: admin.id,
      status: "removed",
    });

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.deletedBy).toBe(admin.id);
    expect(deleted.status).toBe("removed");
    expect(deleted.deletedAt.getTime()).toBe(at.getTime()); // the caller's timestamp, not the repository's
  });

  test("bulkUpdateComments still skips already-deleted rows via the controller's predicate", async () => {
    const p = await makePost(author.id);
    const live = await makeComment(p.id, author.id);
    const gone = await makeComment(p.id, author.id, { isDeleted: true });

    const result = await AdminCommentHelper.bulkUpdateComments(
      { id: { in: [live.id, gone.id] }, isDeleted: false },
      { status: "flagged", moderatedAt: new Date(), moderatedBy: admin.id }
    );

    expect(result.count).toBe(1);
    expect((await prisma.comment.findUnique({ where: { id: live.id } })).status).toBe("flagged");
    expect((await prisma.comment.findUnique({ where: { id: gone.id } })).status).not.toBe("flagged");
  });

  test("findCommentLevelReports preserves the global postId:null oddity, unordered", async () => {
    // Still returns ALL comment/user-level reports rather than one comment's
    // — deliberately not fixed. ReportRepository.findManyWhere applies no
    // default ordering, matching the original query.
    const reporter = await makeUser();
    const r = await prisma.report.create({
      data: {
        reportedById: reporter.id,
        targetId: MISSING,
        targetModel: "User",
        reportedUserId: author.id,
        reason: "spam",
      },
    });

    const rows = await AdminCommentHelper.findCommentLevelReports();
    expect(rows.map((x) => x.id)).toContain(r.id);
    expect(Object.keys(rows[0]).sort()).toEqual(
      ["createdAt", "id", "reason", "reportedBy", "status"].sort()
    );

    await prisma.report.delete({ where: { id: r.id } });
  });

  test("the audit-log write still lands in the AuditLog table, not a comment field", async () => {
    // Ownership boundary from 6E: this domain owns the WRITE side of audit
    // logging; adminAuditLogHelpers owns the read/stats side. The migration
    // must not have crossed them.
    const c = await makeComment(post.id, author.id, { content: "audited" });
    const log = await AdminCommentHelper.createCommentAuditLog({
      performedById: admin.id,
      performedByName: "Admin",
      action: "comment_removed",
      targetId: c.id,
      targetType: "comment",
      targetMeta: { commentId: c.id },
      ipAddress: "127.0.0.1",
      userAgent: "jest",
      note: null,
    });

    const row = await prisma.auditLog.findUnique({ where: { id: log.id } });
    expect(row).not.toBeNull();
    expect(row.targetId).toBe(c.id);
    expect(row.targetType).toBe("comment");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 7B / M-1, Batch 2 — controller-shape coverage.
//
// WHY THIS EXISTS: every suite in this project calls HELPERS, never
// controllers. That gap let admin.comment.controller keep building a
// Prisma-shaped `where.OR` after CommentRepository started translating —
// a break the full 808-test run did not catch, because nothing exercises
// the controller's filter. These tests take the filter the controller
// actually assembles and push it through the helper it actually calls.
describe("M-1 — controller-assembled filter shapes (Phase 7B)", () => {
  // Verbatim copy of admin.comment.controller's where-assembly.
  const buildControllerWhere = ({ postId, status, authorId, search }) => {
    const where = { isDeleted: false };
    if (status)   where.status   = status;
    if (postId)   where.postId   = postId;
    if (authorId) where.authorId = authorId;
    if (search?.trim()) {
      where.or = [
        { content:            { like: search.trim(), caseInsensitive: true } },
        { author: { username: { like: search.trim(), caseInsensitive: true } } },
        { author: { fullName: { like: search.trim(), caseInsensitive: true } } },
      ];
    }
    return where;
  };

  test("EQUIVALENCE: the controller's search filter matches its Prisma original", async () => {
    const p = await makePost(author.id);
    const c = await makeComment(p.id, author.id, { content: "NeedleInHaystack" });
    await makeComment(p.id, author.id, { content: "unrelated" });

    const neutral = buildControllerWhere({ postId: p.id, search: "needleinhaystack" });
    const prismaWhere = {
      isDeleted: false, postId: p.id,
      OR: [
        { content: { contains: "needleinhaystack", mode: "insensitive" } },
        { author: { username: { contains: "needleinhaystack", mode: "insensitive" } } },
        { author: { fullName: { contains: "needleinhaystack", mode: "insensitive" } } },
      ],
    };

    const rows = await AdminCommentHelper.findComments(neutral, { createdAt: "desc" }, 0, 20);
    expect(rows.map((r) => r.id)).toEqual([c.id]);
    expect(await AdminCommentHelper.countComments(neutral))
      .toBe(await prisma.comment.count({ where: prismaWhere }));
  });

  test("the controller's no-search path and status/author filters still work", async () => {
    const p = await makePost(author.id);
    await makeComment(p.id, author.id, { content: "cs-a" });
    await makeComment(p.id, author.id, { content: "cs-b", status: "flagged" });

    expect(await AdminCommentHelper.countComments(buildControllerWhere({ postId: p.id }))).toBe(2);
    expect(await AdminCommentHelper.countComments(
      buildControllerWhere({ postId: p.id, status: "flagged" }),
    )).toBe(1);
    expect(await AdminCommentHelper.countComments(
      buildControllerWhere({ postId: p.id, authorId: author.id }),
    )).toBe(2);
  });
});
