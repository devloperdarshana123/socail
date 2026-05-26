// src/lib/redux/auditLogSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import adminApi from "../../services/api";

// ─────────────────────────────────────────────────────────────────────────────
//  Async Thunks
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAuditLogs = createAsyncThunk(
  "auditLog/fetchLogs",
  async (params = {}, { rejectWithValue }) => {
    try {
      const query = new URLSearchParams();
      const allowed = ["page", "limit", "category", "action", "performedBy", "targetId", "startDate", "endDate", "search"];
      allowed.forEach((key) => {
        if (params[key] !== undefined && params[key] !== "") {
          query.set(key, params[key]);
        }
      });
      const { data } = await adminApi.get(`/admin/audit-logs?${query.toString()}`);
      return data.data; // { logs, pagination }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to fetch audit logs.");
    }
  }
);

export const fetchAuditStats = createAsyncThunk(
  "auditLog/fetchStats",
  async (days = 30, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get(`/admin/audit-logs/stats?days=${days}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to fetch audit stats.");
    }
  }
);

export const fetchAuditConstants = createAsyncThunk(
  "auditLog/fetchConstants",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get("/admin/audit-logs/constants");
      return data.data; // { actions, categories }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to fetch constants.");
    }
  }
);

export const fetchAuditLogById = createAsyncThunk(
  "auditLog/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get(`/admin/audit-logs/${id}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to fetch log detail.");
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
//  Initial State
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // List
  logs:       [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
  loading:    false,
  error:      null,

  // Active filters (kept in Redux so filter state survives tab switches)
  filters: {
    page:        1,
    limit:       20,
    category:    "",
    action:      "",
    performedBy: "",
    targetId:    "",
    startDate:   "",
    endDate:     "",
    search:      "",
  },

  // Stats
  stats:        null,
  statsLoading: false,
  statsError:   null,

  // Constants (action/category enums from backend)
  constants:         null,
  constantsLoading:  false,

  // Detail modal
  selectedLog:       null,
  detailLoading:     false,
  detailError:       null,
};

// ─────────────────────────────────────────────────────────────────────────────
//  Slice
// ─────────────────────────────────────────────────────────────────────────────

const auditLogSlice = createSlice({
  name: "auditLog",
  initialState,

  reducers: {
    setFilters(state, action) {
      // Merge partial filter update + reset to page 1
      state.filters = { ...state.filters, ...action.payload, page: 1 };
    },
    setPage(state, action) {
      state.filters.page = action.payload;
    },
    clearFilters(state) {
      state.filters = { ...initialState.filters };
    },
    clearSelectedLog(state) {
      state.selectedLog = null;
      state.detailError  = null;
    },
    clearErrors(state) {
      state.error       = null;
      state.statsError  = null;
      state.detailError = null;
    },
  },

  extraReducers: (builder) => {
    // ── fetchAuditLogs ──────────────────────────────────────────────────────
    builder
      .addCase(fetchAuditLogs.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(fetchAuditLogs.fulfilled, (state, { payload }) => {
        state.loading    = false;
        state.logs       = payload.logs;
        state.pagination = payload.pagination;
      })
      .addCase(fetchAuditLogs.rejected, (state, { payload }) => {
        state.loading = false;
        state.error   = payload;
      });

    // ── fetchAuditStats ─────────────────────────────────────────────────────
    builder
      .addCase(fetchAuditStats.pending, (state) => {
        state.statsLoading = true;
        state.statsError   = null;
      })
      .addCase(fetchAuditStats.fulfilled, (state, { payload }) => {
        state.statsLoading = false;
        state.stats        = payload;
      })
      .addCase(fetchAuditStats.rejected, (state, { payload }) => {
        state.statsLoading = false;
        state.statsError   = payload;
      });

    // ── fetchAuditConstants ─────────────────────────────────────────────────
    builder
      .addCase(fetchAuditConstants.pending, (state) => {
        state.constantsLoading = true;
      })
      .addCase(fetchAuditConstants.fulfilled, (state, { payload }) => {
        state.constantsLoading = false;
        state.constants        = payload;
      })
      .addCase(fetchAuditConstants.rejected, (state) => {
        state.constantsLoading = false;
      });

    // ── fetchAuditLogById ───────────────────────────────────────────────────
    builder
      .addCase(fetchAuditLogById.pending, (state) => {
        state.detailLoading = true;
        state.detailError   = null;
      })
      .addCase(fetchAuditLogById.fulfilled, (state, { payload }) => {
        state.detailLoading = false;
        state.selectedLog   = payload;
      })
      .addCase(fetchAuditLogById.rejected, (state, { payload }) => {
        state.detailLoading = false;
        state.detailError   = payload;
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  Actions + Selectors
// ─────────────────────────────────────────────────────────────────────────────

export const { setFilters, setPage, clearFilters, clearSelectedLog, clearErrors } =
  auditLogSlice.actions;

// s = full Redux state
export const selectAuditLogs       = (s) => s.auditLog.logs;
export const selectAuditPagination = (s) => s.auditLog.pagination;
export const selectAuditLoading    = (s) => s.auditLog.loading;
export const selectAuditError      = (s) => s.auditLog.error;
export const selectAuditFilters    = (s) => s.auditLog.filters;
export const selectAuditStats      = (s) => s.auditLog.stats;
export const selectAuditStatsLoading = (s) => s.auditLog.statsLoading;
export const selectAuditConstants  = (s) => s.auditLog.constants;
export const selectSelectedLog     = (s) => s.auditLog.selectedLog;
export const selectDetailLoading   = (s) => s.auditLog.detailLoading;

export default auditLogSlice.reducer;