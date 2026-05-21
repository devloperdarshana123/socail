import axios from "axios";

const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:9080/api/v2",
  withCredentials: true,
});

// ── Request Interceptor ──
adminApi.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("adminAccessToken");
    if (accessToken && accessToken !== "null" && accessToken !== "undefined") {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    config.headers["x-platform"] = "admin";
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

adminApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Refresh endpoint pe 401 → logout, infinite loop rokne ke liye
    if (
      error.response?.status === 401 &&
      originalRequest.url?.includes("/admin/auth/refresh-token")
    ) {
      localStorage.removeItem("adminAccessToken");
      window.dispatchEvent(new CustomEvent("admin:logout"));
      return Promise.reject(error);
    }

    // Login route pe refresh mat karo — uska 401 actual auth error hai
    const skipRefreshRoutes = ["/admin/auth/login"];
    const isSkipRoute = skipRefreshRoutes.some((route) =>
      originalRequest.url?.includes(route),
    );

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isSkipRoute
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return adminApi(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // axios directly use karo — adminApi instance use karne se loop hoga
        const response = await axios.post(
          `${adminApi.defaults.baseURL}/admin/auth/refresh-token`,
          {},
          { withCredentials: true },
        );

        const newToken = response.data.accessToken;

        if (newToken && newToken !== "null") {
          localStorage.setItem("adminAccessToken", newToken);
          adminApi.defaults.headers.common.Authorization = `Bearer ${newToken}`;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;

          // App ko batao — Redux state update ke liye
          window.dispatchEvent(
            new CustomEvent("admin:tokenRefreshed", {
              detail: { token: newToken },
            }),
          );

          processQueue(null, newToken);
          return adminApi(originalRequest);
        } else {
          throw new Error("No token received");
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("adminAccessToken");
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