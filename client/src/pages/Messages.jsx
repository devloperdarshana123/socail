
import { useEffect, useRef, useState, useCallback,useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams, useNavigate } from "react-router-dom";
import EmojiPicker from "emoji-picker-react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useVoiceToText } from "../lib/hooks/useVoiceToText";
import RenameGroupModal from "../components/RenameGroupModal";
import ReportModal from "../components/ReportModal";
import CreateGroupModal from "../components/Creategroupmodal";
import AddMemberModal from "../components/AddMemberModal";
import ChatHeaderMenu from "../components/ChatHeaderMenu";
import {
  fetchConversations, fetchMessages, setActiveConversation,
  openOrCreateConversation, selectConversations, selectActiveConvId,
  selectOnlineUsers, selectLoadingConvs,
} from "../lib/redux/chatSlice";
import {
  fetchFollowing, selectFollowing, selectLoadingFollowing,
} from "../lib/redux/followSlice";
import useChat from "../lib/hooks/useChat";
import { getSocket } from "../lib/services/socketManager";
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:9080";
// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d) =>
  d ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

const initials = (name = "") =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

const PALETTES = [
  ["#EEEDFE","#3C3489"],["#E1F5EE","#085041"],
  ["#E6F1FB","#0C447C"],["#FBEAF0","#72243E"],["#FAECE7","#712B13"],
];
const avatarStyle = (id = "") => {
  const [bg, color] = PALETTES[(id.charCodeAt(0) || 0) % PALETTES.length];
  return { background: bg, color };
};

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const canEdit = (msg) => Date.now() - new Date(msg.createdAt).getTime() < EDIT_WINDOW_MS;

const fmtDuration = (secs) => {
  if (!secs) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

// ─── useIsMobile ──────────────────────────────────────────────────────────────
function useIsMobile(bp = 768) {
  const [v, setV] = useState(() => window.innerWidth < bp);
  useEffect(() => {
    const h = () => setV(window.innerWidth < bp);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [bp]);
  return v;
}



function Avatar({ name = "", userId = "", size = 38, online = false, src = null }) {
  const [imgFailed, setImgFailed] = useState(false);
  const st      = avatarStyle(userId);
  const validSrc = src && typeof src === "string" && src.startsWith("http") ? src : null;
  const showImg  = validSrc && !imgFailed;

  return (
    <div style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>
      {showImg ? (
        <img
          src={validSrc}
          alt={name}
          onError={() => setImgFailed(true)}
          style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
        />
      ) : (
        <div style={{
          ...st, width: size, height: size, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.34, fontWeight: 500,
        }}>
          {initials(name)}
        </div>
      )}
      {online && (
        <span style={{
          position: "absolute", bottom: 1, right: 1, width: 9, height: 9,
          borderRadius: "50%", background: "#1D9E75",
          border: "2px solid var(--color-background-primary, #fff)",
        }} />
      )}
    </div>
  );
}

// ─── SeenTick ─────────────────────────────────────────────────────────────────
function SeenTick({ seenBy = [], participantIds = [], myId }) {
  const others = participantIds.filter((id) => id !== myId);
  const seen   = others.length > 0 && others.every((id) => seenBy.map(String).includes(String(id)));
  return (
    <span style={{ fontSize: 11, color: seen ? "#378ADD" : "#aaa", marginLeft: 2 }}>
      {seen ? "✓✓" : "✓"}
    </span>
  );
}

// ─── TypingBubble ─────────────────────────────────────────────────────────────
function TypingBubble() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 0" }}>
      {[0,1,2].map((i) => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: "50%", background: "#aaa",
          display: "inline-block",
          animation: `typingBounce 1.2s ${i*0.2}s infinite ease-in-out`,
        }} />
      ))}
      <style>{`
        @keyframes typingBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes recPulse{0%,100%{opacity:0.3}50%{opacity:1}}
      `}</style>
    </div>
  );
}

// ─── AudioPlayer ─────────────────────────────────────────────────────────────
function AudioPlayer({ url, isMine, duration: initDuration }) {
  const audioRef  = useRef(null);
  const [playing,  setPlaying]  = useState(false);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDuration] = useState(initDuration || 0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const fg = isMine ? "rgba(255,255,255,0.9)" : "#534AB7";
  const track = isMine ? "rgba(255,255,255,0.3)" : "#e0deff";

  return (
    <div style={{ 
      display: "flex", alignItems: "center", gap: 10, minWidth: 180, maxWidth: 240 }}>
      <audio ref={audioRef} src={url} preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onTimeUpdate={(e) => setCurrent(e.target.currentTime)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
      />
      <button onClick={toggle} style={{
        width: 34, height: 34, borderRadius: "50%", border: "none",
        background: fg, color: isMine ? "#534AB7" : "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", flexShrink: 0, fontSize: 12,
      }}>
        {playing
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        }
      </button>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
        <div
          style={{ height: 3, background: track, borderRadius: 3, cursor: "pointer", position: "relative" }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct  = (e.clientX - rect.left) / rect.width;
            if (audioRef.current) {
              audioRef.current.currentTime = pct * (duration || 1);
              setCurrent(pct * (duration || 1));
            }
          }}
        >
          <div style={{
            height: "100%", borderRadius: 3, background: fg,
            width: `${duration ? (current / duration) * 100 : 0}%`,
            transition: "width 0.1s linear",
          }} />
        </div>
        <span style={{ fontSize: 10, opacity: 0.75, color: isMine ? "#fff" : "var(--color-text-secondary)" }}>
          {playing ? fmtDuration(current) : fmtDuration(duration)}
        </span>
      </div>
      <svg width="14" height="14" fill="none" stroke={fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 0.7 }}>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    </div>
  );
}

// ─── VoiceRecordBar ───────────────────────────────────────────────────────────
function VoiceRecordBar({ recordingTime, onCancel, onStop }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 12px",
      background: "#fff5f3",
      border: "0.5px solid #ffd0c8",
      borderRadius: 22,
      flex: 1,
    }}>
      <div style={{ display: "flex", gap: 3 }}>
        {[0,1,2].map((i) => (
          <span key={i} style={{
            width: 4, height: 4, borderRadius: "50%", background: "#D85A30",
            display: "inline-block",
            animation: `recPulse 1s ${i*0.2}s infinite ease-in-out`,
          }} />
        ))}
      </div>
      <span style={{ fontSize: 13, color: "#D85A30", fontVariantNumeric: "tabular-nums", minWidth: 36 }}>
        {fmtDuration(recordingTime)}
      </span>
      <span style={{ flex: 1, fontSize: 12, color: "#999" }}>Recording…</span>
      <button onClick={onCancel} style={{
        background: "none", border: "none", cursor: "pointer",
        color: "#aaa", fontSize: 18, lineHeight: 1, padding: 2,
      }}>✕</button>
      <button onClick={onStop} style={{
        width: 32, height: 32, borderRadius: "50%", border: "none",
        background: "#534AB7", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
      }}>
        <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
  );
}

