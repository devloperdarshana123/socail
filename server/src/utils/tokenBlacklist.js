
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