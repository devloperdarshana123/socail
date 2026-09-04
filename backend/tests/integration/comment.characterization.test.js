// Characterization test for the `comment` domain (Milestone 5E —
// transaction reference). Locks down, against a real Postgres, BEFORE any
// refactor:
//   1. commentHelpers.js behavior (create/reply/nesting/delete/pin/visibility/moderation).
//   2. The shared PrismaTransaction abstraction (commit, rollback, and — critically —
//      that it preserves the original error message, which the controller's
//      catch blocks depend on).
//   3. Inline mirrors of the 3 controller-level transactions.
// After the refactor the same assertions are re-expressed against the
// extracted helpers and the config transaction runner.
//
// Note: comment.controller.js has NO edit endpoint and does not touch comment
// like-counts (that lives in the like domain), so "edits"/"like counts" are
// characterized only insofar as they exist — see the report.
import { PrismaClient } from "@prisma/client";
import * as CommentHelper from "../../src/utils/commentHelpers.js";
import { PrismaTransaction } from "../../../shared/database/repositories/transactions/PrismaTransaction.js";
import { transactionRunner } from "../../src/config/transaction.js";

const prisma = new PrismaClient();
const txRunner = new PrismaTransaction(prisma);

let author, viewer, admin, post;
const userIds = [];
const postIds = [];

async function makeUser(role = "user") {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({ data: { fullName: `C ${s}`, email: `c-${s}@e.com`, username: `c_${s}`, role, accountStatus: "active" } });
  userIds.push(u.id);
  return u;
}
async function makePost(authorId) {
  const p = await prisma.post.create({ data: { type: "image", authorId } });
  postIds.push(p.id);
  return p;
}
async function commentsCountOf(postId) {
  return (await prisma.post.findUnique({ where: { id: postId }, select: { commentsCount: true } })).commentsCount;
}

beforeAll(async () => {
  author = await makeUser();
  viewer = await makeUser();
  admin = await makeUser("super_admin");
  post = await makePost(author.id);
});

