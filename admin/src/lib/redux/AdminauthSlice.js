import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import adminApi from "../../services/api";

// ═════════════════════════════════════════════
//  THUNKS
// ═════════════════════════════════════════════

// ─────────────────────────────────────────────
//  POST /admin/auth/login
// ─────────────────────────────────────────────
export const adminLogin = createAsyncThunk(
  "adminAuth/login",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const res = await adminApi.post("/admin/auth/login", { email, password });
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Login failed",
      );
    }
  },
);

// ─────────────────────────────────────────────
//  GET /admin/auth/me
// ─────────────────────────────────────────────
export const fetchAdminMe = createAsyncThunk(
  "adminAuth/fetchMe",
  async (_, { rejectWithValue }) => {
    try {
      const res = await adminApi.get("/admin/auth/me");
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch admin",
      );
    }
  },
);

// ─────────────────────────────────────────────
//  POST /admin/auth/logout
// ─────────────────────────────────────────────
export const adminLogout = createAsyncThunk(
  "adminAuth/logout",
  async (_, { rejectWithValue }) => {
    try {
      await adminApi.post("/admin/auth/logout");
      return true;
    } catch (err) {
      // Backend fail ho toh bhi frontend clean karo
      return rejectWithValue(
        err.response?.data?.message || "Logout failed",
      );
    }
  },
);

// ═════════════════════════════════════════════
//  INITIAL STATE
// ═════════════════════════════════════════════

const initialState = {
  admin: null,
  isAuthenticated: false,

  login: {
    loading: false,
    error: null,
    success: false,
  },

  fetchMe: {
    loading: false,
    error: null,
    initialized: false,
    initialized: true, // app start pe ek baar fetchMe hoti hai
  },

  logout: {
    loading: false,
    error: null,
  },
};

const loggedOutState = {
  ...initialState,
  fetchMe: { loading: false, error: null, initialized: true },
};

// ═════════════════════════════════════════════
//  SLICE
// ═════════════════════════════════════════════

const adminAuthSlice = createSlice({
  name: "adminAuth",
  initialState,

  reducers: {
    clearLoginState: (state) => {
      state.login = { loading: false, error: null, success: false };
    },

    clearLogoutState: (state) => {
      state.logout = { loading: false, error: null };
    },

    // Interceptor se logout event aane pe
    forceLogout: () => {
      return initialState;
    },

    // Admin data manually update karna ho toh
    setAdmin: (state, action) => {
      state.admin = action.payload;
      state.isAuthenticated = !!action.payload;
    },
  },

  extraReducers: (builder) => {

    // ── Login ─────────────────────────────────
    builder
      .addCase(adminLogin.pending, (state) => {
        state.login.loading = true;
        state.login.error = null;
        state.login.success = false;
      })
      .addCase(adminLogin.fulfilled, (state, action) => {
        state.login.loading = false;
        state.login.success = true;
        state.admin = action.payload.data || null;
        state.isAuthenticated = !!action.payload.data;
      })
      .addCase(adminLogin.rejected, (state, action) => {
        state.login.loading = false;
        state.login.error = action.payload;
        state.isAuthenticated = false;
      });

    // ── Fetch Me ──────────────────────────────
    builder
      .addCase(fetchAdminMe.pending, (state) => {
        state.fetchMe.loading = true;
        state.fetchMe.error = null;
        state.fetchMe.initialized = false;
      })
      .addCase(fetchAdminMe.fulfilled, (state, action) => {
        state.fetchMe.loading = false;
        state.fetchMe.initialized = true;
        state.admin = action.payload.data || null;
        state.isAuthenticated = !!action.payload.data;
      })
      .addCase(fetchAdminMe.rejected, (state, action) => {
        state.fetchMe.loading = false;
        state.fetchMe.initialized = true;
        state.fetchMe.error = action.payload;
        state.admin = null;
        state.isAuthenticated = false;
      });

    // ── Logout ────────────────────────────────
    builder
      .addCase(adminLogout.pending, (state) => {
        state.logout.loading = true;
        state.logout.error = null;
      })
     .addCase(adminLogout.fulfilled, () => loggedOutState)
.addCase(adminLogout.rejected, () => loggedOutState);
  },
});

export const {
  clearLoginState,
  clearLogoutState,
  forceLogout,
  setAdmin,
} = adminAuthSlice.actions;

export default adminAuthSlice.reducer;