import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import adminApi from "../../services/api";

// ── API Layer ─────────────────────────────────────────────────────────────────

const commentsAPI = {
  getAll:       (params)       => adminApi.get("/admin/comments", { params }),
  updateStatus: (id, data)     => adminApi.patch(`/admin/comments/${id}/status`, data),
  delete:       (id)           => adminApi.delete(`/admin/comments/${id}`),
  bulkAction:   (data)         => adminApi.patch("/admin/comments/bulk", data),
  getById:      (id)           => adminApi.get(`/admin/comments/${id}`),
};

// ── Normalizer ────────────────────────────────────────────────────────────────

const extractAvatar = (avatar) => {
  if (!avatar) return null;
  if (typeof avatar === "string") return avatar;
  return avatar.url ?? avatar.secure_url ?? avatar.publicId ?? null;
};

const normalizeAuthor = (author) => {
  if (!author) return null;
  return {
    ...author,
    profilePicture: extractAvatar(author.avatar ?? author.profilePicture),
    isVerified:     author.isVerifiedBadge ?? author.isVerified ?? false,
  };
};

const normalizeComment = (c) => ({
  ...c,
  status:       c.status ?? "active",
  reportCount: c.reportsCount ?? c.reportCount ?? c.reports?.length ?? 0,
  reportReasons: c.reportReasons ?? c.reports?.map((r) => r.reason).filter(Boolean) ?? [],
  likesCount:   c.likesCount  ?? c.likes?.length  ?? 0,
  author:       normalizeAuthor(c.author ?? c.user),
  post: c.post
    ? {
        ...c.post,
        author: normalizeAuthor(c.post.author ?? c.post.user),
      }
    : null,
});

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchComments = createAsyncThunk(
  "comments/fetchAll",
  async (params, { rejectWithValue }) => {
    try {
      const { data: body } = await commentsAPI.getAll(params);
      const comments   = Array.isArray(body.data) ? body.data : [];
      const pagination = body.pagination ?? {};
      return {
        comments:      comments.map(normalizeComment),
        totalComments: pagination.total      ?? comments.length,
        totalPages:    pagination.totalPages ?? 1,
        currentPage:   pagination.page       ?? 1,
        stats:         body.stats            ?? null,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to fetch comments");
    }
  }
);

export const fetchCommentStats = createAsyncThunk(
  "comments/fetchStats",
  async (_, { rejectWithValue }) => {
    try {
      const { data: body } = await adminApi.get("/admin/comments/stats");
      return body.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to fetch stats");
    }
  }
);

export const fetchCommentById = createAsyncThunk(
  "comments/fetchById",
  async (commentId, { rejectWithValue }) => {
    try {
      const { data: body } = await commentsAPI.getById(commentId);
      return normalizeComment(body.data);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to fetch comment");
    }
  }
);

// export const updateCommentStatus = createAsyncThunk(
//   "comments/updateStatus",
//   async ({ commentId, status, reason }, { rejectWithValue }) => {
//     try {
//       const { data: body } = await commentsAPI.updateStatus(commentId, { status, reason });
//       return {
//         commentId,
//         status: body.data?.status ?? status,
//       };
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message ?? "Failed to update comment status");
//     }
//   }
// );



