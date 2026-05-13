import jwt from "jsonwebtoken";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const ACCESS_EXPIRY  = process.env.JWT_ACCESS_EXPIRY  || "15m";   // short-lived
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "7d";    // long-lived

// ─────────────────────────────────────────────────────────────────────────────
// Generators
// ─────────────────────────────────────────────────────────────────────────────

/** @param {string} userId */
export const generateAccessToken = (userId) =>
  jwt.sign({ id: userId, type: "access" }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });

/** @param {string} userId */
export const generateRefreshToken = (userId) =>
  jwt.sign({ id: userId, type: "refresh" }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });

/** Dono ek saath generate karo */
export const generateTokenPair = (userId) => ({
  accessToken:  generateAccessToken(userId),
  refreshToken: generateRefreshToken(userId),
});

// ─────────────────────────────────────────────────────────────────────────────
// Verifiers
// ─────────────────────────────────────────────────────────────────────────────

/** @returns {{ id: string } | null} */
export const verifyAccessToken = (token) => {
  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    if (payload.type !== "access") return null;
    return payload;
  } catch {
    return null;
  }
};

/** @returns {{ id: string } | null} */
export const verifyRefreshToken = (token) => {
  try {
    const payload = jwt.verify(token, REFRESH_SECRET);
    if (payload.type !== "refresh") return null;
    return payload;
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Cookie Options
// ─────────────────────────────────────────────────────────────────────────────

const isProd = process.env.NODE_ENV === "production";

/**
 * Refresh token cookie options
 * httpOnly  — JS se access nahi hoga (XSS protection)
 * secure    — sirf HTTPS pe jayega (production mein)
 * sameSite  — CSRF protection
 */
export const refreshCookieOptions = {
  httpOnly: true,
  secure:   isProd,
  sameSite: isProd ? "strict" : "lax",
  maxAge:   7 * 24 * 60 * 60 * 1000,   // 7 days in ms
  path:     "/api/auth/refresh",        // sirf refresh endpoint pe jayega
};

/** Cookie clear karne ke liye */
export const clearCookieOptions = {
  httpOnly: true,
  secure:   isProd,
  sameSite: isProd ? "strict" : "lax",
  path:     "/api/auth/refresh",
};