/**
 * utils/postCache.js
 *
 * Redis-backed Post utilities:
 *
 *  1. Feed Cache — getFeedPosts result 30s cache
 *  2. View Dedup — duplicate PostView writes rokna
 */

import redis from "../config/redis.js";
import logger from "../config/logger.js";

// ─────────────────────────────────────────────
//  1. Feed Cache
// ─────────────────────────────────────────────

const POST_FEED_PREFIX  = "pf:";   // post feed
const POST_FEED_TTL_SEC = 30;      // 30 seconds

export async function getPostFeedCache(userId) {
  const key = `${POST_FEED_PREFIX}${userId}`;
  try {
    const cached = await redis.get(key);
    if (cached) {
      logger.debug("[PostCache] Feed cache HIT", { userId });
      return typeof cached === "string" ? JSON.parse(cached) : cached;
    }
    return null;
  } catch (err) {
    logger.warn("[PostCache] Redis error in getPostFeedCache", { error: err.message });
    return null;
  }
}

export async function setPostFeedCache(userId, data) {
  const key = `${POST_FEED_PREFIX}${userId}`;
  try {
    await redis.set(key, JSON.stringify(data), { ex: POST_FEED_TTL_SEC });
    logger.debug("[PostCache] Feed cache SET", { userId });
  } catch (err) {
    logger.warn("[PostCache] Redis error in setPostFeedCache", { error: err.message });
  }
}

export async function invalidatePostFeedCache(userId) {
  const key = `${POST_FEED_PREFIX}${userId}`;
  try {
    await redis.del(key);
    logger.debug("[PostCache] Feed cache INVALIDATED", { userId });
  } catch (err) {
    logger.warn("[PostCache] Redis error in invalidatePostFeedCache", { error: err.message });
  }
}

// ─────────────────────────────────────────────
//  2. View Dedup
// ─────────────────────────────────────────────

const POST_VIEW_PREFIX  = "pv:";          // post view
const POST_VIEW_TTL_SEC = 24 * 60 * 60;  // 24 hours

/**
 * Returns true = already viewed (skip DB write)
 * Returns false = first view (record in DB)
 */
export async function isPostAlreadyViewed(postId, userId) {
  const key = `${POST_VIEW_PREFIX}${postId}:${userId}`;
  try {
    const result = await redis.set(key, "1", {
      ex: POST_VIEW_TTL_SEC,
      nx: true,
    });
    return result === null; // null = already existed = already viewed
  } catch (err) {
    logger.warn("[PostCache] Redis error in isPostAlreadyViewed — allowing view", {
      error: err.message,
    });
    return false; // fail open
  }
}