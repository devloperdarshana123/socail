import { DATABASE_PROVIDER, prisma } from "./repositories.js";
import { connectMongo, disconnectMongo } from "./mongodb.js";
import { mongoose } from "../../../shared/database/mongodb/index.js";

// Database lifecycle for the active provider.
//
// The mirror of chat-server/src/config/database.js — same three functions,
// same reasoning, so the two services start, stop and report health the same
// way. This is not a new abstraction; it is the one chat-server already has,
// applied to the service that was still missing it.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────
// server.js and the /health route reached for the Prisma client directly.
// That made `@prisma/client` a hard startup dependency of a Mongo-only
// deployment: the client had to be present AND generated, or the process
// died on import, even though nothing would ever query Postgres. Routing
// both concerns through here — next to repositories.js, the only layer
// allowed to know which backend is active — removes that.
//
// `prisma` is re-exported by the composition root and is null on the mongo
// path, so the branches below are the only place that needs to care.

const isMongo = () => DATABASE_PROVIDER === "mongo";

/** Open the connection for the active provider. Returns its name, for logs. */
export async function connectDatabase() {
  if (isMongo()) {
    // Fatal on the mongo path, deliberately. connectMongo() is non-fatal by
    // design (Mongo was additive infrastructure for most of this migration),
    // but once it IS the datastore, starting without it would serve errors
    // on every request instead of failing loudly at boot.
    await connectMongo();
    if (mongoose.connection.readyState !== 1) {
      throw new Error(
        "DATABASE_PROVIDER=mongo but MongoDB is not connected — check MONGO_URI and MONGO_DB_NAME"
      );
    }
    return "MongoDB";
  }
  await prisma.$connect();
  // Mongo stays available alongside Postgres on the prisma path; it is
  // additive infrastructure there and its failure must not block startup.
  await connectMongo();
  return "PostgreSQL";
}

/** Close it. Safe to call when nothing was opened. */
export async function disconnectDatabase() {
  if (isMongo()) {
    await disconnectMongo();
    return "MongoDB";
  }
  await prisma.$disconnect();
  await disconnectMongo();
  return "PostgreSQL";
}

/**
 * Liveness probe for the active provider — the cheapest round-trip each one
 * offers. Returns the same "connected"/"disconnected" strings /health already
 * emits, so the endpoint's response shape is unchanged.
 */
export async function pingDatabase() {
  try {
    if (isMongo()) {
      await mongoose.connection.db.admin().command({ ping: 1 });
    } else {
      await prisma.$queryRaw`SELECT 1`;
    }
    return "connected";
  } catch {
    return "disconnected";
  }
}
