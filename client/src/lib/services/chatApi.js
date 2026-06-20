// // client/src/lib/services/chatApi.js
// import api from "./api"; // ✅ existing instance — token refresh + interceptors sab included

// const chatApi = {
//   // ── Conversations ─────────────────────────────────────────────────────────

//   getConversations: async () => {
//     const { data } = await api.get("/messages/conversations");
//     return data.data;
//   },

//   getOrCreateConversation: async (participantId) => {
//     const { data } = await api.post("/messages/conversations", { participantId });
//     return data.data;
//   },

//   getTotalUnreadCount: async () => {
//     const { data } = await api.get("/messages/conversations/unread-count");
//     return data.data; // { unreadCount: number }
//   },

//   markConversationRead: async (conversationId) => {
//     await api.patch(`/messages/conversations/${conversationId}/read`);
//   },

//   deleteConversation: async (conversationId) => {
//     await api.delete(`/messages/conversations/${conversationId}`);
//   },

//   // ── Messages ──────────────────────────────────────────────────────────────

//   /**
//    * @param {string} conversationId
//    * @param {string} [before] - cursor: oldest messageId visible (infinite scroll)
//    */
//   getMessages: async (conversationId, before = null) => {
//     const params = { limit: 30, ...(before ? { before } : {}) };
//     const { data } = await api.get(
//       `/messages/conversations/${conversationId}/messages`,
//       { params }
//     );
//     return data; // { data: Message[], pagination: { hasMore, nextCursor } }
//   },

//   sendMessage: async ({ conversationId, text, image, replyTo }) => {
//     const { data } = await api.post("/messages/messages", {
//       conversationId,
//       text,
//       image,
//       replyTo,
//     });
//     return data.data;
//   },

//   editMessage: async (messageId, text) => {
//     const { data } = await api.patch(`/messages/messages/${messageId}`, { text });
//     return data.data;
//   },

//   deleteMessage: async (messageId) => {
//     const { data } = await api.delete(`/messages/messages/${messageId}`);
//     return data.data;
//   },

//   reactToMessage: async (messageId, emoji) => {
//     const { data } = await api.patch(`/messages/messages/${messageId}/react`, { emoji });
//     return data.data;
//   },
// };

// export default chatApi;



// client/src/lib/services/chatApi.js
import api from "./api"; // ✅ existing instance — token refresh + interceptors sab included

const chatApi = {
  // ── Conversations ─────────────────────────────────────────────────────────

  getConversations: async () => {
    const { data } = await api.get("/messages/conversations");
    return data.data;
  },

  getOrCreateConversation: async (participantId) => {
    const { data } = await api.post("/messages/conversations", { participantId });
    return data.data;
  },

  getTotalUnreadCount: async () => {
    const { data } = await api.get("/messages/conversations/unread-count");
    return data.data; // { unreadCount: number }
  },

  markConversationRead: async (conversationId) => {
    await api.patch(`/messages/conversations/${conversationId}/read`);
  },

  deleteConversation: async (conversationId) => {
    await api.delete(`/messages/conversations/${conversationId}`);
  },

  // ── Messages ──────────────────────────────────────────────────────────────

  /**
   * @param {string} conversationId
   * @param {string} [before] - cursor: oldest messageId visible (infinite scroll)
   */
  getMessages: async (conversationId, before = null) => {
    const params = { limit: 30, ...(before ? { before } : {}) };
    const { data } = await api.get(
      `/messages/conversations/${conversationId}/messages`,
      { params }
    );
    return data; // { data: Message[], pagination: { hasMore, nextCursor } }
  },

  sendMessage: async ({ conversationId, text, image, replyTo }) => {
    const { data } = await api.post("/messages/messages", {
      conversationId,
      text,
      image,
      replyTo,
    });
    return data.data;
  },

  editMessage: async (messageId, text) => {
    const { data } = await api.patch(`/messages/messages/${messageId}`, { text });
    return data.data;
  },

  deleteMessage: async (messageId) => {
    const { data } = await api.delete(`/messages/messages/${messageId}`);
    return data.data;
  },

  reactToMessage: async (messageId, emoji) => {
    const { data } = await api.patch(`/messages/messages/${messageId}/react`, { emoji });
    return data.data;
  },

  // ── Groups ────────────────────────────────────────────────────────────────

  /**
   * @param {string} groupName
   * @param {string[]} participantIds - dusre members (khud automatically admin ban jaata hai)
   * @param {string} [avatarUrl]
   */
  createGroupConversation: async (groupName, participantIds, avatarUrl = null) => {
    const { data } = await api.post("/messages/conversations/group", {
      groupName,
      participantIds,
      avatarUrl,
    });
    return data.data;
  },

  addGroupMember: async (conversationId, userId) => {
    const { data } = await api.patch(`/messages/conversations/group/${conversationId}/add`, {
      userId,
    });
    return data.data;
  },

  removeGroupMember: async (conversationId, userId) => {
    const { data } = await api.patch(`/messages/conversations/group/${conversationId}/remove`, {
      userId,
    });
    return data.data;
  },

  leaveGroup: async (conversationId) => {
    const { data } = await api.patch(`/messages/conversations/group/${conversationId}/leave`);
    return data;
  },

  renameGroup: async (conversationId, { groupName, avatarUrl }) => {
    const { data } = await api.patch(`/messages/conversations/group/${conversationId}/rename`, {
      groupName,
      avatarUrl,
    });
    return data.data;
  },

  transferGroupAdmin: async (conversationId, newAdminId) => {
    const { data } = await api.patch(
      `/messages/conversations/group/${conversationId}/transfer-admin`,
      { newAdminId }
    );
    return data.data;
  },

  disbandGroup: async (conversationId) => {
    const { data } = await api.delete(`/messages/conversations/group/${conversationId}`);
    return data;
  },
};

export default chatApi;