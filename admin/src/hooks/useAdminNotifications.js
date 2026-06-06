// // // import { useEffect, useState, useCallback , useRef } from "react";
// // // import { connectAdminSocket, disconnectAdminSocket } from "../lib/socket";
// // // import adminApi from "../services/api";

// // // export const useAdminNotifications = () => {
// // //   const [notifications, setNotifications] = useState([]);
// // //   const [unreadCount,   setUnreadCount]   = useState(0);
// // // const socketRef = useRef(null);
// // //   useEffect(() => {
// // // let cancelled = false;

// // //     const init = async () => {
// // //       try {
// // //         // ── Server se short-lived socket token lo ──────────────────────────
// // //         const res   = await adminApi.get("/admin/auth/socket-token");
// // //         const token = res.data?.data?.token;
// // //         if (!token) return;

// // //         // ── /admin namespace pe connect karo ───────────────────────────────
// // //         // socket = connectAdminSocket(token);

// // //         disconnectAdminSocket();
// // // const socket = connectAdminSocket(token);
// // // socketRef.current = socket;

// // //         socket.on("connect", () => {
// // //           console.log("✅ Admin socket connected");
// // //         });

// // //         socket.on("admin:notification", (payload) => {
// // //           setNotifications((prev) => [payload, ...prev].slice(0, 50));
// // //           setUnreadCount((prev) => prev + 1);
// // //         });

// // //         socket.on("connect_error", (err) => {
// // //           console.error("❌ Admin socket error:", err.message);
// // //         });

// // //         socket.on("disconnect", (reason) => {
// // //           console.log("❌ Admin socket disconnected:", reason);
// // //         });

// // //       } catch (err) {
// // //         console.error("❌ Failed to init admin socket:", err.message);
// // //       }
// // //     };

// // //     init();

// // //     // return () => {
// // //     //   if (socket) {
// // //     //     socket.off("admin:notification");
// // //     //     socket.off("connect");
// // //     //     socket.off("connect_error");
// // //     //     socket.off("disconnect");
// // //     //   }
// // //     //   disconnectAdminSocket();
// // //     // };


// // //     return () => {
// // //   cancelled = true;
// // //   if (socketRef.current) {
// // //     socketRef.current.off("admin:notification");
// // //     socketRef.current.off("connect");
// // //     socketRef.current.off("connect_error");
// // //     socketRef.current.off("disconnect");
// // //     socketRef.current = null;
// // //   }
// // //   disconnectAdminSocket();
// // // };
// // //   }, []);

// // //   const markAllRead = useCallback(() => {
// // //     setUnreadCount(0);
// // //     setNotifications((prev) =>
// // //       prev.map((n) => ({ ...n, isRead: true }))
// // //     );
// // //   }, []);

// // //   const clearAll = useCallback(() => {
// // //     setNotifications([]);
// // //     setUnreadCount(0);
// // //   }, []);

// // //   return { notifications, unreadCount, markAllRead, clearAll };
// // // };




// // import { useEffect, useState, useCallback, useRef } from "react";
// // import { connectAdminSocket, disconnectAdminSocket } from "../lib/socket";
// // import adminApi from "../services/api";

// // export const useAdminNotifications = () => {
// //   const [notifications, setNotifications] = useState([]);
// //   const [unreadCount,   setUnreadCount]   = useState(0);
// //   const socketRef = useRef(null);

// //   useEffect(() => {
// //     let cancelled = false;

// //     const init = async () => {
// //       try {
// //         const res   = await adminApi.get("/admin/auth/socket-token");
// //         const token = res.data?.data?.token;
// //         if (!token || cancelled) return;

// //         disconnectAdminSocket();
// //         const socket = connectAdminSocket(token);
// //         socketRef.current = socket;

// //         socket.on("connect", () => console.log("✅ Admin socket connected"));

// //         socket.on("admin:notification", (payload) => {
// //           console.log("🔔 admin:notification received", payload);
// //           setNotifications((prev) => [payload, ...prev].slice(0, 50));
// //           setUnreadCount((prev) => prev + 1);
// //         });

// //         socket.on("connect_error", (err) => console.error("❌ Admin socket error:", err.message));
// //         socket.on("disconnect",    (reason) => console.log("❌ Admin socket disconnected:", reason));

// //       } catch (err) {
// //         console.error("❌ Failed to init admin socket:", err.message);
// //       }
// //     };

// //     init();

// //     return () => {
// //       cancelled = true;
// //       if (socketRef.current) {
// //         socketRef.current.off("admin:notification");
// //         socketRef.current.off("connect");
// //         socketRef.current.off("connect_error");
// //         socketRef.current.off("disconnect");
// //         socketRef.current = null;
// //       }
// //       disconnectAdminSocket();
// //     };
// //   }, []);

