// src/lib/redux/adminSettingsSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import adminApi from "../../services/api";

// ─────────────────────────────────────────────────────────────────────────────
//  Async Thunks
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAdminProfile = createAsyncThunk(
  "adminSettings/fetchProfile",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get("/admin/settings/profile");
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch profile");
    }
  }
);

export const updateAdminProfile = createAsyncThunk(
  "adminSettings/updateProfile",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch("/admin/settings/profile", payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to update profile");
    }
  }
);

// ✅ NEW — avatar upload thunk
export const uploadAdminAvatar = createAsyncThunk(
  "adminSettings/uploadAvatar",
  async (file, { rejectWithValue }) => {
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const { data } = await adminApi.patch("/admin/settings/profile/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.data.avatar; // { url, publicId }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Avatar upload failed");
    }
  }
);

export const changeAdminPassword = createAsyncThunk(
  "adminSettings/changePassword",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch("/admin/settings/password", payload);
      return data.message;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to change password");
    }
  }
);

export const updateNotifications = createAsyncThunk(
  "adminSettings/updateNotifications",
  async ({ notificationsEnabled }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch("/admin/settings/notifications", {
        notificationsEnabled,
      });
      return data.data.notificationsEnabled;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to update notifications");
    }
  }
);

export const fetchAdminSessions = createAsyncThunk(
  "adminSettings/fetchSessions",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get("/admin/settings/sessions");
      return data.data.sessions;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch sessions");
    }
  }
);

export const revokeSession = createAsyncThunk(
  "adminSettings/revokeSession",
  async (sessionId, { rejectWithValue }) => {
    try {
      await adminApi.delete(`/admin/settings/sessions/${sessionId}`);
      return sessionId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to revoke session");
    }
  }
);