// ─── BlockedBanner ────────────────────────────────────────────────────────────
function BlockedBanner({ iBlockedThem, onUnblock }) {
  if (iBlockedThem) {
    return (
      <div style={{
        textAlign: "center", padding: "14px 16px",
        background: "#fff5f3",
        borderTop: "0.5px solid var(--color-border-tertiary)",
        fontSize: 13, color: "#D85A30",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
        You have blocked this user.
        <button onClick={onUnblock} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#534AB7", fontWeight: 600, fontSize: 13, textDecoration: "underline",
        }}>Unblock</button>
      </div>
    );
  }
  return (
    <div style={{
      textAlign: "center", padding: "14px 16px",
      background: "#fff5f3",
      borderTop: "0.5px solid var(--color-border-tertiary)",
      fontSize: 13, color: "#D85A30",
    }}>
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginRight: 6, verticalAlign: "middle" }}>
        <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
      </svg>
      You can't send messages to this person.
    </div>
  );
}

// ─── ImagePreview ─────────────────────────────────────────────────────────────
function ImagePreview({ file, onRemove }) {
  const [url, setUrl] = useState("");   // ← useState add karo

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div style={{ position: "relative", display: "inline-block", margin: "6px 0" }}>
      <img src={url} alt="preview"
        style={{ maxHeight: 120, maxWidth: 200, borderRadius: 8, objectFit: "cover", display: "block" }} />
      <button onClick={onRemove} style={{
        position: "absolute", top: -6, right: -6,
        width: 20, height: 20, borderRadius: "50%",
        background: "#D85A30", color: "#fff", border: "none",
        cursor: "pointer", fontSize: 12, lineHeight: "20px", textAlign: "center",
      }}>✕</button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Messages() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const myId     = user?.id?.toString();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const conversations  = useSelector(selectConversations);
  const activeConvId   = useSelector(selectActiveConvId);
  const onlineUsers    = useSelector(selectOnlineUsers);
  const loadingConvs   = useSelector(selectLoadingConvs);
  const messages       = useSelector((s) => s.chat?.messages?.[activeConvId] ?? []);
  const typingUsers    = useSelector((s) => s.chat?.typingUsers?.[activeConvId] ?? []);
  const loadingMsgs    = useSelector((s) => s.chat?.loadingMessages?.[activeConvId] ?? false);
  const pagination     = useSelector((s) => s.chat?.pagination?.[activeConvId] ?? null);
  const following      = useSelector(selectFollowing);
  const loadingFollowing = useSelector(selectLoadingFollowing);
  const [searchParams] = useSearchParams();
  const openUserId = searchParams.get("with");

  const {
    sendMessage, sendImageMessage, sendVoiceMessage,
    startTyping, stopTyping,
    reactToMessage, editMessage, deleteMessage,
    joinConversation, leaveConversation, markSeen,
    startRecording, stopRecording, cancelRecording,
    isRecording, recordingTime,
    blockUser, unblockUser,
  } = useChat();

  const {
    isRecording: isVTTRecording,
    isTranscribing,
    error: vttError,
    toggle: toggleVTT,
    clearError: clearVTTError,
  } = useVoiceToText({
    onResult: (transcript) => {
      setText(transcript);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
  });

  const [tab,            setTab]            = useState("chats");
  const [search,         setSearch]         = useState("");
  const [text,           setText]           = useState("");
  const [replyTo,        setReplyTo]        = useState(null);
  const [editingMsg,     setEditingMsg]     = useState(null);
  const [ctxMenu,        setCtxMenu]        = useState(null);
  const [emojiOpen,      setEmojiOpen]      = useState(false);
  const [reactTarget,    setReactTarget]    = useState(null);
  const [imageFile,      setImageFile]      = useState(null);
  const [imgUploading,   setImgUploading]   = useState(false);
  const [audioUploading, setAudioUploading] = useState(false);
  const [imgError,       setImgError]       = useState(null);
  const [editError,      setEditError]      = useState(null);
  const [headerMenu,     setHeaderMenu]     = useState(false);
  const [blockStatus,    setBlockStatus]    = useState({ blocked: false, iBlockedThem: false });
  const [showReport,     setShowReport]     = useState(false);
  const [toastMsg,       setToastMsg]       = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
const [showAddMember, setShowAddMember] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);

  const bottomRef    = useRef(null);
  const inputRef     = useRef(null);
  const topSentinel  = useRef(null);
  const msgListRef   = useRef(null);
  const fileInputRef = useRef(null);
  const openUserHandledRef = useRef(false);
  const headerMenuBtnRef = useRef(null);

const activeConv = useMemo(
  () => conversations.find((c) => (c.id || c._id) === activeConvId),
  [conversations, activeConvId]
);



// const otherParticipant = useMemo(
//   () => activeConv?.participants?.find(
//     (p) => (p.id || p).toString() !== myId
//   ) ?? null,
//   [activeConv, myId]
// );



const otherParticipant = useMemo(() => {
  if (!activeConv?.participants || !myId) return null;
  return activeConv.participants.find((p) => {
    const pid = (p?.id || p?._id || p)?.toString();
    return pid && pid !== myId;
  }) ?? null;
}, [activeConv, myId]);

const isGroup = activeConv?.isGroup ?? false;
const isDeactivated = !isGroup && otherParticipant?.accountStatus === "deactivated";
const displayName = isGroup
  ? (activeConv?.groupName || "Group")
  : (otherParticipant?.fullName || otherParticipant?.username);

const displayAvatar = isGroup
  ? (activeConv?.groupAvatar?.url || null)
  : (otherParticipant?.avatar?.url || null);

const participantIds = useMemo(
  () => (activeConv?.participants ?? []).map((p) => (p.id || p).toString()),
  [activeConv]
);

const otherId = useMemo(
  () => (otherParticipant?.id || otherParticipant?._id || otherParticipant)?.toString() ?? "",
  [otherParticipant]
);

const otherOnline = useMemo(
  () => onlineUsers.includes(otherId),
  [onlineUsers, otherId]
);

  const showSidebar  = !isMobile || !activeConvId;
  const showChatArea = !isMobile || !!activeConvId;

  const showToast = (msg, duration = 2500) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), duration);
  };

useEffect(() => { 
  if (!myId) return;
  dispatch(fetchConversations()); 
}, [myId, dispatch]);



// NAYA
useEffect(() => {
  if (!openUserId || !myId || loadingConvs) return;
  if (openUserHandledRef.current) return;
  if (openUserId === myId) return;

  const existing = conversations.find((c) =>
    c.participants?.some((p) => (p.id || p.id || p).toString() === openUserId)
  );

  if (existing) {
    openUserHandledRef.current = true;
    dispatch(setActiveConversation(existing.id || existing.id));
    return;
  }

  openUserHandledRef.current = true;
  dispatch(openOrCreateConversation(openUserId)).then((action) => {
    const convId = action?.payload?.id || action?.payload?.id;
    if (convId) dispatch(setActiveConversation(convId));
  });
}, [openUserId, myId, conversations, loadingConvs, dispatch]);


