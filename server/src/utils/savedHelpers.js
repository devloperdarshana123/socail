import prisma from "../config/prisma.js";

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ── Toggle save ─────────────────────────────────────────────────────────
// export const toggleSave = async (userId, postId) => {
//   const existing = await prisma.saved.findUnique({
//     where: { savedById_postId: { savedById: userId, postId } },
//   });

//   let saved = false;

//   if (existing) {
//     // Unsave
//     await prisma.saved.delete({ where: { id: existing.id } });
//     saved = false;

//     await prisma.post.update({
//       where: { id: postId },
//       data: { savedCount: { decrement: 1 } },
//     });
//   } else {
//     // Save
//     await prisma.saved.create({
//       data: { savedById: userId, postId },
//     });
//     saved = true;

//     await prisma.post.update({
//       where: { id: postId },
//       data: { savedCount: { increment: 1 } },
//     });
//   }

//   return { saved };
// };

// ── Toggle save ─────────────────────────────────────────────────────────
export const toggleSave = async (userId, postId) => {
  let saved = false;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.saved.findUnique({
        where: { savedById_postId: { savedById: userId, postId } },
      });

      if (existing) {
        // Unsave
        await tx.saved.delete({ where: { id: existing.id } });
        saved = false;

        await tx.post.update({
          where: { id: postId },
          data: { savedCount: { decrement: 1 } },
        });
      } else {
        // Save
        await tx.saved.create({
          data: { savedById: userId, postId },
        });
        saved = true;

        await tx.post.update({
          where: { id: postId },
          data: { savedCount: { increment: 1 } },
        });
      }
    });
  } catch (err) {
    if (err.code === "P2002") {
      // Race condition — someone else's request already saved it
      saved = true;
      return { saved };
    }
    throw err;
  }

  return { saved };
};
// ── Get saved posts (cursor-paginated) ──────────────────────────────────
export const getSavedPosts = async (userId, { beforeId = null, limit = 12 } = {}) => {
const where = { 
    savedById: userId,
    post: { isDeleted: false },
  };

  if (beforeId) {
    where.id = { lt: beforeId };
  }

  const saved = await prisma.saved.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      post: {
        select: {
          id: true,
          type: true,
          caption: true,
          media: true,
          visibility: true,
          likesCount: true,
          commentsCount: true,
          viewsCount: true,
          savedCount: true,
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
      },
    },
  });

  const hasMore = saved.length > limit;
  const items = hasMore ? saved.slice(0, limit) : saved;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { items, hasMore, nextCursor };
};

// ── Check if saved ──────────────────────────────────────────────────────
export const hasSaved = async (userId, postId) => {
  const saved = await prisma.saved.findUnique({
    where: { savedById_postId: { savedById: userId, postId } },
    select: { id: true },
  });

  return !!saved;
};

// ── Bulk save status ────────────────────────────────────────────────────
export const getBulkSaveStatus = async (userId, postIds) => {
  const saved = await prisma.saved.findMany({
    where: {
      savedById: userId,
      postId: { in: postIds },
    },
    select: { postId: true },
  });

  return new Set(saved.map((s) => s.postId));
};

// ── Verify post is visible ──────────────────────────────────────────────
export const assertPostVisible = async (postId, viewerId) => {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      isDeleted: true,
      isDraft: true,
      savedCount: true,
    },
  });

  if (!post || post.isDeleted || post.isDraft) {
    throw new Error("Post not found");
  }

  const author = await prisma.user.findUnique({
    where: { id: post.authorId },
    select: { isPrivate: true },
  });

  if (author?.isPrivate && post.authorId !== viewerId) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: post.authorId } },
      select: { status: true },
    });

    if (follow?.status !== "accepted") {
      throw new Error("This post is from a private account");
    }
  }

  return post;
};