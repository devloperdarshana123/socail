import mongoose from "mongoose";

// ─────────────────────────────────────────────
//  Shared MongoDB connection module — used by both backend/ and
//  chat-server/. Superseded backend/src/config/mongodb.js from Milestone 1
//  (Milestone 1's module is now a thin re-export of this one — see that
//  file's comment). No app-specific logger dependency: pass one in via
//  `logger` if you want richer output (winston, pino, …); defaults to
//  console so this module has zero peer dependencies of its own.
//
//  Still non-fatal by design: neither backend/ nor chat-server/ should
//  crash or fail to start because Mongo is unset or unreachable — Postgres
//  remains each service's primary datastore until a later milestone.
// ─────────────────────────────────────────────

const REQUIRED_ENV_VARS = ["MONGO_URI", "MONGO_DB_NAME"];
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_RETRY_DELAY_MS = 3000;

let isConnecting = false;

function getMissingEnvVars() {
  return REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
}

// "throw", not `true`. Both refuse to send a query path the schema does not
// declare; the difference is what happens next. `true` STRIPS the offending
// path and runs the rest of the query, so a filtered `deleteMany` whose only
// predicate is unrecognised becomes an unfiltered one and empties the
// collection — silently, with a success result. That is not hypothetical:
// `{ id: { $in: [...] } }` did exactly that here before the translator
// learned to emit `_id`.
//
// Postgres has no equivalent failure mode; Prisma rejects an unknown column
// outright. "throw" restores that symmetry, and matches the neutral filter
// DSL's own rule that anything un-translatable fails at the boundary rather
// than becoming a different query.
mongoose.set("strictQuery", "throw");

export async function connectMongo(options = {}) {
  const {
    logger = console,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    attempt = 1,
  } = options;

  const missing = getMissingEnvVars();
  if (missing.length > 0) {
    logger.warn(
      `[MongoDB] Skipping connection — missing environment variable(s): ${missing.join(", ")}`
    );
    return null;
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection; // already connected — singleton, reuse it
  }

  if (isConnecting) {
    return null; // a connection attempt is already in flight
  }
  isConnecting = true;

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DB_NAME,
      serverSelectionTimeoutMS: 5000, // fail fast per attempt so retries actually retry
    });
    isConnecting = false;
    logger.info?.("[MongoDB] Connected successfully", { dbName: process.env.MONGO_DB_NAME }) ??
      logger.log("[MongoDB] Connected successfully");
    return mongoose.connection;
  } catch (err) {
    isConnecting = false;
    logger.error(`[MongoDB] Connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      return connectMongo({ logger, maxRetries, retryDelayMs, attempt: attempt + 1 });
    }

    logger.error(
      `[MongoDB] All ${maxRetries} connection attempts failed — continuing without MongoDB`
    );
    return null;
  }
}

export async function disconnectMongo(options = {}) {
  const { logger = console } = options;
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close();
  logger.info?.("[MongoDB] Disconnected") ?? logger.log("[MongoDB] Disconnected");
}

mongoose.connection.on("disconnected", () => console.warn("[MongoDB] Connection lost"));
mongoose.connection.on("reconnected", () => console.info("[MongoDB] Reconnected"));
mongoose.connection.on("error", (err) => console.error(`[MongoDB] Connection error: ${err.message}`));

export { mongoose };
