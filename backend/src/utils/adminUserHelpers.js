import {
  userRepository,
  socialPostRepository,
  reportRepository,
  suspensionHistoryRepository,
} from "../config/repositories.js";
import { transactionRunner } from "../config/transaction.js";

// Persistence owner for the admin-user domain (Milestone 6H) — the FINAL
// controller migration, and (Phase 7A Milestone 16) the LAST helper to be
// moved onto the repository layer.
//
// Follows the convention from 6A–6G: one <domain>Helpers.js per admin
// controller, owning that controller's persistence ONLY. Deliberately NOT
// here (controller responsibilities, unchanged): validation, the
// status/duration maps, super_admin guards, where/orderBy/sort assembly,
// suspension-payload construction, `_count.posts` → `postsCount`
// remapping, pagination meta, Redis cache del/get/set, sendMail +
// accountSuspended/postDeleted templates, Promise.allSettled bulk
// orchestration and its success/failed accounting, logging, and response
// shaping.
//
// GROUPBY: the single report-status aggregation moved into the repository
// unchanged as ReportRepository.groupByStatusForReporter — same `by`, same
// `where`, same `_count`. It is a SEPARATE method from groupByStatus(),
// which the admin-report domain already owns; adding an optional filter to
// that one would have changed its contract for two existing call-sites.
//
// ── TRANSACTIONS (3 — the last three in the application) ────────────────
//
// All three were array-form `prisma.$transaction([...])`. Phase 7A
// Milestone 13 established that array form is structurally incompatible
// with the repository boundary: it requires un-awaited PrismaPromise
// objects, while repository methods are async and return ordinary Promises.
// All three are therefore converted to `transactionRunner.run(async (tx) =>
// …)`, which is the same PrismaTransaction abstraction used everywhere
// else. Each callback returns an ARRAY in the original element order, so
// the helpers' return values keep the array shape the array form produced.
//
// What the conversion preserves, and how:
//   • ORDERING — the callback awaits each operation in the original array
//     order, which is the order the array form executed them in.
//   • ROLLBACK — a real interactive transaction; a throw anywhere in the
//     callback aborts every earlier statement, exactly as a failing array
//     element did.
//   • ERROR PROPAGATION — repository methods normalize Prisma errors, and
//     PrismaTransaction re-throws as a TransactionError that preserves the
//     cause's `.message`, `.code` and `.name`. So the P2025 code the
//     rollback paths surface, and the `err.message` the bulk loop pushes
//     into `results.failed`, are unchanged.
//   • RETURN VALUES — arrays, same length, same element order.
//
// deleteUserAndSoftDeleteTheirPosts (was controller line 472)
//   [ post.updateMany, user.delete ] — posts first, then the user row.
//
// softDeletePostAndDecrementAuthorCount (was controller line 512) —
//   CONDITIONAL ELEMENT. The original spread:
//     ...(postsCount > 0 ? [prisma.user.update({ decrement: 1 })] : [])
//   becomes an ordinary `if` inside the callback, which is the direct
//   translation: in the array form the guard also ran synchronously,
//   BEFORE $transaction was invoked, against a plain number the controller
//   had already captured from its earlier findFirst. It was never a
//   database read, so evaluating it inside the callback queries nothing
//   extra and observes exactly the same value. The post update is still
//   always element 0; the decrement is still element 1 when present; and a
//   failing decrement still aborts the post soft-delete. The count guard
//   (never decrement below 0) is preserved, not redesigned.
//
// updateUserStatusWithHistory (was controller line 742)
//   [ user.update, suspensionHistory.create ] — one per user inside the
//   controller's Promise.allSettled loop, which stays in the controller.

// getAllUsers: filtered/sorted/paginated list. `where` and `orderBy` are
// assembled by the controller.
export const findUsers = (where, orderBy, skip, take) => {
  return userRepository.findManyOrdered(where, {
    orderBy,
    skip,
    take,
    select: {
      id:                   true,
      username:             true,
      fullName:             true,
      email:                true,
      phoneNumber:          true,
      avatar:               true,
      accountStatus:        true,
      role:                 true,
      isVerifiedBadge:      true,
      isEmailVerified:      true,
      isMobileVerified:     true,
      followersCount:       true,
      followingCount:       true,
      createdAt:            true,
      // M-4 SCOPE NOTE: this is a relation-count PROJECTION, not an
      // aggregate method — it rides inside `select`, so neutralising it
      // needs the projection layer (M-10, include/select → populate), not
      // the aggregate-envelope layer. Left as-is deliberately; the
      // controller's `u._count?.posts ?? 0` remap is unchanged.
      _count: { select: { posts: { where: { isDeleted: false, isDraft: false } } } },
      businessCategory:     true,
      location:             true,
      authProvider:         true,
      isOnboardingComplete: true,
    },
  });
};

