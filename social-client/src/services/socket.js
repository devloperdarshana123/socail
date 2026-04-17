

// // // src/services/socket.js
// // import { io } from "socket.io-client";

// // // VITE_SERVER se /api hataao — sirf base URL chahiye Socket.io ko
// // const BACKEND_URL = import.meta.env.VITE_SERVER?.replace("/api", "") || "http://localhost:5001";

// // const socket = io(BACKEND_URL, {
// //   autoConnect: false,
// //   withCredentials: true,
// //   auth: {
// //     token: localStorage.getItem("erosocial_token") || null,
// //   },
// // });

// // export default socket;


// import { io } from "socket.io-client";

// const BACKEND_URL = import.meta.env.VITE_SERVER?.replace("/api", "") || "http://localhost:5001";

// const socket = io(BACKEND_URL, {
//   autoConnect: false,
//   withCredentials: true,
//   auth: (cb) => {
//     cb({ token: localStorage.getItem("erosocial_token") || null });
//   },
// });

// export default socket;

import { io } from "socket.io-client";

// Social server socket (userId auth) — posts, follow, notifications
const SOCIAL_URL = import.meta.env.VITE_SERVER?.replace("/api", "") 
  || "http://localhost:9001";

// Chat server socket (JWT auth) — messages
const CHAT_URL = import.meta.env.VITE_CHAT_URL 
  || "http://localhost:5001";

// Social socket — userId se connect hota hai
export const socialSocket = io(SOCIAL_URL, {
  autoConnect: false,
  withCredentials: true,
});

// Chat socket — JWT token se connect hota hai
export const chatSocket = io(CHAT_URL, {
  autoConnect: false,
  withCredentials: true,
  auth: (cb) => {
    cb({ token: localStorage.getItem("erosocial_token") || null });
  },
});