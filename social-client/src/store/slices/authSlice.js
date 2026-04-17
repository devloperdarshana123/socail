import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// ── Async Thunks ──────────────────────────────────────────

export const registerUser = createAsyncThunk(
  "auth/register",
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/register", formData);
      localStorage.setItem("erosocial_token", data.token);
      localStorage.setItem("erosocial_user", JSON.stringify(data.user));
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Registration failed!");
    }
  }
);

export const loginUser = createAsyncThunk(
  "auth/login",
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/login", formData);
      localStorage.setItem("erosocial_token", data.token);
      localStorage.setItem("erosocial_user", JSON.stringify(data.user));
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Login failed!");
    }
  }
);

// ── Initial State ─────────────────────────────────────────

const storedUser = localStorage.getItem("erosocial_user");

const initialState = {
  user: storedUser ? JSON.parse(storedUser) : null,
  token: localStorage.getItem("erosocial_token") || null,
  loading: false,
  error: null,
};

// ── Slice ─────────────────────────────────────────────────

const authSlice = createSlice({
  name: "auth",
  initialState,
  // AB KARO:
reducers: {
updateUser: (state, action) => {
  state.user = { ...state.user, ...action.payload };
  localStorage.setItem("erosocial_user", JSON.stringify(state.user));
},
    clearError: (state) => {
      state.error = null;
    },

    // ✅ Yeh naya add kiya
    setCredentials: (state, action) => {
      state.user  = action.payload.user;
      state.token = action.payload.token;
      localStorage.setItem("erosocial_token", action.payload.token);
      localStorage.setItem("erosocial_user", JSON.stringify(action.payload.user));
    },
   logout: (state) => {          // ← YAHAN andar daalo
      state.user  = null;
      state.token = null;
      state.error = null;
      localStorage.removeItem("erosocial_token");
      localStorage.removeItem("erosocial_user");
    }, 
  },
  extraReducers: (builder) => {
    // Register
    builder
      .addCase(registerUser.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user  = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(registerUser.rejected,  (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      });

    // Login
    builder
      .addCase(loginUser.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user  = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(loginUser.rejected,  (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      });
    }
});

export const { updateUser, clearError, setCredentials , logout } = authSlice.actions;
export default authSlice.reducer;