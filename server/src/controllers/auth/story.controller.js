
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import Story from "../../models/story.model.js";
import StoryView from "../../models/storyview.model.js";
import Highlight from "../../models/highlight.model.js";
import {
  deleteFromCloudinary,
  copyToCloudinary,
} from "../../helper/cloudinaryUpload.js";
import { notifyChat } from "../../helper/notifyChat.js";
import mongoose from "mongoose";
import {
  isAlreadyViewed,
  getFeedCache,
  setFeedCache,
  invalidateFeedCache,
} from "../../utils/storyCache.js";

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/**
 * validateObjectId — reusable guard for route params.
 * Prevents CastError crashes when malformed IDs are passed.
 * AUDIT FIX #1: no ObjectId validation existed — any string would reach DB
 * and cause an unhandled CastError instead of a clean 400.
 */
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * buildVideoThumbnail — centralized thumbnail URL builder.
 * AUDIT FIX #2: thumbnail logic was duplicated in 3 places with slight
 * differences. Single source of truth prevents drift.
 */
const buildVideoThumbnail = (url) =>
  url
    .replace("/upload/", "/upload/so_0,f_jpg/")
    .replace(/\.(mp4|webm|mov|avi)$/i, ".jpg");

/**
 * buildSnapshot — build a snapshot object from a Story document.
 * AUDIT FIX #3: snapshot building was duplicated in createHighlight
 * and addToHighlight with subtle differences. Centralized here.
 */
const buildSnapshot = async (story) => {
  if (story.type === "text") {
    return {
      storyId:     story._id,
      type:        "text",
      textContent: story.textContent,
    };
  }

  try {
    const copied = await copyToCloudinary(story.media.url, {
      folder:        "erovians/highlights",
      resource_type: story.media.resourceType,
    });
    return {
      storyId:      story._id,
      type:         story.media.resourceType,
      url:          copied.secure_url,
      publicId:     copied.public_id,
      resourceType: story.media.resourceType,
      thumbnailUrl:
        story.media.resourceType === "video"
          ? buildVideoThumbnail(copied.secure_url)
          : null,
    };
  } catch {
    // Cloudinary copy fail → original URL fallback (highlight still usable)
    return {
      storyId:      story._id,
      type:         story.media.resourceType,
      url:          story.media.url,
      publicId:     null,
      resourceType: story.media.resourceType,
      thumbnailUrl: null,
    };
  }
};

// ─────────────────────────────────────────────
//  POST /api/v2/stories — Create media story
// ─────────────────────────────────────────────
export const createStory = asyncHandler(async (req, res, next) => {
  const { caption = "", audience = "public", media } = req.body;

  if (!media?.url || !media?.publicId) {
    return next(new AppError("Media required.", 400));
  }

  // AUDIT FIX #4: resourceType whitelist check before hitting DB
  const allowedResourceTypes = ["image", "video"];
  if (!allowedResourceTypes.includes(media.resourceType)) {
    return next(new AppError("Invalid media resourceType.", 400));
  }

  const story = await Story.create({
    author: req.user._id,
    type:   "media",
    media: {
      url:          media.url,
      publicId:     media.publicId,
      resourceType: media.resourceType,
      width:        media.width    || null,
      height:       media.height   || null,
      duration:     media.duration || null,
      thumbnailUrl: media.thumbnailUrl || null,
    },
    caption,
    audience,
  });
await invalidateFeedCache(req.user._id.toString());
  return res.status(201).json({ success: true, story });
});

