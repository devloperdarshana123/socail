

// // client/src/lib/hooks/useNotification.js
// import { useEffect, useCallback } from "react";
// import { useSelector } from "react-redux";
// import { connectSocket, getSocket } from "../services/socketManager";
// import toast from "react-hot-toast";

// export default function useNotification() {
//   const { user } = useSelector((s) => s.auth);
//   const userId   = user?._id?.toString();

//   useEffect(() => {
//     if (!userId) return;

//     // ✅ Same singleton — naya socket nahi banega
//     const socket = connectSocket(userId);
//     if (!socket) return;

//     // Pehle hata do duplicate se bachne ke liye
//     socket.off("follow_request_received");
//     socket.off("follow_request_accepted");
//     socket.off("post_liked");
//     socket.off("post_commented");
//     socket.off("notification:message");

//     const opts = {
//       duration: 4000,
//       position: "top-right",
//       style: {
//         background: "var(--color-background-primary, #fff)",
//         color: "var(--color-text-primary, #000)",
//         border: "0.5px solid var(--color-border-tertiary, #eee)",
//         borderRadius: "10px",
//         fontSize: "13px",
//       },
//     };

//     socket.on("follow_request_received", ({ sender }) =>
//       toast(`👤 ${sender?.fullName || sender?.username || "Someone"} ne follow request bheja`, opts)
//     );
//     socket.on("follow_request_accepted", ({ sender }) =>
//       toast(`✅ ${sender?.fullName || sender?.username || "Someone"} ne follow request accept ki`, opts)
//     );
//     socket.on("post_liked", ({ sender }) =>
//       toast(`❤️ ${sender?.fullName || sender?.username || "Someone"} ne aapki post like ki`, opts)
//     );
//     socket.on("post_commented", ({ sender }) =>
//       toast(`💬 ${sender?.fullName || sender?.username || "Someone"} ne post pe comment kiya`, opts)
//     );
//     socket.on("notification:message", ({ sender, preview }) =>
//       toast(`💬 ${sender?.fullName || sender?.username || "Someone"}: ${preview}`, opts)
//     );
//   }, [userId]);

//   const emitLike = useCallback(({ to, postId }) => {
//     const s = getSocket();
//     if (!s?.connected || !to || to === userId || !postId) return;
//     s.emit("send_like", { to, postId });
//   }, [userId]);

//   const emitComment = useCallback(({ to, postId }) => {
//     const s = getSocket();
//     if (!s?.connected || !to || to === userId || !postId) return;
//     s.emit("send_comment", { to, postId });
//   }, [userId]);

//   const emitFollowRequest = useCallback(({ to }) => {
//     const s = getSocket();
//     if (!s?.connected || !to || to === userId) return;
//     s.emit("send_follow_request", { to });
//   }, [userId]);

//   const emitFollowAccepted = useCallback(({ to }) => {
//     const s = getSocket();
//     if (!s?.connected || !to || to === userId) return;
//     s.emit("follow_accepted", { to });
//   }, [userId]);

//   return { emitLike, emitComment, emitFollowRequest, emitFollowAccepted };
// }




// client/src/lib/hooks/useNotification.js
//
// PRODUCTION-READY NOTIFICATION HOOK
//
// Kya karta hai:
//  1. App start pe DB se notifications fetch karta hai (page refresh safe)
//  2. Socket events sunता hai — real-time add karta hai Redux mein
//  3. Badge update hota hai socket "notification:unread_count" se
//  4. Emit helpers expose karta hai (like, comment, follow etc.)
//
// Kya NAHI karta:
//  - Sirf toast dikhana (woh ab bonus hai, main state Redux mein hai)
//  - Page refresh pe notifications bhool jaana
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useCallback } from "react";
import { useDispatch, useSelector }  from "react-redux";
import { connectSocket, getSocket }  from "../services/socketManager";
import toast                         from "react-hot-toast";
import {
  fetchNotifications,
  addRealtimeNotification,
  setUnreadCount,
} from "../redux/notificationSlice";

