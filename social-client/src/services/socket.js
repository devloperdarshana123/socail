

import { io } from "socket.io-client";

// Social server socket (userId auth) — posts, follow, notifications
const SOCIAL_URL = import.meta.env.VITE_SERVER?.replace("/api", "") 
  || "http://localhost:9001";

// Chat server socket (JWT auth) — messages
const CHAT_URL = import.meta.env.VITE_CHAT_URL 
  || "http://localhost:5001";

// Social socket — JWT token se connect hota hai
export const socialSocket = io(SOCIAL_URL, {
  autoConnect: false,
  withCredentials: true,
  auth: (cb) => {
    cb({ token: localStorage.getItem("erosocial_token") || null });
  },
});

// Chat socket — JWT token se connect hota hai
export const chatSocket = io(CHAT_URL, {
  autoConnect: false,
  withCredentials: true,
  auth: (cb) => {
    cb({ token: localStorage.getItem("erosocial_token") || null });
  },
});