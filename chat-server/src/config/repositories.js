// chat-server composition root (Phase 7E / M-7).
//
// The mirror of server/src/config/repositories.js: the ONLY layer in this
// service allowed to know which backend is in play. Handlers and services
// import the repository instances below, never a database client.
//
// ── WHY chat-server GETS ITS OWN ROOT ────────────────────────────────────
// It is a separate process with its own lifecycle and its own subset of the
// domain (conversations, messages, receipts, notifications, users, blocks).
// Sharing server/'s root would drag in Prisma, 23 repositories and the
// Postgres client for a service that needs six.
//
// DATABASE_PROVIDER selects the implementation exactly as it does on the
// server, and defaults to "prisma" so this change is a no-op for existing
// deployments.
//
// The Prisma client is loaded LAZILY, and only on the prisma path. It used
// to be a plain top-level import, with a comment claiming that importing
// this module on a Mongo run does not touch Postgres. That was half true: it
// opened no connection, but `@prisma/client` still had to be present and
// GENERATED, so a Mongo-only deployment of this service could not start
// without running `prisma generate` first. Verification hit exactly that —
// the ungenerated stub client threw on import. The dynamic import below is
// evaluated at module load (top-level await) so every export below stays a
// plain value and no consumer changes.
import {
  createUserRepository,
  createBlockRepository,
  createNotificationRepository,
  createConversationRepository,
  createConversationParticipantRepository,
  createMessageRepository,
  createMessageReceiptRepository,
  resolveDatabaseProvider,
} from "../../../shared/database/repositories/factory.js";

export const DATABASE_PROVIDER = resolveDatabaseProvider();

export const prisma =
  DATABASE_PROVIDER === "mongo" ? null : (await import("./prisma.js")).default;

const opts = { prismaClient: prisma };

export const userRepository = createUserRepository(opts);
export const blockRepository = createBlockRepository(opts);
export const notificationRepository = createNotificationRepository(opts);
export const conversationRepository = createConversationRepository(opts);
export const conversationParticipantRepository = createConversationParticipantRepository(opts);
export const messageRepository = createMessageRepository(opts);
export const messageReceiptRepository = createMessageReceiptRepository(opts);
