


import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// ── Async Thunks ──────────────────────────────────────────────────────────────

export const fetchConversations = createAsyncThunk(
  "messages/fetchConversations",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/messages");
      return data.conversations || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to load conversations");
    }
  }
);

// ── NEW: Following list for sidebar ──────────────────────────────────────────
export const fetchFollowingForMessages = createAsyncThunk(
  "messages/fetchFollowingForMessages",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/messages/following");
      return data.followingList || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to load following");
    }
  }
);

export const getOrCreateConversation = createAsyncThunk(
  "messages/getOrCreateConversation",
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/messages/with/${userId}`);
      return data.conversation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to open conversation");
    }
  }
);

export const fetchMessages = createAsyncThunk(
  "messages/fetchMessages",
  async ({ conversationId, page = 1 }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/messages/${conversationId}/messages?page=${page}&limit=30`);
      return { conversationId, messages: data.messages, pagination: data.pagination, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to load messages");
    }
  }
);

export const fetchTotalUnread = createAsyncThunk(
  "messages/fetchTotalUnread",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/messages/unread");
      return data.unread || 0;
    } catch {
      return 0;
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────
const messagesSlice = createSlice({
  name: "messages",
  initialState: {
    followingList:        [],
    conversations:        [],
    activeConversation:   null,
    messages:             [],
    totalUnread:          0,
    loadingFollowing:     false,
    loadingConversations: false,
    loadingMessages:      false,
    hasMoreMessages:      false,
    typingUsers:          {},
    onlineUsers:          [],
    error:                null,
  },
  reducers: {
    setActiveConversation: (state, action) => {
      state.activeConversation = action.payload;
      state.messages = [];
      state.hasMoreMessages = false;
    },

    appendMessage: (state, action) => {
      const msg = action.payload;
      const exists = state.messages.some((m) => m._id === msg._id);
      if (!exists) state.messages.push(msg);

      const item = state.followingList.find(
        (f) => f.conversation?._id === msg.conversation ||
               f.user?._id === msg.sender?._id
      );
      if (item) {
        if (!item.conversation) {
          item.conversation = { _id: msg.conversation, lastMessage: msg };
        } else {
          item.conversation.lastMessage = msg;
        }

        const isActiveConv = state.activeConversation?._id === msg.conversation;
        if (!isActiveConv) {
          item.myUnread = (item.myUnread || 0) + 1;
          state.totalUnread = state.followingList.reduce((s, f) => s + (f.myUnread || 0), 0);
        }
      }
    },

    removeMessage: (state, action) => {
      const { messageId } = action.payload;
      const msg = state.messages.find((m) => m._id === messageId);
      if (msg) { msg.isDeleted = true; msg.text = ""; msg.image = ""; }
    },

    updateMessage: (state, action) => {
      const { messageId, newText } = action.payload;
      const msg = state.messages.find((m) => m._id === messageId);
      if (msg) { msg.text = newText; msg.isEdited = true; }
    },

    setTypingUser: (state, action) => {
      const { userId, conversationId, isTyping } = action.payload;
      if (!state.typingUsers[conversationId]) state.typingUsers[conversationId] = [];
      if (isTyping) {
        if (!state.typingUsers[conversationId].includes(userId))
          state.typingUsers[conversationId].push(userId);
      } else {
        state.typingUsers[conversationId] = state.typingUsers[conversationId].filter(
          (id) => id !== userId
        );
      }
    },

    userCameOnline: (state, action) => {
      if (!state.onlineUsers.includes(action.payload))
        state.onlineUsers.push(action.payload);
    },

    userWentOffline: (state, action) => {
      state.onlineUsers = state.onlineUsers.filter((id) => id !== action.payload);
    },

    markConversationRead: (state, action) => {
      const convId = action.payload;
      const item = state.followingList.find((f) => f.conversation?._id === convId);
      if (item) item.myUnread = 0;
      state.totalUnread = state.followingList.reduce((s, f) => s + (f.myUnread || 0), 0);
    },

    // ✅ Real-time badge ke liye — App.jsx mein socket listener se call hota hai
    incrementUnread: (state) => {
      state.totalUnread += 1;
    },

    updateConversationUnread: (state, action) => {
      const { conversationId, lastMessage, unread } = action.payload;
      const item = state.followingList.find((f) => f.conversation?._id === conversationId);
      if (item) {
        item.myUnread = unread;
        if (item.conversation) item.conversation.lastMessage = lastMessage;
      }
      state.totalUnread = state.followingList.reduce((s, f) => s + (f.myUnread || 0), 0);
    },

    updateFollowingConversation: (state, action) => {
      const conv = action.payload;
      const item = state.followingList.find(
        (f) => conv.participants?.some((p) => p._id === f.user?._id)
      );
      if (item) item.conversation = conv;
    },
  },

  extraReducers: (builder) => {

    // fetchFollowingForMessages
    builder
      .addCase(fetchFollowingForMessages.pending,   (state) => { state.loadingFollowing = true; })
      .addCase(fetchFollowingForMessages.fulfilled, (state, action) => {
        state.loadingFollowing = false;
        state.followingList    = action.payload;
        state.totalUnread = action.payload.reduce((s, f) => s + (f.myUnread || 0), 0);
      })
      .addCase(fetchFollowingForMessages.rejected,  (state) => { state.loadingFollowing = false; });

    // fetchConversations
    builder
      .addCase(fetchConversations.pending,   (state) => { state.loadingConversations = true; })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.loadingConversations = false;
        state.conversations = action.payload;
      })
      .addCase(fetchConversations.rejected,  (state) => { state.loadingConversations = false; });

    // getOrCreateConversation
    builder.addCase(getOrCreateConversation.fulfilled, (state, action) => {
      const conv = action.payload;
      state.activeConversation = conv;
      const item = state.followingList.find(
        (f) => conv.participants?.some((p) => p._id === f.user?._id)
      );
      if (item && !item.conversation) item.conversation = conv;
    });

    // fetchMessages
    builder
      .addCase(fetchMessages.pending,   (state) => { state.loadingMessages = true; })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.loadingMessages = false;
        const { messages, pagination, page } = action.payload;
        state.messages = page === 1 ? messages : [...messages, ...state.messages];
        state.hasMoreMessages = pagination?.hasMore || false;
      })
      .addCase(fetchMessages.rejected,  (state) => { state.loadingMessages = false; });

    // fetchTotalUnread
    builder.addCase(fetchTotalUnread.fulfilled, (state, action) => {
      state.totalUnread = action.payload;
    });
  },
});

export const {
  setActiveConversation,
  appendMessage,
  removeMessage,
  setTypingUser,
  userCameOnline,
  userWentOffline,
  markConversationRead,
  incrementUnread,
  updateConversationUnread,
  updateFollowingConversation,
  updateMessage,
} = messagesSlice.actions;

export default messagesSlice.reducer;