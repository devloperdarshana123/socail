
// // export const sendToken = async (user, statusCode, res, options, next) => {
// //   // ── Fix #14: guard against missing next before anything else ──
// //   if (typeof next !== "function") {
// //     // Last-resort — can't forward the error properly, throw so Express catches it
// //     throw new TypeError(
// //       "sendToken: `next` must be an Express next() function. Did you forget to pass it?"
// //     );
// //   }

// //   // ── Fix #6: guard against null/non-object options ──
// //   const opts = options && typeof options === "object" ? options : {};

// //   const deviceInfo  = typeof opts.deviceInfo === "string" && opts.deviceInfo.trim()
// //     ? opts.deviceInfo.trim()
// //     : "unknown";
// //   const ipAddress   = opts.ipAddress   || null;
// //   const rememberMe  = opts.rememberMe  === true;           // Fix #16: remember me support
// //   const message     = opts.message     || "Success";
// //   const nextRoute   = sanitizeNextRoute(opts.nextRoute);   // Fix #11: open-redirect guard

// //   const isProduction = process.env.NODE_ENV === "production";

// //   try {
// //     // ── Fix #13: latency tracking ──
// //     const t0 = Date.now();

// //     // ── Fix #2: generate both tokens before touching the response ──
// //     // If either throws, we haven't written any cookies yet — no half-auth state.
// //     const accessToken  = user.generateAccessToken();

// //     // Fix #16: pass rememberMe so the model uses the correct TTL
// //     const refreshToken = await user.generateRefreshToken(deviceInfo, ipAddress, rememberMe);

// //     const elapsed = Date.now() - t0;
// //     logger.info("Token generation timing", { userId: user._id, elapsedMs: elapsed });

// //     // ── Fix #5 + #16: cookie TTL driven by the shared constant, not hardcoded ──
// //     const refreshTTL = rememberMe ? REFRESH_TOKEN_TTL_REMEMBER_MS : REFRESH_TOKEN_TTL_MS;

// //     // ── Fix #8: maxAge (relative, seconds) instead of expires (absolute Date) ──
// //     // ── Fix #9: path: "/" so cookies are sent on every route ──
// //     const accessTokenOptions = {
// //       maxAge  : ACCESS_TOKEN_TTL_MS,        // milliseconds for Express; it converts internally
// //       httpOnly: true,
// //       path    : "/",
// //       sameSite: isProduction ? "none" : "lax",
// //       secure  : isProduction,
// //     };

// //     const refreshTokenOptions = {
// //       maxAge  : refreshTTL,
// //       httpOnly: true,
// //       path    : "/",
// //       sameSite: isProduction ? "none" : "lax",
// //       secure  : isProduction,
// //     };

// //     // ── Fix #4: safe toSafeObject — works whether user is a Mongoose doc or lean object ──
// //     const safeUser = typeof user.toSafeObject === "function"
// //       ? user.toSafeObject()
// //       : (() => {
// //           // Lean object: strip internal fields manually
// //           const { password, refreshTokens, __v, ...safe } = user;
// //           return safe;
// //         })();

// //     // ── Fix #7: never send token in body unless explicitly in dev AND NODE_ENV is set ──
// //     // NODE_ENV must be the string "development" — undefined/unset does NOT qualify.
// //     const responseBody = {
// //       success  : true,
// //       message,
// //       data     : safeUser,
// //       nextRoute,
// //       ...(process.env.NODE_ENV === "development" && { accessToken }),
// //     };

// //     // ── Fix #3: cookie names match what auth middleware reads ──
// //     // Change "accessToken" / "refreshToken" to whatever your middleware uses.
// //     // ── Fix #15: log AFTER response is fully built, immediately before sending ──
// //     logger.info("Tokens generated successfully", {
// //       userId    : user._id,
// //       statusCode,
// //       rememberMe,
// //       elapsedMs : Date.now() - t0,
// //     });

// //     return res
// //       .status(statusCode)
// //       .cookie("accessToken",  accessToken,  accessTokenOptions)   // Fix #3: camelCase
// //       .cookie("refreshToken", refreshToken, refreshTokenOptions)  // Fix #3: camelCase
// //       .json(responseBody);

