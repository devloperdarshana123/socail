import { userRepository, sessionRepository } from "../config/repositories.js";

// Persistence owner for the admin-auth domain (Milestone 6B; migrated to the
// repository layer in Phase 7A — access path only, no behaviour change).
//
// Follows the convention established in 6A: one <domain>Helpers.js per
// admin controller, owning that controller's persistence ONLY.
//
// AUTHENTICATION BEHAVIOR IS FROZEN. Deliberately NOT here — these remain
// controller responsibilities and were not moved:
//   • JWT generation / verification / decoding
//   • cookie handling (set, clear, options)
//   • password hashing + bcrypt comparison
//   • crypto token hashing (hashToken)
//   • blacklist logic and Redis usage
//   • all validation, role checks, account-status branching
//
// Every query below was inline in admin.auth.controller.js and is moved
// here verbatim — byte-identical, including each `select` shape. Note the
// two user lookups intentionally differ: the login lookup includes
// `password` (needed to verify credentials), the refresh lookup does not.

// adminLogin: look up the admin by email. Includes `password` so the
// controller can verify it. Caller passes the already-normalized email.
export const findAdminByEmail = (email) => {
  return userRepository.findByEmail(email, {
    select: {
      id:            true,
      fullName:      true,
      email:         true,
      username:      true,
      password:      true,
      role:          true,
      accountStatus: true,
      avatar:        true,
    },
  });
};

// adminRefreshToken: look up the admin by id. Deliberately EXCLUDES
// `password` — the refresh flow never needs it.
export const findAdminById = (userId) => {
  return userRepository.findById(userId, {
    select: {
      id:            true,
      fullName:      true,
      email:         true,
      username:      true,
      role:          true,
      accountStatus: true,
      avatar:        true,
    },
  });
};

// adminRefreshToken: find the stored, unexpired refresh token for this
// user + hash. Caller supplies the hash (crypto stays in the controller).
export const findValidAdminRefreshToken = (userId, tokenHash, now) => {
  return sessionRepository.findFirstWhere({
    userId,
    tokenHash,
    expiresAt: { gt: now },
  });
};

// adminLogout: remove the refresh token for this user + hash, leaving the
// admin's other sessions/devices intact.
export const deleteAdminRefreshTokenByHash = (userId, tokenHash) => {
  return sessionRepository.deleteManyWhere({
    userId,
    tokenHash,
  });
};

// adminRefreshToken: delete a stored token by its id. Used by BOTH the
// banned/suspended revoke branch and the rotation step — the query is
// identical in each, so one helper serves both call-sites (the call-sites
// themselves are left separate, exactly as they were).
export const deleteAdminRefreshTokenById = (id) => {
  return sessionRepository.delete(id);
};
