

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../services/api";

// ─────────────────────────────────────────────
//  Thunks
// ─────────────────────────────────────────────

export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async (formData, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/register", formData);
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Registration failed",
      );
    }
  },
);

export const resendOtp = createAsyncThunk(
  "auth/resendOtp",
  async ({ userId, purpose }, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/resend-otp", { userId, purpose });
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to resend OTP",
      );
    }
  },
);

export const verifyOtp = createAsyncThunk(
  "auth/verifyOtp",
  async ({ userId, purpose, otp }, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/verify-otp", { userId, purpose, otp });
      return res.data;
    } catch (err) {
      return rejectWithValue({
        message: err.response?.data?.message || "OTP verification failed",
        remainingAttempts: err.response?.data?.remainingAttempts ?? null,
      });
    }
  },
);


export const googleLogin = createAsyncThunk(
  "auth/googleLogin",
  async (idToken, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/google", { idToken });
      return data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Google sign-in failed"
      );
    }
  }
);

export const fetchMe = createAsyncThunk(
  "auth/fetchMe",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/auth/me");
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch user",
      );
    }
  },
);

export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async (formData, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/login", formData);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Login failed");
    }
  },
);

export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { rejectWithValue }) => {
    try {
      await api.post("/auth/logout");
      return true;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Logout failed");
    }
  },
);

export const fetchUsernameSuggestions = createAsyncThunk(
  "auth/fetchUsernameSuggestions",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/onboarding/username/suggestions");
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch suggestions",
      );
    }
  },
);

export const checkUsernameAvailability = createAsyncThunk(
  "auth/checkUsernameAvailability",
  async (username, { rejectWithValue }) => {
    try {
      const res = await api.get(`/onboarding/username/check/${username}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Check failed");
    }
  },
);

export const setUsername = createAsyncThunk(
  "auth/setUsername",
  async (username, { rejectWithValue }) => {
    try {
      const res = await api.patch("/onboarding/username", { username });
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to set username",
      );
    }
  },
);


export const forgotPassword = createAsyncThunk(
  "auth/forgotPassword",
  async (email, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/forgot-password", { email });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed");
    }
  }
);

export const resetPassword = createAsyncThunk(
  "auth/resetPassword",
  async ({ newPassword }, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/reset-password", { newPassword });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed");
    }
  }
);


export const followUser = createAsyncThunk(
  "auth/followUser",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await api.post(`/follow/${userId}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed");
    }
  }
);

export const unfollowUser = createAsyncThunk(
  "auth/unfollowUser",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/follow/${userId}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed");
    }
  }
);


// ─────────────────────────────────────────────
//  Initial State
// ─────────────────────────────────────────────

const initialState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,

  pendingUserId: null,
  pendingPurpose: null,
  nextRoute: null,

  register: { loading: false, error: null, success: false },
  login: { loading: false, error: null, success: false },
  otp: { loading: false, error: null, success: false, remainingAttempts: null },
  fetchMe: { loading: false, error: null },
  resend: { loading: false, error: null, success: false },
  onboarding: {
    suggestions: [],
    suggestionsLoading: false,
    checkLoading: false,
    checkResult: null,
    setLoading: false,
    error: null,
  },
};

// ─────────────────────────────────────────────
//  Slice
// ─────────────────────────────────────────────

