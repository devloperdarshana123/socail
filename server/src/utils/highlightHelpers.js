import { highlightRepository, storyRepository } from "../config/repositories.js";

// Persistence for the highlight domain now flows through the repository
// layer (Phase 7A) instead of the Prisma client directly. Database/behavior
// are unchanged — every query below is the same shape as the prisma.* call
// it replaces; only the access path moved.
//
// Three deliberate deviations from the "obvious" repository method, all to
// preserve behavior exactly:
//
//   • deleteHighlight calls highlightRepository.update(id, { isDeleted: true })
//     rather than .delete(id). The repository's delete() also stamps
//     deletedAt; the original helper never did.
//
//   • Every findById here passes a `select`. Without one the repository
//     joins the `stories` relation (HighlightStory rows) — a table this
//     helper never touches, since it tracks membership in the `snapshots`
//     Json[] column instead.
//
//   • The two list reads use dedicated unbounded repository methods rather
//     than findMany(), which would silently cap them at 20 rows.
//
// NO TRANSACTIONS: this helper has none, before or after the migration.
// addStoryToHighlight and removeSnapshotFromHighlight each issue their
// conditional cover-image update as a SEPARATE statement from the snapshot
// write, so a crash between the two leaves the cover stale. Pre-existing
// behavior, deliberately preserved.

const buildVideoThumbnail = (url) =>
  url
    .replace("/upload/", "/upload/so_0,f_jpg/")
    .replace(/\.(mp4|webm|mov|avi)$/i, ".jpg");

// ── Build snapshot from story ───────────────────────
export const buildSnapshot = async (story) => {
  if (story.type === "text") {
    return {
      id: crypto.randomUUID(),
      storyId: story.id,
      type: "text",
      textContent: story.textContent,
    };
  }

  return {
    id: crypto.randomUUID(),
    storyId: story.id,
    type: story.media?.resourceType || "image",
    url: story.media?.url || null,
    publicId: story.media?.publicId || null,
    resourceType: story.media?.resourceType || "image",
    thumbnailUrl:
      story.media?.resourceType === "video"
        ? buildVideoThumbnail(story.media.url)
        : null,
  };
};

// ── Create highlight ────────────────────────────────
export const createHighlight = async (userId, title, storyIds = []) => {
  let snapshots = [];

  if (storyIds.length > 0) {
    const stories = await storyRepository.findOwnedByIds(storyIds, userId, {
      select: {
        id: true,
        type: true,
        media: true,
        textContent: true,
      },
    });

    snapshots = (await Promise.all(stories.map(buildSnapshot))).filter(Boolean);
  }

  const firstMedia = snapshots.find((s) => s.type !== "text");
  const coverImage = firstMedia?.thumbnailUrl || firstMedia?.url || null;

  return highlightRepository.create({
    authorId: userId,
    title: title.trim(),
    coverImage,
    snapshots,
  });
};

// ── Get my highlights ───────────────────────────────
export const getMyHighlights = async (userId) => {
  return highlightRepository.findAllByAuthorWithSnapshots(userId, {
    select: {
      id: true,
      title: true,
      coverImage: true,
      snapshots: true,
      createdAt: true,
    },
  });
};

// ── Add story to highlight ──────────────────────────
export const addStoryToHighlight = async (highlightId, userId, storyId) => {
  const [story, highlight] = await Promise.all([
    storyRepository.findById(storyId, {
      includeDeleted: true,
      select: { id: true, authorId: true, isDeleted: true, type: true, media: true, textContent: true },
    }),
    highlightRepository.findById(highlightId, {
      select: { id: true, authorId: true, snapshots: true, coverImage: true },
    }),
  ]);

  if (!story || String(story.authorId) !== String(userId) || story.isDeleted) {
    return { error: "Story not found" };
  }

  if (!highlight || String(highlight.authorId) !== String(userId)) {
    return { error: "Highlight not found" };
  }

  const alreadyExists = highlight.snapshots.some((s) => String(s.storyId) === String(storyId));
  if (alreadyExists) {
    return { error: "Story already in highlight" };
  }

  // Check if story in another highlight.
  // NOTE: `snapshots` is a Json[] field, not a relation — Prisma's relational
  // filters (`some`, `none`, etc.) only work on actual relations, not on Json
  // columns. So we fetch the candidate highlights and check in JS instead.
  const otherHighlights = await highlightRepository.findAllOtherByAuthorWithSnapshots(
    userId,
    highlightId,
    { select: { id: true, title: true, snapshots: true } }
  );

  const conflictHighlight = otherHighlights.find((h) =>
    h.snapshots.some((s) => String(s.storyId) === String(storyId))
  );

  if (conflictHighlight) {
    return {
      error: `Already in "${conflictHighlight.title}" highlight`,
      conflictHighlightId: conflictHighlight.id,
    };
  }

  const snapshotData = await buildSnapshot(story);

  const updated = await highlightRepository.update(highlightId, {
    snapshots: {
      append: snapshotData,
    },
  });

  // Update cover if empty
  if (!highlight.coverImage && snapshotData.url) {
    const cover = snapshotData.thumbnailUrl || snapshotData.url;
    await highlightRepository.update(highlightId, { coverImage: cover });
  }

  return { success: true, highlight: updated };
};

// ── Remove snapshot from highlight ──────────────────
export const removeSnapshotFromHighlight = async (highlightId, userId, snapId) => {
  const highlight = await highlightRepository.findById(highlightId, {
    select: { id: true, authorId: true, snapshots: true, coverImage: true },
  });

  if (!highlight || String(highlight.authorId) !== String(userId)) {
    return { error: "Highlight not found" };
  }

  const snap = highlight.snapshots.find((s) => String(s.id) === String(snapId));
  if (!snap) {
    return { error: "Snapshot not found" };
  }

  // NOTE: `snapshots` is a Json[] field, not a relation, so `deleteMany`
  // (a relation-only operation) doesn't apply here. We filter the array in
  // JS and overwrite the whole field with `set`.
  const remainingSnapshots = highlight.snapshots.filter((s) => String(s.id) !== String(snapId));

  const updated = await highlightRepository.update(highlightId, {
    snapshots: {
      replace: remainingSnapshots,
    },
  });

  // Update cover if deleted snapshot was cover
  if (highlight.coverImage === snap.url || highlight.coverImage === snap.thumbnailUrl) {
    const nextSnap = updated.snapshots.find((s) => s.url);
    const newCover = nextSnap?.thumbnailUrl || nextSnap?.url || null;
    await highlightRepository.update(highlightId, { coverImage: newCover });
  }

  return { success: true, highlight: updated };
};

// ── Delete highlight ────────────────────────────────
export const deleteHighlight = async (highlightId, userId) => {
  const highlight = await highlightRepository.findById(highlightId, {
    select: { id: true, authorId: true, isDeleted: true, snapshots: true },
  });

  if (!highlight || highlight.isDeleted || String(highlight.authorId) !== String(userId)) {
    return null;
  }

  // update(), NOT delete() — see the header note: delete() would also
  // stamp deletedAt, which the original query never wrote.
  await highlightRepository.update(highlightId, { isDeleted: true });

  return highlight;
};
