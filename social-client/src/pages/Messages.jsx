
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { chatSocket as socket } from "../services/socket";
import EmojiPicker from "emoji-picker-react";
import {
  fetchFollowingForMessages,
  getOrCreateConversation,
  fetchMessages,
  setActiveConversation,
  appendMessage,
  removeMessage,
  setTypingUser,
  userCameOnline,
  userWentOffline,
  markConversationRead,
  updateConversationUnread,
  updateMessage,
} from "../store/slices/Messageslice";
import {
  Send, Search, ArrowLeft, Check, CheckCheck,
  Trash2, Image, X, Reply, MessageCircle , Smile ,Pencil ,Mic , MicOff
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
const Avatar = ({ src, name, size = "w-10 h-10", textSize = "text-sm", online = false }) => (
  <div className="relative shrink-0">
    {src ? (
      <img src={src} alt={name} className={`${size} rounded-full object-cover`} />
    ) : (
      <div className={`${size} rounded-full bg-linear-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold ${textSize}`}>
        {name?.charAt(0).toUpperCase()}
      </div>
    )}
    {online && (
      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
    )}
  </div>
);

const formatTime = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const diff = Date.now() - d;
  if (diff < 86400000) return "Today";
  if (diff < 172800000) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const isSameDay = (a, b) => {
  const da = new Date(a), db = new Date(b);
  return da.getDate() === db.getDate() &&
    da.getMonth()    === db.getMonth() &&
    da.getFullYear() === db.getFullYear();
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function Messages() {
  const { userId: routeUserId } = useParams();
  const { user } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const {
    followingList, activeConversation, messages,
    loadingFollowing, loadingMessages,
    hasMoreMessages, typingUsers, onlineUsers,
  } = useSelector((s) => s.messages);

  const [text, setText]             = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyTo, setReplyTo]       = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile]   = useState(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [showEmoji, setShowEmoji] = useState(false);
const [editingMsg, setEditingMsg] = useState(null); // {_id, text}
const [isListening, setIsListening] = useState(false);
const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const typingTimerRef = useRef(null);
  const fileInputRef   = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages.length, scrollToBottom]);
  // ✅ YAHAN ADD KARO — scrollToBottom useEffect ke baad:

// ✅ Badlo
const emojiRef = useRef(null);