// getAllUsers total + getDashboardStats' six user counts — all seven
// call-sites are the same counting query over a controller-assembled where,
// so they share one helper.
export const countUsers = (where) => {
  return userRepository.count(where);
};

// getUserById: full admin profile projection.
export const findUserProfile = (id) => {
  return userRepository.findById(id, {
    select: {
      id:                   true,
      username:             true,
      fullName:             true,
      email:                true,
      phoneNumber:          true,
      avatar:               true,
      coverPhoto:           true,
      bio:                  true,
      designation:          true,
      website:              true,
      gender:               true,
      dateOfBirth:          true,
      businessCategory:     true,
      location:             true,
      isEmailVerified:      true,
      isMobileVerified:     true,
      isPrivate:            true,
      isVerifiedBadge:      true,
      accountStatus:        true,
      role:                 true,
      isOnboardingComplete: true,
      onboardingStep:       true,
      followersCount:       true,
      followingCount:       true,
      postsCount:           true,
      lastActiveAt:         true,
      notificationsEnabled: true,
      language:             true,
      activeSuspension:     true,
      createdAt:            true,
      updatedAt:            true,
    },
  });
};

// getUserPosts / getUserReports: minimal identity lookup (2 call-sites).
export const findUserIdentity = (id) => {
  return userRepository.findById(id, {
    select: { id: true, username: true, fullName: true },
  });
};

// updateUserStatus: the moderation-decision inputs.
export const findUserForStatusChange = (id) => {
  return userRepository.findById(id, {
    select: {
      id:               true,
      email:            true,
      username:         true,
      fullName:         true,
      accountStatus:    true,
      role:             true,
      activeSuspension: true,
    },
  });
};

// deleteUserAccount: the deletion-guard inputs.
export const findUserForDeletion = (id) => {
  return userRepository.findById(id, {
    select: { id: true, username: true, email: true, role: true },
  });
};

// toggleVerifiedBadge: current badge state.
export const findUserBadgeState = (id) => {
  return userRepository.findById(id, {
    select: { id: true, username: true, isVerifiedBadge: true },
  });
};

// bulkUpdateStatus: per-user eligibility inputs.
export const findUserForBulkStatus = (id) => {
  return userRepository.findById(id, {
    select: { id: true, role: true, accountStatus: true },
  });
};

// getSuspensionHistory: user lookup (same projection as the status-change
// lookup minus nothing — kept as its own method because the call-sites are
// distinct endpoints).
export const findUserForSuspensionHistory = (id) => {
  return userRepository.findById(id, {
    select: {
      id:               true,
      username:         true,
      fullName:         true,
      accountStatus:    true,
      role:             true,
      activeSuspension: true,
    },
  });
};

// getUserById: the profile's recent-posts strip.
export const findRecentUserPosts = (id) => {
  return socialPostRepository.findManyOrdered(
    { authorId: id, isDeleted: false, isDraft: false },
    {
      orderBy: { createdAt: "desc" },
      take:    30,
      select: {
        id:            true,
        caption:       true,
        type:          true,
        media:         true,
        likesCount:    true,
        commentsCount: true,
        viewsCount:    true,
        createdAt:     true,
      },
    }
  );
};

// getUserById: report stats grouped by status.
export const groupUserReportsByStatus = (id) => {
  return reportRepository.groupByStatusForReporter(id);
};

// getUserPosts: paginated author posts (controller-assembled where).
export const findUserPosts = (where, skip, take) => {
  return socialPostRepository.findManyOrdered(where, {
    orderBy: { createdAt: "desc" },
    skip,
    take,
    select: {
      id:            true,
      caption:       true,
      type:          true,
      media:         true,
      likesCount:    true,
      commentsCount: true,
      viewsCount:    true,
      createdAt:     true,
    },
  });
};

// getUserPosts / getAllPosts / getDashboardStats totals — all three
// call-sites are the same counting query over a controller-assembled where.
// `includeDeleted: true` because those filters carry their own `isDeleted`
// predicate: the helper's where stays authoritative rather than being
// re-scoped by the repository's soft-delete default.
export const countPosts = (where) => {
  return socialPostRepository.count(where, { includeDeleted: true });
};

