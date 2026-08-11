// Characterization test for the `report` domain (Milestone 5H).
// reportHelpers.js already owns this domain; the controller has only 3
// direct Prisma queries (target-existence checks in submitReport). This
// locks down, against a real Postgres:
//   1. reportHelpers behavior behind every endpoint's persistence path.
//   2. The 3 controller queries, via exact inline mirrors (extracted after).
//
// EXTERNAL DEPENDENCIES: exactly one — notifyAdmin (HTTP to chat-server).
// It is fire-and-forget, runs AFTER persistence, and is NOT called by any
// helper exercised here, so these tests are entirely network-free.
import { PrismaClient } from "@prisma/client";
import * as ReportHelper from "../../src/utils/reportHelpers.js";

const prisma = new PrismaClient();

let reporter, target, postAuthor, post, comment;
const userIds = [];
const postIds = [];

async function makeUser() {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({ data: { fullName: `R ${s}`, email: `r-${s}@e.com`, username: `r_${s}`, accountStatus: "active" } });
  userIds.push(u.id);
  return u;
}

beforeAll(async () => {
  reporter = await makeUser();
  target = await makeUser();
  postAuthor = await makeUser();
  post = await prisma.post.create({ data: { type: "image", authorId: postAuthor.id } });
  postIds.push(post.id);
  comment = await prisma.comment.create({ data: { content: "reportable", postId: post.id, authorId: postAuthor.id } });
});

