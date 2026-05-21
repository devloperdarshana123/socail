
// // import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// // import chatApi from "../services/chatApi";

// // // ── Thunks ────────────────────────────────────────────────────────────────────

// // export const fetchConversations = createAsyncThunk(
// //   "chat/fetchConversations",
// //   async (_, { rejectWithValue }) => {
// //     try {
// //       // FIX: chatApi.get() nahi hai — chatApi.getConversations() use karo
// //       const data = await chatApi.getConversations();
// //       return Array.isArray(data) ? data : (data?.conversations ?? data?.data ?? []);
// //     } catch (err) {
// //       return rejectWithValue(err.response?.data?.message || "Failed to fetch conversations");
// //     }
// //   }
// // );

// // export const fetchMessages = createAsyncThunk(
// //   "chat/fetchMessages",
// //   async ({ conversationId, before, limit = 30 }, { rejectWithValue }) => {
// //     try {
// //       // FIX: chatApi.get() nahi hai — chatApi.getMessages() use karo
// //       const data = await chatApi.getMessages(conversationId, before);
// //       // chatApi.getMessages returns: { data: Message[], pagination: { hasMore, nextCursor } }
// //       const messages   = data?.data ?? data?.messages ?? data ?? [];
// //       const hasMore    = data?.pagination?.hasMore ?? data?.hasMore ?? false;
// //       const nextCursor = data?.pagination?.nextCursor ?? data?.nextCursor ?? null;
// //       return { conversationId, messages, hasMore, nextCursor, prepend: !!before };
// //     } catch (err) {
// //       return rejectWithValue(err.response?.data?.message || "Failed to fetch messages");
// //     }
// //   }
// // );

// // export const openOrCreateConversation = createAsyncThunk(
// //   "chat/openOrCreateConversation",
// //   async (participantId, { rejectWithValue }) => {
// //     try {
// //       // FIX: chatApi.post() nahi hai — chatApi.getOrCreateConversation() use karo
// //       const data = await chatApi.getOrCreateConversation(participantId);
// //       return data?.conversation ?? data?.data ?? data;
// //     } catch (err) {
// //       return rejectWithValue(err.response?.data?.message || "Failed to open conversation");
// //     }
// //   }
// // );

// // // ── Initial State ─────────────────────────────────────────────────────────────

// // const initialState = {
// //   conversations:   [],
// //   messages:        {},
// //   pagination:      {},
// //  activeConvId:    sessionStorage.getItem("activeConvId") || null,
// //   onlineUsers:     [],
// //   typingUsers:     {},
// //   totalUnread:     0,
// //   loadingConvs:    false,
// //   loadingMessages: {},
// //   error:           null,
// // };

// // // ── Slice ─────────────────────────────────────────────────────────────────────

// // const chatSlice = createSlice({
// //   name: "chat",
// //   initialState,
// //   reducers: {

// //    setActiveConversation(state, { payload: convId }) {
// //   state.activeConvId = convId;
// //   // Persist karo sessionStorage mein
// //   if (convId) {
// //     sessionStorage.setItem("activeConvId", convId);
// //   } else {
// //     sessionStorage.removeItem("activeConvId");
// //   }
// //   const conv = state.conversations.find((c) => c._id === convId);
// //   if (conv) {
// //     state.totalUnread = Math.max(0, state.totalUnread - (conv.unreadCount || 0));
// //     conv.unreadCount = 0;
// //   }
// // },

// //    receiveMessage(state, { payload: { conversationId, message, tempId } }) {
// //   if (!state.messages[conversationId]) state.messages[conversationId] = [];

// //   const msgId = message._id?.toString();

// //   // Pehle tempId se match karo
// //   if (tempId) {
// //     const idx = state.messages[conversationId].findIndex(
// //       (m) => m._id === tempId || m._id?.toString() === tempId
// //     );
// //     if (idx !== -1) {
// //       // Optimistic message ko real message se replace karo
// //      const normalizedSender1 = typeof message.sender === "string"
// //   ? { _id: message.sender }
// //   : { ...message.sender, _id: (message.sender?._id || message.sender)?.toString() || "" };

