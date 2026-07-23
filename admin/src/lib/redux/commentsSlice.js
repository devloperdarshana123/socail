

import { createSlice, createAsyncThunk, createSelector } from "@reduxjs/toolkit";
import adminApi from "../../services/api";

// ── API Layer ─────────────────────────────────────────────────────────────────

const commentsAPI = {
  getAll:       (params)       => adminApi.get("/admin/comments", { params }),
  updateStatus: (id, data)     => adminApi.patch(`/admin/comments/${id}/status`, data),
  remove:       (id)           => adminApi.delete(`/admin/comments/${id}`),   // FIX: "delete" renamed to "remove" — reserved word, better practice
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
  status:        c.status ?? "active",
  reportCount:   c.reportsCount ?? c.reportCount ?? c.reports?.length ?? 0,
  reportReasons: c.reportReasons ?? c.reports?.map((r) => r.reason).filter(Boolean) ?? [],
  likesCount:    c.likesCount ?? c.likes?.length ?? 0,
  author:        normalizeAuthor(c.author ?? c.user),
  post: c.post
    ? { ...c.post, author: normalizeAuthor(c.post.author ?? c.post.user) }
    : null,
});

// ── Module-level constants ────────────────────────────────────────────────────
// FIX: statusMap was rebuilt as a new object on every bulkUpdateComments.fulfilled call.
// Moved to module level — created once, shared across all reducer calls.
const BULK_STATUS_MAP = {
  approve: "active",
  flag:    "flagged",
  remove:  "removed",
};

// ── Stats helpers ─────────────────────────────────────────────────────────────
// FIX: deleteComment and bulkUpdateComments were not updating s.stats at all.
// These helpers centralize stat mutation so both reducers use the same logic.

/** Decrement a stat bucket safely (floor 0) */
const decrementStat = (stats, key) => {
  if (key && stats[key] !== undefined) stats[key] = Math.max(0, stats[key] - 1);
};

/** Increment a stat bucket safely */
const incrementStat = (stats, key) => {
  if (key && stats[key] !== undefined) stats[key] += 1;
};

/** Move a comment from one stat bucket to another */
const moveStat = (stats, fromKey, toKey) => {
  if (fromKey === toKey) return;
  decrementStat(stats, fromKey);
  incrementStat(stats, toKey);
};

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

export const updateCommentStatus = createAsyncThunk(
  "comments/updateStatus",
  async ({ commentId, status, reason }, { rejectWithValue, getState }) => {
    const prev       = getState().comments.comments.find((c) =>  c.id === commentId);
    const prevStatus = prev?.status ?? null;
    try {
      const { data: body } = await commentsAPI.updateStatus(commentId, { status, reason });
      return { commentId, status: body.data?.status ?? status, prevStatus };
    } catch (err) {
      return rejectWithValue({
        message:    err.response?.data?.message ?? "Failed to update comment status",
        commentId,
        prevStatus, // rollback ke liye
      });
    }
  }
);

// FIX: deleteComment now uses getState() to read the comment's current status
// before deletion so stats can be decremented correctly.
export const deleteComment = createAsyncThunk(
  "comments/delete",
  async (commentId, { rejectWithValue, getState }) => {
    const comment    = getState().comments.comments.find((c) =>  c.id === commentId);
    const prevStatus = comment?.status ?? null;
    try {
      await commentsAPI.remove(commentId);
      return { commentId, prevStatus };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to delete comment");
    }
  }
);

export const bulkUpdateComments = createAsyncThunk(
  "comments/bulkAction",
  async ({ commentIds, action, reason }, { rejectWithValue, getState }) => {
    // FIX: capture prevStatuses before the API call so the reducer can update
    // stats accurately without a second getState() call inside the reducer.
    const allComments  = getState().comments.comments;
    const prevStatuses = Object.fromEntries(
      commentIds.map((id) => [id, allComments.find((c) =>  c.id === id)?.status ?? null])
    );
    try {
      const { data: body } = await commentsAPI.bulkAction({ ids: commentIds, action, reason });
      return { ...body, prevStatuses };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Bulk action failed");
    }
  }
);

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState = {
  comments:      [],
  loading:       false,
  error:         null,
  actionLoading: null,
  actionError:   null,
  detail:        null,
  detailLoading: false,
  detailError:   null,
  selectedIds:   [],            // FIX: bulk-select state belongs in slice, not scattered across components
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
  // Was defaulting to the flagged (needs-review) queue, but that reads as a
  // broken/empty page whenever nothing happens to be flagged — which is most
  // of the time on a small or early-stage dataset. Default to everything,
  // newest first; the flagged filter is one click away when it's needed.
  filters: {
    search:    "",
    status:    "",
    dateRange: "",
    sortBy:    "createdAt",
    sortOrder: "desc",
    page:      1,
    limit:     12,
  },
};

// ── Slice ─────────────────────────────────────────────────────────────────────

