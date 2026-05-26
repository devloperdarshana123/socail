// // client/src/lib/redux/followSlice.js
// import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// import api from "../services/api";

// // ─────────────────────────────────────────────────────────────────────────────
// // Thunks
// // ─────────────────────────────────────────────────────────────────────────────

// // My following list — Messages "People" tab
// export const fetchFollowing = createAsyncThunk(
//   "follow/fetchFollowing",
//   async (userId, { rejectWithValue }) => {
//     try {
//       const { data } = await api.get(`/follow/${userId}/following`);
//       return data.data?.following ?? data.data ?? [];
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Following fetch failed");
//     }
//   }
// );

// // Kisi profile ki followers list
// export const fetchFollowers = createAsyncThunk(
//   "follow/fetchFollowers",
//   async (userId, { rejectWithValue }) => {
//     try {
//       const { data } = await api.get(`/follow/${userId}/followers`);
//       return data.data?.followers ?? data.data ?? [];
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Followers fetch failed");
//     }
//   }
// );

// // Follow karo — optimistic update ke saath
// export const followUser = createAsyncThunk(
//   "follow/followUser",
//   async (targetUserId, { rejectWithValue }) => {
//     try {
//       const { data } = await api.post(`/follow/${targetUserId}`);
//       return { targetUserId, data: data.data };
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Follow failed");
//     }
//   }
// );

// // Unfollow karo
// export const unfollowUser = createAsyncThunk(
//   "follow/unfollowUser",
//   async (targetUserId, { rejectWithValue }) => {
//     try {
//       await api.delete(`/follow/${targetUserId}`);
//       return { targetUserId };
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Unfollow failed");
//     }
//   }
// );

// // ─────────────────────────────────────────────────────────────────────────────
// // Slice
// // ─────────────────────────────────────────────────────────────────────────────

// const followSlice = createSlice({
//   name: "follow",
//   initialState: {
//     // Messages "People" tab ke liye — meri following list
//     following: [],
//     loadingFollowing: false,

//     // Profile page ke liye — kisi bhi user ka
//     profileFollowing: [],
//     profileFollowers: [],
//     loadingProfileFollow: false,

//     // Per-user follow button state
//     // { [userId]: "following" | "not_following" }
//     followStatus: {},

//     error: null,
//   },

//   reducers: {
//     // Optimistic toggle — button instantly respond kare server se pehle
//     optimisticToggleFollow(state, { payload: { userId, isFollowing } }) {
//       state.followStatus[userId] = isFollowing ? "following" : "not_following";
//       if (!isFollowing) {
//         // following list se hata do
//         state.following = state.following.filter((u) => u._id !== userId);
//       }
//     },

//     // Profile page change hone par reset
//     resetProfileFollow(state) {
//       state.profileFollowing = [];
//       state.profileFollowers = [];
//     },

//     clearFollowError(state) {
//       state.error = null;
//     },
//   },

//   extraReducers: (builder) => {
//     // ── fetchFollowing ──
//     builder
//       .addCase(fetchFollowing.pending, (state) => {
//         state.loadingFollowing = true;
//         state.error = null;
//       })
//       .addCase(fetchFollowing.fulfilled, (state, { payload }) => {
//         state.loadingFollowing = false;
//         state.following = payload;
//         // followStatus map bhi update karo
//         payload.forEach((u) => {
//           state.followStatus[u._id] = "following";
//         });
//       })
//       .addCase(fetchFollowing.rejected, (state, { payload }) => {
//         state.loadingFollowing = false;
//         state.error = payload;
//       });

//     // ── fetchFollowers ──
//     builder
//       .addCase(fetchFollowers.pending, (state) => {
//         state.loadingProfileFollow = true;
//       })
//       .addCase(fetchFollowers.fulfilled, (state, { payload }) => {
//         state.loadingProfileFollow = false;
//         state.profileFollowers = payload;
//       })
//       .addCase(fetchFollowers.rejected, (state) => {
//         state.loadingProfileFollow = false;
//       });

//     // ── followUser ──
//     builder
//       .addCase(followUser.fulfilled, (state, { payload: { targetUserId } }) => {
//         state.followStatus[targetUserId] = "following";
//         // authSlice ka followingCount update separately dispatch hoga
//       })
//       .addCase(followUser.rejected, (state, { payload, meta }) => {
//         // Revert optimistic update on failure
//         state.followStatus[meta.arg] = "not_following";
//         state.error = payload;
//       });

