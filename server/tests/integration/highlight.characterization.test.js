// Characterization test for the `highlight` domain (Phase 7A Milestone 5).
//
// UNLIKE every other Phase 7A milestone, highlightHelpers.js had NO
// characterization suite at all — Milestone 5B covered story.controller.js
// via storyHelpers, but highlightHelpers' 6 methods were never locked down.
// This file is therefore written from scratch and run GREEN against the
// ORIGINAL direct-Prisma implementation BEFORE the repository migration,
// establishing the before/after net that the other milestones inherited.
//
// Written against the helper's public contract so it survives the refactor.
//
// SCOPE NOTE: there is no "rename highlight" capability to characterize —
// neither highlightHelpers nor story.controller.js exposes a title-update
// path. Only create/read/add-story/remove-snapshot/delete exist.
//
// NO TRANSACTIONS: this helper has none, before or after the migration.
// addStoryToHighlight and removeSnapshotFromHighlight each issue a second,
// conditional cover-image update as a SEPARATE statement from the snapshot
// write, so a crash between them leaves the cover stale. That pre-existing
// non-atomicity is pinned below rather than fixed.
import { PrismaClient } from "@prisma/client";
import * as HighlightHelper from "../../src/utils/highlightHelpers.js";
import { highlightRepository, storyRepository } from "../../src/config/repositories.js";

const prisma = new PrismaClient();

const MISSING = "00000000-0000-0000-0000-000000000000";

const userIds = [];
const storyIds = [];
const highlightIds = [];

const future = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

async function makeUser() {
  const s = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({
    data: {
      fullName: `HL ${s}`,
      email: `hl-${s}@example.com`,
      username: `hl_${s}`,
      accountStatus: "active",
    },
  });
  userIds.push(u.id);
  return u;
}

async function makeImageStory(authorId, { isDeleted = false, url = "https://res.cloudinary.com/demo/image/upload/v1/pic.jpg" } = {}) {
  const st = await prisma.story.create({
    data: {
      authorId,
      type: "media",
      isDeleted,
      expiresAt: future(),
      media: { url, publicId: "stories/pic", resourceType: "image" },
    },
  });
  storyIds.push(st.id);
  return st;
}

async function makeVideoStory(authorId, { url = "https://res.cloudinary.com/demo/video/upload/v1/clip.mp4" } = {}) {
  const st = await prisma.story.create({
    data: {
      authorId,
      type: "media",
      expiresAt: future(),
      media: { url, publicId: "stories/clip", resourceType: "video" },
    },
  });
  storyIds.push(st.id);
  return st;
}

async function makeTextStory(authorId) {
  const st = await prisma.story.create({
    data: {
      authorId,
      type: "text",
      expiresAt: future(),
      textContent: { text: "hello", background: "#000", textAlign: "center", textColor: "#ffffff" },
    },
  });
  storyIds.push(st.id);
  return st;
}

async function trackHighlight(h) {
  highlightIds.push(h.id);
  return h;
}

async function rawHighlight(id) {
  return prisma.highlight.findUnique({ where: { id } });
}

