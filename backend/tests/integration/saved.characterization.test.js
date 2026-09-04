// Characterization test for the `saved` domain (Milestone 5B; migrated to
// the repository layer in Phase 7A Milestone 2).
// Locks down savedHelpers.js observable behavior against a real Postgres.
// Written against the helper's public contract, so this same suite proves
// byte-identical behavior across BOTH the original direct-Prisma
// implementation and the repository-backed one — every assertion below
// passed against both without a single edit.
import { PrismaClient } from "@prisma/client";
import * as SavedHelper from "../../src/utils/savedHelpers.js";
import { savedRepository, socialPostRepository } from "../../src/config/repositories.js";
import { transactionRunner } from "../../src/config/transaction.js";
import { DuplicateKeyError } from "../../../shared/database/repositories/errors/index.js";

const prisma = new PrismaClient();

let author; // owns the post
let viewer; // saves the post
let post; // a visible public post
let privateAuthor;
let privatePost; // post by a private account, viewer does not follow

beforeAll(async () => {
  const stamp = Date.now();
  author = await prisma.user.create({
    data: { fullName: "Saved Author", email: `saved-author-${stamp}@example.com`, username: `savedauthor_${stamp}`, accountStatus: "active" },
  });
  viewer = await prisma.user.create({
    data: { fullName: "Saved Viewer", email: `saved-viewer-${stamp}@example.com`, username: `savedviewer_${stamp}`, accountStatus: "active" },
  });
  privateAuthor = await prisma.user.create({
    data: { fullName: "Priv Author", email: `saved-priv-${stamp}@example.com`, username: `savedpriv_${stamp}`, accountStatus: "active", isPrivate: true },
  });
  post = await prisma.post.create({ data: { type: "image", authorId: author.id } });
  privatePost = await prisma.post.create({ data: { type: "image", authorId: privateAuthor.id } });
});

afterAll(async () => {
  await prisma.post.deleteMany({ where: { id: { in: [post.id, privatePost.id].filter(Boolean) } } });
  await prisma.user.deleteMany({
    where: { id: { in: [author.id, viewer.id, privateAuthor.id].filter(Boolean) } },
  });
  await prisma.$disconnect();
});

async function savedCountOf(postId) {
  const p = await prisma.post.findUnique({ where: { id: postId }, select: { savedCount: true } });
  return p.savedCount;
}