useEffect(() => {
  openUserHandledRef.current = false;
}, [openUserId]);
 useEffect(() => { if (myId) dispatch(fetchFollowing({ userId: myId })); }, [myId, dispatch]);

  useEffect(() => {
    if (!activeConvId) return;
    joinConversation(activeConvId);
    return () => leaveConversation(activeConvId);
  }, [activeConvId, joinConversation, leaveConversation]);

  useEffect(() => {
    if (activeConvId) {
      dispatch(fetchMessages({ conversationId: activeConvId }));
      setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: "auto" }); }, 100);
    }
  }, [activeConvId, dispatch]);

  useEffect(() => {
    if (!activeConvId || !otherId) { setBlockStatus({ blocked: false, iBlockedThem: false }); return; }
    const fetchBlockStatus = async () => {
      try {
        const res  = await fetch(`${BASE_URL}/api/v2/user/block-status/${otherId}`, { credentials: "include" });
        const data = await res.json();
        if (data.success) setBlockStatus({ blocked: data.data.blocked, iBlockedThem: data.data.iBlockedThem });
    } catch { setBlockStatus({ blocked: false, iBlockedThem: false }); }
    };
    fetchBlockStatus();
  }, [activeConvId, otherId]);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onBlockStatus    = ({ targetUserId, blocked, iBlockedThem }) => { if (targetUserId === otherId) setBlockStatus({ blocked, iBlockedThem }); };
    const onBlocked        = ({ blockedBy })   => { if (blockedBy === otherId)   setBlockStatus({ blocked: true,  iBlockedThem: false }); };
    const onUnblocked      = ({ unblockedBy }) => { if (unblockedBy === otherId) setBlockStatus({ blocked: false, iBlockedThem: false }); };
    const onReportSuccess  = () => showToast("Report submitted. Thank you.");
    s.on("user:blockStatus",    onBlockStatus);
    s.on("user:blocked",        onBlocked);
    s.on("user:unblocked",      onUnblocked);
    s.on("user:report:success", onReportSuccess);
    return () => {
      s.off("user:blockStatus",    onBlockStatus);
      s.off("user:blocked",        onBlocked);
      s.off("user:unblocked",      onUnblocked);
      s.off("user:report:success", onReportSuccess);
    };
  }, [otherId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  useEffect(() => {
    if (!activeConvId || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (!last || last.isOptimistic) return;
    const senderId = (last.sender?.id || last.sender)?.toString();
    if (senderId !== myId && !last.seenBy?.map(String).includes(myId))
      markSeen({ conversationId: activeConvId, messageId: last.id });
  }, [activeConvId, messages, myId, markSeen]);

  useEffect(() => {
    if (!topSentinel.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && pagination?.hasMore && !loadingMsgs) {
        const saved = msgListRef.current?.scrollHeight;
        dispatch(fetchMessages({ conversationId: activeConvId, before: pagination.nextCursor }))
          .then(() => {
            requestAnimationFrame(() => {
              if (msgListRef.current)
                msgListRef.current.scrollTop = msgListRef.current.scrollHeight - (saved || 0);
            });
          });
      }
    }, { threshold: 1.0 });
    observer.observe(topSentinel.current);
    return () => observer.disconnect();
  }, [activeConvId, pagination, loadingMsgs, dispatch]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    setImgError(null); setEditError(null);
    if (imageFile) {
      setImgUploading(true);
      const result = await sendImageMessage({
        conversationId: activeConvId, file: imageFile,
        text: trimmed, replyTo: replyTo?.id || null,
        onProgress: (state) => setImgUploading(!!state),
      });
      if (!result.success) setImgError(result.error);
      setImageFile(null); setText(""); setReplyTo(null); setEmojiOpen(false);
      inputRef.current?.focus();
      return;
    }
    if (!trimmed || !activeConvId) return;
    if (editingMsg) {
      if (!canEdit(editingMsg)) { setEditError("Cannot edit — 15 minute window has passed."); setEditingMsg(null); setText(""); return; }
      editMessage({ conversationId: activeConvId, messageId: editingMsg.id, newText: trimmed });
      setEditingMsg(null);
    } else {
      sendMessage({ conversationId: activeConvId, text: trimmed, replyTo: replyTo?.id || null });
      setReplyTo(null);
    }
    setText(""); stopTyping(activeConvId); setEmojiOpen(false);
    inputRef.current?.focus();
  }, [text, imageFile, activeConvId, editingMsg, replyTo, sendMessage, sendImageMessage, editMessage, stopTyping]);

  const handleVoiceSend = useCallback(async () => {
    const blob = await stopRecording();
    if (!blob) return;
    setAudioUploading(true);
    const result = await sendVoiceMessage({
      conversationId: activeConvId, audioBlob: blob,
      replyTo: replyTo?.id || null,
      onProgress: (s) => setAudioUploading(!!s),
    });
    setAudioUploading(false);
    if (!result?.success) showToast("Voice upload failed. Try again.");
    setReplyTo(null);
  }, [stopRecording, sendVoiceMessage, activeConvId, replyTo]);

  const handleVoiceCancel = useCallback(() => cancelRecording(), [cancelRecording]);

  const handleMicPress = useCallback(async () => {
    if (isRecording) return;
    const result = await startRecording();
    if (!result?.success) showToast(result?.error || "Could not access microphone.");
  }, [isRecording, startRecording]);

  const handleKeyDown    = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const handleTextChange = (e) => { setText(e.target.value); if (activeConvId) startTyping(activeConvId); };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setImgError("Only images allowed"); return; }
    if (file.size > 5 * 1024 * 1024)    { setImgError("Image must be under 5MB"); return; }
    setImgError(null); setImageFile(file); e.target.value = "";
  };

  const handleCtxAction = (action) => {
    const msg = ctxMenu?.msg;
    if (!msg) return;
    setCtxMenu(null); setEditError(null);
    if (action === "reply")  { setReplyTo(msg); setEditingMsg(null); inputRef.current?.focus(); }
    if (action === "edit")   {
      if (!canEdit(msg)) { setEditError("Cannot edit — 15 minute window has passed."); return; }
      setEditingMsg(msg); setReplyTo(null); setText(msg.text); inputRef.current?.focus();
    }
    if (action === "delete") deleteMessage({ conversationId: activeConvId, messageId: msg.id });
    if (action === "copy")   navigator.clipboard?.writeText(msg.text).catch(() => {});
    if (action === "react")  setReactTarget(msg.id);
  };

 
  // const handleOpenWithUser = (userId) => {
  //   if (!userId || userId === myId) return;
  //   dispatch(openOrCreateConversation(userId)).then((action) => {
  //     console.log("RESULT:", action);
  //     if (action?.payload?.id) { dispatch(setActiveConversation(action.payload.id)); setTab("chats"); }
  //     else { console.log("FAILED — payload was:", action?.payload, "error:", action?.error); }
  //   });
  // };


  const handleOpenWithUser = (userId) => {
  if (!userId || userId === myId) return;

  const existing = conversations.find((c) =>
    !c.isGroup &&
    c.participants?.some((p) => {
      const pid = (p?.id || p?._id || p)?.toString();
      return pid === userId;
    })
  );

  if (existing) {
    dispatch(setActiveConversation(existing.id));
    setTab("chats");
    return;
  }

  dispatch(openOrCreateConversation(userId)).then((action) => {
    if (action?.payload?.id) {
      dispatch(setActiveConversation(action.payload.id));
      setTab("chats");
    }
  });
};

  const handleBack = () => dispatch(setActiveConversation(null));

  const handleBlock = async () => {
    setHeaderMenu(false);
    const result = await blockUser({ targetUserId: otherId });
    if (result?.success) { setBlockStatus({ blocked: true, iBlockedThem: true }); showToast(`${otherParticipant?.fullName || "User"} blocked.`); }
    else showToast("Failed to block. Try again.");
  };

 const handleUnblock = async () => {
  const result = await unblockUser({ targetUserId: otherId });
  if (result?.success) {
    // Unblock ke baad fresh block status fetch karo
    try {
      const res = await fetch(`${BASE_URL}/api/v2/user/block-status/${otherId}`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setBlockStatus({ blocked: data.data.blocked, iBlockedThem: data.data.iBlockedThem });
      } else {
        setBlockStatus((prev) => ({ ...prev, iBlockedThem: false }));
      }
    } catch {
      setBlockStatus((prev) => ({ ...prev, iBlockedThem: false }));
    }
    showToast(`${otherParticipant?.fullName || "User"} unblocked.`);
  } else {
    showToast("Failed to unblock. Try again.");
  }
};


  const handleClearChat = async () => {
  setHeaderMenu(false);
  try {
    const res = await fetch(
      `${BASE_URL}/api/v2/messages/conversations/${activeConvId}/clear`,
      { method: "DELETE", credentials: "include" }
    );
    const data = await res.json();
    if (data.success) {
      dispatch(fetchMessages({ conversationId: activeConvId }));
      showToast("Chat cleared.");
    } else {
      showToast("Failed to clear chat.");
    }
  } catch {
    showToast("Failed to clear chat.");
  }
};
const handleReportSubmit = async (reason) => {
  setShowReport(false);
  try {
    const res = await fetch(`${BASE_URL}/api/v2/user/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ targetId: otherId, targetModel: "User", reason }),
    });

    const data = await res.json();

    if (res.status === 429) {
      showToast("Too many reports. Please wait a minute.");
      return;
    }

    if (data.alreadyReported) {
      showToast("You have already reported this user.");
      return;
    }

    if (data.success) {
      showToast("Report submitted. Our team will review it within 24 hours.");
      return;
    }

    showToast(data.message || "Failed to submit report.");

  } catch {
    showToast("Something went wrong. Try again.");
  }
};
  const filteredConvs = conversations.filter((c) => {
    // const other = c.participants?.find((p) => (p.id || p).toString() !== myId);
    const other = c.participants?.find((p) => {
  const pid = (p?.id || p?._id || p)?.toString();
  return pid && pid !== myId;
});
    return (other?.fullName || other?.username || "").toLowerCase().includes(search.toLowerCase());
  });

  const filteredFollowing = following.filter((u) =>
    (u.fullName || u.username || "").toLowerCase().includes(search.toLowerCase())
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex", height: "calc(100vh - 60px)",
        fontFamily: "inherit", position: "relative",
      }}
      onClick={() => { setCtxMenu(null); setEmojiOpen(false); setReactTarget(null); setHeaderMenu(false); }}
    >
      {/* ── Toast ── */}
      {toastMsg && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.75)", color: "#fff",
          padding: "10px 18px", borderRadius: 20,
          fontSize: 13, zIndex: 9999, whiteSpace: "nowrap", pointerEvents: "none",
        }}>{toastMsg}</div>
      )}

      {/* ── Report modal ── */}
      {showReport && (
        <ReportModal onSubmit={handleReportSubmit} onClose={() => setShowReport(false)} />
      )}

      {/* ═══════════════ SIDEBAR ═══════════════ */}
      {showSidebar && (
        <aside style={{
          width: isMobile ? "100%" : 300, flexShrink: 0,
          borderRight: isMobile ? "none" : "0.5px solid var(--color-border-tertiary)",
          display: "flex", flexDirection: "column",
          background: "var(--color-background-secondary)",
          position: isMobile ? "absolute" : "relative",
          inset: isMobile ? 0 : "auto", zIndex: isMobile ? 10 : "auto",
        }}>
          <div style={{ padding: "14px 16px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 10, color: "var(--color-text-primary)" }}>Messages</p>
            <label style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--color-background-primary)",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: 10, padding: "8px 12px", marginBottom: 10,
            }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                style={{ border: "none", background: "transparent", fontSize: 13, outline: "none", width: "100%", color: "inherit" }} />
            </label>
 {tab === "people" && (
              <button onClick={() => setShowCreateGroup(true)} style={{
                width: "100%", padding: "8px 0", marginBottom: 8,
                background: "#534AB7", color: "#fff", border: "none",
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
                + New Group
              </button>
            )}
            <div style={{ display: "flex" }}>
              {["chats","people"].map((t) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: "8px 0", border: "none", background: "none",
                  fontSize: 13, fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? "#534AB7" : "var(--color-text-secondary)",
                  borderBottom: tab === t ? "2px solid #534AB7" : "2px solid transparent",
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                  {t === "chats" ? "💬 Chats" : "👥 People"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {tab === "chats" && (
              <>
                {loadingConvs && <p style={{ padding: 16, fontSize: 13, color: "var(--color-text-tertiary)" }}>Loading…</p>}
                {!loadingConvs && filteredConvs.length === 0 && (
                  <div style={{ padding: 32, textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", marginBottom: 6 }}>No conversations yet</p>
                    <p style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Go to People tab to message someone</p>
                  </div>
                )}
                {filteredConvs.map((conv) => {
              const other = conv.participants?.find((p) => {
  const pid = (p?.id || p?._id || p)?.toString();
  return pid && pid !== myId;
});
const cOtherId = (other?.id || other)?.toString();
const isOnline = onlineUsers.includes(cOtherId);
const isActive = conv.id === activeConvId;
const lastMsg  = conv.lastMessage;
const displayName  = conv.isGroup ? (conv.groupName || "Group") : (other?.fullName || other?.username);
// const displayAvatar = conv.isGroup ? conv.groupAvatar : (other?.avatar?.url || null);
const displayAvatar = conv.isGroup ? (conv.groupAvatar?.url || null) : (other?.avatar?.url || null);

// ✅ lastMessage ab object hai — messageId check karo
const preview  = lastMsg?.messageId || lastMsg?.id
  ? lastMsg.isDeleted ? "🚫 Deleted"
  : lastMsg.audio     ? "🎙️ Voice message"
  : lastMsg.image     ? "📷 Image"
  : lastMsg.text?.slice(0, 40) || "…"
  : "Start a conversation";


const unread = typeof conv.unreadCount === "object"
  ? (conv.unreadCount?.[myId] ?? 0)
  : (conv.unreadCount ?? 0);
                  return (
                    <button key={conv.id} onClick={() => dispatch(setActiveConversation(conv.id))} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px", width: "100%", textAlign: "left",
                      border: "none", borderBottom: "0.5px solid var(--color-border-tertiary)",
                      background: isActive && !isMobile ? "var(--color-background-primary)" : "transparent",
                      cursor: "pointer", transition: "background 0.1s",
                    }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--color-background-primary)"; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                    >
                      

                        <div
  onClick={(e) => {
    e.stopPropagation();
    if (other?.username) navigate(`/profile/${other.username}`);
  }}
  style={{ cursor: "pointer" }}
>
  

    <Avatar name={displayName || "U"} userId={cOtherId}
  src={displayAvatar} online={isOnline} size={42} />
</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                          <p style={{ fontSize: 14, fontWeight: unread > 0 ? 700 : 500, color: "var(--color-text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>
                            {/* {other?.fullName || other?.username} */}
                              {displayName}
                          </p>
                          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", flexShrink: 0 }}>
                            {lastMsg ? fmt(lastMsg.sentAt || lastMsg.createdAt) : ""}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <p style={{ fontSize: 12, color: other?.accountStatus === "deactivated" ? "#D85A30" : unread > 0 ? "var(--color-text-primary)" : "var(--color-text-secondary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontWeight: unread > 0 ? 600 : 400 }}>
  {other?.accountStatus === "deactivated" ? "⚠️ Account deactivated" : preview}
</p>
                          {unread > 0 && (
  <span style={{ background: "#534AB7", color: "#fff", borderRadius: 10, fontSize: 10, padding: "2px 7px", fontWeight: 600, flexShrink: 0, marginLeft: 6 }}>
    {unread}
  </span>
)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </>
            )}

            {tab === "people" && (
              <>
                {loadingFollowing && <p style={{ padding: 16, fontSize: 13, color: "var(--color-text-tertiary)" }}>Loading…</p>}
                {!loadingFollowing && filteredFollowing.length === 0 && (
                  <div style={{ padding: 32, textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
                      {search ? "No results" : "You're not following anyone yet"}
                    </p>
                  </div>
                )}
                {filteredFollowing.map((u) => {
                  const uid = u.id?.toString();
                  const isOnline = onlineUsers.includes(uid);
                  return (
                    <button key={uid} onClick={() => handleOpenWithUser(uid)} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px", width: "100%", textAlign: "left",
                      border: "none", borderBottom: "0.5px solid var(--color-border-tertiary)",
                      background: "transparent", cursor: "pointer",
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-background-primary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      {/* <Avatar name={u.fullName || u.username || "U"} userId={uid}
                        src={u.avatar?.url || null} online={isOnline} size={42} /> */}
                        <div
  onClick={(e) => {
    e.stopPropagation();
    if (u.username) navigate(`/profile/${u.username}`);
  }}
  style={{ cursor: "pointer" }}
>
  <Avatar name={u.fullName || u.username || "U"} userId={uid}
    src={u.avatar?.url || null} online={isOnline} size={42} />
</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
                          {u.fullName || u.username}
                        </p>
                        <p style={{ fontSize: 12, color: isOnline ? "#1D9E75" : "var(--color-text-tertiary)", margin: 0 }}>
                          {isOnline ? "● Online" : u.username ? `@${u.username}` : ""}
                        </p>
                      </div>
                      <svg width="16" height="16" fill="none" stroke="#534AB7" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 0.7 }}>
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </aside>
      )}

      {/* ═══════════════ CHAT AREA ═══════════════ */}
      {showChatArea && (
        !activeConvId ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--color-text-tertiary)" }}>
            <svg width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p style={{ fontSize: 15, fontWeight: 500 }}>Select a conversation</p>
            <p style={{ fontSize: 13 }}>or go to People tab to start one</p>
          </div>
        ) : (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column", minWidth: 0,
            position: isMobile ? "absolute" : "relative",
            inset: isMobile ? 0 : "auto", zIndex: isMobile ? 20 : "auto",
            background: "var(--color-background-primary)",
          }}>
            {/* ── Chat header ── */}
          <div style={{
  display: "flex", alignItems: "center", gap: 10,
  padding: isMobile ? "10px 12px" : "12px 16px",
  borderBottom: "0.5px solid var(--color-border-tertiary)",
  background: "var(--color-background-primary)",
  position: "relative", zIndex: 100,
}}>
           
  {isMobile && (
                <button onClick={handleBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-primary)", padding: "4px 6px 4px 0", display: "flex", alignItems: "center", flexShrink: 0 }}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
              )}
              <div style={{ position: "relative", cursor: isGroup ? "pointer" : "pointer" }}
  onClick={() => {
    if (!isGroup && otherParticipant?.username) navigate(`/profile/${otherParticipant.username}`);
    if (isGroup) document.getElementById("group-avatar-input")?.click();
  }}
>
  <Avatar name={displayName || "U"}
    userId={isGroup ? activeConv?.id : otherId}
    src={displayAvatar} online={isGroup ? false : otherOnline}
    size={isMobile ? 34 : 38} />
  {isGroup && (
    <div style={{
      position: "absolute", bottom: 0, right: 0,
      width: 14, height: 14, borderRadius: "50%",
      background: "#534AB7", display: "flex",
      alignItems: "center", justifyContent: "center",
    }}>
      <svg width="8" height="8" fill="white" viewBox="0 0 24 24">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
      </svg>
    </div>
  )}
  <input id="group-avatar-input" type="file" accept="image/*" style={{ display: "none" }}
    onChange={async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { showToast("Image must be under 5MB"); return; }
      showToast("Uploading...");
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`, {
          method: "POST", body: fd,
        });
        const data = await res.json();
        const avatarUrl = data.secure_url;
        const backendRes = await fetch(`${BASE_URL}/api/v2/messages/conversations/group/${activeConvId}/rename`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatarUrl }),
        });
        const backendData = await backendRes.json();
        if (backendData.success) {
          dispatch(fetchConversations());
          showToast("Group photo updated!");
        } else {
          showToast(backendData.message || "Failed to update.");
        }
      } catch { showToast("Something went wrong."); }
      e.target.value = "";
    }}
  />
