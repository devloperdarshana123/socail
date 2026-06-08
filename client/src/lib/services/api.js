


import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL || "http://localhost:9080/api/v2",
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => { config.headers["x-platform"] = "web"; return config; },
  (error)  => Promise.reject(error),
);

let refreshPromise = null; // boolean nahi — Promise store karo
let isLoggingOut   = false;

const forceLogout = () => {
  if (isLoggingOut) return;
  isLoggingOut   = true;
  refreshPromise = null;
  window.dispatchEvent(new CustomEvent("auth:logout"));
};

const SKIP_ROUTES = [
  "/auth/login", "/auth/register", "/auth/forgot-password",
  "/auth/verify-otp", "/auth/google",
  "/auth/me",  // fetchMe pe retry mat karo — infinite loop rokta hai
];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const orig   = error.config;
    const status = error.response?.status;

    if (status === 401 && orig.url?.includes("/auth/refresh-token")) {
      forceLogout();
      return Promise.reject(error);
    }

    const isSkip = SKIP_ROUTES.some((r) => orig.url?.includes(r));

    if (status === 401 && !orig._retry && !isSkip) {
      orig._retry = true;

      // KEY FIX: agar refreshPromise already chal rahi hai
      // toh same Promise await karo — naya refresh trigger MAT karo
      // Yeh explore page pe 5-6 simultaneous 401s ko handle karta hai
      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${api.defaults.baseURL}/auth/refresh-token`, {}, { withCredentials: true })
          .catch((err) => {
            forceLogout();
            throw err;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        await refreshPromise;
        return api(orig);
      } catch {
        return Promise.reject(error);
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