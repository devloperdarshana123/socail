import { adminNotificationRepository } from "../config/repositories.js";

// Persistence owner for the admin-notification domain (Milestone 6A —
// first admin controller; migrated to the repository layer in Phase 7A).
//
// NOTE: this domain has a Postgres table but deliberately NO Mongo
// implementation — Milestone 2 absorbed the feed into the unified
// `notifications` collection, which chat-server owns for writes, and whether
// server/ may write it directly is still an open decision (Phase 6I).
// AdminNotificationRepository's Mongo class fails loudly for exactly that
// reason. Phase 7A changes the access path only; the decision is untouched.
//
// The admin tier had no persistence helper of its own: the existing admin
// utilities are deliberately NOT owners — adminNotify.js is an outbound
// HTTP client, adminQueryFilters.js holds constants, sendAdminToken.js does
// JWT/cookies, and auditLogger.js is middleware. This file establishes the
// convention for the tier: one <domain>Helpers.js per admin controller,
// owning that controller's persistence only.
//
// Every query below was inline in adminNotification.controller.js and is
// moved here verbatim — byte-identical. The controller keeps ALL
// orchestration: limit clamping, the LABEL_MAP lookup, validation,
// logging, and every response shape and status code.

// getAdminNotifications: newest-first page of the global admin feed.
export const findAdminNotifications = (limit) => {
  return adminNotificationRepository.findRecent(limit);
};

// getAdminNotifications: how many notifications are still unread.
export const countUnreadAdminNotifications = () => {
  return adminNotificationRepository.countUnread();
};

// markAllAdminNotificationsRead: flip every unread row to read.
export const markAllAdminNotificationsRead = () => {
  return adminNotificationRepository.markAllRead({ isRead: true, readAt: new Date() });
};

// saveAdminNotification: persist one notification (called by chat-server).
export const createAdminNotification = ({ type, label, meta }) => {
  return adminNotificationRepository.create({
    type,
    label,
    meta,
  });
};
