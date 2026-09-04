// Characterization test for the `story` domain (Milestone 5B).
// Locks down storyHelpers.js observable behavior against a real Postgres
// BEFORE the controller's 3 direct Prisma calls are extracted into the
// helper. Written against the helper's public contract.
import { PrismaClient } from "@prisma/client";
import * as StoryHelper from "../../src/utils/storyHelpers.js";
import { storyRepository, storyViewRepository } from "../../src/config/repositories.js";
import { transactionRunner } from "../../src/config/transaction.js";

const prisma = new PrismaClient();

let author;
let viewer;
let story; // live story by author
let expiredStory;

const future = () => new Date(Date.now() + 24 * 60 * 60 * 1000);
const past = () => new Date(Date.now() - 60 * 60 * 1000);

beforeAll(async () => {
  const stamp = Date.now();
  author = await prisma.user.create({
    data: { fullName: "Story Author", email: `story-author-${stamp}@example.com`, username: `storyauthor_${stamp}`, accountStatus: "active" },
  });
  viewer = await prisma.user.create({
    data: { fullName: "Story Viewer", email: `story-viewer-${stamp}@example.com`, username: `storyviewer_${stamp}`, accountStatus: "active" },
  });
  story = await prisma.story.create({ data: { authorId: author.id, expiresAt: future() } });
  expiredStory = await prisma.story.create({ data: { authorId: author.id, expiresAt: past() } });
});

afterAll(async () => {
  await prisma.story.deleteMany({ where: { authorId: author.id } });
  await prisma.user.deleteMany({ where: { id: { in: [author.id, viewer.id].filter(Boolean) } } });
  await prisma.$disconnect();
});

async function reactionsCountOf(storyId) {
  const s = await prisma.story.findUnique({ where: { id: storyId }, select: { reactionsCount: true } });
  return s.reactionsCount;
}

