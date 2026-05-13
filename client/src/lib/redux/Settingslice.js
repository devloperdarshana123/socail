import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../services/api";

const BASE = "/settings";

// ─────────────────────────────────────────────
//  Thunks
// ─────────────────────────────────────────────

// 1. Logged-in user ka profile fetch karo
export const fetchMyProfile = createAsyncThunk(
  "settings/fetchMyProfile",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get(`${BASE}/me`);
      return res.data; // { success, message, data: { user } }
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch profile."
      );
    }
  }
);

// 2. Profile update karo (fullName, bio, designation)
export const updateProfile = createAsyncThunk(
  "settings/updateProfile",
  async (formData, { rejectWithValue, dispatch }) => {
    try {
const res = await api.patch(`/settings/profile`, formData);
dispatch({ type: "auth/setUser", payload: res.data.data }); // ← .user hata do
return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Profile update failed."
      );
    }
  }
);

// 3. Password update karo
export const updatePassword = createAsyncThunk(
  "settings/updatePassword",
  async ({ oldPassword, newPassword }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`${BASE}/password`, {
        oldPassword,
        newPassword,
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Password update failed."
      );
    }
  }
);

// 4. Account deactivate karo
export const deactivateAccount = createAsyncThunk(
  "settings/deactivateAccount",
  async (_, { rejectWithValue, dispatch }) => {
    try {
      const res = await api.delete(`${BASE}/deactivate`);
      // Auth state clear karo
      dispatch({ type: "auth/resetAuth" });
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Account deactivation failed."
      );
    }
  }
);

// ─────────────────────────────────────────────
//  Slice
// ─────────────────────────────────────────────
const settingSlice = createSlice({
  name: "settings",
  initialState: {
    // Per-action loading states (same pattern as authSlice)
    fetchMe:    { loading: false, error: null },
    profile:    { loading: false, error: null, success: false },
    password:   { loading: false, error: null, success: false },
    deactivate: { loading: false, error: null, success: false },
  },

  reducers: {
    clearProfileState(state) {
      state.profile = { loading: false, error: null, success: false };
    },
    clearPasswordState(state) {
      state.password = { loading: false, error: null, success: false };
    },
    clearDeactivateState(state) {
      state.deactivate = { loading: false, error: null, success: false };
    },
  },

  extraReducers: (builder) => {
    // ── Fetch My Profile ──
    builder
      .addCase(fetchMyProfile.pending, (state) => {
        state.fetchMe.loading = true;
        state.fetchMe.error   = null;
      })
      .addCase(fetchMyProfile.fulfilled, (state) => {
        state.fetchMe.loading = false;
      })
      .addCase(fetchMyProfile.rejected, (state, action) => {
        state.fetchMe.loading = false;
        state.fetchMe.error   = action.payload;
      });

    // ── Update Profile ──
    builder
      .addCase(updateProfile.pending, (state) => {
        state.profile.loading = true;
        state.profile.error   = null;
        state.profile.success = false;
      })
      .addCase(updateProfile.fulfilled, (state) => {
        state.profile.loading = false;
        state.profile.success = true;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.profile.loading = false;
        state.profile.error   = action.payload;
      });

    // ── Update Password ──
    builder
      .addCase(updatePassword.pending, (state) => {
        state.password.loading = true;
        state.password.error   = null;
        state.password.success = false;
      })
      .addCase(updatePassword.fulfilled, (state) => {
        state.password.loading = false;
        state.password.success = true;
      })
      .addCase(updatePassword.rejected, (state, action) => {
        state.password.loading = false;
        state.password.error   = action.payload;
      });

    // ── Deactivate Account ──
    builder
      .addCase(deactivateAccount.pending, (state) => {
        state.deactivate.loading = true;
        state.deactivate.error   = null;
        state.deactivate.success = false;
      })
      .addCase(deactivateAccount.fulfilled, (state) => {
        state.deactivate.loading = false;
        state.deactivate.success = true;
      })
      .addCase(deactivateAccount.rejected, (state, action) => {
        state.deactivate.loading = false;
        state.deactivate.error   = action.payload;
      });
  },
});

export const {
  clearProfileState,
  clearPasswordState,
  clearDeactivateState,
} = settingSlice.actions;

export default settingSlice.reducer;