// // state.messages[conversationId][idx] = {
// //   ...message,
// //   isOptimistic: false,
// //   sender: normalizedSender1,
// // };
// // return;// Done — duplicate check mat karo
// //     }
// //   }

// //   // tempId match nahi mila — duplicate check karke push karo
// //   const exists = state.messages[conversationId].some(
// //     (m) => m._id?.toString() === msgId
// //   );
// //   if (!exists) {
// //  const normalizedSender2 = typeof message.sender === "string"
// //   ? { _id: message.sender }
// //   : { ...message.sender, _id: (message.sender?._id || message.sender)?.toString() || "" };

// // state.messages[conversationId].push({
// //   ...message,
// //   isOptimistic: false,
// //   sender: normalizedSender2,
// // });
// //   }
// // },   // ← yeh closing brace add karo receiveMessage ka

// //    addOptimisticMessage(state, { payload: { conversationId, message } }) {
// //   if (!state.messages[conversationId]) state.messages[conversationId] = [];
// //   // sender._id string ensure karo
// //   const safeMessage = {
// //     ...message,
// //     sender: {
// //       ...message.sender,
// //       _id: message.sender?._id?.toString() || message.sender?.toString() || "",
// //     },
// //   };
// //   state.messages[conversationId].push(safeMessage);
// // },

// //     applyMessageEdit(state, { payload: { conversationId, messageId, newText, isEdited, editedAt } }) {
// //       const msg = state.messages[conversationId]?.find((m) => m._id === messageId);
// //       if (msg) {
// //         msg.text     = newText;
// //         msg.isEdited = isEdited ?? true;
// //         msg.editedAt = editedAt ?? new Date().toISOString();
// //       }
// //     },

// //     applyMessageDelete(state, { payload: { conversationId, messageId } }) {
// //       const msg = state.messages[conversationId]?.find((m) => m._id === messageId);
// //       if (msg) {
// //         msg.isDeleted = true;
// //         msg.text      = "";
// //         msg.image     = null;
// //         msg.reactions = [];
// //       }
// //     },

// //     applySeenReceipt(state, { payload: { conversationId, messageId, seenBy } }) {
// //       const msg = state.messages[conversationId]?.find((m) => m._id === messageId);
// //       if (msg) {
// //         if (!msg.seenBy) msg.seenBy = [];
// //         if (!msg.seenBy.includes(seenBy)) msg.seenBy.push(seenBy);
// //       }
// //     },

// //     applyReaction(state, { payload: { conversationId, messageId, reactions } }) {
// //       const msg = state.messages[conversationId]?.find((m) => m._id === messageId);
// //       if (msg) msg.reactions = reactions;
// //     },

// //     setOnlineUsers(state, { payload }) {
// //       state.onlineUsers = Array.isArray(payload) ? payload : [];
// //     },

// //     userCameOnline(state, { payload: { userId } }) {
// //       if (!state.onlineUsers.includes(userId)) state.onlineUsers.push(userId);
// //     },

// //     userWentOffline(state, { payload: { userId } }) {
// //       state.onlineUsers = state.onlineUsers.filter((id) => id !== userId);
// //     },

// //     setTyping(state, { payload: { conversationId, userId } }) {
// //       if (!state.typingUsers[conversationId]) state.typingUsers[conversationId] = [];
// //       if (!state.typingUsers[conversationId].includes(userId)) {
// //         state.typingUsers[conversationId].push(userId);
// //       }
// //     },

// //     clearTyping(state, { payload: { conversationId, userId } }) {
// //       if (!state.typingUsers[conversationId]) return;
// //       state.typingUsers[conversationId] = state.typingUsers[conversationId].filter(
// //         (id) => id !== userId
// //       );
// //     },

// //     clearMessages(state, { payload: conversationId }) {
// //       delete state.messages[conversationId];
// //       delete state.pagination[conversationId];
// //     },
// //   },

