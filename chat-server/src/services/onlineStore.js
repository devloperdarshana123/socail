

// src/services/onlineStore.js
import { getPubClient } from "../config/redis.js";
import logger from "../utils/logger.js";

const ONLINE_KEY    = "online:users";
const SOCKET_PREFIX = "socket:user:";
const TTL_SECONDS   = 60 * 60 * 24; // 24 hours

export const addSocket = async (userId, socketId) => {
  try {
    const redis = getPubClient(); // ✅ Har call pe fresh instance
    const key = `${SOCKET_PREFIX}${userId}`;
    await Promise.all([
      redis.sadd(key, socketId),
      redis.expire(key, TTL_SECONDS),
      redis.sadd(ONLINE_KEY, userId),
    ]);
  } catch (err) {
    logger.error("❌ onlineStore.addSocket error", { message: err.message });
  }
};

export const removeSocket = async (userId, socketId) => {
  try {
    const redis = getPubClient();
    const key = `${SOCKET_PREFIX}${userId}`;
    await redis.srem(key, socketId);
    const remaining = await redis.scard(key);
    if (remaining === 0) {
      await Promise.all([
        redis.del(key),
        redis.srem(ONLINE_KEY, userId),
      ]);
      return true;
    }
    return false;
  } catch (err) {
    logger.error("❌ onlineStore.removeSocket error", { message: err.message });
    return false;
  }
};

export const getSockets = async (userId) => {
  try {
    const redis = getPubClient();
    const members = await redis.smembers(`${SOCKET_PREFIX}${userId}`);
    return new Set(members);
  } catch (err) {
    logger.error("❌ onlineStore.getSockets error", { message: err.message });
    return new Set();
  }
};

export const isOnline = async (userId) => {
  try {
    const redis = getPubClient();
    return (await redis.sismember(ONLINE_KEY, userId)) === 1;
  } catch (err) {
    logger.error("❌ onlineStore.isOnline error", { message: err.message });
    return false;
  }
};

export const getAllOnline = async () => {
  try {
    const redis = getPubClient();
    return await redis.smembers(ONLINE_KEY);
  } catch (err) {
    logger.error("❌ onlineStore.getAllOnline error", { message: err.message });
    return [];
  }
};