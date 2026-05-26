

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