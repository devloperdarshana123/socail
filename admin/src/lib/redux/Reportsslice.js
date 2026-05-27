// import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// import adminApi from "../../services/api";

// // ─────────────────────────────────────────────────────────────
// //  Thunks
// // ─────────────────────────────────────────────────────────────

// export const fetchReports = createAsyncThunk(
//   "reports/fetchAll",
//   async (params, { rejectWithValue }) => {
//     try {
//       const { data } = await adminApi.get("/admin/reports", { params });
//       return {
//         reports:    data.data        ?? [],
//         pagination: data.pagination  ?? {},
//         counts:     data.counts      ?? {},
//       };
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message ?? "Failed to fetch reports");
//     }
//   }
// );

// export const fetchReportById = createAsyncThunk(
//   "reports/fetchById",
//   async (id, { rejectWithValue }) => {
//     try {
//       const { data } = await adminApi.get(`/admin/reports/${id}`);
//       return data.data;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message ?? "Failed to fetch report");
//     }
//   }
// );

// export const updateReportStatus = createAsyncThunk(
//   "reports/updateStatus",
//   async ({ id, status, actionTaken, moderatorNote }, { rejectWithValue }) => {
//     try {
//       const { data } = await adminApi.patch(`/admin/reports/${id}/status`, {
//         status,
//         actionTaken,
//         moderatorNote,
//       });
//       return data.data;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message ?? "Failed to update report");
//     }
//   }
// );

// export const bulkUpdateReports = createAsyncThunk(
//   "reports/bulkUpdate",
//   async ({ ids, status, actionTaken = "none" }, { rejectWithValue }) => {
//     try {
//       const { data } = await adminApi.patch("/admin/reports/bulk", {
//         ids, status, actionTaken,
//       });
//       return { ids, status, actionTaken, modifiedCount: data.data.modifiedCount };
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message ?? "Failed to bulk update");
//     }
//   }
// );

// // ─────────────────────────────────────────────────────────────
// //  Initial State
// // ─────────────────────────────────────────────────────────────

// const initialState = {
//   reports:        [],
//   selectedReport: null,
//   loading:        false,
//   detailLoading:  false,
//   actionLoading:  null,   // reportId being actioned
//   bulkLoading:    false,
//   error:          null,
//   pagination: { total: 0, totalPages: 1, page: 1, limit: 20 },
//   counts: {
//     all: 0, pending: 0, under_review: 0,
//     resolved_action_taken: 0, resolved_no_action: 0, dismissed: 0,
//   },
//   filters: {
//     status: "", targetModel: "", reason: "",
//     sortOrder: "desc", page: 1, limit: 20,
//   },
//   selectedIds: [],   // for bulk actions
// };

// // ─────────────────────────────────────────────────────────────
// //  Slice
// // ─────────────────────────────────────────────────────────────

// const reportsSlice = createSlice({
//   name: "reports",
//   initialState,
//   reducers: {
//     setFilters: (state, { payload }) => {
//       state.filters = { ...state.filters, ...payload, page: 1 };
//     },
//     setPage: (state, { payload }) => {
//       state.filters.page = payload;
//     },
//     resetFilters: (state) => {
//       state.filters = initialState.filters;
//     },
//     openReport: (state, { payload }) => {
//       state.selectedReport = payload;
//     },
//     closeReport: (state) => {
//       state.selectedReport = null;
//     },
//     toggleSelectId: (state, { payload }) => {
//       const idx = state.selectedIds.indexOf(payload);
//       if (idx === -1) state.selectedIds.push(payload);
//       else            state.selectedIds.splice(idx, 1);
//     },
//     selectAllIds: (state) => {
//       state.selectedIds = state.reports.map((r) => r._id);
//     },
//     clearSelectedIds: (state) => {
//       state.selectedIds = [];
//     },
//     clearError: (state) => {
//       state.error = null;
//     },
//   },
//   extraReducers: (builder) => {
//     builder
//       // ── fetchReports ──────────────────────────────────────────
//       .addCase(fetchReports.pending, (s) => {
//         s.loading = true; s.error = null;
//       })
//       .addCase(fetchReports.fulfilled, (s, { payload }) => {
//         s.loading    = false;
//         s.reports    = payload.reports;
//         s.pagination = payload.pagination;
//         s.counts     = { ...s.counts, ...payload.counts };
//         s.selectedIds = [];
//       })
//       .addCase(fetchReports.rejected, (s, { payload }) => {
//         s.loading = false; s.error = payload;
//       })