const commentsSlice = createSlice({
  name: "comments",
  initialState,
  reducers: {
    setFilters:   (state, { payload }) => { state.filters = { ...state.filters, ...payload }; },
    setPage:      (state, { payload }) => { state.filters.page = payload; },
    resetFilters: (state)              => { state.filters = initialState.filters; },

    // FIX: clearErrors was missing detailError — all three error fields now cleared together.
    clearErrors:  (state) => { state.error = null; state.actionError = null; state.detailError = null; },
    clearDetail:  (state) => { state.detail = null; state.detailError = null; },

    // FIX: selectedIds managed in slice — components just dispatch these instead of useState
    setSelectedIds:    (state, { payload }) => { state.selectedIds = payload; },
    toggleSelectedId:  (state, { payload }) => {
      const idx = state.selectedIds.indexOf(payload);
      if (idx === -1) state.selectedIds.push(payload);
      else            state.selectedIds.splice(idx, 1);
    },
    selectAllIds:      (state)              => { state.selectedIds = state.comments.map((c) =>  c.id); },
    clearSelectedIds:  (state)              => { state.selectedIds = []; },
  },
  extraReducers: (builder) => {
    builder

      // ── fetchComments ───────────────────────────────────────────────────────
      .addCase(fetchComments.pending,   (s)              => { s.loading = true; s.error = null; })
      .addCase(fetchComments.fulfilled, (s, { payload }) => {
        s.loading    = false;
        s.comments   = payload.comments;
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
      .addCase(updateCommentStatus.pending, (s, { meta }) => {
        s.actionLoading = meta.arg.commentId;
        const c = s.comments.find((x) => x.id === meta.arg.commentId);
        if (c && c.status !== meta.arg.status) {
          moveStat(s.stats, c.status, meta.arg.status);  // optimistic stats
          c.status = meta.arg.status;
        }
        if (s.detail?.id === meta.arg.commentId) s.detail.status = meta.arg.status;
      })
      .addCase(updateCommentStatus.fulfilled, (s, { payload }) => {
        s.actionLoading = null;
        const c = s.comments.find((x) => x.id === payload.commentId);
        if (c && c.status !== payload.status) {
          // Server confirmed a different status than our optimistic update — correct it
          moveStat(s.stats, c.status, payload.status);
          c.status = payload.status;
        }
        if (s.detail?.id === payload.commentId) s.detail.status = payload.status;
      })
      .addCase(updateCommentStatus.rejected, (s, { payload }) => {
        s.actionLoading = null;
        s.actionError   = payload?.message ?? payload;
        // Rollback optimistic update
        if (payload?.commentId && payload?.prevStatus) {
          const c = s.comments.find((x) => x.id === payload.commentId);
          if (c && c.status !== payload.prevStatus) {
            moveStat(s.stats, c.status, payload.prevStatus);
            c.status = payload.prevStatus;
          }
          if (s.detail?.id === payload.commentId) s.detail.status = payload.prevStatus;
        }
      })

      // ── deleteComment ───────────────────────────────────────────────────────
      .addCase(deleteComment.pending,   (s, { meta })    => { s.actionLoading = meta.arg; })
      .addCase(deleteComment.fulfilled, (s, { payload }) => {
        s.actionLoading = null;
        s.comments      = s.comments.filter((c) =>  c.id !== payload.commentId);
        s.pagination.totalComments = Math.max(0, s.pagination.totalComments - 1);

        // FIX: stats were never updated on delete — stat cards showed stale counts.
        // prevStatus was passed from thunk (captured via getState before API call).
        if (payload.prevStatus) {
          decrementStat(s.stats, payload.prevStatus);
          decrementStat(s.stats, "total");
        }

        // Remove from selectedIds if it was selected
        s.selectedIds = s.selectedIds.filter((id) => id !== payload.commentId);
      })
      .addCase(deleteComment.rejected,  (s, { payload }) => {
        s.actionLoading = null;
        s.actionError   = payload;
      })

      // ── bulkUpdateComments ──────────────────────────────────────────────────
      .addCase(bulkUpdateComments.pending,   (s)              => { s.actionLoading = "bulk"; })
      // .addCase(bulkUpdateComments.fulfilled, (s, { payload }) => {
      //   s.actionLoading = null;

      //   const successIds  = new Set(payload.data?.success ?? []);
      //   const action      = payload.data?.action ?? "removed";
      //   const newStatus   = BULK_STATUS_MAP[action] ?? action;  // FIX: module-level constant, not rebuilt per call
      //   const prevStatuses = payload.prevStatuses ?? {};        // FIX: captured in thunk before API call

      //   s.comments = s.comments.map((c) => {
      //     if (!successIds.has( c.id)) return c;

      //     // FIX: stats were never updated on bulk action — counts stayed wrong after approve/flag/remove.
      //     // Now we move each affected comment from its old stat bucket to the new one.
      //     const prevStatus = prevStatuses[ c.id];
      //     if (prevStatus && prevStatus !== newStatus) {
      //       moveStat(s.stats, prevStatus, newStatus);
      //     }

      //     return { ...c, status: newStatus };
      //   });

      //   // Clear selection after successful bulk action
      //   s.selectedIds = [];
      // })

      .addCase(bulkUpdateComments.fulfilled, (s, { payload }) => {
  s.actionLoading = null;

  const action       = payload.data?.action ?? "removed";
  const newStatus    = BULK_STATUS_MAP[action] ?? action;
  const prevStatuses = payload.prevStatuses ?? {};

  const successIds = new Set(
    payload.data?.success?.length
      ? payload.data.success
      : Object.keys(prevStatuses)
  );

  if (action === "remove") {
    s.comments = s.comments.filter((c) => !successIds.has( c.id));
    s.pagination.totalComments = Math.max(0, s.pagination.totalComments - successIds.size);
    successIds.forEach((id) => {
      const prevStatus = prevStatuses[id];
      if (prevStatus) {
        decrementStat(s.stats, prevStatus);
        decrementStat(s.stats, "total");
      }
    });
  } else {
    s.comments = s.comments.map((c) => {
      if (!successIds.has( c.id)) return c;
      const prevStatus = prevStatuses[ c.id];
      if (prevStatus && prevStatus !== newStatus) {
        moveStat(s.stats, prevStatus, newStatus);
      }
      return { ...c, status: newStatus };
    });
  }

  s.selectedIds = [];
})
      .addCase(bulkUpdateComments.rejected, (s, { payload }) => {
        s.actionLoading = null;
        s.actionError   = payload;
      })

      // ── fetchCommentStats ───────────────────────────────────────────────────
      .addCase(fetchCommentStats.fulfilled, (s, { payload }) => {
        s.stats = {
          total:   payload.total   ?? 0,
          active:  payload.active  ?? 0,
          flagged: payload.flagged ?? 0,
          removed: payload.removed ?? 0,
          pending: payload.pending ?? 0,
        };
      });
  },
});

export const {
  setFilters,
  setPage,
  resetFilters,
  clearErrors,
  clearDetail,
  setSelectedIds,
  toggleSelectedId,
  selectAllIds,
  clearSelectedIds,
} = commentsSlice.actions;

export default commentsSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────────

// Raw state selectors — simple field reads, no createSelector needed
export const selectComments           = (s) => s.comments.comments;
export const selectCommentsLoading    = (s) => s.comments.loading;
export const selectCommentsError      = (s) => s.comments.error;
export const selectActionLoading      = (s) => s.comments.actionLoading;
export const selectActionError        = (s) => s.comments.actionError;
export const selectCommentsPagination = (s) => s.comments.pagination;
export const selectCommentsFilters    = (s) => s.comments.filters;
export const selectCommentsStats      = (s) => s.comments.stats;
export const selectCommentDetail      = (s) => s.comments.detail;
export const selectDetailLoading      = (s) => s.comments.detailLoading;
export const selectDetailError        = (s) => s.comments.detailError;
export const selectSelectedIds        = (s) => s.comments.selectedIds;

// Derived selectors — createSelector so they only recompute when input changes

/** Flat page number — avoids subscribing to the whole pagination object */
export const selectCurrentPage = createSelector(
  selectCommentsPagination,
  (p) => p.currentPage
);

export const selectTotalPages = createSelector(
  selectCommentsPagination,
  (p) => p.totalPages
);

export const selectTotalComments = createSelector(
  selectCommentsPagination,
  (p) => p.totalComments
);

/** Boolean — are any comments currently selected? */
export const selectHasSelection = createSelector(
  selectSelectedIds,
  (ids) => ids.length > 0
);

/** Count of selected comments */
export const selectSelectionCount = createSelector(
  selectSelectedIds,
  (ids) => ids.length
);

/** Are all currently loaded comments selected? */
export const selectAllSelected = createSelector(
  selectComments,
  selectSelectedIds,
  (comments, ids) => comments.length > 0 && ids.length === comments.length
);

/** Per-status counts for stat cards — stable object, won't cause re-renders unless stats change */
export const selectStatCounts = createSelector(
  selectCommentsStats,
  (stats) => ({
    total:   stats.total,
    active:  stats.active,
    flagged: stats.flagged,
    removed: stats.removed,
    pending: stats.pending,
  })
);

/** Number of active filters (excluding defaults) — for filter badge */
export const selectActiveFilterCount = createSelector(
  selectCommentsFilters,
  (filters) => {
    let count = 0;
    if (filters.search)              count += 1;
    if (filters.status)              count += 1;
    if (filters.dateRange)           count += 1;
    if (filters.sortBy !== "createdAt") count += 1;
    if (filters.sortOrder !== "desc")   count += 1;
    return count;
  }
);

/** Boolean — are any non-default filters active? */
export const selectHasActiveFilters = createSelector(
  selectActiveFilterCount,
  (count) => count > 0
);

/** Is a specific comment currently being actioned? */
export const selectIsCommentLoading = createSelector(
  selectActionLoading,
  (_, commentId) => commentId,
  (actionLoading, commentId) => actionLoading === commentId
);