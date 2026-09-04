// Moved out of package.json's inline "jest" key since real integration-test
// infrastructure needs more than one line: a global setup/teardown pair
// that spins up a real, disposable Postgres for the run (see
// tests/setup/globalSetup.js) — this is what unblocks safely verifying the
// Milestone 5 controller refactor with zero live-database access assumed.
//
// ── M-9: the Mongo suites are a SEPARATE run ─────────────────────────────
// tests/mongo/** is excluded from this default config and driven by
// jest.mongo.config.js instead. They need different globalSetup — this one
// boots embedded-postgres and applies Prisma migrations, which a Mongo run
// has no use for — and keeping them apart means a slow or failing mongod
// download can never block the Postgres suite that guards production today.
//
//     npm test         → Postgres suites + unit suites (this config)
//     npm run test:mongo → Mongo harness suites (jest.mongo.config.js)
export default {
  testEnvironment: "node",
  globalSetup: "<rootDir>/tests/setup/globalSetup.js",
  globalTeardown: "<rootDir>/tests/setup/globalTeardown.js",
  setupFiles: ["<rootDir>/tests/setup/jestEnv.js"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/tests/setup/",
    "/\\.pgdata/",
    "/tests/mongo/", // M-9 — run via jest.mongo.config.js
  ],
  // Starting a real Postgres + running migrations takes longer than
  // Jest's 5s default, especially on first run.
  testTimeout: 30000,
};
