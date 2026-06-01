// // // src/config/redis.js
// // import Redis from "ioredis";
// // import logger from "../utils/logger.js";

// // const redisConfig = {
// //   host: process.env.UPSTASH_REDIS_URL,
// //   password: process.env.UPSTASH_REDIS_TOKEN,
// //   tls: {},
// //   maxRetriesPerRequest: 3,
// //   retryStrategy(times) {
// //     if (times > 10) {
// //       logger.error("❌ Redis max retries reached");
// //       return null;
// //     }
// //     const delay = Math.min(times * 200, 2000);
// //     logger.warn(`⚠️ Redis retry attempt ${times} — reconnecting in ${delay}ms`);
// //     return delay;
// //   },
// //   reconnectOnError(err) {
// //     logger.error("❌ Redis connection error", { message: err.message });
// //     return true;
// //   },
// // };

// // // Pub/Sub ke liye 2 alag instances chahiye
// // export const pubClient = new Redis(redisConfig);
// // export const subClient = pubClient.duplicate();

// // // Connection events
// // pubClient.on("connect",    () => logger.info("✅ Redis connected"));
// // pubClient.on("error",  (err) => logger.error("❌ Redis error", { message: err.message }));
// // pubClient.on("close",      () => logger.warn("⚠️ Redis connection closed"));

// // export default pubClient;

// import Redis from "ioredis";
// import logger from "../utils/logger.js";

// // ✅ Hardcode fallback — env na mile toh bhi crash na ho
// const getRedisURL = () => {
//   const url = process.env.UPSTASH_REDIS_URL;
//   if (!url) {
//     logger.error("❌ UPSTASH_REDIS_URL is not defined in environment");
//     throw new Error("UPSTASH_REDIS_URL missing");
//   }
//   return url;
// };

// const createRedisClient = (label) => {
//   const client = new Redis(getRedisURL(), {
//     tls: { rejectUnauthorized: false },
//     maxRetriesPerRequest: null,
//     enableReadyCheck: false,
//     lazyConnect: true, // ✅ KEY FIX — env load hone tak wait karo
//     retryStrategy(times) {
//       if (times > 10) {
//         logger.error(`❌ [${label}] Max retries reached — giving up`);
//         return null;
//       }
//       const delay = Math.min(times * 200, 3000);
//       logger.warn(`⚠️ [${label}] Retry #${times} in ${delay}ms`);
//       return delay;
//     },
//     reconnectOnError(err) {
//       const targetErrors = ["READONLY", "LOADING"];
//       if (targetErrors.some((e) => err.message.includes(e))) return 2;
//       return false;
//     },
//   });

//   client.on("connect",      () => logger.info(`✅ [${label}] Connected`));
//   client.on("ready",        () => logger.info(`✅ [${label}] Ready`));
//   client.on("error",    (err) => logger.error(`❌ [${label}] Error: ${err.message}`));
//   client.on("close",        () => logger.warn(`⚠️ [${label}] Connection closed`));
//   client.on("reconnecting", () => logger.warn(`⚠️ [${label}] Reconnecting...`));

//   return client;
// };

// export const pubClient = createRedisClient("Redis:pub");
// export const subClient = createRedisClient("Redis:sub");

// // ✅ Explicit connect function — index.js se call karenge
// export const connectRedis = async () => {
//   await Promise.all([
//     pubClient.connect(),
//     subClient.connect(),
//   ]);
// };

// export default pubClient;


// src/config/redis.js
import Redis from "ioredis";
import logger from "../utils/logger.js";

let pubClient = null;
let subClient = null;

const createRedisClient = (label, url) => {
  const client = new Redis(url, {
    tls: { rejectUnauthorized: false },
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 10) {
        logger.error(`❌ [${label}] Max retries reached — giving up`);
        return null;
      }
      const delay = Math.min(times * 200, 3000);
      logger.warn(`⚠️ [${label}] Retry #${times} in ${delay}ms`);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ["READONLY", "LOADING"];
      if (targetErrors.some((e) => err.message.includes(e))) return 2;
      return false;
    },
  });

  client.on("connect",      () => logger.info(`✅ [${label}] Connected`));
  client.on("ready",        () => logger.info(`✅ [${label}] Ready`));
  client.on("error",    (err) => logger.error(`❌ [${label}] Error: ${err.message}`));
  client.on("close",        () => logger.warn(`⚠️ [${label}] Connection closed`));
  client.on("reconnecting", () => logger.warn(`⚠️ [${label}] Reconnecting...`));

  return client;
};

// ✅ Yeh function index.js se call hoga — tab env loaded hogi
export const connectRedis = async () => {
  const url = process.env.UPSTASH_REDIS_URL;

  if (!url) {
    logger.error("❌ UPSTASH_REDIS_URL missing — check your .env file");
    throw new Error("UPSTASH_REDIS_URL missing");
  }

  // ✅ Clients tab banao jab URL available ho
  pubClient = createRedisClient("Redis:pub", url);
  subClient = createRedisClient("Redis:sub", url);

  await Promise.all([
    pubClient.connect(),
    subClient.connect(),
  ]);

  return { pubClient, subClient };
};

// ✅ Getter functions — null check ke saath
export const getPubClient = () => {
  if (!pubClient) throw new Error("Redis not initialized — call connectRedis() first");
  return pubClient;
};

export const getSubClient = () => {
  if (!subClient) throw new Error("Redis not initialized — call connectRedis() first");
  return subClient;
};

export const disconnectRedis = async () => {
  if (pubClient) await pubClient.quit();
  if (subClient) await subClient.quit();
  logger.info("✅ Redis disconnected");
};

export default getPubClient;