
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import chatApi from "../services/chatApi";

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchConversations = createAsyncThunk(
  "chat/fetchConversations",
  async (_, { rejectWithValue }) => {
    try {
      const data = await chatApi.getConversations();
      return Array.isArray(data) ? data : (data?.conversations ?? data?.data ?? []);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch conversations");
    }
  }
);

export const fetchMessages = createAsyncThunk(
  "chat/fetchMessages",
  async ({ conversationId, before, limit = 30 }, { rejectWithValue }) => {
    try {
      const data = await chatApi.getMessages(conversationId, before);
      const messages   = data?.data ?? data?.messages ?? data ?? [];
      const hasMore    = data?.pagination?.hasMore ?? data?.hasMore ?? false;
      const nextCursor = data?.pagination?.nextCursor ?? data?.nextCursor ?? null;
      return { conversationId, messages, hasMore, nextCursor, prepend: !!before };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch messages");
    }
  }
);

export const openOrCreateConversation = createAsyncThunk(
  "chat/openOrCreateConversation",
  async (participantId, { rejectWithValue }) => {
    try {
      const data = await chatApi.getOrCreateConversation(participantId);
      return data?.conversation ?? data?.data ?? data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to open conversation");
    }
  }
);

// ✅ NAYA — Group conversation create karo
export const createGroupConversation = createAsyncThunk(
  "chat/createGroupConversation",
  async ({ groupName, participantIds, avatarUrl }, { rejectWithValue }) => {
    try {
      const data = await chatApi.createGroupConversation(groupName, participantIds, avatarUrl);
      return data; // populated conversation object
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to create group");
    }
  }
);

// ── Helpers ───────────────────────────────────────────────────────────────────

const normalizeSender = (sender) =>
  typeof sender === "string"
    ? { id: sender }
    : { ...sender, id: (sender?.id || sender?._id || sender)?.toString() || "" };

// ── Initial State ─────────────────────────────────────────────────────────────

const initialState = {
  conversations:      [],
  messages:           {},
  pagination:         {},
  activeConvId:       sessionStorage.getItem("activeConvId") || null,
  onlineUsers:        [],
  typingUsers:        {},
  totalUnread:        0,
  // Real-time mein aaye messages track karo — fetchConversations race condition fix
  realtimeUnreadMap:  {}, // { [conversationId]: count } — socket se aaye unread
  loadingConvs:       false,
  loadingMessages:    {},
  creatingGroup:      false, // ✅ NAYA
  error:              null,
};