// //   extraReducers: (builder) => {
// //     builder
// //       .addCase(fetchConversations.pending, (state) => {
// //         state.loadingConvs = true;
// //         state.error = null;
// //       })
// //       .addCase(fetchConversations.fulfilled, (state, { payload }) => {
// //         state.loadingConvs  = false;
// //         state.conversations = Array.isArray(payload) ? payload : [];
// //         state.totalUnread   = state.conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
// //       })
// //       .addCase(fetchConversations.rejected, (state, { payload }) => {
// //         state.loadingConvs = false;
// //         state.error        = payload;
// //       });

// //     builder
// //       .addCase(fetchMessages.pending, (state, { meta }) => {
// //         state.loadingMessages[meta.arg.conversationId] = true;
// //       })
// //       .addCase(fetchMessages.fulfilled, (state, { payload }) => {
// //         const { conversationId, messages, hasMore, nextCursor, prepend } = payload;
// //         state.loadingMessages[conversationId] = false;

// //         if (prepend) {
// //           const existing    = state.messages[conversationId] || [];
// //           const existingIds = new Set(existing.map((m) => m._id));
// //           const newMsgs     = messages.filter((m) => !existingIds.has(m._id));
// //           state.messages[conversationId] = [...newMsgs, ...existing];
// //         } else {
// //   // Fetched messages mein bhi sender normalize karo
// //   const normalizedMessages = messages.map((msg) => {
// //     const normalizedSender = typeof msg.sender === "string"
// //       ? { _id: msg.sender }
// //       : { ...msg.sender, _id: (msg.sender?._id || msg.sender)?.toString() || "" };
// //     return { ...msg, sender: normalizedSender };
// //   });

// //   const optimistic = (state.messages[conversationId] || []).filter((m) => m.isOptimistic);
// //   const fetchedIds = new Set(normalizedMessages.map((m) => m._id));
// //   const safeOptimistic = optimistic.filter((m) => !fetchedIds.has(m._id));
// //   state.messages[conversationId] = [...normalizedMessages, ...safeOptimistic];
// // }

// //         state.pagination[conversationId] = { hasMore, nextCursor };
// //       })
// //       .addCase(fetchMessages.rejected, (state, { meta }) => {
// //         state.loadingMessages[meta.arg.conversationId] = false;
// //       });

// //     builder.addCase(openOrCreateConversation.fulfilled, (state, { payload }) => {
// //       if (!payload?._id) return;
// //       const exists = state.conversations.some((c) => c._id === payload._id);
// //       if (!exists) state.conversations.unshift(payload);
// //     });
// //   },
// // });

// // export const {
// //   setActiveConversation, receiveMessage, addOptimisticMessage,
// //   applyMessageEdit, applyMessageDelete, applySeenReceipt, applyReaction,
// //   setOnlineUsers, userCameOnline, userWentOffline,
// //   setTyping, clearTyping, clearMessages,
// // } = chatSlice.actions;

// // export const selectConversations = (s) => s.chat.conversations;
// // export const selectActiveConvId  = (s) => s.chat.activeConvId;
// // export const selectOnlineUsers   = (s) => s.chat.onlineUsers;
// // export const selectLoadingConvs  = (s) => s.chat.loadingConvs;
// // export const selectTotalUnread   = (s) => s.chat.totalUnread;

// // export default chatSlice.reducer;



// import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// import chatApi from "../services/chatApi";

// // ── Thunks ────────────────────────────────────────────────────────────────────

// export const fetchConversations = createAsyncThunk(
//   "chat/fetchConversations",
//   async (_, { rejectWithValue }) => {
//     try {
//       const data = await chatApi.getConversations();
//       return Array.isArray(data) ? data : (data?.conversations ?? data?.data ?? []);
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Failed to fetch conversations");
//     }
//   }
// );

// export const fetchMessages = createAsyncThunk(
//   "chat/fetchMessages",
//   async ({ conversationId, before, limit = 30 }, { rejectWithValue }) => {
//     try {
//       const data = await chatApi.getMessages(conversationId, before);
//       const messages   = data?.data ?? data?.messages ?? data ?? [];
//       const hasMore    = data?.pagination?.hasMore ?? data?.hasMore ?? false;
//       const nextCursor = data?.pagination?.nextCursor ?? data?.nextCursor ?? null;
//       return { conversationId, messages, hasMore, nextCursor, prepend: !!before };
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Failed to fetch messages");
//     }
//   }
// );

