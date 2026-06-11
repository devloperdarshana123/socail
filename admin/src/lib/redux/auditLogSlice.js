// // src/lib/redux/auditLogSlice.js
// import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// import adminApi from "../../services/api";

// // ─────────────────────────────────────────────────────────────────────────────
// //  Async Thunks
// // ─────────────────────────────────────────────────────────────────────────────

// export const fetchAuditLogs = createAsyncThunk(
//   "auditLog/fetchLogs",
//   async (params = {}, { rejectWithValue }) => {
//     try {
//       const query = new URLSearchParams();
//       const allowed = ["page", "limit", "category", "action", "performedBy", "targetId", "startDate", "endDate", "search"];
//       allowed.forEach((key) => {
//         if (params[key] !== undefined && params[key] !== "") {
//           query.set(key, params[key]);
//         }
//       });
//       const { data } = await adminApi.get(`/admin/audit-logs?${query.toString()}`);
//       return data.data; // { logs, pagination }
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message ?? "Failed to fetch audit logs.");
//     }
//   }
// );

// export const fetchAuditStats = createAsyncThunk(
//   "auditLog/fetchStats",
//   async (days = 30, { rejectWithValue }) => {
//     try {
//       const { data } = await adminApi.get(`/admin/audit-logs/stats?days=${days}`);
//       return data.data;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message ?? "Failed to fetch audit stats.");
//     }
//   }
// );

// export const fetchAuditConstants = createAsyncThunk(
//   "auditLog/fetchConstants",
//   async (_, { rejectWithValue }) => {
//     try {
//       const { data } = await adminApi.get("/admin/audit-logs/constants");
//       return data.data; // { actions, categories }
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message ?? "Failed to fetch constants.");
//     }
//   }
// );

// export const fetchAuditLogById = createAsyncThunk(
//   "auditLog/fetchById",
//   async (id, { rejectWithValue }) => {
//     try {
//       const { data } = await adminApi.get(`/admin/audit-logs/${id}`);
//       return data.data;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message ?? "Failed to fetch log detail.");
//     }
//   }
// );

// // ─────────────────────────────────────────────────────────────────────────────
// //  Initial State
// // ─────────────────────────────────────────────────────────────────────────────

// const initialState = {
//   // List
//   logs:       [],
//   pagination: { page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
//   loading:    false,
//   error:      null,

//   // Active filters (kept in Redux so filter state survives tab switches)
//   filters: {
//     page:        1,
//     limit:       20,
//     category:    "",
//     action:      "",
//     performedBy: "",
//     targetId:    "",
//     startDate:   "",
//     endDate:     "",
//     search:      "",
//   },

//   // Stats
//   stats:        null,
//   statsLoading: false,
//   statsError:   null,

//   // Constants (action/category enums from backend)
//   constants:         null,
//   constantsLoading:  false,

//   // Detail modal
//   selectedLog:       null,
//   detailLoading:     false,
//   detailError:       null,
// };

// // ─────────────────────────────────────────────────────────────────────────────
// //  Slice
// // ─────────────────────────────────────────────────────────────────────────────

// const auditLogSlice = createSlice({
//   name: "auditLog",
//   initialState,

//   reducers: {
//     setFilters(state, action) {
//       // Merge partial filter update + reset to page 1
//       state.filters = { ...state.filters, ...action.payload, page: 1 };
//     },
//     setPage(state, action) {
//       state.filters.page = action.payload;
//     },
//     clearFilters(state) {
//       state.filters = { ...initialState.filters };
//     },
//     clearSelectedLog(state) {
//       state.selectedLog = null;
//       state.detailError  = null;
//     },
//     clearErrors(state) {
//       state.error       = null;
//       state.statsError  = null;
//       state.detailError = null;
//     },
//   },

//   extraReducers: (builder) => {
//     // ── fetchAuditLogs ──────────────────────────────────────────────────────
//     builder
//       .addCase(fetchAuditLogs.pending, (state) => {
//         state.loading = true;
//         state.error   = null;
//       })
//       .addCase(fetchAuditLogs.fulfilled, (state, { payload }) => {
//         state.loading    = false;
//         state.logs       = payload.logs;
//         state.pagination = payload.pagination;
//       })
//       .addCase(fetchAuditLogs.rejected, (state, { payload }) => {
//         state.loading = false;
//         state.error   = payload;
//       });

//     // ── fetchAuditStats ─────────────────────────────────────────────────────
//     builder
//       .addCase(fetchAuditStats.pending, (state) => {
//         state.statsLoading = true;
//         state.statsError   = null;
//       })
//       .addCase(fetchAuditStats.fulfilled, (state, { payload }) => {
//         state.statsLoading = false;
//         state.stats        = payload;
//       })
//       .addCase(fetchAuditStats.rejected, (state, { payload }) => {
//         state.statsLoading = false;
//         state.statsError   = payload;
//       });

