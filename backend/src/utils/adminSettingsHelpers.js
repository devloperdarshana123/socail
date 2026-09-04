import { transactionRunner } from "../config/transaction.js";
import { userRepository, sessionRepository } from "../config/repositories.js";

// Persistence owner for the admin-settings domain (Milestone 6D; migrated to
// the repository layer in Phase 7A).
//
// Follows the convention from 6A–6C: one <domain>Helpers.js per admin
// controller, owning that controller's persistence ONLY. Deliberately NOT
// here (controller responsibilities, unchanged): Cloudinary upload/delete,
// bcrypt hashing/comparison, the sha256 cookie-hash computation, all
// validation, response formatting and logging.
//
// ── TRANSACTION NOTE (updated in Phase 7A) ──────────────────────────────
// changeAdminPasswordAndRevokeOtherSessions was an ARRAY-FORM
// prisma.$transaction([...]) from Milestone 6D. Phase 7A converts it to the
// callback form via transactionRunner.run().
//
// WHY THE CONVERSION WAS UNAVOIDABLE at the repository boundary (it is not
// a stylistic change):
//   1. Array-form $transaction requires an array of un-awaited PrismaPromise
//      objects. Repository methods are `async` with internal try/catch, so
//      they return ordinary already-started Promises — Prisma rejects those
//      in the array form. Producing PrismaPromises would mean the helper
//      holding `prisma.user.update(...)` directly, i.e. NOT migrating.
//   2. The transaction spans TWO models owned by TWO repositories
//      (UserRepository, SessionRepository), so no single repository can own
//      it without violating the one-repository-per-model boundary.
//   3. PrismaTransaction.run() supports callback form only — established
//      empirically in Milestone 6D.
//
// WHAT IS PRESERVED, and proven by tests in the characterization suite:
//   • ORDERING — the password update still executes before the session
//     revocation (sequential awaits preserve array order exactly).
//   • ROLLBACK — both statements still commit or roll back together; a
//     failure in the revocation leaves the old password intact.
//   • CONDITIONAL currentHash — the `...(currentHash ? { tokenHash: { not:
//     currentHash } } : {})` where-spread is copied verbatim, so passing a
//     hash keeps that session and omitting one revokes every session.
//   • ERROR PROPAGATION — TransactionError preserves the original message
//     and (since Milestone 1) the normalized .code/.name.
// `currentHash` is still computed by the controller (crypto stays there).
//
// Duplication note: deleteAdminSettingsSessionById repeats the query shape
// of adminAuthHelpers.deleteAdminRefreshTokenById. That is deliberate —
// per the admin convention each domain helper owns its own queries, and
// the extraction rules forbid merging across domains.

// getAdminProfile: the admin's own settings-profile view.
export const findAdminProfile = (userId) => {
  return userRepository.findById(userId, {
    select: {
      id:                   true,
      fullName:             true,
      username:             true,
      email:                true,
      avatar:               true,
      designation:          true,
      bio:                  true,
      notificationsEnabled: true,
      role:                 true,
      createdAt:            true,
      lastActiveAt:         true,
    },
  });
};

// updateAdminProfile: is this username taken by ANOTHER user?
export const findUserByUsernameExcludingId = (username, excludeId) => {
  return userRepository.findFirstWhere({
    username,
    id: { not: excludeId },
  });
};

// updateAdminProfile: is this email in use by ANOTHER user?
export const findUserByEmailExcludingId = (email, excludeId) => {
  return userRepository.findFirstWhere({
    email,
    id: { not: excludeId },
  });
};

// updateAdminProfile: apply the controller-assembled profile update.
export const updateAdminProfileFields = (userId, data) => {
  return userRepository.update(userId, data, {
    select: {
      id:          true,
      fullName:    true,
      username:    true,
      email:       true,
      designation: true,
      bio:         true,
      avatar:      true,
      role:        true,
    },
  });
};

// updateAdminAvatar: current avatar (for Cloudinary cleanup by the controller).
export const findAdminAvatar = (userId) => {
  return userRepository.findById(userId, {
    select: { id: true, avatar: true },
  });
};

// updateAdminAvatar: persist the new avatar object.
export const updateAdminAvatar = (userId, avatar) => {
  return userRepository.update(userId, { avatar });
};

// changeAdminPassword: current hash for bcrypt verification (controller-side).
export const findAdminPassword = (userId) => {
  return userRepository.findById(userId, {
    select: { id: true, password: true },
  });
};

// changeAdminPassword: set the new password AND log out all other devices,
// atomically. Converted from array-form to the callback runner — see the
// header note for why that was unavoidable and what is preserved. The two
// statements keep their original ORDER: password first, revocation second.
export const changeAdminPasswordAndRevokeOtherSessions = (userId, hashedPassword, currentHash) => {
  return transactionRunner.run(async (tx) => {
    const updatedUser = await userRepository.update(
      userId,
      { password: hashedPassword },
      { tx }
    );

    const revoked = await sessionRepository.deleteManyWhere(
      {
        userId,
        ...(currentHash ? { tokenHash: { not: currentHash } } : {}),
      },
      { tx }
    );

    // Array-form $transaction resolved to an array of per-operation results;
    // returning the same tuple keeps the resolved shape identical for any
    // caller that reads it.
    return [updatedUser, revoked];
  });
};

// updateNotificationSettings: persist the toggle.
export const updateAdminNotificationSettings = (userId, notificationsEnabled) => {
  return userRepository.update(userId, { notificationsEnabled });
};

// getAdminSessions: all non-expired sessions, most recently used first.
export const findActiveAdminSessions = (userId, now) => {
  return sessionRepository.findManyWhere(
    {
      userId,
      expiresAt: { gt: now },
    },
    { orderBy: { lastUsedAt: "desc" } }
  );
};

// revokeAdminSession: the session, scoped to this admin (authorization guard).
export const findAdminSessionById = (sessionId, userId) => {
  return sessionRepository.findFirstWhere({ id: sessionId, userId });
};

// revokeAdminSession: remove it.
export const deleteAdminSettingsSessionById = (sessionId) => {
  return sessionRepository.delete(sessionId);
};

// revokeAllOtherSessions: log out every other device, keeping the current
// session when its hash is known. Conditional where-spread preserved verbatim.
export const deleteOtherAdminSessions = (userId, currentHash) => {
  return sessionRepository.deleteManyWhere({
    userId,
    ...(currentHash ? { tokenHash: { not: currentHash } } : {}),
  });
};