// //   } catch (error) {
// //     // ── Fix #1: log the REAL error cause, not just the wrapper message ──
// //     // ── Fix #10: omit stack trace in production ──
// //     logger.error("Token generation failed", {
// //       userId : user?._id,
// //       cause  : error.message,
// //       code   : error.code,
// //       ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
// //     });

// //     return next(new AppError("Token generation failed. Please try again.", 500));
// //   }
// // };


// import logger from "../config/logger.js";
// import AppError from "../utils/AppError.js";

// // ─────────────────────────────────────────────
// //  Token Lifetime — Single Source of Truth
// //
// //  Import these in your User model's generateRefreshToken
// //  so cookie expiry and DB token expiry are always in sync:
// //
// //    import {
// //      ACCESS_TOKEN_TTL_MS,
// //      REFRESH_TOKEN_TTL_MS,
// //      REFRESH_TOKEN_TTL_REMEMBER_MS,
// //    } from "../utils/sendToken.js";
// // ─────────────────────────────────────────────

// export const ACCESS_TOKEN_TTL_MS            = 15 * 60 * 1000;           // 15 min
// export const REFRESH_TOKEN_TTL_MS           = 7  * 24 * 60 * 60 * 1000; // 7 days
// export const REFRESH_TOKEN_TTL_REMEMBER_MS  = 30 * 24 * 60 * 60 * 1000; // 30 days

// // ─────────────────────────────────────────────
// //  Allowed client-side redirect routes
// //  Add new routes here as the app grows.
// //  Never allow external URLs or JS-protocol strings.
// // ─────────────────────────────────────────────

// const ALLOWED_NEXT_ROUTES = new Set([
//   "/feed",
//   "/dashboard",
//   "/onboarding/username",
//   "/verify-otp",
//   "/reset-password",
//   "/profile-setup",
// ]);

// function sanitizeNextRoute(route) {
//   if (typeof route === "string" && ALLOWED_NEXT_ROUTES.has(route)) {
//     return route;
//   }
//   return "/feed"; // safe fallback
// }

// // ─────────────────────────────────────────────
// //  Cookie name constants
// //  All auth files must import from here —
// //  never hardcode cookie names in controllers.
// // ─────────────────────────────────────────────

// export const COOKIE_ACCESS  = "accessToken";
// export const COOKIE_REFRESH = "refreshToken";

// // ─────────────────────────────────────────────
// //  sendToken
// //
// //  Generates access + refresh tokens, sets httpOnly cookies,
// //  and sends the JSON response.
// //
// //  @param {object}   user        Mongoose User doc or lean object
// //  @param {number}   statusCode  HTTP status (200, 201 …)
// //  @param {object}   res         Express response
// //  @param {object}   [options]   { message, nextRoute, deviceInfo, ipAddress, rememberMe }
// //  @param {Function} next        Express next() — required
// // ─────────────────────────────────────────────

// export const sendToken = async (user, statusCode, res, options, next) => {
//   // Guard: next must be a function before we do anything
//   if (typeof next !== "function") {
//     throw new TypeError(
//       "sendToken: `next` must be an Express next() function. Did you forget to pass it?",
//     );
//   }

//   // Guard: options may be null/undefined from older call sites
//   const opts       = options && typeof options === "object" ? options : {};
//   const deviceInfo = typeof opts.deviceInfo === "string" && opts.deviceInfo.trim()
//     ? opts.deviceInfo.trim()
//     : "unknown";
//   const ipAddress  = opts.ipAddress  || null;
//   const rememberMe = opts.rememberMe === true;
//   const message    = opts.message    || "Success";
//   const nextRoute  = sanitizeNextRoute(opts.nextRoute);

//   const isProduction = process.env.NODE_ENV === "production";

//   try {
//     const t0 = Date.now();

//     // Generate both tokens BEFORE touching the response.
//     // If either throws, zero cookies are written — no half-auth state.
//     const accessToken  = user.generateAccessToken();
//     const refreshToken = await user.generateRefreshToken(deviceInfo, ipAddress, rememberMe);