afterAll(async () => {
  await prisma.report.deleteMany({ where: { reportedById: { in: userIds } } });
  await prisma.comment.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.post.deleteMany({ where: { id: { in: postIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("reportHelpers — submit, rate limit, priority (characterization)", () => {
  test("getRecentReportCount counts only reports inside the window", async () => {
    const u = await makeUser();
    expect(await ReportHelper.getRecentReportCount(u.id, 60_000)).toBe(0);
    await ReportHelper.submitReport({ reportedBy: u.id, targetId: post.id, targetModel: "Post", reason: "spam" });
    expect(await ReportHelper.getRecentReportCount(u.id, 60_000)).toBe(1);
    // A window that starts in the FUTURE excludes the just-created report.
    // (Using windowMs = 0 would be flaky: windowStart === Date.now(), and the
    // helper filters `createdAt >= windowStart`, so a report written in the
    // same millisecond still matches. A negative windowMs puts windowStart
    // safely ahead of the row's timestamp, testing the same boundary
    // deterministically.)
    expect(await ReportHelper.getRecentReportCount(u.id, -1000)).toBe(0);
  });

  test("submitReport creates a Post report with the polymorphic fields set", async () => {
    const u = await makeUser();
    const { alreadyReported, report } = await ReportHelper.submitReport({
      reportedBy: u.id, targetId: post.id, targetModel: "Post", reason: "spam", description: "  spammy  ",
    });
    expect(alreadyReported).toBe(false);
    expect(report.targetId).toBe(post.id);
    expect(report.postId).toBe(post.id);
    expect(report.commentId).toBeNull();
    expect(report.reportedUserId).toBeNull();
    expect(report.status).toBe("pending");
    expect(report.description).toBe("spammy"); // trimmed
  });

  test("submitReport is duplicate-protected (same reporter + target)", async () => {
    const u = await makeUser();
    const first = await ReportHelper.submitReport({ reportedBy: u.id, targetId: post.id, targetModel: "Post", reason: "spam" });
    const second = await ReportHelper.submitReport({ reportedBy: u.id, targetId: post.id, targetModel: "Post", reason: "hate_speech" });
    expect(first.alreadyReported).toBe(false);
    expect(second.alreadyReported).toBe(true);
    expect(second.report.id).toBe(first.report.id);
  });

  test("submitReport sets Comment and User polymorphic fields correctly", async () => {
    const u1 = await makeUser();
    const c = await ReportHelper.submitReport({ reportedBy: u1.id, targetId: comment.id, targetModel: "Comment", reason: "harassment_or_bullying" });
    expect(c.report.commentId).toBe(comment.id);
    expect(c.report.postId).toBeNull();

    const u2 = await makeUser();
    const r = await ReportHelper.submitReport({ reportedBy: u2.id, targetId: target.id, targetModel: "User", reason: "scam_or_fraud" });
    expect(r.report.reportedUserId).toBe(target.id);
    expect(r.report.postId).toBeNull();
  });

  test("submitReport escalates priority as open reports accumulate on the same target", async () => {
    const p = await prisma.post.create({ data: { type: "image", authorId: postAuthor.id } });
    postIds.push(p.id);

    const a = await makeUser();
    const first = await ReportHelper.submitReport({ reportedBy: a.id, targetId: p.id, targetModel: "Post", reason: "spam" });
    expect(first.report.priority).toBe("low"); // 0 existing open

    const b = await makeUser();
    const second = await ReportHelper.submitReport({ reportedBy: b.id, targetId: p.id, targetModel: "Post", reason: "spam" });
    expect(second.report.priority).toBe("medium"); // 1 existing open

    const c2 = await makeUser();
    const d = await makeUser();
    await ReportHelper.submitReport({ reportedBy: c2.id, targetId: p.id, targetModel: "Post", reason: "spam" });
    const fourth = await ReportHelper.submitReport({ reportedBy: d.id, targetId: p.id, targetModel: "Post", reason: "spam" });
    expect(fourth.report.priority).toBe("high"); // >=3 existing open

    // earlier open reports on the same target are back-filled to the new priority
    const reloadedFirst = await prisma.report.findUnique({ where: { id: first.report.id }, select: { priority: true } });
    expect(reloadedFirst.priority).toBe("high");
  });

  test("submitReport rejects invalid targetModel / reason / ids", async () => {
    const u = await makeUser();
    await expect(ReportHelper.submitReport({ reportedBy: u.id, targetId: post.id, targetModel: "Nope", reason: "spam" })).rejects.toThrow(/Invalid targetModel/);
    await expect(ReportHelper.submitReport({ reportedBy: u.id, targetId: post.id, targetModel: "Post", reason: "nonsense" })).rejects.toThrow(/Invalid reason/);
    await expect(ReportHelper.submitReport({ reportedBy: "not-a-uuid", targetId: post.id, targetModel: "Post", reason: "spam" })).rejects.toThrow(/Invalid reporter ID/);
    await expect(ReportHelper.submitReport({ reportedBy: u.id, targetId: "not-a-uuid", targetModel: "Post", reason: "spam" })).rejects.toThrow(/Invalid target ID/);
  });
});

describe("reportHelpers — admin read/update paths (characterization)", () => {
  test("getReports returns paginated reports + total for a status", async () => {
    const u = await makeUser();
    await ReportHelper.submitReport({ reportedBy: u.id, targetId: post.id, targetModel: "Post", reason: "spam" });
    const { reports, total } = await ReportHelper.getReports({ status: "pending", limit: 20, offset: 0 });
    expect(Array.isArray(reports)).toBe(true);
    expect(typeof total).toBe("number");
    expect(total).toBeGreaterThan(0);
    expect(reports[0]).toHaveProperty("reportedBy"); // relation included
  });

  test("getReportDetails returns the report with relations; null for missing", async () => {
    const u = await makeUser();
    const { report } = await ReportHelper.submitReport({ reportedBy: u.id, targetId: post.id, targetModel: "Post", reason: "spam" });
    const details = await ReportHelper.getReportDetails(report.id);
    expect(details.id).toBe(report.id);
    expect(details.post.id).toBe(post.id);
    expect(details).toHaveProperty("reportedBy");
    expect(await ReportHelper.getReportDetails("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  test("getReportDetails substitutes a placeholder when the reported User is gone", async () => {
    const u = await makeUser();
    const ghost = await makeUser();
    const { report } = await ReportHelper.submitReport({ reportedBy: u.id, targetId: ghost.id, targetModel: "User", reason: "spam" });
    await prisma.report.update({ where: { id: report.id }, data: { reportedUserId: null } }); // simulate deleted account
    const details = await ReportHelper.getReportDetails(report.id);
    expect(details.reportedUser.fullName).toBe("Deleted Account");
    expect(details.reportedUser.accountStatus).toBe("deleted");
  });

  test("updateReportStatus updates a valid status and rejects an invalid one", async () => {
    const u = await makeUser();
    const { report } = await ReportHelper.submitReport({ reportedBy: u.id, targetId: post.id, targetModel: "Post", reason: "spam" });
    const updated = await ReportHelper.updateReportStatus(report.id, "reviewed");
    expect(updated.status).toBe("reviewed");
    await expect(ReportHelper.updateReportStatus(report.id, "bogus")).rejects.toThrow(/Invalid status/);
  });

  test("dismissReport sets status to dismissed", async () => {
    const u = await makeUser();
    const { report } = await ReportHelper.submitReport({ reportedBy: u.id, targetId: post.id, targetModel: "Post", reason: "spam" });
    const dismissed = await ReportHelper.dismissReport(report.id);
    expect(dismissed.status).toBe("dismissed");
  });

  test("resolveReport resolves, records actionTaken, and applies a User action", async () => {
    const u = await makeUser();
    const victim = await makeUser();
    const { report } = await ReportHelper.submitReport({ reportedBy: u.id, targetId: victim.id, targetModel: "User", reason: "harassment_or_bullying" });

    const resolved = await ReportHelper.resolveReport(report.id, "suspend");
    expect(resolved.status).toBe("resolved");
    expect(resolved.actionTaken).toBe("suspend");
    const reloaded = await prisma.user.findUnique({ where: { id: victim.id }, select: { accountStatus: true } });
    expect(reloaded.accountStatus).toBe("suspended");
  });

  test("resolveReport with no action resolves without changing the user; rejects invalid action; throws for missing report", async () => {
    const u = await makeUser();
    const other = await makeUser();
    const { report } = await ReportHelper.submitReport({ reportedBy: u.id, targetId: other.id, targetModel: "User", reason: "spam" });

    const resolved = await ReportHelper.resolveReport(report.id, null);
    expect(resolved.actionTaken).toBe("none");
    expect((await prisma.user.findUnique({ where: { id: other.id }, select: { accountStatus: true } })).accountStatus).toBe("active");

    await expect(ReportHelper.resolveReport(report.id, "explode")).rejects.toThrow(/Invalid action/);
    await expect(ReportHelper.resolveReport("00000000-0000-0000-0000-000000000000", null)).rejects.toThrow(/Report not found/);
  });
});

describe("report controller direct queries — inline mirror (baseline)", () => {
  test("Post / Comment / User target-existence checks (select id), null for missing", async () => {
    const foundPost = await prisma.post.findUnique({ where: { id: post.id }, select: { id: true } });
    expect(Object.keys(foundPost)).toEqual(["id"]);
    expect(await prisma.post.findUnique({ where: { id: "00000000-0000-0000-0000-000000000000" }, select: { id: true } })).toBeNull();

    const foundComment = await prisma.comment.findUnique({ where: { id: comment.id }, select: { id: true } });
    expect(Object.keys(foundComment)).toEqual(["id"]);
    expect(await prisma.comment.findUnique({ where: { id: "00000000-0000-0000-0000-000000000000" }, select: { id: true } })).toBeNull();

    const foundUser = await prisma.user.findUnique({ where: { id: target.id }, select: { id: true } });
    expect(Object.keys(foundUser)).toEqual(["id"]);
    expect(await prisma.user.findUnique({ where: { id: "00000000-0000-0000-0000-000000000000" }, select: { id: true } })).toBeNull();
  });
});

// After extraction: the 3 helpers must match the inline behavior exactly.
describe("reportHelpers — extracted guards match inline behavior", () => {
  const MISSING = "00000000-0000-0000-0000-000000000000";

  test("findPostExists returns { id } for an existing post, null for missing", async () => {
    const found = await ReportHelper.findPostExists(post.id);
    expect(Object.keys(found)).toEqual(["id"]);
    expect(found.id).toBe(post.id);
    expect(await ReportHelper.findPostExists(MISSING)).toBeNull();
  });

  test("findCommentExists returns { id } for an existing comment, null for missing", async () => {
    const found = await ReportHelper.findCommentExists(comment.id);
    expect(Object.keys(found)).toEqual(["id"]);
    expect(found.id).toBe(comment.id);
    expect(await ReportHelper.findCommentExists(MISSING)).toBeNull();
  });

  test("findUserExists returns { id } for an existing user, null for missing", async () => {
    const found = await ReportHelper.findUserExists(target.id);
    expect(Object.keys(found)).toEqual(["id"]);
    expect(found.id).toBe(target.id);
    expect(await ReportHelper.findUserExists(MISSING)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 7A additions — coverage the Milestone 5H suite above never had:
// the priority-calculation boundaries, priority back-propagation to existing
// open reports, description truncation, getReports' no-status branch and its
// offset pagination, and the placeholder substitutions for deleted Post /
// Comment targets.
//
// Written and run GREEN against the original direct-Prisma implementation
// BEFORE the repository migration, so they are a true before/after net.
// ─────────────────────────────────────────────────────────────────────────

describe("reportHelpers — submit details & priority (Phase 7A)", () => {
  test("description is trimmed and truncated to 500 characters", async () => {
    const r = await makeUser();
    const t = await makeUser();
    const { report } = await ReportHelper.submitReport({
      reportedBy: r.id,
      targetId: t.id,
      targetModel: "User",
      reason: "spam",
      description: `  ${"d".repeat(600)}  `,
    });
    expect(report.description.length).toBe(500);
    expect(report.description.startsWith(" ")).toBe(false);
  });

  test("description defaults to an empty string when omitted", async () => {
    const r = await makeUser();
    const t = await makeUser();
    const { report } = await ReportHelper.submitReport({
      reportedBy: r.id, targetId: t.id, targetModel: "User", reason: "spam",
    });
    expect(report.description).toBe("");
  });

  test("priority thresholds are low (0 open), medium (1-2), high (3+)", async () => {
    const t = await makeUser();
    const mk = async () => {
      const r = await makeUser();
      const { report } = await ReportHelper.submitReport({
        reportedBy: r.id, targetId: t.id, targetModel: "User", reason: "spam",
      });
      return report;
    };

    expect((await mk()).priority).toBe("low"); // 0 existing open
    expect((await mk()).priority).toBe("medium"); // 1 existing
    expect((await mk()).priority).toBe("medium"); // 2 existing
    expect((await mk()).priority).toBe("high"); // 3 existing
  });

  test("a new report back-propagates its priority to existing OPEN reports on the same target", async () => {
    const t = await makeUser();
    const r1 = await makeUser();
    const r2 = await makeUser();

    const first = (await ReportHelper.submitReport({
      reportedBy: r1.id, targetId: t.id, targetModel: "User", reason: "spam",
    })).report;
    expect(first.priority).toBe("low");

    await ReportHelper.submitReport({
      reportedBy: r2.id, targetId: t.id, targetModel: "User", reason: "spam",
    });

    // the earlier report was raised to match
    const reloaded = await prisma.report.findUnique({ where: { id: first.id } });
    expect(reloaded.priority).toBe("medium");
  });

  test("resolved and dismissed reports are excluded from the priority count and back-propagation", async () => {
    const t = await makeUser();
    const r1 = await makeUser();
    const r2 = await makeUser();

    const closed = (await ReportHelper.submitReport({
      reportedBy: r1.id, targetId: t.id, targetModel: "User", reason: "spam",
    })).report;
    await ReportHelper.dismissReport(closed.id);

    const fresh = (await ReportHelper.submitReport({
      reportedBy: r2.id, targetId: t.id, targetModel: "User", reason: "spam",
    })).report;

    expect(fresh.priority).toBe("low"); // the dismissed one did not count
    // and the dismissed report's priority was not rewritten
    const reloaded = await prisma.report.findUnique({ where: { id: closed.id } });
    expect(reloaded.priority).toBe("low");
    expect(reloaded.status).toBe("dismissed");
  });

  test("priority is scoped per target — an unrelated target stays low", async () => {
    const t1 = await makeUser();
    const t2 = await makeUser();
    for (let i = 0; i < 3; i++) {
      const r = await makeUser();
      await ReportHelper.submitReport({
        reportedBy: r.id, targetId: t1.id, targetModel: "User", reason: "spam",
      });
    }

    const other = await makeUser();
    const { report } = await ReportHelper.submitReport({
      reportedBy: other.id, targetId: t2.id, targetModel: "User", reason: "spam",
    });
    expect(report.priority).toBe("low");
  });

  test("the duplicate guard is scoped by reporter AND target AND model", async () => {
    const r = await makeUser();
    const t = await makeUser();

    const first = await ReportHelper.submitReport({
      reportedBy: r.id, targetId: t.id, targetModel: "User", reason: "spam",
    });
    expect(first.alreadyReported).toBe(false);

    const dup = await ReportHelper.submitReport({
      reportedBy: r.id, targetId: t.id, targetModel: "User", reason: "hate_speech",
    });
    expect(dup.alreadyReported).toBe(true);
    expect(dup.report.id).toBe(first.report.id); // returns the original
    expect(dup.report.reason).toBe("spam"); // reason NOT updated

    // a different reporter on the same target is allowed
    const other = await makeUser();
    expect(
      (await ReportHelper.submitReport({
        reportedBy: other.id, targetId: t.id, targetModel: "User", reason: "spam",
      })).alreadyReported
    ).toBe(false);
  });
});

describe("reportHelpers — admin listing & details (Phase 7A)", () => {
  test("getReports with no status returns every status", async () => {
    const t = await makeUser();
    const r1 = await makeUser();
    const r2 = await makeUser();
    const a = (await ReportHelper.submitReport({
      reportedBy: r1.id, targetId: t.id, targetModel: "User", reason: "spam",
    })).report;
    const b = (await ReportHelper.submitReport({
      reportedBy: r2.id, targetId: t.id, targetModel: "User", reason: "spam",
    })).report;
    await ReportHelper.dismissReport(b.id);

    const all = await ReportHelper.getReports({ status: null, limit: 100 });
    const ids = all.reports.map((x) => x.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id); // dismissed included when no status filter
  });

  test("getReports paginates with limit/offset and reports the unpaginated total", async () => {
    const t = await makeUser();
    const made = [];
    for (let i = 0; i < 3; i++) {
      const r = await makeUser();
      made.push((await ReportHelper.submitReport({
        reportedBy: r.id, targetId: t.id, targetModel: "User", reason: "spam",
      })).report);
      await new Promise((x) => setTimeout(x, 5));
    }

    const page1 = await ReportHelper.getReports({ status: "pending", limit: 2, offset: 0 });
    expect(page1.reports.length).toBe(2);
    expect(page1.limit).toBe(2);
    expect(page1.offset).toBe(0);
    expect(page1.total).toBeGreaterThanOrEqual(3); // total ignores limit/offset

    const page2 = await ReportHelper.getReports({ status: "pending", limit: 2, offset: 2 });
    const overlap = page1.reports.map((x) => x.id).filter((id) =>
      page2.reports.map((y) => y.id).includes(id)
    );
    expect(overlap).toEqual([]); // offset genuinely skips
  });

  test("getReports rows carry the reportedBy / post / comment relations", async () => {
    const r = await makeUser();
    const { report } = await ReportHelper.submitReport({
      reportedBy: r.id, targetId: post.id, targetModel: "Post", reason: "spam",
    });

    const { reports } = await ReportHelper.getReports({ status: "pending", limit: 100 });
    const mine = reports.find((x) => x.id === report.id);
    expect(mine.reportedBy.id).toBe(r.id);
    expect(mine.post.id).toBe(post.id);
    expect(mine.post.author.id).toBe(postAuthor.id);
    expect(mine.comment).toBeNull(); // Post report has no comment relation
  });

  test("getReportDetails substitutes a placeholder for a deleted Post target", async () => {
    const r = await makeUser();
    const doomed = await prisma.post.create({ data: { type: "image", authorId: postAuthor.id } });
    const { report } = await ReportHelper.submitReport({
      reportedBy: r.id, targetId: doomed.id, targetModel: "Post", reason: "spam",
    });
    await prisma.report.update({ where: { id: report.id }, data: { postId: null } });

    const details = await ReportHelper.getReportDetails(report.id);
    expect(details.post.caption).toBe("Post no longer available");
    expect(details.post.id).toBe(doomed.id); // falls back to targetId
    expect(details.post.author.username).toBe("Unknown");

    await prisma.post.delete({ where: { id: doomed.id } });
  });

  test("getReportDetails substitutes a placeholder for a deleted Comment target", async () => {
    const r = await makeUser();
    const { report } = await ReportHelper.submitReport({
      reportedBy: r.id, targetId: comment.id, targetModel: "Comment", reason: "spam",
    });
    await prisma.report.update({ where: { id: report.id }, data: { commentId: null } });

    const details = await ReportHelper.getReportDetails(report.id);
    expect(details.comment.content).toBe("Comment no longer available");
    expect(details.comment.author.username).toBe("Unknown");
  });

  test("getReportDetails leaves live relations untouched", async () => {
    const r = await makeUser();
    const { report } = await ReportHelper.submitReport({
      reportedBy: r.id, targetId: post.id, targetModel: "Post", reason: "spam",
    });
    const details = await ReportHelper.getReportDetails(report.id);
    expect(details.post.caption).not.toBe("Post no longer available");
    expect(details.post.author.id).toBe(postAuthor.id);
  });

  test("resolveReport maps warn/suspend/ban onto the target account status", async () => {
    const cases = [
      ["warn", "active"],
      ["suspend", "suspended"],
      ["ban", "banned"],
    ];
    for (const [action, expected] of cases) {
      const r = await makeUser();
      const t = await makeUser();
      const { report } = await ReportHelper.submitReport({
        reportedBy: r.id, targetId: t.id, targetModel: "User", reason: "spam",
      });

      const resolved = await ReportHelper.resolveReport(report.id, action);
      expect(resolved.status).toBe("resolved");
      expect(resolved.actionTaken).toBe(action);
      expect((await prisma.user.findUnique({ where: { id: t.id } })).accountStatus).toBe(expected);
    }
  });

  test("resolveReport on a non-User target never touches an account", async () => {
    const r = await makeUser();
    const { report } = await ReportHelper.submitReport({
      reportedBy: r.id, targetId: post.id, targetModel: "Post", reason: "spam",
    });
    const before = (await prisma.user.findUnique({ where: { id: postAuthor.id } })).accountStatus;

    const resolved = await ReportHelper.resolveReport(report.id, "ban");
    expect(resolved.actionTaken).toBe("ban");
    // the post's author is NOT the report target, so their status is unchanged
    expect((await prisma.user.findUnique({ where: { id: postAuthor.id } })).accountStatus).toBe(before);
  });

  test("updateReportStatus accepts each valid status", async () => {
    const r = await makeUser();
    const t = await makeUser();
    const { report } = await ReportHelper.submitReport({
      reportedBy: r.id, targetId: t.id, targetModel: "User", reason: "spam",
    });

    for (const status of ["pending", "reviewed", "resolved", "dismissed"]) {
      const updated = await ReportHelper.updateReportStatus(report.id, status);
      expect(updated.status).toBe(status);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 7B / M-1, Batch 3 — ReportRepository boundary regression.
// No caller conversion was needed here: every filter reportHelpers and
// adminReportHelpers build was ALREADY neutral vocabulary (in / not / gte /
// lte / bare equality). These prove the translator is a genuine no-op for
// those shapes, and that the six groupBy queries and the raw SQL never pass
// through it at all.
describe("M-1 Batch 3 — report repository boundary", () => {
  test("already-neutral operators translate to themselves: identical rows", async () => {
    const { reportRepository } = await import("../../src/config/repositories.js");
    const mark = `m1b3_${Date.now()}`;
    const r1 = await prisma.report.create({ data: {
      reportedById: reporter.id, postId: post.id, targetModel: "Post", targetId: post.id,
      reason: mark, status: "pending", priority: "high",
    } });

    const filters = [
      { reason: mark },
      { reason: mark, status: { in: ["pending", "under_review"] } },
      { reason: mark, status: { not: "dismissed" } },
      { reason: mark, createdAt: { gte: new Date(Date.now() - 60000) } },
      { reason: mark, postId: post.id, id: { not: "00000000-0000-0000-0000-000000000000" } },
      { reason: mark, claimedById: null },
    ];
    for (const f of filters) {
      expect(await reportRepository.count(f)).toBe(await prisma.report.count({ where: f }));
    }

    const viaRepo = await reportRepository.findManyOrdered({ reason: mark }, {
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }], skip: 0, take: 10,
    });
    const inline = await prisma.report.findMany({
      where: { reason: mark }, orderBy: [{ priority: "desc" }, { createdAt: "desc" }], skip: 0, take: 10,
    });
    expect(viaRepo.map((r) => r.id)).toEqual(inline.map((r) => r.id));
    expect(viaRepo.map((r) => r.id)).toContain(r1.id);

    await prisma.report.deleteMany({ where: { reason: mark } });
  });

  test("groupBy and raw SQL bypass the translator entirely and keep their shapes", async () => {
    const { reportRepository } = await import("../../src/config/repositories.js");

    const byStatus = await reportRepository.groupByStatus();
    expect(Array.isArray(byStatus)).toBe(true);
    // M-4: neutral rows — no Prisma envelope reaches the caller.
    if (byStatus.length) {
      expect(byStatus[0]).toHaveProperty("key");
      expect(typeof byStatus[0].count).toBe("number");
      expect(byStatus[0]).not.toHaveProperty("_count");
    }

    const ordered = await reportRepository.groupByPriorityOpenOrdered();
    const plain   = await reportRepository.groupByPriorityOpen();
    const norm = (rows) => rows.map((r) => `${r.key}:${r.count}`).sort();
    expect(norm(plain)).toEqual(norm(ordered));

    const rows = await reportRepository.findDailyTrendRaw(new Date(Date.now() - 7 * 86400000));
    expect(rows.every((r) => Number.isInteger(r.count))).toBe(true);
    expect(rows.map((r) => r._id)).toEqual([...rows.map((r) => r._id)].sort());
  });

  test("M-1 GUARANTEE: Prisma-shaped filters are rejected", async () => {
    const { reportRepository } = await import("../../src/config/repositories.js");
    await expect(reportRepository.count({ reason: { contains: "x" } })).rejects.toThrow(/contains/);
    await expect(reportRepository.count({ OR: [{ status: "pending" }] })).rejects.toThrow(/OR/);
  });
});
