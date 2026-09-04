

import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import { deleteFromCloudinary } from "../../helper/cloudinaryUpload.js";
import { notifyChat } from "../../helper/notifyChat.js";
import * as StoryHelper from "../../utils/storyHelpers.js";
import * as HighlightHelper from "../../utils/highlightHelpers.js";
import redis from "../../config/redis.js";
const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ─────────────────────────────────────────────
//  POST /api/v2/stories — Create media story
// ─────────────────────────────────────────────

export const createStory = asyncHandler(async (req, res, next) => {
  const { caption = "", audience = "public", media } = req.body;

  if (!media?.url || !media?.publicId) {
    return next(new AppError("Media required.", 400));
  }

  const allowedResourceTypes = ["image", "video"];
  if (!allowedResourceTypes.includes(media.resourceType)) {
    return next(new AppError("Invalid media resourceType.", 400));
  }

  const story = await StoryHelper.createMediaStory(req.user.id, media, caption, audience);
  await redis.del(`stories:feed:${req.user.id}`).catch(() => {});

  return res.status(201).json({ success: true, story });
});

// ─────────────────────────────────────────────
//  POST /api/v2/stories/text — Create text story
// ─────────────────────────────────────────────

export const createTextStory = asyncHandler(async (req, res, next) => {
  const { text, background, textAlign, audience = "public" } = req.body;

  if (!text?.trim()) return next(new AppError("Text is required.", 400));

  if (text.trim().length > 500) {
    return next(new AppError("Text story cannot exceed 500 characters.", 400));
  }

  const allowedAligns = ["left", "center", "right"];
  if (textAlign && !allowedAligns.includes(textAlign)) {
    return next(new AppError("textAlign must be left, center, or right.", 400));
  }

  const story = await StoryHelper.createTextStory(req.user.id, text, background, textAlign, audience);
  await redis.del(`stories:feed:${req.user.id}`).catch(() => {});

  return res.status(201).json({ success: true, story });
});

// ─────────────────────────────────────────────
//  GET /api/v2/stories/feed — Stories feed
// ─────────────────────────────────────────────