//     logger.info("Token generation timing", {
//       userId    : user._id,
//       elapsedMs : Date.now() - t0,
//     });

//     // Cookie TTL driven by shared constants — never hardcoded
//     const refreshTTL = rememberMe ? REFRESH_TOKEN_TTL_REMEMBER_MS : REFRESH_TOKEN_TTL_MS;

//     // maxAge (relative ms) instead of expires (absolute Date) — clock-skew safe
//     // path: "/" ensures cookies are sent on every route, not just /api/v2/auth/login
//     const accessTokenOptions = {
//       maxAge  : ACCESS_TOKEN_TTL_MS,
//       httpOnly: true,
//       path    : "/",
//       sameSite: isProduction ? "none" : "lax",
//       secure  : isProduction,
//     };

//     const refreshTokenOptions = {
//       maxAge  : refreshTTL,
//       httpOnly: true,
//       path    : "/",
//       sameSite: isProduction ? "none" : "lax",
//       secure  : isProduction,
//     };

//     // Safe user object — works for both Mongoose docs and lean objects
//     const safeUser = typeof user.toSafeObject === "function"
//       ? user.toSafeObject()
//       : (({ password, refreshTokens, __v, ...rest }) => rest)(user);

//     // accessToken in body ONLY in development (NODE_ENV must be exactly "development")
//     // Unset / undefined does NOT qualify — prevents accidental token leak in prod
//     const responseBody = {
//       success  : true,
//       message,
//       data     : safeUser,
//       nextRoute,
//       ...(process.env.NODE_ENV === "development" && { accessToken }),
//     };

//     // Log just before sending — if response write fails the log won't claim success
//     logger.info("Tokens generated successfully", {
//       userId    : user._id,
//       statusCode,
//       rememberMe,
//       elapsedMs : Date.now() - t0,
//     });

//     return res
//       .status(statusCode)
//       .cookie(COOKIE_ACCESS,  accessToken,  accessTokenOptions)
//       .cookie(COOKIE_REFRESH, refreshToken, refreshTokenOptions)
//       .json(responseBody);

//   } catch (error) {
//     // Log the real cause — not just the wrapper message
//     logger.error("Token generation failed", {
//       userId : user?._id,
//       cause  : error.message,
//       code   : error.code,
//       // Stack only in non-production — prevents internal path leakage
//       ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
//     });

//     return next(new AppError("Token generation failed. Please try again.", 500));
//   }
// };

// // ─────────────────────────────────────────────
// //  clearAuthCookies
// //
// //  Shared helper — call from logout + password reset
// //  so cookie names and options are always consistent.
// // ─────────────────────────────────────────────

// export function clearAuthCookies(res) {
//   const isProduction = process.env.NODE_ENV === "production";

//   const opts = {
//     httpOnly: true,
//     path    : "/",
//     sameSite: isProduction ? "none" : "lax",
//     secure  : isProduction,
//   };

//   return res
//     .clearCookie(COOKIE_ACCESS,  opts)
//     .clearCookie(COOKIE_REFRESH, opts);
// }



import logger from "../config/logger.js";
import AppError from "../utils/AppError.js";

// ─────────────────────────────────────────────
//  Token Lifetime Constants — Single Source of Truth
//  Import in User model so cookie expiry === DB token expiry
// ─────────────────────────────────────────────

export const ACCESS_TOKEN_TTL_MS           = 15 * 60 * 1000;            // 15 min
export const REFRESH_TOKEN_TTL_MS          = 7  * 24 * 60 * 60 * 1000;  // 7 days
export const REFRESH_TOKEN_TTL_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days

// ─────────────────────────────────────────────
//  Cookie Name Constants
//  All auth files import from here — never hardcode cookie names
// ─────────────────────────────────────────────

export const COOKIE_ACCESS  = "accessToken";
export const COOKIE_REFRESH = "refreshToken";

// ─────────────────────────────────────────────
//  Allowed nextRoute values — open-redirect guard
// ─────────────────────────────────────────────