useEffect(() => {
  const handleClickOutside = (e) => {
    if (emojiRef.current && !emojiRef.current.contains(e.target)) {
      setShowEmoji(false);
    }
  };
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);

useEffect(() => {
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}, []);
  // ── Socket setup ──────────────────────────────────────────────────────────
//   useEffect(() => {
//     if (!user?._id) return;
// const onConnect    = () => setIsConnected(true);
// const onDisconnect = () => setIsConnected(false);
// const onNewMessage = (msg) => dispatch(appendMessage(msg));
// const onMsgDeleted = ({ messageId }) => dispatch(removeMessage({ messageId }));
// const onMsgEdited  = ({ messageId, newText }) => dispatch(updateMessage({ messageId, newText }));
// const onTyping     = ({ userId: uid, isTyping }) => {
//   if (activeConversation?._id)
//     dispatch(setTypingUser({ userId: uid, conversationId: activeConversation._id, isTyping }));
// };
// const onUserOnline  = (uid) => dispatch(userCameOnline(uid));
// const onUserOffline = (uid) => dispatch(userWentOffline(uid));
// const onConvUpdated = (payload) => dispatch(updateConversationUnread(payload));

// socket.on("connect",             onConnect);
// socket.on("disconnect",          onDisconnect);
// socket.on("message:receive", (data) => {
//   console.log("📨 Received:", data);
//   if (data?.message) dispatch(appendMessage(data.message));
// });
// socket.on("message:delete",      ({ messageId }) => dispatch(removeMessage({ messageId })));
// socket.on("message:edited",      onMsgEdited);
// socket.on("typingStatus",        onTyping);
// socket.on("userOnline",          onUserOnline);
// socket.on("userOffline",         onUserOffline);
// socket.on("conversationUpdated", onConvUpdated);

// return () => {
//   socket.off("connect",             onConnect);
//   socket.off("disconnect",          onDisconnect);
//   socket.off("message:receive");
// socket.off("message:delete");
//   socket.off("message:edited",      onMsgEdited);
//   socket.off("typingStatus",        onTyping);
//   socket.off("userOnline",          onUserOnline);
//   socket.off("userOffline",         onUserOffline);
//   socket.off("conversationUpdated", onConvUpdated);
// };
//   },[user?._id, activeConversation?._id]); // eslint-disable-line



useEffect(() => {
  if (!user?._id) return;

  const onConnect    = () => setIsConnected(true);
  const onDisconnect = () => setIsConnected(false);
  const onMsgEdited  = ({ messageId, newText }) => dispatch(updateMessage({ messageId, newText }));
  const onUserOnline  = (uid) => dispatch(userCameOnline(uid));
  const onUserOffline = (uid) => dispatch(userWentOffline(uid));
  const onConvUpdated = (payload) => dispatch(updateConversationUnread(payload));

  // const onNewMessage = (data) => {
  //   console.log("📨 Received:", data);
  //   if (data?.message) dispatch(appendMessage(data.message));
  // };
// ✅ Badlo
const onNewMessage = (data) => {
  console.log("📨 Received:", data);
  if (!data?.message) return;

  dispatch(appendMessage(data.message));

  const isOwnMessage = data.message.sender?._id === user?._id;
  if (!isOwnMessage && document.hidden) {
    if (Notification.permission === "granted") {
      new Notification(data.message.sender?.name || "New Message", {
        body: data.message.text || "📷 Photo",
        icon: data.message.sender?.avatar || "/logo.png",
      });
    }
  }
};
  const onMsgDeleted = (data) => {
    if (data?.messageId) dispatch(removeMessage({ messageId: data.messageId }));
  };

  const onTyping = ({ userId: uid, isTyping, conversationId: cId }) => {
    if (cId) dispatch(setTypingUser({ userId: uid, conversationId: cId, isTyping: !!isTyping }));
  };

  socket.off("connect").on("connect", onConnect);
  socket.off("disconnect").on("disconnect", onDisconnect);
  socket.off("message:receive").on("message:receive", onNewMessage);
  socket.off("message:delete").on("message:delete", onMsgDeleted);
  socket.off("message:edited").on("message:edited", onMsgEdited);
  socket.off("typingStatus").on("typingStatus", onTyping);
  socket.off("typing:start").on("typing:start", ({ userId: uid, conversationId: cId }) =>
    dispatch(setTypingUser({ userId: uid, conversationId: cId, isTyping: true })));
  socket.off("typing:stop").on("typing:stop", ({ userId: uid, conversationId: cId }) =>
    dispatch(setTypingUser({ userId: uid, conversationId: cId, isTyping: false })));
  socket.off("userOnline").on("userOnline", onUserOnline);
  socket.off("userOffline").on("userOffline", onUserOffline);
  socket.off("conversationUpdated").on("conversationUpdated", onConvUpdated);

  return () => {
    socket.off("connect", onConnect);
    socket.off("disconnect", onDisconnect);
    socket.off("message:receive", onNewMessage);
    socket.off("message:delete", onMsgDeleted);
    socket.off("message:edited", onMsgEdited);
    socket.off("typingStatus", onTyping);
    socket.off("typing:start");
    socket.off("typing:stop");
    socket.off("userOnline", onUserOnline);
    socket.off("userOffline", onUserOffline);
    socket.off("conversationUpdated", onConvUpdated);
  };
}, [user?._id, dispatch]);
  // ── Load following list ───────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchFollowingForMessages());
  }, [dispatch]);

  // ── Route param: /messages/:userId ────────────────────────────────────────
  useEffect(() => {
    if (!routeUserId) return;
    dispatch(getOrCreateConversation(routeUserId)).then((res) => {
      if (getOrCreateConversation.fulfilled.match(res)) {
        const conv = res.payload;
        loadConversation(conv);
      } else {
        toast.error("Pehle follow karo!");
        navigate("/messages");
      }
    });
  }, [routeUserId]); // eslint-disable-line

  // ── Open a conversation ───────────────────────────────────────────────────
