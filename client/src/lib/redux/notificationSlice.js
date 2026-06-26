

// client/src/lib/redux/notificationSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../services/api";

const BASE = "/notifications";

// ── Async Thunks ──────────────────────────────────────────────────────────





export const fetchNotifications = createAsyncThunk(
  "notifications/fetch",
  async ({ page = 1 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(BASE, { params: { page, limit: 20 } });
      const payload       = data?.data ?? {};
      const notifData     = payload.notifications ?? {};
      const notifications = Array.isArray(notifData.items)
        ? notifData.items
        : Array.isArray(notifData)
        ? notifData
        : [];
      return {
        notifications,
        unreadCount: payload.unreadCount ?? 0,
        hasMore:     notifData.hasMore   ?? notifications.length === 20,
        page,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch");
    }
  }
);


export const markAllReadThunk = createAsyncThunk(
  "notifications/markAllRead",
  async (_, { rejectWithValue }) => {
    try {
      await api.put(`${BASE}/read`);
      return true;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed");
    }
  }
);

export const markOneReadThunk = createAsyncThunk(
  "notifications/markOneRead",
  async (notificationId, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`${BASE}/${notificationId}/read`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed");
    }
  }
);

export const deleteNotificationThunk = createAsyncThunk(
  "notifications/delete",
  async (notificationId, { rejectWithValue }) => {
    try {
      const { data } = await api.delete(`${BASE}/${notificationId}`);
      return { notificationId, unreadCount: data.data.unreadCount };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed");
    }
  }
);

export const clearAllThunk = createAsyncThunk(
  "notifications/clearAll",
  async (_, { rejectWithValue }) => {
    try {
      await api.delete(BASE);
      return true;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed");
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────

const notificationSlice = createSlice({
  name: "notifications",
  initialState: {
    notifications: [],
    unreadCount:   0,
    loading:       false,
    loadingMore:   false,
    hasMore:       true,
    page:          1,
    error:         null,
  },

  reducers: {
    addRealtimeNotification: (state, action) => {
      const incoming = action.payload;
      if (!Array.isArray(state.notifications)) state.notifications = [];

      // Duplicate check — same _id do baar add nahi hogi
      const exists = state.notifications.some((n) => n._id?.toString() === incoming._id?.toString());
      if (exists) return;

      state.notifications.unshift(incoming);

      // Unread count +1 — socket se alag event ka wait nahi
      if (!incoming.isRead) {
        state.unreadCount = (state.unreadCount || 0) + 1;
      }
    },

    // Sirf mark_read/delete ke baad server se authoritative count aane pe use karo
    setUnreadCount: (state, action) => {
      state.unreadCount = typeof action.payload === "number" ? action.payload : state.unreadCount;
    },

    markAllRead: (state) => {
      if (Array.isArray(state.notifications)) {
        state.notifications.forEach((n) => {
          n.isRead = true;
          n.readAt = new Date().toISOString();
        });
      }
      state.unreadCount = 0;
    },

    markOneReadLocal: (state, action) => {
      const n = state.notifications.find((n) => n._id === action.payload);
      if (n && !n.isRead) {
        n.isRead = true;
        n.readAt = new Date().toISOString();
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
  },

  extraReducers: (builder) => {
    // ── fetchNotifications ─────────────────────────────────────────────
    builder
      .addCase(fetchNotifications.pending, (state, action) => {
        if (action.meta.arg?.page > 1) state.loadingMore = true;
        else state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        const { notifications = [], unreadCount, page, hasMore } = action.payload;

        state.loading     = false;
        state.loadingMore = false;
        state.hasMore     = hasMore ?? false;
        state.page        = page;

        // unreadCount sirf DB se aaye authoritative value pe set karo
        // Real-time addRealtimeNotification se aaye duplicate count avoid hoga
        // kyunki page=1 fetch hone pe poori list replace ho jaati hai
        if (typeof unreadCount === "number") {
          state.unreadCount = unreadCount;
        }

        if (page === 1) {
          // Full replace — DB se fresh data
          state.notifications = notifications;
        } else {
          // Infinite scroll — sirf naye add karo
          const existingIds = new Set(state.notifications.map((n) => n._id?.toString()));
          const newOnes = notifications.filter((n) => !existingIds.has(n._id?.toString()));
          state.notifications.push(...newOnes);
        }
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading     = false;
        state.loadingMore = false;
        state.error       = action.payload ?? "Something went wrong";
        // notifications aur unreadCount TOUCH NAHI — purana data safe rahe
      });

    // ── markAllRead ────────────────────────────────────────────────────
    builder.addCase(markAllReadThunk.fulfilled, (state) => {
      state.notifications.forEach((n) => {
        n.isRead = true;
        n.readAt = new Date().toISOString();
      });
      state.unreadCount = 0;
    });

    // ── markOneRead ────────────────────────────────────────────────────
    builder.addCase(markOneReadThunk.fulfilled, (state, action) => {
      const { notification, unreadCount } = action.payload;
      const idx = state.notifications.findIndex((n) => n._id === notification._id);
      if (idx !== -1) state.notifications[idx] = notification;
      if (typeof unreadCount === "number") state.unreadCount = unreadCount;
    });

    // ── deleteNotification ─────────────────────────────────────────────
    builder.addCase(deleteNotificationThunk.fulfilled, (state, action) => {
      const { notificationId, unreadCount } = action.payload;
      state.notifications = state.notifications.filter((n) => n._id !== notificationId);
      if (typeof unreadCount === "number") state.unreadCount = unreadCount;
    });

    // ── clearAll ───────────────────────────────────────────────────────
    builder.addCase(clearAllThunk.fulfilled, (state) => {
      state.notifications = [];
      state.unreadCount   = 0;
    });
  },
});

export const {
  addRealtimeNotification,
  setUnreadCount,
  markOneReadLocal,
  markAllRead,
} = notificationSlice.actions;

export default notificationSlice.reducer;