describe("savedHelpers — toggle, status, visibility (characterization)", () => {
  test("toggleSave saves a post and increments its savedCount", async () => {
    const before = await savedCountOf(post.id);
    const result = await SavedHelper.toggleSave(viewer.id, post.id);
    expect(result.saved).toBe(true);
    expect(await savedCountOf(post.id)).toBe(before + 1);
  });

  test("hasSaved is true after saving", async () => {
    expect(await SavedHelper.hasSaved(viewer.id, post.id)).toBe(true);
  });

  test("getBulkSaveStatus returns a Set containing the saved postId", async () => {
    const set = await SavedHelper.getBulkSaveStatus(viewer.id, [post.id, privatePost.id]);
    expect(set instanceof Set).toBe(true);
    expect(set.has(post.id)).toBe(true);
    expect(set.has(privatePost.id)).toBe(false);
  });

  test("toggleSave again unsaves the post and decrements its savedCount", async () => {
    const before = await savedCountOf(post.id);
    const result = await SavedHelper.toggleSave(viewer.id, post.id);
    expect(result.saved).toBe(false);
    expect(await savedCountOf(post.id)).toBe(before - 1);
  });

  test("hasSaved is false after unsaving", async () => {
    expect(await SavedHelper.hasSaved(viewer.id, post.id)).toBe(false);
  });

  test("assertPostVisible returns the post for a visible public post", async () => {
    const visible = await SavedHelper.assertPostVisible(post.id, viewer.id);
    expect(visible.id).toBe(post.id);
  });

  test("assertPostVisible throws 'Post not found' for a deleted post", async () => {
    const deleted = await prisma.post.create({
      data: { type: "image", authorId: author.id, isDeleted: true, deletedAt: new Date() },
    });
    await expect(SavedHelper.assertPostVisible(deleted.id, viewer.id)).rejects.toThrow("Post not found");
    await prisma.post.delete({ where: { id: deleted.id } });
  });

  test("assertPostVisible throws for a private account the viewer does not follow", async () => {
    await expect(SavedHelper.assertPostVisible(privatePost.id, viewer.id)).rejects.toThrow("private account");
  });

  // Locks down the helper extracted from saved.controller.js in Milestone 5.
  // Must return the exact { savedCount } shape the controller reads, and
  // null for a missing post — same contract as the Prisma findUnique it
  // replaced.
  test("getPostSavedCount returns the { savedCount } shape for an existing post", async () => {
    const result = await SavedHelper.getPostSavedCount(post.id);
    expect(Object.keys(result)).toEqual(["savedCount"]);
    expect(typeof result.savedCount).toBe("number");
  });

  test("getPostSavedCount returns null for a non-existent post", async () => {
    const result = await SavedHelper.getPostSavedCount("00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 7A additions — coverage the Milestone 5B suite above never had.
// Written and run GREEN against the original direct-Prisma implementation
// BEFORE the repository migration, so they are a true before/after net.
// ─────────────────────────────────────────────────────────────────────────

const MISSING = "00000000-0000-0000-0000-000000000000";

describe("savedHelpers — getSavedPosts listing & pagination (Phase 7A)", () => {
  let lister;
  let postA;
  let postB;
  let postC;
  let deletedPost;

  beforeAll(async () => {
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    lister = await prisma.user.create({
      data: {
        fullName: "Saved Lister",
        email: `saved-lister-${stamp}@example.com`,
        username: `savedlister_${stamp}`,
        accountStatus: "active",
      },
    });
    postA = await prisma.post.create({
      data: { type: "image", authorId: author.id, caption: "A", visibility: "public" },
    });
    postB = await prisma.post.create({
      data: { type: "text", authorId: author.id, caption: "B", visibility: "public" },
    });
    postC = await prisma.post.create({
      data: { type: "image", authorId: author.id, caption: "C", visibility: "public" },
    });
    deletedPost = await prisma.post.create({
      data: { type: "image", authorId: author.id, caption: "gone" },
    });

    // save all four, with distinct createdAt for deterministic desc ordering
    for (const p of [postA, postB, postC, deletedPost]) {
      await SavedHelper.toggleSave(lister.id, p.id);
      await new Promise((r) => setTimeout(r, 5));
    }
    // now soft-delete one so it must be filtered out of the listing
    await prisma.post.update({
      where: { id: deletedPost.id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  });

  afterAll(async () => {
    const ids = [postA.id, postB.id, postC.id, deletedPost.id];
    await prisma.saved.deleteMany({ where: { postId: { in: ids } } });
    await prisma.post.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: lister.id } });
  });

  test("returns newest-first saves with the nested post+author include shape", async () => {
    const { items, hasMore, nextCursor } = await SavedHelper.getSavedPosts(lister.id, { limit: 12 });

    // deletedPost is excluded by the post: { isDeleted: false } relation filter
    expect(items.length).toBe(3);
    expect(items.map((s) => s.post.id)).toEqual([postC.id, postB.id, postA.id]); // desc
    expect(hasMore).toBe(false);
    expect(nextCursor).toBeNull();

    // exact nested projection the controller reads
    expect(Object.keys(items[0].post).sort()).toEqual(
      [
        "id", "type", "caption", "media", "visibility",
        "likesCount", "commentsCount", "viewsCount", "savedCount",
        "createdAt", "author",
      ].sort()
    );
    expect(Object.keys(items[0].post.author).sort()).toEqual(
      ["id", "username", "fullName", "avatar", "isVerifiedBadge"].sort()
    );
    expect(items[0].post.author.id).toBe(author.id);
  });

  test("limit caps the page and sets hasMore + nextCursor", async () => {
    const page1 = await SavedHelper.getSavedPosts(lister.id, { limit: 2 });
    expect(page1.items.length).toBe(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBe(page1.items[1].id);
    expect(page1.items.map((s) => s.post.id)).toEqual([postC.id, postB.id]);
  });

  test("beforeId cursor is accepted and never exceeds the limit", async () => {
    // PRESERVED ODDITY (pre-existing, carried forward byte-identical, NOT
    // fixed): the cursor filters `id: { lt: beforeId }` while ordering by
    // `createdAt: "desc"`. Postgres UUIDs are random and uncorrelated with
    // insertion order, so which rows a cursored page returns is not
    // guaranteed — the same shape already documented for
    // likeHelpers.getLikers in Phase 7A Milestone 1. Only the properties
    // the original code actually guaranteed are asserted here.
    const page1 = await SavedHelper.getSavedPosts(lister.id, { limit: 2 });
    const page2 = await SavedHelper.getSavedPosts(lister.id, {
      beforeId: page1.nextCursor,
      limit: 2,
    });
    expect(Array.isArray(page2.items)).toBe(true);
    expect(page2.items.length).toBeLessThanOrEqual(2);
    for (const s of page2.items) {
      expect(s.id < page1.nextCursor).toBe(true); // the lt filter held
      expect(s.post.isDeleted).toBeUndefined(); // not selected
    }
  });

  test("a user with no saves gets an empty page", async () => {
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const empty = await prisma.user.create({
      data: {
        fullName: "No Saves",
        email: `saved-none-${stamp}@example.com`,
        username: `savednone_${stamp}`,
        accountStatus: "active",
      },
    });
    const result = await SavedHelper.getSavedPosts(empty.id, { limit: 12 });
    expect(result).toEqual({ items: [], hasMore: false, nextCursor: null });
    await prisma.user.delete({ where: { id: empty.id } });
  });

  test("default limit of 12 applies when no options are passed", async () => {
    const result = await SavedHelper.getSavedPosts(lister.id);
    expect(result.items.length).toBe(3); // fewer than the default cap
    expect(result.hasMore).toBe(false);
  });
});

describe("savedHelpers — save/unsave edge cases & counts (Phase 7A)", () => {
  let edgeUser;
  let edgePost;

  beforeAll(async () => {
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    edgeUser = await prisma.user.create({
      data: {
        fullName: "Edge Saver",
        email: `saved-edge-${stamp}@example.com`,
        username: `savededge_${stamp}`,
        accountStatus: "active",
      },
    });
    edgePost = await prisma.post.create({ data: { type: "image", authorId: author.id } });
  });

  afterAll(async () => {
    await prisma.saved.deleteMany({ where: { postId: edgePost.id } });
    await prisma.post.deleteMany({ where: { id: edgePost.id } });
    await prisma.user.deleteMany({ where: { id: edgeUser.id } });
  });

  test("save → unsave → save returns savedCount to its starting value each cycle", async () => {
    const start = await savedCountOf(edgePost.id);

    expect((await SavedHelper.toggleSave(edgeUser.id, edgePost.id)).saved).toBe(true);
    expect(await savedCountOf(edgePost.id)).toBe(start + 1);
    expect(await SavedHelper.hasSaved(edgeUser.id, edgePost.id)).toBe(true);

    expect((await SavedHelper.toggleSave(edgeUser.id, edgePost.id)).saved).toBe(false);
    expect(await savedCountOf(edgePost.id)).toBe(start);
    expect(await SavedHelper.hasSaved(edgeUser.id, edgePost.id)).toBe(false);

    expect((await SavedHelper.toggleSave(edgeUser.id, edgePost.id)).saved).toBe(true);
    expect(await savedCountOf(edgePost.id)).toBe(start + 1);
  });

  test("only one Saved row can exist per (user, post) — the compound unique holds", async () => {
    await expect(
      prisma.saved.create({ data: { savedById: edgeUser.id, postId: edgePost.id } })
    ).rejects.toMatchObject({ code: "P2002" });
    expect(
      await prisma.saved.count({ where: { savedById: edgeUser.id, postId: edgePost.id } })
    ).toBe(1);
  });

  test("toggleSave on a non-existent post rejects and persists nothing (rollback)", async () => {
    await expect(SavedHelper.toggleSave(edgeUser.id, MISSING)).rejects.toThrow();
    expect(await prisma.saved.count({ where: { savedById: edgeUser.id, postId: MISSING } })).toBe(0);
  });

  test("getBulkSaveStatus returns an empty Set for an empty id list", async () => {
    const set = await SavedHelper.getBulkSaveStatus(edgeUser.id, []);
    expect(set instanceof Set).toBe(true);
    expect(set.size).toBe(0);
  });

  test("hasSaved is false for a post that was never saved", async () => {
    expect(await SavedHelper.hasSaved(edgeUser.id, MISSING)).toBe(false);
  });
});

describe("savedHelpers — assertPostVisible branches (Phase 7A)", () => {
  test("throws 'Post not found' for a post id that does not exist", async () => {
    await expect(SavedHelper.assertPostVisible(MISSING, viewer.id)).rejects.toThrow("Post not found");
  });

  test("throws 'Post not found' for a draft post", async () => {
    const draft = await prisma.post.create({
      data: { type: "image", authorId: author.id, isDraft: true },
    });
    await expect(SavedHelper.assertPostVisible(draft.id, viewer.id)).rejects.toThrow("Post not found");
    await prisma.post.delete({ where: { id: draft.id } });
  });

  test("returns the exact 5-field projection for a visible post", async () => {
    const result = await SavedHelper.assertPostVisible(post.id, viewer.id);
    expect(Object.keys(result).sort()).toEqual(
      ["authorId", "id", "isDeleted", "isDraft", "savedCount"].sort()
    );
  });

  test("a private author may always view their own post", async () => {
    const result = await SavedHelper.assertPostVisible(privatePost.id, privateAuthor.id);
    expect(result.id).toBe(privatePost.id);
  });

  test("an accepted follower may view a private account's post", async () => {
    const follow = await prisma.follow.create({
      data: { followerId: viewer.id, followingId: privateAuthor.id, status: "accepted" },
    });
    const result = await SavedHelper.assertPostVisible(privatePost.id, viewer.id);
    expect(result.id).toBe(privatePost.id);
    await prisma.follow.delete({ where: { id: follow.id } });
  });

  test("a pending (not accepted) follower is still blocked from a private account", async () => {
    const follow = await prisma.follow.create({
      data: { followerId: viewer.id, followingId: privateAuthor.id, status: "pending" },
    });
    await expect(SavedHelper.assertPostVisible(privatePost.id, viewer.id)).rejects.toThrow(
      "private account"
    );
    await prisma.follow.delete({ where: { id: follow.id } });
  });
});

// Phase 7A: toggleSave now runs through transactionRunner + repositories
// instead of a raw prisma.$transaction with raw tx.* calls. Two mechanisms
// it silently depends on are proven here, because neither existed in the
// pre-migration code path:
//   1. savedRepository.create normalizes a unique violation to
//      DuplicateKeyError — but must PRESERVE .code === "P2002", because
//      toggleSave's catch branch keys on exactly that code to treat a lost
//      save race as "already saved" instead of throwing.
//   2. transactionRunner rolls the whole callback back on failure, the same
//      as the raw $transaction it replaced.
describe("savedHelpers — repository/transaction mechanisms (Phase 7A)", () => {
  let mechUser;
  let mechPost;

  beforeAll(async () => {
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    mechUser = await prisma.user.create({
      data: {
        fullName: "Mech Saver",
        email: `saved-mech-${stamp}@example.com`,
        username: `savedmech_${stamp}`,
        accountStatus: "active",
      },
    });
    mechPost = await prisma.post.create({ data: { type: "image", authorId: author.id } });
  });

  afterAll(async () => {
    await prisma.saved.deleteMany({ where: { postId: mechPost.id } });
    await prisma.post.deleteMany({ where: { id: mechPost.id } });
    await prisma.user.deleteMany({ where: { id: mechUser.id } });
  });

  test("savedRepository.create surfaces a duplicate as DuplicateKeyError with code P2002", async () => {
    const first = await savedRepository.create({ savedById: mechUser.id, postId: mechPost.id });
    expect(first.id).toBeTruthy();

    const err = await savedRepository
      .create({ savedById: mechUser.id, postId: mechPost.id })
      .then(() => null)
      .catch((e) => e);

    expect(err).toBeInstanceOf(DuplicateKeyError);
    expect(err.code).toBe("P2002"); // what toggleSave's catch branch reads

    await savedRepository.delete(first.id);
  });

  test("the P2002 code survives the transactionRunner boundary (toggleSave's catch contract)", async () => {
    const first = await savedRepository.create({ savedById: mechUser.id, postId: mechPost.id });

    const err = await transactionRunner
      .run(async (tx) => {
        // same call toggleSave makes on its save branch, forced to conflict
        await savedRepository.create({ savedById: mechUser.id, postId: mechPost.id }, { tx });
      })
      .then(() => null)
      .catch((e) => e);

    expect(err).not.toBeNull();
    expect(err.code).toBe("P2002");
    expect(err.name).toBe("DuplicateKeyError");

    await savedRepository.delete(first.id);
  });

  test("transactionRunner rolls back a repository write when a later step fails", async () => {
    const before = await prisma.saved.count({ where: { savedById: mechUser.id, postId: mechPost.id } });
    expect(before).toBe(0);

    const err = await transactionRunner
      .run(async (tx) => {
        // step 1 succeeds — mirrors toggleSave's save branch
        await savedRepository.create({ savedById: mechUser.id, postId: mechPost.id }, { tx });
        // step 2 fails — mirrors the savedCount update hitting a missing post
        await socialPostRepository.update(MISSING, { savedCount: { inc: 1 } }, { tx });
      })
      .then(() => null)
      .catch((e) => e);

    expect(err).not.toBeNull();
    // the successful first write was rolled back with the transaction
    expect(await prisma.saved.count({ where: { savedById: mechUser.id, postId: mechPost.id } })).toBe(0);
  });
});
