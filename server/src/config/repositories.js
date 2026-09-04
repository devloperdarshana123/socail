import {
  createLikeRepository,
  createSocialPostRepository,
  createCommentRepository,
  createSavedRepository,
  createFollowRepository,
  createUserRepository,
  createStoryRepository,
  createStoryViewRepository,
  createHighlightRepository,
  createSessionRepository,
  createPostViewRepository,
  createConversationRepository,
  createConversationParticipantRepository,
  createMessageRepository,
  createMessageReceiptRepository,
  createBlockRepository,
  createReportRepository,
  createOtpRepository,
  createConsentRepository,
  createNotificationRepository,
  createAdminNotificationRepository,
  createAuditLogRepository,
  createSuspensionHistoryRepository,
  resolveDatabaseProvider,
} from "../../../shared/database/repositories/factory.js";

// App-wide repository instances. Helpers import THESE — not the Prisma
// client — so persistence goes through the repository abstraction instead of
// direct prisma.* calls (Phase 7A). This module is infrastructure/config
// wiring (like prisma.js / transaction.js), which is where a Prisma import
// legitimately belongs.
//
// ── M-8: DATABASE_PROVIDER NOW SELECTS THE IMPLEMENTATION ────────────────
// Until M-8 this file hardcoded `new PrismaXRepository(prisma)` for every
// export and never touched factory.js — which meant the factory, the one
// place designed to read DATABASE_PROVIDER, was unreachable dead code and
// flipping the flag did nothing at all. Every construction now goes through
// the factory, so the provider is a real one-line configuration switch.
//
// Two consequences worth knowing:
//   1. The factory carried a latent defect: `dualBacked()` never forwarded a
//      `runtime` argument, so createUserRepository() would have built a
//      PrismaUserRepository WITHOUT the Prisma.JsonNull sentinel and
//      findUsersWithLocation() would have thrown at call time. Routing the
//      root through the factory is what forced that fix (see factory.js).
//   2. `prismaClient` is passed unconditionally but is IGNORED when the
//      provider resolves to "mongo" — importing this module therefore still
//      does not connect to Postgres on a Mongo run.
//
// DEFAULT REMAINS POSTGRES. `resolveDatabaseProvider()` falls back to
// "prisma" when DATABASE_PROVIDER is unset, so existing deployments and the
// entire test suite are unaffected.
export const DATABASE_PROVIDER = resolveDatabaseProvider();

// Shared construction options. `runtime` carries Prisma-specific singletons
// that `shared/` deliberately cannot import for itself.
// ── Prisma is loaded LAZILY, and only on the prisma path ─────────────────
// Both of these used to be plain top-level imports, which made a GENERATED
// `@prisma/client` a hard startup dependency of a Mongo-only deployment —
// the process died on import before it could reach any Mongo code. The
// dynamic imports below are evaluated at module load (top-level await), so
// every export stays a plain value and no consumer changes.
//
// `Prisma.JsonNull` is the reason the second one exists at all: it is a
// singleton sentinel reachable only from the package, not from a client
// instance, and PrismaUserRepository.findUsersWithLocation() needs it. The
// Mongo implementation of that method expresses the same predicate directly
// (`location: { $ne: null }`) and needs no sentinel — so on the mongo path
// there is nothing to inject and nothing to import.
export const prisma =
  DATABASE_PROVIDER === "mongo" ? null : (await import("./prisma.js")).default;

const opts = { prismaClient: prisma };
const userOpts =
  DATABASE_PROVIDER === "mongo"
    ? opts
    : {
        prismaClient: prisma,
        runtime: { jsonNull: (await import("@prisma/client")).Prisma.JsonNull },
      };

// Milestone 1 — likeHelpers
export const likeRepository = createLikeRepository(opts);
export const socialPostRepository = createSocialPostRepository(opts);
export const commentRepository = createCommentRepository(opts);

// Milestone 2 — savedHelpers
export const savedRepository = createSavedRepository(opts);
export const followRepository = createFollowRepository(opts);

// Milestone 9 — userHelpers. The JsonNull sentinel is injected here: the
// composition root is the only layer allowed to know about Prisma, and the
// sentinel is reachable only from @prisma/client, not from a client instance.
export const userRepository = createUserRepository(userOpts);

// Milestone 4 — storyHelpers
export const storyRepository = createStoryRepository(opts);
export const storyViewRepository = createStoryViewRepository(opts);

// Milestone 5 — highlightHelpers
export const highlightRepository = createHighlightRepository(opts);

// Milestone 6 — settingsHelpers
export const sessionRepository = createSessionRepository(opts);

// Milestone 7 — postHelpers
export const postViewRepository = createPostViewRepository(opts);

// Milestone 8 — messageHelpers
export const conversationRepository = createConversationRepository(opts);
export const conversationParticipantRepository = createConversationParticipantRepository(opts);
export const messageRepository = createMessageRepository(opts);
export const messageReceiptRepository = createMessageReceiptRepository(opts);

// Milestone 9 — userHelpers (block domain)
export const blockRepository = createBlockRepository(opts);

// Milestone 10 — commentHelpers + reportHelpers
export const reportRepository = createReportRepository(opts);

// Milestone 11 — explore / consent / notification / otp helpers
export const otpRepository = createOtpRepository(opts);
export const consentRepository = createConsentRepository(opts);
export const notificationRepository = createNotificationRepository(opts);

// Milestone 12 — admin batch 1
//
// This was constructed directly, outside the factory, because its Mongo
// implementation threw on every write pending an ownership decision. Tracing
// the write path settled that decision (see the Mongo class): chat-server
// emits the socket event and POSTs back here, so server/ is the only process
// that writes admin rows. It goes through the factory like everything else.
export const adminNotificationRepository = createAdminNotificationRepository(opts);
export const auditLogRepository = createAuditLogRepository(opts);

// Milestone 16 — adminUserHelpers, the FINAL helper migration of Phase 7A.
export const suspensionHistoryRepository = createSuspensionHistoryRepository(opts);
