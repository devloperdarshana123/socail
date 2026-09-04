

import { useState } from "react";
import { createPortal } from "react-dom";
import EmojiPicker from "emoji-picker-react";

export default function RenameGroupModal({ currentName, onClose, onSave }) {
  const [name, setName] = useState(currentName || "");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    if (name.trim() === currentName) { onClose(); return; }
    setSaving(true);
    try { await onSave(name.trim()); }
    finally { setSaving(false); }
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 999999,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, boxSizing: "border-box",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#ffffff", borderRadius: 20,
          width: "100%", maxWidth: 400,
          border: "1px solid #e5e7eb",
          boxShadow: "0 24px 64px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.1)",
          display: "flex", flexDirection: "column",
          animation: "modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid #f0f0f0",
          display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "rgba(83,74,183,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="18" height="18" fill="none" stroke="#534AB7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#111", lineHeight: 1.3 }}>Rename Group</p>
              <p style={{ fontSize: 12, color: "#888", margin: "3px 0 0", lineHeight: 1.4 }}>Choose a new name for this group</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "#f3f4f6", border: "1px solid #e5e7eb",
            cursor: "pointer", color: "#888", padding: 7,
            borderRadius: 10, display: "flex", flexShrink: 0,
          }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Input area */}
        <div style={{ padding: "16px 16px 8px" }}>
          <div style={{ position: "relative" }}>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              maxLength={50}
              placeholder="Group naam likhiye..."
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "12px 44px 12px 14px",
                borderRadius: 12, fontSize: 14,
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
                color: "#111", outline: "none",
                transition: "border 0.15s",
              }}
              onFocus={(e) => e.target.style.border = "1px solid #534AB7"}
              onBlur={(e) => e.target.style.border = "1px solid #e5e7eb"}
            />
            <button
              onClick={(e) => { e.stopPropagation(); setEmojiOpen((p) => !p); }}
              style={{
                position: "absolute", right: 10, top: "50%",
                transform: "translateY(-50%)",
                background: "none", border: "none",
                cursor: "pointer", fontSize: 20, lineHeight: 1,
              }}
            >😊</button>
          </div>
          <p style={{ fontSize: 11, color: "#aaa", margin: "6px 4px 0", textAlign: "right" }}>{name.length}/50</p>

          {emojiOpen && (
            <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8 }}>
              <EmojiPicker
                onEmojiClick={(ed) => { setName((p) => p + ed.emoji); }}
                width="100%" height={280}
                previewConfig={{ showPreview: false }} skinTonesDisabled
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 16px 18px",
          display: "flex", gap: 8,
          borderTop: "1px solid #f0f0f0",
        }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "11px 0", borderRadius: 12,
            border: "1px solid #e5e7eb", background: "transparent",
            fontSize: 13, fontWeight: 500, cursor: "pointer", color: "#666",
          }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            style={{
              flex: 1, padding: "11px 0", borderRadius: 12,
              border: "none",
              background: name.trim() && !saving ? "#534AB7" : "#f3f4f6",
              color: name.trim() && !saving ? "#fff" : "#aaa",
              fontSize: 13, fontWeight: 600,
              cursor: name.trim() && !saving ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {saving ? (
              <>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24" style={{ animation: "spin 0.8s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Saving…
              </>
            ) : "Save"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.93) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>,
    document.body
  );
}