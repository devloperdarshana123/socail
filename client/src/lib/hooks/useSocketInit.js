
// // // // // client/src/lib/hooks/useSocketInit.js
// // // // import { useEffect } from "react";
// // // // import { useSelector, useDispatch } from "react-redux";
// // // // import { connectSocket, disconnectSocket } from "../services/socketManager";
// // // // import {
// // // //   receiveMessage, applyMessageEdit, applyMessageDelete,
// // // //   applySeenReceipt, applyReaction,
// // // //   setOnlineUsers, userCameOnline, userWentOffline,
// // // //   setTyping, clearTyping,
// // // // } from "../redux/chatSlice";
// // // // import {
// // // //   addRealtimeNotification,
// // // //   setUnreadCount,
// // // // } from "../redux/notificationSlice";
// // // // import toast from "react-hot-toast";

// // // // const TOAST_OPTS = {
// // // //   duration: 4000,
// // // //   position: "top-right",
// // // //   style: {
// // // //     background: "var(--color-background-primary, #fff)",
// // // //     color:      "var(--color-text-primary, #000)",
// // // //     border:     "0.5px solid var(--color-border-tertiary, #eee)",
// // // //     borderRadius: "10px",
// // // //     fontSize:   "13px",
// // // //   },
// // // // };

// // // // // Toast labels — notification:new ke type se match karte hain
// // // // const TOAST_LABEL = {
// // // //   follow_request:          { emoji: "👤", text: "sent you a follow request" },
// // // //   follow_request_accepted: { emoji: "✅", text: "accepted your follow request" },
// // // //   follow:                  { emoji: "➕", text: "started following you" },
// // // //   post_like:               { emoji: "❤️",  text: "liked your post" },
// // // //   post_comment:            { emoji: "💬", text: "commented on your post" },
// // // //   comment_reply:           { emoji: "↩️",  text: "replied to your comment" },
// // // //   comment_like:            { emoji: "❤️",  text: "liked your comment" },
// // // //   story_reaction:          { emoji: "😮", text: "reacted to your story" },
// // // //   story_reply:             { emoji: "↩️",  text: "replied to your story" },
// // // //   new_message:             { emoji: "💬", text: "sent you a message" },
// // // // };

// // // // export default function useSocketInit() {
// // // //   const dispatch = useDispatch();
// // // //   const { user }  = useSelector((s) => s.auth);
// // // //   const userId    = user?._id?.toString();

// // // //   useEffect(() => {
// // // //     if (!userId) return;

// // // //     const socket = connectSocket(userId);
// // // //     if (!socket) return;

// // // //     // Cleanup — purane listeners hata do memory leak avoid karne ke liye
// // // //     const ALL_EVENTS = [
// // // //       // chat
// // // //       "online:list", "user:online", "user:offline",
// // // //       "message:receive", "message:edited", "message:deleted",
// // // //       "message:seen", "message:reaction", "typing:start", "typing:stop",
// // // //       // notifications
// // // //       "notification:new", "notification:unread_count",
// // // //       // YEH SAB BACKEND SE AB NAHI AATE — cleanup ke liye rakhe hain
// // // //       "follow_request_received", "follow_request_accepted",
// // // //       "follow_received", "post_liked", "post_commented",
// // // //       "comment_replied", "comment_liked", "story_reacted",
// // // //       "story_replied", "notification:message",
// // // //     ];
// // // //     ALL_EVENTS.forEach((e) => socket.off(e));

