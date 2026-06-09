

// import axios from "axios";


// const adminApi = axios.create({
//   baseURL: import.meta.env.VITE_API_URL || "http://localhost:9080/api/v2",
//   withCredentials: true, // ← sends cookies automatically on every request
//   timeout: 15_000,
// });

// // ── Request Interceptor ──────────────────────────────────────────────────────
// // No Authorization header needed — cookie is sent automatically
// adminApi.interceptors.request.use(
//   (config) => {
//     config.headers["x-platform"] = "admin";
//     return config;
//   },
//   (error) => Promise.reject(error),
// );

// // ── Response Interceptor — silent token refresh ──────────────────────────────
// let isRefreshing = false;
// let failedQueue  = []; // holds pending requests while refresh is in progress

// const processQueue = (error) => {
//   failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
//   failedQueue = [];
// };

// adminApi.interceptors.response.use(
//   (response) => response,

//   async (error) => {
//     const originalRequest = error.config;
//     const status          = error.response?.status;

//     // ── Refresh endpoint itself returned 401 → both tokens expired → logout ──
//     if (status === 401 && originalRequest.url?.includes("/admin/auth/refresh-token")) {
//       processQueue(error);
//       window.dispatchEvent(new CustomEvent("admin:logout"));
//       return Promise.reject(error);
//     }

//     // ── Skip refresh for login route (its 401 is a real wrong-password error) ──
//     const SKIP_REFRESH = ["/admin/auth/login", "/admin/auth/register"];
//     const shouldSkip   = SKIP_REFRESH.some((r) => originalRequest.url?.includes(r));

//     if (status === 401 && !originalRequest._retry && !shouldSkip) {
//       // ── Another request is already refreshing → queue this one ──
//       if (isRefreshing) {
//         return new Promise((resolve, reject) => {
//           failedQueue.push({ resolve, reject });
//         })
//           .then(() => adminApi(originalRequest))   // retry after refresh done
//           .catch((err) => Promise.reject(err));
//       }

//       originalRequest._retry = true;
//       isRefreshing            = true;

//       try {
//         // Refresh token cookie is sent automatically (withCredentials: true)
//         // Backend rotates both cookies — no token handling needed here
//         await axios.post(
//           `${adminApi.defaults.baseURL}/admin/auth/refresh-token`,
//           {},
//           { withCredentials: true, timeout: 10_000 },
//         );

//         // New access token cookie is now set by browser — retry all queued requests
//         processQueue(null);
//         return adminApi(originalRequest);

//       } catch (refreshError) {
//         // Refresh failed (token expired/invalid) → force logout
//         processQueue(refreshError);
//         window.dispatchEvent(new CustomEvent("admin:logout"));
//         return Promise.reject(refreshError);

//       } finally {
//         isRefreshing = false;
//       }
//     }

//     return Promise.reject(error);
//   },
// );

// export default adminApi;


import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:9080/api/v2";

const adminApi = axios.create({
  baseURL        : BASE,
  withCredentials: true,
  timeout        : 15_000,
});

// ─────────────────────────────────────────────
//  State
// ─────────────────────────────────────────────
let refreshPromise = null;
let isLoggingOut   = false;
let tokenExpiresAt = null;
let proactiveTimer = null;

const REFRESH_BUFFER = 2 * 60 * 1000;
const ACCESS_TTL_MS  = 15 * 60 * 1000;

// ─────────────────────────────────────────────
//  Core helpers
// ─────────────────────────────────────────────
const forceLogout = () => {
  if (isLoggingOut) return;
  isLoggingOut   = true;
  refreshPromise = null;
  tokenExpiresAt = null;
  _clearProactiveTimer();
  window.dispatchEvent(new CustomEvent("admin:logout"));
  setTimeout(() => { isLoggingOut = false; }, 3000);
};

const _clearProactiveTimer = () => {
  if (proactiveTimer) { clearTimeout(proactiveTimer); proactiveTimer = null; }
};

const doRefresh = () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = axios
    .post(`${BASE}/admin/auth/refresh-token`, {}, {
      withCredentials: true,
      timeout        : 10_000,
    })
    .then((res) => {
      const expiresAt = res.data?.expiresAt;
      _setExpiryAndSchedule(expiresAt);
    })
    .catch((err) => {
      forceLogout();
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

const _setExpiryAndSchedule = (expiresAt) => {
  _clearProactiveTimer();

  tokenExpiresAt = expiresAt
    ? new Date(expiresAt).getTime()
    : Date.now() + ACCESS_TTL_MS;

  const delay = tokenExpiresAt - Date.now() - REFRESH_BUFFER;
  if (delay <= 0) { doRefresh(); return; }

  proactiveTimer = setTimeout(() => {
    proactiveTimer = null;
    if (document.visibilityState === "hidden") return;
    doRefresh().catch(() => {});
  }, delay);
};

// ─────────────────────────────────────────────
//  visibilitychange — tab wapas aane pe check
// ─────────────────────────────────────────────
const _handleVisibilityChange = () => {
  if (document.visibilityState !== "visible") return;
  if (!tokenExpiresAt || isLoggingOut)        return;

  const timeLeft = tokenExpiresAt - Date.now();

  if (timeLeft <= 0 || timeLeft <= REFRESH_BUFFER) {
    doRefresh().catch(() => {});
    return;
  }

  if (!proactiveTimer) {
    _setExpiryAndSchedule(new Date(tokenExpiresAt).toISOString());
  }
};

document.addEventListener("visibilitychange", _handleVisibilityChange);

// ─────────────────────────────────────────────
//  Public — call after login + page reload
// ─────────────────────────────────────────────
export const setAdminTokenExpiry = (expiresAt) => {
  _setExpiryAndSchedule(expiresAt);
};

// ─────────────────────────────────────────────
//  Request Interceptor — proactive check
// ─────────────────────────────────────────────
const SKIP_REFRESH_ROUTES = [
  "/admin/auth/refresh-token",
  "/admin/auth/login",
];

adminApi.interceptors.request.use(
  async (config) => {
    config.headers["x-platform"] = "admin";

    const isSkip = SKIP_REFRESH_ROUTES.some((r) => config.url?.includes(r));

    if (!isSkip && !isLoggingOut && tokenExpiresAt) {
      const timeLeft = tokenExpiresAt - Date.now();
      if (timeLeft <= 0 || timeLeft <= REFRESH_BUFFER) {
        try {
          await doRefresh();
        } catch {
          return Promise.reject(new axios.Cancel("Session expired"));
        }
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ─────────────────────────────────────────────
//  Response Interceptor — reactive fallback
// ─────────────────────────────────────────────
const SKIP_401_ROUTES = [
  "/admin/auth/login",
];

adminApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const orig   = error.config;
    const status = error.response?.status;

    if (status === 401 && orig?.url?.includes("/admin/auth/refresh-token")) {
      forceLogout();
      return Promise.reject(error);
    }

    const isSkip = SKIP_401_ROUTES.some((r) => orig?.url?.includes(r));

    if (status === 401 && !orig?._retry && !isSkip) {
      orig._retry = true;
      try {
        await doRefresh();
        return adminApi(orig);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default adminApi;