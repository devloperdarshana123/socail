import { configureStore } from "@reduxjs/toolkit";
import adminAuthReducer from "../lib/redux/AdminauthSlice";

import usersReducer     from "../lib/redux/usersSlice";  

// ─────────────────────────────────────────────
//  Admin Redux Store
// ─────────────────────────────────────────────

const store = configureStore({
  reducer: {
    adminAuth: adminAuthReducer,
    users:     usersReducer, 
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Date objects ignore karo serializable check mein
        ignoredActionPaths: ["payload.createdAt", "payload.updatedAt"],
        ignoredPaths: ["adminAuth.admin.createdAt", "adminAuth.admin.updatedAt"],
      },
    }),

  devTools: import.meta.env.MODE !== "production",
});

// ── Interceptor logout event listener ────────
// adminApi.js mein "admin:logout" event fire hota hai jab refresh fail ho
import { forceLogout } from "../lib/redux/AdminauthSlice";

window.addEventListener("admin:logout", () => {
  store.dispatch(forceLogout());
});

export default store;