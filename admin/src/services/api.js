

import axios from "axios";

// ─────────────────────────────────────────────────────────────────────────────
//  Admin API — cookie-based auth (httpOnly cookies, no localStorage)
//  Access token  : 15 min, httpOnly cookie → sent automatically by browser
//  Refresh token : 7 days, httpOnly cookie → sent automatically by browser
//  Rule: NEVER read/write tokens in JS. Browser handles everything.
// ─────────────────────────────────────────────────────────────────────────────

const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:9080/api/v2",
  withCredentials: true, // ← sends cookies automatically on every request
  timeout: 15_000,
});

// ── Request Interceptor ──────────────────────────────────────────────────────
// No Authorization header needed — cookie is sent automatically
adminApi.interceptors.request.use(
  (config) => {
    config.headers["x-platform"] = "admin";
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response Interceptor — silent token refresh ──────────────────────────────
let isRefreshing = false;
let failedQueue  = []; // holds pending requests while refresh is in progress

const processQueue = (error) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  failedQueue = [];
};

adminApi.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;
    const status          = error.response?.status;

    // ── Refresh endpoint itself returned 401 → both tokens expired → logout ──
    if (status === 401 && originalRequest.url?.includes("/admin/auth/refresh-token")) {
      processQueue(error);
      window.dispatchEvent(new CustomEvent("admin:logout"));
      return Promise.reject(error);
    }

    // ── Skip refresh for login route (its 401 is a real wrong-password error) ──
    const SKIP_REFRESH = ["/admin/auth/login", "/admin/auth/register"];
    const shouldSkip   = SKIP_REFRESH.some((r) => originalRequest.url?.includes(r));

    if (status === 401 && !originalRequest._retry && !shouldSkip) {
      // ── Another request is already refreshing → queue this one ──
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => adminApi(originalRequest))   // retry after refresh done
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing            = true;

      try {
        // Refresh token cookie is sent automatically (withCredentials: true)
        // Backend rotates both cookies — no token handling needed here
        await axios.post(
          `${adminApi.defaults.baseURL}/admin/auth/refresh-token`,
          {},
          { withCredentials: true, timeout: 10_000 },
        );

        // New access token cookie is now set by browser — retry all queued requests
        processQueue(null);
        window.dispatchEvent(new CustomEvent("admin:tokenRefreshed"));
        return adminApi(originalRequest);

      } catch (refreshError) {
        // Refresh failed (token expired/invalid) → force logout
        processQueue(refreshError);
        window.dispatchEvent(new CustomEvent("admin:logout"));
        return Promise.reject(refreshError);

      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default adminApi;