// Erovians — shared repository layer (Milestone 3)
//
// The persistence abstraction between the application and the database.
// server/ and chat-server/ will import from here in a later milestone;
// nothing in server/ or chat-server/ does yet — see the Milestone 3 rules.

export { createRepositoryProvider } from "./provider.js";
export * as factory from "./factory.js";
export * as errors from "./errors/index.js";
export * as queryHelpers from "./queryHelpers/index.js";
export * as transactions from "./transactions/index.js";
export { BaseRepository } from "./base/BaseRepository.js";
export { NotSupportedByPrismaRepository } from "./base/NotSupportedByPrismaRepository.js";

export * as auth from "./auth/index.js";
export * as users from "./users/index.js";
export * as profiles from "./profiles/index.js";
export * as companies from "./companies/index.js";
export * as roles from "./roles/index.js";
export * as verification from "./verification/index.js";
export * as locations from "./locations/index.js";
export * as social from "./social/index.js";
export * as messaging from "./messaging/index.js";
export * as marketplace from "./marketplace/index.js";
export * as notifications from "./notifications/index.js";
export * as audit from "./audit/index.js";
export * as compliance from "./compliance/index.js";
export * as moderation from "./moderation/index.js";
