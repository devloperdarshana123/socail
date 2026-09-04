/**
 * utils/storyCache.js
 *
 * Redis-backed Story utilities:
 *
 *  1. View Deduplication
 *     Problem: User ek story baar baar kholta hai — har baar MongoDB hit hota tha.
 *     Fix: Redis mein track karo ki user ne yeh story already dekhi hai is session mein.
 *     Key: `sv:{storyId}:{viewerId}` | TTL: 24h (story lifetime)
 *
 *  2. Feed Cache
 *     Problem: getStoriesFeed har request pe MongoDB aggregation run karta tha.
 *     Fix: 30 second TTL cache. 30s stale data acceptable hai feed ke liye.
 *     Key: `feed:{userId}` | TTL: 30s
 *
 * Graceful degradation:
 *   Redis down → cache miss manlo, MongoDB se fetch karo. App works normally.
 */

import redis from "../config/redis.js";
import logger from "../config/logger.js";

// ─────────────────────────────────────────────
//  1. View Deduplication
// ─────────────────────────────────────────────

const VIEW_DEDUP_PREFIX = "sv:";
const VIEW_DEDUP_TTL    = 24 * 60 * 60; // 24 hours

/**
 * Check karo ki user ne yeh story already dekhi hai (Redis mein).
 * Agar nahi dekhi, mark karo as seen.
 *
 * @param {string} storyId
 * @param {string} viewerId
 * @returns {Promise<boolean>} true = already seen (skip DB write)
 */
export async function isAlreadyViewed(storyId, viewerId) {
  const key = `${VIEW_DEDUP_PREFIX}${storyId}:${viewerId}`;

  try {
    // SET NX (only set if not exists) — atomic check + set in one command
    // Returns 1 if set (first view), null if already existed
    const result = await redis.set(key, "1", {
      ex: VIEW_DEDUP_TTL,
      nx: true, // only set if key does NOT exist
    });

    // result === "OK" means first view (key was newly set)
    // result === null means already viewed (key existed)
    return result === null; // true = already viewed
  } catch (err) {
    logger.warn("[StoryCache] Redis error in isAlreadyViewed — allowing view", {
      storyId,
      viewerId,
      error: err.message,
    });
    return false; // fail open — record the view
  }
}

// ─────────────────────────────────────────────
//  2. Feed Cache
// ─────────────────────────────────────────────

const FEED_PREFIX  = "feed:";
const FEED_TTL_SEC = 30; // 30 seconds — fresh enough for stories

/**
 * Feed cache GET
 * @param {string} userId
 * @returns {Promise<Array|null>} cached stories or null (cache miss)
 */
export async function getFeedCache(userId) {
  const key = `${FEED_PREFIX}${userId}`;
  try {
    const cached = await redis.get(key);
    if (cached) {
      logger.debug("[StoryCache] Feed cache HIT", { userId });
      return typeof cached === "string" ? JSON.parse(cached) : cached;
    }
    logger.debug("[StoryCache] Feed cache MISS", { userId });
    return null;
  } catch (err) {
    logger.warn("[StoryCache] Redis error in getFeedCache — fetching from DB", {
      userId,
      error: err.message,
    });
    return null; // cache miss — fall through to DB
  }
}

/**
 * Feed cache SET
 * @param {string} userId
 * @param {Array}  stories
 */
export async function setFeedCache(userId, stories) {
  const key = `${FEED_PREFIX}${userId}`;
  try {
    await redis.set(key, JSON.stringify(stories), { ex: FEED_TTL_SEC });
    logger.debug("[StoryCache] Feed cache SET", { userId, count: stories.length });
  } catch (err) {
    logger.warn("[StoryCache] Redis error in setFeedCache — ignoring", {
      userId,
      error: err.message,
    });
    // Non-fatal — data just won't be cached this time
  }
}

/**
 * Invalidate feed cache — call when user posts/deletes a story
 * @param {string} userId
 */
export async function invalidateFeedCache(userId) {
  const key = `${FEED_PREFIX}${userId}`;
  try {
    await redis.del(key);
    logger.debug("[StoryCache] Feed cache INVALIDATED", { userId });
  } catch (err) {
    logger.warn("[StoryCache] Redis error in invalidateFeedCache — ignoring", {
      userId,
      error: err.message,
    });
  }
}