// export const openOrCreateConversation = createAsyncThunk(
//   "chat/openOrCreateConversation",
//   async (participantId, { rejectWithValue }) => {
//     try {
//       const data = await chatApi.getOrCreateConversation(participantId);
//       return data?.conversation ?? data?.data ?? data;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Failed to open conversation");
//     }
//   }
// );

// // ── Helpers ───────────────────────────────────────────────────────────────────

// const normalizeSender = (sender) =>
//   typeof sender === "string"
//     ? { _id: sender }
//     : { ...sender, _id: (sender?._id || sender)?.toString() || "" };

// // ── Initial State ─────────────────────────────────────────────────────────────

// const initialState = {
//   conversations:   [],
//   messages:        {},
//   pagination:      {},
//   activeConvId:    sessionStorage.getItem("activeConvId") || null,
//   onlineUsers:     [],
//   typingUsers:     {},
//   totalUnread:     0,
//   loadingConvs:    false,
//   loadingMessages: {},
//   error:           null,
// };

// // ── Slice ─────────────────────────────────────────────────────────────────────

// const chatSlice = createSlice({
//   name: "chat",
//   initialState,
//   reducers: {

//     setActiveConversation(state, { payload: convId }) {
//       state.activeConvId = convId;
//       if (convId) {
//         sessionStorage.setItem("activeConvId", convId);
//       } else {
//         sessionStorage.removeItem("activeConvId");
//       }
//       // Conversation open karne pe unread badge reset
//       const conv = state.conversations.find((c) => c._id === convId);
//       if (conv) {
//         state.totalUnread = Math.max(0, state.totalUnread - (conv.unreadCount || 0));
//         conv.unreadCount = 0;
//       }
//     },

//     // ── receiveMessage ────────────────────────────────────────────────────
//     // Yahan ab 3 kaam hote hain:
//     // 1. Message list update (optimistic replace ya push)
//     // 2. Conversation list mein lastMessage + unreadCount update
//     // 3. totalUnread badge increment (sirf agar active conv nahi hai)
//     receiveMessage(state, { payload: { conversationId, message, tempId } }) {
//       // ── 1. Message list update ──
//       if (!state.messages[conversationId]) state.messages[conversationId] = [];

//       const msgId = message._id?.toString();

//       if (tempId) {
//         const idx = state.messages[conversationId].findIndex(
//           (m) => m._id === tempId || m._id?.toString() === tempId
//         );
//         if (idx !== -1) {
//           state.messages[conversationId][idx] = {
//             ...message,
//             isOptimistic: false,
//             sender: normalizeSender(message.sender),
//           };
//           // Optimistic replace — conversation update karo lekin unread mat badhao (khud ka message)
//           const conv = state.conversations.find((c) => c._id === conversationId);
//           if (conv) {
//             conv.lastMessage = message;
//             conv.updatedAt   = message.createdAt || new Date().toISOString();
//           }
//           return;
//         }
//       }

//       // Duplicate check
//       const exists = state.messages[conversationId].some(
//         (m) => m._id?.toString() === msgId
//       );
//       if (!exists) {
//         state.messages[conversationId].push({
//           ...message,
//           isOptimistic: false,
//           sender: normalizeSender(message.sender),
//         });
//       }

//       // ── 2. Conversation list update ──
//       const conv = state.conversations.find((c) => c._id === conversationId);
//       if (conv) {
//         conv.lastMessage = message;
//         conv.updatedAt   = message.createdAt || new Date().toISOString();

//         // ── 3. totalUnread badge — sirf agar yeh active conversation nahi hai ──
//         if (state.activeConvId !== conversationId) {
//           conv.unreadCount  = (conv.unreadCount || 0) + 1;
//           state.totalUnread = (state.totalUnread || 0) + 1;
//         }
//       } else {
//         // Conversation list mein nahi hai abhi — sirf badge badhao
//         if (state.activeConvId !== conversationId) {
//           state.totalUnread = (state.totalUnread || 0) + 1;
//         }
//       }
//     },

