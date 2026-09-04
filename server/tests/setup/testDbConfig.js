// Shared connection details for the embedded test Postgres instance, used
// by both globalSetup.js (which starts it) and globalTeardown.js (which
// stops it). Kept in one file so the two never drift apart.
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const TEST_DB_PORT = 55432;
export const TEST_DB_USER = "erovians_test";
export const TEST_DB_PASSWORD = "erovians_test";
export const TEST_DB_NAME = "erovians_test";
export const TEST_DB_DIR = path.join(__dirname, "..", ".pgdata");
export const TEST_ENV_FILE = path.join(__dirname, "..", ".test-env.json");

export const TEST_DATABASE_URL = `postgresql://${TEST_DB_USER}:${TEST_DB_PASSWORD}@localhost:${TEST_DB_PORT}/${TEST_DB_NAME}`;
