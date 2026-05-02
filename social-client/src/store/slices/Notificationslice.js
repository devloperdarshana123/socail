import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9001";

const getToken = () => localStorage.getItem("erosocial_token");

// ── Fetch notifications ──
export const fetchNotifications = createAsyncThunk(
  "notifications/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      return res.data.notifications;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// ── Mark all read ──
export const markAllRead = createAsyncThunk(
  "notifications/markAllRead",
  async (_, { rejectWithValue }) => {
    try {
      await axios.put(`${BASE_URL}/api/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
    } catch (err) {
      return rejectWithValue(err.message);
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