export default function useNotification() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const userId   = user?._id?.toString();

  // ── 1. Page load: DB se fetch karo ──────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    dispatch(fetchNotifications({ page: 1 }));
  }, [userId, dispatch]);

  // ── 2. Socket: real-time events ──────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const socket = connectSocket(userId);
    if (!socket) return;

    const toastStyle = {
      duration: 4000,
      position: "top-right",
      style: {
        background:   "var(--color-background-primary, #fff)",
        color:        "var(--color-text-primary, #000)",
        border:       "0.5px solid var(--color-border-tertiary, #eee)",
        borderRadius: "10px",
        fontSize:     "13px",
      },
    };

    // ── Handler factory ────────────────────────────────────────────────────
    // Har event ke liye ek handler — notification Redux mein add + toast
    const handleNotification = (toastMsg) => ({ notification, sender }) => {
      // Redux mein add karo — yahi main state hai
      if (notification) {
        dispatch(addRealtimeNotification(notification));
      }
      // Toast sirf bonus UX hai
      if (toastMsg && sender) {
        const name = sender?.fullName || sender?.username || "Kisi ne";
        toast(toastMsg(name), toastStyle);
      }
    };

    // ── Unread count update ───────────────────────────────────────────────
    const handleUnreadCount = ({ count }) => {
      dispatch(setUnreadCount(count));
    };

    // Pehle sab hata do (re-render pe duplicate listeners se bachao)
    const events = [
      "follow_request_received",
      "follow_request_accepted",
      "follow_received",
      "post_liked",
      "post_commented",
      "comment_replied",
      "comment_liked",
      "story_reacted",
      "story_replied",
      "notification:message",
      "notification:unread_count",
    ];
    events.forEach((e) => socket.off(e));

    // ── Register listeners ────────────────────────────────────────────────
    socket.on("follow_request_received",
      handleNotification((n) => `👤 ${n} ne follow request bheja`)
    );
    socket.on("follow_request_accepted",
      handleNotification((n) => `✅ ${n} ne follow request accept ki`)
    );
    socket.on("follow_received",
      handleNotification((n) => `👥 ${n} ab aapko follow kar raha hai`)
    );
    socket.on("post_liked",
      handleNotification((n) => `❤️ ${n} ne aapki post like ki`)
    );
    socket.on("post_commented",
      handleNotification((n) => `💬 ${n} ne post pe comment kiya`)
    );
    socket.on("comment_replied",
      handleNotification((n) => `↩️ ${n} ne aapke comment pe reply kiya`)
    );
    socket.on("comment_liked",
      handleNotification((n) => `❤️ ${n} ne aapka comment like kiya`)
    );
    socket.on("story_reacted",
      handleNotification((n) => `😮 ${n} ne aapki story pe react kiya`)
    );
    socket.on("story_replied",
      handleNotification((n) => `↩️ ${n} ne aapki story pe reply kiya`)
    );
    socket.on("notification:message",
      ({ notification, sender, preview }) => {
        if (notification) dispatch(addRealtimeNotification(notification));
        if (sender) {
          const name = sender?.fullName || sender?.username || "Kisi ne";
          toast(`💬 ${name}: ${preview || "New message"}`, toastStyle);
        }
      }
    );
    socket.on("notification:unread_count", handleUnreadCount);

    return () => {
      events.forEach((e) => socket.off(e));
    };
  }, [userId, dispatch]);

  // ── 3. Emit helpers ───────────────────────────────────────────────────────

  const emitLike = useCallback(({ to, postId }) => {
    const s = getSocket();
    if (!s?.connected || !to || to === userId || !postId) return;
    s.emit("send_like", { to, postId });
  }, [userId]);

  const emitComment = useCallback(({ to, postId, preview }) => {
    const s = getSocket();
    if (!s?.connected || !to || to === userId || !postId) return;
    s.emit("send_comment", { to, postId, preview });
  }, [userId]);

  const emitFollowRequest = useCallback(({ to }) => {
    const s = getSocket();
    if (!s?.connected || !to || to === userId) return;
    s.emit("send_follow_request", { to });
  }, [userId]);

  const emitFollowAccepted = useCallback(({ to }) => {
    const s = getSocket();
    if (!s?.connected || !to || to === userId) return;
    s.emit("follow_accepted", { to });
  }, [userId]);

  const emitFollow = useCallback(({ to }) => {
    const s = getSocket();
    if (!s?.connected || !to || to === userId) return;
    s.emit("send_follow", { to });
  }, [userId]);

  const emitCommentLike = useCallback(({ to, commentId }) => {
    const s = getSocket();
    if (!s?.connected || !to || to === userId || !commentId) return;
    s.emit("send_comment_like", { to, commentId });
  }, [userId]);

  const emitStoryReaction = useCallback(({ to, storyId, reaction }) => {
    const s = getSocket();
    if (!s?.connected || !to || to === userId || !storyId) return;
    s.emit("send_story_reaction", { to, storyId, reaction });
  }, [userId]);

  return {
    emitLike,
    emitComment,
    emitFollowRequest,
    emitFollowAccepted,
    emitFollow,
    emitCommentLike,
    emitStoryReaction,
  };
}