import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../services/api";
import { togglePostLike, addComment, recordPostView } from "./postSlice";

const BASE = "/explore";

// ─────────────────────────────────────────────
//  Thunks
// ─────────────────────────────────────────────

// 1. Explore posts fetch (first load)
export const fetchExplorePosts = createAsyncThunk(
  "explore/fetchExplorePosts",
  async ({ type = "all", limit = 24 } = {}, { rejectWithValue }) => {
    try {
      const res = await api.get(`${BASE}/posts`, { params: { type, limit } });
      return res.data.data; // { posts, nextCursor, hasMore, count }
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch explore posts."
      );
    }
  }
);

// 2. Load more posts (infinite scroll)
export const fetchMoreExplorePosts = createAsyncThunk(
  "explore/fetchMoreExplorePosts",
  async ({ cursor, type = "all", limit = 24 }, { rejectWithValue }) => {
    try {
      const res = await api.get(`${BASE}/posts`, {
        params: { cursor, type, limit },
      });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to load more posts."
      );
    }
  }
);

// 3. Search posts
export const searchExplorePosts = createAsyncThunk(
  "explore/searchExplorePosts",
  async ({ q, limit = 20 }, { rejectWithValue }) => {
    try {
      const res = await api.get(`${BASE}/search`, { params: { q, limit } });
      return { ...res.data.data, query: q };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Search failed."
      );
    }
  }
);

// 4. Load more search results
export const fetchMoreSearchPosts = createAsyncThunk(
  "explore/fetchMoreSearchPosts",
  async ({ q, cursor, limit = 20 }, { rejectWithValue }) => {
    try {
      const res = await api.get(`${BASE}/search`, {
        params: { q, cursor, limit },
      });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to load more results."
      );
    }
  }
);

// ─────────────────────────────────────────────
//  Slice
// ─────────────────────────────────────────────
const exploreSlice = createSlice({
  name: "explore",
  initialState: {
    posts:       [],
    nextCursor:  null,
    hasMore:     true,
    activeType:  "all",    // current filter tab

    // Search
    searchQuery:   "",
    searchPosts:   [],
    searchCursor:  null,
    searchHasMore: false,
    isSearchMode:  false,

    // Loading states
    loading:          false,
    loadingMore:      false,
    searchLoading:    false,
    searchLoadingMore: false,
    error:            null,
  },

  reducers: {
    setActiveType(state, action) {
      state.activeType = action.payload;
      // Tab change hone par posts reset karo
      state.posts      = [];
      state.nextCursor = null;
      state.hasMore    = true;
    },
    setSearchMode(state, action) {
      state.isSearchMode = action.payload;
      if (!action.payload) {
        // Search band karo — reset search state
        state.searchQuery   = "";
        state.searchPosts   = [];
        state.searchCursor  = null;
        state.searchHasMore = false;
      }
    },
    clearExplore(state) {
      state.posts       = [];
      state.nextCursor  = null;
      state.hasMore     = true;
      state.error       = null;
    },
  },

  extraReducers: (builder) => {
    // ── Fetch Explore Posts ──
    builder
      .addCase(fetchExplorePosts.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(fetchExplorePosts.fulfilled, (state, action) => {
        state.loading    = false;
        state.posts      = action.payload.posts;
        state.nextCursor = action.payload.nextCursor;
        state.hasMore    = action.payload.hasMore;
      })
      .addCase(fetchExplorePosts.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      });

    // ── Load More Explore Posts ──
    builder
      .addCase(fetchMoreExplorePosts.pending, (state) => {
        state.loadingMore = true;
      })
      .addCase(fetchMoreExplorePosts.fulfilled, (state, action) => {
        state.loadingMore = false;
        state.posts       = [...state.posts, ...action.payload.posts];
        state.nextCursor  = action.payload.nextCursor;
        state.hasMore     = action.payload.hasMore;
      })
      .addCase(fetchMoreExplorePosts.rejected, (state, action) => {
        state.loadingMore = false;
        state.error       = action.payload;
      });

    // ── Search Posts ──
    builder
      .addCase(searchExplorePosts.pending, (state) => {
        state.searchLoading = true;
        state.error         = null;
        state.searchPosts   = [];
      })
      .addCase(searchExplorePosts.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.searchPosts   = action.payload.posts;
        state.searchCursor  = action.payload.nextCursor;
        state.searchHasMore = action.payload.hasMore;
        state.searchQuery   = action.payload.query;
        state.isSearchMode  = true;
      })
      .addCase(searchExplorePosts.rejected, (state, action) => {
        state.searchLoading = false;
        state.error         = action.payload;
      });

    // ── Load More Search ──
    builder
      .addCase(fetchMoreSearchPosts.pending, (state) => {
        state.searchLoadingMore = true;
      })
      .addCase(fetchMoreSearchPosts.fulfilled, (state, action) => {
        state.searchLoadingMore = false;
        state.searchPosts       = [...state.searchPosts, ...action.payload.posts];
        state.searchCursor      = action.payload.nextCursor;
        state.searchHasMore     = action.payload.hasMore;
      })
      .addCase(fetchMoreSearchPosts.rejected, (state, action) => {
        state.searchLoadingMore = false;
        state.error             = action.payload;
      });
      // ── Like — optimistic update ──
builder
  .addCase(togglePostLike.pending, (state, action) => {
    const { postId } = action.meta.arg;
    const update = (p) => {
      if (p._id !== postId) return p;
      const newLiked = !p.isLiked;
      return { ...p, isLiked: newLiked, likesCount: newLiked ? (p.likesCount||0)+1 : Math.max(0,(p.likesCount||0)-1) };
    };
    state.posts       = state.posts.map(update);
    state.searchPosts = state.searchPosts.map(update);
  })
  .addCase(togglePostLike.fulfilled, (state, action) => {
    const { postId, liked, likesCount } = action.payload;
    const update = (p) => p._id !== postId ? p : { ...p, isLiked: liked, likesCount };
    state.posts       = state.posts.map(update);
    state.searchPosts = state.searchPosts.map(update);
  })
  .addCase(togglePostLike.rejected, (state, action) => {
    const { postId } = action.meta.arg;
    const rollback = (p) => {
      if (p._id !== postId) return p;
      const rb = !p.isLiked;
      return { ...p, isLiked: rb, likesCount: rb ? (p.likesCount||0)+1 : Math.max(0,(p.likesCount||0)-1) };
    };
    state.posts       = state.posts.map(rollback);
    state.searchPosts = state.searchPosts.map(rollback);
  });

// ── Comment count sync ──
builder.addCase(addComment.fulfilled, (state, action) => {
  const { postId } = action.payload;
  const update = (p) => p._id !== postId ? p : { ...p, commentsCount: (p.commentsCount||0)+1 };
  state.posts       = state.posts.map(update);
  state.searchPosts = state.searchPosts.map(update);
});

// ── View count sync ──
builder.addCase(recordPostView.fulfilled, (state, action) => {
  const postId = action.payload;
  const update = (p) => p._id !== postId ? p : { ...p, viewsCount: (p.viewsCount||0)+1 };
  state.posts       = state.posts.map(update);
  state.searchPosts = state.searchPosts.map(update);
});
  },
  
});

export const { setActiveType, setSearchMode, clearExplore } = exploreSlice.actions;
export default exploreSlice.reducer;