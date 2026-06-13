// // import { io, Socket } from "socket.io-client";

// // const CHAT_SERVER_URL =
// //   import.meta.env.VITE_CHAT_SERVER_URL || "http://localhost:5001";

// // let socket = null;
// // let currentToken = null;

// // export const getAdminSocket = (token) => {
// //   // Same token + already connected — reuse karo
// //   if (socket?.connected && currentToken === token) return socket;

// //   // Stale socket cleanup
// //   if (socket) {
// //     socket.removeAllListeners();
// //     socket.disconnect();
// //     socket = null;
// //   }

// //   currentToken = token;

// //   socket = io(`${CHAT_SERVER_URL}/admin`, {
// //     auth: { token },
// //     withCredentials: true,
// //     reconnection: true,
// //     reconnectionAttempts: 10,
// //     reconnectionDelay: 1000,
// //     reconnectionDelayMax: 5000,
// //     timeout: 10000,
// //   });

// //   return socket;
// // };

// // export const destroyAdminSocket = () => {
// //   if (socket) {
// //     socket.removeAllListeners();
// //     socket.disconnect();
// //     socket = null;
// //     currentToken = null;
// //   }
// // };



// import { io } from "socket.io-client";

// const CHAT_SERVER_URL = import.meta.env.VITE_CHAT_SERVER_URL || "http://localhost:5001";

// let socket = null;
// let currentToken = null;

// // Token ke saath call karo — connect karta hai
// // Bina token ke call karo — existing socket return karta hai
// export const getAdminSocket = (token) => {
//   if (token) {
//     // Same token + connected — reuse
//     if (socket?.connected && currentToken === token) return socket;

//     // Naya token ya disconnected — reconnect
//     if (socket) {
//       socket.removeAllListeners();
//       socket.disconnect();
//       socket = null;
//     }

//     currentToken = token;

//     socket = io(`${CHAT_SERVER_URL}/admin`, {
//       auth: { token },
//       withCredentials: true,
//       transports: ["websocket"],
//       reconnection: true,
//       reconnectionAttempts: Infinity,
//       reconnectionDelay: 2000,
//       reconnectionDelayMax: 10000,
//     });

//     socket.on("connect", () => {
//       socket.emit("admin:join_room");
//     });
//   }

//   return socket;
// };

// export const destroyAdminSocket = () => {
//   if (socket) {
//     socket.removeAllListeners();
//     socket.disconnect();
//     socket = null;
//     currentToken = null;
//   }
// };


import { io } from "socket.io-client";

const CHAT_SERVER_URL = import.meta.env.VITE_CHAT_SERVER_URL || "http://localhost:5001";

let socket = null;
let currentToken = null;
const readyCallbacks = new Set();

export const onAdminSocketReady = (cb) => {
  if (socket?.connected) {
    cb(socket);
    return () => {};
  }
  readyCallbacks.add(cb);
  return () => readyCallbacks.delete(cb);
};

export const getAdminSocket = (token) => {
  if (token) {
    if (socket?.connected && currentToken === token) return socket;

    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    currentToken = token;

    socket = io(`${CHAT_SERVER_URL}/admin`, {
      auth: { token },
      withCredentials: true,
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    socket.on("connect", () => {
      socket.emit("admin:join_room");
      readyCallbacks.forEach((cb) => cb(socket));
      readyCallbacks.clear();
    });
  }

  return socket;
};

export const destroyAdminSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentToken = null;
    readyCallbacks.clear();
  }
};