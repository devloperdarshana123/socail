

// import { useEffect, useState, useCallback, useRef } from "react";
// import { getAdminSocket, destroyAdminSocket }        from "../lib/adminSocket";
// import adminApi                                       from "../services/api";

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
//         // 1. Persisted notifications DB se load karo
//         const { data } = await adminApi.get("/admin/notifications");
//         if (!mountedRef.current) return;

//         setNotifications(data.data.notifications ?? []);
//         setUnreadCount(data.data.unreadCount      ?? 0);

//         // 2. Socket token fetch karo
//         const tokenRes = await adminApi.get("/admin/auth/socket-token");
//         const token    = tokenRes.data?.data?.token;
//         if (!token || !mountedRef.current) return;

//         // 3. Socket connect karo
//         socket = getAdminSocket(token);

//         socket.on("connect", () => {
//           if (!mountedRef.current) return;
//           setConnected(true);
//         });

//         socket.on("disconnect", (reason) => {
//           if (!mountedRef.current) return;
//           setConnected(false);
//           console.warn("⚠️ Admin socket disconnected:", reason);
//         });

//         socket.on("connect_error", (err) => {
//           console.error("❌ Admin socket error:", err.message);
//         });

//         // 4. Live notification aaye toh prepend karo
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
//       // destroyAdminSocket();
//     };
//   }, []);

//   // DB mein bhi mark karo
//   const markAllRead = useCallback(async () => {
//     setUnreadCount(0);
//     setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
//     try {
//       await adminApi.patch("/admin/notifications/read-all");
//     } catch (err) {
//       console.error("❌ markAllRead failed:", err.message);
//     }
//   }, []);

//   const clearAll = useCallback(() => {
//     setNotifications([]);
//     setUnreadCount(0);
//   }, []);

//   return { notifications, unreadCount, connected, markAllRead, clearAll };
// };


import { useEffect, useState, useCallback, useRef } from "react";
import { getAdminSocket } from "../lib/adminSocket";
import adminApi from "../services/api";

const MAX_NOTIFICATIONS = 50;

export const useAdminNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [connected,     setConnected]     = useState(false);
  const mountedRef     = useRef(true);
  const initializedRef = useRef(false); // ← double init guard

  useEffect(() => {
    mountedRef.current = true;

    if (initializedRef.current) return; // ← already initialized
    initializedRef.current = true;

    const init = async () => {
      try {
        const { data } = await adminApi.get("/admin/notifications");
        if (!mountedRef.current) return;
        setNotifications(data.data.notifications ?? []);
        setUnreadCount(data.data.unreadCount ?? 0);

        const tokenRes = await adminApi.get("/admin/auth/socket-token");
        const token = tokenRes.data?.data?.token;
        if (!token || !mountedRef.current) return;

        const socket = getAdminSocket(token);
        if (!socket) return;

        socket.on("connect", () => {
          if (!mountedRef.current) return;
          setConnected(true);
        });

        socket.on("disconnect", () => {
          if (!mountedRef.current) return;
          setConnected(false);
        });

        socket.on("connect_error", (err) => {
          console.error("❌ Admin socket error:", err.message);
        });

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
    };
  }, []); // ← empty deps — sirf ek baar

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