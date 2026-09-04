// Erovians — shared MongoDB data layer
//
// The single import surface for server/ and chat-server/. One canonical
// schema definition per collection, imported from here by both — this is
// the fix for the Phase 1 audit's Critical finding (two hand-maintained
// Prisma schema copies of the same database, already drifted).
//
//   import { models, connectMongo, disconnectMongo } from "../../../shared/database/mongodb/index.js";
//   const post = await models.SocialPost.findById(id);
//
// No repository or business logic lives here (Milestone 2 scope) — just
// schemas, models, indexes, and structural validation. See README.md for
// conventions and how to add a new model.

export { connectMongo, disconnectMongo, mongoose } from "./connection/index.js";
export * as models from "./models/index.js";
export * as constants from "./constants/index.js";
export * as subdocuments from "./schemas/subdocuments/index.js";
export * as validators from "./validators/index.js";
export * as plugins from "./plugins/index.js";
