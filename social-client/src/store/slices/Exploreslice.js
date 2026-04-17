
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// ── Fetch Explore Posts ───────────────────────────────────
export const fetchTrendingPosts = createAsyncThunk(
  "explore/fetchTrendingPosts",
  async (page = 1, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/posts/explore?page=${page}&limit=10`);
      return { posts: data.posts || [], pagination: data.pagination };
    } catch (err) {
      return rejectWithValue("Explore post not loading !");
    }
  }
);

// ── Fetch Suggested Users ─────────────────────────────────
export const fetchSuggestedUsers = createAsyncThunk(
  "explore/fetchSuggestedUsers",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/auth/users/suggestions");
      return data.users || [];
    } catch (err) {
      return rejectWithValue("Suggested users load nahi hue!");
    }
  }
);

// ── Search Users & Posts ──────────────────────────────────
export const searchAll = createAsyncThunk(
  "explore/searchAll",
  async (query, { rejectWithValue }) => {
    try {
      const [usersRes, postsRes] = await Promise.allSettled([
        api.get(`/users/search?q=${encodeURIComponent(query)}`),
        api.get(`/posts/search?q=${encodeURIComponent(query)}`),
      ]);
      return {
        users: usersRes.status === "fulfilled"
          ? (usersRes.value.data.users || usersRes.value.data || []) : [],
        posts: postsRes.status === "fulfilled"
          ? (postsRes.value.data.posts || postsRes.value.data || []) : [],
      };
    } catch (err) {
      return rejectWithValue("Search kaam nahi kiya!");
    }
  }
);

// ── Like Explore Post ─────────────────────────────────────
export const likeTrendingPost = createAsyncThunk(
  "explore/likeTrendingPost",
  async ({ postId, userId }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/posts/${postId}/like`);
      return { postId, isLiked: data.isLiked, userId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Like failed!");
    }
  }
);

// ── Comment on Explore Post ───────────────────────────────
export const commentTrendingPost = createAsyncThunk(
  "explore/commentTrendingPost",
  async ({ postId, text }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/posts/${postId}/comment`, { text });
      return { postId, comment: data.comment };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Comment failed!");
    }
  }
);

// ── Send / Cancel Follow Request ──────────────────────────
export const toggleFollowRequest = createAsyncThunk(
  "explore/toggleFollowRequest",
  async ({ userId, isPending }, { rejectWithValue }) => {
    try {
      if (isPending) {
        await api.delete(`/follow/${userId}/cancel`);
      } else {
        await api.post(`/follow/${userId}/send`);
      }
      return { userId, isPending };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Request failed!");
    }
  }
);

// ── Fetch Follow Request Count ────────────────────────────
export const fetchFollowRequestCount = createAsyncThunk(
  "explore/fetchFollowRequestCount",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/follow/requests");
      return data.requests?.length || 0;
    } catch {
      return 0;
    }
  }
);

// ── Fetch Sent Follow Requests ────────────────────────────
export const fetchSentFollowRequests = createAsyncThunk(
  "explore/fetchSentFollowRequests",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/follow/sent");
      return data.sentRequests || [];
    } catch {
      return [];
    }
  }
);


// ── Slice ─────────────────────────────────────────────────
const exploreSlice = createSlice({
  name: "explore",
  initialState: {
    trendingPosts:    [],
    explorePage:      1,
    exploreHasNext:   false,
    suggestedUsers:   [],
    searchResults:    { users: [], posts: [] },
    pendingRequests:  [],
    followRequests:   0,
    trendingLoading:  false,
    suggestedLoading: false,
    searching:        false,
    hasSearched:      false,
    error:            null,
  },
  reducers: {
    clearSearch: (state) => {
      state.searchResults = { users: [], posts: [] };
      state.hasSearched   = false;
    },
      incrementFollowRequest: (state) => {
    state.followRequests += 1;
  },
  // ← yeh bhi add karo (jab follow requests page pe jaao toh reset ho)
  resetFollowRequestCount: (state) => {
    state.followRequests = 0;
  },
  },
  extraReducers: (builder) => {

    // fetchTrendingPosts
    builder
      .addCase(fetchTrendingPosts.pending, (state) => {
        state.trendingLoading = true;
        state.error = null;
      })
      .addCase(fetchTrendingPosts.fulfilled, (state, action) => {
        state.trendingLoading = false;
        const { posts, pagination } = action.payload;
        // Page 1 pe replace, baaki pages pe append
        if (action.meta.arg === 1 || action.meta.arg === undefined) {
          state.trendingPosts = posts;
        } else {
          state.trendingPosts = [...state.trendingPosts, ...posts];
        }
        state.exploreHasNext = pagination?.hasNext || false;
        state.explorePage    = pagination?.page    || 1;
      })
      .addCase(fetchTrendingPosts.rejected, (state, action) => {
        state.trendingLoading = false;
        state.error = action.payload;
      });

    // fetchSuggestedUsers
    builder
      .addCase(fetchSuggestedUsers.pending,   (state) => { state.suggestedLoading = true; })
      .addCase(fetchSuggestedUsers.fulfilled, (state, action) => { state.suggestedLoading = false; state.suggestedUsers = action.payload; })
      .addCase(fetchSuggestedUsers.rejected,  (state) => { state.suggestedLoading = false; });

    // searchAll
    builder
      .addCase(searchAll.pending,   (state) => { state.searching = true; state.hasSearched = true; state.error = null; })
      .addCase(searchAll.fulfilled, (state, action) => { state.searching = false; state.searchResults = action.payload; })
      .addCase(searchAll.rejected,  (state, action) => { state.searching = false; state.error = action.payload; });

    // likeTrendingPost
    builder
      .addCase(likeTrendingPost.fulfilled, (state, action) => {
        const { postId, isLiked, userId } = action.payload;
        const post = state.trendingPosts.find((p) => p._id === postId);
        if (post) {
          post.likes = isLiked
            ? [...post.likes, userId]
            : post.likes.filter((id) => id !== userId);
        }
      });

    // commentTrendingPost
    builder
      .addCase(commentTrendingPost.fulfilled, (state, action) => {
        const { postId, comment } = action.payload;
        const post = state.trendingPosts.find((p) => p._id === postId);
        if (post) post.comments.push(comment);
      });

    // toggleFollowRequest
    builder
      .addCase(toggleFollowRequest.fulfilled, (state, action) => {
        const { userId, isPending } = action.payload;
        if (isPending) {
          state.pendingRequests = state.pendingRequests.filter((id) => id !== userId);
        } else {
          state.pendingRequests.push(userId);
        }
      });
      // fetchSentFollowRequests

 // ✅ ISSE REPLACE KARO (sirf middle line badli hai):
builder
  .addCase(fetchSentFollowRequests.fulfilled, (state, action) => {
    state.pendingRequests = action.payload.map((r) =>
      typeof r === "string" ? r : r._id?.toString() || r.toString()
    );
  });

    // fetchFollowRequestCount
    builder
      .addCase(fetchFollowRequestCount.fulfilled, (state, action) => {
        state.followRequests = action.payload;
      });
  },
});

export const { clearSearch, incrementFollowRequest, resetFollowRequestCount } = exploreSlice.actions;
export default exploreSlice.reducer;