afterAll(async () => {
  await prisma.comment.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.post.deleteMany({ where: { id: { in: postIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("commentHelpers — creation, nesting, delete, pin, moderation (characterization)", () => {
  test("createComment (top-level) has depth 0 and includes author", async () => {
    const c = await CommentHelper.createComment({ postId: post.id, authorId: viewer.id, content: "top", mentions: [] });
    expect(c.depth).toBe(0);
    expect(c.author.id).toBe(viewer.id);
    expect(c.parentCommentId).toBeNull();
  });

  test("createComment (reply) is depth+1 and increments parent's repliesCount", async () => {
    const parent = await CommentHelper.createComment({ postId: post.id, authorId: viewer.id, content: "parent", mentions: [] });
    const reply = await CommentHelper.createComment({ postId: post.id, authorId: author.id, content: "reply", mentions: [], parentCommentId: parent.id });
    expect(reply.depth).toBe(1);
    expect(reply.parentCommentId).toBe(parent.id);
    const reloadedParent = await prisma.comment.findUnique({ where: { id: parent.id }, select: { repliesCount: true } });
    expect(reloadedParent.repliesCount).toBe(1);
  });

  test("createComment reply to a deleted parent throws 'Parent comment not found'", async () => {
    const parent = await CommentHelper.createComment({ postId: post.id, authorId: viewer.id, content: "willdelete", mentions: [] });
    await prisma.comment.update({ where: { id: parent.id }, data: { isDeleted: true } });
    await expect(
      CommentHelper.createComment({ postId: post.id, authorId: author.id, content: "orphan", mentions: [], parentCommentId: parent.id })
    ).rejects.toThrow("Parent comment not found");
  });

  test("createComment beyond max depth throws 'Maximum comment nesting depth reached'", async () => {
    const base = await CommentHelper.createComment({ postId: post.id, authorId: viewer.id, content: "deep", mentions: [] });
    await prisma.comment.update({ where: { id: base.id }, data: { depth: 5 } });
    await expect(
      CommentHelper.createComment({ postId: post.id, authorId: author.id, content: "toodeep", mentions: [], parentCommentId: base.id })
    ).rejects.toThrow("Maximum comment nesting depth reached");
  });

  test("getTopLevelComments returns active top-level comments, excludes deleted and replies", async () => {
    const p = await makePost(author.id);
    const top = await CommentHelper.createComment({ postId: p.id, authorId: viewer.id, content: "visible top", mentions: [] });
    await CommentHelper.createComment({ postId: p.id, authorId: viewer.id, content: "a reply", mentions: [], parentCommentId: top.id });
    const del = await CommentHelper.createComment({ postId: p.id, authorId: viewer.id, content: "deleted", mentions: [] });
    await prisma.comment.update({ where: { id: del.id }, data: { isDeleted: true } });

    const { comments } = await CommentHelper.getTopLevelComments(p.id, { limit: 50 });
    const ids = comments.map((c) => c.id);
    expect(ids).toContain(top.id);
    expect(ids).not.toContain(del.id);
    expect(comments.every((c) => c.repliesCount !== undefined)).toBe(true);
  });

  test("getPinnedComment returns the pinned comment or null", async () => {
    const p = await makePost(author.id);
    expect(await CommentHelper.getPinnedComment(p.id)).toBeNull();
    const c = await CommentHelper.createComment({ postId: p.id, authorId: viewer.id, content: "pin me", mentions: [] });
    await CommentHelper.pinComment(c.id, p.id);
    const pinned = await CommentHelper.getPinnedComment(p.id);
    expect(pinned.id).toBe(c.id);
  });

  test("softDeleteComment soft-deletes own comment (returns postId), null for non-owner", async () => {
    const c = await CommentHelper.createComment({ postId: post.id, authorId: viewer.id, content: "mine", mentions: [] });
    expect(await CommentHelper.softDeleteComment(c.id, author.id)).toBeNull(); // not owner
    const result = await CommentHelper.softDeleteComment(c.id, viewer.id);
    expect(result.post).toBe(post.id);
    expect((await prisma.comment.findUnique({ where: { id: c.id } })).isDeleted).toBe(true);
  });

  test("hardDeleteComment removes a comment and all descendants; non-admin non-owner deletes nothing", async () => {
    const p = await makePost(author.id);
    const c1 = await CommentHelper.createComment({ postId: p.id, authorId: viewer.id, content: "c1", mentions: [] });
    const c2 = await CommentHelper.createComment({ postId: p.id, authorId: viewer.id, content: "c2", mentions: [], parentCommentId: c1.id });
    await CommentHelper.createComment({ postId: p.id, authorId: viewer.id, content: "c3", mentions: [], parentCommentId: c2.id });

    const noop = await CommentHelper.hardDeleteComment(c1.id, admin.id, false); // non-admin flag, not owner
    expect(noop.deletedCount).toBe(0);

    const result = await CommentHelper.hardDeleteComment(c1.id, admin.id, true);
    expect(result.deletedCount).toBe(3);
    expect(result.postId).toBe(p.id);
    expect(await prisma.comment.count({ where: { id: c1.id } })).toBe(0);
  });

  test("pinComment pins one and unpins others; unpinComment clears all", async () => {
    const p = await makePost(author.id);
    const a = await CommentHelper.createComment({ postId: p.id, authorId: viewer.id, content: "a", mentions: [] });
    const b = await CommentHelper.createComment({ postId: p.id, authorId: viewer.id, content: "b", mentions: [] });
    await CommentHelper.pinComment(a.id, p.id);
    await CommentHelper.pinComment(b.id, p.id); // should unpin a
    expect((await prisma.comment.findUnique({ where: { id: a.id } })).isPinned).toBe(false);
    expect((await prisma.comment.findUnique({ where: { id: b.id } })).isPinned).toBe(true);
    await CommentHelper.unpinComment(p.id);
    expect((await prisma.comment.findUnique({ where: { id: b.id } })).isPinned).toBe(false);
  });
});

describe("shared PrismaTransaction abstraction — semantics (validated pre-wiring)", () => {
  test("run() commits successful work", async () => {
    const p = await makePost(author.id);
    const before = await commentsCountOf(p.id);
    const result = await txRunner.run(async (tx) => {
      return tx.post.update({ where: { id: p.id }, data: { commentsCount: { increment: 1 } }, select: { commentsCount: true } });
    });
    expect(result.commentsCount).toBe(before + 1);
    expect(await commentsCountOf(p.id)).toBe(before + 1);
  });

  test("run() rolls back all work when the callback throws", async () => {
    const p = await makePost(author.id);
    const before = await commentsCountOf(p.id);
    await expect(
      txRunner.run(async (tx) => {
        await tx.post.update({ where: { id: p.id }, data: { commentsCount: { increment: 5 } } });
        throw new Error("boom");
      })
    ).rejects.toThrow();
    expect(await commentsCountOf(p.id)).toBe(before); // rolled back
  });

  test("run() preserves the original error MESSAGE (controller catch depends on this)", async () => {
    await expect(
      txRunner.run(async () => {
        throw new Error("Maximum comment nesting depth reached");
      })
    ).rejects.toThrow(/depth/);
    await expect(
      txRunner.run(async () => {
        throw new Error("Parent comment not found or has been deleted");
      })
    ).rejects.toThrow(/Parent comment not found/);
  });
});

describe("controller-level transactions — inline mirror (baseline)", () => {
  test("addComment T1 mirror: create comment + increment commentsCount", async () => {
    const p = await makePost(author.id);
    const before = await commentsCountOf(p.id);
    const { comment, updatedPost } = await prisma.$transaction(async (tx) => {
      const newComment = await CommentHelper.createComment({ postId: p.id, authorId: viewer.id, content: "tx", mentions: [] });
      const updated = await tx.post.update({ where: { id: p.id }, data: { commentsCount: { increment: 1 } }, select: { commentsCount: true } });
      return { comment: newComment, updatedPost: updated };
    });
    expect(comment.id).toBeTruthy();
    expect(updatedPost.commentsCount).toBe(before + 1);
  });

  test("deleteComment T3 mirror: soft delete + decrement commentsCount", async () => {
    const p = await makePost(author.id);
    const c = await CommentHelper.createComment({ postId: p.id, authorId: viewer.id, content: "todelete", mentions: [] });
    await prisma.post.update({ where: { id: p.id }, data: { commentsCount: { increment: 1 } } });
    const before = await commentsCountOf(p.id);
    await prisma.$transaction(async (tx) => {
      const comment = await CommentHelper.softDeleteComment(c.id, viewer.id);
      if (!comment) throw new Error("Comment not found or unauthorized");
      await tx.post.update({ where: { id: comment.postId ?? comment.post }, data: { commentsCount: { decrement: 1 } } });
    });
    expect(await commentsCountOf(p.id)).toBe(before - 1);
  });
});

// After extraction: the guard helpers, the tx-count helpers, and the actual
// config transactionRunner the controller now uses must all match behavior.
describe("commentHelpers — extracted guards & tx-count helpers", () => {
  test("getPostForCommentGuard / getPostExistence return the selected shapes, null for missing", async () => {
    const g = await CommentHelper.getPostForCommentGuard(post.id);
    expect(Object.keys(g).sort()).toEqual(["authorId", "commentsDisabled", "id", "isDeleted"].sort());
    const e = await CommentHelper.getPostExistence(post.id);
    expect(Object.keys(e).sort()).toEqual(["id", "isDeleted"].sort());
    expect(await CommentHelper.getPostForCommentGuard("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  test("getCommentExistence / getCommentForPin / getPostForPin selected shapes, null for missing", async () => {
    const c = await CommentHelper.createComment({ postId: post.id, authorId: viewer.id, content: "shape", mentions: [] });
    expect(Object.keys(await CommentHelper.getCommentExistence(c.id)).sort()).toEqual(["id", "isDeleted"].sort());
    expect(Object.keys(await CommentHelper.getCommentForPin(c.id)).sort()).toEqual(["id", "isDeleted", "postId"].sort());
    expect(Object.keys(await CommentHelper.getPostForPin(post.id)).sort()).toEqual(["authorId", "id", "isDeleted"].sort());
    expect(await CommentHelper.getCommentExistence("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  test("incrementPostCommentsCount / decrementPostCommentsCount operate via the given client", async () => {
    const p = await makePost(author.id);
    const inc = await CommentHelper.incrementPostCommentsCount(prisma, p.id);
    expect(inc.commentsCount).toBe(1);
    await CommentHelper.decrementPostCommentsCount(prisma, p.id, 1);
    expect(await commentsCountOf(p.id)).toBe(0);
  });
});

describe("config transactionRunner — the runner the controller now uses", () => {
  test("addComment flow through runner: createComment + increment commits atomically", async () => {
    const p = await makePost(author.id);
    const before = await commentsCountOf(p.id);
    const { comment, updatedPost } = await transactionRunner.run(async (tx) => {
      const newComment = await CommentHelper.createComment({ postId: p.id, authorId: viewer.id, content: "via runner", mentions: [] });
      const updated = await CommentHelper.incrementPostCommentsCount(tx, p.id);
      return { comment: newComment, updatedPost: updated };
    });
    expect(comment.id).toBeTruthy();
    expect(updatedPost.commentsCount).toBe(before + 1);
    expect(await commentsCountOf(p.id)).toBe(before + 1);
  });

  test("runner rolls back the tx.post.update when the callback throws after it", async () => {
    const p = await makePost(author.id);
    const before = await commentsCountOf(p.id);
    await expect(
      transactionRunner.run(async (tx) => {
        await CommentHelper.decrementPostCommentsCount(tx, p.id, 1);
        throw new Error("Comment not found or unauthorized");
      })
    ).rejects.toThrow(/unauthorized/); // message preserved through TransactionError
    expect(await commentsCountOf(p.id)).toBe(before); // rolled back
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 7A additions — coverage the Milestone 5E suite above never had.
// getReplies and getDirectReplies were entirely untested, as was cursor
// pagination on all three list methods, content truncation, and the exact
// list projections.
//
// Written and run GREEN against the original direct-Prisma implementation
// BEFORE the repository migration, so they are a true before/after net.
// ─────────────────────────────────────────────────────────────────────────

const MISSING = "00000000-0000-0000-0000-000000000000";
const CAUTHOR_KEYS = ["avatar", "fullName", "id", "isVerifiedBadge", "username"];

async function makeComment(postId, authorId, extra = {}) {
  return prisma.comment.create({
    data: { postId, authorId, content: "c", ...extra },
  });
}

describe("commentHelpers — creation details (Phase 7A)", () => {
  test("content is trimmed and truncated to 1000 characters", async () => {
    const p = await makePost(author.id);
    const long = await CommentHelper.createComment({
      postId: p.id,
      authorId: author.id,
      content: `  ${"x".repeat(1200)}  `,
    });
    expect(long.content.length).toBe(1000);
    expect(long.content.startsWith(" ")).toBe(false); // trimmed before slicing
  });

  test("mentions default to an empty array and are persisted when supplied", async () => {
    const p = await makePost(author.id);
    const none = await CommentHelper.createComment({
      postId: p.id, authorId: author.id, content: "no mentions",
    });
    expect(none.mentions).toEqual([]);

    const withMentions = await CommentHelper.createComment({
      postId: p.id, authorId: author.id, content: "hi", mentions: [viewer.id],
    });
    expect(withMentions.mentions).toEqual([viewer.id]);

    // an explicitly null mentions list still lands as []
    const nulled = await CommentHelper.createComment({
      postId: p.id, authorId: author.id, content: "hi", mentions: null,
    });
    expect(nulled.mentions).toEqual([]);
  });

  test("a new comment is never pinned and carries the author projection", async () => {
    const p = await makePost(author.id);
    const c = await CommentHelper.createComment({
      postId: p.id, authorId: author.id, content: "fresh",
    });
    expect(c.isPinned).toBe(false);
    expect(c.depth).toBe(0);
    expect(c.parentCommentId).toBeNull();
    expect(Object.keys(c.author).sort()).toEqual(CAUTHOR_KEYS.slice().sort());
  });

  test("a reply to a missing parent throws before creating anything", async () => {
    const p = await makePost(author.id);
    const before = await prisma.comment.count({ where: { postId: p.id } });
    await expect(
      CommentHelper.createComment({
        postId: p.id, authorId: author.id, content: "orphan", parentCommentId: MISSING,
      })
    ).rejects.toThrow(/Parent comment not found/);
    expect(await prisma.comment.count({ where: { postId: p.id } })).toBe(before);
  });
});

describe("commentHelpers — list projections & pagination (Phase 7A)", () => {
  test("getTopLevelComments projects exactly the list shape and paginates by cursor", async () => {
    const p = await makePost(author.id);
    const made = [];
    for (let i = 0; i < 3; i++) {
      made.push(await CommentHelper.createComment({
        postId: p.id, authorId: author.id, content: `top-${i}`,
      }));
      await new Promise((r) => setTimeout(r, 5));
    }

    const page1 = await CommentHelper.getTopLevelComments(p.id, { limit: 2 });
    expect(page1.comments.length).toBe(2);
    expect(page1.comments.map((c) => c.content)).toEqual(["top-2", "top-1"]); // newest first
    expect(page1.nextCursor).toEqual({
      afterId: page1.comments[1].id,
      afterDate: page1.comments[1].createdAt.toISOString(),
    });

    expect(Object.keys(page1.comments[0]).sort()).toEqual(
      ["id", "content", "mentions", "createdAt", "updatedAt", "repliesCount", "author"].sort()
    );
    expect(Object.keys(page1.comments[0].author).sort()).toEqual(CAUTHOR_KEYS.slice().sort());
    expect(page1.comments[0].isDeleted).toBeUndefined(); // not projected

    const page2 = await CommentHelper.getTopLevelComments(p.id, { limit: 2, ...page1.nextCursor });
    expect(page2.comments.map((c) => c.content)).toEqual(["top-0"]);
    expect(page2.nextCursor).toBeNull();

    // no overlap across the two pages
    const ids = [...page1.comments, ...page2.comments].map((c) => c.id);
    expect(new Set(ids).size).toBe(3);
  });

  test("getTopLevelComments excludes replies, deleted and non-active comments", async () => {
    const p = await makePost(author.id);
    const top = await CommentHelper.createComment({ postId: p.id, authorId: author.id, content: "keep" });
    await CommentHelper.createComment({
      postId: p.id, authorId: author.id, content: "reply", parentCommentId: top.id,
    });
    await makeComment(p.id, author.id, { content: "deleted", isDeleted: true });
    await makeComment(p.id, author.id, { content: "removed", status: "removed" });

    const { comments } = await CommentHelper.getTopLevelComments(p.id, { limit: 50 });
    expect(comments.map((c) => c.content)).toEqual(["keep"]);
  });

  test("getDirectReplies returns only immediate children, newest first", async () => {
    const p = await makePost(author.id);
    const root = await CommentHelper.createComment({ postId: p.id, authorId: author.id, content: "root" });
    const child1 = await CommentHelper.createComment({
      postId: p.id, authorId: author.id, content: "child-1", parentCommentId: root.id,
    });
    await new Promise((r) => setTimeout(r, 5));
    const child2 = await CommentHelper.createComment({
      postId: p.id, authorId: author.id, content: "child-2", parentCommentId: root.id,
    });
    // a grandchild must NOT appear
    await CommentHelper.createComment({
      postId: p.id, authorId: author.id, content: "grandchild", parentCommentId: child1.id,
    });

    const { replies, nextCursor } = await CommentHelper.getDirectReplies(root.id, { limit: 50 });
    expect(replies.map((r) => r.content)).toEqual(["child-2", "child-1"]);
    expect(nextCursor).toBeNull();

    expect(Object.keys(replies[0]).sort()).toEqual(
      ["id", "content", "mentions", "createdAt", "updatedAt", "repliesCount", "author"].sort()
    );
  });

  test("getDirectReplies paginates by cursor", async () => {
    const p = await makePost(author.id);
    const root = await CommentHelper.createComment({ postId: p.id, authorId: author.id, content: "root" });
    for (let i = 0; i < 3; i++) {
      await CommentHelper.createComment({
        postId: p.id, authorId: author.id, content: `r-${i}`, parentCommentId: root.id,
      });
      await new Promise((r) => setTimeout(r, 5));
    }

    const page1 = await CommentHelper.getDirectReplies(root.id, { limit: 2 });
    expect(page1.replies.map((r) => r.content)).toEqual(["r-2", "r-1"]);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await CommentHelper.getDirectReplies(root.id, { limit: 2, ...page1.nextCursor });
    expect(page2.replies.map((r) => r.content)).toEqual(["r-0"]);
    expect(page2.nextCursor).toBeNull();
  });

  test("getReplies returns children AND grandchildren, with depth and parent id", async () => {
    // PRESERVED BEHAVIOR: getReplies matches direct children plus children of
    // those children — i.e. two levels, not the full descendant tree.
    const p = await makePost(author.id);
    const root = await CommentHelper.createComment({ postId: p.id, authorId: author.id, content: "root" });
    const child = await CommentHelper.createComment({
      postId: p.id, authorId: author.id, content: "child", parentCommentId: root.id,
    });
    const grandchild = await CommentHelper.createComment({
      postId: p.id, authorId: author.id, content: "grandchild", parentCommentId: child.id,
    });
    const greatGrandchild = await CommentHelper.createComment({
      postId: p.id, authorId: author.id, content: "great", parentCommentId: grandchild.id,
    });

    const { replies } = await CommentHelper.getReplies(root.id, { limit: 50 });
    const contents = replies.map((r) => r.content);
    expect(contents).toContain("child");
    expect(contents).toContain("grandchild");
    expect(contents).not.toContain("great"); // three levels down is out of scope

    // this list projects depth + parentCommentId, unlike the other two
    expect(Object.keys(replies[0]).sort()).toEqual(
      ["id", "parentCommentId", "content", "mentions", "depth", "createdAt", "updatedAt", "repliesCount", "author"].sort()
    );
  });

  test("getReplies puts pinned replies first and excludes deleted/removed", async () => {
    const p = await makePost(author.id);
    const root = await CommentHelper.createComment({ postId: p.id, authorId: author.id, content: "root" });
    await CommentHelper.createComment({
      postId: p.id, authorId: author.id, content: "plain", parentCommentId: root.id,
    });
    await new Promise((r) => setTimeout(r, 5));
    const pinned = await CommentHelper.createComment({
      postId: p.id, authorId: author.id, content: "pinned", parentCommentId: root.id,
    });
    await prisma.comment.update({ where: { id: pinned.id }, data: { isPinned: true } });
    await makeComment(p.id, author.id, { content: "gone", parentCommentId: root.id, isDeleted: true });

    const { replies } = await CommentHelper.getReplies(root.id, { limit: 50 });
    expect(replies[0].content).toBe("pinned"); // isPinned desc leads the ordering
    expect(replies.map((r) => r.content)).not.toContain("gone");
  });

  test("getReplies returns an empty list for a comment with no replies", async () => {
    const p = await makePost(author.id);
    const lonely = await CommentHelper.createComment({
      postId: p.id, authorId: author.id, content: "lonely",
    });
    const { replies, nextCursor } = await CommentHelper.getReplies(lonely.id, { limit: 50 });
    expect(replies).toEqual([]);
    expect(nextCursor).toBeNull();
  });
});

describe("commentHelpers — deletion & pinning details (Phase 7A)", () => {
  test("hardDeleteComment removes a deep descendant chain in one call", async () => {
    const p = await makePost(author.id);
    const root = await CommentHelper.createComment({ postId: p.id, authorId: author.id, content: "root" });
    let parent = root;
    for (let i = 0; i < 4; i++) {
      parent = await CommentHelper.createComment({
        postId: p.id, authorId: author.id, content: `lvl-${i}`, parentCommentId: parent.id,
      });
    }

    const result = await CommentHelper.hardDeleteComment(root.id, author.id);
    expect(result.deletedCount).toBe(5); // root + 4 descendants
    expect(result.postId).toBe(p.id);
    expect(await prisma.comment.count({ where: { postId: p.id } })).toBe(0);
  });

  test("hardDeleteComment as admin deletes another user's comment", async () => {
    const p = await makePost(author.id);
    const c = await CommentHelper.createComment({ postId: p.id, authorId: viewer.id, content: "theirs" });

    const denied = await CommentHelper.hardDeleteComment(c.id, author.id, false);
    expect(denied).toEqual({ deletedCount: 0, postId: null });

    const allowed = await CommentHelper.hardDeleteComment(c.id, admin.id, true);
    expect(allowed.deletedCount).toBe(1);
  });

  test("hardDeleteComment on a missing comment reports nothing deleted", async () => {
    expect(await CommentHelper.hardDeleteComment(MISSING, author.id, true)).toEqual({
      deletedCount: 0,
      postId: null,
    });
  });

  test("softDeleteComment is idempotent-null and returns the post id", async () => {
    const p = await makePost(author.id);
    const c = await CommentHelper.createComment({ postId: p.id, authorId: author.id, content: "bye" });

    const first = await CommentHelper.softDeleteComment(c.id, author.id);
    expect(first.post).toBe(p.id);
    expect(first.isDeleted).toBe(true);

    expect(await CommentHelper.softDeleteComment(c.id, author.id)).toBeNull(); // already deleted
    expect(await CommentHelper.softDeleteComment(MISSING, author.id)).toBeNull();
  });

  test("pinComment moves the pin between comments on the same post only", async () => {
    const p1 = await makePost(author.id);
    const p2 = await makePost(author.id);
    const a = await CommentHelper.createComment({ postId: p1.id, authorId: author.id, content: "a" });
    const b = await CommentHelper.createComment({ postId: p1.id, authorId: author.id, content: "b" });
    const other = await CommentHelper.createComment({ postId: p2.id, authorId: author.id, content: "other" });
    await CommentHelper.pinComment(other.id, p2.id);

    await CommentHelper.pinComment(a.id, p1.id);
    await CommentHelper.pinComment(b.id, p1.id); // moves the pin

    expect((await prisma.comment.findUnique({ where: { id: a.id } })).isPinned).toBe(false);
    expect((await prisma.comment.findUnique({ where: { id: b.id } })).isPinned).toBe(true);
    // the other post's pin is untouched
    expect((await prisma.comment.findUnique({ where: { id: other.id } })).isPinned).toBe(true);
  });

  test("getPinnedComment ignores a pinned-but-deleted or non-active comment", async () => {
    const p = await makePost(author.id);
    const c = await CommentHelper.createComment({ postId: p.id, authorId: author.id, content: "pinme" });
    await CommentHelper.pinComment(c.id, p.id);
    expect((await CommentHelper.getPinnedComment(p.id)).id).toBe(c.id);

    await prisma.comment.update({ where: { id: c.id }, data: { status: "removed" } });
    expect(await CommentHelper.getPinnedComment(p.id)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// TRANSACTION-OWNERSHIP INCONSISTENCY (Phase 7A Milestone 10)
//
// This domain's transactions are opened by the CONTROLLER, not the helper.
// comment.controller.js wraps its addComment flow in transactionRunner.run()
// and then calls, inside that callback:
//
//     CommentHelper.createComment({ ... })             // NO tx  → global client
//     CommentHelper.incrementPostCommentsCount(tx, …)  // tx     → in transaction
//
// So the comment INSERT is not actually covered by the transaction that
// appears to wrap it. Phase 6I documented this; Phase 7A preserves it
// exactly rather than redesigning transaction ownership.
//
// These tests pin the real semantics so the gap is executable knowledge and
// a future fix is a deliberate, visible change rather than an accident.
// ─────────────────────────────────────────────────────────────────────────
describe("commentHelpers — controller-owned transaction gap (Phase 7A)", () => {
  test("createComment does NOT enrol in the caller's transaction — the row survives a rollback", async () => {
    const p = await makePost(author.id);
    const before = await commentsCountOf(p.id);
    const commentsBefore = await prisma.comment.count({ where: { postId: p.id } });

    await expect(
      transactionRunner.run(async (tx) => {
        // exactly what the controller does
        await CommentHelper.createComment({
          postId: p.id, authorId: author.id, content: "orphaned by rollback",
        });
        await CommentHelper.incrementPostCommentsCount(tx, p.id);
        throw new Error("boom");
      })
    ).rejects.toThrow(/boom/);

    // the count update WAS rolled back...
    expect(await commentsCountOf(p.id)).toBe(before);
    // ...but the comment row was NOT, because it never joined the transaction
    expect(await prisma.comment.count({ where: { postId: p.id } })).toBe(commentsBefore + 1);
  });

  test("the count helpers DO enrol when given the tx — both roll back together", async () => {
    const p = await makePost(author.id);
    await CommentHelper.incrementPostCommentsCount(prisma, p.id); // seed a count
    const before = await commentsCountOf(p.id);

    await expect(
      transactionRunner.run(async (tx) => {
        await CommentHelper.incrementPostCommentsCount(tx, p.id);
        await CommentHelper.decrementPostCommentsCount(tx, p.id, 1);
        throw new Error("rollback both");
      })
    ).rejects.toThrow(/rollback both/);

    expect(await commentsCountOf(p.id)).toBe(before);
  });

  test("the count helpers keep their `client`-first signature the controller relies on", async () => {
    // The controller passes tx POSITIONALLY as the first argument. Changing
    // this signature would silently break every call site.
    const p = await makePost(author.id);
    const before = await commentsCountOf(p.id);

    // called with the global client (no transaction) — still works
    const inc = await CommentHelper.incrementPostCommentsCount(prisma, p.id);
    expect(inc).toEqual({ commentsCount: before + 1 }); // narrow projection preserved

    // and inside a transaction
    await transactionRunner.run(async (tx) => {
      await CommentHelper.decrementPostCommentsCount(tx, p.id, 1);
    });
    expect(await commentsCountOf(p.id)).toBe(before);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 7B / M-1, Batch 2 — the keyset cursor is the densest logical filter
// in the application: an `or` of (strictly older) / (same instant, lower id),
// and in getReplies that whole disjunction nested inside an `and`. If the
// neutral translation of or/and/eq/lt were even slightly off, pagination
// would silently skip or duplicate rows rather than fail — so this compares
// the helper against the literal Prisma keyset it replaced.
describe("M-1 — neutral keyset cursor equivalence (Phase 7B)", () => {
  test("getTopLevelComments: neutral or/eq/lt yields the same page as the Prisma keyset", async () => {
    const p = await makePost(author.id);
    for (let i = 0; i < 5; i++) {
      await CommentHelper.createComment({ postId: p.id, authorId: author.id, content: `kt-${i}` });
      await new Promise((r) => setTimeout(r, 5));
    }

    const page1 = await CommentHelper.getTopLevelComments(p.id, { limit: 2 });
    const { afterId, afterDate } = page1.nextCursor;

    // The exact Prisma where this helper built before M-1.
    const inline = await prisma.comment.findMany({
      where: {
        postId: p.id, parentCommentId: null, isDeleted: false, status: "active",
        OR: [
          { createdAt: { lt: new Date(afterDate) } },
          { createdAt: { equals: new Date(afterDate) }, id: { lt: afterId } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 3,
      select: { id: true },
    });

    const page2 = await CommentHelper.getTopLevelComments(p.id, { limit: 2, afterId, afterDate });
    expect(page2.comments.map((c) => c.id)).toEqual(inline.slice(0, 2).map((c) => c.id));

    // No row is skipped or repeated across the full walk.
    const walked = [];
    let cursor = null;
    for (let guard = 0; guard < 10; guard++) {
      const page = await CommentHelper.getTopLevelComments(p.id, { limit: 2, ...(cursor ?? {}) });
      walked.push(...page.comments.map((c) => c.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(new Set(walked).size).toBe(walked.length);
    expect(walked.length).toBe(5);
  });

  test("getReplies: the `and`-wrapped `or` keyset matches its Prisma original", async () => {
    const p = await makePost(author.id);
    const root = await CommentHelper.createComment({ postId: p.id, authorId: author.id, content: "kr-root" });
    for (let i = 0; i < 4; i++) {
      await CommentHelper.createComment({
        postId: p.id, authorId: author.id, content: `kr-${i}`, parentCommentId: root.id,
      });
      await new Promise((r) => setTimeout(r, 5));
    }

    const page1 = await CommentHelper.getReplies(root.id, { limit: 2 });
    expect(page1.nextCursor).not.toBeNull();
    const { afterId, afterDate } = page1.nextCursor;

    const childIds = (await prisma.comment.findMany({
      where: { parentCommentId: root.id }, select: { id: true },
    })).map((c) => c.id);

    const inline = await prisma.comment.findMany({
      where: {
        OR: [{ parentCommentId: root.id }, { parentCommentId: { in: childIds } }],
        isDeleted: false, status: "active",
        AND: [{
          OR: [
            { createdAt: { lt: new Date(afterDate) } },
            { createdAt: { equals: new Date(afterDate) }, id: { lt: afterId } },
          ],
        }],
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: 3,
      select: { id: true },
    });

    const page2 = await CommentHelper.getReplies(root.id, { limit: 2, afterId, afterDate });
    expect(page2.replies.map((r) => r.id)).toEqual(inline.slice(0, 2).map((c) => c.id));
  });

  test("soft-delete scoping composes with translation, in both directions", async () => {
    // withNotDeleted() merges `{ isDeleted: false }` into the filter BEFORE
    // translation — a bare equality that is valid in the neutral DSL and in
    // Prisma alike. Order matters: compose neutral, then translate once. If
    // that order were reversed the scoping clause would bypass the whitelist.
    const { commentRepository } = await import("../../src/config/repositories.js");
    const p = await makePost(author.id);
    const live = await CommentHelper.createComment({ postId: p.id, authorId: author.id, content: "sd-live" });
    const gone = await CommentHelper.createComment({ postId: p.id, authorId: author.id, content: "sd-gone" });
    await prisma.comment.update({ where: { id: gone.id }, data: { isDeleted: true } });

    // default: repository adds isDeleted:false on top of a NEUTRAL filter
    expect(await commentRepository.count({ postId: p.id, id: { in: [live.id, gone.id] } })).toBe(1);
    // opt out: the caller's filter stays authoritative
    expect(await commentRepository.count(
      { postId: p.id, id: { in: [live.id, gone.id] } }, { includeDeleted: true },
    )).toBe(2);
    // and both agree with the raw client
    expect(await commentRepository.count({ postId: p.id, id: { in: [live.id, gone.id] } }))
      .toBe(await prisma.comment.count({
        where: { postId: p.id, id: { in: [live.id, gone.id] }, isDeleted: false },
      }));
  });

  test("M-1 GUARANTEE: a Prisma-shaped filter is rejected by the comment repository", async () => {
    const { commentRepository } = await import("../../src/config/repositories.js");
    await expect(commentRepository.count({ OR: [{ postId: post.id }] })).rejects.toThrow(/OR/);
    await expect(commentRepository.count({ createdAt: { equals: new Date() } }))
      .rejects.toThrow(/equals/);
  });
});