describe("storyHelpers — reactions, viewers, delete (characterization)", () => {
  test("reactToStory adds a reaction and increments reactionsCount to 1", async () => {
    const result = await StoryHelper.reactToStory(story.id, viewer.id, "❤️");
    expect(result).not.toBeNull();
    expect(result.reactionsCount).toBe(1);
    expect(await reactionsCountOf(story.id)).toBe(1);
  });

  test("reactToStory changing an existing reaction keeps the count at 1", async () => {
    const result = await StoryHelper.reactToStory(story.id, viewer.id, "😂");
    expect(result.reactionsCount).toBe(1);
  });

  test("reactToStory removing a reaction (null) decrements the count to 0", async () => {
    const result = await StoryHelper.reactToStory(story.id, viewer.id, null);
    expect(result.reactionsCount).toBe(0);
    expect(await reactionsCountOf(story.id)).toBe(0);
  });

  test("reactToStory returns null for an expired story", async () => {
    const result = await StoryHelper.reactToStory(expiredStory.id, viewer.id, "❤️");
    expect(result).toBeNull();
  });

  test("getStoryViewers returns viewers + viewsCount for the author", async () => {
    const result = await StoryHelper.getStoryViewers(story.id, author.id, 30);
    expect(result).not.toBeNull();
    expect(Array.isArray(result.viewers)).toBe(true);
    expect(typeof result.viewsCount).toBe("number");
  });

  test("getStoryViewers returns null for a non-author", async () => {
    const result = await StoryHelper.getStoryViewers(story.id, viewer.id, 30);
    expect(result).toBeNull();
  });

  test("deleteStory soft-deletes for the author and returns null on a second attempt", async () => {
    const temp = await prisma.story.create({ data: { authorId: author.id, expiresAt: future() } });
    const first = await StoryHelper.deleteStory(temp.id, author.id);
    expect(first).not.toBeNull();
    const reloaded = await prisma.story.findUnique({ where: { id: temp.id }, select: { isDeleted: true } });
    expect(reloaded.isDeleted).toBe(true);
    const second = await StoryHelper.deleteStory(temp.id, author.id);
    expect(second).toBeNull();
  });

  // Helpers extracted from story.controller.js in Milestone 5.
  test("getStoryAuthorId returns { authorId } for an existing story, null for missing", async () => {
    const result = await StoryHelper.getStoryAuthorId(story.id);
    expect(Object.keys(result)).toEqual(["authorId"]);
    expect(result.authorId).toBe(author.id);
    expect(await StoryHelper.getStoryAuthorId("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  test("getStoryViewReaction returns { reaction } for a view row, null when absent", async () => {
    await StoryHelper.reactToStory(story.id, viewer.id, "❤️"); // ensure a view row with a reaction exists
    const result = await StoryHelper.getStoryViewReaction(story.id, viewer.id);
    expect(Object.keys(result)).toEqual(["reaction"]);
    expect(result.reaction).toBe("❤️");
    expect(await StoryHelper.getStoryViewReaction(story.id, author.id)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 7A additions — coverage the Milestone 5B suite above never had.
// 5 of the 11 helper methods (createMediaStory, createTextStory,
// getStoriesFeed, getViewedStories, viewStory, isAlreadyViewed) were
// entirely untested, including the domain's ONLY transaction (viewStory).
// Written and run GREEN against the original direct-Prisma implementation
// BEFORE the repository migration, so they are a true before/after net.
//
// These blocks create their own fixtures rather than reusing the shared
// author/viewer/story above, whose viewsCount, reactionsCount and view rows
// are mutated in sequence by the tests already there.
// ─────────────────────────────────────────────────────────────────────────

const MISSING = "00000000-0000-0000-0000-000000000000";
const AUTHOR_PROFILE_KEYS = ["avatar", "fullName", "id", "isVerifiedBadge", "username"];

const scratchUserIds = [];
const scratchStoryIds = [];

async function makeScratchUser() {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({
    data: {
      fullName: `Story P7A ${s}`,
      email: `story-p7a-${s}@example.com`,
      username: `storyp7a_${s}`,
      accountStatus: "active",
    },
  });
  scratchUserIds.push(u.id);
  return u;
}

async function makeScratchStory(authorId, { audience = "public", expiresAt = null, isDeleted = false } = {}) {
  const st = await prisma.story.create({
    data: {
      authorId,
      audience,
      isDeleted,
      expiresAt: expiresAt ?? future(),
    },
  });
  scratchStoryIds.push(st.id);
  return st;
}

async function viewsCountOf(storyId) {
  const s = await prisma.story.findUnique({ where: { id: storyId }, select: { viewsCount: true } });
  return s.viewsCount;
}

afterAll(async () => {
  // StoryView rows cascade with their story; stories cascade with their author.
  await prisma.story.deleteMany({ where: { id: { in: scratchStoryIds } } });
  await prisma.user.deleteMany({ where: { id: { in: scratchUserIds } } });
});

describe("storyHelpers — story creation (Phase 7A)", () => {
  test("createMediaStory persists the full media payload and a 24h expiry", async () => {
    const u = await makeScratchUser();
    const media = {
      url: "https://cdn.example.com/s.jpg",
      publicId: "stories/s",
      resourceType: "image",
      width: 1080,
      height: 1920,
      duration: null,
      thumbnailUrl: "https://cdn.example.com/s-thumb.jpg",
    };

    const before = Date.now();
    const created = await StoryHelper.createMediaStory(u.id, media, "my caption", "followers");
    scratchStoryIds.push(created.id);

    expect(created.type).toBe("media");
    expect(created.caption).toBe("my caption");
    expect(created.audience).toBe("followers");
    expect(created.authorId).toBe(u.id);
    expect(created.textContent).toBeNull();

    // exact media sub-document shape
    expect(created.media).toEqual({
      url: media.url,
      publicId: media.publicId,
      resourceType: media.resourceType,
      width: 1080,
      height: 1920,
      duration: null,
      thumbnailUrl: media.thumbnailUrl,
    });

    // expiresAt is ~24h out
    const delta = created.expiresAt.getTime() - before;
    expect(delta).toBeGreaterThan(23.9 * 60 * 60 * 1000);
    expect(delta).toBeLessThan(24.1 * 60 * 60 * 1000);
  });

  test("createMediaStory defaults optional media fields to null and audience to public", async () => {
    const u = await makeScratchUser();
    const created = await StoryHelper.createMediaStory(
      u.id,
      { url: "u", publicId: "p", resourceType: "image" },
      null,
      null
    );
    scratchStoryIds.push(created.id);

    expect(created.audience).toBe("public");
    expect(created.caption).toBe("");
    expect(created.media.width).toBeNull();
    expect(created.media.height).toBeNull();
    expect(created.media.duration).toBeNull();
    expect(created.media.thumbnailUrl).toBeNull();
  });

  test("createTextStory persists the textContent payload with defaults", async () => {
    const u = await makeScratchUser();
    const created = await StoryHelper.createTextStory(u.id, "  hello world  ", "#ff0000", "left", "close_friends");
    scratchStoryIds.push(created.id);

    expect(created.type).toBe("text");
    expect(created.audience).toBe("close_friends");
    expect(created.media).toBeNull();
    expect(created.textContent).toEqual({
      text: "hello world", // trimmed
      background: "#ff0000",
      textAlign: "left",
      textColor: "#ffffff",
    });
  });

  test("createTextStory falls back to centered alignment, null background, public audience", async () => {
    const u = await makeScratchUser();
    const created = await StoryHelper.createTextStory(u.id, "plain", null, null, null);
    scratchStoryIds.push(created.id);

    expect(created.audience).toBe("public");
    expect(created.textContent.background).toBeNull();
    expect(created.textContent.textAlign).toBe("center");
    expect(created.textContent.textColor).toBe("#ffffff");
  });
});

describe("storyHelpers — stories feed & visibility (Phase 7A)", () => {
  let feedAuthor;
  let livePublic;

  beforeAll(async () => {
    feedAuthor = await makeScratchUser();
    livePublic = await makeScratchStory(feedAuthor.id, { audience: "public" });
    await makeScratchStory(feedAuthor.id, { audience: "public", expiresAt: past() }); // expired
    await makeScratchStory(feedAuthor.id, { audience: "public", isDeleted: true }); // deleted
    await makeScratchStory(feedAuthor.id, { audience: "followers" }); // wrong audience
    await makeScratchStory(feedAuthor.id, { audience: "close_friends" }); // wrong audience
  });

  test("feed includes only live, non-deleted, public stories", async () => {
    const feed = await StoryHelper.getStoriesFeed(feedAuthor.id);
    const mine = feed.filter((s) => s.author.id === feedAuthor.id);

    expect(mine.map((s) => s.id)).toEqual([livePublic.id]);
  });

  test("feed rows carry the exact projection and nested author shape", async () => {
    const feed = await StoryHelper.getStoriesFeed(feedAuthor.id);
    const row = feed.find((s) => s.id === livePublic.id);

    expect(Object.keys(row).sort()).toEqual(
      [
        "id", "type", "media", "textContent", "caption",
        "viewsCount", "reactionsCount", "expiresAt", "createdAt", "author",
      ].sort()
    );
    expect(Object.keys(row.author).sort()).toEqual(AUTHOR_PROFILE_KEYS.slice().sort());
    // fields deliberately NOT projected
    expect(row.isDeleted).toBeUndefined();
    expect(row.audience).toBeUndefined();
    expect(row.authorId).toBeUndefined();
  });

  test("feed is ordered newest-first", async () => {
    const a2 = await makeScratchUser();
    await makeScratchStory(a2.id, { audience: "public" });
    await new Promise((r) => setTimeout(r, 5));
    const newest = await makeScratchStory(a2.id, { audience: "public" });

    const feed = await StoryHelper.getStoriesFeed(a2.id);
    const mine = feed.filter((s) => s.author.id === a2.id);
    expect(mine[0].id).toBe(newest.id);

    const times = feed.map((s) => s.createdAt.getTime());
    expect([...times].sort((x, y) => y - x)).toEqual(times); // desc across the whole feed
  });

  test("feed is the same regardless of which user requests it (no per-viewer filtering)", async () => {
    // PRESERVED BEHAVIOR: getStoriesFeed takes a userId but never uses it —
    // the query filters on audience:"public" only, with no follow-graph or
    // close-friends check. Carried forward unchanged.
    const stranger = await makeScratchUser();
    const asAuthor = await StoryHelper.getStoriesFeed(feedAuthor.id);
    const asStranger = await StoryHelper.getStoriesFeed(stranger.id);
    expect(asStranger.map((s) => s.id)).toEqual(asAuthor.map((s) => s.id));
  });
});

describe("storyHelpers — viewStory & view tracking (Phase 7A)", () => {
  test("a first view records the row and increments viewsCount (transaction commit)", async () => {
    const a = await makeScratchUser();
    const v = await makeScratchUser();
    const st = await makeScratchStory(a.id);

    expect(await viewsCountOf(st.id)).toBe(0);
    expect(await StoryHelper.isAlreadyViewed(st.id, v.id)).toBe(false);

    const result = await StoryHelper.viewStory(st.id, v.id);
    expect(result).toEqual({ selfView: false, alreadyViewed: false });

    // BOTH transaction statements committed together
    expect(await viewsCountOf(st.id)).toBe(1);
    expect(await StoryHelper.isAlreadyViewed(st.id, v.id)).toBe(true);
  });

  test("a repeat view reports alreadyViewed and does not double-count", async () => {
    const a = await makeScratchUser();
    const v = await makeScratchUser();
    const st = await makeScratchStory(a.id);

    await StoryHelper.viewStory(st.id, v.id);
    const countAfterFirst = await viewsCountOf(st.id);

    const result = await StoryHelper.viewStory(st.id, v.id);
    expect(result).toEqual({ selfView: false, alreadyViewed: true });
    expect(await viewsCountOf(st.id)).toBe(countAfterFirst);
  });

  test("the author viewing their own story is a selfView and records nothing", async () => {
    const a = await makeScratchUser();
    const st = await makeScratchStory(a.id);

    const result = await StoryHelper.viewStory(st.id, a.id);
    expect(result).toEqual({ selfView: true });
    expect(await viewsCountOf(st.id)).toBe(0);
    expect(await StoryHelper.isAlreadyViewed(st.id, a.id)).toBe(false);
  });

  test("viewStory returns null for missing, deleted and expired stories", async () => {
    const a = await makeScratchUser();
    const v = await makeScratchUser();
    const deleted = await makeScratchStory(a.id, { isDeleted: true });
    const expired = await makeScratchStory(a.id, { expiresAt: past() });

    expect(await StoryHelper.viewStory(MISSING, v.id)).toBeNull();
    expect(await StoryHelper.viewStory(deleted.id, v.id)).toBeNull();
    expect(await StoryHelper.viewStory(expired.id, v.id)).toBeNull();
  });

  test("getViewedStories returns a batch Map keyed by storyId with reactions", async () => {
    const a = await makeScratchUser();
    const v = await makeScratchUser();
    const viewedPlain = await makeScratchStory(a.id);
    const viewedReacted = await makeScratchStory(a.id);
    const unviewed = await makeScratchStory(a.id);

    await StoryHelper.viewStory(viewedPlain.id, v.id);
    await StoryHelper.reactToStory(viewedReacted.id, v.id, "🔥");

    const map = await StoryHelper.getViewedStories(
      [viewedPlain.id, viewedReacted.id, unviewed.id],
      v.id
    );

    expect(map instanceof Map).toBe(true);
    expect(map.get(viewedPlain.id)).toEqual({ viewed: true, reaction: null });
    expect(map.get(viewedReacted.id)).toEqual({ viewed: true, reaction: "🔥" });
    expect(map.has(unviewed.id)).toBe(false);
  });

  test("getViewedStories is scoped to the requesting viewer and handles an empty id list", async () => {
    const a = await makeScratchUser();
    const v1 = await makeScratchUser();
    const v2 = await makeScratchUser();
    const st = await makeScratchStory(a.id);

    await StoryHelper.viewStory(st.id, v1.id);

    expect((await StoryHelper.getViewedStories([st.id], v2.id)).size).toBe(0);
    expect((await StoryHelper.getViewedStories([], v1.id)).size).toBe(0);
  });
});

describe("storyHelpers — viewers list & deletion (Phase 7A)", () => {
  test("getStoryViewers returns viewer profiles newest-first, capped by limit", async () => {
    const a = await makeScratchUser();
    const st = await makeScratchStory(a.id);
    const v1 = await makeScratchUser();
    const v2 = await makeScratchUser();
    const v3 = await makeScratchUser();

    for (const v of [v1, v2, v3]) {
      await StoryHelper.viewStory(st.id, v.id);
      await new Promise((r) => setTimeout(r, 5)); // distinct viewedAt
    }

    const result = await StoryHelper.getStoryViewers(st.id, a.id, 30);
    expect(result.viewsCount).toBe(3);
    expect(result.viewers.length).toBe(3);
    expect(result.viewers[0].viewer.id).toBe(v3.id); // viewedAt desc

    expect(Object.keys(result.viewers[0]).sort()).toEqual(["reaction", "viewedAt", "viewer"].sort());
    expect(Object.keys(result.viewers[0].viewer).sort()).toEqual(AUTHOR_PROFILE_KEYS.slice().sort());

    const limited = await StoryHelper.getStoryViewers(st.id, a.id, 2);
    expect(limited.viewers.length).toBe(2);
    expect(limited.viewsCount).toBe(3); // count is the story's, not the page's
  });

  test("getStoryViewers surfaces each viewer's reaction", async () => {
    const a = await makeScratchUser();
    const st = await makeScratchStory(a.id);
    const v = await makeScratchUser();

    await StoryHelper.reactToStory(st.id, v.id, "😮");
    const result = await StoryHelper.getStoryViewers(st.id, a.id, 30);
    expect(result.viewers[0].reaction).toBe("😮");
  });

  test("getStoryViewers returns null for a missing story", async () => {
    const a = await makeScratchUser();
    expect(await StoryHelper.getStoryViewers(MISSING, a.id, 30)).toBeNull();
  });

  test("deleteStory returns the pre-delete projection and flips only isDeleted", async () => {
    const a = await makeScratchUser();
    const st = await makeScratchStory(a.id);

    const returned = await StoryHelper.deleteStory(st.id, a.id);
    expect(Object.keys(returned).sort()).toEqual(["authorId", "isDeleted", "media", "type"].sort());
    expect(returned.isDeleted).toBe(false); // the state BEFORE the delete

    const row = await prisma.story.findUnique({ where: { id: st.id } });
    expect(row.isDeleted).toBe(true);
    // PRESERVED BEHAVIOR: the helper writes ONLY isDeleted — it never sets
    // deletedAt, even though the column exists. Pinned here because
    // StoryRepository.delete() *does* write deletedAt, so routing this
    // helper through it would silently change what gets persisted.
    expect(row.deletedAt).toBeNull();
  });

  test("deleteStory returns null for a non-author and for a missing story", async () => {
    const a = await makeScratchUser();
    const other = await makeScratchUser();
    const st = await makeScratchStory(a.id);

    expect(await StoryHelper.deleteStory(st.id, other.id)).toBeNull();
    expect(await StoryHelper.deleteStory(MISSING, a.id)).toBeNull();

    const row = await prisma.story.findUnique({ where: { id: st.id } });
    expect(row.isDeleted).toBe(false); // untouched by the rejected attempt
  });
});

// ─────────────────────────────────────────────────────────────────────────
// REPOSITORY HAZARD REGRESSIONS (Phase 7A Milestone 4)
//
// Three ways a naive repository substitution would have silently changed
// behavior in this domain. None are "fixed" — the existing repository APIs
// are correct for their own contracts; storyHelpers simply must not use the
// obvious-looking method. Each is pinned here so the constraint is
// executable knowledge rather than a comment, and so a future change to
// either side fails loudly.
// ─────────────────────────────────────────────────────────────────────────
describe("StoryRepository — delete() vs update() divergence (Phase 7A hazard)", () => {
  test("delete() stamps deletedAt, which storyHelpers.deleteStory must NOT do", async () => {
    const a = await makeScratchUser();
    const viaRepoDelete = await makeScratchStory(a.id);
    const viaHelper = await makeScratchStory(a.id);

    await storyRepository.delete(viaRepoDelete.id);
    await StoryHelper.deleteStory(viaHelper.id, a.id);

    const deletedRow = await prisma.story.findUnique({ where: { id: viaRepoDelete.id } });
    const helperRow = await prisma.story.findUnique({ where: { id: viaHelper.id } });

    // both soft-delete...
    expect(deletedRow.isDeleted).toBe(true);
    expect(helperRow.isDeleted).toBe(true);

    // ...but only the repository's delete() writes deletedAt. This is the
    // exact divergence that makes storyHelpers.deleteStory call update()
    // instead of delete().
    expect(deletedRow.deletedAt).toBeInstanceOf(Date);
    expect(helperRow.deletedAt).toBeNull();
  });
});

describe("Story repositories — unbounded reads vs findMany cap (Phase 7A hazard)", () => {
  const CAP = 20; // toPrismaPagination()'s default limit
  let bulkAuthor;
  let bulkViewer;
  let storyCount;

  beforeAll(async () => {
    bulkAuthor = await makeScratchUser();
    bulkViewer = await makeScratchUser();
    storyCount = CAP + 3; // deliberately more than the default cap

    for (let i = 0; i < storyCount; i++) {
      const st = await makeScratchStory(bulkAuthor.id, { audience: "public" });
      await StoryHelper.viewStory(st.id, bulkViewer.id);
    }
  });

  test("findMany(filter) with no pagination silently caps at the default limit", async () => {
    const capped = await storyRepository.findMany({ authorId: bulkAuthor.id, audience: "public" });
    expect(capped.length).toBe(CAP);
    expect(capped.length).toBeLessThan(storyCount); // rows were dropped
  });

  test("getStoriesFeed returns every live public story, uncapped", async () => {
    const feed = await StoryHelper.getStoriesFeed(bulkViewer.id);
    const mine = feed.filter((s) => s.author.id === bulkAuthor.id);
    expect(mine.length).toBe(storyCount);
    expect(mine.length).toBeGreaterThan(CAP); // proves no silent truncation
  });

  test("getViewedStories resolves the full batch, uncapped", async () => {
    const storyIds = (await prisma.story.findMany({
      where: { authorId: bulkAuthor.id },
      select: { id: true },
    })).map((s) => s.id);

    expect(storyIds.length).toBe(storyCount);

    const map = await StoryHelper.getViewedStories(storyIds, bulkViewer.id);
    expect(map.size).toBe(storyCount);
    expect(map.size).toBeGreaterThan(CAP);
  });
});

describe("storyHelpers — viewStory transaction semantics (Phase 7A)", () => {
  test("transactionRunner rolls back the view row when the count update fails", async () => {
    const a = await makeScratchUser();
    const v = await makeScratchUser();
    const st = await makeScratchStory(a.id);

    const before = await viewsCountOf(st.id);

    const err = await transactionRunner
      .run(async (tx) => {
        // step 1 succeeds — mirrors viewStory's first statement
        await storyViewRepository.create({ viewerId: v.id, storyId: st.id }, { tx });
        // step 2 fails — mirrors the viewsCount bump hitting a missing story
        await storyRepository.update(MISSING, { viewsCount: { inc: 1 } }, { tx });
      })
      .then(() => null)
      .catch((e) => e);

    expect(err).not.toBeNull();

    // the successful first write was rolled back with the transaction
    expect(await StoryHelper.isAlreadyViewed(st.id, v.id)).toBe(false);
    expect(await viewsCountOf(st.id)).toBe(before);
  });

  test("a duplicate view surfaces P2002 through the transaction boundary", async () => {
    // viewStory's catch branch reads err.code === "P2002" to detect a lost
    // race. That code must survive normalization into DuplicateKeyError AND
    // the transactionRunner wrapper for the branch to still work.
    const a = await makeScratchUser();
    const v = await makeScratchUser();
    const st = await makeScratchStory(a.id);

    await StoryHelper.viewStory(st.id, v.id); // row now exists

    const err = await transactionRunner
      .run(async (tx) => {
        await storyViewRepository.create({ viewerId: v.id, storyId: st.id }, { tx });
      })
      .then(() => null)
      .catch((e) => e);

    expect(err).not.toBeNull();
    expect(err.code).toBe("P2002");
    expect(err.name).toBe("DuplicateKeyError");
  });
});
