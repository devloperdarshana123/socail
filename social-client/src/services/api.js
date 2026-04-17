import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER,
  withCredentials: true,
});

const PUBLIC_ROUTES = [
  "/auth/register",
  "/auth/login",
  "/auth/logout",
   "/auth/google", 
];

const isPublicRoute = (url) =>
  PUBLIC_ROUTES.some((route) => url.includes(route));

// ── Request Interceptor ────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    if (!isPublicRoute(config.url)) {
      const token = localStorage.getItem("erosocial_token");
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor ───────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401 && !isPublicRoute(error.config?.url)) {
      console.log("🔴 Unauthorized - logging out");
      localStorage.removeItem("erosocial_token");
      localStorage.removeItem("erosocial_user");
      window.location.href = "/login";
    }

    if (status === 403) {
      console.warn("⚠️ 403 Forbidden");
    }

    return Promise.reject(error);
  }
);

export default api;