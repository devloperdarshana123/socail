import prisma from "../config/prisma.js";
import cloudinary from "../config/cloudinaryConfig.js";
import logger from "../config/logger.js";

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

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

  const sanitized = media.map(sanitizeMediaItem);

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

  const post = await prisma.$transaction(async (tx) => {
    const newPost = await tx.post.create({
      data: {
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
      include: {
        author: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
            isVerifiedBadge: true,
          },
        },
      },
    });

    if (!newPost.isDraft) {
      await tx.user.update({
        where: { id: userId },
        data: { postsCount: { increment: 1 } },
      });
    }

    return newPost;
  });

  return post;
};

// ── Get post by ID ──────────────────────────────
export const getPostById = async (postId, userId = null) => {
  if (!isValidUUID(postId)) return null;

  const post = await prisma.post.findUnique({
    where: { id: postId },
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
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          isVerifiedBadge: true,
          accountStatus: true,
        },
      },
    },
  });

  if (!post || post.isDeleted) return null;
  if (post.isDraft && userId !== post.author.id) return null;

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

  const posts = await prisma.post.findMany({
    where: query,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
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
      author: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          isVerifiedBadge: true,
        },
      },
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { items, hasMore, nextCursor };
};

// ── Get user posts ──────────────────────────────
export const getUserPosts = async (userId, isFollower, isOwner, { beforeId = null, limit = 18 } = {}) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  const posts = await prisma.post.findMany({
    where: query,
    orderBy: { createdAt: "desc" },
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
      author: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          isVerifiedBadge: true,
        },
      },
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { items, hasMore, nextCursor };
};

// ── Delete post (soft delete) ───────────────────
export const deletePost = async (postId, userId) => {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, isDeleted: true, isDraft: true, media: true },
  });

  if (!post || post.isDeleted || post.authorId !== userId) {
    return null;
  }

  await prisma.post.update({
    where: { id: postId },
    data: { isDeleted: true },
  });

  if (!post.isDraft) {
    await prisma.user.update({
      where: { id: userId },
      data: { postsCount: { decrement: 1 } },
    });
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

  const posts = await prisma.post.findMany({
    where: query,
    orderBy: { createdAt: "desc" },
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
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, isDraft: true, isDeleted: true, type: true, media: true },
  });

  if (!post || post.isDeleted || post.authorId !== userId || !post.isDraft) {
    return null;
  }

  if (post.type === "image" && post.media.length < 1) {
    throw new Error("Image post requires at least one image.");
  }
  if (post.type === "reel" && post.media.length !== 1) {
    throw new Error("Reel must have exactly one video.");
  }

  const updated = await prisma.post.update({
    where: { id: postId },
    data: { isDraft: false },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          isVerifiedBadge: true,
        },
      },
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { postsCount: { increment: 1 } },
  });

  return updated;
};

// ── Update post ─────────────────────────────────
export const updatePost = async (postId, userId, updateData) => {
  const { caption, isDraft, media } = updateData;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      isDeleted: true,
      type: true,
      media: true,
    },
  });

  if (!post || post.isDeleted || post.authorId !== userId) {
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

    updateObj.media = media.map(sanitizeMediaItem);
  }

  const updated = await prisma.post.update({
    where: { id: postId },
    data: updateObj,
    include: {
      author: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          isVerifiedBadge: true,
        },
      },
    },
  });

  return updated;
};

// ── Record view ─────────────────────────────────
export async function recordPostView(postId, userId, options = {}) {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { 
        id: true, 
        viewsCount: true, 
        authorId: true,
        isDeleted: true,
      },
    });

    if (!post || post.isDeleted) return null;

    const selfView = userId === post.authorId;

    if (selfView) {
      return {
        isNewView: false,
        selfView: true,
        viewsCount: post.viewsCount,
      };
    }

   try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.postView.create({
          data: {
            postId,
            userId,
            source: options.source || "modal",
            duration: options.duration || 0,
            device: options.device || "desktop",
          },
        });

        return tx.post.update({
          where: { id: postId },
          data: { viewsCount: { increment: 1 } },
          select: { viewsCount: true },
        });
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