// ✅ Yeh lagao
const loadConversation = useCallback((conv) => {
  if (activeConversation?._id === conv?._id) return;

  if (activeConversation?._id) {
    socket.emit("conversation:leave", { conversationId: activeConversation._id });
  }

  socket.emit("conversation:join", { conversationId: conv._id });
  socket.emit("markRead", { conversationId: conv._id });

  dispatch(setActiveConversation(conv));
  dispatch(fetchMessages({ conversationId: conv._id, page: 1 }));
  dispatch(markConversationRead(conv._id));
  setShowMobileChat(true);
  setText(""); setReplyTo(null);
}, [activeConversation, dispatch]);

  // ── Click on a following user ─────────────────────────────────────────────
  const handleSelectUser = useCallback((item) => {
    if (item.conversation) {
      loadConversation(item.conversation);
    } else {
      dispatch(getOrCreateConversation(item.user._id)).then((res) => {
        if (getOrCreateConversation.fulfilled.match(res)) {
          loadConversation(res.payload);
        }
      });
    }
  }, [dispatch, loadConversation]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    if (editingMsg) {
    if (!text.trim()) return;
    socket.emit("message:edit", {
      conversationId: activeConversation._id,
      messageId: editingMsg._id,
      newText: text.trim(),
    });
    setEditingMsg(null);
    setText("");
    return;
  }
    if ((!text.trim() && !imageFile) || !activeConversation) return;

    if (imageFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
     socket.emit("message:send", {
  conversationId: activeConversation._id,
  message: { text: text.trim(), image: e.target.result, replyTo: replyTo?._id || null },
});
        setText(""); setImageFile(null); setImagePreview(null); setReplyTo(null);
      };
      reader.readAsDataURL(imageFile);
      return;
    }
socket.emit("message:send", {
  conversationId: activeConversation._id,
  message: { text: text.trim(), image: null, replyTo: replyTo?._id || null },
});
setText(""); setReplyTo(null);
    inputRef.current?.focus();
  }, [text, imageFile, activeConversation, replyTo]);

  const handleTyping = (e) => {
    setText(e.target.value);
    if (!activeConversation) return;
socket.emit("typing:start", { conversationId: activeConversation._id });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
    socket.emit("typing:stop", { conversationId: activeConversation._id });
    }, 1500);
  };

  const handleDelete = (messageId) => {
    if (!activeConversation) return;
 socket.emit("message:delete", { messageId, conversationId: activeConversation._id });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };



  const handleVoiceInput = () => {
  if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
    toast.error("Tumhara browser speech support nahi karta!");
    return;
  }

  if (isListening) {
    recognitionRef.current?.stop();
    return;
  }

  if (recognitionRef.current) {
    recognitionRef.current.onresult = null;
    recognitionRef.current.abort();
    recognitionRef.current = null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognitionRef.current = recognition;

  recognition.lang = "en-US";
  recognition.continuous = true;       // ✅ Chrome ke liye zaroori
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let fullTranscript = "";

  recognition.onstart = () => setIsListening(true);

  recognition.onresult = (e) => {
    // ✅ Saare final results combine karo
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        fullTranscript += e.results[i][0].transcript + " ";
      }
    }
  };

  recognition.onend = () => {
    // ✅ Stop pe jo bhi bola woh ek baar set karo
    if (fullTranscript.trim()) {
      setText(prev => prev ? prev + " " + fullTranscript.trim() : fullTranscript.trim());
      inputRef.current?.focus();
    }
    setIsListening(false);
    recognitionRef.current = null;
  };

  recognition.onerror = (e) => {
    console.error("Speech error:", e.error);
    setIsListening(false);
    recognitionRef.current = null;
  };

  recognition.start();
};

