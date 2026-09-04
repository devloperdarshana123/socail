import {
  commentRepository,
  socialPostRepository,
  reportRepository,
  auditLogRepository,
} from "../config/repositories.js";

// Persistence owner for the admin-comment domain (Milestone 6E; migrated to
// the repository layer in Phase 7A — access path only).
//
// MODERATION BEHAVIOUR IS UNCHANGED, including every oddity: the
// count-adjust branching and its `.catch(() => {})` swallow stay in the
// CONTROLLER (this helper never swallows anything itself), the audit-log
// write-side ownership boundary is unchanged, soft delete writes only the
// controller-assembled bundle, and bulk update still skips already-deleted
// rows via the controller's `isDeleted: false` predicate.
//
// Follows the convention from 6A–6D: one <domain>Helpers.js per admin
// controller, owning that controller's persistence ONLY. Deliberately NOT
// here (controller responsibilities, unchanged): validation, moderation
// decisions (status maps, count-adjust branching), avatar normalization,
// audit-meta assembly, the error-swallowing `.catch(() => {})` policy on
// count adjustments, logging, and response formatting.
//
// ── AUDIT-LOG OWNERSHIP BOUNDARY ─────────────────────────────────────────
// createCommentAuditLog persists THIS controller's audit entries. It lives
// here — NOT in adminAuditLogHelpers.js — because that helper owns the
// auditlog controller's READ/statistics persistence, while each admin
// domain owns its own WRITE-side audit persistence. The audit `data`
// object (performedBy, targetMeta, ip/userAgent, note) is assembled by the
// controller; this helper only persists it. One helper serves both the
// per-comment and the bulk audit call-sites — same query shape, both
// call-sites preserved separately in the controller.
//
// PRESERVED ODDITIES (byte-identical, deliberately not fixed):
//   • findCommentLevelReports filters { postId: null } globally — it
//     returns ALL comment/user-level reports, not one comment's (the
//     original code's own comment acknowledges this).
//   • The controller's "most_reports" sort maps to repliesCount desc.

// getAllComments: filtered/sorted/paginated list with nested author+post.
// `where`, `orderBy`, `skip`, `take` are assembled by the controller.
export const findComments = (where, orderBy, skip, take) => {
  return commentRepository.findManyWithCursor(where, {
    orderBy,
    skip,
    take,
    select: {
      id:              true,
      content:         true,
      status:          true,
      isDeleted:       true,
      isPinned:        true,
      likesCount:      true,
      repliesCount:    true,
      createdAt:       true,
      updatedAt:       true,
      author: {
        select: {
          id:            true,
          username:      true,
          fullName:      true,
          avatar:        true,
          accountStatus: true,
        },
      },
      post: {
        select: {
          id:        true,
          caption:   true,
          type:      true,
          media:     true,
          createdAt: true,
          author: {
            select: {
              id:       true,
              username: true,
              fullName: true,
              avatar:   true,
            },
          },
        },
      },
    },
  });
};

// getAllComments total + all five getCommentStats counts — every call-site
// is `prisma.comment.count({ where })` with a controller-assembled where.
export const countComments = (where) => {
  return commentRepository.count(where, { includeDeleted: true });
};

// getCommentById: full detail with author (incl. email) and post.
export const findCommentDetail = (id) => {
  return commentRepository.findFirstWhere({ id, isDeleted: false }, {
    include: {
      author: {
        select: {
          id:            true,
          username:      true,
          fullName:      true,
          avatar:        true,
          accountStatus: true,
          email:         true,
        },
      },
      post: {
        select: {
          id:        true,
          caption:   true,
          type:      true,
          createdAt: true,
          author: {
            select: { id: true, username: true, fullName: true, avatar: true },
          },
        },
      },
    },
  });
};

// getCommentById: comment-level reports. Preserved oddity — see header.
export const findCommentLevelReports = () => {
  return reportRepository.findManyWhere(
    { postId: null }, // Comment-level reports — adjust if schema has commentId
    {
      select: {
        id:        true,
        reason:    true,
        status:    true,
        createdAt: true,
        reportedBy: { select: { username: true } },
      },
    }
  );
};

// updateCommentStatus / deleteComment: the not-yet-deleted comment
// (identical guard at both call-sites — one helper, call-sites separate).
export const findModeratableComment = (id) => {
  return commentRepository.findFirstWhere({ id, isDeleted: false });
};

// updateCommentStatus / deleteComment: post commentsCount adjustments.
// The controller keeps its `.catch(() => {})` error-swallowing policy —
// these still REJECT on a missing post, exactly as before; the swallow
// happens at the call-site, not here.
export const decrementPostCommentsCount = (postId) => {
  return socialPostRepository.update(postId, { commentsCount: { dec: 1 } });
};

export const incrementPostCommentsCount = (postId) => {
  return socialPostRepository.update(postId, { commentsCount: { inc: 1 } });
};

// updateCommentStatus: apply the controller-assembled moderation update,
// returning the author summary for the response.
export const updateCommentModeration = (id, data) => {
  return commentRepository.update(id, data, {
    include: {
      author: {
        select: { id: true, username: true, fullName: true, avatar: true },
      },
    },
  });
};

// deleteComment: apply the controller-assembled soft-delete bundle.
// update(), NOT delete() — the repository's delete() would apply its own
// soft-delete payload instead of the controller's bundle.
export const softDeleteCommentById = (id, data) => {
  return commentRepository.update(id, data);
};

// bulkUpdateComments: one updateMany over the controller-assembled where/data.
export const bulkUpdateComments = (where, data) => {
  return commentRepository.updateManyWhere(where, data);
};

// Audit-log write-side persistence for this domain — see header boundary
// note. Serves both the per-comment and bulk audit call-sites.
export const createCommentAuditLog = (data) => {
  return auditLogRepository.create(data);
};
