

import redis from "../config/redis.js";
import logger from "../config/logger.js";
import AppError from "../utils/AppError.js";

// ─────────────────────────────────────────────
//  Core factory — creates a rate limiter middleware
// ─────────────────────────────────────────────

/**
 * @param {object} options
 * @param {string}   options.route       - Unique route name for key (e.g. "login", "storyView")
 * @param {number}   options.limit       - Max requests allowed per window
 * @param {number}   options.windowSecs  - Window size in seconds
 * @param {string}   [options.message]   - Custom error message
 * @param {Function} [options.keyFn]     - Custom key function (req) => string
 *                                         Default: userId if authenticated, else IP
 */

// ✅ ADD KARO — import redis, logger, AppError ke baad
// const getClientIp = (req) => {
//   const forwarded = req.headers["x-forwarded-for"];
//   if (forwarded) return forwarded.split(",")[0].trim();
//   return req.ip || req.socket?.remoteAddress || "unknown";
// };

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    // Pehla IP real user ka hota hai, baad wale Render ke proxies hain
    return forwarded.split(",")[0].trim();
  }
  // req.ip already trust proxy se process hua hai
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  // IPv6 loopback ko IPv4 mein convert karo
  return ip === "::1" ? "127.0.0.1" : ip.replace(/^::ffff:/, "");
};
export function createRateLimiter({
  route,
  limit,
  windowSecs,
  message = "Too many requests. Please try again later.",
  keyFn,
}) {
  return async function rateLimiterMiddleware(req, res, next) {
    try {
      // ── Build identifier ──────────────────────────────────────────
      // const identifier = keyFn
      //   ? keyFn(req)
      //   : req.user?._id?.toString() ?? req.ip;
      const identifier = keyFn
  ? keyFn(req)
  : req.user?.id ?? getClientIp(req);

      const key     = `rl:${route}:${identifier}`;

      // ── Atomic increment ──────────────────────────────────────────
     const [count] = await redis.pipeline()
  .incr(key)
  .expire(key, windowSecs)
  .exec();

      // ── Attach headers (like standard rate-limit middleware) ──────
      const ttl = await redis.ttl(key);
      res.setHeader("X-RateLimit-Limit",     limit);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - count));
      res.setHeader("X-RateLimit-Reset",     Math.floor(Date.now() / 1000) + ttl);

      // ── Reject if over limit ──────────────────────────────────────
      if (count > limit) {
        logger.warn("[RateLimiter] Limit exceeded", {
          route,
          identifier,
          count,
          limit,
        });
        return next(new AppError(message, 429));
      }

      next();
    } catch (err) {
      // Redis down → fail open (allow request)
      logger.warn("[RateLimiter] Redis error — skipping rate limit check", {
        route,
        error: err.message,
      });
      next();
    }
  };
}

// ─────────────────────────────────────────────
//  Pre-built limiters — ready to use in routes
// ─────────────────────────────────────────────

/**
 * Login — 10 attempts per 15 minutes per IP
 * Tight because brute force risk
 */
export const loginLimiter = createRateLimiter({
  route      : "login",
  limit      : 10,
  windowSecs : 15 * 60,
  message    : "Too many login attempts. Please try again after 15 minutes.",
  // keyFn      : (req) => req.ip, // IP-based (user not authenticated yet)
  keyFn: (req) => getClientIp(req),
});

/**
 * OTP resend — 5 attempts per 10 minutes per userId
 */
export const otpResendLimiter = createRateLimiter({
  route      : "otpResend",
  limit      : 5,
  windowSecs : 10 * 60,
  message    : "Too many OTP requests. Please wait before requesting again.",
  // keyFn      : (req) => req.body?.userId ?? req.ip,
  keyFn: (req) => req.body?.userId ?? getClientIp(req),
});

/**
 * Story view — 30 views per minute per user
 * Prevents view count inflation from bots/scripts
 */
export const storyViewLimiter = createRateLimiter({
  route      : "storyView",
  limit      : 30,
  windowSecs : 60,
  message    : "Slow down! Too many story views.",
});

/**
 * Story react — 60 reactions per minute per user
 */
export const storyReactLimiter = createRateLimiter({
  route      : "storyReact",
  limit      : 60,
  windowSecs : 60,
  message    : "Too many reactions. Please slow down.",
});

/**
 * General API — 200 requests per minute per user
 * Safety net for all other routes
 */
export const generalLimiter = createRateLimiter({
  route      : "general",
  limit      : 200,
  windowSecs : 60,
  message    : "Too many requests. Please slow down.",
});

/**
 * Forgot password — 5 per hour per IP
 * Prevent email bombing
 */
export const forgotPasswordLimiter = createRateLimiter({
  route      : "forgotPassword",
  limit      : 5,
  windowSecs : 60 * 60,
  message    : "Too many password reset requests. Please try again after an hour.",
  // keyFn      : (req) => req.ip,
  keyFn: (req) => getClientIp(req),
});

/**
 * Create Post — 10 posts per hour per user
 */
export const createPostLimiter = createRateLimiter({
  route      : "createPost",
  limit      : 10,
  windowSecs : 60 * 60,
  message    : "Too many posts. Please wait before posting again.",
});

/**
 * Like — 100 likes per minute per user
 */
export const likeLimiter = createRateLimiter({
  route      : "like",
  limit      : 100,
  windowSecs : 60,
  message    : "Too many likes. Please slow down.",
});

/**
 * Follow/Unfollow — 50 per minute per user
 */
export const followLimiter = createRateLimiter({
  route      : "follow",
  limit      : 50,
  windowSecs : 60,
  message    : "Too many follow actions. Please slow down.",
});

/**
 * Comment — 30 per minute per user
 */
export const commentLimiter = createRateLimiter({
  route      : "comment",
  limit      : 30,
  windowSecs : 60,
  message    : "Too many comments. Please slow down.",
});


export const uploadRateLimiter = createRateLimiter({
  route      : "upload",
  limit      : 15,
  windowSecs : 15 * 60,
  message    : "Too many upload attempts. Please try again after 15 minutes.",
});


/**
 * Auth routes — 20 attempts per 15 minutes per IP
 */
export const authRouteLimiter = createRateLimiter({
  route      : "authRoute",
  limit      : 20,
  windowSecs : 15 * 60,
  message    : "Too many attempts, please try again later.",
  // keyFn      : (req) => req.ip,
  keyFn: (req) => getClientIp(req),
});

/**
 * Admin auth — 10 attempts per 15 minutes per IP
 */
export const adminAuthRouteLimiter = createRateLimiter({
  route      : "adminAuthRoute",
  limit      : 10,
  windowSecs : 15 * 60,
  message    : "Too many admin login attempts. Please try again later.",
  // keyFn      : (req) => req.ip,
  keyFn: (req) => getClientIp(req),
});

/**
 * Transcribe — 10 requests per minute per user
 */
export const transcribeLimiter = createRateLimiter({
  route      : "transcribe",
  limit      : 10,
  windowSecs : 60,
  message    : "Too many voice requests.",
});

/**
 * Global — 500 requests per 15 minutes per IP
 */
export const globalRouteLimiter = createRateLimiter({
  route      : "global",
  limit      : process.env.NODE_ENV === "production" ? 2000 : 10000,
  windowSecs : 15 * 60,
  message    : "Too many requests, please try again later.",
  // keyFn      : (req) => req.ip,
  keyFn: (req) => getClientIp(req),
});