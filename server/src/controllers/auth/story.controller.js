
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import Story from "../../models/story.model.js";
import Highlight from "../../models/highlight.model.js";
import { uploadToCloudinary, deleteFromCloudinary , copyToCloudinary } from "../../helper/cloudinaryUpload.js";
import { notifyChat } from "../../helper/notifyChat.js";

// ─────────────────────────────────────────────
//  POST /api/v2/stories — Create story
// ─────────────────────────────────────────────
export const createStory = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new AppError("Media file required.", 400));

  const maxSize = req.file.mimetype.startsWith("video") ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
  if (req.file.size > maxSize) {
    return next(new AppError(
      req.file.mimetype.startsWith("video")
        ? "Video cannot exceed 50MB."
        : "Image cannot exceed 10MB.",
      400
    ));
  }

  const { caption = "", audience = "public" } = req.body;

  const resourceType = req.file.mimetype.startsWith("video") ? "video" : "image";
  const isVideo = resourceType === "video";

  const uploaded = await uploadToCloudinary(req.file.buffer, {
    folder: "stories",
    resourceType,
    ...(isVideo && {
      eager: [{ format: "jpg", transformation: [{ start_offset: "0" }] }],
      eager_async: false,
    }),
  });

  const story = await Story.create({
    author: req.user._id,
    media: {
      url:          uploaded.secure_url,
      publicId:     uploaded.public_id,
      resourceType,
      width:        uploaded.width,
      height:       uploaded.height,
      duration:     uploaded.duration || null,
      thumbnailUrl: isVideo
        ? (uploaded.eager?.[0]?.secure_url ||
           uploaded.secure_url
             .replace("/upload/", "/upload/so_0,f_jpg/")
             .replace(/\.(mp4|webm|mov|avi)$/, ".jpg"))
        : null,
    },
    caption,
    audience: "public",
  });

  return res.status(201).json({ success: true, story });
});

// ─────────────────────────────────────────────
//  GET /api/v2/stories/feed — Stories feed
// ─────────────────────────────────────────────
export const getStoriesFeed = asyncHandler(async (req, res) => {
  const now = new Date();

  const stories = await Story.find({
    isDeleted: false,
    expiresAt: { $gt: now },
    audience: "public",
  })
    .sort({ createdAt: -1 })
    .populate("author", "username fullName avatar isVerifiedBadge")
    .select("author media caption textContent type viewsCount reactionsCount expiresAt createdAt viewers")
    .lean();

  const grouped = {};
  for (const story of stories) {
    const authorId = story.author._id.toString();
    if (!grouped[authorId]) {
      grouped[authorId] = {
        author: story.author,
        stories: [],
        hasUnwatched: false,
      };
    }
    const myIdStr = req.user._id.toString();
    const viewerEntry = story.viewers?.find(v => v.user?.toString() === myIdStr);
    const isLiked = viewerEntry?.reaction === "❤️";
    if (!viewerEntry) grouped[authorId].hasUnwatched = true;
    grouped[authorId].stories.push({ ...story, isLiked, viewers: undefined });
  }

  const myId = req.user._id.toString();
  const result = Object.values(grouped).sort((a, b) => {
    if (a.author._id.toString() === myId) return -1;
    if (b.author._id.toString() === myId) return 1;
    return b.hasUnwatched - a.hasUnwatched;
  });

  return res.status(200).json({ success: true, feed: result });
});

// ─────────────────────────────────────────────
//  POST /api/v2/stories/:id/view — Record view
// ─────────────────────────────────────────────
export const viewStory = asyncHandler(async (req, res, next) => {
  const story = await Story.recordView(req.params.id, req.user._id);
  if (!story) return next(new AppError("Story not found or expired.", 404));
  return res.status(200).json({ success: true });
});