// // // //     // ── Chat listeners ────────────────────────────────────────────────────
// // // //     socket.on("online:list",      (users)  => dispatch(setOnlineUsers(users)));
// // // //     socket.on("user:online",      ({ userId: id }) => dispatch(userCameOnline({ userId: id })));
// // // //     socket.on("user:offline",     ({ userId: id }) => dispatch(userWentOffline({ userId: id })));
// // // //     socket.on("message:receive",  ({ conversationId, message, tempId }) =>
// // // //       dispatch(receiveMessage({ conversationId, message, tempId }))
// // // //     );
// // // //     socket.on("message:edited",   (p) => dispatch(applyMessageEdit(p)));
// // // //     socket.on("message:deleted",  (p) => dispatch(applyMessageDelete(p)));
// // // //     socket.on("message:seen",     (p) => dispatch(applySeenReceipt(p)));
// // // //     socket.on("message:reaction", (p) => dispatch(applyReaction(p)));
// // // //     socket.on("typing:start", ({ conversationId, userId: tid }) =>
// // // //       dispatch(setTyping({ conversationId, userId: tid }))
// // // //     );
// // // //     socket.on("typing:stop", ({ conversationId, userId: tid }) =>
// // // //       dispatch(clearTyping({ conversationId, userId: tid }))
// // // //     );

// // // //     // ── notification:new — SINGLE handler for everything ─────────────────
// // // //     // Backend sirf yahi emit karta hai ab — koi alag specific events nahi
// // // //     // Yahan se:
// // // //     //   1. Redux mein add karo (unread count bhi +1 hota hai slice mein)
// // // //     //   2. Toast dikhao
// // // //     socket.on("notification:new", (notification) => {
// // // //       // Sender normalize karo — kabhi kabhi sirf ID string aa sakti hai
// // // //       const sender =
// // // //         notification.sender && typeof notification.sender === "object"
// // // //           ? notification.sender
// // // //           : { _id: notification.sender, fullName: null, username: null, avatar: null };

// // // //       const normalized = { ...notification, sender };

// // // //       // 1. Redux update — list mein add + unread count +1
// // // //       dispatch(addRealtimeNotification(normalized));

// // // //       // 2. Toast — type se label lo
// // // //       const toastInfo = TOAST_LABEL[notification.type];
// // // //       if (toastInfo) {
// // // //         const name = sender.fullName || sender.username || "Someone";
// // // //         toast(`${toastInfo.emoji} ${name} ${toastInfo.text}`, TOAST_OPTS);
// // // //       }
// // // //     });

// // // //     // ── notification:unread_count ─────────────────────────────────────────
// // // //     // Sirf mark_read / delete ke baad backend se aata hai
// // // //     // Real-time notification pe nahi aata — isliye double count nahi hoga
// // // //     socket.on("notification:unread_count", ({ count }) => {
// // // //       dispatch(setUnreadCount(count));
// // // //     });

// // // //     const handleLogout = () => disconnectSocket();
// // // //     window.addEventListener("auth:logout", handleLogout);

// // // //     return () => {
// // // //       window.removeEventListener("auth:logout", handleLogout);
// // // //     };
// // // //   }, [userId, dispatch]);
// // // // }





// // // // client/src/lib/hooks/useSocketInit.js
// // // import { useEffect } from "react";
// // // import { useSelector, useDispatch } from "react-redux";
// // // import { connectSocket, disconnectSocket } from "../services/socketManager";
// // // import {
// // //   receiveMessage, applyMessageEdit, applyMessageDelete,
// // //   applySeenReceipt, applyReaction,
// // //   setOnlineUsers, userCameOnline, userWentOffline,
// // //   setTyping, clearTyping,
// // // } from "../redux/chatSlice";
// // // import {
// // //   addRealtimeNotification,
// // //   setUnreadCount,
// // // } from "../redux/notificationSlice";
// // // import toast from "react-hot-toast";

// // // const TOAST_OPTS = {
// // //   duration: 4000,
// // //   position: "top-right",
// // //   style: {
// // //     background:   "var(--color-background-primary, #fff)",
// // //     color:        "var(--color-text-primary, #000)",
// // //     border:       "0.5px solid var(--color-border-tertiary, #eee)",
// // //     borderRadius: "10px",
// // //     fontSize:     "13px",
// // //   },
// // // };

