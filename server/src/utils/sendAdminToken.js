// utils/sendAdminToken.js
import logger from "../config/logger.js";
import AppError from "./AppError.js";
import {
  ADMIN_COOKIE_ACCESS,
  ADMIN_COOKIE_REFRESH,
  buildCookieOptions,
} from "./authCookies.js";

const ACCESS_TTL_MS  = 15 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ALLOWED_ADMIN_ROUTES = new Set([
  "/dashboard",
  "/admin/users",
  "/admin/settings",
]);

function sanitizeRoute(r) {
  return typeof r === "string" && ALLOWED_ADMIN_ROUTES.has(r) ? r : "/dashboard";
}

export const sendAdminToken = async (admin, statusCode, res, options = {}, next) => {
  if (typeof next !== "function") {
    throw new TypeError("sendAdminToken: next() required");
  }

  const {
    message    = "Success",
    nextRoute  = "/dashboard",
    deviceInfo = "unknown",
    ipAddress  = null,
  } = options;

  try {
    const accessToken  = admin.generateAdminAccessToken();
const refreshToken = await admin.generateAdminRefreshToken(deviceInfo, ipAddress);

    const safeAdmin = typeof admin.toSafeObject === "function"
      ? admin.toSafeObject()
      : (({ password, refreshTokens, __v, ...rest }) => rest)(admin);

    logger.info("Admin tokens generated", { userId: admin._id });

    return res
      .status(statusCode)
      .cookie(ADMIN_COOKIE_ACCESS, accessToken, buildCookieOptions({
        maxAge: ACCESS_TTL_MS,
        path  : "/",
      }))
      .cookie(ADMIN_COOKIE_REFRESH, refreshToken, buildCookieOptions({
        maxAge: REFRESH_TTL_MS,
        path  : "/",
      }))
      .json({
        success  : true,
        message,
        data     : safeAdmin,
        nextRoute: sanitizeRoute(nextRoute),
        expiresAt: new Date(Date.now() + ACCESS_TTL_MS).toISOString(),
        ...(process.env.NODE_ENV === "development" && { accessToken }),
      });

  } catch (err) {
    logger.error("sendAdminToken failed", { userId: admin?._id, cause: err.message });
    return next(new AppError("Token generation failed. Please try again.", 500));
  }
};