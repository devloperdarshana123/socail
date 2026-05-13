import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import authReducer from "../lib/redux/authSlice";
import postReducer from "../lib/redux/postSlice";
import userProfileReducer from "../lib/redux/userprofileslice";
import settingsReducer from "../lib/redux/Settingslice";
import exploreReducer from "../lib/redux/Exploreslice";
import storyReducer from "../lib/redux/storySlice";
// ─────────────────────────────────────────────
//  Storage — SSR safe, no import needed
//  Manually banao taaki koi bundler issue na ho
// ─────────────────────────────────────────────

const storage = {
  getItem: (key) => {
    try {
      return Promise.resolve(localStorage.getItem(key));
    } catch {
      return Promise.resolve(null);
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      return Promise.resolve();
    } catch {
      return Promise.resolve();
    }
  },
};

// ─────────────────────────────────────────────
//  Persist Config
//
//  Persist honge:   user, accessToken, isAuthenticated
//  Persist NAHI:    pendingUserId, pendingPurpose,
//                   nextRoute, loading states
// ─────────────────────────────────────────────

const authPersistConfig = {
  key: "auth",
  storage,
  whitelist: ["user", "isAuthenticated"],
};

const userProfilePersistConfig = {
  key: "userProfile",
  storage,
  whitelist: ["avatar", "coverPhoto"],  // sirf URLs save honge
};
const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  posts: postReducer,
  userProfile: persistReducer(userProfilePersistConfig, userProfileReducer),
  // userProfile: userProfileReducer,
  // future slices: notifications, etc.
  settings: settingsReducer,
  explore: exploreReducer,
  stories: storyReducer,
});

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