//     // ── fetchAuditConstants ─────────────────────────────────────────────────
//     builder
//       .addCase(fetchAuditConstants.pending, (state) => {
//         state.constantsLoading = true;
//       })
//       .addCase(fetchAuditConstants.fulfilled, (state, { payload }) => {
//         state.constantsLoading = false;
//         state.constants        = payload;
//       })
//       .addCase(fetchAuditConstants.rejected, (state) => {
//         state.constantsLoading = false;
//       });

//     // ── fetchAuditLogById ───────────────────────────────────────────────────
//     builder
//       .addCase(fetchAuditLogById.pending, (state) => {
//         state.detailLoading = true;
//         state.detailError   = null;
//       })
//       .addCase(fetchAuditLogById.fulfilled, (state, { payload }) => {
//         state.detailLoading = false;
//         state.selectedLog   = payload;
//       })
//       .addCase(fetchAuditLogById.rejected, (state, { payload }) => {
//         state.detailLoading = false;
//         state.detailError   = payload;
//       });
//   },
// });

// // ─────────────────────────────────────────────────────────────────────────────
// //  Actions + Selectors
// // ─────────────────────────────────────────────────────────────────────────────

// export const { setFilters, setPage, clearFilters, clearSelectedLog, clearErrors } =
//   auditLogSlice.actions;

// // s = full Redux state
// export const selectAuditLogs       = (s) => s.auditLog.logs;
// export const selectAuditPagination = (s) => s.auditLog.pagination;
// export const selectAuditLoading    = (s) => s.auditLog.loading;
// export const selectAuditError      = (s) => s.auditLog.error;
// export const selectAuditFilters    = (s) => s.auditLog.filters;
// export const selectAuditStats      = (s) => s.auditLog.stats;
// export const selectAuditStatsLoading = (s) => s.auditLog.statsLoading;
// export const selectAuditConstants  = (s) => s.auditLog.constants;
// export const selectSelectedLog     = (s) => s.auditLog.selectedLog;
// export const selectDetailLoading   = (s) => s.auditLog.detailLoading;

// export default auditLogSlice.reducer;


// src/lib/redux/auditLogSlice.js
import { createSlice, createAsyncThunk, createSelector } from "@reduxjs/toolkit";
import adminApi from "../../services/api";

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

// FIX: Extracted to module level — was defined inline inside the thunk.
// Now it's a single stable reference and can be imported/tested independently.
const ALLOWED_FILTER_KEYS = [
  "page", "limit", "category", "action",
  "performedBy", "targetId", "startDate", "endDate", "search",
];

// Keys that count as "active" filters (excludes pagination)
const FILTERABLE_KEYS = [
  "category", "action", "performedBy",
  "targetId", "startDate", "endDate", "search",
];

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

// FIX: Query string building extracted from thunk into a pure function.
// Pure functions are easier to unit test and don't pollute thunk logic.
function buildAuditQuery(params = {}) {
  const query = new URLSearchParams();
  ALLOWED_FILTER_KEYS.forEach((key) => {
    if (params[key] !== undefined && params[key] !== "") {
      query.set(key, params[key]);
    }
  });
  return query.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Async Thunks
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAuditLogs = createAsyncThunk(
  "auditLog/fetchLogs",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get(`/admin/audit-logs?${buildAuditQuery(params)}`);
      return data.data; // { logs, pagination }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to fetch audit logs.");
    }
  },
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
  },
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
  },
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
  },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Initial State
// ─────────────────────────────────────────────────────────────────────────────

// FIX: Extracted as a named constant so clearFilters reducer can reference it
// directly without spreading initialState (which includes non-filter keys).
const DEFAULT_FILTERS = {
  page:        1,
  limit:       20,
  category:    "",
  action:      "",
  performedBy: "",
  targetId:    "",
  startDate:   "",
  endDate:     "",
  search:      "",
};

