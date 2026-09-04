import { consentRepository } from "../config/repositories.js";

// Minimal persistence helper for the consent flow (Milestone 5C; migrated to
// the repository layer in Phase 7A). The queries below are the same shape as
// the prisma.* calls they replace. Only persistence lives here; the
// controller keeps all request validation and value-shaping (defaults,
// req.ip/user-agent extraction, policy-version selection).

// saveConsent: upsert on the composite (sessionId, policyVersion) key.
export const upsertConsent = async ({
  sessionId,
  policyVersion,
  userId,
  analytics,
  marketing,
  ipAddress,
  userAgent,
}) => {
  return consentRepository.upsertBySessionAndPolicyVersion(sessionId, policyVersion, {
    update: {
      userId,
      analytics,
      marketing,
      ipAddress,
      userAgent,
      consentGivenAt: new Date(),
    },
    create: {
      sessionId,
      userId,
      analytics,
      marketing,
      policyVersion,
      ipAddress,
      userAgent,
      consentGivenAt: new Date(),
    },
  });
};

// getConsent: latest consent record for a session, across policy versions.
export const getLatestConsent = async (sessionId) => {
  return consentRepository.findFirstWhere(
    { sessionId },
    {
      orderBy: { createdAt: "desc" },
      select: {
        analytics: true,
        marketing: true,
        policyVersion: true,
        updatedAt: true,
      },
    }
  );
};
