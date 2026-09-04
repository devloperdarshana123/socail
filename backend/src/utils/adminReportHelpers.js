import {
  reportRepository,
  socialPostRepository,
  userRepository,
} from "../config/repositories.js";

// Persistence owner for the admin-report domain (Milestone 6G).
//
// Follows the convention from 6A–6F: one <domain>Helpers.js per admin
// controller, owning that controller's persistence ONLY. (reportHelpers.js
// from Milestone 5H owns the NON-admin report controller — separate
// domain.) Deliberately NOT here (controller responsibilities, unchanged):
// filter/where assembly, all update data bundles (claim/release/escalate/
// review fields and timestamps), claim-conflict and escalation-state
// branching, side-effect orchestration (content_removed / user_suspended /
// user_banned), res.locals.auditMeta, validation, logging, and response
// shaping. ZERO transactions in this domain — the content_removed
// side-effects run via Promise.all in the controller, exactly as before.
//
// Helpers with identical query shapes serve multiple call-sites (the 6E
// convention): countReports (list total + 2 sibling counts),
// updateReportById (claim/release/escalate), updateReportsWhere
// (auto-resolve/bulk/stale-claims), updateUserAccountStatus
// (suspend/ban), groupReportsByStatus (stats + list sidebar). Distinct
// queries are NOT merged — the two open-priority groupBys differ only by
// orderBy and remain separate methods.
//
// RAW SQL: the single daily-trend statement moved one layer down in Phase
// 7A into ReportRepository.findDailyTrendRaw — BYTE-IDENTICAL, md5-verified
// against this file's previous contents (same hash recorded in Milestone
// 6G). Not rewritten, not optimized, not re-parameterized, and NOT replaced
// with groupBy (which cannot bucket by a truncated date — that is why it is
// raw). Still PostgreSQL-specific by design (TO_CHAR / AT TIME ZONE 'UTC' /
// ::int) and still a bound-parameter tagged template. No Mongo-compat
// rewrite is attempted here (deliberately deferred phase).
//
// AGGREGATIONS: the five groupBy queries also moved into the repository as
// five INDEPENDENT methods. They were not merged, re-ordered or generalised
// — including the two open-priority variants that differ only by an orderBy
// clause, which remain separate because the stats endpoint and the list
// sidebar each own their own query.
//
// PRESERVED ODDITIES (owned by the call-sites, documented here because
// the queries live here now):
//   • orderBy { priority: "desc" } sorts alphabetically (medium > low >
//     high > critical), not by severity.
//   • findReportHistory receives the controller-assembled where in which
//     a provided beforeId OVERWRITES the id-not-self exclusion (object
//     spread on the same key).
//   • updateReportsWhere serves releaseStaleClams' GLOBAL stale-claim
//     sweep — no admin scoping, as before.

// Common report include — reportedBy, post (target), reviewedBy,
// claimedBy, escalatedBy. Moved verbatim from the controller.
const reportInclude = {
  reportedBy: {
    select: { id: true, username: true, fullName: true, avatar: true },
  },
  post: {
    select: {
      id:            true,
      caption:       true,
      media:         true,
      type:          true,
      likesCount:    true,
      commentsCount: true,
      author: {
        select: { id: true, username: true, fullName: true, avatar: true, isVerifiedBadge: true },
      },
    },
  },
 reportedUser: { select: { id: true, username: true, fullName: true, avatar: true } },
  claimedBy:   { select: { id: true, username: true, fullName: true, avatar: true } },
  escalatedBy: { select: { id: true, username: true, fullName: true } },
  reviewedBy:  { select: { id: true, username: true, fullName: true } },
};

// getReportStats + getAllReports sidebar: status breakdown (identical at
// both call-sites — one helper, call-sites separate).
export const groupReportsByStatus = () => {
  return reportRepository.groupByStatus();
};

// getReportStats: top 5 reasons.
export const groupTopReportReasons = () => {
  return reportRepository.groupByTopReasons();
};

// getReportStats: by target model.
export const groupReportsByTargetModel = () => {
  return reportRepository.groupByTargetModel();
};

// getReportStats: priority breakdown of open reports — WITH orderBy.
export const groupOpenReportsByPriorityOrdered = () => {
  return reportRepository.groupByPriorityOpenOrdered();
};

// getAllReports sidebar: priority breakdown of open reports — NO orderBy.
// Distinct from the stats variant; deliberately not merged.
export const groupOpenReportsByPriority = () => {
  return reportRepository.groupByPriorityOpen();
};

// getReportStats: last-7-days daily trend — raw SQL for date grouping.
export const findReportDailyTrend = (since7days) => {
  return reportRepository.findDailyTrendRaw(since7days);
};

