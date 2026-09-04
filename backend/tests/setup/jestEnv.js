// Jest `setupFiles` entry — runs in each test file's context, before any
// test module (including Prisma Client) is imported. Reads what
// globalSetup.js wrote and applies it to this context's process.env,
// since globalSetup's own process.env side effects aren't guaranteed to
// reach here (see globalSetup.js's comment).
import { readFileSync, existsSync } from "node:fs";
import { TEST_ENV_FILE } from "./testDbConfig.js";

if (existsSync(TEST_ENV_FILE)) {
  const testEnv = JSON.parse(readFileSync(TEST_ENV_FILE, "utf-8"));
  Object.assign(process.env, testEnv);
}

// Test-safe defaults for external-service config that some modules validate
// at IMPORT time (throwing if unset) — e.g. src/config/cloudinaryConfig.js
// checks CLOUDINARY_* on load. Integration tests exercise DB behavior only
// and never make real Cloudinary/Firebase/etc. network calls, so dummy
// values just let those modules import. Only set when absent, so a real
// .env (if ever present) is never clobbered.
// The JWT secrets are needed because some userHelpers functions SIGN tokens
// (generateRefreshToken/generateAccessToken) as part of a DB-touching flow.
// These are throwaway test-only values — token generation logic itself is
// unchanged and untouched; this just gives jwt.sign a key to work with so
// the surrounding persistence can be characterized offline.
const IMPORT_TIME_DEFAULTS = {
  CLOUDINARY_CLIENT_NAME: "test-cloud",
  CLOUDINARY_CLIENT_API: "test-key",
  CLOUDINARY_CLIENT_SECRET: "test-secret",
  USER_ACCESS_TOKEN_SECRET: "test-user-access-secret",
  USER_REFRESH_TOKEN_SECRET: "test-user-refresh-secret",
  ADMIN_ACCESS_TOKEN_SECRET: "test-admin-access-secret",
  ADMIN_REFRESH_TOKEN_SECRET: "test-admin-refresh-secret",
};
for (const [key, value] of Object.entries(IMPORT_TIME_DEFAULTS)) {
  if (!process.env[key]) process.env[key] = value;
}