// // // const TOAST_LABEL = {
// // //   follow_request:          { emoji: "👤", text: "sent you a follow request" },
// // //   follow_request_accepted: { emoji: "✅", text: "accepted your follow request" },
// // //   follow:                  { emoji: "➕", text: "started following you" },
// // //   post_like:               { emoji: "❤️",  text: "liked your post" },
// // //   post_comment:            { emoji: "💬", text: "commented on your post" },
// // //   comment_reply:           { emoji: "↩️",  text: "replied to your comment" },
// // //   comment_like:            { emoji: "❤️",  text: "liked your comment" },
// // //   story_reaction:          { emoji: "😮", text: "reacted to your story" },
// // //   story_reply:             { emoji: "↩️",  text: "replied to your story" },
// // //   new_message:             { emoji: "💬", text: "sent you a message" },
// // // };

// // // export default function useSocketInit() {
// // //   const dispatch   = useDispatch();
// // //   const { user }   = useSelector((s) => s.auth);
// // //   const userId     = user?._id?.toString();
// // //   // Active conversation — agar usi conv ka message aaya toh toast mat dikhao
// // //   const activeConvId = useSelector((s) => s.chat.activeConvId);

// // //   useEffect(() => {
// // //     if (!userId) return;

// // //     const socket = connectSocket(userId);
// // //     if (!socket) return;

// // //     // Cleanup — purane listeners hata do
// // //     const ALL_EVENTS = [
// // //       "online:list", "user:online", "user:offline",
// // //       "message:receive", "message:edited", "message:deleted",
// // //       "message:seen", "message:reaction", "typing:start", "typing:stop",
// // //       "notification:new", "notification:unread_count",
// // //       // Legacy events — sirf cleanup ke liye
// // //       "follow_request_received", "follow_request_accepted",
// // //       "follow_received", "post_liked", "post_commented",
// // //       "comment_replied", "comment_liked", "story_reacted",
// // //       "story_replied", "notification:message",
// // //     ];
// // //     ALL_EVENTS.forEach((e) => socket.off(e));

// // //     // ── Online tracking ───────────────────────────────────────────────────
// // //     socket.on("online:list",  (users) => dispatch(setOnlineUsers(users)));
// // //     socket.on("user:online",  ({ userId: id }) => dispatch(userCameOnline({ userId: id })));
// // //     socket.on("user:offline", ({ userId: id }) => dispatch(userWentOffline({ userId: id })));

// // //     // ── Message events ────────────────────────────────────────────────────
// // //     socket.on("message:receive", ({ conversationId, message, tempId }) => {
// // //       // Redux update — chatSlice.receiveMessage ab totalUnread bhi badhata hai
// // //       dispatch(receiveMessage({ conversationId, message, tempId }));

// // //       // Toast — sirf agar active conversation nahi hai aur apna message nahi
// // //       const senderId = message.sender?._id?.toString() || message.sender?.toString();
// // //       const isOwn    = senderId === userId;
// // //       const isActive = activeConvId === conversationId;

// // //       if (!isOwn && !isActive) {
// // //         const senderName =
// // //           message.sender?.fullName ||
// // //           message.sender?.username ||
// // //           "Someone";
// // //         const preview =
// // //           message.text
// // //             ? message.text.slice(0, 50)
// // //             : message.image
// // //             ? "📷 Photo"
// // //             : "New message";

// // //         toast(`💬 ${senderName}: ${preview}`, TOAST_OPTS);
// // //       }
// // //     });

// // //     socket.on("message:edited",   (p) => dispatch(applyMessageEdit(p)));
// // //     socket.on("message:deleted",  (p) => dispatch(applyMessageDelete(p)));
// // //     socket.on("message:seen",     (p) => dispatch(applySeenReceipt(p)));
// // //     socket.on("message:reaction", (p) => dispatch(applyReaction(p)));

// // //     socket.on("typing:start", ({ conversationId, userId: tid }) =>
// // //       dispatch(setTyping({ conversationId, userId: tid }))
// // //     );
// // //     socket.on("typing:stop", ({ conversationId, userId: tid }) =>
// // //       dispatch(clearTyping({ conversationId, userId: tid }))
// // //     );

