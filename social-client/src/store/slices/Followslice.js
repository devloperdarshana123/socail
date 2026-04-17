import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// ── Fetch Incoming Follow Requests ────────────────────────
export const fetchFollowRequests = createAsyncThunk(
  "follow/fetchFollowRequests",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/follow/requests");
      return data.requests || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Requests load nahi hue!");
    }
  }
);

// ── Accept Follow Request ─────────────────────────────────
export const acceptFollowRequest = createAsyncThunk(
  "follow/acceptFollowRequest",
  async (userId, { rejectWithValue }) => {
    try {
      await api.post(`/follow/${userId}/accept`);
      return userId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Accept failed!");
    }
  }
);

// ── Reject Follow Request ─────────────────────────────────
export const rejectFollowRequest = createAsyncThunk(
  "follow/rejectFollowRequest",
  async (userId, { rejectWithValue }) => {
    try {
      await api.delete(`/follow/${userId}/reject`);
      return userId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Reject failed!");
    }
  }
);

// ── Send Follow Request ───────────────────────────────────
export const sendFollowRequest = createAsyncThunk(
  "follow/sendFollowRequest",
  async (userId, { rejectWithValue }) => {
    try {
      await api.post(`/follow/${userId}/send`);
      return userId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Send failed!");
    }
  }
);

// ── Cancel Follow Request ─────────────────────────────────
export const cancelFollowRequest = createAsyncThunk(
  "follow/cancelFollowRequest",
  async (userId, { rejectWithValue }) => {
    try {
      await api.delete(`/follow/${userId}/cancel`);
      return userId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Cancel failed!");
    }
  }
);

// ── Slice ─────────────────────────────────────────────────
const followSlice = createSlice({
  name: "follow",
  initialState: {
    requests:        [],   // incoming follow requests
    pendingRequests: [],   // outgoing requests jo maine bheje
    loading:         false,
    error:           null,
  },
  reducers: {},
  extraReducers: (builder) => {

    // fetchFollowRequests
    builder
      .addCase(fetchFollowRequests.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(fetchFollowRequests.fulfilled, (state, action) => { state.loading = false; state.requests = action.payload; })
      .addCase(fetchFollowRequests.rejected,  (state, action) => { state.loading = false; state.error = action.payload; });

    // acceptFollowRequest
    builder
      .addCase(acceptFollowRequest.fulfilled, (state, action) => {
        state.requests = state.requests.filter((r) => r._id !== action.payload && r.sender?._id !== action.payload);
      });

    // rejectFollowRequest
    builder
      .addCase(rejectFollowRequest.fulfilled, (state, action) => {
        state.requests = state.requests.filter((r) => r._id !== action.payload && r.sender?._id !== action.payload);
      });

    // sendFollowRequest
    builder
      .addCase(sendFollowRequest.fulfilled, (state, action) => {
        state.pendingRequests.push(action.payload);
      });

    // cancelFollowRequest
    builder
      .addCase(cancelFollowRequest.fulfilled, (state, action) => {
        state.pendingRequests = state.pendingRequests.filter((id) => id !== action.payload);
      });
  },
});

export default followSlice.reducer;