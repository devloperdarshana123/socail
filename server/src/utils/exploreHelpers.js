import {
  socialPostRepository,
  userRepository,
  followRepository,
} from "../config/repositories.js";

// Minimal persistence helper for the explore flow (Milestone 5C; migrated to
// the repository layer in Phase 7A). Every query below is the same shape as
// the prisma.* call it replaces. Search logic is NOT changed; only the access
// path moved. The controller keeps all caching, cursor/hasMore computation,
// visibility gating, and response shaping.
//
// Explore paginates with Prisma's NATIVE cursor (`cursor` + skip: 1) ordered
// by `id` — deliberately different from postHelpers' feed, which filters on
// `createdAt`. Both shapes are preserved as-is via separate repository
// methods rather than being unified.

const AUTHOR_SELECT = {
  id: true, username: true, fullName: true, avatar: true,
  isVerifiedBadge: true, accountStatus: true, role: true,
};

// getExplorePosts: public feed, optionally filtered by type.
export const findExplorePosts = async ({ type, limit, cursor }) => {
  const where = {
    isDeleted: false,
    isDraft: false,
    visibility: "public",
    author: { accountStatus: { not: "deactivated" }, role: { not: "super_admin" } },
    ...(type !== "all" && { type }),
  };

  return socialPostRepository.findManyWithIdCursor(where, {
    take: limit + 1,
    cursor,
    select: {
      id: true, type: true, caption: true, media: true,
      likesCount: true, commentsCount: true, viewsCount: true, savedCount: true,
      createdAt: true, hashtags: true, commentsDisabled: true, likesHidden: true,
      author: { select: AUTHOR_SELECT },
    },
  });
};

// searchPosts: caption/hashtag match over public posts.
export const searchExplorePosts = async ({ q, limit, cursor }) => {
  const where = {
    isDeleted: false,
    isDraft: false,
    visibility: "public",
    author: { accountStatus: { not: "deactivated" }, role: { not: "super_admin" } },
    or: [
      { caption:  { like: q, caseInsensitive: true } },
      { hashtags: { hasAny: [q.toLowerCase()] } },
    ],
  };

  return socialPostRepository.findManyWithIdCursor(where, {
    take: limit + 1,
    cursor,
    select: {
      id: true, type: true, caption: true, media: true,
      likesCount: true, commentsCount: true, viewsCount: true,
      createdAt: true, hashtags: true,
      author: { select: AUTHOR_SELECT },
    },
  });
};

// getPublicProfile: active, non-admin user by username.
export const findPublicProfileUser = async (username) => {
  return userRepository.findFirstWhere(
    { username, accountStatus: "active", role: { not: "super_admin" } },
    {
      select: {
        id: true, fullName: true, username: true, avatar: true, coverPhoto: true,
        bio: true, designation: true, businessCategory: true, location: true,
        followersCount: true, followingCount: true, isVerifiedBadge: true, isPrivate: true,
      },
    }
  );
};

// getPublicProfile: viewer's follow relationship to the profile owner.
export const findFollowStatus = async (followerId, followingId) => {
  return followRepository.findByFollowerAndFollowing(followerId, followingId, {
    select: { status: true },
  });
};

// getPublicProfile: the profile owner's own public posts.
export const findProfilePosts = async ({ authorId, postLimit, postCursor }) => {
  return socialPostRepository.findManyWithIdCursor(
    { authorId, isDraft: false, isDeleted: false, visibility: "public" },
    {
      take: postLimit + 1,
      cursor: postCursor,
      select: {
        id: true, type: true, media: true, caption: true,
        likesCount: true, commentsCount: true, viewsCount: true,
        commentsDisabled: true, likesHidden: true, createdAt: true,
      },
    }
  );
};
