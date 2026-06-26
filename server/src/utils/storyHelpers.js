

import prisma from "../config/prisma.js";

// Stories 24 hours mein expire hoti hain
const getStoryExpiry = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

// ── Create media story ──────────────────────────────
export const createMediaStory = async (userId, media, caption, audience) => {
  return prisma.story.create({
    data: {
      authorId:  userId,
      type:      "media",
      caption:   caption || "",
      audience:  audience || "public",
      expiresAt: getStoryExpiry(), // ✅ Required field
      media: {
        url:          media.url,
        publicId:     media.publicId,
        resourceType: media.resourceType,
        width:        media.width        || null,
        height:       media.height       || null,
        duration:     media.duration     || null,
        thumbnailUrl: media.thumbnailUrl || null,
      },
    },
  });
};

// ── Create text story ───────────────────────────────
export const createTextStory = async (userId, text, background, textAlign, audience) => {
  return prisma.story.create({
    data: {
      authorId:  userId,
      type:      "text",
      audience:  audience || "public",
      expiresAt: getStoryExpiry(), // ✅ Required field
      textContent: {
        text:       text.trim(),
        background: background || null,
        textAlign:  textAlign  || "center",
        textColor:  "#ffffff",
      },
    },
  });
};

// ── Get stories feed (public + non-expired) ─────────
export const getStoriesFeed = async (userId) => {
  const now = new Date();

  const stories = await prisma.story.findMany({
    where: {
      isDeleted: false,
      expiresAt: { gt: now },
      audience:  "public",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id:             true,
      type:           true,
      media:          true,
      textContent:    true,
      caption:        true,
      viewsCount:     true,
      reactionsCount: true,
      expiresAt:      true,
      createdAt:      true,
      author: {
        select: {
          id:             true,
          username:       true,
          fullName:       true,
          avatar:         true,
          isVerifiedBadge: true,
        },
      },
    },
  });

  return stories;
};

// ── Get viewed status (batch) ───────────────────────
export const getViewedStories = async (storyIds, userId) => {
  const records = await prisma.storyView.findMany({
    where: {
      storyId:  { in: storyIds },
      viewerId: userId,
    },
    select: { storyId: true, reaction: true },
  });

  const viewedMap = new Map(
    records.map((v) => [v.storyId, { viewed: true, reaction: v.reaction }])
  );

  return viewedMap;
};

// ── View story ──────────────────────────────────────
export const viewStory = async (storyId, userId) => {
  const story = await prisma.story.findUnique({
    where:  { id: storyId },
    select: { authorId: true, isDeleted: true, expiresAt: true },
  });

  if (!story || story.isDeleted || story.expiresAt < new Date()) {
    return null;
  }

  if (story.authorId === userId) {
    return { selfView: true };
  }

  const existing = await prisma.storyView.findUnique({
    where: { storyId_viewerId: { storyId, viewerId: userId } },
  });

  if (!existing) {
    await Promise.all([
      prisma.storyView.create({
        data: { viewerId: userId, storyId },
      }),
      prisma.story.update({
        where: { id: storyId },
        data:  { viewsCount: { increment: 1 } },
      }),
    ]);
  }

  return { selfView: false, alreadyViewed: !!existing };
};

// ── React to story ──────────────────────────────────
export const reactToStory = async (storyId, userId, reaction) => {
  const story = await prisma.story.findUnique({
    where:  { id: storyId },
    select: { authorId: true, isDeleted: true, expiresAt: true, reactionsCount: true },
  });

  if (!story || story.isDeleted || story.expiresAt < new Date()) {
    return null;
  }

  const existing = await prisma.storyView.findUnique({
    where: { storyId_viewerId: { storyId, viewerId: userId } },
  });

  const hadReaction = !!existing?.reaction;
  const hasReaction = !!reaction;

  let reactionDelta = 0;
  if (!hadReaction && hasReaction)  reactionDelta =  1;
  else if (hadReaction && !hasReaction) reactionDelta = -1;

  if (existing) {
    await prisma.storyView.update({
      where: { id: existing.id },
      data:  { reaction: reaction || null },
    });
  } else {
    await prisma.storyView.create({
      data: { viewerId: userId, storyId, reaction: reaction || null },
    });
  }

  if (reactionDelta !== 0) {
    await prisma.story.update({
      where: { id: storyId },
      data:  { reactionsCount: { increment: reactionDelta } },
    });
  }

  const updated = await prisma.story.findUnique({
    where:  { id: storyId },
    select: { reactionsCount: true },
  });

  return { reactionsCount: updated?.reactionsCount || 0 };
};

// ── Get story viewers (author only) ─────────────────
export const getStoryViewers = async (storyId, userId, limit = 30) => {
  const story = await prisma.story.findUnique({
    where:  { id: storyId },
    select: { authorId: true, viewsCount: true },
  });

  if (!story || story.authorId !== userId) {
    return null;
  }

  const viewers = await prisma.storyView.findMany({
    where:   { storyId },
    orderBy: { viewedAt: "desc" },
    take:    limit,
    select: {
      viewer: {
        select: {
          id:             true,
          username:       true,
          fullName:       true,
          avatar:         true,
          isVerifiedBadge: true,
        },
      },
      reaction: true,
      viewedAt: true,
    },
  });

  return {
   // NAYA
viewers: viewers.map((v) => ({ viewer: v.viewer, reaction: v.reaction, viewedAt: v.viewedAt })),
    viewsCount: story.viewsCount,
  };
};

// ── Delete story ────────────────────────────────────
export const deleteStory = async (storyId, userId) => {
  const story = await prisma.story.findUnique({
    where:  { id: storyId },
    select: { authorId: true, isDeleted: true, media: true, type: true },
  });

  if (!story || story.isDeleted || story.authorId !== userId) {
    return null;
  }

  await prisma.story.update({
    where: { id: storyId },
    data:  { isDeleted: true },
  });

  return story;
};

// ── Check if already viewed ─────────────────────────
export const isAlreadyViewed = async (storyId, userId) => {
  const view = await prisma.storyView.findUnique({
    where:  { storyId_viewerId: { storyId, viewerId: userId } },
    select: { id: true },
  });
  return !!view;
};