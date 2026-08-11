// Phase 7C / M-9 — the Mongo integration run.
//
// Separate from jest.config.js on purpose: that config's globalSetup boots
// embedded-postgres and applies Prisma migrations, which this run does not
// need. The Mongo server is started per-suite by tests/mongo/harness.js
// (MongoMemoryReplSet), so there is no globalSetup here — each suite owns
// its own lifecycle and can be run in isolation.
//
//     npm run test:mongo
//
// CI: the mongod binary is downloaded once and cached under
// node_modules/.cache/mongodb-binaries. No local Mongo install, no ports,
// no credentials, no developer state.
export default {
  testEnvironment: "node",
  // Same env bootstrap the Postgres run uses — JWT secrets, encryption keys
  // and friends are needed by any suite that exercises helpers.
  setupFiles: ["<rootDir>/tests/setup/jestEnv.js"],
  testMatch: ["**/tests/mongo/**/*.test.js"],
  // The first run downloads a mongod binary; replica-set election adds a
  // few more seconds on top of that.
  testTimeout: 120000,
};
