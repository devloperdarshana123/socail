import { transactionRunner } from "../config/transaction.js";
import {
  savedRepository,
  socialPostRepository,
  userRepository,
  followRepository,
} from "../config/repositories.js";

// Persistence for the saved (bookmark) domain now flows through the
// repository layer (Phase 7A) instead of the Prisma client directly.
// Database/behavior are unchanged — every query below is the same shape as
// the prisma.* call it replaces; only the access path moved.

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
    await transactionRunner.run(async (tx) => {
      const existing = await savedRepository.findByUserAndPost(userId, postId, { tx });

      if (existing) {
        // Unsave
        await savedRepository.delete(existing.id, { tx });
        saved = false;

        await socialPostRepository.update(postId, { savedCount: { dec: 1 } }, { tx });
      } else {
        // Save
        await savedRepository.create({ savedById: userId, postId }, { tx });
        saved = true;

        await socialPostRepository.update(postId, { savedCount: { inc: 1 } }, { tx });
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
  const saved = await savedRepository.findByUserIdWithPost(userId, { beforeId, limit });

  const hasMore = saved.length > limit;
  const items = hasMore ? saved.slice(0, limit) : saved;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { items, hasMore, nextCursor };
};

// ── Check if saved ──────────────────────────────────────────────────────
export const hasSaved = async (userId, postId) => {
  const saved = await savedRepository.findByUserAndPost(userId, postId, {
    select: { id: true },
  });

  return !!saved;
};

// ── Bulk save status ────────────────────────────────────────────────────
export const getBulkSaveStatus = async (userId, postIds) => {
  const saved = await savedRepository.findMany(
    {
      savedById: userId,
      postId: { in: postIds },
    },
    {},
    { select: { postId: true } }
  );

  return new Set(saved.map((s) => s.postId));
};

// ── Post saved-count (read the updated count after a toggle) ────────────
//    Extracted verbatim from saved.controller.js so the controller no
//    longer touches Prisma directly — Milestone 5 helpers-as-boundary.
//    Query is byte-identical to the one it replaces; returns null for a
//    non-existent post, exactly as Prisma's findUnique does.
export const getPostSavedCount = async (postId) => {
  // includeDeleted: true — the original findUnique did not filter on
  // isDeleted, so a soft-deleted post still returns its { savedCount }.
  return socialPostRepository.findById(postId, {
    includeDeleted: true,
    select: { savedCount: true },
  });
};

// ── Verify post is visible ──────────────────────────────────────────────
export const assertPostVisible = async (postId, viewerId) => {
  // includeDeleted: true — this helper does its OWN isDeleted/isDraft check
  // below and throws "Post not found"; letting the repository filter the
  // row out instead would move that decision out of the helper.
  const post = await socialPostRepository.findById(postId, {
    includeDeleted: true,
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

  const author = await userRepository.findById(post.authorId, {
    select: { isPrivate: true },
  });

  if (author?.isPrivate && String(post.authorId) !== String(viewerId)) {
    const follow = await followRepository.findByFollowerAndFollowing(viewerId, post.authorId, {
      select: { status: true },
    });

    if (follow?.status !== "accepted") {
      throw new Error("This post is from a private account");
    }
  }

  return post;
};