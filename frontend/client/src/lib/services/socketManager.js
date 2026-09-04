

// client/src/lib/services/socketManager.js
import { io } from "socket.io-client";
import {
  addRealtimeNotification,
  setUnreadCount,
} from "../redux/notificationSlice";
import toast from "react-hot-toast";
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



const TOAST_OPTS = {
  duration: 4000,
  position: "top-right",
  style: {
    background:   "#fff",
    color:        "#000",
    border:       "0.5px solid #eee",
    borderRadius: "10px",
    fontSize:     "13px",
  },
};

const MSG_TOAST_OPTS = {
  duration: 4000,
  position: "top-right",
  style: {
    background:   "#1e3a5f",
    color:        "#fff",
    borderRadius: "12px",
    fontSize:     "13px",
    fontWeight:   "500",
    padding:      "12px 16px",
    boxShadow:    "0 6px 24px rgba(0,0,0,0.2)",
  },
  icon: "💬",
};

const TOAST_LABEL = {
  follow_request:          { emoji: "👤", text: "sent you a follow request" },
  follow_request_accepted: { emoji: "✅", text: "accepted your follow request" },
  follow:                  { emoji: "➕", text: "started following you" },
  post_like:               { emoji: "❤️", text: "liked your post" },
  post_comment:            { emoji: "💬", text: "commented on your post" },
  comment_reply:           { emoji: "↩️", text: "replied to your comment" },
  comment_like:            { emoji: "❤️", text: "liked your comment" },
  story_reaction:          { emoji: "😮", text: "reacted to your story" },
  story_reply:             { emoji: "↩️", text: "replied to your story" },
};
const CHAT_SERVER = import.meta.env.VITE_CHAT_SERVER_URL || "http://localhost:5001";
const API_BASE    = import.meta.env.VITE_SERVER_URL       || "http://localhost:9080/api/v2";

let socket               = null;
let currentUserId        = null;
let tokenRefreshListener = null;

export const getSocket = () => socket;

// ── Token fetch ───────────────────────────────────────────────────────────────
const fetchSocketToken = async () => {
  const res = await fetch(`${API_BASE}/auth/socket-token`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Socket token fetch failed");
  const data = await res.json();
  return data.data.token;
};

// ── Register events ───────────────────────────────────────────────────────────
const registerSocketEvents = (s) => {
  s.on("online:list",          (userIds)                                              => store.dispatch(setOnlineUsers(userIds)));
  s.on("user:online",          ({ userId })                                           => store.dispatch(userCameOnline({ userId })));
  s.on("user:offline",         ({ userId })                                           => store.dispatch(userWentOffline({ userId })));
  s.on("message:receive",      ({ conversationId, message, tempId })                  => store.dispatch(receiveMessage({ conversationId, message, tempId })));
  s.on("conversation:new",     ({ conversation })                                     => store.dispatch(addNewConversation({ conversation })));
  s.on("conversation:updated", ({ conversation })                                     => store.dispatch(updateConversation({ conversation })));
  s.on("message:edited",       ({ conversationId, messageId, newText, isEdited, editedAt }) => store.dispatch(applyMessageEdit({ conversationId, messageId, newText, isEdited, editedAt })));
  s.on("message:deleted",      ({ conversationId, messageId })                        => store.dispatch(applyMessageDelete({ conversationId, messageId })));
  s.on("message:seen",         ({ conversationId, messageId, seenBy })                => store.dispatch(applySeenReceipt({ conversationId, messageId, seenBy })));
  s.on("message:reaction",     ({ conversationId, messageId, reactions })             => store.dispatch(applyReaction({ conversationId, messageId, reactions })));
  s.on("typing:start",         ({ conversationId, userId })                           => store.dispatch(setTyping({ conversationId, userId })));
  s.on("typing:stop",          ({ conversationId, userId })                           => store.dispatch(clearTyping({ conversationId, userId })));

  s.on("connect",       () => {});
  s.on("disconnect",    () => {});
  s.on("connect_error", () => {});
// ── Notifications ──────────────────────────────────────────────────────
  s.on("notification:new", (notification) => {
    const sender =
      notification.sender && typeof notification.sender === "object"
        ? notification.sender
        : { _id: notification.sender, fullName: null, username: null, avatar: null };

    store.dispatch(addRealtimeNotification({ ...notification, sender }));

    const cfg = TOAST_LABEL[notification.type];
    if (cfg) {
      const name = sender.fullName || sender.username || "Someone";
      toast(`${cfg.emoji} ${name} ${cfg.text}`, TOAST_OPTS);
    }
  });

  s.on("notification:unread_count", ({ count }) => {
    store.dispatch(setUnreadCount(count));
  });

  // ── Message toast ───────────────────────────────────────────────────────
  s.on("notification:message", ({ conversationId, sender, preview }) => {
    const activeConvId = store.getState().chat.activeConvId;
    if (activeConvId === conversationId) return;
    const senderName = sender?.fullName || sender?.username || "Someone";
    toast(`${senderName}: ${preview || "New message"}`, MSG_TOAST_OPTS);
  });
  s.on("token:expired", () => refreshSocketToken(s));
  s.on("session_expired", () => window.dispatchEvent(new CustomEvent("auth:logout")));
};

// ── Token refresh on running socket ──────────────────────────────────────────
const refreshSocketToken = async (s) => {
  try {
    const token = await fetchSocketToken();
    s.auth.token = token;
    s.emit("token:refresh", { token });
  } catch {
    window.dispatchEvent(new CustomEvent("auth:logout"));
  }
};

// ── connectSocket (async) ─────────────────────────────────────────────────────
export const connectSocket = async (userId) => {
  if (!userId) return null;

  // Same user — reuse
  if (socket && currentUserId === userId) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  // Alag user ya fresh connect — cleanup
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  if (tokenRefreshListener) {
    window.removeEventListener("auth:tokenRefreshed", tokenRefreshListener);
    tokenRefreshListener = null;
  }

  // Token fetch
  let token;
  try {
    token = await fetchSocketToken();
  } catch {
    window.dispatchEvent(new CustomEvent("auth:logout"));
    return null;
  }

  currentUserId = userId;

  socket = io(CHAT_SERVER, {
  auth: { token },
  transports: ["polling", "websocket"],  // ← polling pehle, phir upgrade
  upgrade: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
  pingTimeout: 60000,
  pingInterval: 25000,
});

  registerSocketEvents(socket);

  // Reconnect pe fresh token
  socket.on("reconnect_attempt", async () => {
    try {
      socket.auth.token = await fetchSocketToken();
    } catch {
      socket.disconnect();
      window.dispatchEvent(new CustomEvent("auth:logout"));
    }
  });

  // Main server ne token refresh kiya — socket ko bhi update karo
  tokenRefreshListener = async () => {
    try {
      const newToken    = await fetchSocketToken();
      socket.auth.token = newToken;
      if (socket.connected) socket.emit("token:refresh", { token: newToken });
      else socket.connect();
    } catch { /* ignore */ }
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