// ─────────────────────────────────────────────
//  POST /api/v2/stories/text — Create text story
// ─────────────────────────────────────────────
export const createTextStory = asyncHandler(async (req, res, next) => {
  const { text, background, textAlign, textColor, audience = "public" } = req.body;

  if (!text?.trim()) return next(new AppError("Text is required.", 400));

  // AUDIT FIX #5: length check is redundant — schema maxlength handles it.
  // But keeping explicit check here gives a cleaner error message to client
  // before it even reaches DB.
  if (text.trim().length > 500) {
    return next(new AppError("Text story cannot exceed 500 characters.", 400));
  }

  // AUDIT FIX #6: textAlign whitelist — schema validates but controller
  // should reject early with a clear message.
  const allowedAligns = ["left", "center", "right"];
  if (textAlign && !allowedAligns.includes(textAlign)) {
    return next(new AppError("textAlign must be left, center, or right.", 400));
  }

  const story = await Story.create({
    author: req.user._id,
    type:   "text",
    textContent: {
      text:      text.trim(),
      background,
      textAlign: textAlign || "center",
      textColor: textColor || "#ffffff",
    },
    audience,
  });
await invalidateFeedCache(req.user._id.toString());
  return res.status(201).json({ success: true, story });
});

// ─────────────────────────────────────────────
//  GET /api/v2/stories/feed — Stories feed
// ─────────────────────────────────────────────
export const getStoriesFeed = asyncHandler(async (req, res) => {
  const cached = await getFeedCache(req.user._id.toString());
  if (cached) {
    return res.status(200).json({ success: true, feed: cached, fromCache: true });
  }
  const now = new Date();

  const stories = await Story.find({
    isDeleted: false,
    expiresAt: { $gt: now },
    audience:  "public",
  })
    .sort({ createdAt: -1 })
    .populate("author", "username fullName avatar isVerifiedBadge")
    .select(
      "author media caption textContent type viewsCount reactionsCount expiresAt createdAt"
    )
    .lean();

  if (!stories.length) {
    return res.status(200).json({ success: true, feed: [] });
  }

  // Batch check — viewer ne kaun si stories dekhi
  const storyIds     = stories.map((s) => s._id);
  const viewedRecords = await StoryView.find({
    story:  { $in: storyIds },
    viewer: req.user._id,
  })
    .select("story reaction")
    .lean();

  // O(1) lookup map
  const viewedMap = new Map(
    viewedRecords.map((v) => [
      v.story.toString(),
      { viewed: true, reaction: v.reaction },
    ])
  );

  // Group by author
  const grouped = {};
  for (const story of stories) {
    const authorId   = story.author._id.toString();
    const storyIdStr = story._id.toString();
    const viewRecord = viewedMap.get(storyIdStr);
    const hasViewed  = !!viewRecord;
    const isLiked    = viewRecord?.reaction === "❤️";

    if (!grouped[authorId]) {
      grouped[authorId] = {
        author:       story.author,
        stories:      [],
        hasUnwatched: false,
      };
    }

    if (!hasViewed) grouped[authorId].hasUnwatched = true;
    grouped[authorId].stories.push({ ...story, isLiked, hasViewed });
  }

  // Sort: current user first → unwatched first → rest
  const myId   = req.user._id.toString();
  const result = Object.values(grouped).sort((a, b) => {
    if (a.author._id.toString() === myId) return -1;
    if (b.author._id.toString() === myId) return  1;
    return b.hasUnwatched - a.hasUnwatched;
  });

  await setFeedCache(req.user._id.toString(), result);
  return res.status(200).json({ success: true, feed: result });
});

// ─────────────────────────────────────────────
//  POST /api/v2/stories/:id/view — Record view
// ─────────────────────────────────────────────
export const viewStory = asyncHandler(async (req, res, next) => {
  // AUDIT FIX #1: ObjectId validation
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError("Invalid story ID.", 400));
  }

  const story = await Story.findOne({
    _id:       req.params.id,
    isDeleted: false,
    expiresAt: { $gt: new Date() },
  }).select("author").lean();

  if (!story) return next(new AppError("Story not found or expired.", 404));

  // Self-view skip
  if (story.author.toString() === req.user._id.toString()) {
    return res.status(200).json({ success: true, selfView: true });
  }


  // Redis dedup — 24h window mein ek baar hi DB write hoga
// ✅ NAYA — sirf yeh rakho
const alreadySeen = await isAlreadyViewed(req.params.id, req.user._id.toString());

