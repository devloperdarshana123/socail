
// import axios from "axios";

// const api = axios.create({
//   baseURL: import.meta.env.VITE_SERVER_URL || "http://localhost:9080/api/v2",
//   withCredentials: true,
// });

// // ── Request Interceptor ──
// api.interceptors.request.use(
//   (config) => {
//     const accessToken = localStorage.getItem("accessToken");
//     if (accessToken) {
//       config.headers.Authorization = `Bearer ${accessToken}`;
//     }
//     config.headers["x-platform"] = "web";
//     return config;
//   },
//   (error) => Promise.reject(error),
// );

// // ── Response Interceptor ──
// let isRefreshing = false;          // ✅ ek baar hi refresh ho
// let failedQueue = [];              // ✅ refresh hone tak requests queue mein rakho

// const processQueue = (error, token = null) => {
//   failedQueue.forEach((prom) => {
//     if (error) {
//       prom.reject(error);
//     } else {
//       prom.resolve(token);
//     }
//   });
//   failedQueue = [];
// };

// api.interceptors.response.use(
//   (response) => response,
//   async (error) => {
//     const originalRequest = error.config;

//     // Refresh endpoint pe 401 aaye toh logout karo — infinite loop rokne ke liye
//    if (
//   error.response?.status === 401 &&
//   originalRequest.url?.includes("/auth/refresh-token")
// ) {
//   localStorage.removeItem("accessToken");
//   window.dispatchEvent(new CustomEvent("auth:logout"));
//   return Promise.reject(error);
// }

//     if (error.response?.status === 401 && !originalRequest._retry) {
//       if (isRefreshing) {
//         // ✅ Agar refresh chal raha hai toh queue mein daalo
//         return new Promise((resolve, reject) => {
//           failedQueue.push({ resolve, reject });
//         })
//           .then((token) => {
//             originalRequest.headers.Authorization = `Bearer ${token}`;
//             return api(originalRequest);
//           })
//           .catch((err) => Promise.reject(err));
//       }

//       originalRequest._retry = true;
//       isRefreshing = true;

//       try {
//         const response = await api.post(
//           "/auth/refresh-token",
//           {},
//           { withCredentials: true },
//         );

//        const newToken = response.data.accessToken;

// if (newToken && newToken !== "null") {
//   localStorage.setItem("accessToken", newToken);
//           api.defaults.headers.Authorization = `Bearer ${newToken}`;
//           originalRequest.headers.Authorization = `Bearer ${newToken}`;
//           processQueue(null, newToken);   // ✅ Queue clear karo
//           return api(originalRequest);
//         }
//       } catch (refreshError) {
//   processQueue(refreshError, null);
// localStorage.removeItem("accessToken");
// window.dispatchEvent(new CustomEvent("auth:logout"));
// return Promise.reject(refreshError);
//       }
//        finally {
//         isRefreshing = false; // ✅ YEH ADD KARO
//       }
//     }

//     return Promise.reject(error);
//   },
// );

// export const saveConsentAPI = async (consentData) => {
//   const response = await api.post("/consent", consentData);
//   return response.data;
// };

// export const getConsentAPI = async (sessionId) => {
//   try {
//     const response = await api.get(`/consent/${sessionId}`);
//     return response.data;
//   } catch (error) {
//     if (error.response?.status === 404) return null;
//     throw error;
//   }
// };

// export default api;



import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL || "http://localhost:9080/api/v2",
  withCredentials: true,
});

// ── Request Interceptor ──
api.interceptors.request.use(
  (config) => {
    // Dev mein localStorage token use karo
    // Production mein cookie automatically jaati hai (withCredentials: true)
    if (import.meta.env.DEV) {
      const accessToken = localStorage.getItem("accessToken");
      if (accessToken && accessToken !== "null" && accessToken !== "undefined") {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
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
    error ? prom.reject(error) : prom.resolve(token);
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

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            // Token mil gaya (dev) ya nahi mila (prod) — dono handle karo
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            } else {
              // Production: cookie already set ho gayi refresh ke baad
              delete originalRequest.headers.Authorization;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await api.post(
          "/auth/refresh-token",
          {},
          { withCredentials: true },
        );

        // Dev: token body mein aata hai
        // Production: token body mein nahi aata, sirf cookie set hoti hai
        const newToken = response.data?.accessToken;
        const hasToken = newToken && newToken !== "null" && newToken !== "undefined";

        if (hasToken) {
          // Development flow
          localStorage.setItem("accessToken", newToken);
          api.defaults.headers.Authorization = `Bearer ${newToken}`;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);
        } else {
          // Production flow — cookie set ho gayi, header clear karo
          localStorage.removeItem("accessToken");
          delete api.defaults.headers.Authorization;
          delete originalRequest.headers.Authorization;
          processQueue(null, null); // ← Queue clear karo bina token ke
        }

        return api(originalRequest); // ← Dono cases mein retry

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