export const getStoriesFeed = asyncHandler(async (req, res) => {
  const cacheKey = `stories:feed:${req.user.id}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, feed: JSON.parse(cached), fromCache: true });
    }
  } catch {}

  const stories = await StoryHelper.getStoriesFeed(req.user.id);

  if (!stories.length) {
    return res.status(200).json({ success: true, feed: [] });
  }

  const storyIds = stories.map((s) => s.id);
  const viewedMap = await StoryHelper.getViewedStories(storyIds, req.user.id);

  // Group by author
  const grouped = {};
  for (const story of stories) {
    const authorId = story.author.id;
    const viewRecord = viewedMap.get(story.id);
    const hasViewed = !!viewRecord;
    const isLiked = viewRecord?.reaction === "❤️";

    if (!grouped[authorId]) {
      grouped[authorId] = {
        author: story.author,
        stories: [],
        hasUnwatched: false,
      };
    }

    if (!hasViewed) grouped[authorId].hasUnwatched = true;
    grouped[authorId].stories.push({ ...story, isLiked, hasViewed });
  }

  const myId = req.user.id;
  const result = Object.values(grouped).sort((a, b) => {
    if (a.author.id === myId) return -1;
    if (b.author.id === myId) return 1;
    return b.hasUnwatched - a.hasUnwatched;
  });

  try {
    await redis.set(cacheKey, JSON.stringify(result), { ex: 300 });
  } catch {}

  return res.status(200).json({ success: true, feed: result });
});

// ─────────────────────────────────────────────
//  POST /api/v2/stories/:id/view — Record view
// ─────────────────────────────────────────────

export const viewStory = asyncHandler(async (req, res, next) => {
  if (!isValidUUID(req.params.id)) {
    return next(new AppError("Invalid story ID.", 400));
  }

  const alreadySeen = await StoryHelper.isAlreadyViewed(req.params.id, req.user.id);

  if (!alreadySeen) {
    const result = await StoryHelper.viewStory(req.params.id, req.user.id);
    if (!result) {
      return next(new AppError("Story not found or expired.", 404));
    }
  }

  return res.status(200).json({ success: true, alreadyViewed: alreadySeen });
});

// ─────────────────────────────────────────────
//  POST /api/v2/stories/:id/react — React to story
// ─────────────────────────────────────────────

export const reactToStory = asyncHandler(async (req, res, next) => {
  if (!isValidUUID(req.params.id)) {
    return next(new AppError("Invalid story ID.", 400));
  }

  const { reaction } = req.body;

  if (reaction !== null && typeof reaction !== "string") {
    return next(new AppError("Invalid reaction.", 400));
  }

  if (reaction && reaction.length > 10) {
    return next(new AppError("Reaction too long.", 400));
  }

  const result = await StoryHelper.reactToStory(req.params.id, req.user.id, reaction);
  if (!result) {
    return next(new AppError("Story not found or expired.", 404));
  }

  const story = await StoryHelper.getStoryAuthorId(req.params.id);

  if (reaction && story?.authorId !== req.user.id) {
    notifyChat("/notify/story-reaction", {
      to: story.authorId,
      from: req.user.id,
      storyId: req.params.id,
      reaction,
    }).catch(() => {});
  }

  return res.status(200).json({ success: true, reactionsCount: result.reactionsCount });
});

// ─────────────────────────────────────────────
//  POST /api/v2/stories/:id/like — Toggle ❤️
// ─────────────────────────────────────────────

export const toggleStoryLike = asyncHandler(async (req, res, next) => {
  if (!isValidUUID(req.params.id)) {
    return next(new AppError("Invalid story ID.", 400));
  }

  const existing = await StoryHelper.getStoryViewReaction(req.params.id, req.user.id);

  const wasLiked = existing?.reaction === "❤️";
  const newReaction = wasLiked ? null : "❤️";

  const result = await StoryHelper.reactToStory(req.params.id, req.user.id, newReaction);
  if (!result) {
    return next(new AppError("Story not found or expired.", 404));
  }

  const liked = !wasLiked;

  const story = await StoryHelper.getStoryAuthorId(req.params.id);

  if (!story) {
    return next(new AppError("Story not found.", 404));
  }

  if (liked && story.authorId !== req.user.id) {
    notifyChat("/notify/story-reaction", {
      to: story.authorId,
      from: req.user.id,
      storyId: req.params.id,
      reaction: "❤️",
    }).catch(() => {});
  }

  await Promise.all([
    redis.del(`stories:feed:${req.user.id}`),
    redis.del(`stories:feed:${story.authorId}`),
  ]).catch(() => {});

  return res.status(200).json({
    success: true,
    liked,
    reactionsCount: result.reactionsCount,
  });
});

// ─────────────────────────────────────────────
//  GET /api/v2/stories/:id/viewers
// ─────────────────────────────────────────────

export const getStoryViewers = asyncHandler(async (req, res, next) => {
  if (!isValidUUID(req.params.id)) {
    return next(new AppError("Invalid story ID.", 400));
  }

  const limit = Math.min(parseInt(req.query.limit) || 30, 100);

  const result = await StoryHelper.getStoryViewers(req.params.id, req.user.id, limit);
  if (!result) {
    return next(new AppError("Story not found.", 404));
  }

  return res.status(200).json({
    success: true,
    viewers: result.viewers,
    viewsCount: result.viewsCount,
  });
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/stories/:id
// ─────────────────────────────────────────────

export const deleteStory = asyncHandler(async (req, res, next) => {
  if (!isValidUUID(req.params.id)) {
    return next(new AppError("Invalid story ID.", 400));
  }

  const story = await StoryHelper.deleteStory(req.params.id, req.user.id);
  if (!story) {
    return next(new AppError("Story not found.", 404));
  }

  if (story.type !== "text" && story.media?.publicId) {
    await deleteFromCloudinary(story.media.publicId, story.media.resourceType).catch(() => {});
  }

  await redis.del(`stories:feed:${req.user.id}`).catch(() => {});

  return res.status(200).json({ success: true, message: "Story deleted." });
});

// ─────────────────────────────────────────────
//  POST /api/v2/highlights — Create highlight
// ─────────────────────────────────────────────

export const createHighlight = asyncHandler(async (req, res, next) => {
  const { title, storyIds } = req.body;

  if (!title?.trim()) {
    return next(new AppError("Highlight title is required.", 400));
  }

  if (title.trim().length > 30) {
    return next(new AppError("Highlight title cannot exceed 30 characters.", 400));
  }

  if (storyIds?.length > 100) {
    return next(new AppError("Highlight cannot have more than 100 stories.", 400));
  }

  if (storyIds?.length) {
    const invalidId = storyIds.find((id) => !isValidUUID(id));
    if (invalidId) return next(new AppError("Invalid storyId in list.", 400));
  }

  const highlight = await HighlightHelper.createHighlight(req.user.id, title, storyIds || []);

  return res.status(201).json({ success: true, highlight });
});

// ─────────────────────────────────────────────
//  GET /api/v2/stories/highlights/my
// ─────────────────────────────────────────────

export const getMyHighlights = asyncHandler(async (req, res) => {
  const highlights = await HighlightHelper.getMyHighlights(req.user.id);
  return res.status(200).json({ success: true, highlights });
});

// ─────────────────────────────────────────────
//  POST /api/v2/stories/highlights/:id/add
// ─────────────────────────────────────────────

export const addToHighlight = asyncHandler(async (req, res, next) => {
  const { storyId } = req.body;

  if (!storyId) {
    return next(new AppError("storyId is required.", 400));
  }

  if (!isValidUUID(storyId) || !isValidUUID(req.params.id)) {
    return next(new AppError("Invalid ID.", 400));
  }

  const result = await HighlightHelper.addStoryToHighlight(req.params.id, req.user.id, storyId);

  if (result.error) {
    if (result.error.includes("not found")) {
      return next(new AppError(result.error, 404));
    }
    if (result.error.includes("Already in")) {
      return res.status(400).json({
        success: false,
        message: result.error,
        conflictHighlightId: result.conflictHighlightId,
      });
    }
    return next(new AppError(result.error, 400));
  }

  return res.status(200).json({ success: true, highlight: result.highlight });
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/stories/highlights/:id
// ─────────────────────────────────────────────

export const deleteHighlight = asyncHandler(async (req, res, next) => {
  if (!isValidUUID(req.params.id)) {
    return next(new AppError("Invalid highlight ID.", 400));
  }

  const highlight = await HighlightHelper.deleteHighlight(req.params.id, req.user.id);
  if (!highlight) {
    return next(new AppError("Highlight not found.", 404));
  }

  await Promise.all(
    highlight.snapshots
      .filter((s) => s.publicId)
      .map((s) => deleteFromCloudinary(s.publicId, s.resourceType).catch(() => {}))
  );

  return res.status(200).json({ success: true, message: "Highlight deleted." });
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/stories/highlights/:id/snap/:snapId
// ─────────────────────────────────────────────

export const removeSnapFromHighlight = asyncHandler(async (req, res, next) => {
  const { id: highlightId, snapId } = req.params;

  if (!isValidUUID(highlightId) || !isValidUUID(snapId)) {
    return next(new AppError("Invalid ID.", 400));
  }

  const result = await HighlightHelper.removeSnapshotFromHighlight(highlightId, req.user.id, snapId);

  if (result.error) {
    return next(new AppError(result.error, 404));
  }

  return res.status(200).json({ success: true, highlight: result.highlight });
});