//  const handleVoiceInput = () => {
//   if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
//     toast.error("Tumhara browser speech support nahi karta!");
//     return;
//   }

//   if (isListening) {
//     recognitionRef.current?.stop();
//     setIsListening(false);
//     return;
//   }

//   // ✅ Pehle wala stop karo agar chal raha ho
//   if (recognitionRef.current) {
//     recognitionRef.current.onresult = null;
//     recognitionRef.current.stop();
//   }

//   const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
//   const recognition = new SpeechRecognition();
//   recognitionRef.current = recognition;

//  recognition.lang = "en-US";
//   recognition.continuous = false;
//   recognition.interimResults = false;
//   recognition.maxAlternatives = 1; // ✅ Yeh add karo

//   let resultCaptured = false; // ✅ Guard

//   recognition.onstart = () => setIsListening(true);

//   recognition.onresult = (e) => {
//     if (resultCaptured) return; // ✅ Duplicate block karo
//     resultCaptured = true;
//     const transcript = e.results[0][0].transcript;
//     setText(prev => prev ? prev + " " + transcript : transcript);
//     inputRef.current?.focus();
//      recognition.abort();
//   };

//   recognition.onend = () => {
    
//     setIsListening(false);
//     recognitionRef.current = null; // ✅ Cleanup
//   };
  
//   recognition.onerror = () => {
//     setIsListening(false);
//     recognitionRef.current = null;
//   };

