

// client/src/lib/services/socketManager.js
import { io } from "socket.io-client";
import store from "../../app/store";
import {
  receiveMessage,
  applyMessageEdit,
  applyMessageDelete,
  applySeenReceipt,
  applyReaction,
  setOnlineUsers,
  userCameOnline,
  userWentOffline,
  setTyping,
  clearTyping,
  addNewConversation,
  updateConversation,
} from "../redux/chatSlice";

const CHAT_SERVER = import.meta.env.VITE_CHAT_SERVER_URL || "http://localhost:5001";

let socket        = null;
let currentUserId = null;
let tokenRefreshListener = null;

const getToken = () => localStorage.getItem("accessToken");

export const getSocket = () => socket;

// ── Socket event handlers — store dispatch ────────────────────────────────────
const registerSocketEvents = (socket) => {

  // ── Online presence ────────────────────────────────────────────────────
  socket.on("online:list", (userIds) => {
    store.dispatch(setOnlineUsers(userIds));
  });

  socket.on("user:online", ({ userId }) => {
    store.dispatch(userCameOnline({ userId }));
  });

  socket.on("user:offline", ({ userId }) => {
    store.dispatch(userWentOffline({ userId }));
  });

  // ── Messages ───────────────────────────────────────────────────────────
  socket.on("message:receive", ({ conversationId, message, tempId }) => {
    store.dispatch(receiveMessage({ conversationId, message, tempId }));
  });

  // ── Stranger message — sidebar automatically update ────────────────────
  socket.on("conversation:new", ({ conversation }) => {
    store.dispatch(addNewConversation({ conversation }));
  });

socket.on("conversation:updated", ({ conversation }) => {
  store.dispatch(updateConversation({ conversation }));
});

  socket.on("message:edited", ({ conversationId, messageId, newText, isEdited, editedAt }) => {
    store.dispatch(applyMessageEdit({ conversationId, messageId, newText, isEdited, editedAt }));
  });

  socket.on("message:deleted", ({ conversationId, messageId }) => {
    store.dispatch(applyMessageDelete({ conversationId, messageId }));
  });

  socket.on("message:seen", ({ conversationId, messageId, seenBy }) => {
    store.dispatch(applySeenReceipt({ conversationId, messageId, seenBy }));
  });

  socket.on("message:reaction", ({ conversationId, messageId, reactions }) => {
    store.dispatch(applyReaction({ conversationId, messageId, reactions }));
  });

  // ── Typing ─────────────────────────────────────────────────────────────
  socket.on("typing:start", ({ conversationId, userId }) => {
    store.dispatch(setTyping({ conversationId, userId }));
  });

  socket.on("typing:stop", ({ conversationId, userId }) => {
    store.dispatch(clearTyping({ conversationId, userId }));
  });

  // ── Connection lifecycle ───────────────────────────────────────────────

socket.on("connect",       () => {});
socket.on("disconnect",    () => {});
socket.on("connect_error", () => {});
socket.on("token:expired", () => {});
socket.on("token:refreshed", () => {});
  
  socket.on("session_expired", () =>
    window.dispatchEvent(new CustomEvent("auth:logout"))
  );
};

// ── connectSocket ─────────────────────────────────────────────────────────────
export const connectSocket = (userId) => {
  const token = getToken();
  if (!token || !userId) return null;

  // Same user — reuse existing socket
  if (socket && currentUserId === userId) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  // Alag user — pehle cleanup karo
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  if (tokenRefreshListener) {
    window.removeEventListener("auth:tokenRefreshed", tokenRefreshListener);
    tokenRefreshListener = null;
  }

  currentUserId = userId;

  socket = io(CHAT_SERVER, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Saare events ek jagah register karo
  registerSocketEvents(socket);

  // Token refresh handler
  tokenRefreshListener = (e) => {
    const newToken = e.detail?.token || getToken();
    if (!newToken || !socket) return;
    socket.auth.token = newToken;
    if (socket.connected) socket.emit("token:refresh", { token: newToken });
    else socket.connect();
  };
  window.addEventListener("auth:tokenRefreshed", tokenRefreshListener);

  return socket;
};

// ── disconnectSocket ──────────────────────────────────────────────────────────
export const disconnectSocket = () => {
  if (tokenRefreshListener) {
    window.removeEventListener("auth:tokenRefreshed", tokenRefreshListener);
    tokenRefreshListener = null;
  }
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket        = null;
    currentUserId = null;
  }
};