const authSlice = createSlice({
  name: "auth",
  initialState,

  reducers: {
    setAccessToken: (state, action) => {
      state.accessToken = action.payload;
      // localStorage sync
      if (action.payload) {
        localStorage.setItem("accessToken", action.payload);
      } else {
        localStorage.removeItem("accessToken");
      }
    },
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    clearRegisterState: (state) => {
      state.register = { loading: false, error: null, success: false };
    },
    clearLoginState: (state) => {
      state.login = { loading: false, error: null, success: false };
    },
    clearOtpState: (state) => {
      state.otp = {
        loading: false,
        error: null,
        success: false,
        remainingAttempts: null,
      };
    },
    clearResendState: (state) => {
      state.resend = { loading: false, error: null, success: false };
    },
    clearNextRoute: (state) => {
      state.nextRoute = null;
    },
    clearOnboardingState: (state) => {
      state.onboarding = {
        suggestions: [],
        suggestionsLoading: false,
        checkLoading: false,
        checkResult: null,
        setLoading: false,
        error: null,
      };
    },
    resetAuth: () => {
      localStorage.removeItem("accessToken");
      return initialState;
    },
updateUserAvatar(state, action) {
  if (state.user) state.user.avatar = action.payload;
},
updateUserCoverPhoto(state, action) {
  if (state.user) state.user.coverPhoto = action.payload;
},
setPending(state, action) {
  state.pendingUserId = action.payload.userId;
  state.pendingPurpose = action.payload.purpose;
},

  },

  extraReducers: (builder) => {
    // ── Register ──
    builder
      .addCase(registerUser.pending, (state) => {
        state.register.loading = true;
        state.register.error = null;
        state.register.success = false;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.register.loading = false;
        state.register.success = true;
        state.pendingUserId = action.payload.data?.userId || null;
        state.pendingPurpose = action.payload.data?.purpose || null;
        state.nextRoute = action.payload.data?.nextRoute || "/verify-otp";
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.register.loading = false;
        state.register.error = action.payload;
      });

    // ── Verify OTP ──
    builder
      .addCase(verifyOtp.pending, (state) => {
        state.otp.loading = true;
        state.otp.error = null;
        state.otp.success = false;
        state.otp.remainingAttempts = null;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.otp.loading = false;
        state.otp.success = true;
        state.accessToken = action.payload.accessToken || null;
        state.user = action.payload.data || null;
        state.isAuthenticated = !!action.payload.data;
        state.nextRoute = action.payload.nextRoute || "/feed";
        state.pendingUserId = null;
        state.pendingPurpose = null;
        // localStorage sync
      if (action.payload.accessToken) {
  localStorage.setItem("accessToken", action.payload.accessToken);
}
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.otp.loading = false;
        state.otp.error =
          action.payload?.message ||
          action.payload ||
          "OTP verification failed";
        state.otp.remainingAttempts = action.payload?.remainingAttempts ?? null;
      });

    // ── fetchMe ──
    builder
      .addCase(fetchMe.pending, (state) => {
        state.fetchMe.loading = true;
        state.fetchMe.error = null;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
  state.fetchMe.loading = false;
  state.user = action.payload.data?.user || action.payload.data || null;
  state.isAuthenticated = !!state.user;
})
    .addCase(fetchMe.rejected, (state, action) => {
  state.fetchMe.loading  = false;
  state.fetchMe.error    = action.payload;
  state.user             = null;
  state.isAuthenticated  = false;
  localStorage.removeItem("accessToken"); // ← stale token clear
})

    // ── Login ──
    builder
      .addCase(loginUser.pending, (state) => {
        state.login.loading = true;
        state.login.error = null;
        state.login.success = false;
      })
     .addCase(loginUser.fulfilled, (state, action) => {
        state.login.loading = false;
        state.login.success = true;
        state.accessToken = action.payload.accessToken || null;
        state.user = action.payload.data || null;
        state.isAuthenticated = !!action.payload.data;
        state.nextRoute = action.payload.nextRoute || "/feed";
        // localStorage sync — null/undefined guard
const token = action.payload.accessToken;
if (token && token !== "null" && token !== "undefined") {
  localStorage.setItem("accessToken", token);
} else {
  localStorage.removeItem("accessToken");
}
        // Agar onboarding incomplete hai toh pendingUserId set karo
        if (action.payload.nextRoute === "/verify-otp") {
          state.pendingUserId = action.payload.data?._id || null;
          state.pendingPurpose =
            action.payload.data?.authProvider === "phone"
              ? "mobile_verify"
              : "email_verify";
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.login.loading = false;
        state.login.error = action.payload;
      });

    // ── Resend OTP ──
    builder
      .addCase(resendOtp.pending, (state) => {
        state.resend.loading = true;
        state.resend.error = null;
        state.resend.success = false;
      })
      .addCase(resendOtp.fulfilled, (state) => {
        state.resend.loading = false;
        state.resend.success = true;
      })
      .addCase(resendOtp.rejected, (state, action) => {
        state.resend.loading = false;
        state.resend.error = action.payload;
      });

    // ── Logout ──
    builder
      .addCase(logoutUser.fulfilled, () => {
        localStorage.removeItem("accessToken");
        return initialState;
      })
      .addCase(logoutUser.rejected, () => {
        // Backend fail hone par bhi frontend clean karo
        localStorage.removeItem("accessToken");
        return initialState;
      });

    // ── Username Suggestions ──
    builder
      .addCase(fetchUsernameSuggestions.pending, (state) => {
        state.onboarding.suggestionsLoading = true;
        state.onboarding.error = null;
      })
      .addCase(fetchUsernameSuggestions.fulfilled, (state, action) => {
        state.onboarding.suggestionsLoading = false;
        state.onboarding.suggestions = action.payload.data?.suggestions || [];
      })
      .addCase(fetchUsernameSuggestions.rejected, (state, action) => {
        state.onboarding.suggestionsLoading = false;
        state.onboarding.error = action.payload;
      });

    // ── Check Username ──
    builder
      .addCase(checkUsernameAvailability.pending, (state) => {
        state.onboarding.checkLoading = true;
        state.onboarding.checkResult = null;
      })
      .addCase(checkUsernameAvailability.fulfilled, (state, action) => {
        state.onboarding.checkLoading = false;
        state.onboarding.checkResult = action.payload.data || null;
      })
      .addCase(checkUsernameAvailability.rejected, (state, action) => {
        state.onboarding.checkLoading = false;
        state.onboarding.error = action.payload;
      });

    // ── Set Username ──
    builder
      .addCase(setUsername.pending, (state) => {
        state.onboarding.setLoading = true;
        state.onboarding.error = null;
      })
      .addCase(setUsername.fulfilled, (state, action) => {
        state.onboarding.setLoading = false;
        state.accessToken = action.payload.accessToken || null;
        state.user = action.payload.data || null;
        state.isAuthenticated = !!action.payload.data;
        state.nextRoute = action.payload.nextRoute || "/feed";
        // localStorage sync
        if (action.payload.accessToken) {
  localStorage.setItem("accessToken", action.payload.accessToken);
}
      })
      .addCase(setUsername.rejected, (state, action) => {
        state.onboarding.setLoading = false;
        state.onboarding.error = action.payload;
      });


      // ── Follow User ──
builder
  .addCase(followUser.fulfilled, (state) => {
    if (state.user) {
      state.user.followingCount = (state.user.followingCount || 0) + 1;
    }
  });

// ── Unfollow User ──
builder
  .addCase(unfollowUser.fulfilled, (state) => {
    if (state.user) {
      state.user.followingCount = Math.max(0, (state.user.followingCount || 0) - 1);
    }
  });

  // ── Google Login ──
builder
  .addCase(googleLogin.pending, (state) => {
    state.login.loading = true;
    state.login.error   = null;
  })
  .addCase(googleLogin.fulfilled, (state, action) => {
    state.login.loading   = false;
    state.login.success   = true;
    state.accessToken     = action.payload.accessToken || null;
    state.user            = action.payload.data || null;
    state.isAuthenticated = !!action.payload.data;
    state.nextRoute       = action.payload.nextRoute || "/feed";

    const token = action.payload.accessToken;
    if (token && token !== "null" && token !== "undefined") {
      localStorage.setItem("accessToken", token);
    } else {
      localStorage.removeItem("accessToken");
    }
  })
  .addCase(googleLogin.rejected, (state, action) => {
    state.login.loading = false;
    state.login.error   = action.payload;
  });

  },
});

export const {
  setAccessToken,
  setUser,
  setPending,  
  clearRegisterState,
  clearLoginState,
  clearOtpState,
  clearResendState,
  clearNextRoute,
  clearOnboardingState,
  resetAuth,
  updateUserAvatar,      // ✅
  updateUserCoverPhoto,
} = authSlice.actions;

export default authSlice.reducer;