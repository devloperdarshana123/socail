


// // // import axios from "axios";

// // // const api = axios.create({
// // //   baseURL: import.meta.env.VITE_SERVER_URL || "http://localhost:9080/api/v2",
// // //   withCredentials: true,
// // // });

// // // api.interceptors.request.use(
// // //   (config) => {
// // //     config.headers["x-platform"] = "web";
// // //     return config;
// // //   },
// // //   (error) => Promise.reject(error),
// // // );

// // // let isRefreshing = false;
// // // let failedQueue = [];

// // // const processQueue = (error) => {
// // //   failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
// // //   failedQueue = [];
// // // };

// // // api.interceptors.response.use(
// // //   (res) => res,
// // //   async (error) => {
// // //     const orig = error.config;

// // //     // Refresh route pe 401 → seedha logout
// // //     if (error.response?.status === 401 && orig.url?.includes("/auth/refresh-token")) {
// // //       window.dispatchEvent(new CustomEvent("auth:logout"));
// // //       return Promise.reject(error);
// // //     }

// // //     const skipRoutes = ["/auth/login", "/auth/register", "/auth/forgot-password", "/auth/verify-otp"];
// // //     const isSkip = skipRoutes.some((r) => orig.url?.includes(r));

// // //     if (error.response?.status === 401 && !orig._retry && !isSkip) {

// // //       // Agar refresh chal raha hai toh queue mein daalo
// // //       if (isRefreshing) {
// // //         return new Promise((resolve, reject) => {
// // //           failedQueue.push({ resolve, reject });
// // //         })
// // //           .then(() => api(orig))
// // //           .catch((err) => Promise.reject(err));
// // //       }

// // //       orig._retry = true;
// // //       isRefreshing = true;

// // //       try {
// // //         await axios.post(
// // //           `${api.defaults.baseURL}/auth/refresh-token`,
// // //           {},
// // //           { withCredentials: true },
// // //         );
// // //         processQueue(null);
// // //         return api(orig);
// // //       } catch (refreshErr) {
// // //         processQueue(refreshErr);
// // //         window.dispatchEvent(new CustomEvent("auth:logout"));
// // //         return Promise.reject(refreshErr);
// // //       } finally {
// // //         isRefreshing = false;
// // //       }
// // //     }

// // //     return Promise.reject(error);
// // //   },
// // // );

// // // export const saveConsentAPI = async (consentData) => {
// // //   const response = await api.post("/consent", consentData);
// // //   return response.data;
// // // };

// // // export const getConsentAPI = async (sessionId) => {
// // //   try {
// // //     const response = await api.get(`/consent/${sessionId}`);
// // //     return response.data;
// // //   } catch (error) {
// // //     if (error.response?.status === 404) return null;
// // //     throw error;
// // //   }
// // // };

// // // export default api;



// // import axios from "axios";

// // const api = axios.create({
// //   baseURL: import.meta.env.VITE_SERVER_URL || "http://localhost:9080/api/v2",
// //   withCredentials: true,
// // });

// // // ── Request interceptor ───────────────────────────────────────────────────────
// // api.interceptors.request.use(
// //   (config) => {
// //     config.headers["x-platform"] = "web";
// //     return config;
// //   },
// //   (error) => Promise.reject(error),
// // );

// // // ── Silent refresh state ──────────────────────────────────────────────────────
// // let isRefreshing = false;
// // let failedQueue  = [];

// // const processQueue = (error) => {
// //   failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
// //   failedQueue = [];
// // };

// // // Lazy import — circular import todne ke liye
// // // api.js → store import nahi karta directly
// // const forceLogout = async () => {
// //   isRefreshing = false;
// //   failedQueue  = [];

// //   try {
// //     // Dynamic import — bundle time pe circular nahi banta
// //     const { default: store }    = await import("../../app/store.js");
// //     const { resetAuth }         = await import("../redux/authSlice.js");
// //     store.dispatch(resetAuth());
// //   } catch {
// //     // Store unavailable — sirf localStorage clear karo
// //     localStorage.removeItem("accessToken");
// //   }

// //   window.location.replace("/login");
// // };

// // // ── Response interceptor ──────────────────────────────────────────────────────
// // api.interceptors.response.use(
// //   (res) => res,
// //   async (error) => {
// //     const orig   = error.config;
// //     const status = error.response?.status;

