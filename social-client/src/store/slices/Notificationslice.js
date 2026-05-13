import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api"

// ── Fetch notifications ──
export const fetchNotifications = createAsyncThunk(
  "notifications/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/notifications");
      return data.notifications;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch notifications!");
    }
  }
);

// ── Mark all read ──
export const markAllRead = createAsyncThunk(
  "notifications/markAllRead",
  async (_, { rejectWithValue }) => {
    try {
      await api.put("/notifications/read-all");
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to mark notifications as read!");
    }
  }
);

const notificationSlice = createSlice({
  name: "notifications",
  initialState: {
    list:    [],
    unread:  0,
    loading: false,
  },
  reducers: {
    // Socket se aaya naya notification
    addNotification: (state, action) => {
      state.list.unshift({ ...action.payload, isRead: false, createdAt: new Date() });
      state.list = state.list.slice(0, 50);
      state.unread += 1;
    },
    // Bell click pe count reset
    resetUnread: (state) => {
      state.unread = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.list    = action.payload;
        state.unread  = action.payload.filter(n => !n.isRead).length;
      })
      .addCase(markAllRead.fulfilled, (state) => {
        state.list   = state.list.map(n => ({ ...n, isRead: true }));
        state.unread = 0;
      });
  },
});

export const { addNotification, resetUnread } = notificationSlice.actions;
export default notificationSlice.reducer;