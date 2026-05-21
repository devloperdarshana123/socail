// client/src/lib/redux/followSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../services/api";

// ─────────────────────────────────────────────────────────────────────────────
// Thunks
// ─────────────────────────────────────────────────────────────────────────────

// My following list — Messages "People" tab
export const fetchFollowing = createAsyncThunk(
  "follow/fetchFollowing",
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/follow/${userId}/following`);
      return data.data?.following ?? data.data ?? [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Following fetch failed");
    }
  }
);

// Kisi profile ki followers list
export const fetchFollowers = createAsyncThunk(
  "follow/fetchFollowers",
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/follow/${userId}/followers`);
      return data.data?.followers ?? data.data ?? [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Followers fetch failed");
    }
  }
);

// Follow karo — optimistic update ke saath
export const followUser = createAsyncThunk(
  "follow/followUser",
  async (targetUserId, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/follow/${targetUserId}`);
      return { targetUserId, data: data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Follow failed");
    }
  }
);

// Unfollow karo
export const unfollowUser = createAsyncThunk(
  "follow/unfollowUser",
  async (targetUserId, { rejectWithValue }) => {
    try {
      await api.delete(`/follow/${targetUserId}`);
      return { targetUserId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Unfollow failed");
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────────────────────────────────────

const followSlice = createSlice({
  name: "follow",
  initialState: {
    // Messages "People" tab ke liye — meri following list
    following: [],
    loadingFollowing: false,

    // Profile page ke liye — kisi bhi user ka
    profileFollowing: [],
    profileFollowers: [],
    loadingProfileFollow: false,

    // Per-user follow button state
    // { [userId]: "following" | "not_following" }
    followStatus: {},

    error: null,
  },

  reducers: {
    // Optimistic toggle — button instantly respond kare server se pehle
    optimisticToggleFollow(state, { payload: { userId, isFollowing } }) {
      state.followStatus[userId] = isFollowing ? "following" : "not_following";
      if (!isFollowing) {
        // following list se hata do
        state.following = state.following.filter((u) => u._id !== userId);
      }
    },

    // Profile page change hone par reset
    resetProfileFollow(state) {
      state.profileFollowing = [];
      state.profileFollowers = [];
    },

    clearFollowError(state) {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    // ── fetchFollowing ──
    builder
      .addCase(fetchFollowing.pending, (state) => {
        state.loadingFollowing = true;
        state.error = null;
      })
      .addCase(fetchFollowing.fulfilled, (state, { payload }) => {
        state.loadingFollowing = false;
        state.following = payload;
        // followStatus map bhi update karo
        payload.forEach((u) => {
          state.followStatus[u._id] = "following";
        });
      })
      .addCase(fetchFollowing.rejected, (state, { payload }) => {
        state.loadingFollowing = false;
        state.error = payload;
      });

    // ── fetchFollowers ──
    builder
      .addCase(fetchFollowers.pending, (state) => {
        state.loadingProfileFollow = true;
      })
      .addCase(fetchFollowers.fulfilled, (state, { payload }) => {
        state.loadingProfileFollow = false;
        state.profileFollowers = payload;
      })
      .addCase(fetchFollowers.rejected, (state) => {
        state.loadingProfileFollow = false;
      });

    // ── followUser ──
    builder
      .addCase(followUser.fulfilled, (state, { payload: { targetUserId } }) => {
        state.followStatus[targetUserId] = "following";
        // authSlice ka followingCount update separately dispatch hoga
      })
      .addCase(followUser.rejected, (state, { payload, meta }) => {
        // Revert optimistic update on failure
        state.followStatus[meta.arg] = "not_following";
        state.error = payload;
      });

    // ── unfollowUser ──
    builder
      .addCase(unfollowUser.fulfilled, (state, { payload: { targetUserId } }) => {
        state.followStatus[targetUserId] = "not_following";
        state.following = state.following.filter((u) => u._id !== targetUserId);
      })
      .addCase(unfollowUser.rejected, (state, { payload, meta }) => {
        // Revert optimistic update on failure
        state.followStatus[meta.arg] = "following";
        state.error = payload;
      });
  },
});

export const {
  optimisticToggleFollow,
  resetProfileFollow,
  clearFollowError,
} = followSlice.actions;

export default followSlice.reducer;

// ── Selectors ────────────────────────────────────────────────────────────────
export const selectFollowing        = (s) => s.follow?.following        ?? [];
export const selectLoadingFollowing = (s) => s.follow?.loadingFollowing ?? false;
export const selectFollowStatus     = (userId) => (s) => s.follow?.followStatus[userId] ?? "not_following";
export const selectProfileFollowers = (s) => s.follow?.profileFollowers ?? [];
export const selectProfileFollowing = (s) => s.follow?.profileFollowing ?? [];