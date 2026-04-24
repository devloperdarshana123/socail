

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// ── Fetch Feed ────────────────────────────────────────────
export const fetchFeed = createAsyncThunk(
  "feed/fetchFeed",
  async ({ page = 1, limit = 10 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/posts/feed?page=${page}&limit=${limit}`);
      return { posts: data.posts, pagination: data.pagination, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Feed load nahi hui!");
    }
  }
);

// ── Fetch My Posts (Profile page ke liye) ────────────────
export const fetchMyPosts = createAsyncThunk(
  "feed/fetchMyPosts",
  async (userId, { rejectWithValue }) => {
    try {
      const url = userId ? `/posts/user/${userId}` : "/posts/my";
      const { data } = await api.get(url);
      return data.posts || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Posts load nahi hue!");
    }
  }
);

// ── Fetch Stats ───────────────────────────────────────────
export const fetchStats = createAsyncThunk(
  "feed/fetchStats",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/auth/stats");
      return {
        posts:     data?.posts     ?? data?.stats?.posts     ?? 0,
        followers: data?.followers ?? data?.stats?.followers ?? 0,
        following: data?.following ?? data?.stats?.following ?? 0,
      };
    } catch (err) {
      return rejectWithValue("Stats load nahi hue!");
    }
  }
);

// ── Fetch Suggestions ─────────────────────────────────────
export const fetchSuggestions = createAsyncThunk(
  "feed/fetchSuggestions",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/auth/users/suggestions");
      return data.users || [];
    } catch (err) {
      return rejectWithValue("Suggestions load nahi hue!");
    }
  }
);

// ── Create Post ───────────────────────────────────────────
export const createPost = createAsyncThunk(
  "feed/createPost",
  async ({ caption, image, video }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      if (caption) formData.append("caption", caption);
      if (image)   formData.append("media", image);
      if (video)   formData.append("media", video); 
      const { data } = await api.post("/posts", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.post;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Post nahi bani!");
    }
  }
);

// ── Like Post ─────────────────────────────────────────────
export const likePost = createAsyncThunk(
  "feed/likePost",
  async ({ postId, userId }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/posts/${postId}/like`);
      return { postId, isLiked: data.isLiked, userId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Like failed!");
    }
  }
);