// ─────────────────────────────────────────────
//  POST /api/v2/stories/:id/react — React to story
// ─────────────────────────────────────────────
export const reactToStory = asyncHandler(async (req, res, next) => {
  const { reaction } = req.body;
  if (reaction !== null && typeof reaction !== "string") {
    return next(new AppError("Invalid reaction.", 400));
  }

  const story = await Story.reactToStory(req.params.id, req.user._id, reaction);
  if (!story) return next(new AppError("Story not found or expired.", 404));

  // Notify story author (self-notification skip hogi chat-server mein)
  if (reaction && story.author?.toString() !== req.user._id.toString()) {
    notifyChat("/notify/story-reaction", {
      to:       story.author.toString(),
      from:     req.user._id.toString(),
      storyId:  story._id.toString(),
      reaction,
    }).catch(() => {});
  }

  return res.status(200).json({ success: true, reactionsCount: story.reactionsCount });
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/stories/:id — Delete own story
// ─────────────────────────────────────────────
export const deleteStory = asyncHandler(async (req, res, next) => {
  const story = await Story.softDelete(req.params.id, req.user._id);
  if (!story) return next(new AppError("Story not found.", 404));

  if (story.type !== "text" && story.media?.publicId) {
    await deleteFromCloudinary(story.media.publicId, story.media.resourceType);
  }

  return res.status(200).json({ success: true, message: "Story deleted." });
});

// ─────────────────────────────────────────────
//  GET /api/v2/stories/:id/viewers — View list (author only)
// ─────────────────────────────────────────────
export const getStoryViewers = asyncHandler(async (req, res, next) => {
  const story = await Story.findOne({ _id: req.params.id, author: req.user._id })
    .select("+viewers")
    .populate("viewers.user", "username fullName avatar");
  if (!story) return next(new AppError("Story not found.", 404));
  return res.status(200).json({ success: true, viewers: story.viewers, viewsCount: story.viewsCount });
});

// ─────────────────────────────────────────────
//  POST /api/v2/stories/:id/like — Toggle like
// ─────────────────────────────────────────────
export const toggleStoryLike = asyncHandler(async (req, res, next) => {
  const story = await Story.findOne({
    _id:       req.params.id,
    isDeleted: false,
    expiresAt: { $gt: new Date() },
  }).select("+viewers");

  if (!story) return next(new AppError("Story not found or expired.", 404));

  const viewerId  = req.user._id.toString();
  const viewerIdx = story.viewers?.findIndex(
    (v) => v.user?.toString() === viewerId
  );

  let liked = false;

  if (viewerIdx > -1) {
    const viewer   = story.viewers[viewerIdx];
    const wasLiked = viewer.reaction === "❤️";

    if (wasLiked) {
      story.viewers[viewerIdx].reaction  = null;
      story.viewers[viewerIdx].reactedAt = null;
      story.reactionsCount = Math.max(0, story.reactionsCount - 1);
      liked = false;
    } else {
      const hadReaction = !!viewer.reaction;
      story.viewers[viewerIdx].reaction  = "❤️";
      story.viewers[viewerIdx].reactedAt = new Date();
      if (!hadReaction) story.reactionsCount += 1;
      liked = true;
    }
  } else {
    story.viewers.push({
      user:      req.user._id,
      reaction:  "❤️",
      reactedAt: new Date(),
      viewedAt:  new Date(),
    });
    story.viewsCount     += 1;
    story.reactionsCount += 1;
    liked = true;
  }

  await story.save({ validateBeforeSave: false });

  // Notify story author jab like karo (unlike pe nahi)
  if (liked && story.author?.toString() !== viewerId) {
    notifyChat("/notify/story-reaction", {
      to:       story.author.toString(),
      from:     viewerId,
      storyId:  story._id.toString(),
      reaction: "❤️",
    }).catch(() => {});
  }

  return res.status(200).json({
    success:        true,
    liked,
    reactionsCount: story.reactionsCount,
  });
});

// ─────────────────────────────────────────────
//  POST /api/v2/stories/text — Text story
// ─────────────────────────────────────────────
export const createTextStory = asyncHandler(async (req, res, next) => {
  const { text, background, textAlign, textColor } = req.body;

  if (!text?.trim()) return next(new AppError("Text is required.", 400));
  if (text.trim().length > 500) {
    return next(new AppError("Text story cannot exceed 500 characters.", 400));
  }

  const story = await Story.create({
    author: req.user._id,
    type: "text",
    textContent: {
      text:       text.trim(),
      background,
      textAlign:  textAlign  || "center",
      textColor:  textColor  || "#ffffff",
    },
    audience: "public",
  });

  return res.status(201).json({ success: true, story });
});

// ─────────────────────────────────────────────
//  POST /api/v2/highlights — Create highlight
// ─────────────────────────────────────────────
export const createHighlight = asyncHandler(async (req, res, next) => {
  const { title, storyIds } = req.body;
  if (!title?.trim()) return next(new AppError("Highlight title is required.", 400));

  if (storyIds?.length > 100) {
    return next(new AppError("Highlight cannot have more than 100 stories.", 400));
  }

  let snapshots = [];
  if (storyIds?.length) {
    const stories = await Story.find({
      _id:       { $in: storyIds },
      author:    req.user._id,
      isDeleted: false,
    }).select("media textContent type");

    snapshots = await Promise.all(
      stories.map(async (story) => {
        if (story.type === "text") {
          return { storyId: story._id, type: "text", textContent: story.textContent };
        }
        try {
          const copied = await copyToCloudinary(story.media.url, {
            folder:        "highlights",
            resource_type: story.media.resourceType,
          });
          return {
            storyId:      story._id,
            type:         story.media.resourceType,
            url:          copied.secure_url,
            publicId:     copied.public_id,
            resourceType: story.media.resourceType,
            thumbnailUrl: story.media.resourceType === "video"
              ? copied.secure_url
                  .replace("/upload/", "/upload/so_0,f_jpg/")
                  .replace(/\.(mp4|webm|mov|avi)$/, ".jpg")
              : null,
          };
        } catch {
          return {
            storyId:      story._id,
            type:         story.media.resourceType,
            url:          story.media.url,
            publicId:     null,
            resourceType: story.media.resourceType,
          };
        }
      })
    );
  }

  const firstMedia = snapshots.find((s) => s.type !== "text");
  const coverImage = firstMedia?.url || null;

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

  const story = await Story.findOne({
    _id:       storyId,
    author:    req.user._id,
    isDeleted: false,
  }).select("media textContent type");

  if (!story) return next(new AppError("Story not found.", 404));

  const highlight = await Highlight.findOne({
    _id:       req.params.id,
    author:    req.user._id,
    isDeleted: false,
  });

  if (!highlight) return next(new AppError("Highlight not found.", 404));

  const existingHighlight = await Highlight.findOne({
    author:    req.user._id,
    isDeleted: false,
    _id:       { $ne: req.params.id },
    "snapshots.storyId": storyId,
  });
  if (existingHighlight) {
    return res.status(400).json({
      success: false,
      message: `This story is already in "${existingHighlight.title}" highlight`,
      conflictHighlightId: existingHighlight._id,
    });
  }

  const alreadyIdx = highlight.snapshots.findIndex(
    (s) => s.storyId?.toString() === storyId
  );
  if (alreadyIdx > -1) {
    const snap = highlight.snapshots[alreadyIdx];
    if (snap.publicId) {
      await deleteFromCloudinary(snap.publicId, snap.resourceType).catch(() => {});
    }
    highlight.snapshots.splice(alreadyIdx, 1);
    if (highlight.coverImage === snap.url) {
      const nextMedia = highlight.snapshots.find(s => s.url);
      highlight.coverImage = nextMedia?.url || null;
    }
    await highlight.save();
    return res.status(200).json({ success: true, highlight, removed: true });
  }

  let snapshot;
  if (story.type === "text") {
    snapshot = { storyId: story._id, type: "text", textContent: story.textContent };
  } else {
    try {
      const copied = await copyToCloudinary(story.media.url, {
        folder:        "highlights",
        resource_type: story.media.resourceType,
      });
      snapshot = {
        storyId:      story._id,
        type:         story.media.resourceType,
        url:          copied.secure_url,
        publicId:     copied.public_id,
        resourceType: story.media.resourceType,
        thumbnailUrl: story.media.resourceType === "video"
          ? copied.secure_url.replace("/upload/", "/upload/so_0/")
          : null,
      };
    } catch {
      snapshot = {
        storyId:      story._id,
        type:         story.media.resourceType,
        url:          story.media.url,
        publicId:     null,
        resourceType: story.media.resourceType,
      };
    }
  }

  highlight.snapshots.push(snapshot);
  if (!highlight.coverImage && snapshot.url) highlight.coverImage = snapshot.url;
  await highlight.save();

  return res.status(200).json({ success: true, highlight });
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/stories/highlights/:id — Delete highlight
// ─────────────────────────────────────────────
export const deleteHighlight = asyncHandler(async (req, res, next) => {
  const highlight = await Highlight.findOne({
    _id:    req.params.id,
    author: req.user._id,
  });
  if (!highlight) return next(new AppError("Highlight not found.", 404));

  const deletePromises = highlight.snapshots
    .filter((s) => s.publicId)
    .map((s) => deleteFromCloudinary(s.publicId, s.resourceType).catch(() => {}));

  await Promise.all(deletePromises);
  highlight.isDeleted = true;
  await highlight.save();

  return res.status(200).json({ success: true, message: "Highlight deleted." });
});

// ─────────────────────────────────────────────
//  DELETE /api/v2/stories/highlights/:id/snap/:snapId
// ─────────────────────────────────────────────
export const removeSnapFromHighlight = asyncHandler(async (req, res, next) => {
  const { id: highlightId, snapId } = req.params;

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

  highlight.snapshots.pull({ _id: snapId });
  if (highlight.coverImage === snap.url) {
    const nextSnap = highlight.snapshots.find((s) => s.url);
    highlight.coverImage = nextSnap?.url || null;
  }

  await highlight.save();
  return res.status(200).json({ success: true, highlight });
});