


// client/src/lib/services/socketManager.js
import { io } from "socket.io-client";

const CHAT_SERVER = import.meta.env.VITE_CHAT_SERVER_URL || "http://localhost:5001";

let socket = null;
let currentUserId = null;
let tokenRefreshListener = null;

const getToken = () => localStorage.getItem("accessToken");

export const getSocket = () => socket;

export const connectSocket = (userId) => {
  const token = getToken();
  if (!token || !userId) return null;

  // STRICT SINGLETON — same user ke liye socket already hai toh reuse karo
  if (socket && currentUserId === userId) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  // Alag user — pehle disconnect karo
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

  socket.on("connect", () => console.log("🟢 Socket connected:", userId));
  socket.on("disconnect", (reason) => console.log("🔴 Disconnected:", reason));
  socket.on("connect_error", (err) => console.log("⚠️ Connect error:", err.message));
  socket.on("token:expired", () => console.log("⚠️ Token expired — waiting for refresh"));
  socket.on("token:refreshed", () => console.log("✅ Token refreshed"));
  socket.on("session_expired", () => window.dispatchEvent(new CustomEvent("auth:logout")));

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

export const disconnectSocket = () => {
  if (tokenRefreshListener) {
    window.removeEventListener("auth:tokenRefreshed", tokenRefreshListener);
    tokenRefreshListener = null;
  }
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentUserId = null;
  }
};