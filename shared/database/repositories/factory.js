// RepositoryFactory — the one place DATABASE_PROVIDER is read and turned
// into a concrete repository instance. `DATABASE_PROVIDER=prisma` (the
// default, and what production runs today) returns the Prisma-backed
// class for every domain that has one; `DATABASE_PROVIDER=mongo` switches
// to the Mongo-backed class. Nothing else in the codebase should read
// process.env.DATABASE_PROVIDER directly — go through here so the switch
// stays a one-line configuration change, exactly as Milestone 3 requires.
//
// The greenfield domains (companies, roles, verification, locations,
// marketplace — plus the CompanyMember/Permission/VerificationDocument/
// Category/Quote/Order/Contract/Payment entities added in Milestone 4)
// have no Prisma-backed class to switch to — see
// base/NotSupportedByPrismaRepository.js — so their factories always
// return the Mongo implementation regardless of `provider`, and say so.

import { PrismaSessionRepository, MongoSessionRepository } from "./auth/SessionRepository.js";
import { PrismaOtpRepository, MongoOtpRepository } from "./auth/OtpRepository.js";
import { PrismaUserRepository, MongoUserRepository } from "./users/UserRepository.js";
import { PrismaProfileRepository, MongoProfileRepository } from "./profiles/ProfileRepository.js";
import { MongoCompanyRepository } from "./companies/CompanyRepository.js";
import { MongoCompanyMemberRepository } from "./companies/CompanyMemberRepository.js";
import { PrismaRoleRepository, MongoRoleRepository } from "./roles/RoleRepository.js";
import { MongoPermissionRepository } from "./roles/PermissionRepository.js";
import {
  PrismaVerificationCaseRepository,
  MongoVerificationCaseRepository,
} from "./verification/VerificationCaseRepository.js";
import { MongoVerificationDocumentRepository } from "./verification/VerificationDocumentRepository.js";
import { PrismaLocationRepository, MongoLocationRepository } from "./locations/LocationRepository.js";
import { PrismaSocialPostRepository, MongoSocialPostRepository } from "./social/SocialPostRepository.js";
import { PrismaCommentRepository, MongoCommentRepository } from "./social/CommentRepository.js";
import { PrismaLikeRepository, MongoLikeRepository } from "./social/LikeRepository.js";
import { PrismaFollowRepository, MongoFollowRepository } from "./social/FollowRepository.js";
import { PrismaSavedRepository, MongoSavedRepository } from "./social/SavedRepository.js";
import { PrismaBlockRepository, MongoBlockRepository } from "./social/BlockRepository.js";
import { PrismaStoryRepository, MongoStoryRepository } from "./social/StoryRepository.js";
import { PrismaStoryViewRepository, MongoStoryViewRepository } from "./social/StoryViewRepository.js";
import { PrismaPostViewRepository, MongoPostViewRepository } from "./social/PostViewRepository.js";
import { PrismaHighlightRepository, MongoHighlightRepository } from "./social/HighlightRepository.js";
import { PrismaHashtagRepository, MongoHashtagRepository } from "./social/HashtagRepository.js";
import {
  PrismaConversationRepository,
  MongoConversationRepository,
} from "./messaging/ConversationRepository.js";
import { PrismaMessageRepository, MongoMessageRepository } from "./messaging/MessageRepository.js";
import {
  PrismaConversationParticipantRepository,
  MongoConversationParticipantRepository,
} from "./messaging/ConversationParticipantRepository.js";
import {
  PrismaMessageReceiptRepository,
  MongoMessageReceiptRepository,
} from "./messaging/MessageReceiptRepository.js";
import {
  PrismaMarketplaceListingRepository,
  MongoMarketplaceListingRepository,
} from "./marketplace/MarketplaceListingRepository.js";
import { MongoCategoryRepository } from "./marketplace/CategoryRepository.js";
import { MongoQuoteRepository } from "./marketplace/QuoteRepository.js";
import { MongoOrderRepository } from "./marketplace/OrderRepository.js";
import { MongoContractRepository } from "./marketplace/ContractRepository.js";
import { MongoPaymentRepository } from "./marketplace/PaymentRepository.js";
import {
  PrismaNotificationRepository,
  MongoNotificationRepository,
} from "./notifications/NotificationRepository.js";
import {
  PrismaAdminNotificationRepository,
  MongoAdminNotificationRepository,
} from "./notifications/AdminNotificationRepository.js";
import { PrismaAuditLogRepository, MongoAuditLogRepository } from "./audit/AuditLogRepository.js";
import { PrismaConsentRepository, MongoConsentRepository } from "./compliance/ConsentRepository.js";
import { PrismaReportRepository, MongoReportRepository } from "./moderation/ReportRepository.js";
import {
  PrismaSuspensionHistoryRepository,
  MongoSuspensionHistoryRepository,
} from "./moderation/SuspensionHistoryRepository.js";

