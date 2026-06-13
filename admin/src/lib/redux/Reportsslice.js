

import { createSlice, createAsyncThunk, createSelector } from "@reduxjs/toolkit";
import adminApi from "../../services/api";

// ── Pagination helper ─────────────────────────────────────────────────────────
// FIX: fetchReports.fulfilled was doing s.pagination = payload.pagination with no
// fallbacks. If backend omits any field, downstream selectors get undefined.
const normalizePagination = (raw = {}) => ({
  total:      raw.total      ?? 0,
  page:       raw.page       ?? 1,
  limit:      raw.limit      ?? 20,
  totalPages: raw.totalPages ?? 1,
});

// ── Counts helper ─────────────────────────────────────────────────────────────
// FIX: updateReportStatus and bulkUpdateReports never updated s.counts — status
// tab badges showed stale numbers after any status change.
// These helpers centralize count mutation so both reducers use the same logic.

const VALID_STATUSES = new Set([
  "pending", "under_review", "resolved_action_taken",
  "resolved_no_action", "dismissed",
]);

const decrementCount = (counts, status) => {
  if (status && counts[status] !== undefined) {
    counts[status] = Math.max(0, counts[status] - 1);
  }
  if (counts.all !== undefined) counts.all = Math.max(0, counts.all - 1);
};

const incrementCount = (counts, status) => {
  if (status && counts[status] !== undefined) counts[status] += 1;
  if (counts.all !== undefined) counts.all += 1;
};

const moveCount = (counts, fromStatus, toStatus) => {
  if (!fromStatus || !toStatus || fromStatus === toStatus) return;
  if (counts[fromStatus] !== undefined) counts[fromStatus] = Math.max(0, counts[fromStatus] - 1);
  if (counts[toStatus]   !== undefined) counts[toStatus]  += 1;
  // "all" doesn't change — same total, just moved between buckets
};

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchReports = createAsyncThunk(
  "reports/fetchAll",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get("/admin/reports", { params });
      return {
        reports:    data.data       ?? [],
        pagination: data.pagination ?? {},
        counts:     data.counts     ?? {},
        priorities: data.priorities ?? {},
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to fetch reports");
    }
  }
);

export const fetchReportById = createAsyncThunk(
  "reports/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get(`/admin/reports/${id}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to fetch report");
    }
  }
);

export const fetchReportHistory = createAsyncThunk(
  "reports/fetchHistory",
  async ({ id, beforeId, limit = 20 }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get(`/admin/reports/${id}/history`, {
        params: { beforeId, limit },
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to fetch history");
    }
  }
);

// FIX: getState() used to capture prevStatus before API call — needed so the
// reducer can move counts correctly without a second lookup.
export const updateReportStatus = createAsyncThunk(
  "reports/updateStatus",
  async ({ id, status, actionTaken, moderatorNote }, { rejectWithValue, getState }) => {
    const prev       = getState().reports.reports.find((r) => r._id === id);
    const prevStatus = prev?.status ?? null;
    try {
      const { data } = await adminApi.patch(`/admin/reports/${id}/status`, {
        status, actionTaken, moderatorNote,
      });
      return { ...data.data, prevStatus };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to update report");
    }
  }
);

// FIX: getState() captures prevStatuses map before API call — reducer uses this
// to move counts from old buckets to new ones.
export const bulkUpdateReports = createAsyncThunk(
  "reports/bulkUpdate",
  async ({ ids, status, actionTaken = "none" }, { rejectWithValue, getState }) => {
    const allReports   = getState().reports.reports;
    const prevStatuses = Object.fromEntries(
      ids.map((id) => [id, allReports.find((r) => r._id === id)?.status ?? null])
    );
    try {
      const { data } = await adminApi.patch("/admin/reports/bulk", {
        ids, status, actionTaken,
      });
      return {
        ids,
        status,
        actionTaken,
        modifiedCount: data.data.modifiedCount,
        prevStatuses,           // FIX: pass through for count mutation in reducer
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to bulk update");
    }
  }
);

export const claimReport = createAsyncThunk(
  "reports/claim",
  async ({ id, ttlMinutes = 30 }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.post(`/admin/reports/${id}/claim`, { ttlMinutes });
      return { id, claimData: data.data };
    } catch (err) {
      if (err.response?.status === 409) {
        return rejectWithValue({
          code:    "ALREADY_CLAIMED",
          message: err.response.data.message,
          data:    err.response.data.data,
        });
      }
      return rejectWithValue({ code: "ERROR", message: err.response?.data?.message ?? "Failed to claim" });
    }
  }
);

export const releaseReport = createAsyncThunk(
  "reports/release",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.delete(`/admin/reports/${id}/claim`);
      return { id, data: data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to release claim");
    }
  }
);