const initialState = {
  // List
  logs:       [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
  loading:    false,
  error:      null,

  // Active filters (kept in Redux so filter state survives tab switches)
  filters: { ...DEFAULT_FILTERS },

  // Stats
  stats:        null,
  statsLoading: false,
  statsError:   null,

  // Constants (action/category enums from backend)
  constants:        null,
  constantsLoading: false,
  constantsError:   null, // FIX: was missing — silent failures on rejected

  // Detail modal
  selectedLog:  null,
  detailLoading: false,
  detailError:   null,
};

// ─────────────────────────────────────────────────────────────────────────────
//  Slice
// ─────────────────────────────────────────────────────────────────────────────

const auditLogSlice = createSlice({
  name: "auditLog",
  initialState,

  reducers: {
    setFilters(state, { payload }) {
      // Merge partial filter update + always reset to page 1
      state.filters = { ...state.filters, ...payload, page: 1 };
    },
    setPage(state, { payload }) {
      state.filters.page = payload;
    },
    // FIX: clearFilters now uses DEFAULT_FILTERS directly — no
    // risk of accidentally resetting non-filter state (logs, stats, etc.)
    clearFilters(state) {
      state.filters = { ...DEFAULT_FILTERS };
    },
    clearSelectedLog(state) {
      state.selectedLog = null;
      state.detailError = null;
    },
    clearErrors(state) {
      state.error          = null;
      state.statsError     = null;
      state.detailError    = null;
      state.constantsError = null; // FIX: was missing
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
        state.constantsError   = null; // FIX: clear previous error on retry
      })
      .addCase(fetchAuditConstants.fulfilled, (state, { payload }) => {
        state.constantsLoading = false;
        state.constants        = payload;
      })
      .addCase(fetchAuditConstants.rejected, (state, { payload }) => {
        state.constantsLoading = false;
        // FIX: payload was ignored — error silently swallowed.
        // Now stored so components can show a retry UI if needed.
        state.constantsError   = payload;
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
//  Actions
// ─────────────────────────────────────────────────────────────────────────────

export const { setFilters, setPage, clearFilters, clearSelectedLog, clearErrors } =
  auditLogSlice.actions;

export default auditLogSlice.reducer;

// ─────────────────────────────────────────────────────────────────────────────
//  Selectors
// ─────────────────────────────────────────────────────────────────────────────

// ── Raw selectors ───────────────────────────────────────────────────────────

export const selectAuditLogs          = (s) => s.auditLog.logs;
export const selectAuditPagination    = (s) => s.auditLog.pagination;
export const selectAuditLoading       = (s) => s.auditLog.loading;
export const selectAuditError         = (s) => s.auditLog.error;
export const selectAuditFilters       = (s) => s.auditLog.filters;
export const selectAuditStats         = (s) => s.auditLog.stats;
export const selectAuditStatsLoading  = (s) => s.auditLog.statsLoading;
export const selectAuditConstants     = (s) => s.auditLog.constants;
export const selectAuditConstantsError = (s) => s.auditLog.constantsError; // FIX: new
export const selectSelectedLog        = (s) => s.auditLog.selectedLog;
export const selectDetailLoading      = (s) => s.auditLog.detailLoading;
export const selectDetailError        = (s) => s.auditLog.detailError;      // FIX: was missing

// ── Derived: filters ────────────────────────────────────────────────────────
//
// FIX: These were computed inline in components with manual .filter()/.reduce()
// on every render — new object/number reference each time = unnecessary re-renders.
// Memoized here with createSelector.

// Number of non-empty non-pagination filters currently active
export const selectActiveFilterCount = createSelector(
  selectAuditFilters,
  (filters) => FILTERABLE_KEYS.filter((k) => filters[k] !== "").length,
);

// Boolean — show "Clear filters" button / badge only when needed
export const selectHasActiveFilters = createSelector(
  selectActiveFilterCount,
  (count) => count > 0,
);

// The active non-empty filters as a plain object — useful for filter chips UI
export const selectActiveFilters = createSelector(
  selectAuditFilters,
  (filters) =>
    Object.fromEntries(
      FILTERABLE_KEYS
        .filter((k) => filters[k] !== "")
        .map((k) => [k, filters[k]]),
    ),
);

// ── Derived: pagination ─────────────────────────────────────────────────────

export const selectAuditCurrentPage = createSelector(
  selectAuditPagination,
  (p) => p.page,
);

export const selectAuditTotalPages = createSelector(
  selectAuditPagination,
  (p) => p.totalPages,
);

export const selectAuditTotalCount = createSelector(
  selectAuditPagination,
  (p) => p.total,
);

// ── Derived: constants ──────────────────────────────────────────────────────

// Action options formatted for a <select> — stable array, not rebuilt each render
export const selectActionOptions = createSelector(
  selectAuditConstants,
  (constants) =>
    constants?.actions?.map((a) => ({ value: a, label: a })) ?? [],
);

// Category options formatted for a <select>
export const selectCategoryOptions = createSelector(
  selectAuditConstants,
  (constants) =>
    constants?.categories?.map((c) => ({ value: c, label: c })) ?? [],
);