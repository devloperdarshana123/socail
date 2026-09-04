
import {
  reportRepository,
  socialPostRepository,
  commentRepository,
  userRepository,
} from "../config/repositories.js";

// Persistence for the report domain now flows through the repository layer
// (Phase 7A) instead of the Prisma client directly. Database/behavior are
// unchanged — every query below is the same shape as the prisma.* call it
// replaces; only the access path moved.
//
// BUSINESS DECISIONS STAY HERE, repositories stay persistence-only:
//   • VALID_MODELS / VALID_REASONS validation and its thrown messages
//   • the duplicate-report rule (return the original, do not update it)
//   • calculateReportPriority's low/medium/high thresholds, and the choice
//     of which statuses count as "open"
//   • back-propagating the new priority to existing open reports
//   • the polymorphic postId/commentId/reportedUserId fan-out
//   • the status/action allow-lists and the warn→active / suspend→suspended
//     / ban→banned mapping
//   • the placeholder objects substituted for deleted targets
// The repositories below only execute the resulting queries.

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const VALID_MODELS = new Set(["Post", "Comment", "User"]);

const VALID_REASONS = new Set([
  "spam",
  "nudity_or_sexual_content",
  "hate_speech",
  "violence_or_dangerous",
  "harassment_or_bullying",
  "false_information",
  "intellectual_property",
  "self_harm_or_suicide",
  "scam_or_fraud",
  "illegal_activity",
  "other",
]);

// ── Controller-extracted target-existence guards (Milestone 5H) ─────────
//    Each query below was inline in report.controller.js's submitReport and
//    is moved here verbatim so the controller performs no direct DB access.
//    Queries are byte-identical to the ones they replace; null is returned
//    for a missing row exactly as Prisma's findUnique does. The controller
//    keeps the targetModel branching and its 404 responses.

export const findPostExists = (targetId) => {
  return socialPostRepository.findById(targetId, {
    includeDeleted: true,
    select: { id: true },
  });
};

export const findCommentExists = (targetId) => {
  return commentRepository.findById(targetId, {
    select: { id: true },
  });
};

export const findUserExists = (targetId) => {
  return userRepository.findById(targetId, {
    select: { id: true },
  });
};

// ── Get recent report count (rate limit check) ──────────────────────────
export const getRecentReportCount = async (userId, windowMs = 60_000) => {
  const windowStart = new Date(Date.now() - windowMs);

  const count = await reportRepository.count({
    reportedById: userId,
    createdAt: { gte: windowStart },
  });

  return count;
};

// ── Submit report (polymorphic) ─────────────────────────────────────────
// ── Calculate priority based on existing open reports ──────────────────
const calculateReportPriority = async (targetId, targetModel) => {
  const count = await reportRepository.count({
    targetId,
    targetModel,
    status: { in: ["pending", "reviewed"] },
  });
  if (count >= 3) return "high";
  if (count >= 1) return "medium";
  return "low";
};
export const submitReport = async (reportData) => {
  const { reportedBy, targetId, targetModel, reason, description = "" } = reportData;

  // Validate inputs
  if (!VALID_MODELS.has(targetModel)) {
    throw new Error(`Invalid targetModel. Allowed: ${[...VALID_MODELS].join(", ")}`);
  }

  if (!VALID_REASONS.has(reason)) {
    throw new Error("Invalid reason");
  }

  if (!isValidUUID(reportedBy)) {
    throw new Error("Invalid reporter ID");
  }

  if (!isValidUUID(targetId)) {
    throw new Error("Invalid target ID");
  }

  // Check if already reported (duplicate protection)
 // Check if already reported (duplicate protection)
  const existing = await reportRepository.findFirstWhere({
    reportedById: reportedBy,
    targetId,
    targetModel,
  });

  if (existing) {
    return { alreadyReported: true, report: existing };
  }

  // Create report
  // Create report
  const priority = await calculateReportPriority(targetId, targetModel);

  const report = await reportRepository.create({
    reportedById: reportedBy,
    targetId: targetId,
    postId: targetModel === "Post" ? targetId : null,
    commentId: targetModel === "Comment" ? targetId : null,
    reportedUserId: targetModel === "User" ? targetId : null,
    targetModel,
    reason,
    description: description.trim().slice(0, 500),
    status: "pending",
    priority,
  });

  // Purani open reports ki priority bhi update karo same target pe
  await reportRepository.updateManyWhere(
    {
      targetId,
      targetModel,
      status: { in: ["pending", "reviewed"] },
      id: { not: report.id },
    },
    { priority }
  );

  return { alreadyReported: false, report };
};