// // //     // ── notification:new — SINGLE handler ────────────────────────────────
// // //     socket.on("notification:new", (notification) => {
// // //       const sender =
// // //         notification.sender && typeof notification.sender === "object"
// // //           ? notification.sender
// // //           : { _id: notification.sender, fullName: null, username: null, avatar: null };

// // //       const normalized = { ...notification, sender };

// // //       // Redux update
// // //       dispatch(addRealtimeNotification(normalized));

// // //       // Toast
// // //       const toastInfo = TOAST_LABEL[notification.type];
// // //       if (toastInfo) {
// // //         const name = sender.fullName || sender.username || "Someone";
// // //         toast(`${toastInfo.emoji} ${name} ${toastInfo.text}`, TOAST_OPTS);
// // //       }
// // //     });

// // //     // ── notification:unread_count ─────────────────────────────────────────
// // //     socket.on("notification:unread_count", ({ count }) => {
// // //       dispatch(setUnreadCount(count));
// // //     });

// // //     const handleLogout = () => disconnectSocket();
// // //     window.addEventListener("auth:logout", handleLogout);

// // //     return () => {
// // //       window.removeEventListener("auth:logout", handleLogout);
// // //     };
// // //   }, [userId, dispatch, activeConvId]);
// // // }



// // // client/src/lib/hooks/useSocketInit.js
// // import { useEffect, useRef } from "react";
// // import { useSelector, useDispatch } from "react-redux";
// // import { connectSocket, disconnectSocket } from "../services/socketManager";
// // import {
// //   receiveMessage, applyMessageEdit, applyMessageDelete,
// //   applySeenReceipt, applyReaction,
// //   setOnlineUsers, userCameOnline, userWentOffline,
// //   setTyping, clearTyping,
// // } from "../redux/chatSlice";
// // import {
// //   addRealtimeNotification,
// //   setUnreadCount,
// // } from "../redux/notificationSlice";
// // import toast from "react-hot-toast";

// // const TOAST_OPTS = {
// //   duration: 4000,
// //   position: "top-right",
// //   style: {
// //     background:   "var(--color-background-primary, #fff)",
// //     color:        "var(--color-text-primary, #000)",
// //     border:       "0.5px solid var(--color-border-tertiary, #eee)",
// //     borderRadius: "10px",
// //     fontSize:     "13px",
// //   },
// // };

// // const TOAST_LABEL = {
// //   follow_request:          { emoji: "👤", text: "sent you a follow request" },
// //   follow_request_accepted: { emoji: "✅", text: "accepted your follow request" },
// //   follow:                  { emoji: "➕", text: "started following you" },
// //   post_like:               { emoji: "❤️",  text: "liked your post" },
// //   post_comment:            { emoji: "💬", text: "commented on your post" },
// //   comment_reply:           { emoji: "↩️",  text: "replied to your comment" },
// //   comment_like:            { emoji: "❤️",  text: "liked your comment" },
// //   story_reaction:          { emoji: "😮", text: "reacted to your story" },
// //   story_reply:             { emoji: "↩️",  text: "replied to your story" },
// // };

// // export default function useSocketInit() {
// //   const dispatch     = useDispatch();
// //   const { user }     = useSelector((s) => s.auth);
// //   const userId       = user?._id?.toString();
// //   const activeConvId = useSelector((s) => s.chat.activeConvId);

// //   // ── Ref use karo stale closure avoid karne ke liye ──────────────────────
// //   // useEffect sirf userId pe run hota hai — activeConvId ref se latest value milti hai
// //   const activeConvIdRef = useRef(activeConvId);
// //   const userIdRef       = useRef(userId);

// //   useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);
// //   useEffect(() => { userIdRef.current = userId; }, [userId]);

// //   useEffect(() => {
// //     if (!userId) return;

// //     const socket = connectSocket(userId);
// //     if (!socket) return;