//     addOptimisticMessage(state, { payload: { conversationId, message } }) {
//       if (!state.messages[conversationId]) state.messages[conversationId] = [];
//       state.messages[conversationId].push({
//         ...message,
//         sender: {
//           ...message.sender,
//           _id: message.sender?._id?.toString() || message.sender?.toString() || "",
//         },
//       });
//     },

//     applyMessageEdit(state, { payload: { conversationId, messageId, newText, isEdited, editedAt } }) {
//       const msg = state.messages[conversationId]?.find((m) => m._id === messageId);
//       if (msg) {
//         msg.text     = newText;
//         msg.isEdited = isEdited ?? true;
//         msg.editedAt = editedAt ?? new Date().toISOString();
//       }
//     },

//     applyMessageDelete(state, { payload: { conversationId, messageId } }) {
//       const msg = state.messages[conversationId]?.find((m) => m._id === messageId);
//       if (msg) {
//         msg.isDeleted = true;
//         msg.text      = "";
//         msg.image     = null;
//         msg.reactions = [];
//       }
//     },

//     applySeenReceipt(state, { payload: { conversationId, messageId, seenBy } }) {
//       const msg = state.messages[conversationId]?.find((m) => m._id === messageId);
//       if (msg) {
//         if (!msg.seenBy) msg.seenBy = [];
//         if (!msg.seenBy.includes(seenBy)) msg.seenBy.push(seenBy);
//       }
//     },

//     applyReaction(state, { payload: { conversationId, messageId, reactions } }) {
//       const msg = state.messages[conversationId]?.find((m) => m._id === messageId);
//       if (msg) msg.reactions = reactions;
//     },

//     setOnlineUsers(state, { payload }) {
//       state.onlineUsers = Array.isArray(payload) ? payload : [];
//     },

//     userCameOnline(state, { payload: { userId } }) {
//       if (!state.onlineUsers.includes(userId)) state.onlineUsers.push(userId);
//     },

//     userWentOffline(state, { payload: { userId } }) {
//       state.onlineUsers = state.onlineUsers.filter((id) => id !== userId);
//     },

//     setTyping(state, { payload: { conversationId, userId } }) {
//       if (!state.typingUsers[conversationId]) state.typingUsers[conversationId] = [];
//       if (!state.typingUsers[conversationId].includes(userId)) {
//         state.typingUsers[conversationId].push(userId);
//       }
//     },

//     clearTyping(state, { payload: { conversationId, userId } }) {
//       if (!state.typingUsers[conversationId]) return;
//       state.typingUsers[conversationId] = state.typingUsers[conversationId].filter(
//         (id) => id !== userId
//       );
//     },

//     clearMessages(state, { payload: conversationId }) {
//       delete state.messages[conversationId];
//       delete state.pagination[conversationId];
//     },
//   },

//   extraReducers: (builder) => {
//     builder
//       .addCase(fetchConversations.pending, (state) => {
//         state.loadingConvs = true;
//         state.error = null;
//       })
//       .addCase(fetchConversations.fulfilled, (state, { payload }) => {
//         state.loadingConvs  = false;
//         state.conversations = Array.isArray(payload) ? payload : [];
//         // DB se fresh unread count — real-time ke upar overwrite
//         state.totalUnread   = state.conversations.reduce(
//           (sum, c) => sum + (c.unreadCount || 0), 0
//         );
//       })
//       .addCase(fetchConversations.rejected, (state, { payload }) => {
//         state.loadingConvs = false;
//         state.error        = payload;
//       });

//     builder
//       .addCase(fetchMessages.pending, (state, { meta }) => {
//         state.loadingMessages[meta.arg.conversationId] = true;
//       })
//       .addCase(fetchMessages.fulfilled, (state, { payload }) => {
//         const { conversationId, messages, hasMore, nextCursor, prepend } = payload;
//         state.loadingMessages[conversationId] = false;