export const revokeAllOtherSessions = createAsyncThunk(
  "adminSettings/revokeAllSessions",
  async (_, { dispatch, rejectWithValue }) => {
    try {
      await adminApi.delete("/admin/settings/sessions");
      dispatch(fetchAdminSessions());
      return true;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to revoke sessions");
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
//  Initial State
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  profile: {
    data:            null,
    loading:         false,
    saving:          false,
    avatarUploading: false,
    error:           null,
  },
  password: {
    saving:  false,
    success: false,
    error:   null,
  },
  notifications: {
    enabled: true,
    saving:  false,
    error:   null,
  },
  sessions: {
    data:        [],
    loading:     false,
    revoking:    null,   // sessionId currently being revoked
    revokingAll: false,
    error:       null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Slice
// ─────────────────────────────────────────────────────────────────────────────

const adminSettingsSlice = createSlice({
  name: "adminSettings",
  initialState,
  reducers: {
    clearPasswordSuccess(state) {
      state.password.success = false;
      state.password.error   = null;
    },
    clearErrors(state) {
      state.profile.error       = null;
      state.password.error      = null;
      state.notifications.error = null;
      state.sessions.error      = null;
    },
    // Optimistic toggle — rollback on rejected
    setNotificationsOptimistic(state, { payload }) {
      state.notifications.enabled = payload;
    },
    resetSettings() {
      return initialState;
    },
  },

  extraReducers: (builder) => {

    // ── fetchAdminProfile ───────────────────────────────────────────────────
    builder
      .addCase(fetchAdminProfile.pending, (state) => {
        state.profile.loading = true;
        state.profile.error   = null;
      })
      .addCase(fetchAdminProfile.fulfilled, (state, { payload }) => {
        state.profile.loading       = false;
        state.profile.data          = payload;
        state.notifications.enabled = payload.notificationsEnabled ?? true;
      })
      .addCase(fetchAdminProfile.rejected, (state, { payload }) => {
        state.profile.loading = false;
        state.profile.error   = payload;
      });

    // ── updateAdminProfile ──────────────────────────────────────────────────
    builder
      .addCase(updateAdminProfile.pending, (state) => {
        state.profile.saving = true;
        state.profile.error  = null;
      })
      .addCase(updateAdminProfile.fulfilled, (state, { payload }) => {
        state.profile.saving = false;
        state.profile.data   = { ...state.profile.data, ...payload };
      })
      .addCase(updateAdminProfile.rejected, (state, { payload }) => {
        state.profile.saving = false;
        state.profile.error  = payload;
      });

    // ── uploadAdminAvatar ───────────────────────────────────────────────────
    builder
      .addCase(uploadAdminAvatar.pending, (state) => {
        state.profile.avatarUploading = true;
        state.profile.error           = null;
      })
      .addCase(uploadAdminAvatar.fulfilled, (state, { payload }) => {
        state.profile.avatarUploading = false;
        if (state.profile.data) state.profile.data.avatar = payload;
      })
      .addCase(uploadAdminAvatar.rejected, (state, { payload }) => {
        state.profile.avatarUploading = false;
        state.profile.error           = payload;
      });

    // ── changeAdminPassword ─────────────────────────────────────────────────
    builder
      .addCase(changeAdminPassword.pending, (state) => {
        state.password.saving  = true;
        state.password.success = false;
        state.password.error   = null;
      })
      .addCase(changeAdminPassword.fulfilled, (state) => {
        state.password.saving  = false;
        state.password.success = true;
      })
      .addCase(changeAdminPassword.rejected, (state, { payload }) => {
        state.password.saving  = false;
        state.password.success = false;
        state.password.error   = payload;
      });

    // ── updateNotifications ─────────────────────────────────────────────────
    builder
      .addCase(updateNotifications.pending, (state) => {
        state.notifications.saving = true;
        state.notifications.error  = null;
      })
      .addCase(updateNotifications.fulfilled, (state, { payload }) => {
        state.notifications.saving  = false;
        state.notifications.enabled = payload;
      })
      .addCase(updateNotifications.rejected, (state, { payload }) => {
        state.notifications.saving  = false;
        state.notifications.error   = payload;
        // Rollback optimistic toggle
        state.notifications.enabled = !state.notifications.enabled;
      });

    // ── fetchAdminSessions ──────────────────────────────────────────────────
    builder
      .addCase(fetchAdminSessions.pending, (state) => {
        state.sessions.loading = true;
        state.sessions.error   = null;
      })
      .addCase(fetchAdminSessions.fulfilled, (state, { payload }) => {
        state.sessions.loading = false;
        state.sessions.data    = payload;
      })
      .addCase(fetchAdminSessions.rejected, (state, { payload }) => {
        state.sessions.loading = false;
        state.sessions.error   = payload;
      });

    // ── revokeSession ───────────────────────────────────────────────────────
    builder
      .addCase(revokeSession.pending, (state, { meta }) => {
        state.sessions.revoking = meta.arg;
        state.sessions.error    = null;
      })
      .addCase(revokeSession.fulfilled, (state, { payload: sessionId }) => {
        state.sessions.revoking = null;
        state.sessions.data     = state.sessions.data.filter((s) => s.id !== sessionId);
      })
      .addCase(revokeSession.rejected, (state, { payload }) => {
        state.sessions.revoking = null;
        state.sessions.error    = payload;
      });

    // ── revokeAllOtherSessions ──────────────────────────────────────────────
    builder
      .addCase(revokeAllOtherSessions.pending, (state) => {
        state.sessions.revokingAll = true;
        state.sessions.error       = null;
      })
      .addCase(revokeAllOtherSessions.fulfilled, (state) => {
        state.sessions.revokingAll = false;
      })
      .addCase(revokeAllOtherSessions.rejected, (state, { payload }) => {
        state.sessions.revokingAll = false;
        state.sessions.error       = payload;
      });
  },
});

export const {
  clearPasswordSuccess,
  clearErrors,
  setNotificationsOptimistic,
  resetSettings,
} = adminSettingsSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
//  Selectors — key matches store: `setting`
// ─────────────────────────────────────────────────────────────────────────────
export const selectAdminProfile       = (s) => s.setting.profile;
export const selectAdminPassword      = (s) => s.setting.password;
export const selectAdminNotifications = (s) => s.setting.notifications;
export const selectAdminSessions      = (s) => s.setting.sessions;

export default adminSettingsSlice.reducer;