// //     // Cleanup — purane listeners hata do
// //     const ALL_EVENTS = [
// //       "online:list", "user:online", "user:offline",
// //       "message:receive", "message:edited", "message:deleted",
// //       "message:seen", "message:reaction", "typing:start", "typing:stop",
// //       "notification:new", "notification:unread_count",
// //       // Legacy — sirf cleanup ke liye
// //       "follow_request_received", "follow_request_accepted",
// //       "follow_received", "post_liked", "post_commented",
// //       "comment_replied", "comment_liked", "story_reacted",
// //       "story_replied", "notification:message",
// //     ];
// //     ALL_EVENTS.forEach((e) => socket.off(e));

// //     // ── Online tracking ───────────────────────────────────────────────────
// //     socket.on("online:list",  (users) => dispatch(setOnlineUsers(users)));
// //     socket.on("user:online",  ({ userId: id }) => dispatch(userCameOnline({ userId: id })));
// //     socket.on("user:offline", ({ userId: id }) => dispatch(userWentOffline({ userId: id })));

// //     // ── message:receive ───────────────────────────────────────────────────
// //     socket.on("message:receive", ({ conversationId, message, tempId }) => {
// //       // Redux update — chatSlice totalUnread bhi badhata hai
// //       dispatch(receiveMessage({ conversationId, message, tempId }));

// //       // Ref se latest values lo — stale closure nahi hoga
// //       const currentUserId    = userIdRef.current;
// //       const currentActiveConv = activeConvIdRef.current;

// //       const senderId = message.sender?._id?.toString() || message.sender?.toString();
// //       const isOwn    = senderId === currentUserId;
// //       const isActive = currentActiveConv === conversationId;

// //       // Toast — sirf dusre ka message aur active conv nahi ho
// //       if (!isOwn && !isActive) {
// //         const senderName =
// //           message.sender?.fullName ||
// //           message.sender?.username ||
// //           "Someone";

// //         const preview = message.audio
// //           ? "🎙️ Voice message"
// //           : message.image
// //           ? "📷 Photo"
// //           : message.text
// //           ? message.text.slice(0, 50)
// //           : "New message";

// //         toast(`💬 ${senderName}: ${preview}`, TOAST_OPTS);
// //       }
// //     });

// //     socket.on("message:edited",   (p) => dispatch(applyMessageEdit(p)));
// //     socket.on("message:deleted",  (p) => dispatch(applyMessageDelete(p)));
// //     socket.on("message:seen",     (p) => dispatch(applySeenReceipt(p)));
// //     socket.on("message:reaction", (p) => dispatch(applyReaction(p)));

// //     socket.on("typing:start", ({ conversationId, userId: tid }) =>
// //       dispatch(setTyping({ conversationId, userId: tid }))
// //     );
// //     socket.on("typing:stop", ({ conversationId, userId: tid }) =>
// //       dispatch(clearTyping({ conversationId, userId: tid }))
// //     );

// //     // ── notification:new — SINGLE handler ────────────────────────────────
// //     socket.on("notification:new", (notification) => {
// //       const sender =
// //         notification.sender && typeof notification.sender === "object"
// //           ? notification.sender
// //           : { _id: notification.sender, fullName: null, username: null, avatar: null };

// //       dispatch(addRealtimeNotification({ ...notification, sender }));

// //       const toastInfo = TOAST_LABEL[notification.type];
// //       if (toastInfo) {
// //         const name = sender.fullName || sender.username || "Someone";
// //         toast(`${toastInfo.emoji} ${name} ${toastInfo.text}`, TOAST_OPTS);
// //       }
// //     });

// //     // ── notification:unread_count ─────────────────────────────────────────
// //     socket.on("notification:unread_count", ({ count }) => {
// //       dispatch(setUnreadCount(count));
// //     });

// //     const handleLogout = () => disconnectSocket();
// //     window.addEventListener("auth:logout", handleLogout);

// //     return () => {
// //       window.removeEventListener("auth:logout", handleLogout);
// //     };
// //   }, [userId, dispatch]); // activeConvId yahan nahi — ref se handle hota hai
// // }




