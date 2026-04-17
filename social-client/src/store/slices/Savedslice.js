import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// ── Fetch Saved Posts ─────────────────────────────────────
export const fetchSavedPosts = createAsyncThunk(
  "saved/fetchSavedPosts",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/posts/saved");
      return data.posts || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Saved posts load nahi hue!");
    }
  }
);

// ── Unsave Post ───────────────────────────────────────────
export const unsavePost = createAsyncThunk(
  "saved/unsavePost",
  async (postId, { rejectWithValue }) => {
    try {
      await api.put(`/posts/${postId}/save`);
      return postId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Unsave failed!");
    }
  }
);

// ── Like Saved Post ───────────────────────────────────────
export const likeSavedPost = createAsyncThunk(
  "saved/likeSavedPost",
  async ({ postId, userId }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/posts/${postId}/like`);
      return { postId, isLiked: data.isLiked, userId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Like failed!");
    }
  }
);

// ── Slice ─────────────────────────────────────────────────
const savedSlice = createSlice({
  name: "saved",
  initialState: {
    posts:   [],
    loading: false,
    error:   null,
  },
  reducers: {},
  extraReducers: (builder) => {

    // fetchSavedPosts
    builder
      .addCase(fetchSavedPosts.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(fetchSavedPosts.fulfilled, (state, action) => { state.loading = false; state.posts = action.payload; })
      .addCase(fetchSavedPosts.rejected,  (state, action) => { state.loading = false; state.error = action.payload; });

    // unsavePost — remove from list
    builder
      .addCase(unsavePost.fulfilled, (state, action) => {
        state.posts = state.posts.filter((p) => p._id !== action.payload);
      });

    // likeSavedPost
    builder
      .addCase(likeSavedPost.fulfilled, (state, action) => {
        const { postId, isLiked, userId } = action.payload;
        const post = state.posts.find((p) => p._id === postId);
        if (post) {
          post.likes = isLiked
            ? [...post.likes, userId]
            : post.likes.filter((id) => id !== userId);
        }
      });
  },
});

export default savedSlice.reducer;