</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {displayName}
                </p> */}

     {isGroup ? (
  <div style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
    onClick={() => setShowRenameModal(true)}
  >
    <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {displayName}
    </p>
    <svg width="13" height="13" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  </div>
) : (
  <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
    {displayName}
  </p>
)}
                <p style={{ fontSize: 12, margin: 0, color: (!isGroup && otherOnline) ? "#1D9E75" : "var(--color-text-tertiary)" }}>
     {isGroup
                    ? (() => {
                        const names = activeConv?.participants
                          ?.filter((p) => (p.id || p).toString() !== myId)
                          ?.map((p) => p.fullName || p.username || "")
                          ?.filter(Boolean)
                          ?.slice(0, 3)
                          ?.join(", ");
                        const extra = (activeConv?.participants?.length || 1) - 1 - 3;
                        return names + (extra > 0 ? ` +${extra}` : "");
                      })()
                    : isDeactivated ? "⚠️ Deactivated" : blockStatus.blocked ? "Blocked" : otherOnline ? "● Online" : "Offline"}
                </p>
              </div>
              {/* 3-dot menu */}
              <div style={{ position: "relative", zIndex: 1000 }} onClick={(e) => e.stopPropagation()}>
               <button ref={headerMenuBtnRef} onClick={() => setHeaderMenu((p) => !p)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--color-text-secondary)", padding: 6, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                  </svg>
    </button>
        