export const escalateReport = createAsyncThunk(
  "reports/escalate",
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.post(`/admin/reports/${id}/escalate`, { reason });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to escalate");
    }
  }
);

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState = {
  reports:        [],
  selectedReport: null,
  reportHistory:  null,
  loading:        false,
  detailLoading:  false,
  historyLoading: false,
  actionLoading:  null,
  claimLoading:   null,
  escalateLoading:null,
  bulkLoading:    false,
  error:          null,
  detailError:    null,   // FIX: was missing — fetchReportById errors silently lost
  historyError:   null,   // FIX: was missing — fetchReportHistory errors silently lost
  claimError:     null,
  pagination: { total: 0, totalPages: 1, page: 1, limit: 20 },
  counts: {
    all: 0, pending: 0, under_review: 0,
    resolved_action_taken: 0, resolved_no_action: 0, dismissed: 0,
  },
  priorities: { low: 0, medium: 0, high: 0, critical: 0 },
  filters: {
    status:        "",
    targetModel:   "",
    reason:        "",
    priority:      "",
    escalated:     "",
    claimedByMe:   "",
    unclaimedOnly: "",
    sortOrder:     "desc",
    page:          1,
    limit:         20,
  },
  selectedIds: [],
};

// ── Slice ─────────────────────────────────────────────────────────────────────

