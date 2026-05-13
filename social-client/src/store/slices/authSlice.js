import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// ── Async Thunks ──────────────────────────────────────────

export const registerUser = createAsyncThunk(
  "auth/register",
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/register", formData);
    localStorage.setItem("erosocial_token", data.accessToken);
      localStorage.setItem("erosocial_user", JSON.stringify(data.user));
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Registration failed!");
    }
  }
);


export const googleLogin = createAsyncThunk(
  "auth/googleLogin",
  async ({ idToken }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/google", { idToken }); // ← field name must match backend
      localStorage.setItem("erosocial_token", data.accessToken);
      localStorage.setItem("erosocial_user", JSON.stringify(data.user));
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Google login failed!");
    }
  }
);
export const loginUser = createAsyncThunk(
  "auth/login",
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/login", formData);
      localStorage.setItem("erosocial_token", data.accessToken);
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
  post:[],
  singlePost:null,
  message:null,
  success:false,
  
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
      state.token = action.payload.accessToken;
      localStorage.setItem("erosocial_token", action.payload.accessToken);
      
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
        state.token = action.payload.accessToken;
      })
      .addCase(registerUser.rejected,  (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      });

      builder
  .addCase(googleLogin.pending,   (state) => { state.loading = true; state.error = null; })
  .addCase(googleLogin.fulfilled, (state, action) => {
    state.loading = false;
    state.user  = action.payload.user;
    state.token = action.payload.accessToken;
  })
  .addCase(googleLogin.rejected,  (state, action) => {
    state.loading = false;
    state.error   = action.payload;
  });
    // Login
    builder
      .addCase(loginUser.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user  = action.payload.user;
        state.token = action.payload.accessToken;
      })
      .addCase(loginUser.rejected,  (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      });
    }
});

export const { updateUser, clearError, setCredentials , logout } = authSlice.actions;
export default authSlice.reducer;