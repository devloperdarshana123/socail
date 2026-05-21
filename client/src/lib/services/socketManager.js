// // // client/src/lib/services/socketManager.js
// // import { io } from "socket.io-client";

// // const CHAT_SERVER = import.meta.env.VITE_CHAT_SERVER_URL || "http://localhost:5001";

// // let socket = null;
// // let currentUserId = null;
// // let tokenRefreshListener = null;

// // const getToken = () => localStorage.getItem("accessToken");

// // export const getSocket = () => socket;

// // export const connectSocket = (userId) => {
// //     console.log("connectSocket called:", userId, "current:", currentUserId, "socket:", socket?.id);
// //   // ✅ Already connected same user ke liye — reuse karo
// //   if (socket && currentUserId === userId) {
// //     if (!socket.connected) socket.connect();
// //     return socket;
// //   }

// //   // Alag user ya fresh connect
// //   if (socket) {
// //     socket.removeAllListeners();
// //     socket.disconnect();
// //     socket = null;
// //   }

// //   if (tokenRefreshListener) {
// //     window.removeEventListener("auth:tokenRefreshed", tokenRefreshListener);
// //     tokenRefreshListener = null;
// //   }

// //   const token = getToken();
// //   if (!token || !userId) return null;

// //   currentUserId = userId;

// //   socket = io(CHAT_SERVER, {
// //     auth: { token },
// //     transports: ["websocket"],
// //     reconnection: true,
// //     reconnectionAttempts: Infinity,
// //     reconnectionDelay: 2000,
// //     reconnectionDelayMax: 10000,
// //     pingTimeout: 60000,
// //     pingInterval: 25000,
// //   });

// //   socket.on("connect", () => {
// //     console.log("🟢 Socket connected:", userId);
// //   });

// //   // ✅ Server ne bataya token expire — lekin HTTP refresh ka wait karo
// //   // api.js interceptor "auth:tokenRefreshed" fire karega jab naya token milega
// //   // Tab socket ko update karenge — abhi nahi
// //   socket.on("token:expired", () => {
// //     console.log("⚠️ Socket token expired — waiting for HTTP refresh...");
// //     // Kuch mat karo — auth:tokenRefreshed event aayega apne aap
// //   });

// //   socket.on("token:refreshed", () => {
// //     console.log("✅ Socket token accepted by server");
// //   });

// //   socket.on("session_expired", () => {
// //     console.log("⚠️ Session fully expired — logging out");
// //     window.dispatchEvent(new CustomEvent("auth:logout"));
// //   });

// //   socket.on("disconnect", (reason) => {
// //     console.log("🔴 Disconnected:", reason);
// //   });

// //   socket.on("connect_error", (err) => {
// //     console.log("⚠️ Connect error:", err.message);
// //   });

// //   // ✅ HTTP refresh hone ke BAAD socket ko update karo
// //   // api.js interceptor yeh event fire karta hai naya token milne par
// //   tokenRefreshListener = (e) => {
// //     const newToken = e.detail?.token || getToken();
// //     if (!newToken || !socket) return;
// //     console.log("🔄 HTTP token refreshed — updating socket token...");
// //     socket.auth.token = newToken;
// //     if (socket.connected) {
// //       socket.emit("token:refresh", { token: newToken });
// //     } else {
// //       // Disconnected tha — ab fresh token ke saath reconnect karo
// //       socket.connect();
// //     }
// //   };
// //   window.addEventListener("auth:tokenRefreshed", tokenRefreshListener);

// //   return socket;
// // };

// // export const disconnectSocket = () => {
// //   if (tokenRefreshListener) {
// //     window.removeEventListener("auth:tokenRefreshed", tokenRefreshListener);
// //     tokenRefreshListener = null;
// //   }
// //   if (socket) {
// //     socket.removeAllListeners();
// //     socket.disconnect();
// //     socket = null;
// //     currentUserId = null;
// //   }
// // };


// // client/src/lib/services/socketManager.js
// import { io } from "socket.io-client";

// const CHAT_SERVER = import.meta.env.VITE_CHAT_SERVER_URL || "http://localhost:5001";

// let socket = null;
// let currentUserId = null;
// let tokenRefreshListener = null;
// let isConnecting = false; // ← NEW: connecting flag

// const getToken = () => localStorage.getItem("accessToken");

// export const getSocket = () => socket;

// export const connectSocket = (userId) => {
//   // ✅ Already connected same user — reuse, kuch mat karo
//   if (socket && currentUserId === userId && (socket.connected || isConnecting)) {
//     return socket;
//   }

//   // ✅ Already connecting — wait karo, naya mat banao
//   if (isConnecting && currentUserId === userId) {
//     return socket;
//   }

//   // Alag user — purana disconnect karo
//   if (socket && currentUserId !== userId) {
//     socket.removeAllListeners();
//     socket.disconnect();
//     socket = null;
//     currentUserId = null;
//   }

//   // Socket already exists same user ke liye — reconnect karo
//   if (socket && currentUserId === userId && !socket.connected) {
//     socket.connect();
//     return socket;
//   }

//   // Fresh socket banana hai
//   if (socket) return socket; // same user, already exists

//   const token = getToken();
//   if (!token || !userId) return null;

//   currentUserId = userId;
//   isConnecting = true;

//   if (tokenRefreshListener) {
//     window.removeEventListener("auth:tokenRefreshed", tokenRefreshListener);
//     tokenRefreshListener = null;
//   }

//   socket = io(CHAT_SERVER, {
//     auth: { token },
//     transports: ["websocket"],
//     reconnection: true,
//     reconnectionAttempts: Infinity,
//     reconnectionDelay: 2000,
//     reconnectionDelayMax: 10000,
//     pingTimeout: 60000,
//     pingInterval: 25000,
//   });

//   socket.on("connect", () => {
//     isConnecting = false;
//     console.log("🟢 Socket connected:", userId);
//   });

//   socket.on("token:expired", () => {
//     console.log("⚠️ Socket token expired — waiting for HTTP refresh...");
//   });

//   socket.on("token:refreshed", () => {
//     console.log("✅ Socket token accepted by server");
//   });

//   socket.on("session_expired", () => {
//     console.log("⚠️ Session fully expired — logging out");
//     window.dispatchEvent(new CustomEvent("auth:logout"));
//   });

//   socket.on("disconnect", (reason) => {
//     isConnecting = false;
//     console.log("🔴 Disconnected:", reason);
//   });

//   socket.on("connect_error", (err) => {
//     isConnecting = false;
//     console.log("⚠️ Connect error:", err.message);
//   });

//   tokenRefreshListener = (e) => {
//     const newToken = e.detail?.token || getToken();
//     if (!newToken || !socket) return;
//     console.log("🔄 HTTP token refreshed — updating socket token...");
//     socket.auth.token = newToken;
//     if (socket.connected) {
//       socket.emit("token:refresh", { token: newToken });
//     } else {
//       socket.connect();
//     }
//   };
//   window.addEventListener("auth:tokenRefreshed", tokenRefreshListener);

//   return socket;
// };

// export const disconnectSocket = () => {
//   isConnecting = false;
//   if (tokenRefreshListener) {
//     window.removeEventListener("auth:tokenRefreshed", tokenRefreshListener);
//     tokenRefreshListener = null;
//   }
//   if (socket) {
//     socket.removeAllListeners();
//     socket.disconnect();
//     socket = null;
//     currentUserId = null;
//   }
// };



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