// // client/src/lib/hooks/useSocketInit.js
// import { useEffect, useRef } from "react";
// import { useSelector, useDispatch } from "react-redux";
// import { connectSocket, disconnectSocket } from "../services/socketManager";
// import {
//   receiveMessage, applyMessageEdit, applyMessageDelete,
//   applySeenReceipt, applyReaction,
//   setOnlineUsers, userCameOnline, userWentOffline,
//   setTyping, clearTyping,
// } from "../redux/chatSlice";
// import {
//   addRealtimeNotification,
//   setUnreadCount,
// } from "../redux/notificationSlice";
// import toast from "react-hot-toast";

// const TOAST_OPTS = {
//   duration: 4000,
//   position: "top-right",
//   style: {
//     background:   "var(--color-background-primary, #fff)",
//     color:        "var(--color-text-primary, #000)",
//     border:       "0.5px solid var(--color-border-tertiary, #eee)",
//     borderRadius: "10px",
//     fontSize:     "13px",
//   },
// };

// const TOAST_LABEL = {
//   follow_request:          { emoji: "👤", text: "sent you a follow request" },
//   follow_request_accepted: { emoji: "✅", text: "accepted your follow request" },
//   follow:                  { emoji: "➕", text: "started following you" },
//   post_like:               { emoji: "❤️",  text: "liked your post" },
//   post_comment:            { emoji: "💬", text: "commented on your post" },
//   comment_reply:           { emoji: "↩️",  text: "replied to your comment" },
//   comment_like:            { emoji: "❤️",  text: "liked your comment" },
//   story_reaction:          { emoji: "😮", text: "reacted to your story" },
//   story_reply:             { emoji: "↩️",  text: "replied to your story" },
// };

// export default function useSocketInit() {
//   const dispatch     = useDispatch();
//   const { user }     = useSelector((s) => s.auth);
//   const userId       = user?._id?.toString();
//   const activeConvId = useSelector((s) => s.chat.activeConvId);

//   // Ref — stale closure avoid karo
//   const activeConvIdRef = useRef(activeConvId);
//   const userIdRef       = useRef(userId);
//   useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);
//   useEffect(() => { userIdRef.current = userId; }, [userId]);

//   useEffect(() => {
//     if (!userId) return;

//     const socket = connectSocket(userId);
//     if (!socket) return;

//     const ALL_EVENTS = [
//       "online:list", "user:online", "user:offline",
//       "message:receive", "message:edited", "message:deleted",
//       "message:seen", "message:reaction", "typing:start", "typing:stop",
//       "notification:new", "notification:unread_count", "notification:message",
//       // Legacy cleanup
//       "follow_request_received", "follow_request_accepted",
//       "follow_received", "post_liked", "post_commented",
//       "comment_replied", "comment_liked", "story_reacted", "story_replied",
//     ];
//     ALL_EVENTS.forEach((e) => socket.off(e));

//     // ── Online tracking ───────────────────────────────────────────────────
//     socket.on("online:list",  (users) => dispatch(setOnlineUsers(users)));
//     socket.on("user:online",  ({ userId: id }) => dispatch(userCameOnline({ userId: id })));
//     socket.on("user:offline", ({ userId: id }) => dispatch(userWentOffline({ userId: id })));

//     // ── message:receive — Redux update + badge ────────────────────────────
//     // Sirf chatSlice update karta hai — toast nahi (notification:message karta hai)
//     socket.on("message:receive", ({ conversationId, message, tempId }) => {
//       dispatch(receiveMessage({ conversationId, message, tempId }));
//     });

//     // ── notification:message — toast with actual name ─────────────────────
//     // Chathandler.js se aata hai sender.fullName ke saath
//     // Sirf agar active conversation nahi hai
//     socket.on("notification:message", ({ conversationId, sender, preview }) => {
//       const currentActiveConv = activeConvIdRef.current;
//       const currentUserId     = userIdRef.current;

//       // Active conv pe ho toh toast mat dikhao
//       if (currentActiveConv === conversationId) return;

//       const senderName = sender?.fullName || sender?.username || "Someone";
//       toast(`💬 ${senderName}: ${preview || "New message"}`, TOAST_OPTS);
//     });