// The canonical names, plus the aliases an operator plausibly reaches for.
// `postgres`/`postgresql` matter specifically at ROLLBACK: the runbook says
// "unset DATABASE_PROVIDER", but under pressure someone will just as likely
// set it to the name of the database they are going back to. Refusing to
// start at that moment would turn a config change into an outage, so these
// resolve to the Prisma path rather than throwing. Genuinely unknown values
// (`mongodb`, `sqlite`, a typo) still fail closed.
const PROVIDER_ALIASES = {
  prisma: "prisma",
  postgres: "prisma",
  postgresql: "prisma",
  pg: "prisma",
  mongo: "mongo",
};
const KNOWN_PROVIDERS = Object.keys(PROVIDER_ALIASES);

/**
 * Resolve the active provider, and REFUSE an unrecognised one.
 *
 * This used to pass the environment variable through verbatim. Every consumer
 * then compares it with `=== "mongo"`, so a typo — `DATABASE_PROVIDER=mongodb`
 * is the obvious one — fell through to the Postgres branch everywhere. The
 * service started cleanly, served traffic from PostgreSQL, and reported a
 * provider nobody had configured. On a cutover that is the worst possible
 * outcome: you believe you are on Mongo, you are not, and the rollback you
 * eventually run changes nothing because you never left.
 *
 * Unset still means "prisma" — the default that keeps existing deployments
 * and the entire Postgres suite working untouched. Only an explicit,
 * unrecognised value is an error, and it is raised at module load, which is
 * before the process can accept a request.
 */
function getProvider(explicit) {
  const raw = explicit ?? process.env.DATABASE_PROVIDER;
  if (raw === undefined || raw === null || raw === "") return "prisma";
  const provider = PROVIDER_ALIASES[String(raw).trim().toLowerCase()];
  if (!provider) {
    throw new Error(
      `Unknown DATABASE_PROVIDER "${raw}". Expected one of: ${KNOWN_PROVIDERS.join(", ")} ` +
        `(or leave it unset for "prisma").`
    );
  }
  return provider;
}

function dualBacked(PrismaClass, MongoClass) {
  /**
   * @param {object} [opts]
   * @param {string}  [opts.provider]     — overrides DATABASE_PROVIDER.
   * @param {object}  [opts.prismaClient] — required when provider === "prisma".
   * @param {object}  [opts.runtime]      — Prisma-specific runtime values the
   *   shared package cannot import for itself (currently only
   *   `{ jsonNull: Prisma.JsonNull }`, needed by PrismaUserRepository).
   *
   *   M-8 FIX: this argument used to be missing entirely, so
   *   createUserRepository() produced a PrismaUserRepository WITHOUT the
   *   JsonNull sentinel — findUsersWithLocation() would have thrown at call
   *   time. The composition root worked only because it bypassed this
   *   factory and constructed the class directly. Now that the root routes
   *   through here, the runtime has to come with it.
   */
  return ({ provider, prismaClient, runtime } = {}) => {
    const resolved = getProvider(provider);
    if (resolved === "mongo") return new MongoClass();
    if (!prismaClient) {
      throw new Error(`${PrismaClass.name} requires a prismaClient when DATABASE_PROVIDER=prisma`);
    }
    return runtime ? new PrismaClass(prismaClient, runtime) : new PrismaClass(prismaClient);
  };
}