// //     // Refresh route pe 401 → seedha logout — infinite loop rokne ke liye
// //     if (status === 401 && orig.url?.includes("/auth/refresh-token")) {
// //       forceLogout();
// //       return Promise.reject(error);
// //     }

// //     // Yeh routes pe retry kabhi mat karo
// //     const skipRoutes = [
// //       "/auth/login",
// //       "/auth/register",
// //       "/auth/forgot-password",
// //       "/auth/verify-otp",
// //       "/auth/google",
// //     ];
// //     const isSkip = skipRoutes.some((r) => orig.url?.includes(r));

// //     if (status === 401 && !orig._retry && !isSkip) {

// //       // Agar refresh already chal raha hai toh queue mein daalo
// //       if (isRefreshing) {
// //         return new Promise((resolve, reject) => {
// //           failedQueue.push({ resolve, reject });
// //         })
// //           .then(() => api(orig))
// //           .catch((err) => Promise.reject(err));
// //       }

// //       orig._retry  = true;
// //       isRefreshing = true;

// //       try {
// //         // Silent refresh — httpOnly cookie automatically send hogi
// //         await axios.post(
// //           `${api.defaults.baseURL}/auth/refresh-token`,
// //           {},
// //           { withCredentials: true },
// //         );

// //         // Refresh successful — sab pending requests retry karo
// //         processQueue(null);

// //         // Original failed request bhi retry karo
// //         return api(orig);

// //       } catch (refreshErr) {
// //         processQueue(refreshErr);
// //         forceLogout();
// //         return Promise.reject(refreshErr);
// //       } finally {
// //         isRefreshing = false;
// //       }
// //     }

// //     return Promise.reject(error);
// //   },
// // );

// // export const saveConsentAPI = async (consentData) => {
// //   const response = await api.post("/consent", consentData);
// //   return response.data;
// // };

// // export const getConsentAPI = async (sessionId) => {
// //   try {
// //     const response = await api.get(`/consent/${sessionId}`);
// //     return response.data;
// //   } catch (error) {
// //     if (error.response?.status === 404) return null;
// //     throw error;
// //   }
// // };

// // export default api;



// import axios from "axios";

// const api = axios.create({
//   baseURL: import.meta.env.VITE_SERVER_URL || "http://localhost:9080/api/v2",
//   withCredentials: true,
// });

// api.interceptors.request.use(
//   (config) => {
//     config.headers["x-platform"] = "web";
//     return config;
//   },
//   (error) => Promise.reject(error),
// );

// let isRefreshing  = false;
// let isLoggingOut  = false;
// let failedQueue   = [];

// const processQueue = (error) => {
//   failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
//   failedQueue = [];
// };

// const forceLogout = () => {
//   if (isLoggingOut) return;
//   isLoggingOut = true;
//   isRefreshing = false;
//   processQueue(new Error("Session expired"));
//   failedQueue = [];

//   // App.jsx wala listener sun'ega — React cleanly logout karega
//   window.dispatchEvent(new CustomEvent("auth:logout"));
// };

// api.interceptors.response.use(
//   (res) => res,
//   async (error) => {
//     const orig   = error.config;
//     const status = error.response?.status;

//     // Refresh route pe 401 → seedha logout
//     if (status === 401 && orig.url?.includes("/auth/refresh-token")) {
//       forceLogout();
//       return Promise.reject(error);
//     }

//     // Yeh routes pe retry kabhi mat karo
//     const skipRoutes = [
//       "/auth/login",
//       "/auth/register",
//       "/auth/forgot-password",
//       "/auth/verify-otp",
//       "/auth/google",
//       "/auth/me",       // ← fetchMe pe retry mat karo — infinite loop rokta hai
//     ];
//     const isSkip = skipRoutes.some((r) => orig.url?.includes(r));

//     if (status === 401 && !orig._retry && !isSkip) {

//       if (isRefreshing) {
//         return new Promise((resolve, reject) => {
//           failedQueue.push({ resolve, reject });
//         })
//           .then(() => api(orig))
//           .catch((err) => Promise.reject(err));
//       }

//       orig._retry  = true;
//       isRefreshing = true;

//       try {
//         await axios.post(
//           `${api.defaults.baseURL}/auth/refresh-token`,
//           {},
//           { withCredentials: true },
//         );
//         processQueue(null);
//         isRefreshing = false;
//         return api(orig);
//       } catch (refreshErr) {
//         isRefreshing = false;
//         processQueue(refreshErr);
//         forceLogout();
//         return Promise.reject(refreshErr);
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