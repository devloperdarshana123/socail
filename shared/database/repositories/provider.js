// RepositoryProvider — builds one instance of every repository, wired to
// the correct backend via ./factory.js, and returns them organized by the
// same domain structure as the folders on disk. This is what a later
// milestone's application code would import — nobody outside this package
// should call `new PrismaXRepository(...)` or `new MongoXRepository(...)`
// directly; go through here (or ./factory.js if only one repository is
// needed) so the DATABASE_PROVIDER switch stays centralized.
//
// Not wired into server/ or chat-server/ in this milestone — see
// Milestone 3/4's rules ("No endpoint should switch to MongoDB yet").
import {
  createSessionRepository,
  createOtpRepository,
  createUserRepository,
  createProfileRepository,
  createCompanyRepository,
  createCompanyMemberRepository,
  createRoleRepository,
  createPermissionRepository,
  createVerificationCaseRepository,
  createVerificationDocumentRepository,
  createLocationRepository,
  createSocialPostRepository,
  createCommentRepository,
  createLikeRepository,
  createFollowRepository,
  createSavedRepository,
  createBlockRepository,
  createStoryRepository,
  createStoryViewRepository,
  createPostViewRepository,
  createHighlightRepository,
  createHashtagRepository,
  createConversationRepository,
  createMessageRepository,
  createConversationParticipantRepository,
  createMessageReceiptRepository,
  createMarketplaceListingRepository,
  createCategoryRepository,
  createQuoteRepository,
  createOrderRepository,
  createContractRepository,
  createPaymentRepository,
  createNotificationRepository,
  createAuditLogRepository,
  createConsentRepository,
  createReportRepository,
  createSuspensionHistoryRepository,
} from "./factory.js";

/**
 * @param {{ provider?: "prisma"|"mongo", prismaClient?: object }} [options]
 * @returns the full repository tree, one instance per entity (37 total)
 */
export function createRepositoryProvider({ provider, prismaClient } = {}) {
  const opts = { provider, prismaClient };
  return {
    auth: {
      sessions: createSessionRepository(opts),
      otps: createOtpRepository(opts),
    },
    users: createUserRepository(opts),
    profiles: createProfileRepository(opts),
    companies: {
      companies: createCompanyRepository(opts),
      members: createCompanyMemberRepository(opts),
    },
    roles: {
      roles: createRoleRepository(opts),
      permissions: createPermissionRepository(opts),
    },
    verification: {
      cases: createVerificationCaseRepository(opts),
      documents: createVerificationDocumentRepository(opts),
    },
    locations: createLocationRepository(opts),
    social: {
      posts: createSocialPostRepository(opts),
      comments: createCommentRepository(opts),
      likes: createLikeRepository(opts),
      follows: createFollowRepository(opts),
      saved: createSavedRepository(opts),
      blocks: createBlockRepository(opts),
      stories: createStoryRepository(opts),
      storyViews: createStoryViewRepository(opts),
      postViews: createPostViewRepository(opts),
      highlights: createHighlightRepository(opts),
      hashtags: createHashtagRepository(opts),
    },
    messaging: {
      conversations: createConversationRepository(opts),
      messages: createMessageRepository(opts),
      participants: createConversationParticipantRepository(opts),
      receipts: createMessageReceiptRepository(opts),
    },
    marketplace: {
      listings: createMarketplaceListingRepository(opts),
      categories: createCategoryRepository(opts),
      quotes: createQuoteRepository(opts),
      orders: createOrderRepository(opts),
      contracts: createContractRepository(opts),
      payments: createPaymentRepository(opts),
    },
    notifications: createNotificationRepository(opts),
    audit: createAuditLogRepository(opts),
    compliance: {
      consents: createConsentRepository(opts),
    },
    moderation: {
      reports: createReportRepository(opts),
      suspensionHistory: createSuspensionHistoryRepository(opts),
    },
  };
}
