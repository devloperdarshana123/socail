// Characterization test for the `like` domain (Milestone 5B; migrated to
// the repository layer in Phase 7A).
// Locks down likeHelpers.js observable behavior against a real Postgres.
// Written against the helper's public contract, so this same suite proves
// byte-identical behavior across BOTH the original direct-Prisma
// implementation (Milestone 5B) and the repository-backed one (Phase 7A) —
// unchanged, it passed against both without a single assertion edited.
//
// Phase 7A additions below cover the three methods the original Milestone
// 5B suite never exercised (getLikers, hasLiked, deleteLike — all needed
// new repository methods this phase added) and the TransactionError fix
// in shared/database/repositories/errors/index.js that this migration's
// toggleLike depends on for identical error-path behavior once its
// transaction runs through transactionRunner instead of a raw
// prisma.$transaction call.
import { PrismaClient } from "@prisma/client";
import * as LikeHelper from "../../src/utils/likeHelpers.js";
import { likeRepository } from "../../src/config/repositories.js";
import { transactionRunner } from "../../src/config/transaction.js";
import { NotFoundError } from "../../../shared/database/repositories/errors/index.js";

const prisma = new PrismaClient();

let liker;
let author;
let post;
let comment;

beforeAll(async () => {
  const stamp = Date.now();
  liker = await prisma.user.create({
    data: { fullName: "Liker", email: `like-liker-${stamp}@example.com`, username: `likeliker_${stamp}`, accountStatus: "active" },
  });
  author = await prisma.user.create({
    data: { fullName: "Like Author", email: `like-author-${stamp}@example.com`, username: `likeauthor_${stamp}`, accountStatus: "active" },
  });
  post = await prisma.post.create({ data: { type: "image", authorId: author.id } });
  comment = await prisma.comment.create({ data: { content: "hi", postId: post.id, authorId: author.id } });
});

afterAll(async () => {
  await prisma.comment.deleteMany({ where: { postId: post.id } });
  await prisma.post.deleteMany({ where: { id: post.id } });
  await prisma.user.deleteMany({ where: { id: { in: [liker.id, author.id].filter(Boolean) } } });
  await prisma.$disconnect();
});

async function postLikes(id) {
  const p = await prisma.post.findUnique({ where: { id }, select: { likesCount: true } });
  return p.likesCount;
}