//     // ── unfollowUser ──
//     builder
//       .addCase(unfollowUser.fulfilled, (state, { payload: { targetUserId } }) => {
//         state.followStatus[targetUserId] = "not_following";
//         state.following = state.following.filter((u) => u._id !== targetUserId);
//       })
//       .addCase(unfollowUser.rejected, (state, { payload, meta }) => {
//         // Revert optimistic update on failure
//         state.followStatus[meta.arg] = "following";
//         state.error = payload;
//       });
//   },
// });

// export const {
//   optimisticToggleFollow,
//   resetProfileFollow,
//   clearFollowError,
// } = followSlice.actions;

// export default followSlice.reducer;

// // ── Selectors ────────────────────────────────────────────────────────────────
// export const selectFollowing        = (s) => s.follow?.following        ?? [];
// export const selectLoadingFollowing = (s) => s.follow?.loadingFollowing ?? false;
// export const selectFollowStatus     = (userId) => (s) => s.follow?.followStatus[userId] ?? "not_following";
// export const selectProfileFollowers = (s) => s.follow?.profileFollowers ?? [];
// export const selectProfileFollowing = (s) => s.follow?.profileFollowing ?? [];




// client/src/lib/redux/followSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../services/api";

// ─────────────────────────────────────────────────────────────────────────────
// Thunks
// ─────────────────────────────────────────────────────────────────────────────

// My following list — Messages "People" tab
export const fetchFollowing = createAsyncThunk(
  "follow/fetchFollowing",
  async ({ userId, afterId } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ limit: 20 });
      if (afterId) params.set("afterId", afterId);
      const { data } = await api.get(`/follow/${userId}/following?${params}`);
      // Backend: { success, data: [...users], nextCursor }
      return {
        items:      Array.isArray(data.data) ? data.data : [],
        nextCursor: data.nextCursor ?? null,
        append:     !!afterId, // true = infinite scroll append, false = fresh load
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Following fetch failed");
    }
  }
);

// Kisi profile ki followers list
export const fetchFollowers = createAsyncThunk(
  "follow/fetchFollowers",
  async ({ userId, afterId } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ limit: 20 });
      if (afterId) params.set("afterId", afterId);
      const { data } = await api.get(`/follow/${userId}/followers?${params}`);
      return {
        items:      Array.isArray(data.data) ? data.data : [],
        nextCursor: data.nextCursor ?? null,
        append:     !!afterId,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Followers fetch failed");
    }
  }
);

// Follow status for a single user — drives the follow button
export const fetchFollowStatus = createAsyncThunk(
  "follow/fetchFollowStatus",
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/follow/${userId}/status`);
      // Backend: { success, status: "none"|"pending"|"accepted"|"self", isFollowing }
      return { userId, status: data.status, isFollowing: data.isFollowing ?? false };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Status fetch failed");
    }
  }
);

// Follow karo — optimistic update ke saath
export const followUser = createAsyncThunk(
  "follow/followUser",
  async (targetUserId, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/follow/${targetUserId}`);
      // Backend: { success, status: "accepted"|"pending", message }
      return { targetUserId, status: data.status };
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

// Incoming follow requests (private account)
export const fetchFollowRequests = createAsyncThunk(
  "follow/fetchFollowRequests",
  async ({ afterId } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ limit: 20 });
      if (afterId) params.set("afterId", afterId);
      const { data } = await api.get(`/follow/requests?${params}`);
      return {
        items:      Array.isArray(data.data) ? data.data : [],
        nextCursor: data.nextCursor ?? null,
        append:     !!afterId,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Requests fetch failed");
    }
  }
);

