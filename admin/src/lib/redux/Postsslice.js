
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import adminApi from "../../services/api";

// ── Avatar helper ─────────────────────────────────────────────
const extractAvatar = (avatar) => {
  if (!avatar) return null;
  if (typeof avatar === "string") return avatar;
  return avatar.url ?? avatar.secure_url ?? null;
};

const normalizePost = (p) => ({
  ...p,
  author: p.author
    ? { ...p.author, profilePicture: extractAvatar(p.author.avatar) }
    : null,
});

// ─────────────────────────────────────────────────────────────
//  Thunks
// ─────────────────────────────────────────────────────────────

export const fetchAllPosts = createAsyncThunk(
  "adminPosts/fetchAll",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get("/admin/posts", { params });
      return {
        posts:      (data.data ?? []).map(normalizePost),
        pagination: data.pagination ?? {},
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to fetch posts");
    }
  }
);

export const adminDeletePost = createAsyncThunk(
  "adminPosts/delete",
  async (postId, { rejectWithValue }) => {
    try {
      await adminApi.delete(`/admin/posts/${postId}`);
      return { postId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to delete post");
    }
  }
);

// ─────────────────────────────────────────────────────────────
//  Slice
// ─────────────────────────────────────────────────────────────

const initialState = {
  posts:         [],
  loading:       false,
  error:         null,
  deleteLoading: null,   // postId being deleted
  deleteError:   null,

  // ── Modal state ─────────────────────────────────────────────
  // Stores the post object directly — zero extra API calls needed
  selectedPost:  null,

  pagination: {
    total:      0,
    page:       1,
    limit:      20,
    totalPages: 1,
  },
  filters: {
    type:      "",
    search:    "",
    sortBy:    "createdAt",
    sortOrder: "desc",
    page:      1,
    limit:     20,
  },
};

const adminPostsSlice = createSlice({
  name: "adminPosts",
  initialState,
  reducers: {
    setPostFilters: (state, { payload }) => {
      state.filters = { ...state.filters, ...payload };
    },
    setPostPage: (state, { payload }) => {
      state.filters.page = payload;
    },
    resetPostFilters: (state) => {
      state.filters = initialState.filters;
    },
    clearPostErrors: (state) => {
      state.error       = null;
      state.deleteError = null;
    },

    // ── Modal actions ──────────────────────────────────────────
    // Pass the full post object — no API call needed
    openPostModal: (state, { payload }) => {
      state.selectedPost = payload;
    },
    closePostModal: (state) => {
      state.selectedPost = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchAllPosts
      .addCase(fetchAllPosts.pending, (s) => {
        s.loading = true;
        s.error   = null;
      })
      .addCase(fetchAllPosts.fulfilled, (s, { payload }) => {
        s.loading    = false;
        s.posts      = payload.posts;
        s.pagination = payload.pagination;
      })
      .addCase(fetchAllPosts.rejected, (s, { payload }) => {
        s.loading = false;
        s.error   = payload;
      })

      // adminDeletePost
      .addCase(adminDeletePost.pending, (s, { meta }) => {
        s.deleteLoading = meta.arg;
        s.deleteError   = null;
      })
      .addCase(adminDeletePost.fulfilled, (s, { payload }) => {
        s.deleteLoading    = null;
        s.posts            = s.posts.filter((p) => p._id !== payload.postId);
        s.pagination.total = Math.max(0, (s.pagination.total ?? 1) - 1);
        // Close modal if the deleted post was open
        if (s.selectedPost?._id === payload.postId) s.selectedPost = null;
      })
      .addCase(adminDeletePost.rejected, (s, { payload }) => {
        s.deleteLoading = null;
        s.deleteError   = payload;
      });
  },
});

export const {
  setPostFilters,
  setPostPage,
  resetPostFilters,
  clearPostErrors,
  openPostModal,
  closePostModal,
} = adminPostsSlice.actions;

export default adminPostsSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────
export const selectAdminPosts        = (s) => s.adminPosts.posts;
export const selectAdminPostsLoading = (s) => s.adminPosts.loading;
export const selectAdminPostsError   = (s) => s.adminPosts.error;
export const selectDeleteLoading     = (s) => s.adminPosts.deleteLoading;
export const selectPostsPagination   = (s) => s.adminPosts.pagination;
export const selectPostsFilters      = (s) => s.adminPosts.filters;
export const selectSelectedPost      = (s) => s.adminPosts.selectedPost;