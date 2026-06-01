

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