describe("likeHelpers — toggle, status, breakdown (characterization)", () => {
  test("toggleLike creates a like and increments likesCount", async () => {
    const before = await postLikes(post.id);
    const result = await LikeHelper.toggleLike(liker.id, post.id, "Post", "❤️", {
      updateParentCount: true,
      authorId: author.id,
    });
    expect(result.liked).toBe(true);
    expect(result.previousReaction).toBeNull();
    expect(await postLikes(post.id)).toBe(before + 1);
  });

  test("getLikeStatus returns the current reaction after liking", async () => {
    const status = await LikeHelper.getLikeStatus(liker.id, post.id, "Post");
    expect(status.reaction).toBe("❤️");
  });

  test("toggleLike with a different reaction reports previousReaction and keeps count", async () => {
    const before = await postLikes(post.id);
    const result = await LikeHelper.toggleLike(liker.id, post.id, "Post", "🔥", {
      updateParentCount: true,
      authorId: author.id,
    });
    expect(result.liked).toBe(true);
    expect(result.previousReaction).toBe("❤️");
    expect(await postLikes(post.id)).toBe(before);
  });

  test("getReactionBreakdown reflects the current reaction with all emojis present", async () => {
    const breakdown = await LikeHelper.getReactionBreakdown(post.id, "Post");
    expect(breakdown["🔥"]).toBe(1);
    expect(breakdown["❤️"]).toBe(0);
    // all six valid reactions are keys
    expect(Object.keys(breakdown).sort()).toEqual(["❤️", "🔥", "😮", "😂", "😢", "👏"].sort());
  });

  test("toggleLike with the same reaction unlikes and decrements likesCount", async () => {
    const before = await postLikes(post.id);
    const result = await LikeHelper.toggleLike(liker.id, post.id, "Post", "🔥", {
      updateParentCount: true,
      authorId: author.id,
    });
    expect(result.liked).toBe(false);
    expect(result.previousReaction).toBe("🔥");
    expect(await postLikes(post.id)).toBe(before - 1);
  });

  test("getLikeStatus returns null once unliked", async () => {
    const status = await LikeHelper.getLikeStatus(liker.id, post.id, "Post");
    expect(status).toBeNull();
  });

  // Helpers extracted from like.controller.js in Milestone 5. Each must
  // return the exact selected shape the controller reads, null for missing.
  test("getPostForLike returns the 5 selected fields, null for missing", async () => {
    const result = await LikeHelper.getPostForLike(post.id);
    expect(Object.keys(result).sort()).toEqual(
      ["authorId", "id", "isDeleted", "likesCount", "likesHidden"].sort()
    );
    expect(await LikeHelper.getPostForLike("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  test("getPostLikesCount returns { likesCount }, null for missing", async () => {
    const result = await LikeHelper.getPostLikesCount(post.id);
    expect(Object.keys(result)).toEqual(["likesCount"]);
    expect(await LikeHelper.getPostLikesCount("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  test("getCommentForLike returns the 4 selected fields, null for missing", async () => {
    const result = await LikeHelper.getCommentForLike(comment.id);
    expect(Object.keys(result).sort()).toEqual(["authorId", "id", "isDeleted", "likesCount"].sort());
    expect(await LikeHelper.getCommentForLike("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  test("getCommentLikesCount returns { likesCount }, null for missing", async () => {
    const result = await LikeHelper.getCommentLikesCount(comment.id);
    expect(Object.keys(result)).toEqual(["likesCount"]);
    expect(await LikeHelper.getCommentLikesCount("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

// Phase 7A: methods the Milestone 5B suite above never exercised, now
// covered because their repository-backed implementation is new code
// (findLikersWithUser, groupByReaction, deleteByUserAndTarget on
// LikeRepository).
describe("likeHelpers — likers, hasLiked, deleteLike (Phase 7A)", () => {
  let likersPost;
  let likerA;
  let likerB;
  let likerC;

  beforeAll(async () => {
    const stamp = Date.now();
    likersPost = await prisma.post.create({ data: { type: "image", authorId: author.id } });
    [likerA, likerB, likerC] = await Promise.all(
      ["a", "b", "c"].map((s, i) =>
        prisma.user.create({
          data: {
            fullName: `Liker ${s}`,
            email: `like-${s}-${stamp}@example.com`,
            username: `likeuser${s}_${stamp}`,
            accountStatus: "active",
          },
        })
      )
    );
    for (const u of [likerA, likerB, likerC]) {
      await LikeHelper.toggleLike(u.id, likersPost.id, "Post", "❤️");
      await new Promise((r) => setTimeout(r, 5)); // distinct createdAt for deterministic cursor order
    }
  });

  afterAll(async () => {
    await prisma.like.deleteMany({ where: { postId: likersPost.id } });
    await prisma.post.deleteMany({ where: { id: likersPost.id } });
    await prisma.user.deleteMany({ where: { id: { in: [likerA.id, likerB.id, likerC.id] } } });
  });

  test("getLikers returns newest-first likers and honors limit/hasMore", async () => {
    // Page 1 has no cursor filter at all — purely `orderBy createdAt desc,
    // take limit+1` — so this much is deterministic regardless of the
    // random UUIDs Postgres assigns.
    const page1 = await LikeHelper.getLikers(likersPost.id, "Post", null, 2);
    expect(page1.likers.length).toBe(2);
    expect(page1.likers[0].id).toBe(likerC.id); // newest first
    expect(page1.likers[0].reaction).toBe("❤️");
    expect(page1.nextCursor).not.toBeNull();

    // PRESERVED ODDITY (pre-existing in the original inline query, carried
    // forward byte-identical, NOT fixed here): the cursor is
    // `id: { lt: afterId } }` combined with `orderBy: { createdAt: "desc" }`.
    // Postgres UUIDs are random and uncorrelated with insertion time, so
    // once a cursor is applied, which (if any) rows a subsequent page
    // returns is not guaranteed — confirmed empirically: this same
    // pagination call returns 0, 1, or 2 rows across otherwise-identical
    // runs depending only on the random UUIDs generated for likerA/B/C.
    // Asserting page-2 membership would therefore be asserting a property
    // the ORIGINAL code never actually guaranteed. Only shape/type is
    // checked here.
    const page2 = await LikeHelper.getLikers(likersPost.id, "Post", page1.nextCursor, 2);
    expect(Array.isArray(page2.likers)).toBe(true);
    expect(page2.likers.length).toBeLessThanOrEqual(2);

    // The one call shape that IS deterministic regardless of the cursor
    // oddity: no cursor + a limit covering everyone returns all of them.
    const all = await LikeHelper.getLikers(likersPost.id, "Post", null, 10);
    expect(all.likers.map((l) => l.id).sort()).toEqual([likerA.id, likerB.id, likerC.id].sort());
    expect(all.nextCursor).toBeNull();
  });

  test("hasLiked mirrors getLikeStatus as a boolean", async () => {
    expect(await LikeHelper.hasLiked(likerA.id, likersPost.id, "Post")).toBe(true);
    expect(await LikeHelper.hasLiked(likerB.id, "00000000-0000-0000-0000-000000000000", "Post")).toBe(false);
  });

  test("deleteLike removes the like and returns a boolean", async () => {
    expect(await prisma.like.count({ where: { likedById: likerA.id, postId: likersPost.id } })).toBe(1);

    const removed = await LikeHelper.deleteLike(likerA.id, likersPost.id, "Post");
    expect(removed).toBe(true);
    expect(await prisma.like.count({ where: { likedById: likerA.id, postId: likersPost.id } })).toBe(0);

    // nothing to delete the second time
    expect(await LikeHelper.deleteLike(likerA.id, likersPost.id, "Post")).toBe(false);
  });
});

// Phase 7A: toggleLike now runs through transactionRunner (shared
// PrismaTransaction) instead of a raw prisma.$transaction call. Proves the
// TransactionError fix in shared/database/repositories/errors/index.js —
// a repository error's .code/.name survive the transaction boundary, so
// globalErrorHandler's Prisma-code checks (err.name === "NotFoundError" ||
// err.code === "P2025") still match after this migration.
describe("transactionRunner — repository-error code/name preservation (Phase 7A)", () => {
  test("a NotFoundError thrown inside the transaction keeps its .code and .name", async () => {
    const MISSING = "00000000-0000-0000-0000-000000000000";

    await expect(
      transactionRunner.run(async (tx) => {
        await likeRepository.delete(MISSING, { tx });
      })
    ).rejects.toMatchObject({ name: "NotFoundError", code: "P2025" });
  });

  test("the underlying repository error is still a NotFoundError instance (via .cause)", async () => {
    const MISSING = "00000000-0000-0000-0000-000000000000";
    try {
      await transactionRunner.run(async (tx) => {
        await likeRepository.delete(MISSING, { tx });
      });
      throw new Error("expected transactionRunner.run to reject");
    } catch (err) {
      expect(err.name).toBe("NotFoundError");
      expect(err.cause).toBeInstanceOf(NotFoundError);
    }
  });
});
