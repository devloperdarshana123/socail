

// client/src/store.js
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER,
} from "redux-persist";

import authReducer        from "../lib/redux/authSlice";
import postReducer        from "../lib/redux/postSlice";
import userProfileReducer from "../lib/redux/userprofileslice";
import settingsReducer from "../lib/redux/settingSlice";
import exploreReducer  from "../lib/redux/exploreSlice";
import storyReducer       from "../lib/redux/storySlice";
import chatReducer        from "../lib/redux/chatSlice";
import followReducer      from "../lib/redux/followSlice";
import notificationReducer from "../lib/redux/notificationSlice";

// ── SSR-safe localStorage wrapper ────────────────────────────────────────────
const storage = {
  getItem:    (key) => { try { return Promise.resolve(localStorage.getItem(key));    } catch { return Promise.resolve(null);  } },
  setItem:    (key, value) => { try { localStorage.setItem(key, value); return Promise.resolve(true); } catch { return Promise.resolve(false); } },
  removeItem: (key) => { try { localStorage.removeItem(key); return Promise.resolve(); } catch { return Promise.resolve(); } },
};

// ── Persist Configs ───────────────────────────────────────────────────────────

// Auth — sirf token aur user persist karo
const authPersistConfig = {
  key: "auth",
  storage,
  whitelist: ["user", "isAuthenticated", "accessToken"],
};

// Chat — sirf conversations sidebar persist karo
// Messages persist MAT karo — stale data aur memory leak dono avoid hogi
const chatPersistConfig = {
  key: "chat",
  storage,
  whitelist: ["conversations", "totalUnread"],
  // messages, typingUsers, onlineUsers — fresh fetch hogi hamesha
};

const userProfilePersistConfig = {
  key: "userProfile",
  storage,
  whitelist: ["avatarLoading"], // kuch persist nahi
};

// ── Root Reducer ──────────────────────────────────────────────────────────────
const rootReducer = combineReducers({
  auth:        persistReducer(authPersistConfig, authReducer),
  posts:       postReducer,
  userProfile: persistReducer(userProfilePersistConfig, userProfileReducer),
  settings:    settingsReducer,
  explore:     exploreReducer,
  stories:     storyReducer,
  chat:        persistReducer(chatPersistConfig, chatReducer),
  follow:      followReducer,
  notifications: notificationReducer
});

// ── Store ─────────────────────────────────────────────────────────────────────
const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
  devTools: process.env.NODE_ENV !== "production",
});

export const persistor = persistStore(store);
export default store;