function mongoOnly(MongoClass) {
  return () => new MongoClass();
}

// ── Dual-backed (14, Milestone 3) ──
export const createSessionRepository = dualBacked(PrismaSessionRepository, MongoSessionRepository);
export const createOtpRepository = dualBacked(PrismaOtpRepository, MongoOtpRepository);
export const createUserRepository = dualBacked(PrismaUserRepository, MongoUserRepository);
export const createProfileRepository = dualBacked(PrismaProfileRepository, MongoProfileRepository);
export const createSocialPostRepository = dualBacked(PrismaSocialPostRepository, MongoSocialPostRepository);
export const createCommentRepository = dualBacked(PrismaCommentRepository, MongoCommentRepository);
export const createConversationRepository = dualBacked(PrismaConversationRepository, MongoConversationRepository);
export const createMessageRepository = dualBacked(PrismaMessageRepository, MongoMessageRepository);
export const createNotificationRepository = dualBacked(PrismaNotificationRepository, MongoNotificationRepository);
export const createAdminNotificationRepository = dualBacked(PrismaAdminNotificationRepository, MongoAdminNotificationRepository);
export const createAuditLogRepository = dualBacked(PrismaAuditLogRepository, MongoAuditLogRepository);

// ── Dual-backed (Milestone 4 additions) ──
export const createLikeRepository = dualBacked(PrismaLikeRepository, MongoLikeRepository);
export const createFollowRepository = dualBacked(PrismaFollowRepository, MongoFollowRepository);
export const createSavedRepository = dualBacked(PrismaSavedRepository, MongoSavedRepository);
export const createBlockRepository = dualBacked(PrismaBlockRepository, MongoBlockRepository);
export const createStoryRepository = dualBacked(PrismaStoryRepository, MongoStoryRepository);
export const createStoryViewRepository = dualBacked(PrismaStoryViewRepository, MongoStoryViewRepository);
export const createPostViewRepository = dualBacked(PrismaPostViewRepository, MongoPostViewRepository);
export const createHighlightRepository = dualBacked(PrismaHighlightRepository, MongoHighlightRepository);
export const createHashtagRepository = dualBacked(PrismaHashtagRepository, MongoHashtagRepository);
export const createConversationParticipantRepository = dualBacked(
  PrismaConversationParticipantRepository,
  MongoConversationParticipantRepository
);
export const createMessageReceiptRepository = dualBacked(
  PrismaMessageReceiptRepository,
  MongoMessageReceiptRepository
);
export const createConsentRepository = dualBacked(PrismaConsentRepository, MongoConsentRepository);
export const createReportRepository = dualBacked(PrismaReportRepository, MongoReportRepository);
export const createSuspensionHistoryRepository = dualBacked(
  PrismaSuspensionHistoryRepository,
  MongoSuspensionHistoryRepository
);

// ── Greenfield — always Mongo, `provider`/`prismaClient` accepted but
// ignored (kept in the call signature for consistency, so callers don't
// need to branch on which domain they're instantiating).
export const createCompanyRepository = mongoOnly(MongoCompanyRepository);
export const createCompanyMemberRepository = mongoOnly(MongoCompanyMemberRepository);
export const createRoleRepository = mongoOnly(MongoRoleRepository);
export const createPermissionRepository = mongoOnly(MongoPermissionRepository);
export const createVerificationCaseRepository = mongoOnly(MongoVerificationCaseRepository);
export const createVerificationDocumentRepository = mongoOnly(MongoVerificationDocumentRepository);
export const createLocationRepository = mongoOnly(MongoLocationRepository);
export const createMarketplaceListingRepository = mongoOnly(MongoMarketplaceListingRepository);
export const createCategoryRepository = mongoOnly(MongoCategoryRepository);
export const createQuoteRepository = mongoOnly(MongoQuoteRepository);
export const createOrderRepository = mongoOnly(MongoOrderRepository);
export const createContractRepository = mongoOnly(MongoContractRepository);
export const createPaymentRepository = mongoOnly(MongoPaymentRepository);

export { getProvider as resolveDatabaseProvider };