afterAll(async () => {
  await prisma.highlight.deleteMany({ where: { id: { in: highlightIds } } });
  await prisma.story.deleteMany({ where: { id: { in: storyIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────
describe("highlightHelpers — buildSnapshot", () => {
  test("a text story becomes a text snapshot carrying textContent", async () => {
    const snap = await HighlightHelper.buildSnapshot({
      id: "story-1",
      type: "text",
      textContent: { text: "hi", background: "#fff" },
    });

    expect(Object.keys(snap).sort()).toEqual(["id", "storyId", "textContent", "type"].sort());
    expect(snap.type).toBe("text");
    expect(snap.storyId).toBe("story-1");
    expect(snap.textContent).toEqual({ text: "hi", background: "#fff" });
    expect(typeof snap.id).toBe("string"); // generated uuid
  });

  test("an image story becomes a media snapshot with a null thumbnail", async () => {
    const snap = await HighlightHelper.buildSnapshot({
      id: "story-2",
      type: "media",
      media: { url: "https://cdn/x.jpg", publicId: "p", resourceType: "image" },
    });

    expect(snap.type).toBe("image");
    expect(snap.url).toBe("https://cdn/x.jpg");
    expect(snap.publicId).toBe("p");
    expect(snap.resourceType).toBe("image");
    expect(snap.thumbnailUrl).toBeNull();
  });

  test("a video story derives a Cloudinary jpg thumbnail from its url", async () => {
    const snap = await HighlightHelper.buildSnapshot({
      id: "story-3",
      type: "media",
      media: {
        url: "https://res.cloudinary.com/demo/video/upload/v1/clip.mp4",
        publicId: "p",
        resourceType: "video",
      },
    });

    expect(snap.type).toBe("video");
    expect(snap.thumbnailUrl).toBe(
      "https://res.cloudinary.com/demo/video/upload/so_0,f_jpg/v1/clip.jpg"
    );
  });

  test("a media story with no media object falls back to image/null fields", async () => {
    const snap = await HighlightHelper.buildSnapshot({ id: "story-4", type: "media" });

    expect(snap.type).toBe("image");
    expect(snap.url).toBeNull();
    expect(snap.publicId).toBeNull();
    expect(snap.resourceType).toBe("image");
    expect(snap.thumbnailUrl).toBeNull();
  });

  test("each snapshot gets a distinct generated id", async () => {
    const story = { id: "s", type: "text", textContent: {} };
    const a = await HighlightHelper.buildSnapshot(story);
    const b = await HighlightHelper.buildSnapshot(story);
    expect(a.id).not.toBe(b.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("highlightHelpers — createHighlight", () => {
  test("creates an empty highlight with a trimmed title and null cover", async () => {
    const u = await makeUser();
    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "  My Trip  ", []));

    expect(h.title).toBe("My Trip");
    expect(h.authorId).toBe(u.id);
    expect(h.coverImage).toBeNull();
    expect(h.snapshots).toEqual([]);
    expect(h.isDeleted).toBe(false);
  });

  test("defaults storyIds to an empty list when omitted", async () => {
    const u = await makeUser();
    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "No Args"));
    expect(h.snapshots).toEqual([]);
    expect(h.coverImage).toBeNull();
  });

  test("builds one snapshot per supplied story", async () => {
    const u = await makeUser();
    const s1 = await makeImageStory(u.id);
    const s2 = await makeTextStory(u.id);

    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Mixed", [s1.id, s2.id]));

    expect(h.snapshots.length).toBe(2);
    expect(h.snapshots.map((s) => s.storyId).sort()).toEqual([s1.id, s2.id].sort());
  });

  test("cover comes from the first non-text snapshot's url", async () => {
    const u = await makeUser();
    const img = await makeImageStory(u.id, { url: "https://cdn/cover.jpg" });

    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Cover", [img.id]));
    expect(h.coverImage).toBe("https://cdn/cover.jpg");
  });

  test("a video's derived thumbnail is preferred over its raw url for the cover", async () => {
    const u = await makeUser();
    const vid = await makeVideoStory(u.id);

    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Video", [vid.id]));
    expect(h.coverImage).toBe(
      "https://res.cloudinary.com/demo/video/upload/so_0,f_jpg/v1/clip.jpg"
    );
  });

  test("a text-only highlight has no cover", async () => {
    const u = await makeUser();
    const txt = await makeTextStory(u.id);

    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Text Only", [txt.id]));
    expect(h.snapshots.length).toBe(1);
    expect(h.coverImage).toBeNull();
  });

  test("ignores stories belonging to someone else, and deleted stories", async () => {
    const u = await makeUser();
    const other = await makeUser();
    const mine = await makeImageStory(u.id);
    const theirs = await makeImageStory(other.id);
    const deleted = await makeImageStory(u.id, { isDeleted: true });

    const h = await trackHighlight(
      await HighlightHelper.createHighlight(u.id, "Filtered", [mine.id, theirs.id, deleted.id, MISSING])
    );

    expect(h.snapshots.map((s) => s.storyId)).toEqual([mine.id]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("highlightHelpers — getMyHighlights", () => {
  test("returns the author's non-deleted highlights, newest first, with the exact projection", async () => {
    const u = await makeUser();
    const older = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Older", []));
    await new Promise((r) => setTimeout(r, 5));
    const newer = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Newer", []));
    const gone = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Gone", []));
    await HighlightHelper.deleteHighlight(gone.id, u.id);

    const list = await HighlightHelper.getMyHighlights(u.id);

    expect(list.map((h) => h.id)).toEqual([newer.id, older.id]); // desc, deleted excluded
    expect(Object.keys(list[0]).sort()).toEqual(
      ["coverImage", "createdAt", "id", "snapshots", "title"].sort()
    );
    // fields deliberately NOT projected
    expect(list[0].authorId).toBeUndefined();
    expect(list[0].isDeleted).toBeUndefined();
  });

  test("is scoped to the requesting author and returns [] when they have none", async () => {
    const u = await makeUser();
    const other = await makeUser();
    await trackHighlight(await HighlightHelper.createHighlight(other.id, "Theirs", []));

    expect(await HighlightHelper.getMyHighlights(u.id)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("highlightHelpers — addStoryToHighlight", () => {
  test("appends a snapshot and preserves existing snapshot order", async () => {
    const u = await makeUser();
    const first = await makeImageStory(u.id);
    const second = await makeImageStory(u.id);
    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Ordered", [first.id]));

    const result = await HighlightHelper.addStoryToHighlight(h.id, u.id, second.id);

    expect(result.success).toBe(true);
    expect(result.highlight.snapshots.map((s) => s.storyId)).toEqual([first.id, second.id]);
  });

  test("sets the cover when the highlight had none and the new snapshot has a url", async () => {
    const u = await makeUser();
    const txt = await makeTextStory(u.id);
    const img = await makeImageStory(u.id, { url: "https://cdn/late-cover.jpg" });
    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "LateCover", [txt.id]));
    expect(h.coverImage).toBeNull();

    await HighlightHelper.addStoryToHighlight(h.id, u.id, img.id);

    const row = await rawHighlight(h.id);
    expect(row.coverImage).toBe("https://cdn/late-cover.jpg");
  });

  test("leaves an existing cover untouched", async () => {
    const u = await makeUser();
    const first = await makeImageStory(u.id, { url: "https://cdn/first.jpg" });
    const second = await makeImageStory(u.id, { url: "https://cdn/second.jpg" });
    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "KeepCover", [first.id]));

    await HighlightHelper.addStoryToHighlight(h.id, u.id, second.id);

    const row = await rawHighlight(h.id);
    expect(row.coverImage).toBe("https://cdn/first.jpg");
  });

  test("rejects a story the requester does not own, a deleted story, and a missing story", async () => {
    const u = await makeUser();
    const other = await makeUser();
    const theirs = await makeImageStory(other.id);
    const deleted = await makeImageStory(u.id, { isDeleted: true });
    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Guarded", []));

    expect(await HighlightHelper.addStoryToHighlight(h.id, u.id, theirs.id)).toEqual({
      error: "Story not found",
    });
    expect(await HighlightHelper.addStoryToHighlight(h.id, u.id, deleted.id)).toEqual({
      error: "Story not found",
    });
    expect(await HighlightHelper.addStoryToHighlight(h.id, u.id, MISSING)).toEqual({
      error: "Story not found",
    });
  });

  test("rejects a highlight the requester does not own, and a missing highlight", async () => {
    const u = await makeUser();
    const other = await makeUser();
    const story = await makeImageStory(u.id);
    const theirHighlight = await trackHighlight(
      await HighlightHelper.createHighlight(other.id, "Theirs", [])
    );

    expect(await HighlightHelper.addStoryToHighlight(theirHighlight.id, u.id, story.id)).toEqual({
      error: "Highlight not found",
    });
    expect(await HighlightHelper.addStoryToHighlight(MISSING, u.id, story.id)).toEqual({
      error: "Highlight not found",
    });
  });

  test("rejects a story already in THIS highlight", async () => {
    const u = await makeUser();
    const story = await makeImageStory(u.id);
    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Dupe", [story.id]));

    expect(await HighlightHelper.addStoryToHighlight(h.id, u.id, story.id)).toEqual({
      error: "Story already in highlight",
    });
  });

  test("rejects a story already in ANOTHER highlight, naming it and returning its id", async () => {
    const u = await makeUser();
    const story = await makeImageStory(u.id);
    const owner = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Summer", [story.id]));
    const target = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Winter", []));

    const result = await HighlightHelper.addStoryToHighlight(target.id, u.id, story.id);
    expect(result).toEqual({
      error: 'Already in "Summer" highlight',
      conflictHighlightId: owner.id,
    });
  });

  test("a soft-deleted highlight does not block re-adding the story elsewhere", async () => {
    const u = await makeUser();
    const story = await makeImageStory(u.id);
    const old = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Old", [story.id]));
    await HighlightHelper.deleteHighlight(old.id, u.id);

    const fresh = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Fresh", []));
    const result = await HighlightHelper.addStoryToHighlight(fresh.id, u.id, story.id);

    expect(result.success).toBe(true);
  });

  test("another user's highlight containing the story does not create a conflict", async () => {
    // The conflict scan is scoped to authorId, so two users can independently
    // highlight stories without interfering.
    const u = await makeUser();
    const other = await makeUser();
    const myStory = await makeImageStory(u.id);
    const theirStory = await makeImageStory(other.id);

    await trackHighlight(await HighlightHelper.createHighlight(other.id, "Theirs", [theirStory.id]));
    const mine = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Mine", []));

    expect((await HighlightHelper.addStoryToHighlight(mine.id, u.id, myStory.id)).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("highlightHelpers — removeSnapshotFromHighlight", () => {
  test("removes the snapshot and leaves the rest in order", async () => {
    const u = await makeUser();
    const s1 = await makeImageStory(u.id);
    const s2 = await makeImageStory(u.id);
    const s3 = await makeImageStory(u.id);
    const h = await trackHighlight(
      await HighlightHelper.createHighlight(u.id, "Trim", [s1.id, s2.id, s3.id])
    );

    const middle = h.snapshots.find((s) => s.storyId === s2.id);
    const result = await HighlightHelper.removeSnapshotFromHighlight(h.id, u.id, middle.id);

    expect(result.success).toBe(true);
    expect(result.highlight.snapshots.map((s) => s.storyId)).toEqual([s1.id, s3.id]);
  });

  test("recalculates the cover when the removed snapshot was the cover", async () => {
    const u = await makeUser();
    const s1 = await makeImageStory(u.id, { url: "https://cdn/one.jpg" });
    const s2 = await makeImageStory(u.id, { url: "https://cdn/two.jpg" });
    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Recover", [s1.id, s2.id]));
    expect(h.coverImage).toBe("https://cdn/one.jpg");

    const coverSnap = h.snapshots.find((s) => s.url === "https://cdn/one.jpg");
    await HighlightHelper.removeSnapshotFromHighlight(h.id, u.id, coverSnap.id);

    const row = await rawHighlight(h.id);
    expect(row.coverImage).toBe("https://cdn/two.jpg"); // promoted the survivor
  });

  test("clears the cover when the last media snapshot is removed", async () => {
    const u = await makeUser();
    const img = await makeImageStory(u.id, { url: "https://cdn/only.jpg" });
    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "LastMedia", [img.id]));

    const snap = h.snapshots[0];
    const result = await HighlightHelper.removeSnapshotFromHighlight(h.id, u.id, snap.id);

    expect(result.highlight.snapshots).toEqual([]); // empty highlight
    const row = await rawHighlight(h.id);
    expect(row.coverImage).toBeNull();
  });

  test("leaves a non-cover removal's cover alone", async () => {
    const u = await makeUser();
    const cover = await makeImageStory(u.id, { url: "https://cdn/keep.jpg" });
    const extra = await makeImageStory(u.id, { url: "https://cdn/drop.jpg" });
    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "KeepIt", [cover.id, extra.id]));

    const dropSnap = h.snapshots.find((s) => s.url === "https://cdn/drop.jpg");
    await HighlightHelper.removeSnapshotFromHighlight(h.id, u.id, dropSnap.id);

    const row = await rawHighlight(h.id);
    expect(row.coverImage).toBe("https://cdn/keep.jpg");
  });

  test("rejects an unknown snapshot id, a foreign highlight, and a missing highlight", async () => {
    const u = await makeUser();
    const other = await makeUser();
    const story = await makeImageStory(u.id);
    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Guard", [story.id]));
    const snapId = h.snapshots[0].id;

    expect(await HighlightHelper.removeSnapshotFromHighlight(h.id, u.id, "no-such-snap")).toEqual({
      error: "Snapshot not found",
    });
    expect(await HighlightHelper.removeSnapshotFromHighlight(h.id, other.id, snapId)).toEqual({
      error: "Highlight not found",
    });
    expect(await HighlightHelper.removeSnapshotFromHighlight(MISSING, u.id, snapId)).toEqual({
      error: "Highlight not found",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("highlightHelpers — deleteHighlight", () => {
  test("soft-deletes for the owner, returning the pre-delete projection", async () => {
    const u = await makeUser();
    const story = await makeImageStory(u.id);
    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Bye", [story.id]));

    const returned = await HighlightHelper.deleteHighlight(h.id, u.id);

    expect(Object.keys(returned).sort()).toEqual(
      ["authorId", "id", "isDeleted", "snapshots"].sort()
    );
    expect(returned.isDeleted).toBe(false); // state BEFORE the delete
    expect(returned.snapshots.length).toBe(1);

    const row = await rawHighlight(h.id);
    expect(row.isDeleted).toBe(true);
    // PRESERVED BEHAVIOR: the helper writes ONLY isDeleted — never deletedAt,
    // even though the column exists. Pinned because HighlightRepository
    // .delete() *does* write deletedAt, so routing this through it would
    // silently change what gets persisted.
    expect(row.deletedAt).toBeNull();
  });

  test("returns null for a non-owner, an already-deleted highlight, and a missing id", async () => {
    const u = await makeUser();
    const other = await makeUser();
    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Once", []));

    expect(await HighlightHelper.deleteHighlight(h.id, other.id)).toBeNull();
    expect(await HighlightHelper.deleteHighlight(MISSING, u.id)).toBeNull();

    expect(await HighlightHelper.deleteHighlight(h.id, u.id)).not.toBeNull();
    expect(await HighlightHelper.deleteHighlight(h.id, u.id)).toBeNull(); // second attempt
  });

  test("a rejected delete leaves the row untouched", async () => {
    const u = await makeUser();
    const other = await makeUser();
    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Safe", []));

    await HighlightHelper.deleteHighlight(h.id, other.id);

    const row = await rawHighlight(h.id);
    expect(row.isDeleted).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// REPOSITORY HAZARD REGRESSIONS (Phase 7A Milestone 5)
//
// Three ways a naive repository substitution would have silently changed
// behavior in this domain. None are "fixed" — each repository method is
// correct for its own contract; highlightHelpers simply must not use the
// obvious-looking one. Pinned here so the constraints are executable
// knowledge, and so a future change to either side fails loudly.
// ─────────────────────────────────────────────────────────────────────────
describe("HighlightRepository — delete() vs update() divergence (Phase 7A hazard)", () => {
  test("delete() stamps deletedAt, which deleteHighlight must NOT do", async () => {
    const u = await makeUser();
    const viaRepoDelete = await trackHighlight(await HighlightHelper.createHighlight(u.id, "RepoDel", []));
    const viaHelper = await trackHighlight(await HighlightHelper.createHighlight(u.id, "HelperDel", []));

    await highlightRepository.delete(viaRepoDelete.id);
    await HighlightHelper.deleteHighlight(viaHelper.id, u.id);

    const repoRow = await rawHighlight(viaRepoDelete.id);
    const helperRow = await rawHighlight(viaHelper.id);

    // both soft-delete...
    expect(repoRow.isDeleted).toBe(true);
    expect(helperRow.isDeleted).toBe(true);

    // ...but only the repository's delete() writes deletedAt.
    expect(repoRow.deletedAt).toBeInstanceOf(Date);
    expect(helperRow.deletedAt).toBeNull();
  });
});

describe("HighlightRepository — findById joins `stories` unless projected (Phase 7A hazard)", () => {
  test("findById with no select joins the HighlightStory relation this helper never uses", async () => {
    const u = await makeUser();
    const story = await makeImageStory(u.id);
    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Joined", [story.id]));

    const withInclude = await highlightRepository.findById(h.id);

    // The relation is joined and returned — an extra table read, and a key
    // the helper's own projections never contain.
    expect(Array.isArray(withInclude.stories)).toBe(true);
    // Membership actually lives in the snapshots Json[] column, NOT in the
    // HighlightStory join table — which this helper never writes.
    expect(withInclude.stories.length).toBe(0);
    expect(withInclude.snapshots.length).toBe(1);
  });

  test("findById with a select projects instead, with no `stories` key", async () => {
    const u = await makeUser();
    const story = await makeImageStory(u.id);
    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Projected", [story.id]));

    const projected = await highlightRepository.findById(h.id, {
      select: { id: true, authorId: true, snapshots: true, coverImage: true },
    });

    expect(Object.keys(projected).sort()).toEqual(
      ["authorId", "coverImage", "id", "snapshots"].sort()
    );
    expect(projected.stories).toBeUndefined();
  });
});

describe("Highlight repositories — unbounded reads vs findMany cap (Phase 7A hazard)", () => {
  const CAP = 20; // toPrismaPagination()'s default limit
  let bulkUser;
  let highlightCount;

  beforeAll(async () => {
    bulkUser = await makeUser();
    highlightCount = CAP + 3; // deliberately more than the default cap
    for (let i = 0; i < highlightCount; i++) {
      await trackHighlight(await HighlightHelper.createHighlight(bulkUser.id, `H${i}`, []));
    }
  });

  test("findMany(filter) with no pagination silently caps at the default limit", async () => {
    const capped = await highlightRepository.findMany({ authorId: bulkUser.id });
    expect(capped.length).toBe(CAP);
    expect(capped.length).toBeLessThan(highlightCount); // rows were dropped
  });

  test("getMyHighlights returns every live highlight, uncapped", async () => {
    const all = await HighlightHelper.getMyHighlights(bulkUser.id);
    expect(all.length).toBe(highlightCount);
    expect(all.length).toBeGreaterThan(CAP); // proves no silent truncation
  });

  test("the duplicate scan sees every other highlight, so a conflict past the cap is still caught", async () => {
    // Park a story in the FIRST-created highlight, then try to add it to a
    // brand-new one. With a 20-row cap the older highlight would fall outside
    // the scan window and the duplicate would slip through.
    const story = await makeImageStory(bulkUser.id);
    const oldest = (await HighlightHelper.getMyHighlights(bulkUser.id)).at(-1);
    await HighlightHelper.addStoryToHighlight(oldest.id, bulkUser.id, story.id);

    const fresh = await trackHighlight(
      await HighlightHelper.createHighlight(bulkUser.id, "Fresh Target", [])
    );
    const result = await HighlightHelper.addStoryToHighlight(fresh.id, bulkUser.id, story.id);

    expect(result.conflictHighlightId).toBe(oldest.id);
    expect(result.error).toContain(oldest.title);
  });

  test("createHighlight's story lookup is uncapped, so a large highlight keeps every story", async () => {
    const u = await makeUser();
    const ids = [];
    for (let i = 0; i < CAP + 3; i++) {
      ids.push((await makeImageStory(u.id)).id);
    }

    const h = await trackHighlight(await HighlightHelper.createHighlight(u.id, "Big", ids));
    expect(h.snapshots.length).toBe(ids.length);
    expect(h.snapshots.length).toBeGreaterThan(CAP);

    // and the repository method it relies on is itself uncapped
    const owned = await storyRepository.findOwnedByIds(ids, u.id, { select: { id: true } });
    expect(owned.length).toBe(ids.length);
  });
});