const reportsSlice = createSlice({
  name: "reports",
  initialState,
  reducers: {
    setFilters: (state, { payload }) => {
      state.filters = { ...state.filters, ...payload, page: 1 };
    },
    setPage: (state, { payload }) => {
      state.filters.page = payload;
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
    openReport: (state, { payload }) => {
      state.selectedReport = payload;
      state.reportHistory  = null;
      state.detailError    = null;   // clear stale error when opening new report
    },
    closeReport: (state) => {
      state.selectedReport = null;
      state.reportHistory  = null;
      state.claimError     = null;
      state.detailError    = null;
      state.historyError   = null;
    },
    clearClaimError:  (state) => { state.claimError   = null; },
    clearDetailError: (state) => { state.detailError  = null; },   // FIX: new
    clearHistoryError:(state) => { state.historyError = null; },   // FIX: new
    // FIX: clearError now clears all non-claim error fields together
    clearError: (state) => {
      state.error        = null;
      state.detailError  = null;
      state.historyError = null;
    },
    toggleSelectId: (state, { payload }) => {
      const idx = state.selectedIds.indexOf(payload);
      if (idx === -1) state.selectedIds.push(payload);
      else            state.selectedIds.splice(idx, 1);
    },
    selectAllIds:    (state) => { state.selectedIds = state.reports.map((r) => r._id); },
    clearSelectedIds:(state) => { state.selectedIds = []; },
  },
  extraReducers: (builder) => {
    builder

      // ── fetchReports ──────────────────────────────────────────────────────
      .addCase(fetchReports.pending,   (s)              => { s.loading = true;  s.error = null; })
      .addCase(fetchReports.fulfilled, (s, { payload }) => {
        s.loading     = false;
        s.reports     = payload.reports;
        // FIX: normalizePagination ensures no field is ever undefined
        s.pagination  = normalizePagination(payload.pagination);
        s.counts      = { ...s.counts, ...payload.counts };
        s.priorities  = { ...s.priorities, ...payload.priorities };
        s.selectedIds = [];
      })
      .addCase(fetchReports.rejected,  (s, { payload }) => { s.loading = false; s.error = payload; })

      // ── fetchReportById ───────────────────────────────────────────────────
      .addCase(fetchReportById.pending,   (s) => { s.detailLoading = true;  s.detailError = null; })
      .addCase(fetchReportById.fulfilled, (s, { payload }) => {
        s.detailLoading  = false;
        s.selectedReport = payload;
        s.reportHistory  = null;
      })
      // FIX: error was silently dropped — now stored in detailError
      .addCase(fetchReportById.rejected,  (s, { payload }) => {
        s.detailLoading = false;
        s.detailError   = payload;
      })

      // ── fetchReportHistory ────────────────────────────────────────────────
      .addCase(fetchReportHistory.pending,   (s) => { s.historyLoading = true;  s.historyError = null; })
      .addCase(fetchReportHistory.fulfilled, (s, { payload }) => {
        s.historyLoading = false;
        s.reportHistory  = payload;
      })
      // FIX: error was silently dropped — now stored in historyError
      .addCase(fetchReportHistory.rejected,  (s, { payload }) => {
        s.historyLoading = false;
        s.historyError   = payload;
      })

      // ── updateReportStatus ────────────────────────────────────────────────
      .addCase(updateReportStatus.pending,   (s, { meta }) => { s.actionLoading = meta.arg.id; })
      .addCase(updateReportStatus.fulfilled, (s, { payload }) => {
        s.actionLoading = null;
        const idx = s.reports.findIndex((r) => r._id === payload._id);
        if (idx !== -1) s.reports[idx] = { ...s.reports[idx], ...payload };
        if (s.selectedReport?._id === payload._id) {
          s.selectedReport = { ...s.selectedReport, ...payload };
        }
        // FIX: counts were never updated on status change — tab badges stayed stale.
        // prevStatus captured in thunk (getState before API call).
        if (payload.prevStatus && payload.status) {
          moveCount(s.counts, payload.prevStatus, payload.status);
        }
      })
      .addCase(updateReportStatus.rejected,  (s, { payload }) => {
        s.actionLoading = null;
        s.error         = payload;
      })

      // ── bulkUpdateReports ─────────────────────────────────────────────────
      .addCase(bulkUpdateReports.pending,   (s) => { s.bulkLoading = true; })
      .addCase(bulkUpdateReports.fulfilled, (s, { payload }) => {
        s.bulkLoading = false;
        const prevStatuses = payload.prevStatuses ?? {};

        payload.ids.forEach((id) => {
          const idx = s.reports.findIndex((r) => r._id === id);
          if (idx !== -1) {
            // FIX: counts were never updated on bulk action — badges showed wrong
            // numbers after approve/dismiss/etc. Move each report's count bucket.
            const prevStatus = prevStatuses[id];
            if (prevStatus && prevStatus !== payload.status) {
              moveCount(s.counts, prevStatus, payload.status);
            }
            s.reports[idx].status      = payload.status;
            s.reports[idx].actionTaken = payload.actionTaken;
          }
        });
        s.selectedIds = [];
      })
      .addCase(bulkUpdateReports.rejected,  (s, { payload }) => {
        s.bulkLoading = false;
        s.error       = payload;
      })

      // ── claimReport ───────────────────────────────────────────────────────
      .addCase(claimReport.pending,   (s, { meta }) => { s.claimLoading = meta.arg.id; s.claimError = null; })
      .addCase(claimReport.fulfilled, (s, { payload }) => {
        s.claimLoading = null;
        // FIX: guard against missing claimData — don't silently null out claim fields
        if (!payload.claimData) return;
        const idx = s.reports.findIndex((r) => r._id === payload.id);
        if (idx !== -1) {
          s.reports[idx].claimedBy      = payload.claimData.claimedBy      ?? null;
          s.reports[idx].claimedAt      = payload.claimData.claimedAt      ?? null;
          s.reports[idx].claimExpiresAt = payload.claimData.claimExpiresAt ?? null;
        }
        if (s.selectedReport?._id === payload.id) {
          s.selectedReport = { ...s.selectedReport, ...payload.claimData };
        }
      })
      .addCase(claimReport.rejected,  (s, { payload }) => {
        s.claimLoading = null;
        s.claimError   = payload ?? null;
      })

      // ── releaseReport ─────────────────────────────────────────────────────
      .addCase(releaseReport.pending,   (s, { meta }) => { s.claimLoading = meta.arg; })
      .addCase(releaseReport.fulfilled, (s, { payload }) => {
        s.claimLoading = null;
        const idx = s.reports.findIndex((r) => r._id === payload.id);
        if (idx !== -1) {
          s.reports[idx].claimedBy      = null;
          s.reports[idx].claimedAt      = null;
          s.reports[idx].claimExpiresAt = null;
        }
        if (s.selectedReport?._id === payload.id) {
          s.selectedReport = {
            ...s.selectedReport,
            claimedBy: null, claimedAt: null, claimExpiresAt: null,
          };
        }
      })
      .addCase(releaseReport.rejected,  (s, { payload }) => {
        s.claimLoading = null;
        s.error        = payload;
      })

      // ── escalateReport ────────────────────────────────────────────────────
      .addCase(escalateReport.pending,   (s, { meta }) => { s.escalateLoading = meta.arg.id; })
      .addCase(escalateReport.fulfilled, (s, { payload }) => {
        s.escalateLoading = null;
        const idx = s.reports.findIndex((r) => r._id === payload._id);
        if (idx !== -1) s.reports[idx] = { ...s.reports[idx], ...payload };
        if (s.selectedReport?._id === payload._id) {
          s.selectedReport = { ...s.selectedReport, ...payload };
        }
      })
      .addCase(escalateReport.rejected,  (s, { payload }) => {
        s.escalateLoading = null;
        s.error           = payload;
      });
  },
});

export const {
  setFilters, setPage, resetFilters,
  openReport, closeReport,
  clearClaimError, clearDetailError, clearHistoryError, clearError,
  toggleSelectId, selectAllIds, clearSelectedIds,
} = reportsSlice.actions;

export default reportsSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────────

// Raw field selectors
export const selectReports           = (s) => s.reports.reports;
export const selectReportsLoading    = (s) => s.reports.loading;
export const selectReportsError      = (s) => s.reports.error;
export const selectReportsPagination = (s) => s.reports.pagination;
export const selectReportsCounts     = (s) => s.reports.counts;
export const selectReportsPriorities = (s) => s.reports.priorities;
export const selectReportsFilters    = (s) => s.reports.filters;
export const selectSelectedReport    = (s) => s.reports.selectedReport;
export const selectReportHistory     = (s) => s.reports.reportHistory;
export const selectDetailLoading     = (s) => s.reports.detailLoading;
export const selectHistoryLoading    = (s) => s.reports.historyLoading;
export const selectActionLoading     = (s) => s.reports.actionLoading;
export const selectClaimLoading      = (s) => s.reports.claimLoading;
export const selectClaimError        = (s) => s.reports.claimError;
// FIX: these two were missing — errors silently unreachable by components
export const selectDetailError       = (s) => s.reports.detailError;
export const selectHistoryError      = (s) => s.reports.historyError;
export const selectEscalateLoading   = (s) => s.reports.escalateLoading;
export const selectBulkLoading       = (s) => s.reports.bulkLoading;
export const selectSelectedIds       = (s) => s.reports.selectedIds;

// createSelector derived selectors

export const selectCurrentPage = createSelector(
  selectReportsPagination,
  (p) => p.page
);
export const selectTotalPages = createSelector(
  selectReportsPagination,
  (p) => p.totalPages
);
export const selectTotalReports = createSelector(
  selectReportsPagination,
  (p) => p.total
);

/** Boolean — any reports selected? */
export const selectHasSelection = createSelector(
  selectSelectedIds,
  (ids) => ids.length > 0
);

/** Count of selected reports — for "3 selected" badge */
export const selectSelectionCount = createSelector(
  selectSelectedIds,
  (ids) => ids.length
);

/** Are all loaded reports selected? — for "select all" checkbox state */
export const selectAllSelected = createSelector(
  selectReports,
  selectSelectedIds,
  (reports, ids) => reports.length > 0 && ids.length === reports.length
);

/** Boolean — is detail panel open? */
export const selectIsDetailOpen = createSelector(
  selectSelectedReport,
  (r) => r !== null
);

/** Is a specific report currently being actioned?
 *  Usage: useSelector((s) => selectIsReportActioning(s, reportId)) */
export const selectIsReportActioning = createSelector(
  selectActionLoading,
  (_, id) => id,
  (actionLoading, id) => actionLoading === id
);

/** Is a specific report currently being claimed/released? */
export const selectIsReportClaiming = createSelector(
  selectClaimLoading,
  (_, id) => id,
  (claimLoading, id) => claimLoading === id
);

/** Count of active filters (excluding pagination defaults) — for filter badge */
export const selectActiveFilterCount = createSelector(
  selectReportsFilters,
  (f) => {
    let count = 0;
    if (f.status)        count += 1;
    if (f.targetModel)   count += 1;
    if (f.reason)        count += 1;
    if (f.priority)      count += 1;
    if (f.escalated)     count += 1;
    if (f.claimedByMe)   count += 1;
    if (f.unclaimedOnly) count += 1;
    if (f.sortOrder !== "desc") count += 1;
    return count;
  }
);

export const selectHasActiveFilters = createSelector(
  selectActiveFilterCount,
  (count) => count > 0
);

/** Pending count specifically — for navbar/tab badge */
export const selectPendingCount = createSelector(
  selectReportsCounts,
  (counts) => counts.pending ?? 0
);

/** Critical priority count — for urgent attention indicator */
export const selectCriticalCount = createSelector(
  selectReportsPriorities,
  (priorities) => priorities.critical ?? 0
);

/** True if there are critical or high-priority unresolved reports */
export const selectNeedsUrgentAttention = createSelector(
  selectReportsPriorities,
  selectReportsCounts,
  (priorities, counts) =>
    (priorities.critical ?? 0) > 0 ||
    ((priorities.high ?? 0) > 0 && (counts.pending ?? 0) > 0)
);