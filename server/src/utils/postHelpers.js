import { transactionRunner } from "../config/transaction.js";
import {
  socialPostRepository,
  userRepository,
  followRepository,
  likeRepository,
  savedRepository,
  postViewRepository,
} from "../config/repositories.js";
import cloudinary from "../config/cloudinaryConfig.js";
import logger from "../config/logger.js";
import { finalizeMedia } from "../helper/cloudinaryUpload.js";

// Persistence for the post domain now flows through the repository layer
// (Phase 7A) instead of the Prisma client directly. Database/behavior are
// unchanged — every query below is the same shape as the prisma.* call it
// replaces; only the access path moved.
//
// Helper-owned business logic, all unchanged: media sanitization and its
// Cloudinary finalize/thumbnail steps, location parsing, caption limits and
// trimming, per-type media validation and its thrown messages, ownership and
// draft-visibility rules, the hasMore/nextCursor pagination math, and the
// postsCount increment/decrement decisions.
//
// Projection ownership stays here too: each list method passes its OWN
// `select` to the repository rather than accepting a repository-defined
// shape, so the three lists keep their three deliberately different
// projections (feed has savedCount, profile does not, drafts have no author).
//
// Both callback transactions run through transactionRunner.run() with `{ tx }`
// threaded into every repository call, preserving statement order and
// whole-callback rollback.
//
// NOTE: findById calls pass includeDeleted: true throughout — the original
// findUnique queries did not filter on isDeleted, and each method performs
// its own isDeleted check to decide what to return.

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// The author projection attached to created/updated posts and list rows.
const POST_AUTHOR_SELECT = {
  id: true,
  username: true,
  fullName: true,
  avatar: true,
  isVerifiedBadge: true,
};

// ── Sanitize media item ─────────────────────────
export const sanitizeMediaItem = (item, index) => ({
  url: String(item.url || ""),
  publicId: String(item.publicId || ""),
  resourceType: ["image", "video"].includes(item.resourceType) ? item.resourceType : "image",
  width: Number(item.width) || null,
  height: Number(item.height) || null,
  duration: Number(item.duration) || null,
  thumbnailUrl: item.thumbnailUrl ? String(item.thumbnailUrl) : null,
  format: item.format ? String(item.format) : null,
  bytes: Number(item.bytes) || null,
  order: index,
});

// ── Create post ─────────────────────────────────
export const createPost = async (userId, postData) => {
  const { caption = "", visibility = "public", type, commentsDisabled = false, likesHidden = false, location, isDraft = false, media = [] } = postData;

  let sanitized = media.map(sanitizeMediaItem);

  sanitized = await finalizeMedia(sanitized);
  // Thumbnail generation for reels
  if (type === "reel" && sanitized[0]?.resourceType === "video" && !sanitized[0]?.thumbnailUrl) {
    try {
      const result = await cloudinary.uploader.explicit(sanitized[0].publicId, {
        type: "upload",
        resource_type: "video",
        eager: [
          {
            format: "jpg",
            transformation: [
              { start_offset: "0" },
              { width: 600, crop: "scale" },
              { quality: "auto:good" },
            ],
          },
        ],
        eager_async: false,
      });
      sanitized[0].thumbnailUrl = result.eager?.[0]?.secure_url ?? null;
    } catch (err) {
      logger.warn("Thumbnail generation failed", { error: err.message });
    }
  }

  // Parse location
  let locationData = null;
  if (location) {
    try {
      const parsed = typeof location === "string" ? JSON.parse(location) : location;
      if (parsed?.name?.trim()) {
        locationData = { name: parsed.name.trim() };
        if (parsed.lat && parsed.lng) {
          locationData.coordinates = {
            type: "Point",
            coordinates: [parseFloat(parsed.lng), parseFloat(parsed.lat)],
          };
        }
      }
    } catch {}
  }

  const post = await transactionRunner.run(async (tx) => {
    const newPost = await socialPostRepository.create(
      {
        authorId: userId,
        type,
        caption: caption.trim().slice(0, 2200),
        media: sanitized,
        visibility,
        commentsDisabled: Boolean(commentsDisabled),
        likesHidden: Boolean(likesHidden),
        isDraft: Boolean(isDraft),
        ...(locationData && { location: locationData }),
      },
      {
        tx,
        include: { author: { select: POST_AUTHOR_SELECT } },
      }
    );

    if (!newPost.isDraft) {
      await userRepository.update(userId, { postsCount: { inc: 1 } }, { tx });
    }

    return newPost;
  });

  return post;
};