//     socket.on("message:edited",   (p) => dispatch(applyMessageEdit(p)));
//     socket.on("message:deleted",  (p) => dispatch(applyMessageDelete(p)));
//     socket.on("message:seen",     (p) => dispatch(applySeenReceipt(p)));
//     socket.on("message:reaction", (p) => dispatch(applyReaction(p)));

//     socket.on("typing:start", ({ conversationId, userId: tid }) =>
//       dispatch(setTyping({ conversationId, userId: tid }))
//     );
//     socket.on("typing:stop", ({ conversationId, userId: tid }) =>
//       dispatch(clearTyping({ conversationId, userId: tid }))
//     );

//     // ── notification:new ──────────────────────────────────────────────────
//     socket.on("notification:new", (notification) => {
//       const sender =
//         notification.sender && typeof notification.sender === "object"
//           ? notification.sender
//           : { _id: notification.sender, fullName: null, username: null, avatar: null };

//       dispatch(addRealtimeNotification({ ...notification, sender }));

//       const toastInfo = TOAST_LABEL[notification.type];
//       if (toastInfo) {
//         const name = sender.fullName || sender.username || "Someone";
//         toast(`${toastInfo.emoji} ${name} ${toastInfo.text}`, TOAST_OPTS);
//       }
//     });

//     socket.on("notification:unread_count", ({ count }) => {
//       dispatch(setUnreadCount(count));
//     });

//     const handleLogout = () => disconnectSocket();
//     window.addEventListener("auth:logout", handleLogout);

//     return () => {
//       window.removeEventListener("auth:logout", handleLogout);
//     };
//   }, [userId, dispatch]);
// }