// ── Slice ─────────────────────────────────────────────────────────────────────

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {

    // ── setActiveConversation ─────────────────────────────────────────────
    setActiveConversation(state, { payload: convId }) {
      state.activeConvId = convId;
      if (convId) {
        sessionStorage.setItem("activeConvId", convId);
      } else {
        sessionStorage.removeItem("activeConvId");
      }
      // Badge reset — conversation open hone pe
      const conv = state.conversations.find((c) => c.id === convId);
      if (conv) {
        const prevUnread      = conv.unreadCount || 0;
        const realtimeUnread  = state.realtimeUnreadMap[convId] || 0;
        const toDeduct        = Math.max(prevUnread, realtimeUnread);
        state.totalUnread     = Math.max(0, state.totalUnread - toDeduct);
        conv.unreadCount      = 0;
      } else {
        // Conversation list mein nahi hai lekin realtimeUnreadMap mein ho sakta hai
        const realtimeUnread  = state.realtimeUnreadMap[convId] || 0;
        state.totalUnread     = Math.max(0, state.totalUnread - realtimeUnread);
      }
      // Clear karo is conversation ka realtime map
      if (convId) delete state.realtimeUnreadMap[convId];
    },

 
  receiveMessage(state, { payload: { conversationId, message, tempId } }) {
  if (!state.messages[conversationId]) state.messages[conversationId] = [];

  const msgId         = message.id?.toString();
  const normalizedMsg = {
    ...message,
    isOptimistic: false,
    sender: normalizeSender(message.sender),
  };

  // ── Step 1: Message list update ───────────────────────────────────────

  // Optimistic replace — tempId match hone pe in-place replace
  if (tempId) {
    const idx = state.messages[conversationId].findIndex(
      (m) => m.id === tempId || m.id?.toString() === tempId || m._id === tempId
    );
    if (idx !== -1) {
      state.messages[conversationId][idx] = normalizedMsg;
     
    } else {
    
    state.messages[conversationId] = state.messages[conversationId].filter(
        (m) => !(m.isOptimistic && (m.id === tempId || m.id?.toString() === tempId || m._id === tempId))
      );
      const alreadyExists = state.messages[conversationId].some(
        (m) => m.id?.toString() === msgId
      );
      if (!alreadyExists) state.messages[conversationId].push(normalizedMsg);
    }
  } else {
    // No tempId — duplicate check karke push
    const alreadyExists = state.messages[conversationId].some(
      (m) => !m.isOptimistic && m.id?.toString() === msgId
    );
    if (!alreadyExists) state.messages[conversationId].push(normalizedMsg);
  }

  // ── Step 2: Conversation + badge update ──────────────────────────────

  const conv = state.conversations.find((c) => c.id === conversationId);

  if (state.activeConvId === conversationId) {
    // Conversation open hai — sirf lastMessage update, badge nahi
    if (conv) {
      conv.lastMessage = message;
      conv.updatedAt   = message.createdAt || new Date().toISOString();
    }
    return;
  }

  // Conversation background mein hai — badge badhao
  state.realtimeUnreadMap[conversationId] =
    (state.realtimeUnreadMap[conversationId] || 0) + 1;
  state.totalUnread = (state.totalUnread || 0) + 1;

  if (conv) {
    conv.lastMessage = message;
    conv.updatedAt   = message.createdAt || new Date().toISOString();
    conv.unreadCount = (conv.unreadCount || 0) + 1;
  }
},

    addOptimisticMessage(state, { payload: { conversationId, message } }) {
      if (!state.messages[conversationId]) state.messages[conversationId] = [];
      state.messages[conversationId].push({
        ...message,
        sender: {
          ...message.sender,
          id: message.sender?.id?.toString() || message.sender?.toString() || "",
        },
      });
    },

    applyMessageEdit(state, { payload: { conversationId, messageId, newText, isEdited, editedAt } }) {
      const msg = state.messages[conversationId]?.find((m) => m.id === messageId);
      if (msg) {
        msg.text     = newText;
        msg.isEdited = isEdited ?? true;
        msg.editedAt = editedAt ?? new Date().toISOString();
      }
    },

    applyMessageDelete(state, { payload: { conversationId, messageId } }) {
      const msg = state.messages[conversationId]?.find((m) => m.id === messageId);
      if (msg) {
        msg.isDeleted = true;
        msg.text      = "";
        msg.image     = null;
        msg.reactions = [];
      }
    },

    applySeenReceipt(state, { payload: { conversationId, messageId, seenBy } }) {
      const msg = state.messages[conversationId]?.find((m) => m.id === messageId);
      if (msg) {
        if (!msg.seenBy) msg.seenBy = [];
        if (!msg.seenBy.includes(seenBy)) msg.seenBy.push(seenBy);
      }
    },

    applyReaction(state, { payload: { conversationId, messageId, reactions } }) {
      const msg = state.messages[conversationId]?.find((m) => m.id === messageId);
      if (msg) msg.reactions = reactions;
    },

    setOnlineUsers(state, { payload }) {
      state.onlineUsers = Array.isArray(payload) ? payload : [];
    },

    userCameOnline(state, { payload: { userId } }) {
      if (!state.onlineUsers.includes(userId)) state.onlineUsers.push(userId);
    },

    userWentOffline(state, { payload: { userId } }) {
      state.onlineUsers = state.onlineUsers.filter((id) => id !== userId);
    },

    setTyping(state, { payload: { conversationId, userId } }) {
      if (!state.typingUsers[conversationId]) state.typingUsers[conversationId] = [];
      if (!state.typingUsers[conversationId].includes(userId)) {
        state.typingUsers[conversationId].push(userId);
      }
    },

    clearTyping(state, { payload: { conversationId, userId } }) {
      if (!state.typingUsers[conversationId]) return;
      state.typingUsers[conversationId] = state.typingUsers[conversationId].filter(
        (id) => id !== userId
      );
    },

    clearMessages(state, { payload: conversationId }) {
      delete state.messages[conversationId];
      delete state.pagination[conversationId];
    },
addNewConversation(state, { payload: { conversation } }) {
  if (!conversation?.id) return;

  // Duplicate guard
  const exists = state.conversations.some((c) => c.id === conversation.id);
  if (exists) return;

  // Sidebar mein top pe add karo
  state.conversations.unshift(conversation);

  // Unread badge update
  if (conversation.unreadCount > 0) {
    state.realtimeUnreadMap[conversation.id] =
      (state.realtimeUnreadMap[conversation.id] || 0) + conversation.unreadCount;
    state.totalUnread = (state.totalUnread || 0) + conversation.unreadCount;
  }
},
updateConversation(state, { payload: { conversation } }) {
  if (!conversation?.id) return;

  const idx = state.conversations.findIndex((c) => c.id === conversation.id);

  if (idx !== -1) {
    // ✅ Existing — update karo aur top pe le aao
    const existing = state.conversations[idx];

    // Active conversation open hai toh unread 0 rakho
    const unread = state.activeConvId === conversation.id
      ? 0
      : (conversation.unreadCount ?? existing.unreadCount ?? 0);

    state.conversations[idx] = {
      ...existing,
      ...conversation,
      unreadCount: unread,
    };

    // Top pe le aao — latest message wali conversation upar
    const updated = state.conversations.splice(idx, 1)[0];
    state.conversations.unshift(updated);
  } else {
    // ✅ Nahi hai — add karo top pe (stranger ka pehla message)
    state.conversations.unshift({
      ...conversation,
      unreadCount: state.activeConvId === conversation.id
        ? 0
        : (conversation.unreadCount ?? 0),
    });

    // Badge update
    if (conversation.unreadCount > 0 && state.activeConvId !== conversation.id) {
      state.realtimeUnreadMap[conversation.id] =
        (state.realtimeUnreadMap[conversation.id] || 0) + conversation.unreadCount;
      state.totalUnread = (state.totalUnread || 0) + conversation.unreadCount;
    }
  }
},

  },

  // ── Extra Reducers ────────────────────────────────────────────────────────
  extraReducers: (builder) => {

    // fetchConversations
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.loadingConvs = true;
        state.error        = null;
      })
      .addCase(fetchConversations.fulfilled, (state, { payload }) => {
        state.loadingConvs = false;
        const fresh        = Array.isArray(payload) ? payload : [];

        // ── Race condition fix ────────────────────────────────────────────
        // fetchConversations DB response aane se pehle socket se messages aa
        // sakte hain — realtimeUnreadMap mein wo counts saved hain.
        // Fresh conversations ke saath merge karo — jo zyada ho woh rakho.
        const merged = fresh.map((conv) => {
          const realtimeExtra = state.realtimeUnreadMap[conv.id] || 0;
          return {
            ...conv,
            // DB unreadCount aur realtime extra — dono ka max lo
            unreadCount: Math.max(conv.unreadCount || 0, realtimeExtra),
          };
        });

        state.conversations = merged;

        // totalUnread — merged conversations se recalculate karo
        // realtimeUnreadMap se jo conversations list mein nahi hain unka bhi add karo
        const mergedIds    = new Set(merged.map((c) => c.id));
        const orphanUnread = Object.entries(state.realtimeUnreadMap)
          .filter(([id]) => !mergedIds.has(id))
          .reduce((sum, [, count]) => sum + count, 0);

        state.totalUnread = merged.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
                          + orphanUnread;
      })
      .addCase(fetchConversations.rejected, (state, { payload }) => {
        state.loadingConvs = false;
        state.error        = payload;
      });

    // fetchMessages
    builder
      .addCase(fetchMessages.pending, (state, { meta }) => {
        state.loadingMessages[meta.arg.conversationId] = true;
      })
      .addCase(fetchMessages.fulfilled, (state, { payload }) => {
        const { conversationId, messages, hasMore, nextCursor, prepend } = payload;
        state.loadingMessages[conversationId] = false;

        if (prepend) {
          const existing    = state.messages[conversationId] || [];
          const existingIds = new Set(existing.map((m) => m.id));
          const newMsgs     = messages.filter((m) => !existingIds.has(m.id));
          state.messages[conversationId] = [...newMsgs, ...existing];
        } else {
          const normalizedMessages = messages.map((msg) => ({
            ...msg,
            sender: normalizeSender(msg.sender),
          }));
          const optimistic     = (state.messages[conversationId] || []).filter((m) => m.isOptimistic);
          const fetchedIds     = new Set(normalizedMessages.map((m) => m.id));
          const safeOptimistic = optimistic.filter((m) => !fetchedIds.has(m.id));
          state.messages[conversationId] = [...normalizedMessages, ...safeOptimistic];
        }
        state.pagination[conversationId] = { hasMore, nextCursor };
      })
      .addCase(fetchMessages.rejected, (state, { meta }) => {
        state.loadingMessages[meta.arg.conversationId] = false;
      });

    // openOrCreateConversation// openOrCreateConversation
