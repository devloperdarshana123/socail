

import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL || "http://localhost:9080/api/v2",
  withCredentials: true,
});

// ── Request Interceptor ──
api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken && accessToken !== "null" && accessToken !== "undefined") {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    config.headers["x-platform"] = "web";
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response Interceptor ──
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Refresh endpoint pe 401 → logout, infinite loop rokne ke liye
    if (
      error.response?.status === 401 &&
      originalRequest.url?.includes("/auth/refresh-token")
    ) {
      localStorage.removeItem("accessToken");
      window.dispatchEvent(new CustomEvent("auth:logout"));
      return Promise.reject(error);
    }

  // Login/register routes pe refresh mat karo — unka 401 actual auth error hai
const skipRefreshRoutes = ["/auth/login", "/auth/register", "/auth/forgot-password"];
const isSkipRoute = skipRefreshRoutes.some((route) => originalRequest.url?.includes(route));

if (error.response?.status === 401 && !originalRequest._retry && !isSkipRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // ✅ axios directly use karo — api instance use karne se loop hoga
        const response = await axios.post(
          `${api.defaults.baseURL}/auth/refresh-token`,
          {},
          { withCredentials: true },
        );

        const newToken = response.data.accessToken;

        if (newToken && newToken !== "null") {
          localStorage.setItem("accessToken", newToken);
          api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;

          // ✅ App.jsx ko batao — Redux state update ke liye
          window.dispatchEvent(
            new CustomEvent("auth:tokenRefreshed", { detail: { token: newToken } })
          );

          processQueue(null, newToken);
          return api(originalRequest);
        } else {
          throw new Error("No token received");
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("accessToken");
        window.dispatchEvent(new CustomEvent("auth:logout"));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

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