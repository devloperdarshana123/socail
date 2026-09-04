
import axios from "axios";
import { getToken } from "firebase/app-check";
import { appCheck } from "../../config/firebase";

const BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:9080/api/v2";

const api = axios.create({
  baseURL        : BASE,
  withCredentials: true,
  timeout        : 15_000,
});

// ─────────────────────────────────────────────
//  State
// ─────────────────────────────────────────────
let refreshPromise = null;
let isLoggingOut   = false;
let tokenExpiresAt = null;   // exact ms timestamp — backend se aata hai
let proactiveTimer = null;   // backup timer — tab hidden ho toh visibilitychange handle karega

const REFRESH_BUFFER = 2 * 60 * 1000;   // 2 min pehle refresh
const ACCESS_TTL_MS  = 15 * 60 * 1000;  // backend se match karo



const forceLogout = () => {
  if (isLoggingOut) return;
  isLoggingOut   = true;
  refreshPromise = null;
  tokenExpiresAt = null;
  _clearProactiveTimer();
  window.dispatchEvent(new CustomEvent("auth:logout"));

};

// ─────────────────────────────────────────────
//  Core: single refresh promise — race condition proof
// ─────────────────────────────────────────────
const doRefresh = () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = axios
    .post(`${BASE}/auth/refresh-token`, {}, {
      withCredentials: true,
      timeout        : 10_000,
    })
    .then((res) => {
      // Backend exact expiry bhejta hai — use karo
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

// ─────────────────────────────────────────────
//  Internal: expiry set + backup timer schedule
// ─────────────────────────────────────────────
const _clearProactiveTimer = () => {
  if (proactiveTimer) {
    clearTimeout(proactiveTimer);
    proactiveTimer = null;
  }
};

const _setExpiryAndSchedule = (expiresAt) => {
  _clearProactiveTimer();

  tokenExpiresAt = expiresAt
    ? new Date(expiresAt).getTime()
    : Date.now() + ACCESS_TTL_MS;

  const delay = tokenExpiresAt - Date.now() - REFRESH_BUFFER;

  if (delay <= 0) {
    // Already expiring — refresh immediately
    doRefresh();
    return;
  }

  // Backup timer — agar tab visible ho tab fire karega
  // Agar tab hidden ho toh visibilitychange handle karega
  proactiveTimer = setTimeout(() => {
    proactiveTimer = null;
    // Tab hidden hai? Skip — visibilitychange pe handle hoga
    if (document.visibilityState === "hidden") return;
    doRefresh().catch(() => {});
  }, delay);
};

// ─────────────────────────────────────────────
//  visibilitychange — tab wapas aane pe check
//  (Phone unlock, tab switch — timer freeze fix)
// ─────────────────────────────────────────────
const _handleVisibilityChange = () => {
  if (document.visibilityState !== "visible") return;
  if (!tokenExpiresAt || isLoggingOut)        return;

  const timeLeft = tokenExpiresAt - Date.now();

  if (timeLeft <= 0) {
    // Token already expired — refresh karo
    doRefresh().catch(() => {});
    return;
  }

  if (timeLeft <= REFRESH_BUFFER) {
    // 2 min se kam bacha — proactively refresh
    doRefresh().catch(() => {});
    return;
  }

  // Timer drift check — agar timer miss hua ho (sleep/freeze)
  // Reschedule karo correct time pe
  if (!proactiveTimer) {
    _setExpiryAndSchedule(new Date(tokenExpiresAt).toISOString());
  }
};

document.addEventListener("visibilitychange", _handleVisibilityChange);

// ─────────────────────────────────────────────
//  Public: call this after login + page reload
// ─────────────────────────────────────────────
export const setTokenExpiry = (expiresAt) => {
  isLoggingOut = false;
  _setExpiryAndSchedule(expiresAt);
};

// ─────────────────────────────────────────────
//  Request Interceptor — proactive check before every call
// ─────────────────────────────────────────────
const SKIP_REFRESH_ROUTES = [
  "/auth/refresh-token",
  "/auth/login",
  "/auth/register",
  "/auth/google",
  "/auth/forgot-password",
];

api.interceptors.request.use(
  async (config) => {
    config.headers["x-platform"] = "web";

    if (appCheck) {
      try {
        const { token } = await getToken(appCheck, /* forceRefresh */ false);
        config.headers["X-Firebase-AppCheck"] = token;
      } catch {
        // App Check unreachable/misconfigured — let the request through;
        // the server runs in monitor mode until APP_CHECK_ENFORCE=true.
      }
    }

    const isSkip = SKIP_REFRESH_ROUTES.some((r) => config.url?.includes(r));

    if (!isSkip && !isLoggingOut && tokenExpiresAt) {
      const timeLeft = tokenExpiresAt - Date.now();

      if (timeLeft <= 0 || timeLeft <= REFRESH_BUFFER) {
        // Token expire ho gaya ya hone wala hai — pehle refresh karo
        try {
          await doRefresh();
        } catch {
          return Promise.reject(new axios.CanceledError("Session expired"));
        }
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ─────────────────────────────────────────────
//  Response Interceptor — reactive fallback (last resort)
//  Ye tab fire hoga jab proactive check somehow miss ho
// ─────────────────────────────────────────────
const SKIP_401_ROUTES = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/verify-otp",
  "/auth/google",
  "/auth/me",
];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const orig   = error.config;
    const status = error.response?.status;

    // Refresh endpoint khud 401 diya — session truly dead
    if (status === 401 && orig?.url?.includes("/auth/refresh-token")) {
      forceLogout();
      return Promise.reject(error);
    }

    const isSkip = SKIP_401_ROUTES.some((r) => orig?.url?.includes(r));

    // Reactive fallback — proactive miss hua toh yahan catch hoga
    if (status === 401 && !orig?._retry && !isSkip) {
      orig._retry = true;
      try {
        await doRefresh();
        return api(orig);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

// ─────────────────────────────────────────────
//  Misc exports
// ─────────────────────────────────────────────
export const saveConsentAPI = async (consentData) => {
  const response = await api.post("/consent", consentData);
  return response.data;
};

export const getConsentAPI = async (sessionId) => {
  try {
    const response = await api.get(`/consent/${sessionId}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
};

export default api;