// getUserReports: paginated reports filed by the user. findManyWithRelations
// already hardcodes the createdAt-desc ordering this list has always used.
export const findUserReports = (where, skip, take) => {
  return reportRepository.findManyWithRelations(where, {
    skip,
    take,
    include: {
      reportedBy: { select: { id: true, username: true, fullName: true, avatar: true } },
      post:       { select: { id: true, caption: true, media: true, createdAt: true, type: true } },
    },
  });
};

// getUserReports total + getDashboardStats' pending-reports count.
export const countReports = (where) => {
  return reportRepository.count(where);
};

// updateUserStatus: the three suspension-history writes (suspended /
// unsuspended / banned) — identical query shape, data assembled by the
// controller.
export const createSuspensionHistory = (data) => {
  return suspensionHistoryRepository.create(data);
};

// getSuspensionHistory: newest-first history for the user. findAllByUserId,
// NOT findByUserId — the latter paginates and would cap this at 20 rows,
// silently truncating the audit trail the panel renders in full.
export const findSuspensionHistory = (id) => {
  return suspensionHistoryRepository.findAllByUserId(id);
};

// updateUserStatus: apply the controller-assembled status/suspension data.
export const updateUserStatusById = (id, data) => {
  return userRepository.update(id, data, {
    select: {
      id:               true,
      username:         true,
      accountStatus:    true,
      activeSuspension: true,
    },
  });
};

// toggleVerifiedBadge: flip the badge (value computed by the controller).
export const updateUserVerifiedBadge = (id, isVerifiedBadge) => {
  return userRepository.update(id, { isVerifiedBadge }, {
    select: { isVerifiedBadge: true },
  });
};

// getAllPosts: the admin post grid (controller-assembled where/orderBy).
export const findAllPosts = (where, orderBy, skip, take) => {
  return socialPostRepository.findManyOrdered(where, {
    orderBy,
    skip,
    take,
    select: {
      id:            true,
      caption:       true,
      type:          true,
      media:         true,
      likesCount:    true,
      commentsCount: true,
      viewsCount:    true,
      createdAt:     true,
      author: {
        select: {
          id:             true,
          username:       true,
          fullName:       true,
          avatar:         true,
          isVerifiedBadge: true,
          accountStatus:  true,
        },
      },
    },
  });
};

// deletePost: the post + its author's counters, for the delete decision.
// findFirstWhere, NOT findById — the filter carries its own `isDeleted:
// false` predicate and must reach the database verbatim.
export const findPostForDeletion = (postId) => {
  return socialPostRepository.findFirstWhere(
    { id: postId, isDeleted: false },
    {
      include: {
        author: { select: { id: true, username: true, fullName: true, email: true, postsCount: true } },
      },
    }
  );
};

// ── T1 (was controller line 472) ─────────────────────────────────────────
// Soft-delete all posts + hard-delete user, atomically. Element order is
// the original array's: posts first, then the user row.
export const deleteUserAndSoftDeleteTheirPosts = (id, postData) => {
  return transactionRunner.run(async (tx) => {
    const posts = await socialPostRepository.updateManyWhere({ authorId: id }, postData, { tx });
    const user  = await userRepository.delete(id, { tx });
    return [posts, user];
  });
};

// ── T2 (was controller line 512) ─────────────────────────────────────────
// Soft-delete post + decrement postsCount (guard: never below 0),
// atomically. The original's conditional array element becomes an ordinary
// conditional inside the callback — see the header for why that is the
// direct translation and not a behavioural change. The post update is
// always element 0; the decrement is element 1 only when the guard passes.
export const softDeletePostAndDecrementAuthorCount = (postId, postData, authorId, authorPostsCount) => {
  return transactionRunner.run(async (tx) => {
    const results = [await socialPostRepository.update(postId, postData, { tx })];

    if (authorPostsCount > 0) {
      results.push(
        await userRepository.update(authorId, { postsCount: { dec: 1 } }, { tx })
      );
    }

    return results;
  });
};

// ── T3 (was controller line 742) ─────────────────────────────────────────
// One bulk user's status update + history row, atomically. Called from the
// controller's Promise.allSettled loop, which stays in the controller.
export const updateUserStatusWithHistory = (userId, data, historyData) => {
  return transactionRunner.run(async (tx) => {
    const user    = await userRepository.update(userId, data, { tx });
    const history = await suspensionHistoryRepository.create(historyData, { tx });
    return [user, history];
  });
};
