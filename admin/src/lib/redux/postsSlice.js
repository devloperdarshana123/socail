
import { createSlice, createAsyncThunk, createSelector } from "@reduxjs/toolkit";
import adminApi from "../../services/api";

// ── Normalizer ────────────────────────────────────────────────────────────────

const extractAvatar = (avatar) => {
  if (!avatar) return null;
  if (typeof avatar === "string") return avatar;
  return avatar.url ?? avatar.secure_url ?? null;
};

// FIX: was only checking author.avatar — if backend sends author.profilePicture
// directly (no avatar key), the field would stay as the raw object instead of
// being extracted to a URL string.
const normalizePost = (p) => ({
  ...p,
  author: p.author
    ? {
        ...p.author,
        profilePicture: extractAvatar(p.author.avatar ?? p.author.profilePicture),
      }
    : null,
});

// ── Safe pagination helper ────────────────────────────────────────────────────
// FIX: fetchAllPosts.fulfilled was doing s.pagination = payload.pagination with
// no fallbacks. If the backend omits any field, downstream selectors get
// undefined and crash. Always merge with safe defaults.
const normalizePagination = (raw = {}) => ({
  total:      raw.total      ?? 0,
  page:       raw.page       ?? 1,
  limit:      raw.limit      ?? 20,
  totalPages: raw.totalPages ?? 1,
});

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchAllPosts = createAsyncThunk(
  "adminPosts/fetchAll",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get("/admin/posts", { params });
      return {
        posts:      (data.data ?? []).map(normalizePost),
        pagination: normalizePagination(data.pagination),
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to fetch posts");
    }
  }
);

export const adminDeletePost = createAsyncThunk(
  "adminPosts/delete",
  async ({ postId, reason }, { rejectWithValue }) => {
    try {
      await adminApi.patch(`/admin/posts/${postId}/remove`, { reason });
      return { postId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to delete post");
    }
  }
);

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState = {
  posts:         [],
  loading:       false,
  error:         null,
  deleteLoading: null,   // postId currently being deleted
  deleteError:   null,
  selectedPost:  null,   // post object open in modal — zero extra API calls
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

// ── Slice ─────────────────────────────────────────────────────────────────────

const adminPostsSlice = createSlice({
  name: "adminPosts",
  initialState,
  reducers: {
    setPostFilters:   (state, { payload }) => { state.filters = { ...state.filters, ...payload }; },
    setPostPage:      (state, { payload }) => { state.filters.page = payload; },
    resetPostFilters: (state)              => { state.filters = initialState.filters; },

    // FIX: clearPostErrors now also clears deleteError (was already there) —
    // kept explicit for clarity; both error fields cleared together.
    clearPostErrors:  (state) => { state.error = null; state.deleteError = null; },

    openPostModal:  (state, { payload }) => { state.selectedPost = payload; },
    closePostModal: (state)              => { state.selectedPost = null; },
  },
  extraReducers: (builder) => {
    builder
      // ── fetchAllPosts ─────────────────────────────────────────────────────
      .addCase(fetchAllPosts.pending,   (s)              => { s.loading = true;  s.error = null; })
      .addCase(fetchAllPosts.fulfilled, (s, { payload }) => {
        s.loading    = false;
        s.posts      = payload.posts;
        // FIX: normalizePagination ensures no field is ever undefined
        s.pagination = payload.pagination;
      })
      .addCase(fetchAllPosts.rejected,  (s, { payload }) => { s.loading = false; s.error = payload; })

      // ── adminDeletePost ───────────────────────────────────────────────────
      .addCase(adminDeletePost.pending,   (s, { meta })    => { s.deleteLoading = meta.arg.postId; s.deleteError = null; })
     .addCase(adminDeletePost.fulfilled, (s, { payload }) => {
  s.deleteLoading    = null;
  s.posts            = s.posts.filter((p) => p.id !== payload.postId);
  s.pagination.total = Math.max(0, (s.pagination.total ?? 1) - 1);
  if (s.selectedPost?.id === payload.postId) s.selectedPost = null;
})
      .addCase(adminDeletePost.rejected,  (s, { payload }) => { s.deleteLoading = null; s.deleteError = payload; });
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

// ── Selectors ─────────────────────────────────────────────────────────────────

// Raw field selectors — simple reads, no createSelector needed
export const selectAdminPosts        = (s) => s.adminPosts.posts;
export const selectAdminPostsLoading = (s) => s.adminPosts.loading;
export const selectAdminPostsError   = (s) => s.adminPosts.error;
export const selectDeleteLoading     = (s) => s.adminPosts.deleteLoading;
// FIX: deleteError was in state but never exported — components had no clean way to read it
export const selectDeleteError       = (s) => s.adminPosts.deleteError;
export const selectPostsPagination   = (s) => s.adminPosts.pagination;
export const selectPostsFilters      = (s) => s.adminPosts.filters;
export const selectSelectedPost      = (s) => s.adminPosts.selectedPost;

// createSelector derived selectors — recompute only when input changes

/** Page number only — avoids subscribing to the whole pagination object */
export const selectPostsCurrentPage = createSelector(
  selectPostsPagination,
  (p) => p.page
);

export const selectPostsTotalPages = createSelector(
  selectPostsPagination,
  (p) => p.totalPages
);

export const selectPostsTotal = createSelector(
  selectPostsPagination,
  (p) => p.total
);


export const selectIsModalOpen = createSelector(
  selectSelectedPost,
  (post) => post !== null
);

/** Selected post id only — for components that only need the id */
export const selectSelectedPostId = createSelector(
  selectSelectedPost,
  (post) => post?.id ?? null
);

/** Is a specific post currently being deleted?
 *  Usage: const isDeleting = useSelector((s) => selectIsPostDeleting(s, postId))
 *  FIX: previously every PostTile had to do deleteLoading === post.id inline */
export const selectIsPostDeleting = createSelector(
  selectDeleteLoading,
  (_, postId) => postId,
  (deleteLoading, postId) => deleteLoading === postId
);

/** Number of active filters (excluding pagination defaults) — for filter badge */
export const selectActivePostFilterCount = createSelector(
  selectPostsFilters,
  (f) => {
    let count = 0;
    if (f.search)               count += 1;
    if (f.type)                 count += 1;
    if (f.sortBy !== "createdAt")  count += 1;
    if (f.sortOrder !== "desc")    count += 1;
    return count;
  }
);

export const selectHasActivePostFilters = createSelector(
  selectActivePostFilterCount,
  (count) => count > 0
);