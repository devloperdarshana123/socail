// Jest globalSetup — runs once before the whole test suite (this project
// runs Jest with --runInBand, so process.env set here is inherited by the
// actual test run, not lost to a separate worker process).
//
// Starts a real, disposable PostgreSQL instance (via `embedded-postgres` —
// no Docker needed, verified to work in this environment) and runs the
// existing Prisma migrations against it, so integration tests exercise
// the exact same schema production does. This exists specifically to
// unblock the Milestone 5 controller refactor: "zero behavioral change"
// can only be meaningfully verified against a real database, and this
// sandbox previously had neither Docker nor a live Postgres.
import { execFileSync } from "node:child_process";
import { rmSync, existsSync, writeFileSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";
import {
  TEST_DB_PORT,
  TEST_DB_USER,
  TEST_DB_PASSWORD,
  TEST_DB_NAME,
  TEST_DB_DIR,
  TEST_DATABASE_URL,
  TEST_ENV_FILE,
} from "./testDbConfig.js";

export default async function globalSetup() {
  if (existsSync(TEST_DB_DIR)) {
    rmSync(TEST_DB_DIR, { recursive: true, force: true });
  }

  const pg = new EmbeddedPostgres({
    databaseDir: TEST_DB_DIR,
    user: TEST_DB_USER,
    password: TEST_DB_PASSWORD,
    port: TEST_DB_PORT,
    persistent: true, // we manage cleanup ourselves, in globalTeardown
    // Without this, initdb derives encoding from the host OS locale (e.g.
    // WIN1252 on an "English_India" Windows install), which cannot store
    // the literal emoji default value in the real schema
    // (Like.reaction @default("❤️")) and migration would fail with a
    // "character ... has no equivalent in encoding" error. Real production
    // Postgres deployments are UTF8 by default; this just makes the local
    // test cluster match that.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(TEST_DB_NAME);

  process.env.DATABASE_URL = TEST_DATABASE_URL;

  // Jest's own docs warn that globalSetup's process.env side effects are
  // not guaranteed visible inside the actual test suite (it may run in a
  // different process/context) — so this is also written to a file that
  // ./jestEnv.js (wired via Jest's `setupFiles`) reads synchronously
  // before any test module — including Prisma Client — is imported.
  writeFileSync(TEST_ENV_FILE, JSON.stringify({ DATABASE_URL: TEST_DATABASE_URL }));

  // Apply the real migration history — the same one `npm start` runs in
  // production (`prisma migrate deploy`), not `db push`, so this proves
  // the actual migrations are valid, not just the current schema shape.
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
    shell: true,
  });

  // Stash the instance so globalTeardown can stop the same one — Jest
  // does not share module state between globalSetup and globalTeardown,
  // so this goes on `globalThis` for this process to pick back up.
  globalThis.__EROVIANS_TEST_PG__ = pg;
}