builder.addCase(openOrCreateConversation.fulfilled, (state, { payload }) => {
  if (!payload?.id) return;
  const idx = state.conversations.findIndex((c) => c.id === payload.id);
  if (idx !== -1) {
    // Already hai — fresh data se update karo (participants sahi ho jayenge)
    state.conversations[idx] = {
      ...state.conversations[idx],
      ...payload,
    };
    // Top pe le aao
    const updated = state.conversations.splice(idx, 1)[0];
    state.conversations.unshift(updated);
  } else {
    // Naya — top pe add karo
    state.conversations.unshift(payload);
  }
});

    // ✅ NAYA — createGroupConversation
    builder
      .addCase(createGroupConversation.pending, (state) => {
        state.creatingGroup = true;
        state.error         = null;
      })
      .addCase(createGroupConversation.fulfilled, (state, { payload }) => {
        state.creatingGroup = false;
        if (!payload?.id) return;
        const exists = state.conversations.some((c) => c.id === payload.id);
        if (!exists) state.conversations.unshift(payload);
      })
      .addCase(createGroupConversation.rejected, (state, { payload }) => {
        state.creatingGroup = false;
        state.error         = payload;
      });
  },
});

export const {
  setActiveConversation, receiveMessage, addOptimisticMessage,
  applyMessageEdit, applyMessageDelete, applySeenReceipt, applyReaction,
  setOnlineUsers, userCameOnline, userWentOffline,
  setTyping, clearTyping, clearMessages, addNewConversation,
  updateConversation,
} = chatSlice.actions;

export const selectConversations = (s) => s.chat.conversations;
export const selectActiveConvId  = (s) => s.chat.activeConvId;
export const selectOnlineUsers   = (s) => s.chat.onlineUsers;
export const selectLoadingConvs  = (s) => s.chat.loadingConvs;
export const selectTotalUnread   = (s) => s.chat.totalUnread;
export const selectCreatingGroup = (s) => s.chat.creatingGroup; // ✅ NAYA

export default chatSlice.reducer;