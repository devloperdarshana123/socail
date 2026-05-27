/**
 * utils/tokenBlacklist.js
 *
 * Access token blacklist using Redis.
 *
 * Problem it solves:
 *   JWTs are stateless — even after logout, the token is valid until expiry.
 *   If a token is stolen post-logout, attacker can still use it.
 *   This blacklist invalidates tokens immediately on logout.
 *
 * Design:
 *   - Key:   `bl:at:{jti}`  (jti = JWT ID — unique per token)
 *   - Value: "1"
 *   - TTL:   remaining token lifetime (auto-cleanup, no memory leak)
 *
 * Why jti and not the full token?
 *   - jti is 21 chars vs ~200+ chars for full token — saves Redis memory
 *   - Security equivalent — jti is cryptographically random
 *
 * Graceful degradation:
 *   If Redis is down, blacklist check is SKIPPED (not blocked).
 *   Log warning so ops team knows. Token rotation + short expiry (15min)
 *   limits the risk window.
 */

import redis from "../config/redis.js";
import logger from "../config/logger.js";
import { nanoid } from "nanoid";

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

const PREFIX     = "bl:at:";        // blacklist prefix
const ACCESS_TTL = 15 * 60;        // 15 minutes in seconds (match JWT expiry)

// ─────────────────────────────────────────────
//  Generate a jti (call this when signing JWT)
// ─────────────────────────────────────────────

export function generateJti() {
  return nanoid(21); // 21 chars = 126 bits of entropy — collision-safe
}

// ─────────────────────────────────────────────
//  Blacklist a token on logout
// ─────────────────────────────────────────────

/**
 * @param {string} jti   - JWT ID from the decoded token
 * @param {number} exp   - JWT exp (Unix timestamp) — used to calc remaining TTL
 */
export async function blacklistToken(jti, exp) {
  if (!jti) return; // nothing to blacklist if jti missing (old tokens)

  try {
    const now        = Math.floor(Date.now() / 1000);
    const remaining  = exp - now;

    if (remaining <= 0) return; // already expired, no need to store

    await redis.set(`${PREFIX}${jti}`, "1", { ex: remaining });

    logger.debug("[TokenBlacklist] Token blacklisted", { jti, ttl: remaining });
  } catch (err) {
    // Non-fatal — log and continue. 15-min window is acceptable risk.
    logger.warn("[TokenBlacklist] Redis error during blacklist — token NOT blacklisted", {
      jti,
      error: err.message,
    });
  }
}

// ─────────────────────────────────────────────
//  Check if token is blacklisted (in auth middleware)
// ─────────────────────────────────────────────

/**
 * @param {string} jti
 * @returns {Promise<boolean>} true = blacklisted (reject request)
 */
export async function isTokenBlacklisted(jti) {
  if (!jti) return false; // no jti = old token format, skip check

  try {
    const result = await redis.get(`${PREFIX}${jti}`);
    return result === "1";
  } catch (err) {
    // Redis down → fail open (allow request) + warn ops
    logger.warn("[TokenBlacklist] Redis error during check — allowing request", {
      jti,
      error: err.message,
    });
    return false; // graceful degradation
  }
}