// REPLACE KARO
export const updateCommentStatus = createAsyncThunk(
  "comments/updateStatus",
  async ({ commentId, status, reason }, { rejectWithValue, getState }) => {
    const prev = getState().comments.comments.find((c) => c._id === commentId);
    const prevStatus = prev?.status ?? null;
    try {
      const { data: body } = await commentsAPI.updateStatus(commentId, { status, reason });
      return {
        commentId,
        status:     body.data?.status ?? status,
        prevStatus,
      };
    } catch (err) {
      return rejectWithValue({
        message:    err.response?.data?.message ?? "Failed to update comment status",
        commentId,
        prevStatus, // rollback ke liye
      });
    }
  }
);
export const deleteComment = createAsyncThunk(
  "comments/delete",
  async (commentId, { rejectWithValue }) => {
    try {
      await commentsAPI.delete(commentId);
      return { commentId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to delete comment");
    }
  }
);



export const bulkUpdateComments = createAsyncThunk(
  "comments/bulkAction",
  async ({ commentIds, action, reason }, { rejectWithValue }) => {
    try {
      const { data: body } = await commentsAPI.bulkAction({
        ids: commentIds,  // ✅ "ids" bhejo
        action,
        reason,
      });
      return body;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Bulk action failed");
    }
  }
);
const initialState = {
  comments:      [],
  loading:       false,
  error:         null,
  actionLoading: null,
  actionError:   null,
  detail:        null,
  detailLoading: false,
  detailError:   null,
  pagination: {
    totalComments: 0,
    totalPages:    1,
    currentPage:   1,
  },
  stats: {
    total:   0,
    active:  0,
    flagged: 0,
    removed: 0,
    pending: 0,
  },
  filters: {
    search:    "",
    status:    "",
    sortBy:    "createdAt",
    sortOrder: "desc",
    page:      1,
    limit:     12,
  },
};

const commentsSlice = createSlice({
  name: "comments",
  initialState,
  reducers: {
    setFilters:    (state, { payload }) => { state.filters = { ...state.filters, ...payload }; },
    setPage:       (state, { payload }) => { state.filters.page = payload; },
    resetFilters:  (state)              => { state.filters = initialState.filters; },
    clearErrors:   (state)              => { state.error = null; state.actionError = null; },
    clearDetail:   (state)              => { state.detail = null; state.detailError = null; },
  },
  extraReducers: (builder) => {
    builder

      // ── fetchComments ───────────────────────────────────────────────────────
      .addCase(fetchComments.pending,   (s)              => { s.loading = true; s.error = null; })
      .addCase(fetchComments.fulfilled, (s, { payload }) => {
        s.loading   = false;
        s.comments  = payload.comments;
        s.pagination = {
          totalComments: payload.totalComments,
          totalPages:    payload.totalPages,
          currentPage:   payload.currentPage,
        };
        if (payload.stats) s.stats = payload.stats;
      })
      .addCase(fetchComments.rejected,  (s, { payload }) => { s.loading = false; s.error = payload; })

      // ── fetchCommentById ────────────────────────────────────────────────────
      .addCase(fetchCommentById.pending,   (s)              => { s.detailLoading = true; s.detailError = null; })
      .addCase(fetchCommentById.fulfilled, (s, { payload }) => { s.detailLoading = false; s.detail = payload; })
      .addCase(fetchCommentById.rejected,  (s, { payload }) => { s.detailLoading = false; s.detailError = payload; })

      // ── updateCommentStatus ─────────────────────────────────────────────────
  // REPLACE KARO
.addCase(updateCommentStatus.pending, (s, { meta }) => {
  s.actionLoading = meta.arg.commentId;

  // Optimistic update — server response ka wait nahi
  const c = s.comments.find((x) => x._id === meta.arg.commentId);
  if (c && c.status !== meta.arg.status) {
    const oldStatus = c.status;
    c.status = meta.arg.status;

    // Stats instantly reflect karo
    if (s.stats[oldStatus] !== undefined)       s.stats[oldStatus]       = Math.max(0, s.stats[oldStatus] - 1);
    if (s.stats[meta.arg.status] !== undefined) s.stats[meta.arg.status] += 1;
  }
  if (s.detail?._id === meta.arg.commentId) s.detail.status = meta.arg.status;
})
.addCase(updateCommentStatus.fulfilled, (s, { payload }) => {
  s.actionLoading = null;
  // Server se confirmed status set karo (edge case: server ne alag status diya)
  const c = s.comments.find((x) => x._id === payload.commentId);
  if (c && c.status !== payload.status) {
    // Correction — optimistic status galat tha
    if (s.stats[c.status]      !== undefined) s.stats[c.status]      = Math.max(0, s.stats[c.status] - 1);
    if (s.stats[payload.status] !== undefined) s.stats[payload.status] += 1;
    c.status = payload.status;
  }
  if (s.detail?._id === payload.commentId) s.detail.status = payload.status;
})
.addCase(updateCommentStatus.rejected, (s, { payload }) => {
  s.actionLoading = null;
  s.actionError   = payload?.message ?? payload;

  // Rollback — optimistic update wapas karo
  if (payload?.commentId && payload?.prevStatus) {
    const c = s.comments.find((x) => x._id === payload.commentId);
    if (c && c.status !== payload.prevStatus) {
      if (s.stats[c.status]          !== undefined) s.stats[c.status]          = Math.max(0, s.stats[c.status] - 1);
      if (s.stats[payload.prevStatus] !== undefined) s.stats[payload.prevStatus] += 1;
      c.status = payload.prevStatus;
    }
    if (s.detail?._id === payload.commentId) s.detail.status = payload.prevStatus;
  }
})

      // ── deleteComment ───────────────────────────────────────────────────────
      .addCase(deleteComment.pending,   (s, { meta })    => { s.actionLoading = meta.arg; })
      .addCase(deleteComment.fulfilled, (s, { payload }) => {
        s.actionLoading = null;
        s.comments      = s.comments.filter((c) => c._id !== payload.commentId);
        s.pagination.totalComments = Math.max(0, s.pagination.totalComments - 1);
      })
      .addCase(deleteComment.rejected,  (s, { payload }) => {
        s.actionLoading = null;
        s.actionError   = payload;
      })

      // ── bulkUpdateComments ──────────────────────────────────────────────────
      .addCase(bulkUpdateComments.pending,   (s)              => { s.actionLoading = "bulk"; })
      .addCase(bulkUpdateComments.fulfilled, (s, { payload }) => {
        s.actionLoading = null;
        const successIds = new Set(payload.data?.success ?? []);
        const action     = payload.data?.action ?? "removed";
        const statusMap  = { approve: "active", flag: "flagged", remove: "removed" };
        const newStatus  = statusMap[action] ?? action;
        s.comments = s.comments.map((c) =>
          successIds.has(c._id) ? { ...c, status: newStatus } : c
        );
      })
    
      .addCase(bulkUpdateComments.rejected,  (s, { payload }) => {
        s.actionLoading = null;
        s.actionError   = payload;
      })                                     // ← sirf ) — semicolon nahi
      .addCase(fetchCommentStats.fulfilled, (s, { payload }) => {
        s.stats = {
          total:   payload.total   ?? 0,
          active:  payload.active  ?? 0,
          flagged: payload.flagged ?? 0,
          removed: payload.removed ?? 0,
          pending: payload.pending ?? 0,
        };
      });                                    // ← yahan semicolon sahi hai

  },
});

export const {
  setFilters,
  setPage,
  resetFilters,
  clearErrors,
  clearDetail,
} = commentsSlice.actions;

export default commentsSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectComments          = (s) => s.comments.comments;
export const selectCommentsLoading   = (s) => s.comments.loading;
export const selectCommentsError     = (s) => s.comments.error;
export const selectActionLoading     = (s) => s.comments.actionLoading;
export const selectActionError       = (s) => s.comments.actionError;
export const selectCommentsPagination = (s) => s.comments.pagination;
export const selectCommentsFilters   = (s) => s.comments.filters;
export const selectCommentsStats     = (s) => s.comments.stats;
export const selectCommentDetail     = (s) => s.comments.detail;
export const selectDetailLoading     = (s) => s.comments.detailLoading;
export const selectDetailError       = (s) => s.comments.detailError;