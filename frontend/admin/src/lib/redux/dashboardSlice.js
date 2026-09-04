// src/redux/slices/dashboardSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import adminApi from "../../services/api"; // adjust path as needed

// ─── Async Thunks ────────────────────────────────────────────────────────────

export const fetchDashboardStats = createAsyncThunk(
  "dashboard/fetchStats",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get("/admin/dashboard/stats");
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch stats");
    }
  }
);

export const fetchUserGrowth = createAsyncThunk(
  "dashboard/fetchUserGrowth",
  async ({ period = "6months" } = {}, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get("/admin/dashboard/user-growth", {
        params: { period },
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch user growth");
    }
  }
);

export const fetchPostGrowth = createAsyncThunk(
  "dashboard/fetchPostGrowth",
  async ({ period = "6months" } = {}, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get("/admin/dashboard/post-growth", {
        params: { period },
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch post growth");
    }
  }
);

export const fetchEngagementTrend = createAsyncThunk(
  "dashboard/fetchEngagementTrend",
  async ({ period = "7days" } = {}, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get("/admin/dashboard/engagement", {
        params: { period },
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch engagement");
    }
  }
);

export const fetchTopPosts = createAsyncThunk(
  "dashboard/fetchTopPosts",
  async ({ limit = 5 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get("/admin/dashboard/top-posts", {
        params: { limit },
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch top posts");
    }
  }
);

export const fetchHourlyActivity = createAsyncThunk(
  "dashboard/fetchHourlyActivity",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get("/admin/dashboard/hourly-activity");
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch hourly activity");
    }
  }
);

// Fetch everything at once
export const fetchAllDashboardData = createAsyncThunk(
  "dashboard/fetchAll",
  async (_, { dispatch }) => {
    await Promise.allSettled([
      dispatch(fetchDashboardStats()),
      dispatch(fetchUserGrowth()),
      dispatch(fetchPostGrowth()),
      dispatch(fetchEngagementTrend()),
      dispatch(fetchTopPosts()),
      dispatch(fetchHourlyActivity()),
    ]);
  }
);

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState = {
  stats: {
    data: null,
    loading: false,
    error: null,
  },
  userGrowth: {
    data: [],
    loading: false,
    error: null,
    period: "6months",
  },
  postGrowth: {
    data: [],
    loading: false,
    error: null,
    period: "6months",
  },
  engagementTrend: {
    data: [],
    loading: false,
    error: null,
    period: "7days",
  },
  topPosts: {
    data: [],
    loading: false,
    error: null,
  },
  hourlyActivity: {
    data: [],
    loading: false,
    error: null,
  },
  lastRefreshed: null,
  globalLoading: false,
};

// ─── Slice ────────────────────────────────────────────────────────────────────

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    setUserGrowthPeriod(state, action) {
      state.userGrowth.period = action.payload;
    },
    setPostGrowthPeriod(state, action) {
      state.postGrowth.period = action.payload;
    },
    setEngagementPeriod(state, action) {
      state.engagementTrend.period = action.payload;
    },
    resetDashboard() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    // fetchAllDashboardData
    builder
      .addCase(fetchAllDashboardData.pending, (state) => {
        state.globalLoading = true;
      })
      .addCase(fetchAllDashboardData.fulfilled, (state) => {
        state.globalLoading = false;
        state.lastRefreshed = new Date().toISOString();
      })
      .addCase(fetchAllDashboardData.rejected, (state) => {
        state.globalLoading = false;
      });

    // fetchDashboardStats
    builder
      .addCase(fetchDashboardStats.pending, (state) => {
        state.stats.loading = true;
        state.stats.error = null;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.stats.loading = false;
        state.stats.data = action.payload;
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.stats.loading = false;
        state.stats.error = action.payload;
      });

    // fetchUserGrowth
    builder
      .addCase(fetchUserGrowth.pending, (state) => {
        state.userGrowth.loading = true;
        state.userGrowth.error = null;
      })
      .addCase(fetchUserGrowth.fulfilled, (state, action) => {
        state.userGrowth.loading = false;
        state.userGrowth.data = action.payload;
      })
      .addCase(fetchUserGrowth.rejected, (state, action) => {
        state.userGrowth.loading = false;
        state.userGrowth.error = action.payload;
      });

    // fetchPostGrowth
    builder
      .addCase(fetchPostGrowth.pending, (state) => {
        state.postGrowth.loading = true;
        state.postGrowth.error = null;
      })
      .addCase(fetchPostGrowth.fulfilled, (state, action) => {
        state.postGrowth.loading = false;
        state.postGrowth.data = action.payload;
      })
      .addCase(fetchPostGrowth.rejected, (state, action) => {
        state.postGrowth.loading = false;
        state.postGrowth.error = action.payload;
      });

    // fetchEngagementTrend
    builder
      .addCase(fetchEngagementTrend.pending, (state) => {
        state.engagementTrend.loading = true;
        state.engagementTrend.error = null;
      })
      .addCase(fetchEngagementTrend.fulfilled, (state, action) => {
        state.engagementTrend.loading = false;
        state.engagementTrend.data = action.payload;
      })
      .addCase(fetchEngagementTrend.rejected, (state, action) => {
        state.engagementTrend.loading = false;
        state.engagementTrend.error = action.payload;
      });

    // fetchTopPosts
    builder
      .addCase(fetchTopPosts.pending, (state) => {
        state.topPosts.loading = true;
        state.topPosts.error = null;
      })
      .addCase(fetchTopPosts.fulfilled, (state, action) => {
        state.topPosts.loading = false;
        state.topPosts.data = action.payload;
      })
      .addCase(fetchTopPosts.rejected, (state, action) => {
        state.topPosts.loading = false;
        state.topPosts.error = action.payload;
      });

    // fetchHourlyActivity
    builder
      .addCase(fetchHourlyActivity.pending, (state) => {
        state.hourlyActivity.loading = true;
        state.hourlyActivity.error = null;
      })
      .addCase(fetchHourlyActivity.fulfilled, (state, action) => {
        state.hourlyActivity.loading = false;
        state.hourlyActivity.data = action.payload;
      })
      .addCase(fetchHourlyActivity.rejected, (state, action) => {
        state.hourlyActivity.loading = false;
        state.hourlyActivity.error = action.payload;
      });
  },
});

export const {
  setUserGrowthPeriod,
  setPostGrowthPeriod,
  setEngagementPeriod,
  resetDashboard,
} = dashboardSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectDashboardStats = (state) => state.dashboard.stats;
export const selectUserGrowth = (state) => state.dashboard.userGrowth;
export const selectPostGrowth = (state) => state.dashboard.postGrowth;
export const selectEngagementTrend = (state) => state.dashboard.engagementTrend;
export const selectTopPosts = (state) => state.dashboard.topPosts;
export const selectHourlyActivity = (state) => state.dashboard.hourlyActivity;
export const selectLastRefreshed = (state) => state.dashboard.lastRefreshed;
export const selectGlobalLoading = (state) => state.dashboard.globalLoading;

export default dashboardSlice.reducer;