// ── Comment on Post ───────────────────────────────────────
export const commentPost = createAsyncThunk(
  "feed/commentPost",
  async ({ postId, text }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/posts/${postId}/comment`, { text });
      return { postId, comment: data.comment };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Comment failed!");
    }
  }
);

// ── Save / Unsave Post ────────────────────────────────────
export const savePost = createAsyncThunk(
  "feed/savePost",
  async (postId, { rejectWithValue }) => {
    try {
      await api.put(`/posts/${postId}/save`);
      return postId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Save failed!");
    }
  }
);

// ── Delete Post ───────────────────────────────────────────
export const deletePost = createAsyncThunk(
  "feed/deletePost",
  async (postId, { rejectWithValue }) => {
    try {
      await api.delete(`/posts/${postId}`);
      return postId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Delete failed!");
    }
  }
);

// ── Suspend Post (Admin) ──────────────────────────────────
export const suspendPost = createAsyncThunk(
  "feed/suspendPost",
  async (postId, { rejectWithValue }) => {
    try {
      await api.put(`/posts/${postId}/suspend`, { reason: "Suspended by Admin" });
      return postId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Suspend failed!");
    }
  }
);

// ── Fetch Saved Post IDs ──────────────────────────────────
export const fetchSavedPostIds = createAsyncThunk(
  "feed/fetchSavedPostIds",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/posts/saved");
      return (data.posts || []).map((p) => p._id);
    } catch (err) {
      return rejectWithValue("Saved posts load nahi hue!");
    }
  }
);

// ── Slice ─────────────────────────────────────────────────
const feedSlice = createSlice({
  name: "feed",
  initialState: {
    posts:        [],
    myPosts:      [],          // ← Profile page ke liye
    suggestions:  [],
    savedPostIds: [],
    stats:        { posts: 0, followers: 0, following: 0 },
    page:         1,
    hasNext:      false,
    loading:      false,
    myPostsLoading: false,     // ← Profile page loading
    creating:     false,
    error:        null,
  },
  reducers: {
    toggleSavedLocal: (state, action) => {
      const id = action.payload;
      if (state.savedPostIds.includes(id)) {
        state.savedPostIds = state.savedPostIds.filter((sid) => sid !== id);
      } else {
        state.savedPostIds.push(id);
      }
    },
  },
  extraReducers: (builder) => {

    // fetchFeed
    builder
      .addCase(fetchFeed.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchFeed.fulfilled, (state, action) => {
        state.loading = false;
        state.posts   = action.payload.page === 1
          ? action.payload.posts
          : [...state.posts, ...action.payload.posts];
        state.hasNext = action.payload.pagination?.hasNext || false;
        state.page    = action.payload.page;
      })
      .addCase(fetchFeed.rejected, (state, action) => { state.loading = false; state.error = action.payload; });

    // fetchMyPosts
    builder
      .addCase(fetchMyPosts.pending,   (state) => { state.myPostsLoading = true; state.error = null; })
      .addCase(fetchMyPosts.fulfilled, (state, action) => {
        state.myPostsLoading = false;
        state.myPosts = action.payload;
      })
      .addCase(fetchMyPosts.rejected,  (state, action) => { state.myPostsLoading = false; state.error = action.payload; });

    // fetchStats
    builder
      .addCase(fetchStats.fulfilled, (state, action) => { state.stats = action.payload; });

    // fetchSuggestions
    builder
      .addCase(fetchSuggestions.fulfilled, (state, action) => { state.suggestions = action.payload; });

    // createPost
    builder
      .addCase(createPost.pending,   (state) => { state.creating = true; state.error = null; })
      .addCase(createPost.fulfilled, (state, action) => {
        state.creating = false;
        if (action.payload) {
          state.posts.unshift(action.payload);
          state.myPosts.unshift(action.payload); // profile mein bhi add ho
        }
        state.stats.posts += 1;
      })
      .addCase(createPost.rejected, (state, action) => { state.creating = false; state.error = action.payload; });

    // likePost
    builder
      .addCase(likePost.fulfilled, (state, action) => {
        const { postId, isLiked, userId } = action.payload;
        // feed posts update
        const post = state.posts.find((p) => p._id === postId);
        if (post) {
          post.likes = isLiked
            ? [...post.likes, userId]
            : post.likes.filter((id) => id !== userId);
        }
        // myPosts bhi update
        const myPost = state.myPosts.find((p) => p._id === postId);
        if (myPost) {
          myPost.likes = isLiked
            ? [...myPost.likes, userId]
            : myPost.likes.filter((id) => id !== userId);
        }
      });

    // commentPost
    builder
      .addCase(commentPost.fulfilled, (state, action) => {
        const { postId, comment } = action.payload;
        const post = state.posts.find((p) => p._id === postId);
        if (post) post.comments.push(comment);
        const myPost = state.myPosts.find((p) => p._id === postId);
        if (myPost) myPost.comments.push(comment);
      });

    // savePost
    builder
      .addCase(savePost.fulfilled, (state, action) => {
        const id = action.payload;
        if (state.savedPostIds.includes(id)) {
          state.savedPostIds = state.savedPostIds.filter((sid) => sid !== id);
        } else {
          state.savedPostIds.push(id);
        }
      });

    // deletePost
    builder
      .addCase(deletePost.fulfilled, (state, action) => {
        state.posts   = state.posts.filter((p) => p._id !== action.payload);
        state.myPosts = state.myPosts.filter((p) => p._id !== action.payload);
        state.stats.posts = Math.max(0, state.stats.posts - 1);
      });

    // suspendPost
    builder
      .addCase(suspendPost.fulfilled, (state, action) => {
        state.posts   = state.posts.filter((p) => p._id !== action.payload);
        state.myPosts = state.myPosts.filter((p) => p._id !== action.payload);
      });

    // fetchSavedPostIds
    builder
      .addCase(fetchSavedPostIds.fulfilled, (state, action) => {
        state.savedPostIds = action.payload;
      });
  },
});

export const { toggleSavedLocal } = feedSlice.actions;
export default feedSlice.reducer;