if (!alreadySeen) {
  const result = await StoryView.recordView(req.params.id, req.user._id);
  if (!result || result.story === null) {
    return next(new AppError("Story not found or expired.", 404));
  }
}

return res.status(200).json({ success: true, alreadyViewed: alreadySeen });
});

// ─────────────────────────────────────────────
//  POST /api/v2/stories/:id/react — React to story
// ─────────────────────────────────────────────
export const reactToStory = asyncHandler(async (req, res, next) => {
  // AUDIT FIX #1
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError("Invalid story ID.", 400));
  }

  const { reaction } = req.body;

  if (reaction !== null && typeof reaction !== "string") {
    return next(new AppError("Invalid reaction.", 400));
  }

  // AUDIT FIX #7: reaction string length cap — emoji are typically 1-4 chars.
  // Without this, someone could send a 10MB string as reaction.
  if (reaction && reaction.length > 10) {
    return next(new AppError("Reaction too long.", 400));
  }

  const story = await Story.findOne({
    _id:       req.params.id,
    isDeleted: false,
    expiresAt: { $gt: new Date() },
  }).select("author").lean();

  if (!story) return next(new AppError("Story not found or expired.", 404));

  const result = await StoryView.reactToStory(req.params.id, req.user._id, reaction);
  if (!result) return next(new AppError("Story not found or expired.", 404));

  if (reaction && story.author.toString() !== req.user._id.toString()) {
    notifyChat("/notify/story-reaction", {
      to:       story.author.toString(),
      from:     req.user._id.toString(),
      storyId:  req.params.id,
      reaction,
    }).catch(() => {});
  }

  const updated = await Story.findById(req.params.id).select("reactionsCount").lean();

  return res.status(200).json({
    success:        true,
    reactionsCount: updated?.reactionsCount ?? 0,
  });
});

// ─────────────────────────────────────────────
//  POST /api/v2/stories/:id/like — Toggle ❤️ like
// ─────────────────────────────────────────────
export const toggleStoryLike = asyncHandler(async (req, res, next) => {
  // AUDIT FIX #1
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError("Invalid story ID.", 400));
  }

  const story = await Story.findOne({
    _id:       req.params.id,
    isDeleted: false,
    expiresAt: { $gt: new Date() },
  }).select("author").lean();

  if (!story) return next(new AppError("Story not found or expired.", 404));

  const existingView = await StoryView.findOne({
    story:  req.params.id,
    viewer: req.user._id,
  }).select("reaction").lean();

  const wasLiked    = existingView?.reaction === "❤️";
  const newReaction = wasLiked ? null : "❤️";

  await StoryView.reactToStory(req.params.id, req.user._id, newReaction);

  const liked = !wasLiked;

  if (liked && story.author.toString() !== req.user._id.toString()) {
    notifyChat("/notify/story-reaction", {
      to:       story.author.toString(),
      from:     req.user._id.toString(),
      storyId:  req.params.id,
      reaction: "❤️",
    }).catch(() => {});
  }

  const updated = await Story.findById(req.params.id).select("reactionsCount").lean();

  return res.status(200).json({
    success:        true,
    liked,
    reactionsCount: updated?.reactionsCount ?? 0,
  });
});