//   recognition.start();
// };
  // ── Derived state ─────────────────────────────────────────────────────────
  const getOtherParticipant = (conv) =>
    conv?.participants?.find((p) => p._id !== user?._id);

  const otherUser     = getOtherParticipant(activeConversation);
  const isOtherOnline = otherUser && onlineUsers.includes(otherUser._id);
  const isOtherTyping = activeConversation &&
    (typingUsers[activeConversation._id] || []).length > 0;

  const filteredList = followingList.filter((item) =>
    item.user?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full">

      {/* ── LEFT: Following Sidebar ──────────────────────────────────────── */}
      <div className={`${showMobileChat ? "hidden" : "flex"} md:flex w-full md:w-80 lg:w-96 shrink-0 flex-col bg-white border-r border-gray-100`}>

        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-bold text-gray-800">Messages</h1>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400" : "bg-gray-300"}`} />
              <span className="text-xs text-gray-400">{isConnected ? "Live" : "Offline"}</span>
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        {/* Following List */}
        <div className="flex-1 overflow-y-auto">
          {loadingFollowing ? (
            <div className="space-y-0">
              {[1,2,3,4].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                  <div className="w-11 h-11 rounded-full bg-gray-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="w-28 h-3 bg-gray-200 rounded" />
                    <div className="w-40 h-2.5 bg-gray-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
              <MessageCircle size={36} className="text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-500">
                {followingList.length === 0 ? "Kisi ko follow karo pehle" : "Koi nahi mila"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {followingList.length === 0 ? "Jis ko follow karoge woh yahan dikhenge" : ""}
              </p>
              {followingList.length === 0 && (
                <button
                  onClick={() => navigate("/explore")}
                  className="mt-3 text-xs text-indigo-500 font-semibold hover:underline"
                >
                  Explore →  Search Users Here 
                </button>
              )}
            </div>
          ) : (
            filteredList.map((item) => {
              const isActive = activeConversation?._id === item.conversation?._id;
              const isOnline = onlineUsers.includes(item.user?._id);
              const lastMsg  = item.conversation?.lastMessage;
              const unread   = item.myUnread || 0;

              return (
                <button
                  key={item.user?._id}
                  onClick={() => handleSelectUser(item)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition text-left
                    ${isActive
                      ? "bg-indigo-50 border-r-2 border-indigo-500"
                      : "hover:bg-gray-50"
                    }`}
                >
                  <Avatar
                    src={item.user?.avatar}
                    name={item.user?.name}
                    size="w-11 h-11"
                    textSize="text-sm"
                    online={isOnline}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${unread > 0 ? "font-bold text-gray-900" : "font-semibold text-gray-700"}`}>
                        {item.user?.name}
                      </p>
                      {lastMsg && (
                        <span className="text-xs text-gray-400 shrink-0 ml-2">
                          {formatTime(lastMsg.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-xs truncate ${unread > 0 ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                        {lastMsg
                          ? lastMsg.isDeleted ? "Message deleted"
                            : lastMsg.image && !lastMsg.text ? "📷 Photo"
                            : lastMsg.text
                          : item.user?.designation?.trim() || "Tap to start chatting"
                        }
                      </p>
                      {unread > 0 && (
                        <span className="ml-2 min-w-4.5 h-4.5 bg-indigo-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-1 shrink-0">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── RIGHT: Chat Window ───────────────────────────────────────────── */}
      <div className={`${!showMobileChat ? "hidden" : "flex"} md:flex flex-1 flex-col min-w-0`}>

        {!activeConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <MessageCircle size={36} className="text-indigo-300" />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">Conversation select karo</p>
            <p className="text-sm text-gray-400">Left side se kisi ka naam click karo</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
              <button onClick={() => setShowMobileChat(false)} className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <ArrowLeft size={18} />
              </button>
              <Avatar src={otherUser?.avatar} name={otherUser?.name} size="w-10 h-10" online={isOtherOnline} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{otherUser?.name}</p>
                <p className="text-xs text-gray-400">
                  {isOtherTyping ? "typing..." : isOtherOnline ? "🟢 Online" : "Offline"}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-gray-50">
              {hasMoreMessages && (
                <div className="flex justify-center mb-2">
                  <button
                    onClick={() => dispatch(fetchMessages({
                      conversationId: activeConversation._id,
                      page: Math.ceil(messages.length / 30) + 1,
                    }))}
                    disabled={loadingMessages}
                    className="text-xs text-indigo-500 bg-indigo-50 px-4 py-1.5 rounded-full hover:bg-indigo-100 transition disabled:opacity-50"
                  >
                    {loadingMessages ? "Loading..." : "Load older messages"}
                  </button>
                </div>
              )}

              {loadingMessages && messages.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-400 text-sm">Loading...</div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-2xl mb-2">👋</p>
                  <p className="text-sm text-gray-400">Say hello to {otherUser?.name}!</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMine  = msg.sender?._id === user?._id || msg.sender === user?._id;
                  const prevMsg = messages[idx - 1];
                  const showDate = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);
                  const isRead  = msg.readBy?.some((id) =>
                    (typeof id === "string" ? id : id._id) !== user?._id
                  );

                  return (
                    <div key={msg._id}>
                      {showDate && (
                        <div className="flex items-center gap-2 my-3">
                          <div className="flex-1 h-px bg-gray-200" />
                          <span className="text-xs text-gray-400 px-2">{formatDate(msg.createdAt)}</span>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>
                      )}

                      <div className={`flex items-end gap-2 group ${isMine ? "justify-end" : "justify-start"}`}>
                        {!isMine && (
                          <Avatar src={msg.sender?.avatar} name={msg.sender?.name} size="w-7 h-7" textSize="text-xs" />
                        )}

                        <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[70%]`}>
                          {msg.replyTo && !msg.replyTo.isDeleted && (
                            <div className={`text-xs px-3 py-1.5 rounded-t-xl mb-0.5 max-w-full truncate
                              ${isMine ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-500"}`}>
                              <span className="font-semibold">{msg.replyTo.sender?.name}: </span>
                              {msg.replyTo.text || "📷 Photo"}
                            </div>
                          )}

                          <div className={`relative px-3 py-2 rounded-2xl text-sm leading-relaxed
                            ${isMine
                              ? "bg-indigo-600 text-white rounded-br-sm"
                              : "bg-white text-gray-800 border border-gray-100 rounded-bl-sm shadow-sm"
                            } ${msg.isDeleted ? "opacity-50 italic" : ""}`}
                          >
                            {msg.isDeleted ? (
                              <span className="text-xs">Message deleted</span>
                            ) : (
                              <>
                                {msg.image && (
                                  <img src={msg.image} alt="attachment"
                                    className="rounded-xl mb-1.5 max-w-50 cursor-pointer"
                                    onClick={() => window.open(msg.image, "_blank")} />
                                )}
                                {msg.text && <p className="wrap-break-words">{msg.text}</p>}
                              </>
                            )}

                            {!msg.isDeleted && (
                              <div className={`absolute top-0 ${isMine ? "-left-20" : "-right-20"} hidden group-hover:flex items-center gap-1`}>
                                <button onClick={() => setReplyTo(msg)}
                                  className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-indigo-500 shadow-sm">
                                  <Reply size={13} />
                                </button>
                                {isMine && (
  <button onClick={() => handleDelete(msg._id)}
    className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-red-500 shadow-sm">
    <Trash2 size={13} />
  </button>
)}
{isMine && (
  <button onClick={() => { setEditingMsg({ _id: msg._id, text: msg.text }); setText(msg.text); inputRef.current?.focus(); }}
    className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-yellow-500 shadow-sm">
    <Pencil size={13} />
  </button>
)}
                              </div>
                            )}
                          </div>
