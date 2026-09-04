// chat-server database lifecycle (Phase 7E / M-7).
//
// index.js and the health route previously reached for the Prisma client
// directly, which meant the service could not start or report health on a
// Mongo run. Both concerns are now provider-aware and live here, next to
// repositories.js — the only layer allowed to know which backend is active.
// `prisma` comes from the composition root, which loads the client lazily and
// leaves it null on the mongo path — importing it directly here would put the
// generated Prisma client back on a Mongo-only deployment's critical path.
import { DATABASE_PROVIDER, prisma } from "./repositories.js";
import { connectMongo, disconnectMongo, mongoose } from "../../../shared/database/mongodb/index.js";

const isMongo = () => DATABASE_PROVIDER === "mongo";

/** Open the connection for the active provider. */
export async function connectDatabase() {
  if (isMongo()) {
    await connectMongo();
    return "MongoDB";
  }
  await prisma.$connect();
  return "PostgreSQL";
}

/** Close it. Safe to call when nothing was opened. */
export async function disconnectDatabase() {
  if (isMongo()) {
    await disconnectMongo();
    return "MongoDB";
  }
  await prisma.$disconnect();
  return "PostgreSQL";
}

/**
 * Cheapest possible liveness probe per backend.
 *
 * Postgres keeps its original `SELECT 1`; Mongo uses the driver's ping
 * command. Returns the same "connected"/"disconnected" strings the health
 * route already emits, so the endpoint's response shape is unchanged.
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
