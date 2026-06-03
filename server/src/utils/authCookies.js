
const isProduction = process.env.NODE_ENV === "production";

// ── Cookie Names ──────────────────────────────
export const USER_COOKIE_ACCESS   = "user_access_token";
export const USER_COOKIE_REFRESH  = "user_refresh_token";

export const ADMIN_COOKIE_ACCESS  = "admin_access_token";
export const ADMIN_COOKIE_REFRESH = "admin_refresh_token";


export function buildCookieOptions({ maxAge,  path }) {
  const prod = process.env.NODE_ENV === "production";
  return {
    maxAge,
    httpOnly : true,
    secure   : prod,
    sameSite : prod ? "none" : "lax",
    path     : path || "/",
    ...(prod && process.env.COOKIE_DOMAIN
      ? { domain: process.env.COOKIE_DOMAIN }
      : {}),
  };
}

// ── Clear Helpers ─────────────────────────────
export function clearUserCookies(res) {
  const opts = { httpOnly: true, path: "/" };
  res.clearCookie(USER_COOKIE_ACCESS,  opts);
  res.clearCookie(USER_COOKIE_REFRESH, opts);
  return res;
}

export function clearAdminCookies(res) {
  const opts = { httpOnly: true, path: "/" };
  res.clearCookie(ADMIN_COOKIE_ACCESS,  opts);
  res.clearCookie(ADMIN_COOKIE_REFRESH, opts);
  return res;
}