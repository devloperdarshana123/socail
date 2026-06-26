
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import adminApi from "../../services/api";

const usersAPI = {
  getAll:       (params) => adminApi.get("/admin/users", { params }),
  updateStatus: (id, data) => adminApi.patch(`/admin/users/${id}/status`, data),
  toggleVerify: (id)     => adminApi.patch(`/admin/users/${id}/verify-badge`),
  delete:       (id)     => adminApi.delete(`/admin/users/${id}`),
};

const extractAvatar = (avatar) => {
  if (!avatar) return null;
  if (typeof avatar === "string") return avatar;
  return avatar.url ?? avatar.secure_url ?? avatar.publicId ?? null;
};

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
  async ({ userId, status, reason, duration }, { rejectWithValue }) => {
    try {
      const { data: body } = await usersAPI.updateStatus(userId, { status, reason, duration });
      return {
        userId,
        status:           body.data?.accountStatus   ?? status,
        activeSuspension: body.data?.activeSuspension ?? null,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to update status");
    }
  }
);

export const fetchUserById = createAsyncThunk(
  "users/fetchById",
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get(`/admin/users/${userId}`);
      return {
        user:        normalizeUser(data.data.user),
        posts:       data.data.posts       ?? [],
        reportStats: data.data.reportStats ?? {},
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to fetch user");
    }
  }
);

export const fetchUserPosts = createAsyncThunk(
  "users/fetchUserPosts",
  async ({ userId, page = 1, limit = 20 }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get(`/admin/users/${userId}/posts`, {
        params: { page, limit },
      });
      const posts      = data.data        ?? [];
      const pagination = data.pagination  ?? {};
      return {
        posts,
        pagination,
        // ✅ FIX: actual count from pagination.total — never stale
        actualPostsCount: pagination.total ?? posts.length,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to fetch posts");
    }
  }
);

