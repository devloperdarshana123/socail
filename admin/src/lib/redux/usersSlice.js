

// import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// import adminApi from "../../services/api";

// const usersAPI = {
//   getAll:       (params) => adminApi.get("/admin/users", { params }),
//   updateStatus: (id, data) => adminApi.patch(`/admin/users/${id}/status`, data),
//   toggleVerify: (id)     => adminApi.patch(`/admin/users/${id}/verify-badge`),
//   delete:       (id)     => adminApi.delete(`/admin/users/${id}`),
// };

// // ── Normalize user — backend field names → frontend field names ──────────────
// const normalizeUser = (u) => ({
//   ...u,
//   status:         u.accountStatus ?? u.status ?? "active",
//   isVerified:     u.isVerifiedBadge ?? u.isVerified ?? false,
//   profilePicture: u.avatar ?? u.profilePicture ?? null,
// });

// // ── Thunks ───────────────────────────────────────────────────────────────────

// export const fetchUsers = createAsyncThunk(
//   "users/fetchAll",
//   async (params, { rejectWithValue }) => {
//     try {
//       const res = await usersAPI.getAll(params);
//       const d   = res.data;

//       // Backend returns: { success, data: [...users], pagination: {...} }
//       const users      = Array.isArray(d.data) ? d.data : [];
//       const pagination = d.pagination ?? {};

//       return {
//         users:      users.map(normalizeUser),
//         totalUsers: pagination.total      ?? users.length,
//         totalPages: pagination.totalPages ?? 1,
//         currentPage: pagination.page      ?? 1,
//       };
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message ?? "Failed to fetch users");
//     }
//   }
// );

// export const updateUserStatus = createAsyncThunk(
//   "users/updateStatus",
//   async ({ userId, status, reason }, { rejectWithValue }) => {
//     try {
//       const res = await usersAPI.updateStatus(userId, { status, reason });
//       return { userId, ...res.data.data };
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message ?? "Failed to update status");
//     }
//   }
// );

// export const toggleVerifiedBadge = createAsyncThunk(
//   "users/toggleVerify",
//   async (userId, { rejectWithValue }) => {
//     try {
//       const res = await usersAPI.toggleVerify(userId);
//       return { userId, isVerifiedBadge: res.data.data.isVerifiedBadge };
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message ?? "Failed to toggle badge");
//     }
//   }
// );

// export const deleteUser = createAsyncThunk(
//   "users/delete",
//   async (userId, { rejectWithValue }) => {
//     try {
//       await usersAPI.delete(userId);
//       return { userId };
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message ?? "Failed to delete user");
//     }
//   }
// );

// // ── Initial state ─────────────────────────────────────────────────────────────

// const initialState = {
//   users:         [],
//   loading:       false,
//   error:         null,
//   actionLoading: null,
//   actionError:   null,
//   pagination: {
//     totalUsers:  0,
//     totalPages:  1,
//     currentPage: 1,
//   },
//   filters: {
//     search:    "",
//     role:      "",
//     status:    "",
//     verified:  "",
//     sortBy:    "createdAt",
//     sortOrder: "desc",
//     page:      1,
//     limit:     12,
//   },
// };

// // ── Slice ─────────────────────────────────────────────────────────────────────

// const usersSlice = createSlice({
//   name: "users",
//   initialState,
//   reducers: {
//     setFilters(state, { payload }) {
//       state.filters = { ...state.filters, ...payload };
//     },
//     setPage(state, { payload }) {
//       state.filters.page = payload;
//     },
//     resetFilters(state) {
//       state.filters = initialState.filters;
//     },
//     clearErrors(state) {
//       state.error       = null;
//       state.actionError = null;
//     },
//   },
//   extraReducers: (builder) => {
//     // fetchUsers
//     builder
//       .addCase(fetchUsers.pending, (state) => {
//         state.loading = true;
//         state.error   = null;
//       })
//       .addCase(fetchUsers.fulfilled, (state, { payload }) => {
//         state.loading          = false;
//         state.users            = payload.users;
//         state.pagination       = {
//           totalUsers:  payload.totalUsers,
//           totalPages:  payload.totalPages,
//           currentPage: payload.currentPage,
//         };
//       })
//       .addCase(fetchUsers.rejected, (state, { payload }) => {
//         state.loading = false;
//         state.error   = payload;
//       });