// ─────────────────────────────────────────────
//  GET /api/v2/stories/:id/viewers — Viewers list (author only)
// ─────────────────────────────────────────────
export const getStoryViewers = asyncHandler(async (req, res, next) => {
  // AUDIT FIX #1
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError("Invalid story ID.", 400));
  }

  const story = await Story.findOne({
    _id:    req.params.id,
    author: req.user._id,
  })
    .select("viewsCount")
    .lean();

  if (!story) return next(new AppError("Story not found.", 404));

  // AUDIT FIX #8: limit cap — without this, ?limit=999999 would load all records
  const rawLimit  = parseInt(req.query.limit) || 30;
  const safeLimit = Math.min(rawLimit, 100);
  const { beforeId } = req.query;

  // AUDIT FIX #1: beforeId ObjectId validation
  if (beforeId && !isValidObjectId(beforeId)) {
    return next(new AppError("Invalid cursor.", 400));
  }

  const viewers = await StoryView.getViewers(req.params.id, {
    beforeId,
    limit: safeLimit,
  });

  return res.status(200).json({
    success:    true,
    viewers,
    viewsCount: story.viewsCount,
  });
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/stories/:id — Delete own story
// ─────────────────────────────────────────────
export const deleteStory = asyncHandler(async (req, res, next) => {
  // AUDIT FIX #1
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError("Invalid story ID.", 400));
  }

  const story = await Story.softDelete(req.params.id, req.user._id);
  if (!story) return next(new AppError("Story not found.", 404));

  if (story.type !== "text" && story.media?.publicId) {
    await deleteFromCloudinary(story.media.publicId, story.media.resourceType).catch(
      () => {}
    );
  }
await invalidateFeedCache(req.user._id.toString());
  return res.status(200).json({ success: true, message: "Story deleted." });
});

// ─────────────────────────────────────────────
//  POST /api/v2/highlights — Create highlight
// ─────────────────────────────────────────────
export const createHighlight = asyncHandler(async (req, res, next) => {
  const { title, storyIds } = req.body;

  if (!title?.trim()) return next(new AppError("Highlight title is required.", 400));

  // AUDIT FIX #9: title length check before hitting DB
  if (title.trim().length > 30) {
    return next(new AppError("Highlight title cannot exceed 30 characters.", 400));
  }

  if (storyIds?.length > 100) {
    return next(new AppError("Highlight cannot have more than 100 stories.", 400));
  }

  // AUDIT FIX #1: validate all storyIds before DB query
  if (storyIds?.length) {
    const invalidId = storyIds.find((id) => !isValidObjectId(id));
    if (invalidId) return next(new AppError("Invalid storyId in list.", 400));
  }

  let snapshots = [];
  if (storyIds?.length) {
    const stories = await Story.find({
      _id:       { $in: storyIds },
      author:    req.user._id,
      isDeleted: false,
    }).select("media textContent type");

    // AUDIT FIX #3: centralized buildSnapshot helper
    snapshots = (await Promise.all(stories.map(buildSnapshot))).filter(Boolean);
  }

  // const firstMedia = snapshots.find((s) => s.type !== "text");
  // const coverImage = firstMedia?.url || null;


  // NAYA
const firstMedia = snapshots.find((s) => s.type !== "text");
const coverImage = firstMedia?.thumbnailUrl || firstMedia?.url || null;
  const highlight = await Highlight.create({
    author:    req.user._id,
    title:     title.trim(),
    coverImage,
    snapshots,
  });

  return res.status(201).json({ success: true, highlight });
});

// ─────────────────────────────────────────────
//  GET /api/v2/stories/highlights/my — My highlights
// ─────────────────────────────────────────────
export const getMyHighlights = asyncHandler(async (req, res) => {
  const highlights = await Highlight.find({
    author:    req.user._id,
    isDeleted: false,
  })
    .select("title coverImage coverPublicId snapshots createdAt")
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json({ success: true, highlights });
});