// client/src/lib/hooks/useSocketInit.js
import { useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { connectSocket, disconnectSocket } from "../services/socketManager";
import {
  receiveMessage, applyMessageEdit, applyMessageDelete,
  applySeenReceipt, applyReaction,
  setOnlineUsers, userCameOnline, userWentOffline,
  setTyping, clearTyping,
  fetchConversations,
} from "../redux/chatSlice";
import {
  addRealtimeNotification,
  setUnreadCount,
} from "../redux/notificationSlice";
import toast from "react-hot-toast";

// ── Toast config ──────────────────────────────────────────────────────────────
const TOAST_OPTS = {
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

const TOAST_LABEL = {
  follow_request:          { emoji: "👤", text: "sent you a follow request" },
  follow_request_accepted: { emoji: "✅", text: "accepted your follow request" },
  follow:                  { emoji: "➕", text: "started following you" },
  post_like:               { emoji: "❤️",  text: "liked your post" },
  post_comment:            { emoji: "💬", text: "commented on your post" },
  comment_reply:           { emoji: "↩️",  text: "replied to your comment" },
  comment_like:            { emoji: "❤️",  text: "liked your comment" },
  story_reaction:          { emoji: "😮", text: "reacted to your story" },
  story_reply:             { emoji: "↩️",  text: "replied to your story" },
};

// ── Message toast style (alag — dark theme) ───────────────────────────────────
const MSG_TOAST_OPTS = {
  duration: 4000,
  position: "top-right",
  style: {
    background:   "#1e3a5f",
    color:        "#fff",
    borderRadius: "12px",
    fontSize:     "13px",
    fontWeight:   "500",
    padding:      "12px 16px",
    boxShadow:    "0 6px 24px rgba(0,0,0,0.2)",
    cursor:       "pointer",
  },
  icon: "💬",
};

// ─────────────────────────────────────────────────────────────────────────────

export default function useSocketInit() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const userId   = user?._id?.toString();

  // Refs — stale closure se bacho, latest value hamesha milegi
  const activeConvIdRef      = useRef(null);
  const convsPreloadedRef    = useRef(false); // sirf ek baar fetch karo

  // Sync activeConvId ref
  const activeConvId = useSelector((s) => s.chat.activeConvId);
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);

  // ── Step 1: Conversations pre-load — app mount pe ─────────────────────────
  // Isse pehle koi message aaye toh bhi conversations Redux mein ready hogi
  // aur receiveMessage reducer unreadCount sahi increment kar payega
  useEffect(() => {
    if (!userId || convsPreloadedRef.current) return;
    convsPreloadedRef.current = true;
    dispatch(fetchConversations());
  }, [userId, dispatch]);

  // ── Step 2: Socket setup ───────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const socket = connectSocket(userId);
    if (!socket) return;

    // Clean all listeners first — no duplicates ever
    const ALL_EVENTS = [
      "online:list", "user:online", "user:offline",
      "message:receive", "message:edited", "message:deleted",
      "message:seen", "message:reaction",
      "typing:start", "typing:stop",
      "notification:new", "notification:unread_count", "notification:message",
      // Legacy — cleanup
      "follow_request_received", "follow_request_accepted",
      "follow_received", "post_liked", "post_commented",
      "comment_replied", "comment_liked", "story_reacted", "story_replied",
    ];
    ALL_EVENTS.forEach((e) => socket.off(e));

    // ── Online tracking ───────────────────────────────────────────────────
    socket.on("online:list",  (users) => dispatch(setOnlineUsers(users)));
    socket.on("user:online",  ({ userId: id }) => dispatch(userCameOnline({ userId: id })));
    socket.on("user:offline", ({ userId: id }) => dispatch(userWentOffline({ userId: id })));

    // ── message:receive ───────────────────────────────────────────────────
    // Redux update — badge increment chatSlice ke receiveMessage reducer mein hota hai
    // conversations already preloaded hoti hain toh conv milta hai aur count sahi hota hai
    socket.on("message:receive", ({ conversationId, message, tempId }) => {
      dispatch(receiveMessage({ conversationId, message, tempId }));
    });

    // ── notification:message — message toast ──────────────────────────────
    // Chathandler.js se aata hai — sender.fullName guaranteed hota hai
    // (fetchSenderDirect se direct DB query hoti hai)
    socket.on("notification:message", ({ conversationId, sender, preview }) => {
      // Active conversation pe khuli hui hai toh toast mat dikhao
      if (activeConvIdRef.current === conversationId) return;

      const senderName = sender?.fullName || sender?.username || "Someone";
      toast(`${senderName}: ${preview || "New message"}`, MSG_TOAST_OPTS);
    });

    // ── Message actions ───────────────────────────────────────────────────
    socket.on("message:edited",   (p) => dispatch(applyMessageEdit(p)));
    socket.on("message:deleted",  (p) => dispatch(applyMessageDelete(p)));
    socket.on("message:seen",     (p) => dispatch(applySeenReceipt(p)));
    socket.on("message:reaction", (p) => dispatch(applyReaction(p)));

    // ── Typing ────────────────────────────────────────────────────────────
    socket.on("typing:start", ({ conversationId, userId: tid }) =>
      dispatch(setTyping({ conversationId, userId: tid }))
    );
    socket.on("typing:stop", ({ conversationId, userId: tid }) =>
      dispatch(clearTyping({ conversationId, userId: tid }))
    );

    // ── Notifications ─────────────────────────────────────────────────────
    socket.on("notification:new", (notification) => {
      const sender =
        notification.sender && typeof notification.sender === "object"
          ? notification.sender
          : { _id: notification.sender, fullName: null, username: null, avatar: null };

      dispatch(addRealtimeNotification({ ...notification, sender }));

      const cfg = TOAST_LABEL[notification.type];
      if (cfg) {
        const name = sender.fullName || sender.username || "Someone";
        toast(`${cfg.emoji} ${name} ${cfg.text}`, TOAST_OPTS);
      }
    });

    socket.on("notification:unread_count", ({ count }) => {
      dispatch(setUnreadCount(count));
    });

    // ── Logout cleanup ────────────────────────────────────────────────────
    const handleLogout = () => disconnectSocket();
    window.addEventListener("auth:logout", handleLogout);

    return () => {
      window.removeEventListener("auth:logout", handleLogout);
    };
  }, [userId, dispatch]);
}