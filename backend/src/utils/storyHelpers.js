import { transactionRunner } from "../config/transaction.js";
import { storyRepository, storyViewRepository } from "../config/repositories.js";

// Persistence for the story domain now flows through the repository layer
// (Phase 7A) instead of the Prisma client directly. Database/behavior are
// unchanged — every query below is the same shape as the prisma.* call it
// replaces; only the access path moved.
//
// Two deliberate deviations from the "obvious" repository method, both to
// preserve behavior exactly:
//
//   • deleteStory calls storyRepository.update(id, { isDeleted: true })
//     rather than storyRepository.delete(id). The repository's delete()
//     also stamps deletedAt; the original helper never did. Using it would
//     silently change what gets persisted.
//
//   • Every findById here passes includeDeleted: true. The original
//     findUnique calls did not filter on isDeleted — each helper performs
//     its OWN isDeleted/expiresAt check and decides what to return. Letting
//     the repository filter the row out instead would move that decision
//     out of the helper.
//
// Stories 24 hours mein expire hoti hain
const getStoryExpiry = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

// ── Create media story ──────────────────────────────
export const createMediaStory = async (userId, media, caption, audience) => {
  return storyRepository.create({
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
  });
};

// ── Create text story ───────────────────────────────
export const createTextStory = async (userId, text, background, textAlign, audience) => {
  return storyRepository.create({
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
  });
};

// ── Get stories feed (public + non-expired) ─────────
export const getStoriesFeed = async (userId) => {
  const now = new Date();

  const stories = await storyRepository.findPublicActiveWithAuthor({ now });

  return stories;
};

// ── Get viewed status (batch) ───────────────────────
export const getViewedStories = async (storyIds, userId) => {
  const records = await storyViewRepository.findViewedByViewer(storyIds, userId);

  const viewedMap = new Map(
    records.map((v) => [v.storyId, { viewed: true, reaction: v.reaction }])
  );

  return viewedMap;
};

// ── View story ──────────────────────────────────────
export const viewStory = async (storyId, userId) => {
  const story = await storyRepository.findById(storyId, {
    includeDeleted: true,
    select: { authorId: true, isDeleted: true, expiresAt: true },
  });

  if (!story || story.isDeleted || story.expiresAt < new Date()) {
    return null;
  }

  if (String(story.authorId) === String(userId)) {
    return { selfView: true };
  }

  const existing = await storyViewRepository.findByStoryAndViewer(storyId, userId);

  if (!existing) {
    try {
      await transactionRunner.run(async (tx) => {
        await storyViewRepository.create({ viewerId: userId, storyId }, { tx });
        await storyRepository.update(storyId, { viewsCount: { inc: 1 } }, { tx });
      });
    } catch (err) {
      if (err.code !== "P2002") throw err;
      // Race lost — someone else's request already recorded the view
      return { selfView: false, alreadyViewed: true };
    }
  }

  return { selfView: false, alreadyViewed: !!existing };
};

// ── React to story ──────────────────────────────────
export const reactToStory = async (storyId, userId, reaction) => {
  const story = await storyRepository.findById(storyId, {
    includeDeleted: true,
    select: { authorId: true, isDeleted: true, expiresAt: true, reactionsCount: true },
  });

  if (!story || story.isDeleted || story.expiresAt < new Date()) {
    return null;
  }

  const existing = await storyViewRepository.findByStoryAndViewer(storyId, userId);

  const hadReaction = !!existing?.reaction;
  const hasReaction = !!reaction;

  let reactionDelta = 0;
  if (!hadReaction && hasReaction)  reactionDelta =  1;
  else if (hadReaction && !hasReaction) reactionDelta = -1;

  try {
    if (existing) {
      await storyViewRepository.update(existing.id, { reaction: reaction || null });
    } else {
      await storyViewRepository.create({ viewerId: userId, storyId, reaction: reaction || null });
    }
  } catch (err) {
    if (err.code === "P2002") {
      // Race lost — retry as update since the row now exists
      await storyViewRepository.updateByStoryAndViewer(storyId, userId, {
        reaction: reaction || null,
      });
    } else {
      throw err;
    }
  }

  if (reactionDelta !== 0) {
    await storyRepository.update(storyId, { reactionsCount: { inc: reactionDelta } });
  }

  const updated = await storyRepository.findById(storyId, {
    includeDeleted: true,
    select: { reactionsCount: true },
  });

  return { reactionsCount: updated?.reactionsCount || 0 };
};

// ── Get story viewers (author only) ─────────────────
export const getStoryViewers = async (storyId, userId, limit = 30) => {
  const story = await storyRepository.findById(storyId, {
    includeDeleted: true,
    select: { authorId: true, viewsCount: true },
  });

  if (!story || String(story.authorId) !== String(userId)) {
    return null;
  }

  const viewers = await storyViewRepository.findViewersWithProfile(storyId, { limit });

  return {
   // NAYA
viewers: viewers.map((v) => ({ viewer: v.viewer, reaction: v.reaction, viewedAt: v.viewedAt })),
    viewsCount: story.viewsCount,
  };
};

// ── Delete story ────────────────────────────────────
export const deleteStory = async (storyId, userId) => {
  const story = await storyRepository.findById(storyId, {
    includeDeleted: true,
    select: { authorId: true, isDeleted: true, media: true, type: true },
  });

  if (!story || story.isDeleted || String(story.authorId) !== String(userId)) {
    return null;
  }

  // update(), NOT delete() — see the header note: delete() would also
  // stamp deletedAt, which the original query never wrote.
  await storyRepository.update(storyId, { isDeleted: true });

  return story;
};

// ── Story author id (for reaction-notification routing) ─────────────
//    Extracted verbatim from story.controller.js so the controller no
//    longer touches Prisma directly — Milestone 5 helpers-as-boundary.
//    Byte-identical query; returns null for a missing story, as findUnique does.
export const getStoryAuthorId = async (storyId) => {
  return storyRepository.findById(storyId, {
    includeDeleted: true,
    select: { authorId: true },
  });
};

// ── Viewer's current reaction on a story (for like-toggle state) ────
//    Extracted verbatim from story.controller.js's toggleStoryLike.
export const getStoryViewReaction = async (storyId, viewerId) => {
  return storyViewRepository.findByStoryAndViewer(storyId, viewerId, {
    select: { reaction: true },
  });
};

// ── Check if already viewed ─────────────────────────
export const isAlreadyViewed = async (storyId, userId) => {
  const view = await storyViewRepository.findByStoryAndViewer(storyId, userId, {
    select: { id: true },
  });
  return !!view;
};