// ─────────────────────────────────────────────
//  POST /api/v2/stories/highlights/:id/add — Add story to highlight
// ─────────────────────────────────────────────
export const addToHighlight = asyncHandler(async (req, res, next) => {
  const { storyId } = req.body;
  if (!storyId) return next(new AppError("storyId is required.", 400));

  // AUDIT FIX #1
  if (!isValidObjectId(storyId) || !isValidObjectId(req.params.id)) {
    return next(new AppError("Invalid ID.", 400));
  }

  const [story, highlight] = await Promise.all([
    Story.findOne({
      _id:       storyId,
      author:    req.user._id,
      isDeleted: false,
    }).select("media textContent type"),
    Highlight.findOne({
      _id:       req.params.id,
      author:    req.user._id,
      isDeleted: false,
    }).select("snapshots coverImage title"),
  ]);

  if (!story)     return next(new AppError("Story not found.", 404));
  if (!highlight) return next(new AppError("Highlight not found.", 404));

  const alreadyExists = highlight.snapshots.some(
    (s) => s.storyId?.toString() === storyId
  );
  if (alreadyExists) {
    return next(new AppError("Story is already in this highlight.", 400));
  }

  const conflictHighlight = await Highlight.findOne({
    author:              req.user._id,
    isDeleted:           false,
    _id:                 { $ne: req.params.id },
    "snapshots.storyId": storyId,
  }).select("title").lean();

  if (conflictHighlight) {
    return res.status(400).json({
      success:             false,
      message:             `Already in "${conflictHighlight.title}" highlight`,
      conflictHighlightId: conflictHighlight._id,
    });
  }

  // AUDIT FIX #3: centralized buildSnapshot
  const snapshotData = await buildSnapshot(story);

  const updated = await Highlight.addSnapshot(req.params.id, req.user._id, snapshotData);
  if (!updated) return next(new AppError("Failed to add snapshot.", 500));

  // if (!highlight.coverImage && snapshotData.url) {
  //   await Highlight.updateCover(req.params.id, req.user._id, snapshotData.url);
  // }
// NAYA
if (!highlight.coverImage && snapshotData.url) {
  const cover = snapshotData.thumbnailUrl || snapshotData.url;
  await Highlight.updateCover(req.params.id, req.user._id, cover);
}


  return res.status(200).json({ success: true, highlight: updated });
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/stories/highlights/:id — Delete highlight
// ─────────────────────────────────────────────
export const deleteHighlight = asyncHandler(async (req, res, next) => {
  // AUDIT FIX #1
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError("Invalid highlight ID.", 400));
  }

  const highlight = await Highlight.findOne({
    _id:       req.params.id,
    author:    req.user._id,
    isDeleted: false,
  }).lean();

  if (!highlight) return next(new AppError("Highlight not found.", 404));

  // Cloudinary cleanup — parallel, errors silently ignored
  await Promise.all(
    highlight.snapshots
      .filter((s) => s.publicId)
      .map((s) => deleteFromCloudinary(s.publicId, s.resourceType).catch(() => {}))
  );

  await Highlight.softDelete(req.params.id, req.user._id);

  return res.status(200).json({ success: true, message: "Highlight deleted." });
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/stories/highlights/:id/snap/:snapId — Remove snapshot
// ─────────────────────────────────────────────
export const removeSnapFromHighlight = asyncHandler(async (req, res, next) => {
  const { id: highlightId, snapId } = req.params;

  // AUDIT FIX #1
  if (!isValidObjectId(highlightId) || !isValidObjectId(snapId)) {
    return next(new AppError("Invalid ID.", 400));
  }

  const highlight = await Highlight.findOne({
    _id:       highlightId,
    author:    req.user._id,
    isDeleted: false,
  });
  if (!highlight) return next(new AppError("Highlight not found.", 404));

  const snap = highlight.snapshots.id(snapId);
  if (!snap) return next(new AppError("Snapshot not found.", 404));

  if (snap.publicId) {
    await deleteFromCloudinary(snap.publicId, snap.resourceType).catch(() => {});
  }

  const updated = await Highlight.removeSnapshot(highlightId, req.user._id, snapId);
  if (!updated) return next(new AppError("Failed to remove snapshot.", 500));

  // if (highlight.coverImage === snap.url) {
  //   const nextSnap = updated.snapshots.find((s) => s.url);
  //   await Highlight.updateCover(highlightId, req.user._id, nextSnap?.url || null);
  // }

  // NAYA
if (highlight.coverImage === snap.url || highlight.coverImage === snap.thumbnailUrl) {
  const nextSnap = updated.snapshots.find((s) => s.url);
  const newCover = nextSnap?.thumbnailUrl || nextSnap?.url || null;
  await Highlight.updateCover(highlightId, req.user._id, newCover);
}

  return res.status(200).json({ success: true, highlight: updated });
});