const ALLOWED_NEXT_ROUTES = new Set([
  "/feed",
  "/dashboard",
  "/onboarding/username",
  "/verify-otp",
  "/reset-password",
  "/profile-setup",
]);

function sanitizeNextRoute(route) {
  return typeof route === "string" && ALLOWED_NEXT_ROUTES.has(route)
    ? route
    : "/feed";
}

// ─────────────────────────────────────────────
//  clearAuthCookies — shared logout helper
//  Uses same names + options as sendToken — always consistent
// ─────────────────────────────────────────────

export function clearAuthCookies(res) {
  const isProduction = process.env.NODE_ENV === "production";
  const opts = {
    httpOnly: true,
    path    : "/",
    sameSite: isProduction ? "none" : "lax",
    secure  : isProduction,
  };
  // Must return res so callers can chain .status().json()
  res.clearCookie(COOKIE_ACCESS,  opts);
  res.clearCookie(COOKIE_REFRESH, opts);
  return res;
}

// ─────────────────────────────────────────────
//  sendToken
//
//  @param {object}   user       Mongoose User doc (must have generateAccessToken,
//                               generateRefreshToken, toSafeObject methods)
//  @param {number}   statusCode HTTP status code
//  @param {object}   res        Express response
//  @param {object}   [options]  { message, nextRoute, deviceInfo, ipAddress, rememberMe }
//  @param {Function} next       Express next() — required
// ─────────────────────────────────────────────

export const sendToken = async (user, statusCode, res, options, next) => {
  if (typeof next !== "function") {
    throw new TypeError("sendToken: `next` must be an Express next() function.");
  }

  const opts       = options && typeof options === "object" ? options : {};
  const deviceInfo = typeof opts.deviceInfo === "string" && opts.deviceInfo.trim()
    ? opts.deviceInfo.trim() : "unknown";
  const ipAddress  = opts.ipAddress  || null;
  const rememberMe = opts.rememberMe === true;
  const message    = opts.message    || "Success";
  const nextRoute  = sanitizeNextRoute(opts.nextRoute);
  const isProduction = process.env.NODE_ENV === "production";

  try {
    const t0 = Date.now();

    // Generate both tokens BEFORE writing any cookies.
    // If either throws — zero cookies written, no half-auth state.
    const accessToken  = user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken(deviceInfo, ipAddress, rememberMe);

    logger.info("Token generation timing", {
      userId: user._id, elapsedMs: Date.now() - t0,
    });

    const refreshTTL = rememberMe ? REFRESH_TOKEN_TTL_REMEMBER_MS : REFRESH_TOKEN_TTL_MS;

    const accessTokenOptions = {
      maxAge  : ACCESS_TOKEN_TTL_MS,
      httpOnly: true,
      path    : "/",
      sameSite: isProduction ? "none" : "lax",
      secure  : isProduction,
    };

    const refreshTokenOptions = {
      maxAge  : refreshTTL,
      httpOnly: true,
      path    : "/",
      sameSite: isProduction ? "none" : "lax",
      secure  : isProduction,
    };

    // Works for both Mongoose docs and lean objects
    const safeUser = typeof user.toSafeObject === "function"
      ? user.toSafeObject()
      : (({ password, refreshTokens, __v, ...rest }) => rest)(user);

    const responseBody = {
      success  : true,
      message,
      data     : safeUser,
      nextRoute,
      // accessToken in body ONLY when NODE_ENV is exactly "development"
      ...(process.env.NODE_ENV === "development" && { accessToken }),
    };

    logger.info("Tokens generated successfully", {
      userId: user._id, statusCode, rememberMe, elapsedMs: Date.now() - t0,
    });

    return res
      .status(statusCode)
      .cookie(COOKIE_ACCESS,  accessToken,  accessTokenOptions)
      .cookie(COOKIE_REFRESH, refreshToken, refreshTokenOptions)
      .json(responseBody);

  } catch (error) {
    logger.error("Token generation failed", {
      userId : user?._id,
      cause  : error.message,
      code   : error.code,
      ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
    });
    return next(new AppError("Token generation failed. Please try again.", 500));
  }
};