{headerMenu && (
  <ChatHeaderMenu btnRef={headerMenuBtnRef} onClose={() => setHeaderMenu(false)}>
    {isGroup ? (
      <>
        <button onClick={() => { setHeaderMenu(false); setShowRenameModal(true); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", background: "none", border: "none", fontSize: 13, cursor: "pointer", color: "var(--color-text-primary)", textAlign: "left", borderBottom: "0.5px solid var(--color-border-tertiary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-background-secondary)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Rename Group
        </button>
        <button onClick={() => { setHeaderMenu(false); setShowAddMember(true); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", background: "none", border: "none", fontSize: 13, cursor: "pointer", color: "var(--color-text-primary)", textAlign: "left", borderBottom: "0.5px solid var(--color-border-tertiary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-background-secondary)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>
          Add Member
        </button>
        <button onClick={async () => { setHeaderMenu(false); try { const res = await fetch(`${BASE_URL}/api/v2/messages/conversations/group/${activeConvId}/leave`, { method: "PATCH", credentials: "include" }); const data = await res.json(); if (data.success) { dispatch(fetchConversations()); dispatch(setActiveConversation(null)); showToast("You left the group."); } else showToast(data.message || "Failed to leave group."); } catch { showToast("Something went wrong."); } }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", background: "none", border: "none", fontSize: 13, cursor: "pointer", color: "#D85A30", textAlign: "left", borderBottom: "0.5px solid var(--color-border-tertiary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-background-secondary)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Leave Group
        </button>
      </>
    ) : (
      <>
        {!blockStatus.iBlockedThem ? (
          <button onClick={handleBlock} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", background: "none", border: "none", fontSize: 13, cursor: "pointer", color: "#D85A30", textAlign: "left", borderBottom: "0.5px solid var(--color-border-tertiary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-background-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            Block user
          </button>
        ) : (
          <button onClick={() => { setHeaderMenu(false); handleUnblock(); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", background: "none", border: "none", fontSize: 13, cursor: "pointer", color: "#1D9E75", textAlign: "left", borderBottom: "0.5px solid var(--color-border-tertiary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-background-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
            Unblock user
          </button>
        )}
        <button onClick={() => { setHeaderMenu(false); setShowReport(true); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", background: "none", border: "none", fontSize: 13, cursor: "pointer", color: "var(--color-text-primary)", textAlign: "left", borderBottom: "0.5px solid var(--color-border-tertiary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-background-secondary)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Report user
        </button>
      </>
    )}
    <button onClick={handleClearChat} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", background: "none", border: "none", fontSize: 13, cursor: "pointer", color: "var(--color-text-primary)", textAlign: "left" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-background-secondary)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      Clear chat
    </button>
  </ChatHeaderMenu>
)}
  
   </div>
            </div>

            {/* ── Messages list ── */}
<div ref={msgListRef} style={{
  flex: 1, overflowY: "auto",
  padding: isMobile ? "12px 10px" : 16,
  display: "flex", flexDirection: "column", gap: 6,
  pointerEvents: headerMenu ? "none" : "auto",
  opacity: headerMenu ? 0.1 : 1,
  transition: "opacity 0.15s",
}}>
              <div ref={topSentinel} style={{ height: 1 }} />
              {loadingMsgs && messages.length === 0 && (
                <p style={{ textAlign: "center", fontSize: 12, color: "var(--color-text-tertiary)" }}>Loading messages…</p>
              )}
              {messages.map((msg) => {
                const isMine = (msg.sender?.id || msg.sender?.id || msg.sender)?.toString() === myId;
                const isDeleted    = msg.isDeleted;
                const isOptimistic = msg.isOptimistic;
                const isAudio      = msg.type === "audio" || !!msg.audio;
                return (
  <div key={msg.id} style={{
  display: "flex",
  flexDirection: isMine ? "row-reverse" : "row",
  alignItems: "flex-end", gap: 6,
  opacity: isOptimistic ? 0.7 : 1, transition: "opacity 0.2s",
  isolation: "isolate",
}}>
                    {/* {!isMine && (
                      <Avatar name={otherParticipant?.fullName || "U"} userId={otherId}
                        src={otherParticipant?.avatar?.url || null} size={isMobile ? 24 : 28} />
                    )} */}
                    {!isMine && (() => {
  const senderObj = msg.sender;
  const senderName = senderObj?.fullName || senderObj?.username || "U";
  const senderAvatar = senderObj?.avatar?.url || null;
  const senderId = (senderObj?.id || senderObj)?.toString() || "";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <Avatar name={senderName} userId={senderId}
        src={senderAvatar} size={isMobile ? 24 : 28} />
    </div>
  );
})()}
                   <div style={{ maxWidth: isMobile ? "80%" : "65%", position: "relative", zIndex: 0 }}>
                      {!isMine && isGroup && (
    <p style={{ fontSize: 11, fontWeight: 600, color: "#534AB7", margin: "0 0 2px 0" }}>
      {msg.sender?.fullName || msg.sender?.username || ""}
    </p>
  )}
                      {msg.replyTo && !isDeleted && (
                        <div style={{
                          fontSize: 11, padding: "3px 8px", marginBottom: 3,
                          borderLeft: "2px solid #534AB7",
                          background: "var(--color-background-secondary)",
                          borderRadius: "0 6px 6px 0",
                          color: "var(--color-text-secondary)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {msg.replyTo?.text || (msg.replyTo?.audio ? "🎙️ Voice message" : "📷 Image")}
                        </div>
                      )}
                      <div
                        onContextMenu={(e) => { e.preventDefault(); if (!isOptimistic) setCtxMenu({ x: e.clientX, y: e.clientY, msg }); }}
                        onTouchStart={(e) => {
                          if (isOptimistic) return;
                          const touch = e.touches[0];
                          const timer = setTimeout(() => setCtxMenu({ x: touch.clientX, y: touch.clientY, msg }), 500);
                          e.currentTarget._pressTimer = timer;
                        }}
                        onTouchEnd={(e) => clearTimeout(e.currentTarget._pressTimer)}
                        onTouchMove={(e) => clearTimeout(e.currentTarget._pressTimer)}
                        style={{
                          padding: isAudio ? "8px 10px" : "8px 12px",
                          borderRadius: isMine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                          background: isDeleted ? "var(--color-background-secondary)" : isMine ? "#534AB7" : "var(--color-background-secondary)",
                          color: isDeleted ? "var(--color-text-tertiary)" : isMine ? "#fff" : "var(--color-text-primary)",
                          fontSize: 13, lineHeight: 1.5,
                          cursor: isDeleted || isOptimistic ? "default" : "context-menu",
                          fontStyle: isDeleted ? "italic" : "normal",
                          wordBreak: "break-word",
                        }}>
                        {/* {!isDeleted && isAudio && msg.audio && (
                          <AudioPlayer
                            url={typeof msg.audio === "object" ? msg.audio.url : msg.audio}
                            duration={msg.audio?.duration} isMine={isMine}
                          />
                        )} */}

                        {!isDeleted && !isAudio && msg.image && (
  <img
    src={typeof msg.image === "object" ? msg.image.url : msg.image}
    alt="sent"
    onClick={(e) => {
      e.stopPropagation();
      window.open(typeof msg.image === "object" ? msg.image.url : msg.image, "_blank");
    }}
    style={{
      maxWidth: isMobile ? 200 : 220, borderRadius: 8,
      display: "block", marginBottom: msg.text ? 6 : 0,
      cursor: "pointer",
    }}
  />
)}
                        {isDeleted ? "This message was deleted" : (!isAudio && msg.text)}
                        {msg.isEdited && !isDeleted && (
                          <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4 }}>(edited)</span>
                        )}
                        {!isDeleted && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, justifyContent: isMine ? "flex-end" : "flex-start" }}>
                            <span style={{ fontSize: 10, opacity: 0.6 }}>{fmt(msg.createdAt)}</span>
                            {isMine && !isOptimistic && (
                              <SeenTick seenBy={msg.seenBy || []} participantIds={participantIds} myId={myId} />
                            )}
                            {isOptimistic && <span style={{ fontSize: 10, opacity: 0.5 }}>sending…</span>}
                          </div>
                        )}
                      </div>
                      {!isDeleted && msg.reactions?.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                          {msg.reactions.map((r) => (
                            <button key={r.emoji}
                              onClick={() => reactToMessage({ conversationId: activeConvId, messageId: msg.id, emoji: r.emoji })}
                              style={{ fontSize: 12, padding: "2px 6px", borderRadius: 12, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", cursor: "pointer" }}>
                              {r.emoji} {r.count > 1 && <span style={{ fontSize: 11 }}>{r.count}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      {reactTarget === msg.id && (
                        <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", zIndex: 10 }}>
                          <EmojiPicker
                            onEmojiClick={(ed) => { reactToMessage({ conversationId: activeConvId, messageId: msg.id, emoji: ed.emoji }); setReactTarget(null); }}
                            width={isMobile ? 280 : 280} height={320}
                            previewConfig={{ showPreview: false }} skinTonesDisabled
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {typingUsers.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={otherParticipant?.fullName || "U"} userId={otherId}
                    src={otherParticipant?.avatar?.url || null} size={24} />
                  <div style={{ background: "var(--color-background-secondary)", borderRadius: "12px 12px 12px 4px", padding: "8px 12px" }}>
                    <TypingBubble />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* ── Blocked banner OR input ── */}
            {isDeactivated ? (
  <div style={{
    textAlign: "center", padding: "14px 16px",
    background: "#fff5f3",
    borderTop: "0.5px solid var(--color-border-tertiary)",
    fontSize: 13, color: "#D85A30",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  }}>
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    This account has been deactivated. You cannot send messages.
  </div>
) : blockStatus.blocked ? (
  <BlockedBanner iBlockedThem={blockStatus.iBlockedThem} onUnblock={handleUnblock} />
) : (
              <div style={{
                borderTop: "0.5px solid var(--color-border-tertiary)",
                padding: isMobile ? "8px 10px" : "10px 14px",
                background: "var(--color-background-primary)",
                paddingBottom: isMobile ? "max(8px, env(safe-area-inset-bottom))" : "10px",
              }}>
                {vttError && (
                  <div style={{ fontSize: 11, color: "#D85A30", padding: "3px 8px", background: "#FFF0EC", borderRadius: 6, marginBottom: 4 }}>
                    {vttError}
                  </div>
                )}
                {(imgError || editError) && (
                  <div style={{ fontSize: 12, color: "#D85A30", marginBottom: 6, padding: "4px 8px", background: "#FFF0EC", borderRadius: 6 }}>
                    {imgError || editError}
                  </div>
                )}
                {imageFile && <ImagePreview file={imageFile} onRemove={() => setImageFile(null)} />}
                {replyTo && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", marginBottom: 8, background: "var(--color-background-secondary)", borderLeft: "3px solid #534AB7", borderRadius: "0 8px 8px 0" }}>
                    <div style={{ flex: 1, fontSize: 12 }}>
                      <strong style={{ color: "#534AB7", display: "block", fontSize: 11 }}>
                        Replying to {(replyTo.sender?.id || replyTo.sender)?.toString() === myId ? "yourself" : (otherParticipant?.fullName || otherParticipant?.username)}
                      </strong>
                      <span style={{ color: "var(--color-text-secondary)" }}>
                        {replyTo.audio ? "🎙️ Voice message" : replyTo.text?.slice(0, 60) || "📷 Image"}
                      </span>
                    </div>
                    <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", fontSize: 16 }}>✕</button>
                  </div>
                )}
                {editingMsg && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", marginBottom: 8, background: "#fff8e1", borderLeft: "3px solid #EF9F27", borderRadius: "0 8px 8px 0", fontSize: 12, color: "#633806" }}>
                    <span style={{ flex: 1 }}>✏️ Editing message</span>
                    <button onClick={() => { setEditingMsg(null); setText(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 16 }}>✕</button>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
                  {emojiOpen && (
                    <div onClick={(e) => e.stopPropagation()} style={{
                      position: "absolute", bottom: 48, left: 0, zIndex: 10,
                      ...(isMobile && { left: "50%", transform: "translateX(-50%)" }),
                    }}>
                      <EmojiPicker
                        onEmojiClick={(ed) => { setText((p) => p + ed.emoji); inputRef.current?.focus();}}
                        width={isMobile ? 300 : 300} height={380}
                        previewConfig={{ showPreview: false }} skinTonesDisabled
                      />
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: "none" }} />

                  {isRecording ? (
                    <VoiceRecordBar recordingTime={recordingTime} onCancel={handleVoiceCancel} onStop={handleVoiceSend} />
                  ) : (
                    <div style={{
                      flex: 1, display: "flex", alignItems: "center", gap: 6,
                      background: "var(--color-background-secondary)",
                      border: "0.5px solid var(--color-border-tertiary)",
                      borderRadius: 22, padding: "8px 12px",
                    }}>
                      <button aria-label="Emoji" onClick={(e) => { e.stopPropagation(); setEmojiOpen((p) => !p); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1, color: "var(--color-text-secondary)", flexShrink: 0, padding: 0 }}>
                        😊
                      </button>
                      <button aria-label="Attach image" onClick={() => fileInputRef.current?.click()} disabled={imgUploading}
                        style={{ background: "none", border: "none", cursor: imgUploading ? "wait" : "pointer", flexShrink: 0, padding: 0, opacity: imgUploading ? 0.5 : 1, display: "flex", alignItems: "center" }}>
                        <svg width="18" height="18" fill="none" stroke="#888888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      </button>
                      <input ref={inputRef} value={text} onChange={handleTextChange}
                        onKeyDown={handleKeyDown} onBlur={() => stopTyping(activeConvId)}
                        placeholder={imageFile ? "Add a caption…" : "Type a message…"}
                        style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, outline: "none", color: "inherit", minWidth: 0 }}
                      />
                      {(!text.trim() && !imageFile || isVTTRecording) && (
                        <button type="button"
                          aria-label={isVTTRecording ? "Stop voice to text" : "Voice to text"}
                          onClick={() => { clearVTTError(); toggleVTT(); }}
                          disabled={audioUploading || isRecording}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            flexShrink: 0, padding: 2, display: "flex", alignItems: "center",
                            color: isVTTRecording ? "#D85A30" : isTranscribing ? "#534AB7" : "var(--color-text-secondary)",
                            opacity: audioUploading || isRecording ? 0.4 : 1,
                            position: "relative",
                          }}>
                          {isVTTRecording && (
                            <span style={{
                              position: "absolute", top: 0, right: 0,
                              width: 7, height: 7, borderRadius: "50%",
                              background: "#D85A30",
                              animation: "recPulse 1s infinite ease-in-out",
                            }} />
                          )}
                          {isTranscribing ? (
                            <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} />
                          ) : isVTTRecording ? (
                            <MicOff size={18} />
                          ) : (
                            <Mic size={18} />
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {!isRecording && (
                    <button onClick={handleSend}
                      disabled={(!text.trim() && !imageFile) || imgUploading}
                      aria-label="Send"
                      style={{
                        width: 40, height: 40, borderRadius: "50%",
                        background: (text.trim() || imageFile) && !imgUploading ? "#534AB7" : "var(--color-background-secondary)",
                        border: "0.5px solid var(--color-border-tertiary)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: (text.trim() || imageFile) && !imgUploading ? "pointer" : "default",
                        flexShrink: 0, transition: "background 0.15s",
                      }}>
                      {imgUploading
                        ? <svg width="16" height="16" fill="none" stroke={(text.trim() || imageFile) ? "#fff" : "var(--color-text-tertiary)"} strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeDasharray="31" strokeDashoffset="10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></circle></svg>
                        : <svg width="16" height="16" fill="none" stroke={(text.trim() || imageFile) && !imgUploading ? "#fff" : "var(--color-text-tertiary)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      }
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ── CONTEXT MENU ── */}
      {ctxMenu && (
        <div onClick={(e) => e.stopPropagation()} style={{
          position: "fixed",
          top: Math.min(ctxMenu.y, window.innerHeight - 240),
          left: ctxMenu.x + 180 > window.innerWidth ? ctxMenu.x - 175 : ctxMenu.x,
          background: "var(--color-background-primary)",
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: 10, overflow: "hidden",
          zIndex: 9999, minWidth: 170,
          boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
        }}>
          
          {[
            { label: "Reply",  action: "reply",  show: true,
              icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg> },
            { label: "Edit",   action: "edit",   show: (ctxMenu.msg.sender?.id || ctxMenu.msg.sender)?.toString() === myId && !ctxMenu.msg.isDeleted && !ctxMenu.msg.audio && canEdit(ctxMenu.msg),
              icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
            { label: "React",  action: "react",  show: !ctxMenu.msg.isDeleted,
              icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg> },
            { label: "Copy",   action: "copy",   show: !!ctxMenu.msg.text && !ctxMenu.msg.isDeleted,
              icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> },
            { label: "Delete", action: "delete", show: (ctxMenu.msg.sender?.id || ctxMenu.msg.sender)?.toString() === myId && !ctxMenu.msg.isDeleted, danger: true,
              icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> },
          ].filter((i) => i.show).map((item, idx, arr) => (
            <button key={item.action} onClick={() => handleCtxAction(item.action)} style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "11px 14px", fontSize: 13, textAlign: "left",
              background: "none", border: "none", cursor: "pointer",
              color: item.danger ? "#D85A30" : "var(--color-text-primary)",
              borderBottom: idx < arr.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-background-secondary)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
              <span style={{ color: item.danger ? "#D85A30" : "var(--color-text-secondary)", flexShrink: 0 }}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      )}
      {showRenameModal && (
  <RenameGroupModal
    currentName={displayName}
    onClose={() => setShowRenameModal(false)}
    onSave={async (newName) => {
      try {
        const res = await fetch(`${BASE_URL}/api/v2/messages/conversations/group/${activeConvId}/rename`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupName: newName }),
        });
        const data = await res.json();
        if (data.success) { dispatch(fetchConversations()); showToast("Group renamed!"); }
        else showToast(data.message || "Failed to rename.");
      } catch { showToast("Something went wrong."); }
      setShowRenameModal(false);
    }}
  />
)}
{showCreateGroup && (
  <CreateGroupModal
    following={following}
    onClose={() => setShowCreateGroup(false)}
    onCreated={() => {
      dispatch(fetchConversations());
      setShowCreateGroup(false);
    }}
  />
)}
      {showAddMember && (
        <AddMemberModal
          following={following}
          existingMemberIds={participantIds}
          conversationId={activeConvId}
          onClose={() => setShowAddMember(false)}
          onAdded={() => { dispatch(fetchConversations()); showToast("Member(s) added!"); }}
        />
      )}
    </div>
  );
}