import { useState, useRef, useEffect } from "react";
import api from "../lib/services/api";

const INITIAL_MESSAGE = {
  from: "bot",
  text: "Hello! I'm Erovians AI 👋 I can help you find marble suppliers, stone types, designers, and more. How can I assist you today?",
};

export default function ChatBot() {
  const [chatOpen, setChatOpen]     = useState(false);
  const [chatMsg, setChatMsg]       = useState("");
  const [chatHistory, setChatHistory] = useState([INITIAL_MESSAGE]);
  const [loading, setLoading]       = useState(false);
  const chatEndRef = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    if (chatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [chatHistory, chatOpen]);

  const sendMessage = async () => {
    const text = chatMsg.trim();
    if (!text || loading) return;

    const userMsg = { from: "user", text };
    setChatHistory((h) => [...h, userMsg]);
    setChatMsg("");
    setLoading(true);

    try {
      const { data } = await api.post("/chat/ai", {
        message: text,
        history: chatHistory,
      });

      setChatHistory((h) => [...h, { from: "bot", text: data.data.reply }]);
    } catch (err) {
      setChatHistory((h) => [
        ...h,
        {
          from: "bot",
          text: err?.response?.data?.message || "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 left-6 flex flex-col items-end gap-2 z-50">

      {/* ── Chat Window ── */}
      {chatOpen && (
        <div
          className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
          style={{ height: "420px" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-gray-100"
            style={{ background: "#1e3a5f" }}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-[#eef3f6] border border-white/30 shrink-0">
                <iframe
                  src="/Robot-V1.html?embed=1"
                  title="Robot"
                  className="w-full h-full border-0 pointer-events-none"
                  style={{ display: "block" }}
                />
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-tight">Erovians AI</p>
                <span className="flex items-center gap-1 text-[10px] text-green-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                  Online
                </span>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="text-white/70 hover:text-white text-lg leading-none transition"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#f8f9fb]">
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.from === "bot" && (
                  <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mr-2 mt-1 bg-[#eef3f6]">
                    <iframe
                      src="/Robot-V1.html?embed=1"
                      title="bot"
                      className="w-full h-full border-0 pointer-events-none"
                    />
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.from === "user"
                      ? "text-white rounded-br-sm"
                      : "bg-white text-gray-700 shadow-sm rounded-bl-sm border border-gray-100"
                  }`}
                  style={msg.from === "user" ? { background: "#1e3a5f" } : {}}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mr-2 mt-1 bg-[#eef3f6]">
                  <iframe
                    src="/Robot-V1.html?embed=1"
                    title="bot"
                    className="w-full h-full border-0 pointer-events-none"
                  />
                </div>
                <div className="bg-white text-gray-400 shadow-sm border border-gray-100 px-4 py-2 rounded-2xl rounded-bl-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-100 flex gap-2 bg-white">
            <input
              ref={inputRef}
              type="text"
              value={chatMsg}
              onChange={(e) => setChatMsg(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about marble, suppliers..."
              disabled={loading}
              className="flex-1 text-sm bg-gray-100 rounded-full px-4 py-2 outline-none text-gray-800 placeholder:text-gray-400 disabled:opacity-60"
            />
            <button
              onClick={sendMessage}
              disabled={!chatMsg.trim() || loading}
              className="w-9 h-9 flex items-center justify-center rounded-full text-white disabled:opacity-40 transition shrink-0"
              style={{ background: "#1e3a5f" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Bubble Button ── */}
      <div className="flex flex-col items-center gap-1">
        {!chatOpen && (
          <div
            className="px-3 py-1.5 text-xs font-semibold text-white rounded-full shadow animate-bounce"
            style={{ background: "#1e3a5f" }}
          >
            Ask me!
          </div>
        )}
        <button
          onClick={() => setChatOpen((o) => !o)}
          className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-xl hover:scale-105 transition-transform bg-[#eef3f6]"
        >
          <iframe
            src="/Robot-V1.html?embed=1"
            title="AI Bot"
            className="w-full h-full border-0 pointer-events-none"
            style={{ display: "block" }}
          />
        </button>
      </div>
    </div>
  );
}