// Accept a follow request
export const acceptFollowRequest = createAsyncThunk(
  "follow/acceptFollowRequest",
  async (followerId, { rejectWithValue }) => {
    try {
      await api.patch(`/follow/requests/${followerId}/accept`);
      return { followerId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Accept failed");
    }
  }
);

// Reject a follow request
export const rejectFollowRequest = createAsyncThunk(
  "follow/rejectFollowRequest",
  async (followerId, { rejectWithValue }) => {
    try {
      await api.delete(`/follow/requests/${followerId}/reject`);
      return { followerId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Reject failed");
    }
  }
);

// Mutual followers between viewer and a profile
export const fetchMutualFollowers = createAsyncThunk(
  "follow/fetchMutualFollowers",
  async ({ userId, limit = 6 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/follow/${userId}/mutual?limit=${limit}`);
      return {
        userId,
        items: Array.isArray(data.data) ? data.data : [],
        count: data.count ?? 0,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Mutual fetch failed");
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────────────────────────────────────

const followSlice = createSlice({
  name: "follow",
  initialState: {
    // Messages "People" tab — my following list
    following:          [],
    followingCursor:    null,
    followingHasMore:   false,
    loadingFollowing:   false,

    // Profile page — currently viewed user
    profileFollowers:      [],
    profileFollowersCursor: null,
    profileFollowersHasMore: false,
    profileFollowing:      [],
    profileFollowingCursor: null,
    profileFollowingHasMore: false,
    loadingProfileFollow:  false,

    // Per-user follow button state
    // { [userId]: "none" | "pending" | "accepted" | "self" }
    followStatus: {},

    // Incoming follow requests
    followRequests:       [],
    followRequestsCursor: null,
    followRequestsHasMore: false,
    loadingRequests:      false,

    // Mutual followers cache — { [userId]: { items, count } }
    mutuals: {},

    error: null,
  },

  reducers: {
    // Optimistic toggle — button responds instantly before server confirms
    optimisticToggleFollow(state, { payload: { userId, currentStatus } }) {
      if (currentStatus === "accepted") {
        state.followStatus[userId] = "none";
        state.following = state.following.filter((u) => u._id !== userId && u._id !== userId.toString());
      } else {
        // Will become "pending" or "accepted" — server confirms in fulfilled
        state.followStatus[userId] = "pending";
      }
    },

    // Profile page change — reset profile lists
    resetProfileFollow(state) {
      state.profileFollowing       = [];
      state.profileFollowingCursor = null;
      state.profileFollowingHasMore = false;
      state.profileFollowers       = [];
      state.profileFollowersCursor = null;
      state.profileFollowersHasMore = false;
    },

    clearFollowError(state) {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    // ── fetchFollowing ──────────────────────────────────────────────────────
    builder
      .addCase(fetchFollowing.pending, (state) => {
        state.loadingFollowing = true;
        state.error = null;
      })
      .addCase(fetchFollowing.fulfilled, (state, { payload }) => {
        state.loadingFollowing = false;
        if (payload.append) {
          state.following = [...state.following, ...payload.items];
        } else {
          state.following = payload.items;
          // Seed followStatus map from fresh list
          payload.items.forEach((u) => {
            state.followStatus[u._id] = "accepted";
          });
        }
        state.followingCursor  = payload.nextCursor;
        state.followingHasMore = !!payload.nextCursor;
      })
      .addCase(fetchFollowing.rejected, (state, { payload }) => {
        state.loadingFollowing = false;
        state.error = payload;
      });

    // ── fetchFollowers ──────────────────────────────────────────────────────
    builder
      .addCase(fetchFollowers.pending, (state) => {
        state.loadingProfileFollow = true;
      })
      .addCase(fetchFollowers.fulfilled, (state, { payload }) => {
        state.loadingProfileFollow = false;
        if (payload.append) {
          state.profileFollowers = [...state.profileFollowers, ...payload.items];
        } else {
          state.profileFollowers = payload.items;
        }
        state.profileFollowersCursor  = payload.nextCursor;
        state.profileFollowersHasMore = !!payload.nextCursor;
      })
      .addCase(fetchFollowers.rejected, (state) => {
        state.loadingProfileFollow = false;
      });

    // ── fetchFollowStatus ───────────────────────────────────────────────────
    builder.addCase(fetchFollowStatus.fulfilled, (state, { payload }) => {
      state.followStatus[payload.userId] = payload.status;
    });

    // ── followUser ──────────────────────────────────────────────────────────
    builder
      .addCase(followUser.fulfilled, (state, { payload }) => {
        // Server confirms actual status — "accepted" (public) or "pending" (private)
        state.followStatus[payload.targetUserId] = payload.status;
      })
      .addCase(followUser.rejected, (state, { payload, meta }) => {
        // Revert optimistic update on failure
        state.followStatus[meta.arg] = "none";
        state.error = payload;
      });

    // ── unfollowUser ────────────────────────────────────────────────────────
    builder
      .addCase(unfollowUser.fulfilled, (state, { payload }) => {
        state.followStatus[payload.targetUserId] = "none";
        state.following = state.following.filter(
          (u) => u._id !== payload.targetUserId && u._id?.toString() !== payload.targetUserId
        );
      })
      .addCase(unfollowUser.rejected, (state, { payload, meta }) => {
        // Revert optimistic update
        state.followStatus[meta.arg] = "accepted";
        state.error = payload;
      });

    // ── fetchFollowRequests ─────────────────────────────────────────────────
    builder
      .addCase(fetchFollowRequests.pending, (state) => {
        state.loadingRequests = true;
      })
      .addCase(fetchFollowRequests.fulfilled, (state, { payload }) => {
        state.loadingRequests = false;
        if (payload.append) {
          state.followRequests = [...state.followRequests, ...payload.items];
        } else {
          state.followRequests = payload.items;
        }
        state.followRequestsCursor  = payload.nextCursor;
        state.followRequestsHasMore = !!payload.nextCursor;
      })
      .addCase(fetchFollowRequests.rejected, (state) => {
        state.loadingRequests = false;
      });

    // ── acceptFollowRequest ─────────────────────────────────────────────────
    builder.addCase(acceptFollowRequest.fulfilled, (state, { payload }) => {
      // Remove from pending list
      state.followRequests = state.followRequests.filter(
        (r) => r.follower?._id !== payload.followerId &&
               r.follower?._id?.toString() !== payload.followerId
      );
    });

    // ── rejectFollowRequest ─────────────────────────────────────────────────
    builder.addCase(rejectFollowRequest.fulfilled, (state, { payload }) => {
      state.followRequests = state.followRequests.filter(
        (r) => r.follower?._id !== payload.followerId &&
               r.follower?._id?.toString() !== payload.followerId
      );
    });

    // ── fetchMutualFollowers ────────────────────────────────────────────────
    builder.addCase(fetchMutualFollowers.fulfilled, (state, { payload }) => {
      state.mutuals[payload.userId] = {
        items: payload.items,
        count: payload.count,
      };
    });
  },
});

export const {
  optimisticToggleFollow,
  resetProfileFollow,
  clearFollowError,
} = followSlice.actions;

export default followSlice.reducer;

// ─────────────────────────────────────────────────────────────────────────────
// Selectors
// ─────────────────────────────────────────────────────────────────────────────
export const selectFollowing            = (s) => s.follow?.following            ?? [];
export const selectFollowingHasMore     = (s) => s.follow?.followingHasMore     ?? false;
export const selectFollowingCursor      = (s) => s.follow?.followingCursor      ?? null;
export const selectLoadingFollowing     = (s) => s.follow?.loadingFollowing     ?? false;

export const selectProfileFollowers     = (s) => s.follow?.profileFollowers     ?? [];
export const selectProfileFollowersHasMore = (s) => s.follow?.profileFollowersHasMore ?? false;
export const selectProfileFollowersCursor  = (s) => s.follow?.profileFollowersCursor  ?? null;

export const selectProfileFollowing     = (s) => s.follow?.profileFollowing     ?? [];
export const selectProfileFollowingHasMore = (s) => s.follow?.profileFollowingHasMore ?? false;
export const selectProfileFollowingCursor  = (s) => s.follow?.profileFollowingCursor  ?? null;

export const selectLoadingProfileFollow = (s) => s.follow?.loadingProfileFollow ?? false;

// Follow button — "none" | "pending" | "accepted" | "self"
export const selectFollowStatus         = (userId) => (s) => s.follow?.followStatus[userId] ?? "none";
export const selectIsFollowing          = (userId) => (s) => s.follow?.followStatus[userId] === "accepted";
export const selectIsPending            = (userId) => (s) => s.follow?.followStatus[userId] === "pending";

export const selectFollowRequests       = (s) => s.follow?.followRequests       ?? [];
export const selectFollowRequestsHasMore = (s) => s.follow?.followRequestsHasMore ?? false;
export const selectFollowRequestsCursor = (s) => s.follow?.followRequestsCursor ?? null;
export const selectLoadingRequests      = (s) => s.follow?.loadingRequests      ?? false;

export const selectMutuals              = (userId) => (s) => s.follow?.mutuals[userId] ?? { items: [], count: 0 };