//     // updateUserStatus
//     builder
//       .addCase(updateUserStatus.pending, (state, { meta }) => {
//         state.actionLoading = meta.arg.userId;
//       })
//       .addCase(updateUserStatus.fulfilled, (state, { payload }) => {
//         state.actionLoading = null;
//         const u = state.users.find((x) => x._id === payload.userId);
//         if (u) {
//           u.status        = payload.accountStatus ?? payload.status ?? u.status;
//           u.accountStatus = u.status;
//         }
//       })
//       .addCase(updateUserStatus.rejected, (state, { payload }) => {
//         state.actionLoading = null;
//         state.actionError   = payload;
//       });

//     // toggleVerifiedBadge
//     builder
//       .addCase(toggleVerifiedBadge.pending, (state, { meta }) => {
//         state.actionLoading = meta.arg;
//       })
//       .addCase(toggleVerifiedBadge.fulfilled, (state, { payload }) => {
//         state.actionLoading = null;
//         const u = state.users.find((x) => x._id === payload.userId);
//         if (u) {
//           u.isVerified     = payload.isVerifiedBadge;
//           u.isVerifiedBadge = payload.isVerifiedBadge;
//         }
//       })
//       .addCase(toggleVerifiedBadge.rejected, (state, { payload }) => {
//         state.actionLoading = null;
//         state.actionError   = payload;
//       });

//     // deleteUser
//     builder
//       .addCase(deleteUser.pending, (state, { meta }) => {
//         state.actionLoading = meta.arg;
//       })
//       .addCase(deleteUser.fulfilled, (state, { payload }) => {
//         state.actionLoading = null;
//         state.users         = state.users.filter((u) => u._id !== payload.userId);
//         state.pagination.totalUsers = Math.max(0, state.pagination.totalUsers - 1);
//       })
//       .addCase(deleteUser.rejected, (state, { payload }) => {
//         state.actionLoading = null;
//         state.actionError   = payload;
//       });
//   },
// });

// export const { setFilters, setPage, resetFilters, clearErrors } = usersSlice.actions;
// export default usersSlice.reducer;

// // ── Selectors ─────────────────────────────────────────────────────────────────
// export const selectUsers           = (s) => s.users.users;
// export const selectUsersLoading    = (s) => s.users.loading;
// export const selectUsersError      = (s) => s.users.error;
// export const selectActionLoading   = (s) => s.users.actionLoading;
// export const selectActionError     = (s) => s.users.actionError;
// export const selectUsersPagination = (s) => s.users.pagination;
// export const selectUsersFilters    = (s) => s.users.filters;




import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import adminApi from "../../services/api";

const usersAPI = {
  getAll:       (params) => adminApi.get("/admin/users", { params }),
  updateStatus: (id, data) => adminApi.patch(`/admin/users/${id}/status`, data),
  toggleVerify: (id)     => adminApi.patch(`/admin/users/${id}/verify-badge`),
  delete:       (id)     => adminApi.delete(`/admin/users/${id}`),
};

// ── Avatar extract — handles string, { url }, { secure_url }, null ───────────
const extractAvatar = (avatar) => {
  if (!avatar) return null;
  if (typeof avatar === "string") return avatar;
  return avatar.url ?? avatar.secure_url ?? avatar.publicId ?? null;
};