//       // ── fetchReportById ───────────────────────────────────────
//       .addCase(fetchReportById.pending, (s) => {
//         s.detailLoading = true;
//       })
//       .addCase(fetchReportById.fulfilled, (s, { payload }) => {
//         s.detailLoading  = false;
//         s.selectedReport = payload;
//       })
//       .addCase(fetchReportById.rejected, (s) => {
//         s.detailLoading = false;
//       })

//       // ── updateReportStatus ────────────────────────────────────
//       .addCase(updateReportStatus.pending, (s, { meta }) => {
//         s.actionLoading = meta.arg.id;
//       })
//       .addCase(updateReportStatus.fulfilled, (s, { payload }) => {
//         s.actionLoading = null;
//         // Update in-list
//         const idx = s.reports.findIndex((r) => r._id === payload._id);
//         if (idx !== -1) s.reports[idx] = { ...s.reports[idx], ...payload };
//         // Update detail panel if open
//         if (s.selectedReport?._id === payload._id) {
//           s.selectedReport = { ...s.selectedReport, ...payload };
//         }
//         // Sync sidebar counts — decrement old status, increment new
//         // (counts are refreshed on next fetchReports; this is optimistic)
//       })
//       .addCase(updateReportStatus.rejected, (s, { payload }) => {
//         s.actionLoading = null; s.error = payload;
//       })

//       // ── bulkUpdateReports ─────────────────────────────────────
//       .addCase(bulkUpdateReports.pending, (s) => {
//         s.bulkLoading = true;
//       })
//       .addCase(bulkUpdateReports.fulfilled, (s, { payload }) => {
//         s.bulkLoading = false;
//         // Optimistic update in-list
//         payload.ids.forEach((id) => {
//           const idx = s.reports.findIndex((r) => r._id === id);
//           if (idx !== -1) {
//             s.reports[idx].status      = payload.status;
//             s.reports[idx].actionTaken = payload.actionTaken;
//           }
//         });
//         s.selectedIds = [];
//       })
//       .addCase(bulkUpdateReports.rejected, (s, { payload }) => {
//         s.bulkLoading = false; s.error = payload;
//       });
//   },
// });

// export const {
//   setFilters, setPage, resetFilters,
//   openReport, closeReport,
//   toggleSelectId, selectAllIds, clearSelectedIds,
//   clearError,
// } = reportsSlice.actions;

// export default reportsSlice.reducer;

// // ── Selectors ─────────────────────────────────────────────────
// export const selectReports        = (s) => s.reports.reports;
// export const selectReportsLoading = (s) => s.reports.loading;
// export const selectReportsError   = (s) => s.reports.error;
// export const selectReportsPagination = (s) => s.reports.pagination;
// export const selectReportsCounts  = (s) => s.reports.counts;
// export const selectReportsFilters = (s) => s.reports.filters;
// export const selectSelectedReport = (s) => s.reports.selectedReport;
// export const selectDetailLoading  = (s) => s.reports.detailLoading;
// export const selectActionLoading  = (s) => s.reports.actionLoading;
// export const selectBulkLoading    = (s) => s.reports.bulkLoading;
// export const selectSelectedIds    = (s) => s.reports.selectedIds;




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
        priorities: data.priorities  ?? {},
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