// ── Get reports (admin only) ────────────────────────────────────────────
export const getReports = async ({ status = "pending", limit = 20, offset = 0 } = {}) => {
  const where = {};

  if (status) {
    where.status = status;
  }

  const reports = await reportRepository.findManyWithRelations(where, {
    take: limit,
    skip: offset,
    include: {
      reportedBy: {
        select: { id: true, username: true, fullName: true, avatar: true },
      },
      post: {
        select: {
          id: true, caption: true, media: true,
          author: { select: { id: true, username: true, fullName: true, avatar: true } },
        },
      },
      comment: {
        select: {
          id: true,
          content: true,
          author: { select: { id: true, username: true, fullName: true, avatar: true } },
        },
      },
    },
  });

  const total = await reportRepository.count(where);

  return { reports, total, limit, offset };
};

// ── Update report status (admin) ────────────────────────────────────────
export const updateReportStatus = async (reportId, status) => {
  const validStatuses = ["pending", "reviewed", "resolved", "dismissed"];

  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Allowed: ${validStatuses.join(", ")}`);
  }

  const updated = await reportRepository.update(reportId, { status });

  return updated;
};

// ── Get report details (admin) ──────────────────────────────────────────
// ✅ FIX: Include post aur reportedUser both
export const getReportDetails = async (reportId) => {
  const report = await reportRepository.findById(reportId, {
    include: {
      reportedBy: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          accountStatus: true,
        },
      },
      post: {
        select: {
          id: true,
          caption: true,
          media: true,
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
      comment: {
        select: {
          id: true,
          content: true,
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
     reportedUser: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          accountStatus: true,
          isVerifiedBadge: true,
        },
      },
    },
  });

  if (!report) return null;

  // ✅ Handle deleted/removed post, comment, or user
  if (report.targetModel === "Post" && !report.post) {
    report.post = {
      id: report.targetId,
      caption: "Post no longer available",
      media: null,
      author: {
        id: null,
        username: "Unknown",
        fullName: "Unknown",
        avatar: null,
        isVerifiedBadge: false,
      },
    };
  }

  if (report.targetModel === "Comment" && !report.comment) {
    report.comment = {
      id: report.targetId,
      content: "Comment no longer available",
      author: {
        id: null,
        username: "Unknown",
        fullName: "Unknown",
        avatar: null,
        isVerifiedBadge: false,
      },
    };
  }

  if (report.targetModel === "User" && !report.reportedUser) {
    report.reportedUser = {
      id: report.targetId,
      username: "User no longer available",
      fullName: "Deleted Account",
      avatar: null,
      accountStatus: "deleted",
      isVerifiedBadge: false,
    };
  }

  return report;
};



// ── Dismiss report (admin) ──────────────────────────────────────────────
export const dismissReport = async (reportId) => {
  return reportRepository.update(reportId, { status: "dismissed" });
};

// ── Resolve report + take action ────────────────────────────────────────
export const resolveReport = async (reportId, action = null) => {
  // action: null | "warn" | "suspend" | "ban"
  const validActions = [null, "warn", "suspend", "ban"];

  if (!validActions.includes(action)) {
    throw new Error("Invalid action");
  }

  const report = await reportRepository.findById(reportId, {
    select: { id: true, postId: true, targetModel: true, targetId: true },
  });

  if (!report) {
    throw new Error("Report not found");
  }

  // Take action on target user (if User report)
  if (report.targetModel === "User" && action) {
    const statusMap = {
      warn: "active", // just warn
      suspend: "suspended",
      ban: "banned",
    };

    await userRepository.update(report.targetId, {
      accountStatus: statusMap[action] || "active",
    });
  }

  // Update report status
  const updated = await reportRepository.update(reportId, {
    status: "resolved",
    actionTaken: action || "none",
  });

  return updated;
};