<div className={`flex items-center gap-1 mt-0.5 ${isMine ? "flex-row-reverse" : ""}`}>
  <span className="text-xs text-gray-400">{formatTime(msg.createdAt)}</span>
  {isMine && !msg.isDeleted && (
    isRead
      ? <CheckCheck size={12} className="text-indigo-400" />
      : <Check size={12} className="text-gray-400" />
  )}
</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {isOtherTyping && (
                <div className="flex items-end gap-2">
                  <Avatar src={otherUser?.avatar} name={otherUser?.name} size="w-7 h-7" textSize="text-xs" />
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
                    <div className="flex items-center gap-1">
                      {[0,1,2].map((i) => (
                        <span key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t border-gray-100 px-4 py-3 shrink-0 relative">
              {replyTo && (
                <div className="flex items-center justify-between bg-indigo-50 border-l-4 border-indigo-400 rounded-lg px-3 py-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-indigo-600">{replyTo.sender?.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {replyTo.image && !replyTo.text ? "📷 Photo" : replyTo.text}
                    </p>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600 ml-2 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              )}

              {imagePreview && (
                <div className="relative inline-block mb-2">
                  <img src={imagePreview} alt="preview" className="h-20 rounded-xl object-cover" />
                  <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                    <X size={10} />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                {showEmoji && (
  <div ref={emojiRef} className="absolute bottom-16 left-4 z-50">
    <EmojiPicker
      onEmojiClick={(emojiData) => {
        setText(prev => prev + emojiData.emoji);
        setShowEmoji(false);
        inputRef.current?.focus();
      }}
      height={350}
      width={300}
    />
  </div>
)}

<button
  onClick={() => setShowEmoji(prev => !prev)}
  className="p-2 rounded-xl text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition shrink-0"
>
  <Smile size={18} />
</button>
               <button
  onClick={handleVoiceInput}
  className={`p-2 rounded-xl transition shrink-0 ${
    isListening
      ? "text-red-500 bg-red-50 animate-pulse"
      : "text-gray-400 hover:text-indigo-500 hover:bg-indigo-50"
  }`}
>
  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
</button>

                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={handleTyping}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 resize-none px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 max-h-32 overflow-y-auto"
                  style={{ minHeight: "42px" }}
                />

                <button
                  onClick={handleSend}
                  disabled={!text.trim() && !imageFile}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition disabled:opacity-40 shrink-0"
                  style={{ background: (!text.trim() && !imageFile) ? "#c7d2fe" : "#4f46e5" }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}