// //   const markAllRead = useCallback(() => {
// //     setUnreadCount(0);
// //     setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
// //   }, []);

// //   const clearAll = useCallback(() => {
// //     setNotifications([]);
// //     setUnreadCount(0);
// //   }, []);

// //   return { notifications, unreadCount, markAllRead, clearAll };
// // };



// import { useEffect, useState, useCallback, useRef } from "react";
// import { getAdminSocket, destroyAdminSocket } from "../lib/adminSocket";
// import adminApi from "../services/api";

// const MAX_NOTIFICATIONS = 50;

// export const useAdminNotifications = () => {
//   const [notifications, setNotifications] = useState([]);
//   const [unreadCount,   setUnreadCount]   = useState(0);
//   const [connected,     setConnected]     = useState(false);
//   const mountedRef = useRef(true);

//   useEffect(() => {
//     mountedRef.current = true;
//     let socket = null;

//     const init = async () => {
//       try {
//         const res = await adminApi.get("/admin/auth/socket-token");
//         const token = res.data?.data?.token;

//         if (!token || !mountedRef.current) return;

//         socket = getAdminSocket(token);

//         socket.on("connect", () => {
//           if (!mountedRef.current) return;
//           setConnected(true);
//           console.log("✅ Admin socket connected");
//         });

//         socket.on("disconnect", (reason) => {
//           if (!mountedRef.current) return;
//           setConnected(false);
//           console.warn("⚠️ Admin socket disconnected:", reason);
//         });

//         socket.on("connect_error", (err) => {
//           console.error("❌ Admin socket connect_error:", err.message);
//         });

//         socket.on("admin:notification", (payload) => {
//           if (!mountedRef.current) return;
//           setNotifications((prev) =>
//             [{ ...payload, isRead: false }, ...prev].slice(0, MAX_NOTIFICATIONS)
//           );
//           setUnreadCount((prev) => prev + 1);
//         });

//       } catch (err) {
//         console.error("❌ useAdminNotifications init failed:", err.message);
//       }
//     };

//     init();

//     return () => {
//       mountedRef.current = false;
//       if (socket) {
//         socket.off("connect");
//         socket.off("disconnect");
//         socket.off("connect_error");
//         socket.off("admin:notification");
//       }
//       destroyAdminSocket();
//     };
//   }, []); // ← empty — sirf mount/unmount pe

//   const markAllRead = useCallback(() => {
//     setUnreadCount(0);
//     setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
//   }, []);

//   const clearAll = useCallback(() => {
//     setNotifications([]);
//     setUnreadCount(0);
//   }, []);

//   return { notifications, unreadCount, connected, markAllRead, clearAll };
// };




import { useEffect, useState, useCallback, useRef } from "react";
import { getAdminSocket, destroyAdminSocket }        from "../lib/adminSocket";
import adminApi                                       from "../services/api";

const MAX_NOTIFICATIONS = 50;

export const useAdminNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [connected,     setConnected]     = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let socket = null;

    const init = async () => {
      try {
        // 1. Persisted notifications DB se load karo
        const { data } = await adminApi.get("/admin/notifications");
        if (!mountedRef.current) return;

        setNotifications(data.data.notifications ?? []);
        setUnreadCount(data.data.unreadCount      ?? 0);

        // 2. Socket token fetch karo
        const tokenRes = await adminApi.get("/admin/auth/socket-token");
        const token    = tokenRes.data?.data?.token;
        if (!token || !mountedRef.current) return;

        // 3. Socket connect karo
        socket = getAdminSocket(token);

        socket.on("connect", () => {
          if (!mountedRef.current) return;
          setConnected(true);
        });

        socket.on("disconnect", (reason) => {
          if (!mountedRef.current) return;
          setConnected(false);
          console.warn("⚠️ Admin socket disconnected:", reason);
        });

        socket.on("connect_error", (err) => {
          console.error("❌ Admin socket error:", err.message);
        });

        // 4. Live notification aaye toh prepend karo
        socket.on("admin:notification", (payload) => {
          if (!mountedRef.current) return;
          setNotifications((prev) =>
            [{ ...payload, isRead: false }, ...prev].slice(0, MAX_NOTIFICATIONS)
          );
          setUnreadCount((prev) => prev + 1);
        });

      } catch (err) {
        console.error("❌ useAdminNotifications init failed:", err.message);
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      if (socket) {
        socket.off("connect");
        socket.off("disconnect");
        socket.off("connect_error");
        socket.off("admin:notification");
      }
      destroyAdminSocket();
    };
  }, []);

  // DB mein bhi mark karo
  const markAllRead = useCallback(async () => {
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await adminApi.patch("/admin/notifications/read-all");
    } catch (err) {
      console.error("❌ markAllRead failed:", err.message);
    }
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, connected, markAllRead, clearAll };
};