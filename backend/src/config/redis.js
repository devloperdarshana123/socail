

import { Redis } from "@upstash/redis";
import logger from "./logger.js";

// ─────────────────────────────────────────────
//  Validate env at startup — fail fast
// ─────────────────────────────────────────────

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error(
    "[Redis] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in .env"
  );
}

// ─────────────────────────────────────────────
//  Singleton client
// ─────────────────────────────────────────────

const redis = new Redis({
  url  : process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,

  // Automatic retry on transient network errors (3 attempts, exponential backoff)
  retry: {
    retries : 3,
    backoff  : (retryCount) => Math.min(Math.exp(retryCount) * 50, 1000),
  },
});

// ─────────────────────────────────────────────
//  Health check — called once on server start
// ─────────────────────────────────────────────

export async function connectRedis() {
  try {
    await redis.ping();
    logger.info("[Redis] Connected to Upstash successfully");
  } catch (err) {
    // Non-fatal — app works without Redis (graceful degradation)
    logger.error("[Redis] Connection failed — app will run without Redis cache", {
      error: err.message,
    });
  }
}

export default redis;