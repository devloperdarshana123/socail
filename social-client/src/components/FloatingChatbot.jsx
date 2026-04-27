
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { Send, X, Mic, MicOff, RotateCcw, Trash2 } from "lucide-react";
import robotImg from "../assets/robot.png";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9001";
const STORAGE_KEY = "erobot_messages";
const MAX_RETRIES = 3;
const RATE_LIMIT_MS = 1000; // 1 second between messages

const INITIAL_MESSAGE = {
  role: "assistant",
  content: "Hi! I'm EroBot 🤖 Ask me anything about marble, stone, tiles, or Erovians!",
  id: Date.now(),
};

export default function FloatingChatbot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [INITIAL_MESSAGE];
    } catch {
      return [INITIAL_MESSAGE];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [error, setError] = useState(null);
  const [retryMsg, setRetryMsg] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastSentRef = useRef(0);
  const inputRef = useRef(null);

  // ── Persist messages ──────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // ── Unread count when closed ──────────────────────────────
  useEffect(() => {
    if (!open) {
      const assistantMsgs = messages.filter((m) => m.role === "assistant");
      setUnreadCount(assistantMsgs.length > 1 ? 1 : 0);
    } else {
      setUnreadCount(0);
    }
  }, [open, messages]);

  // ── Scroll to bottom ──────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // ── Focus input on open ───────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // ── Voice setup ───────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    setVoiceSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join("");
      setInput(transcript);
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = (e) => {
      console.warn("Voice error:", e.error);
      setListening(false);
    };

    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, []);

  // ── Toggle voice ──────────────────────────────────────────
  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setInput("");
      setError(null);
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch {}
    }
  };

  // ── Send message with retry ───────────────────────────────
  const sendMessage = useCallback(
    async (overrideText = null, retryCount = 0) => {
      const text = overrideText || input.trim();
      if (!text || loading) return;

      // Rate limiting
      const now = Date.now();
      if (now - lastSentRef.current < RATE_LIMIT_MS) return;
      lastSentRef.current = now;

      if (listening) {
        recognitionRef.current?.stop();
        setListening(false);
      }

      setError(null);
      setRetryMsg(null);

  const userMsg = { role: "user", content: text, id: Date.now() };
      const newMessages = overrideText
        ? messages
        : [...messages, userMsg];

      setInput("");
      if (!overrideText) {
        setMessages(newMessages);
      }

      setLoading(true);

      try {
        const token = localStorage.getItem("erosocial_token");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(`${BASE_URL}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: text,
            history: newMessages
              .slice(1, overrideText ? undefined : -1)
              .map((m) => ({ role: m.role, content: m.content })),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) throw new Error(`Server error: ${res.status}`);

        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply, id: Date.now() },
        ]);
      } catch (err) {
        if (retryCount < MAX_RETRIES && err.name !== "AbortError") {
          // Auto retry with exponential backoff
          setTimeout(
            () => sendMessage(text, retryCount + 1),
            1000 * Math.pow(2, retryCount)
          );
          setError(`Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
        } else {
          setError(
            err.name === "AbortError"
              ? "Request timed out. Please try again."
              : "Something went wrong. Please try again."
          );
          setRetryMsg(text);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "⚠️ I couldn't respond. Please try again.",
              id: Date.now(),
              isError: true,
            },
          ]);
        }
      } finally {
        setLoading(false);
      }
    },
    [input, loading, listening, messages]
  );

  // ── Clear chat ────────────────────────────────────────────
  const clearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    setError(null);
    setRetryMsg(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <>
      {/* ── Floating Robot Button ── */}
      {!open && (
        <div
          onClick={() => setOpen(true)}
          role="button"
          aria-label="Open EroBot chat"
          style={{
            position: "fixed", bottom: 28, left: 28, zIndex: 1000,
            cursor: "pointer",
            filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.25))",
            animation: "floatBot 3s ease-in-out infinite",
          }}
        >
          <img
            src={robotImg}
            alt="EroBot"
            style={{ width: 100, height: 100, objectFit: "contain" }}
          />
          {/* Ask me badge */}
          <div style={{
            position: "absolute", top: -8, right: -8,
            background: "#c8956c", color: "#fff", fontSize: 10, fontWeight: 700,
            padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(200,149,108,0.4)",
          }}>
            Ask me!
          </div>
          {/* Unread dot */}
          {unreadCount > 0 && (
            <div style={{
              position: "absolute", top: 0, left: 0,
              width: 12, height: 12, borderRadius: "50%",
              background: "#ef4444", border: "2px solid #fff",
            }} />
          )}
        </div>
      )}

      {/* ── Chat Popup ── */}
      {open && (
        <div
          role="dialog"
          aria-label="EroBot chat"
          style={{
            position: "fixed", bottom: 28, left: 28, zIndex: 1000,
            width: 340, height: 500, background: "#fff",
            borderRadius: 20, boxShadow: "0 8px 48px rgba(0,0,0,0.2)",
            display: "flex", flexDirection: "column", overflow: "hidden",
            border: "1px solid #e8e0d8", animation: "popIn 0.2s ease",
          }}
        >
          {/* Header */}
          <div style={{
            background: "#1e3a5f", padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <img src={robotImg} alt="EroBot" style={{ width: 36, height: 36, objectFit: "contain" }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>EroBot</p>
              <p style={{ fontSize: 11, color: "#c8956c", margin: 0 }}>
                {loading ? "Typing..." : "Erovians AI Assistant"}
              </p>
            </div>
            <button
              onClick={clearChat}
              title="Clear chat"
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", padding: 4 }}
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "12px",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 6 }}
              >
                {msg.role === "assistant" && (
                  <img src={robotImg} alt="bot"
                    style={{ width: 24, height: 24, objectFit: "contain", flexShrink: 0, marginTop: 2 }} />
                )}
                <div style={{
                  maxWidth: "78%", padding: "8px 12px", fontSize: 12, lineHeight: 1.6,
                  borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: msg.isError
                    ? "#fff5f5"
                    : msg.role === "user" ? "#c8956c" : "#f5f2f0",
                  color: msg.isError ? "#ef4444" : msg.role === "user" ? "#fff" : "#1a1614",
                  border: msg.isError ? "1px solid #fecaca" : "none",
                }}>
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                    background: "linear-gradient(135deg, #c8956c, #a07050)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 10, fontWeight: 700,
                  }}>
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ))}

            {/* Loading dots */}
            {loading && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <img src={robotImg} alt="bot" style={{ width: 24, height: 24, objectFit: "contain" }} />
                <div style={{ padding: "8px 12px", borderRadius: "14px 14px 14px 4px", background: "#f5f2f0", display: "flex", gap: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: "50%", background: "#c8956c",
                      animation: `bounce 1s ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            {/* Error + Retry */}
            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                background: "#fff5f5", borderRadius: 10, border: "1px solid #fecaca" }}>
                <p style={{ fontSize: 11, color: "#ef4444", margin: 0, flex: 1 }}>{error}</p>
                {retryMsg && (
                  <button
                    onClick={() => sendMessage(retryMsg)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#c8956c", padding: 2 }}
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "10px 12px", borderTop: "1px solid #e8e0d8",
            display: "flex", gap: 6, alignItems: "center",
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder={listening ? "🎤 Listening..." : "Ask anything..."}
              disabled={loading}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 999, fontSize: 12,
                border: `1.5px solid ${listening ? "#c8956c" : "#e8e0d8"}`,
                outline: "none", fontFamily: "inherit", background: "#f5f2f0",
                transition: "border 0.2s", opacity: loading ? 0.7 : 1,
              }}
            />

            {/* Mic Button */}
            {voiceSupported && (
              <button
                onClick={toggleVoice}
                title={listening ? "Stop listening" : "Speak"}
                style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: listening ? "#ef4444" : "#e8e0d8",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s",
                  animation: listening ? "pulse 1.5s infinite" : "none",
                }}
              >
                {listening
                  ? <MicOff size={14} color="#fff" />
                  : <Mic size={14} color="#6b6560" />
                }
              </button>
            )}

            {/* Send Button */}
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              title="Send"
              style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: input.trim() && !loading ? "#c8956c" : "#e8e0d8",
                border: "none",
                cursor: input.trim() && !loading ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.2s",
              }}
            >
              <Send size={14} color="#fff" />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes floatBot { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes popIn { from{opacity:0;transform:scale(0.85) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 70%{box-shadow:0 0 0 8px rgba(239,68,68,0)} }
      `}</style>
    </>
  );
}