//         if (prepend) {
//           const existing    = state.messages[conversationId] || [];
//           const existingIds = new Set(existing.map((m) => m._id));
//           const newMsgs     = messages.filter((m) => !existingIds.has(m._id));
//           state.messages[conversationId] = [...newMsgs, ...existing];
//         } else {
//           const normalizedMessages = messages.map((msg) => ({
//             ...msg,
//             sender: normalizeSender(msg.sender),
//           }));
//           const optimistic    = (state.messages[conversationId] || []).filter((m) => m.isOptimistic);
//           const fetchedIds    = new Set(normalizedMessages.map((m) => m._id));
//           const safeOptimistic = optimistic.filter((m) => !fetchedIds.has(m._id));
//           state.messages[conversationId] = [...normalizedMessages, ...safeOptimistic];
//         }

//         state.pagination[conversationId] = { hasMore, nextCursor };
//       })
//       .addCase(fetchMessages.rejected, (state, { meta }) => {
//         state.loadingMessages[meta.arg.conversationId] = false;
//       });

//     builder.addCase(openOrCreateConversation.fulfilled, (state, { payload }) => {
//       if (!payload?._id) return;
//       const exists = state.conversations.some((c) => c._id === payload._id);
//       if (!exists) state.conversations.unshift(payload);
//     });
//   },
// });

// export const {
//   setActiveConversation, receiveMessage, addOptimisticMessage,
//   applyMessageEdit, applyMessageDelete, applySeenReceipt, applyReaction,
//   setOnlineUsers, userCameOnline, userWentOffline,
//   setTyping, clearTyping, clearMessages,
// } = chatSlice.actions;

// export const selectConversations = (s) => s.chat.conversations;
// export const selectActiveConvId  = (s) => s.chat.activeConvId;
// export const selectOnlineUsers   = (s) => s.chat.onlineUsers;
// export const selectLoadingConvs  = (s) => s.chat.loadingConvs;
// export const selectTotalUnread   = (s) => s.chat.totalUnread;

// export default chatSlice.reducer;




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

// ── Helpers ───────────────────────────────────────────────────────────────────

