import prisma from "../config/prisma.js";

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
    const stories = await prisma.story.findMany({
      where: {
        id: { in: storyIds },
        authorId: userId,
        isDeleted: false,
      },
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

  return prisma.highlight.create({
    data: {
      authorId: userId,
      title: title.trim(),
      coverImage,
      snapshots,
    },
  });
};

// ── Get my highlights ───────────────────────────────
export const getMyHighlights = async (userId) => {
  return prisma.highlight.findMany({
    where: {
      authorId: userId,
      isDeleted: false,
    },
    select: {
      id: true,
      title: true,
      coverImage: true,
      snapshots: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

// ── Add story to highlight ──────────────────────────
export const addStoryToHighlight = async (highlightId, userId, storyId) => {
  const [story, highlight] = await Promise.all([
    prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, authorId: true, isDeleted: true, type: true, media: true, textContent: true },
    }),
    prisma.highlight.findUnique({
      where: { id: highlightId },
      select: { id: true, authorId: true, snapshots: true, coverImage: true },
    }),
  ]);

  if (!story || story.authorId !== userId || story.isDeleted) {
    return { error: "Story not found" };
  }

  if (!highlight || highlight.authorId !== userId) {
    return { error: "Highlight not found" };
  }

  const alreadyExists = highlight.snapshots.some((s) => s.storyId === storyId);
  if (alreadyExists) {
    return { error: "Story already in highlight" };
  }

  // Check if story in another highlight.
  // NOTE: `snapshots` is a Json[] field, not a relation — Prisma's relational
  // filters (`some`, `none`, etc.) only work on actual relations, not on Json
  // columns. So we fetch the candidate highlights and check in JS instead.
  const otherHighlights = await prisma.highlight.findMany({
    where: {
      authorId: userId,
      isDeleted: false,
      id: { not: highlightId },
    },
    select: { id: true, title: true, snapshots: true },
  });

  const conflictHighlight = otherHighlights.find((h) =>
    h.snapshots.some((s) => s.storyId === storyId)
  );

  if (conflictHighlight) {
    return {
      error: `Already in "${conflictHighlight.title}" highlight`,
      conflictHighlightId: conflictHighlight.id,
    };
  }

  const snapshotData = await buildSnapshot(story);

  const updated = await prisma.highlight.update({
    where: { id: highlightId },
    data: {
      snapshots: {
        push: snapshotData,
      },
    },
  });

  // Update cover if empty
  if (!highlight.coverImage && snapshotData.url) {
    const cover = snapshotData.thumbnailUrl || snapshotData.url;
    await prisma.highlight.update({
      where: { id: highlightId },
      data: { coverImage: cover },
    });
  }

  return { success: true, highlight: updated };
};

// ── Remove snapshot from highlight ──────────────────
export const removeSnapshotFromHighlight = async (highlightId, userId, snapId) => {
  const highlight = await prisma.highlight.findUnique({
    where: { id: highlightId },
    select: { id: true, authorId: true, snapshots: true, coverImage: true },
  });

  if (!highlight || highlight.authorId !== userId) {
    return { error: "Highlight not found" };
  }

  const snap = highlight.snapshots.find((s) => s.id === snapId);
  if (!snap) {
    return { error: "Snapshot not found" };
  }

  // NOTE: `snapshots` is a Json[] field, not a relation, so `deleteMany`
  // (a relation-only operation) doesn't apply here. We filter the array in
  // JS and overwrite the whole field with `set`.
  const remainingSnapshots = highlight.snapshots.filter((s) => s.id !== snapId);

  const updated = await prisma.highlight.update({
    where: { id: highlightId },
    data: {
      snapshots: {
        set: remainingSnapshots,
      },
    },
  });

  // Update cover if deleted snapshot was cover
  if (highlight.coverImage === snap.url || highlight.coverImage === snap.thumbnailUrl) {
    const nextSnap = updated.snapshots.find((s) => s.url);
    const newCover = nextSnap?.thumbnailUrl || nextSnap?.url || null;
    await prisma.highlight.update({
      where: { id: highlightId },
      data: { coverImage: newCover },
    });
  }

  return { success: true, highlight: updated };
};

// ── Delete highlight ────────────────────────────────
export const deleteHighlight = async (highlightId, userId) => {
  const highlight = await prisma.highlight.findUnique({
    where: { id: highlightId },
    select: { id: true, authorId: true, isDeleted: true, snapshots: true },
  });

  if (!highlight || highlight.isDeleted || highlight.authorId !== userId) {
    return null;
  }

  await prisma.highlight.update({
    where: { id: highlightId },
    data: { isDeleted: true },
  });

  return highlight;
};