export const claimReport = createAsyncThunk(
  "reports/claim",
  async ({ id, ttlMinutes = 30 }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.post(`/admin/reports/${id}/claim`, { ttlMinutes });
      return { id, claimData: data.data };
    } catch (err) {
      // 409 = already claimed — return the claimer info, don't reject
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

// ─────────────────────────────────────────────────────────────
//  Initial State
// ─────────────────────────────────────────────────────────────

const initialState = {
  reports:        [],
  selectedReport: null,
  reportHistory:  null,   // { items, total, openCount, hasMore, nextCursor }
  loading:        false,
  detailLoading:  false,
  historyLoading: false,
  actionLoading:  null,   // reportId being actioned
  claimLoading:   null,   // reportId being claimed/released
  escalateLoading:null,
  bulkLoading:    false,
  error:          null,
  claimError:     null,   // { code, message, data } for 409 conflicts
  pagination: { total: 0, totalPages: 1, page: 1, limit: 20 },
  counts: {
    all: 0, pending: 0, under_review: 0,
    resolved_action_taken: 0, resolved_no_action: 0, dismissed: 0,
  },
  priorities: { low: 0, medium: 0, high: 0, critical: 0 },
  filters: {
    status:       "",
    targetModel:  "",
    reason:       "",
    priority:     "",
    escalated:    "",
    claimedByMe:  "",
    unclaimedOnly:"",
    sortOrder:    "desc",
    page:         1,
    limit:        20,
  },
  selectedIds: [],
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
      state.reportHistory  = null;
    },
    closeReport: (state) => {
      state.selectedReport = null;
      state.reportHistory  = null;
      state.claimError     = null;
    },
    clearClaimError: (state) => {
      state.claimError = null;
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
        s.loading     = false;
        s.reports     = payload.reports;
        s.pagination  = payload.pagination;
        s.counts      = { ...s.counts, ...payload.counts };
        s.priorities  = { ...s.priorities, ...payload.priorities };
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
        s.reportHistory  = null;
      })
      .addCase(fetchReportById.rejected, (s) => {
        s.detailLoading = false;
      })

      // ── fetchReportHistory ────────────────────────────────────
      .addCase(fetchReportHistory.pending, (s) => {
        s.historyLoading = true;
      })
      .addCase(fetchReportHistory.fulfilled, (s, { payload }) => {
        s.historyLoading = false;
        s.reportHistory  = payload;
      })
      .addCase(fetchReportHistory.rejected, (s) => {
        s.historyLoading = false;
      })

      // ── updateReportStatus ────────────────────────────────────
      .addCase(updateReportStatus.pending, (s, { meta }) => {
        s.actionLoading = meta.arg.id;
      })
      .addCase(updateReportStatus.fulfilled, (s, { payload }) => {
        s.actionLoading = null;
        const idx = s.reports.findIndex((r) => r._id === payload._id);
        if (idx !== -1) s.reports[idx] = { ...s.reports[idx], ...payload };
        if (s.selectedReport?._id === payload._id) {
          s.selectedReport = { ...s.selectedReport, ...payload };
        }
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
      })

      // ── claimReport ───────────────────────────────────────────
      .addCase(claimReport.pending, (s, { meta }) => {
        s.claimLoading = meta.arg.id;
        s.claimError   = null;
      })
      .addCase(claimReport.fulfilled, (s, { payload }) => {
        s.claimLoading = null;
        // Update in list
        const idx = s.reports.findIndex((r) => r._id === payload.id);
        if (idx !== -1) {
          s.reports[idx].claimedBy      = payload.claimData?.claimedBy ?? null;
          s.reports[idx].claimedAt      = payload.claimData?.claimedAt ?? null;
          s.reports[idx].claimExpiresAt = payload.claimData?.claimExpiresAt ?? null;
        }
        // Update detail panel
        if (s.selectedReport?._id === payload.id) {
          s.selectedReport = { ...s.selectedReport, ...payload.claimData };
        }
      })
      .addCase(claimReport.rejected, (s, { payload }) => {
        s.claimLoading = null;
        s.claimError   = payload ?? null;
      })

      // ── releaseReport ─────────────────────────────────────────
      .addCase(releaseReport.pending, (s, { meta }) => {
        s.claimLoading = meta.arg;
      })
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
      .addCase(releaseReport.rejected, (s, { payload }) => {
        s.claimLoading = null; s.error = payload;
      })

      // ── escalateReport ────────────────────────────────────────
      .addCase(escalateReport.pending, (s, { meta }) => {
        s.escalateLoading = meta.arg.id;
      })
      .addCase(escalateReport.fulfilled, (s, { payload }) => {
        s.escalateLoading = null;
        const idx = s.reports.findIndex((r) => r._id === payload._id);
        if (idx !== -1) s.reports[idx] = { ...s.reports[idx], ...payload };
        if (s.selectedReport?._id === payload._id) {
          s.selectedReport = { ...s.selectedReport, ...payload };
        }
      })
      .addCase(escalateReport.rejected, (s, { payload }) => {
        s.escalateLoading = null; s.error = payload;
      });
  },
});

export const {
  setFilters, setPage, resetFilters,
  openReport, closeReport,
  clearClaimError,
  toggleSelectId, selectAllIds, clearSelectedIds,
  clearError,
} = reportsSlice.actions;

export default reportsSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────
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
export const selectEscalateLoading   = (s) => s.reports.escalateLoading;
export const selectBulkLoading       = (s) => s.reports.bulkLoading;
export const selectSelectedIds       = (s) => s.reports.selectedIds;