const normalizeSender = (sender) =>
  typeof sender === "string"
    ? { _id: sender }
    : { ...sender, _id: (sender?._id || sender)?.toString() || "" };

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
      const conv = state.conversations.find((c) => c._id === convId);
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

    // ── receiveMessage ────────────────────────────────────────────────────
    receiveMessage(state, { payload: { conversationId, message, tempId } }) {

      // ── 1. Message list update ────────────────────────────────────────
      if (!state.messages[conversationId]) state.messages[conversationId] = [];
      const msgId = message._id?.toString();

      if (tempId) {
        const idx = state.messages[conversationId].findIndex(
          (m) => m._id === tempId || m._id?.toString() === tempId
        );
        if (idx !== -1) {
          state.messages[conversationId][idx] = {
            ...message,
            isOptimistic: false,
            sender: normalizeSender(message.sender),
          };
          // Apna hi message — conversation update, unread nahi
          const conv = state.conversations.find((c) => c._id === conversationId);
          if (conv) {
            conv.lastMessage = message;
            conv.updatedAt   = message.createdAt || new Date().toISOString();
          }
          return;
        }
      }

      // Duplicate check
      const exists = state.messages[conversationId].some(
        (m) => m._id?.toString() === msgId
      );
      if (!exists) {
        state.messages[conversationId].push({
          ...message,
          isOptimistic: false,
          sender: normalizeSender(message.sender),
        });
      }

      // ── 2. Active conversation check ──────────────────────────────────
      // Agar yeh conversation abhi screen pe open hai toh badge mat badhao
      if (state.activeConvId === conversationId) {
        // Sirf lastMessage update karo
        const conv = state.conversations.find((c) => c._id === conversationId);
        if (conv) {
          conv.lastMessage = message;
          conv.updatedAt   = message.createdAt || new Date().toISOString();
        }
        return;
      }

      // ── 3. Badge increment — real-time track karo ─────────────────────
      // realtimeUnreadMap mein store karo — fetchConversations se race nahi hogi
      state.realtimeUnreadMap[conversationId] =
        (state.realtimeUnreadMap[conversationId] || 0) + 1;
      state.totalUnread = (state.totalUnread || 0) + 1;

      // ── 4. Conversation list update ───────────────────────────────────
      const conv = state.conversations.find((c) => c._id === conversationId);
      if (conv) {
        conv.lastMessage = message;
        conv.updatedAt   = message.createdAt || new Date().toISOString();
        conv.unreadCount = (conv.unreadCount || 0) + 1;
      }
      // Conversation list mein nahi hai — badge already upar badh gaya
      // fetchConversations complete hone pe merge ho jaayega
    },

    addOptimisticMessage(state, { payload: { conversationId, message } }) {
      if (!state.messages[conversationId]) state.messages[conversationId] = [];
      state.messages[conversationId].push({
        ...message,
        sender: {
          ...message.sender,
          _id: message.sender?._id?.toString() || message.sender?.toString() || "",
        },
      });
    },

    applyMessageEdit(state, { payload: { conversationId, messageId, newText, isEdited, editedAt } }) {
      const msg = state.messages[conversationId]?.find((m) => m._id === messageId);
      if (msg) {
        msg.text     = newText;
        msg.isEdited = isEdited ?? true;
        msg.editedAt = editedAt ?? new Date().toISOString();
      }
    },

    applyMessageDelete(state, { payload: { conversationId, messageId } }) {
      const msg = state.messages[conversationId]?.find((m) => m._id === messageId);
      if (msg) {
        msg.isDeleted = true;
        msg.text      = "";
        msg.image     = null;
        msg.reactions = [];
      }
    },

    applySeenReceipt(state, { payload: { conversationId, messageId, seenBy } }) {
      const msg = state.messages[conversationId]?.find((m) => m._id === messageId);
      if (msg) {
        if (!msg.seenBy) msg.seenBy = [];
        if (!msg.seenBy.includes(seenBy)) msg.seenBy.push(seenBy);
      }
    },

    applyReaction(state, { payload: { conversationId, messageId, reactions } }) {
      const msg = state.messages[conversationId]?.find((m) => m._id === messageId);
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
          const realtimeExtra = state.realtimeUnreadMap[conv._id] || 0;
          return {
            ...conv,
            // DB unreadCount aur realtime extra — dono ka max lo
            unreadCount: Math.max(conv.unreadCount || 0, realtimeExtra),
          };
        });

        state.conversations = merged;

        // totalUnread — merged conversations se recalculate karo
        // realtimeUnreadMap se jo conversations list mein nahi hain unka bhi add karo
        const mergedIds    = new Set(merged.map((c) => c._id));
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
          const existingIds = new Set(existing.map((m) => m._id));
          const newMsgs     = messages.filter((m) => !existingIds.has(m._id));
          state.messages[conversationId] = [...newMsgs, ...existing];
        } else {
          const normalizedMessages = messages.map((msg) => ({
            ...msg,
            sender: normalizeSender(msg.sender),
          }));
          const optimistic     = (state.messages[conversationId] || []).filter((m) => m.isOptimistic);
          const fetchedIds     = new Set(normalizedMessages.map((m) => m._id));
          const safeOptimistic = optimistic.filter((m) => !fetchedIds.has(m._id));
          state.messages[conversationId] = [...normalizedMessages, ...safeOptimistic];
        }
        state.pagination[conversationId] = { hasMore, nextCursor };
      })
      .addCase(fetchMessages.rejected, (state, { meta }) => {
        state.loadingMessages[meta.arg.conversationId] = false;
      });

    // openOrCreateConversation
    builder.addCase(openOrCreateConversation.fulfilled, (state, { payload }) => {
      if (!payload?._id) return;
      const exists = state.conversations.some((c) => c._id === payload._id);
      if (!exists) state.conversations.unshift(payload);
    });
  },
});

export const {
  setActiveConversation, receiveMessage, addOptimisticMessage,
  applyMessageEdit, applyMessageDelete, applySeenReceipt, applyReaction,
  setOnlineUsers, userCameOnline, userWentOffline,
  setTyping, clearTyping, clearMessages,
} = chatSlice.actions;

export const selectConversations = (s) => s.chat.conversations;
export const selectActiveConvId  = (s) => s.chat.activeConvId;
export const selectOnlineUsers   = (s) => s.chat.onlineUsers;
export const selectLoadingConvs  = (s) => s.chat.loadingConvs;
export const selectTotalUnread   = (s) => s.chat.totalUnread;

export default chatSlice.reducer;