// ── Normalize — maps any backend shape to consistent frontend fields ──────────
const normalizeUser = (u) => ({
  ...u,
  profilePicture: extractAvatar(u.avatar ?? u.profilePicture),
  status:         u.accountStatus ?? u.status ?? "active",
  isVerified:     u.isVerifiedBadge ?? u.isVerified ?? false,
  postsCount:     u.postsCount ?? 0,
  followersCount: u.followersCount ?? 0,
  followingCount: u.followingCount ?? 0,
});

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchUsers = createAsyncThunk(
  "users/fetchAll",
  async (params, { rejectWithValue }) => {
    try {
      const { data: body } = await usersAPI.getAll(params);
      const users      = Array.isArray(body.data) ? body.data : [];
      const pagination = body.pagination ?? {};
      return {
        users:       users.map(normalizeUser),
        totalUsers:  pagination.total      ?? users.length,
        totalPages:  pagination.totalPages ?? 1,
        currentPage: pagination.page       ?? 1,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to fetch users");
    }
  }
);

export const updateUserStatus = createAsyncThunk(
  "users/updateStatus",
  async ({ userId, status, reason }, { rejectWithValue }) => {
    try {
      const { data: body } = await usersAPI.updateStatus(userId, { status, reason });
      return { userId, status: body.data?.accountStatus ?? status };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to update status");
    }
  }
);

export const toggleVerifiedBadge = createAsyncThunk(
  "users/toggleVerify",
  async (userId, { rejectWithValue }) => {
    try {
      const { data: body } = await usersAPI.toggleVerify(userId);
      return { userId, isVerified: body.data?.isVerifiedBadge ?? false };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to toggle badge");
    }
  }
);

export const deleteUser = createAsyncThunk(
  "users/delete",
  async (userId, { rejectWithValue }) => {
    try {
      await usersAPI.delete(userId);
      return { userId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to delete user");
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const initialState = {
  users:         [],
  loading:       false,
  error:         null,
  actionLoading: null,
  actionError:   null,
  pagination: { totalUsers: 0, totalPages: 1, currentPage: 1 },
  filters: {
    search: "", role: "", status: "", verified: "",
    sortBy: "createdAt", sortOrder: "desc", page: 1, limit: 12,
  },
};

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    setFilters:   (state, { payload }) => { state.filters = { ...state.filters, ...payload }; },
    setPage:      (state, { payload }) => { state.filters.page = payload; },
    resetFilters: (state)              => { state.filters = initialState.filters; },
    clearErrors:  (state)              => { state.error = null; state.actionError = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending,   (s)         => { s.loading = true; s.error = null; })
      .addCase(fetchUsers.fulfilled, (s, { payload }) => {
        s.loading    = false;
        s.users      = payload.users;
        s.pagination = { totalUsers: payload.totalUsers, totalPages: payload.totalPages, currentPage: payload.currentPage };
      })
      .addCase(fetchUsers.rejected,  (s, { payload }) => { s.loading = false; s.error = payload; })

      .addCase(updateUserStatus.pending,   (s, { meta })    => { s.actionLoading = meta.arg.userId; })
      .addCase(updateUserStatus.fulfilled, (s, { payload }) => {
        s.actionLoading = null;
        const u = s.users.find((x) => x._id === payload.userId);
        if (u) { u.status = payload.status; u.accountStatus = payload.status; }
      })
      .addCase(updateUserStatus.rejected,  (s, { payload }) => { s.actionLoading = null; s.actionError = payload; })

      .addCase(toggleVerifiedBadge.pending,   (s, { meta })    => { s.actionLoading = meta.arg; })
      .addCase(toggleVerifiedBadge.fulfilled, (s, { payload }) => {
        s.actionLoading = null;
        const u = s.users.find((x) => x._id === payload.userId);
        if (u) { u.isVerified = payload.isVerified; u.isVerifiedBadge = payload.isVerified; }
      })
      .addCase(toggleVerifiedBadge.rejected,  (s, { payload }) => { s.actionLoading = null; s.actionError = payload; })

      .addCase(deleteUser.pending,   (s, { meta })    => { s.actionLoading = meta.arg; })
      .addCase(deleteUser.fulfilled, (s, { payload }) => {
        s.actionLoading = null;
        s.users         = s.users.filter((u) => u._id !== payload.userId);
        s.pagination.totalUsers = Math.max(0, s.pagination.totalUsers - 1);
      })
      .addCase(deleteUser.rejected,  (s, { payload }) => { s.actionLoading = null; s.actionError = payload; });
  },
});

export const { setFilters, setPage, resetFilters, clearErrors } = usersSlice.actions;
export default usersSlice.reducer;

export const selectUsers           = (s) => s.users.users;
export const selectUsersLoading    = (s) => s.users.loading;
export const selectUsersError      = (s) => s.users.error;
export const selectActionLoading   = (s) => s.users.actionLoading;
export const selectActionError     = (s) => s.users.actionError;
export const selectUsersPagination = (s) => s.users.pagination;
export const selectUsersFilters    = (s) => s.users.filters;