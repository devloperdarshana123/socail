import { io, Socket } from "socket.io-client";

const CHAT_SERVER_URL =
  import.meta.env.VITE_CHAT_SERVER_URL || "http://localhost:5001";

let socket = null;
let currentToken = null;

export const getAdminSocket = (token) => {
  // Same token + already connected — reuse karo
  if (socket?.connected && currentToken === token) return socket;

  // Stale socket cleanup
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  currentToken = token;

  socket = io(`${CHAT_SERVER_URL}/admin`, {
    auth: { token },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  return socket;
};

export const destroyAdminSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
};