export const adminDeletePost = createAsyncThunk(
  "users/adminDeletePost",
  async ({ postId, reason }, { rejectWithValue }) => {
    try {
      await adminApi.patch(`/admin/posts/${postId}/remove`, { reason });
      return { postId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Failed to delete post");
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


export const bulkUpdateStatus = createAsyncThunk(
  "users/bulkUpdateStatus",
  async ({ userIds, status, reason, duration }, { rejectWithValue }) => {
    try {
      const { data: body } = await adminApi.post("/admin/users/bulk-status", {
        userIds, status, reason, duration,
      });
      return body;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? "Bulk action failed");
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
  detail:        null,
  detailLoading: false,
  detailError:   null,
  postsLoading:  false,
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
      // ── fetchUsers ──────────────────────────────────────────────────────────
      .addCase(fetchUsers.pending,   (s)              => { s.loading = true; s.error = null; })
      .addCase(fetchUsers.fulfilled, (s, { payload }) => {
        s.loading    = false;
        s.users      = payload.users;
        s.pagination = {
          totalUsers:  payload.totalUsers,
          totalPages:  payload.totalPages,
          currentPage: payload.currentPage,
        };
      })
      .addCase(fetchUsers.rejected,  (s, { payload }) => { s.loading = false; s.error = payload; })

      // ── updateUserStatus ────────────────────────────────────────────────────
      .addCase(updateUserStatus.pending,   (s, { meta })    => { s.actionLoading = meta.arg.userId; })

.addCase(updateUserStatus.fulfilled, (s, { payload }) => {
  s.actionLoading = null;

  const targetId = String(payload.userId);

  // ✅ List mein update — string-safe comparison
  const u = s.users.find((x) => String(x._id ?? x.id) === targetId);
  if (u) {
    u.status           = payload.status;
    u.accountStatus     = payload.status;
    u.activeSuspension  = payload.activeSuspension;
  }

  
  const detailId = s.detail?.user ? String(s.detail.user._id ?? s.detail.user.id) : null;
  if (detailId && detailId === targetId) {
    s.detail.user.status           = payload.status;
    s.detail.user.accountStatus    = payload.status;
    s.detail.user.activeSuspension = payload.activeSuspension;
  }
})
      .addCase(updateUserStatus.rejected,  (s, { payload }) => {
        s.actionLoading = null; s.actionError = payload;
      })

      // ── toggleVerifiedBadge ─────────────────────────────────────────────────
      .addCase(toggleVerifiedBadge.pending,   (s, { meta })    => { s.actionLoading = meta.arg; })
     
      .addCase(toggleVerifiedBadge.fulfilled, (s, { payload }) => {
  s.actionLoading = null;
  const targetId = String(payload.userId);

  const u = s.users.find((x) => String(x._id ?? x.id) === targetId);
  if (u) {
    u.isVerified      = payload.isVerified;
    u.isVerifiedBadge = payload.isVerified;
  }

  const detailId = s.detail?.user ? String(s.detail.user._id ?? s.detail.user.id) : null;
  if (detailId && detailId === targetId) {
    s.detail.user.isVerified      = payload.isVerified;
    s.detail.user.isVerifiedBadge = payload.isVerified;
  }
})
      .addCase(toggleVerifiedBadge.rejected,  (s, { payload }) => {
        s.actionLoading = null; s.actionError = payload;
      })

      // ── deleteUser ──────────────────────────────────────────────────────────
      .addCase(deleteUser.pending,   (s, { meta })    => { s.actionLoading = meta.arg; })
      .addCase(deleteUser.fulfilled, (s, { payload }) => {
        s.actionLoading = null;
        s.users         = s.users.filter((u) => u._id !== payload.userId);
        s.pagination.totalUsers = Math.max(0, s.pagination.totalUsers - 1);
      })
      .addCase(deleteUser.rejected,  (s, { payload }) => {
        s.actionLoading = null; s.actionError = payload;
      })

      // ── fetchUserById ───────────────────────────────────────────────────────
      .addCase(fetchUserById.pending,   (s) => { s.detailLoading = true; s.detailError = null; })
      .addCase(fetchUserById.fulfilled, (s, { payload }) => {
        s.detailLoading = false;
        s.detail        = payload;
      })
      .addCase(fetchUserById.rejected,  (s, { payload }) => {
        s.detailLoading = false; s.detailError = payload;
      })

      // ── fetchUserPosts ──────────────────────────────────────────────────────
      .addCase(fetchUserPosts.pending,   (s) => { s.postsLoading = true; })
      .addCase(fetchUserPosts.fulfilled, (s, { payload }) => {
        s.postsLoading = false;
        if (!s.detail) return;
        s.detail.posts           = payload.posts;
        s.detail.postsPagination = payload.pagination;

        // ✅ KEY FIX: sync postsCount with actual fetched total
        // This corrects stale DB counts (e.g. if post was deleted without decrementing counter)
        if (
          payload.actualPostsCount !== undefined &&
          s.detail.user
        ) {
          s.detail.user.postsCount = payload.actualPostsCount;
        }
      })
      .addCase(fetchUserPosts.rejected,  (s) => { s.postsLoading = false; })

      // ── adminDeletePost ─────────────────────────────────────────────────────
      .addCase(adminDeletePost.pending, (s, { meta }) => { s.actionLoading = meta.arg.postId; })
.addCase(adminDeletePost.fulfilled, (s, { payload }) => {
  s.actionLoading = null;
  if (!s.detail) return;
  const before = s.detail.posts?.length ?? 0;
  s.detail.posts = s.detail.posts?.filter((p) => p.id !== payload.postId) ?? [];
  const deleted = before - s.detail.posts.length;
  if (deleted > 0 && s.detail.user) {
    s.detail.user.postsCount = Math.max(0, (s.detail.user.postsCount ?? 0) - deleted);
  }
})
.addCase(adminDeletePost.rejected, (s, { payload }) => {
  s.actionLoading = null; s.actionError = payload;
})
.addCase(bulkUpdateStatus.fulfilled, (s, { payload }) => {
  const successIds = new Set(payload.data?.success ?? []);
  s.users = s.users.map((u) =>
    successIds.has(u._id)
      ? { ...u, status: "suspended", accountStatus: "suspended" }
      : u
  );
})

  },
});

export const { setFilters, setPage, resetFilters, clearErrors } = usersSlice.actions;
export default usersSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectUsers           = (s) => s.users.users;
export const selectUsersLoading    = (s) => s.users.loading;
export const selectUsersError      = (s) => s.users.error;
export const selectActionLoading   = (s) => s.users.actionLoading;
export const selectActionError     = (s) => s.users.actionError;
export const selectUsersPagination = (s) => s.users.pagination;
export const selectUsersFilters    = (s) => s.users.filters;
export const selectUserDetail      = (s) => s.users.detail;
export const selectDetailLoading   = (s) => s.users.detailLoading;
export const selectPostsLoading    = (s) => s.users.postsLoading;