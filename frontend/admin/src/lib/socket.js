import { io } from "socket.io-client";

const CHAT_SERVER_URL = import.meta.env.VITE_CHAT_SERVER_URL || "http://localhost:5001";

let socket = null;

export const connectAdminSocket = (token) => {
  // if (socket?.connected) return socket;


  if (socket) {
  socket.disconnect();
  socket = null;
}
  socket = io(`${CHAT_SERVER_URL}/admin`, {
    auth: { token },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  return socket;
};

export const disconnectAdminSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getAdminSocket = () => socket;