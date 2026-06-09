// utils/sendUserToken.js
import logger from "../config/logger.js";
import AppError from "./AppError.js";
import {
  USER_COOKIE_ACCESS,
  USER_COOKIE_REFRESH,
  buildCookieOptions,
} from "./authCookies.js";

const ACCESS_TTL_MS          = 15 * 60 * 1000;

const REFRESH_TTL_MS         = 7  * 24 * 60 * 60 * 1000;
const REFRESH_TTL_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

const ALLOWED_ROUTES = new Set([
  "/feed",
  "/onboarding/username",
  "/verify-otp",
  "/reset-password",
  "/profile-setup",
]);

function sanitizeRoute(r) {
  return typeof r === "string" && ALLOWED_ROUTES.has(r) ? r : "/feed";
}

export const sendUserToken = async (user, statusCode, res, options = {}, next) => {
  if (typeof next !== "function") {
    throw new TypeError("sendUserToken: next() required");
  }

  const {
    message    = "Success",
    nextRoute,
    deviceInfo = "unknown",
    ipAddress  = null,
    rememberMe = false,
  } = options;

  try {
    const accessToken  = user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken(deviceInfo, ipAddress, rememberMe);

    const refreshTTL = rememberMe ? REFRESH_TTL_REMEMBER_MS : REFRESH_TTL_MS;

    const safeUser = typeof user.toSafeObject === "function"
      ? user.toSafeObject()
      : (({ password, refreshTokens, __v, ...rest }) => rest)(user);

    logger.info("User tokens generated", { userId: user._id });

    return res
      .status(statusCode)
      .cookie(USER_COOKIE_ACCESS, accessToken, buildCookieOptions({
        maxAge: ACCESS_TTL_MS,
        path  : "/",
      }))
      .cookie(USER_COOKIE_REFRESH, refreshToken, buildCookieOptions({
        maxAge: refreshTTL,
        path  : "/",
      }))
      .json({
        success  : true,
        message,
        data     : safeUser,
        nextRoute: sanitizeRoute(nextRoute),
        expiresAt: new Date(Date.now() + ACCESS_TTL_MS).toISOString(),
        ...(process.env.NODE_ENV === "development" && { accessToken }),
      });

  } catch (err) {
    logger.error("sendUserToken failed", { userId: user?._id, cause: err.message });
    return next(new AppError("Token generation failed. Please try again.", 500));
  }
};