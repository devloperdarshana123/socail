import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import adminApi from "../../services/api";

// ─────────────────────────────────────────────────────────────
//  Thunks
// ─────────────────────────────────────────────────────────────

export const fetchReports = createAsyncThunk(
  "reports/fetchAll",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get("/admin/reports", { params });
      return {
        reports:    data.data        ?? [],
        pagination: data.pagination  ?? {},
        counts:     data.counts      ?? {},
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

export const updateReportStatus = createAsyncThunk(
  "reports/updateStatus",
  async ({ id, status, actionTaken, moderatorNote }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/admin/reports/${id}/status`, {
        status,
        actionTaken,
        moderatorNote,
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to update report");
    }
  }
);

export const bulkUpdateReports = createAsyncThunk(
  "reports/bulkUpdate",
  async ({ ids, status, actionTaken = "none" }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch("/admin/reports/bulk", {
        ids, status, actionTaken,
      });
      return { ids, status, actionTaken, modifiedCount: data.data.modifiedCount };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to bulk update");
    }
  }
);

// ─────────────────────────────────────────────────────────────
//  Initial State
// ─────────────────────────────────────────────────────────────

const initialState = {
  reports:        [],
  selectedReport: null,
  loading:        false,
  detailLoading:  false,
  actionLoading:  null,   // reportId being actioned
  bulkLoading:    false,
  error:          null,
  pagination: { total: 0, totalPages: 1, page: 1, limit: 20 },
  counts: {
    all: 0, pending: 0, under_review: 0,
    resolved_action_taken: 0, resolved_no_action: 0, dismissed: 0,
  },
  filters: {
    status: "", targetModel: "", reason: "",
    sortOrder: "desc", page: 1, limit: 20,
  },
  selectedIds: [],   // for bulk actions
};

// ─────────────────────────────────────────────────────────────
//  Slice
// ─────────────────────────────────────────────────────────────

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
    },
    closeReport: (state) => {
      state.selectedReport = null;
    },
    toggleSelectId: (state, { payload }) => {
      const idx = state.selectedIds.indexOf(payload);
      if (idx === -1) state.selectedIds.push(payload);
      else            state.selectedIds.splice(idx, 1);
    },
    selectAllIds: (state) => {
      state.selectedIds = state.reports.map((r) => r._id);
    },
    clearSelectedIds: (state) => {
      state.selectedIds = [];
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ── fetchReports ──────────────────────────────────────────
      .addCase(fetchReports.pending, (s) => {
        s.loading = true; s.error = null;
      })
      .addCase(fetchReports.fulfilled, (s, { payload }) => {
        s.loading    = false;
        s.reports    = payload.reports;
        s.pagination = payload.pagination;
        s.counts     = { ...s.counts, ...payload.counts };
        s.selectedIds = [];
      })
      .addCase(fetchReports.rejected, (s, { payload }) => {
        s.loading = false; s.error = payload;
      })

      // ── fetchReportById ───────────────────────────────────────
      .addCase(fetchReportById.pending, (s) => {
        s.detailLoading = true;
      })
      .addCase(fetchReportById.fulfilled, (s, { payload }) => {
        s.detailLoading  = false;
        s.selectedReport = payload;
      })
      .addCase(fetchReportById.rejected, (s) => {
        s.detailLoading = false;
      })

      // ── updateReportStatus ────────────────────────────────────
      .addCase(updateReportStatus.pending, (s, { meta }) => {
        s.actionLoading = meta.arg.id;
      })
      .addCase(updateReportStatus.fulfilled, (s, { payload }) => {
        s.actionLoading = null;
        // Update in-list
        const idx = s.reports.findIndex((r) => r._id === payload._id);
        if (idx !== -1) s.reports[idx] = { ...s.reports[idx], ...payload };
        // Update detail panel if open
        if (s.selectedReport?._id === payload._id) {
          s.selectedReport = { ...s.selectedReport, ...payload };
        }
        // Sync sidebar counts — decrement old status, increment new
        // (counts are refreshed on next fetchReports; this is optimistic)
      })
      .addCase(updateReportStatus.rejected, (s, { payload }) => {
        s.actionLoading = null; s.error = payload;
      })

      // ── bulkUpdateReports ─────────────────────────────────────
      .addCase(bulkUpdateReports.pending, (s) => {
        s.bulkLoading = true;
      })
      .addCase(bulkUpdateReports.fulfilled, (s, { payload }) => {
        s.bulkLoading = false;
        // Optimistic update in-list
        payload.ids.forEach((id) => {
          const idx = s.reports.findIndex((r) => r._id === id);
          if (idx !== -1) {
            s.reports[idx].status      = payload.status;
            s.reports[idx].actionTaken = payload.actionTaken;
          }
        });
        s.selectedIds = [];
      })
      .addCase(bulkUpdateReports.rejected, (s, { payload }) => {
        s.bulkLoading = false; s.error = payload;
      });
  },
});

export const {
  setFilters, setPage, resetFilters,
  openReport, closeReport,
  toggleSelectId, selectAllIds, clearSelectedIds,
  clearError,
} = reportsSlice.actions;

export default reportsSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────
export const selectReports        = (s) => s.reports.reports;
export const selectReportsLoading = (s) => s.reports.loading;
export const selectReportsError   = (s) => s.reports.error;
export const selectReportsPagination = (s) => s.reports.pagination;
export const selectReportsCounts  = (s) => s.reports.counts;
export const selectReportsFilters = (s) => s.reports.filters;
export const selectSelectedReport = (s) => s.reports.selectedReport;
export const selectDetailLoading  = (s) => s.reports.detailLoading;
export const selectActionLoading  = (s) => s.reports.actionLoading;
export const selectBulkLoading    = (s) => s.reports.bulkLoading;
export const selectSelectedIds    = (s) => s.reports.selectedIds;