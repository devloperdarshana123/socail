// Phase 7C / M-9 — MongoDB integration harness.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────
// Milestones M-5, M-6 and M-10 will implement ~130 Mongo repository methods
// against a backend that has never executed a single query in this project.
// The Phase 7B/M-3 experience is the argument for building this first: 51
// write sites were wired, declared done, and the suite then found 65
// failures — twice. That only worked because a real Postgres harness exists.
// Writing the Mongo implementations without an equivalent would repeat that
// failure mode at ten times the scale, with nothing to catch it.
//
// ── DESIGN ───────────────────────────────────────────────────────────────
// Mirrors the Postgres harness (tests/setup/globalSetup.js): a disposable
// server is started for the run, torn down afterwards, and nothing depends
// on a developer having Mongo installed.
//
//   • mongodb-memory-server downloads and runs a real mongod binary — the
//     same engine as production, not a mock or an in-JS reimplementation.
//   • It is started as a SINGLE-NODE REPLICA SET, which is mandatory:
//     MongoDB refuses multi-document transactions on a standalone server,
//     and MongoTransaction.run() needs `session.withTransaction()`. Without
//     the replica set every transaction test would fail for infrastructure
//     reasons rather than real ones. This mirrors the choice made for the
//     local docker setup in infrastructure/mongodb/compose.yaml.
//   • CI-compatible: the binary is cached under node_modules/.cache and the
//     download is a one-off. No ports, credentials or local state assumed.
//
// ── WHAT THIS FILE DOES NOT DO ───────────────────────────────────────────
// It does NOT implement or exercise any Mongo repository method. M-9's scope
// is the environment only; M-5/M-6/M-10 will consume it.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { mongoose, models } from "../../../shared/database/mongodb/index.js";

let replSet = null;

/**
 * Start a disposable single-node replica set and connect mongoose to it.
 * Returns the connection URI so callers can log or reuse it.
 */
export async function startMongo() {
  if (replSet) return replSet.getUri();

  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });

  const uri = replSet.getUri();
  // The shared connectMongo() reads MONGO_URI/MONGO_DB_NAME from the
  // environment and is deliberately non-fatal; for tests we want a hard
  // failure if the connection does not come up, so connect directly.
  await mongoose.connect(uri, { dbName: "erovians_test" });
  return uri;
}

/** Disconnect mongoose and stop the replica set. Safe to call twice. */
export async function stopMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
}

/** True when a connection is live — lets suites skip rather than hang. */
export const isMongoReady = () => mongoose.connection.readyState === 1;

// ── Test isolation ───────────────────────────────────────────────────────
// The Postgres suites use delta-scoped assertions because rows are shared
// across a single long-lived database. Mongo gets something stricter and
// simpler: every collection is emptied between tests, so each test starts
// from a known-empty state. Dropping collections would also drop the indexes
// declared in shared/database/mongodb/indexes, so we delete documents
// instead — index behaviour is part of what M-5 will need to test.

/** Remove every document from every registered model. Keeps indexes. */
export async function clearMongo() {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((c) => c.deleteMany({}))
  );
}

/** Ensure declared indexes exist — required for unique-constraint tests. */
export async function syncIndexes() {
  await Promise.all(
    Object.values(models)
      .filter((m) => typeof m?.syncIndexes === "function")
      .map((m) => m.syncIndexes())
  );
}

// ── Seed helpers ─────────────────────────────────────────────────────────
// Deliberately thin. They create the minimum valid document for a model and
// let the caller override any field — the same shape as the makeUser/makePost
// factories the Postgres suites use, so a reader moving between the two sees
// one convention.

let seq = 0;
const uniq = () => `${Date.now()}_${(seq += 1)}`;

export const seed = {
  /**
   * A valid User document.
   *
   * The Mongo schema enforces invariants the Postgres schema does not — a
   * pre-validate hook requires at least one identifier AND a passwordHash
   * whenever authProvider is "email" (the default). Discovering that is
   * precisely what M-9 is for: the seed helper satisfies the real contract
   * rather than a guessed one, so M-5's suites start from valid fixtures.
   */
  async user(overrides = {}) {
    const s = uniq();
    return models.User.create({
      username: `mg_${s}`,
      email: `mg-${s}@e.com`,
      passwordHash: "seeded-not-a-real-hash",
      fullName: `Seed ${s}`,
      ...overrides,
    });
  },

  async post(authorId, overrides = {}) {
    return models.SocialPost.create({
      authorId,
      type: "image",
      caption: `seed ${uniq()}`,
      ...overrides,
    });
  },

  /** Insert many documents of one model in a single round-trip. */
  async many(modelName, docs) {
    return models[modelName].insertMany(docs);
  },
};

// ── Cleanup helpers ──────────────────────────────────────────────────────

/** Drop a single collection's documents by model name. */
export async function clearModel(modelName) {
  const m = models[modelName];
  if (m) await m.deleteMany({});
}

/**
 * Run a callback inside a real Mongo transaction and ALWAYS abort it, so a
 * test can observe transactional behaviour without persisting anything.
 * Returns whatever the callback returned.
 */
export async function inRolledBackTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await fn(session);
    await session.abortTransaction();
    return result;
  } finally {
    await session.endSession();
  }
}