// getAllReports: filtered/sorted/paginated list with the shared include.
// `where` and `orderBy` are assembled by the controller.
export const findReports = (where, orderBy, skip, take) => {
  return reportRepository.findManyOrdered(where, {
    orderBy,
    skip,
    take,
    include: reportInclude,
  });
};

// getAllReports total + getReportById's two sibling counts — all three
// call-sites are the same counting query over a controller-assembled
// where, so they share one helper.
export const countReports = (where) => {
  return reportRepository.count(where);
};

// getReportById: full detail incl. the comment relation.
export const findReportDetail = (id) => {
  return reportRepository.findById(id, {
    include: {
      reportedBy: {
        select: {
          id: true, username: true, fullName: true, avatar: true,
          accountStatus: true, isVerifiedBadge: true, createdAt: true,
        },
      },
      post: {
        select: {
          id: true, caption: true, media: true, type: true,
          likesCount: true, commentsCount: true, createdAt: true,
          author: {
            select: { id: true, username: true, fullName: true, avatar: true, isVerifiedBadge: true },
          },
        },
      },
      reportedUser: { select: { id: true, username: true, fullName: true, avatar: true } },
      comment: {
        select: {
          id: true,
          content: true,
          author: {
            select: { id: true, username: true, fullName: true, avatar: true, isVerifiedBadge: true },
          },
        },
      },
      reviewedBy:  { select: { id: true, username: true, fullName: true, avatar: true } },
      claimedBy:   { select: { id: true, username: true, fullName: true, avatar: true } },
      escalatedBy: { select: { id: true, username: true, fullName: true, avatar: true } },
    },
  });
};

// getReportHistory: resolve the report's post target.
export const findReportPostId = (id) => {
  return reportRepository.findById(id, {
    select: { postId: true },
  });
};

// getReportHistory: sibling reports (controller-assembled where — see
// beforeId oddity in the header). Fixed createdAt-desc ordering, so this
// uses findManyWithRelations rather than the caller-ordered variant.
export const findReportHistory = (where, take) => {
  return reportRepository.findManyWithRelations(where, {
    take,
    include: {
      reportedBy: { select: { id: true, username: true, fullName: true, avatar: true } },
      reviewedBy: { select: { id: true, username: true, fullName: true } },
    },
  });
};

// claimReport: current claim state incl. the claimer's username.
export const findReportWithClaimer = (id) => {
  return reportRepository.findById(id, {
    include: { claimedBy: { select: { id: true, username: true } } },
  });
};

// releaseReport: minimal claim-ownership state.
export const findReportClaimState = (id) => {
  return reportRepository.findById(id, {
    select: { id: true, claimedById: true },
  });
};

// escalateReport: minimal escalation state.
export const findReportEscalationState = (id) => {
  return reportRepository.findById(id, {
    select: { id: true, escalated: true, status: true },
  });
};

// claimReport / releaseReport / escalateReport: apply the
// controller-assembled data bundle, returning the shared include
// (identical query shape at all three call-sites).
export const updateReportById = (id, data) => {
  return reportRepository.update(id, data, { include: reportInclude });
};

// updateReportStatus: apply the controller-assembled review bundle with
// the trimmed include (reportedUser deliberately absent — see the
// user-action oddity characterized in the tests). Still THROWS for a
// missing id and still carries `code: "P2025"` — the repository normalizes
// it to NotFoundError, which preserves the Prisma code the controller's
// error handling branches on.
export const updateReportForResolution = (id, data) => {
  return reportRepository.update(id, data, {
    include: {
      reportedBy: { select: { id: true, username: true, fullName: true, avatar: true } },
      reviewedBy: { select: { id: true, username: true, fullName: true, avatar: true } },
      post:       { select: { id: true, authorId: true } },
    },
  });
};

// updateReportStatus content_removed side-effect: soft-delete the post
// (data bundle assembled by the controller). update(), NOT delete() — the
// repository's delete() would apply its own soft-delete payload instead of
// the controller's bundle.
export const softDeleteReportedPost = (postId, data) => {
  return socialPostRepository.update(postId, data);
};

// updateReportStatus auto-resolve / bulkUpdateReports / releaseStaleClams:
// one updateMany over the controller-assembled where/data (identical
// query shape at all three call-sites — incl. the GLOBAL stale sweep).
export const updateReportsWhere = (where, data) => {
  return reportRepository.updateManyWhere(where, data);
};

// updateReportStatus user_suspended / user_banned side-effect: set the
// controller-assembled accountStatus on the target user.
export const updateUserAccountStatus = (userId, data) => {
  return userRepository.update(userId, data);
};
