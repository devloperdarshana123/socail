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
};

export default chatApi;