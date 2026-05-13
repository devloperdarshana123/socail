
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// ── Fetch My Profile ──────────────────────────────────────
export const fetchMyProfile = createAsyncThunk(
  "profile/fetchMyProfile",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/auth/me");
      return data.user || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Profile load nahi hui!");
    }
  }
);

// ── Fetch Other User Profile ──────────────────────────────
export const fetchUserProfile = createAsyncThunk(
  "profile/fetchUserProfile",
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/auth/users/${userId}`);
      return data.user || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "User profile load nahi hui!");
    }
  }
);

// ── Fetch My Posts ────────────────────────────────────────
export const fetchMyPosts = createAsyncThunk(
  "profile/fetchMyPosts",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/posts/my");
      return data.posts || data || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Posts load nahi hue!");
    }
  }
);

// ── Fetch User Posts ──────────────────────────────────────
export const fetchUserPosts = createAsyncThunk(
  "profile/fetchUserPosts",
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/posts/user/${userId}`);
      return data.posts || data || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "User posts load nahi hue!");
    }
  }
);

// ── Fetch Followers ───────────────────────────────────────
export const fetchFollowers = createAsyncThunk(
  "profile/fetchFollowers",
  async (userId, { rejectWithValue }) => {
    try {
      const url = userId ? `/follow/${userId}/followers` : "/follow/followers";
       console.log("fetchFollowers URL:", url); 
      const { data } = await api.get(url);
       console.log("fetchFollowers response:", data);
      return data.followers || [];
    } catch (err) {
      console.error("fetchFollowers ERROR:", err.response?.data, err.message);
      return rejectWithValue("Followers Not Loaded!");
    }
  }
);

// ── Fetch Following ───────────────────────────────────────
export const fetchFollowing = createAsyncThunk(
  "profile/fetchFollowing",
  async (userId, { rejectWithValue }) => {
    try {
      const url = userId ? `/follow/${userId}/following` : "/follow/following";
      const { data } = await api.get(url);
      return data.following || [];
    } catch (err) {
      return rejectWithValue("Following load nahi hue!");
    }
  }
);

// ── Toggle Follow Request / Unfollow ─────────────────────
// isPending: true  → cancel follow request
// isUnfollow: true → unfollow (already following)
// default          → send follow request
export const toggleFollow = createAsyncThunk(
  "profile/toggleFollow",
  async ({ userId }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/follow/${userId}/toggle`);
      return { userId, isFollowing: data.isFollowing };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Follow action failed!");
    }
  }
);

// ── Slice ─────────────────────────────────────────────────
const profileSlice = createSlice({
  name: "profile",
  initialState: {
    profileUser:     null,
    posts:           [],
    followers:       [],
    following:       [],
    pendingRequests: [],
    loading:         false,
    postsLoading:    false,
    error:           null,
  },
  reducers: {
    clearProfile: (state) => {
      state.profileUser = null;
      state.posts       = [];
      state.followers   = [];
      state.following   = [];
    },
  },
  extraReducers: (builder) => {

    // fetchMyProfile
    builder
      .addCase(fetchMyProfile.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(fetchMyProfile.fulfilled, (state, action) => { state.loading = false; state.profileUser = action.payload; })
      .addCase(fetchMyProfile.rejected,  (state, action) => { state.loading = false; state.error = action.payload; });

    // fetchUserProfile
    builder
      .addCase(fetchUserProfile.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(fetchUserProfile.fulfilled, (state, action) => { state.loading = false; state.profileUser = action.payload; })
      .addCase(fetchUserProfile.rejected,  (state, action) => { state.loading = false; state.error = action.payload; });

    // fetchMyPosts / fetchUserPosts
    builder
      .addCase(fetchMyPosts.pending,    (state) => { state.postsLoading = true; })
      .addCase(fetchMyPosts.fulfilled,  (state, action) => { state.postsLoading = false; state.posts = action.payload; })
      .addCase(fetchMyPosts.rejected,   (state) => { state.postsLoading = false; })
      .addCase(fetchUserPosts.pending,  (state) => { state.postsLoading = true; })
      .addCase(fetchUserPosts.fulfilled,(state, action) => { state.postsLoading = false; state.posts = action.payload; })
      .addCase(fetchUserPosts.rejected, (state) => { state.postsLoading = false; });

    // fetchFollowers / fetchFollowing
    builder
      .addCase(fetchFollowers.fulfilled, (state, action) => { state.followers = action.payload; })
      .addCase(fetchFollowing.fulfilled, (state, action) => { state.following = action.payload; });

    // toggleFollow (send request / cancel / unfollow)
    builder
     .addCase(toggleFollow.fulfilled, (state, action) => {
  const { userId, isFollowing } = action.payload;
  if (isFollowing) {
    state.pendingRequests.push(userId);
  } else {
    state.pendingRequests = state.pendingRequests.filter((id) => id !== userId);
    state.following = state.following.filter((u) => u._id !== userId);
  }
});
  },
});

export const { clearProfile } = profileSlice.actions;
export default profileSlice.reducer;