// ── Get post by ID ──────────────────────────────
export const getPostById = async (postId, userId = null) => {
  if (!isValidUUID(postId)) return null;

  const post = await socialPostRepository.findById(postId, {
    includeDeleted: true,
    select: {
      id: true,
      type: true,
      caption: true,
      media: true,
      visibility: true,
      commentsDisabled: true,
      likesHidden: true,
      location: true,
      isDraft: true,
      isDeleted: true,
      likesCount: true,
      commentsCount: true,
      viewsCount: true,
      savedCount: true,
      createdAt: true,
      updatedAt: true,
      author: {
        select: {
          ...POST_AUTHOR_SELECT,
          accountStatus: true,
        },
      },
    },
  });

  if (!post || post.isDeleted) return null;
  if (post.isDraft && String(userId) !== String(post.author.id)) return null;

  return post;
};

// ── Get feed posts ──────────────────────────────
export const getFeedPosts = async (userIds, { beforeId = null, limit = 20 } = {}) => {
  const query = {
    authorId: { in: userIds },
    isDeleted: false,
    isDraft: false,
    visibility: "public",
  };

  if (beforeId) {
    query.id = { lt: beforeId };
  }

  const posts = await socialPostRepository.findManyWithCursor(query, {
    take: limit + 1,
    ...(beforeId && { cursor: { id: beforeId }, skip: 1 }),
    select: {
      id: true,
      type: true,
      caption: true,
      media: true,
      likesCount: true,
      commentsCount: true,
      viewsCount: true,
      savedCount: true,
      commentsDisabled: true,
      likesHidden: true,
      createdAt: true,
      author: { select: POST_AUTHOR_SELECT },
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { items, hasMore, nextCursor };
};

// ── Get user posts ──────────────────────────────
export const getUserPosts = async (userId, isFollower, isOwner, { beforeId = null, limit = 18 } = {}) => {
  const user = await userRepository.findById(userId, {
    select: { isPrivate: true },
  });

  if (user?.isPrivate && !isOwner && !isFollower) {
    return { items: [], hasMore: false, nextCursor: null };
  }

  const query = {
    authorId: userId,
    isDeleted: false,
    isDraft: false,
    visibility: "public",
  };

  if (beforeId) {
    query.id = { lt: beforeId };
  }

  const posts = await socialPostRepository.findManyWithCursor(query, {
    take: limit + 1,
    select: {
      id: true,
      type: true,
      media: true,
      caption: true,
      likesCount: true,
      commentsCount: true,
      viewsCount: true,
      createdAt: true,
      author: { select: POST_AUTHOR_SELECT },
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { items, hasMore, nextCursor };
};

// ── Delete post (soft delete) ───────────────────
export const deletePost = async (postId, userId) => {
  const post = await socialPostRepository.findById(postId, {
    includeDeleted: true,
    select: { id: true, authorId: true, isDeleted: true, isDraft: true, media: true },
  });

  if (!post || post.isDeleted || String(post.authorId) !== String(userId)) {
    return null;
  }

  // update(), NOT delete() — the repository's delete() would also stamp
  // deletedAt, which this query never wrote.
  await socialPostRepository.update(postId, { isDeleted: true });

  if (!post.isDraft) {
    await userRepository.update(userId, { postsCount: { dec: 1 } });
  }

  return post;
};

// ── Get draft posts ─────────────────────────────
export const getDraftPosts = async (userId, { beforeId = null, limit = 20 } = {}) => {
  const query = {
    authorId: userId,
    isDraft: true,
    isDeleted: false,
  };

  if (beforeId) {
    query.id = { lt: beforeId };
  }

  const posts = await socialPostRepository.findManyWithCursor(query, {
    take: limit + 1,
    select: {
      id: true,
      type: true,
      caption: true,
      media: true,
      likesCount: true,
      commentsCount: true,
      viewsCount: true,
      createdAt: true,
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { items, hasMore, nextCursor };
};

// ── Publish draft ───────────────────────────────
export const publishDraft = async (postId, userId) => {
  const post = await socialPostRepository.findById(postId, {
    includeDeleted: true,
    select: { id: true, authorId: true, isDraft: true, isDeleted: true, type: true, media: true },
  });

  if (!post || post.isDeleted || String(post.authorId) !== String(userId) || !post.isDraft) {
    return null;
  }

  if (post.type === "image" && post.media.length < 1) {
    throw new Error("Image post requires at least one image.");
  }
  if (post.type === "reel" && post.media.length !== 1) {
    throw new Error("Reel must have exactly one video.");
  }

  const updated = await socialPostRepository.update(
    postId,
    { isDraft: false },
    { include: { author: { select: POST_AUTHOR_SELECT } } }
  );

  await userRepository.update(userId, { postsCount: { inc: 1 } });

  return updated;
};

// ── Update post ─────────────────────────────────
export const updatePost = async (postId, userId, updateData) => {
  const { caption, isDraft, media } = updateData;

  const post = await socialPostRepository.findById(postId, {
    includeDeleted: true,
    select: {
      id: true,
      authorId: true,
      isDeleted: true,
      type: true,
      media: true,
    },
  });

  if (!post || post.isDeleted || String(post.authorId) !== String(userId)) {
    return null;
  }

  const updateObj = {};

  if (caption !== undefined) {
    if (caption.length > 2200) {
      throw new Error("Caption cannot exceed 2200 characters.");
    }
    updateObj.caption = caption.trim();
  }

  if (isDraft !== undefined) {
    updateObj.isDraft = isDraft === true || isDraft === "true";
  }

  if (media !== undefined) {
    if (post.type === "reel" && media.length !== 1) {
      throw new Error("Reel must have exactly one video.");
    }
    if (post.type === "image" && (media.length < 1 || media.length > 10)) {
      throw new Error("Image post requires 1–10 images.");
    }
    if (post.type === "text" && media.length > 0) {
      throw new Error("Text post cannot have media.");
    }

    // updateObj.media = media.map(sanitizeMediaItem);

    const sanitized = media.map(sanitizeMediaItem);
    updateObj.media = await finalizeMedia(sanitized);
  }

  const updated = await socialPostRepository.update(postId, updateObj, {
    include: { author: { select: POST_AUTHOR_SELECT } },
  });

  return updated;
};

// ── Controller-extracted lookups (Milestone 5D) ─────────────────────────
//    Each of these was inline in post.controller.js and is moved here
//    verbatim so the controller performs no direct DB access. Queries are
//    byte-identical to those they replace; the controller keeps all
//    orchestration (Promise.all grouping, filtering, response shaping).

// getPostInteraction: has the viewer liked this post?
export const findPostLikeByUser = async (userId, postId) => {
  return likeRepository.findExclusivePostLike(userId, postId, {
    select: { id: true },
  });
};

// getPostInteraction: has the viewer saved this post?
export const findPostSavedByUser = async (userId, postId) => {
  return savedRepository.findByUserAndPost(userId, postId, {
    select: { id: true },
  });
};

// getPostInteraction: current counts for this post.
export const getPostInteractionCounts = async (postId) => {
  return socialPostRepository.findById(postId, {
    includeDeleted: true,
    select: { likesCount: true, commentsCount: true, viewsCount: true },
  });
};

// getFeedPosts: the ids this user follows (accepted only).
export const getAcceptedFollowingIds = async (userId) => {
  return followRepository.findAllFollowingIds(userId, { status: "accepted" });
};

// getFeedPosts: ids of super_admins, filtered out of the feed author set.
export const getSuperAdminIds = async () => {
  return userRepository.findAllByRole("super_admin", { select: { id: true } });
};

// getUserPosts: target user's role + privacy (for the super_admin block).
export const getUserRoleAndPrivacy = async (userId) => {
  return userRepository.findById(userId, {
    select: { role: true, isPrivate: true },
  });
};

// getUserPosts: count of the user's visible (published, non-deleted) posts.
export const countVisibleUserPosts = async (userId) => {
  return socialPostRepository.count({
    authorId: userId,
    isDeleted: false,
    isDraft: false,
  });
};

// getUserPosts: the viewer's follow relationship to the profile owner.
export const getFollowStatus = async (followerId, followingId) => {
  return followRepository.findByFollowerAndFollowing(followerId, followingId, {
    select: { status: true },
  });
};

// updatePost: current media (for Cloudinary deletion diffing).
export const getPostMediaForUpdate = async (postId) => {
  return socialPostRepository.findById(postId, {
    includeDeleted: true,
    select: { media: true },
  });
};

// recordView: the post's updated view count (read after recording).
export const getPostViewsCount = async (postId) => {
  return socialPostRepository.findById(postId, {
    includeDeleted: true,
    select: { viewsCount: true },
  });
};

// ── Record view ─────────────────────────────────
export async function recordPostView(postId, userId, options = {}) {
  try {
    const post = await socialPostRepository.findById(postId, {
      includeDeleted: true,
      select: {
        id: true,
        viewsCount: true,
        authorId: true,
        isDeleted: true,
      },
    });

    if (!post || post.isDeleted) return null;

    const selfView = String(userId) === String(post.authorId);

    if (selfView) {
      return {
        isNewView: false,
        selfView: true,
        viewsCount: post.viewsCount,
      };
    }

   try {
      const updated = await transactionRunner.run(async (tx) => {
        await postViewRepository.create(
          {
            postId,
            userId,
            source: options.source || "modal",
            duration: options.duration || 0,
            device: options.device || "desktop",
          },
          { tx }
        );

        return socialPostRepository.update(
          postId,
          { viewsCount: { inc: 1 } },
          { tx, select: { viewsCount: true } }
        );
      });

      return {
        isNewView: true,
        selfView: false,
        viewsCount: updated.viewsCount,
      };
    } catch (err) {
      if (err.code === "P2002") {
        return {
          isNewView: false,
          selfView: false,
          viewsCount: post.viewsCount,
        };
      }
      throw err;
    }
  } catch (err) {
    console.error("recordPostView error:", err);
    return null;
  }
}