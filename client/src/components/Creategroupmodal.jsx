

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import EmojiPicker from "emoji-picker-react";
import {
  createGroupConversation,
  setActiveConversation,
  selectCreatingGroup,
} from "../lib/redux/chatSlice";

const initials = (name = "") =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

const PALETTES = [
  ["#EEEDFE", "#3C3489"], ["#E1F5EE", "#085041"],
  ["#E6F1FB", "#0C447C"], ["#FBEAF0", "#72243E"], ["#FAECE7", "#712B13"],
];
const avatarStyle = (id = "") => {
  const [bg, color] = PALETTES[(id.charCodeAt(0) || 0) % PALETTES.length];
  return { background: bg, color };
};

function MiniAvatar({ name = "", userId = "", size = 36, src = null }) {
  const st = avatarStyle(userId);
  const validSrc = src && typeof src === "string" && src.startsWith("http") ? src : null;
  if (validSrc) return <img src={validSrc} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ ...st, width: size, height: size, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.34, fontWeight: 500, flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

export default function CreateGroupModal({ following = [], onClose }) {
  const dispatch = useDispatch();
  const creating = useSelector(selectCreatingGroup);

  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return following.filter((u) => (u.fullName || u.username || "").toLowerCase().includes(q));
  }, [following, search]);

  const selectedUsers = useMemo(
    () => following.filter((u) => selectedIds.includes(u.id?.toString())),
    [following, selectedIds]
  );

  const toggleSelect = (userId) => {
    setSelectedIds((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
  };

  const handleNext = () => {
    if (selectedIds.length < 1) { setError("Please select at least one member."); return; }
    setError(null); setStep(2);
  };



  const handleCreate = async () => {
  if (!groupName.trim()) { 
    setError("Group name is required."); 
    return; 
  }

  // ✅ FILTER OUT NULL/UNDEFINED VALUES
  const validIds = selectedIds.filter(id => id && id !== 'null' && id !== 'undefined');
  
  if (validIds.length < 1) {
    setError("Please select at least one member for the group."); 
    return; 
  }

  try {
    const action = await dispatch(
      createGroupConversation({
        groupName: groupName.trim(),
        participantIds: validIds,
        // avatarUrl: selectedImage || undefined,  // ← REMOVE THIS LINE
      })
    );

    if (action?.payload?.id) {
      dispatch(setActiveConversation(action.payload.id));
      onClose();
    }
  } catch (err) {
    setError("Failed to create group.");
  }
};

  return createPortal(
    <div
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
          width: "100%", maxWidth: 420, maxHeight: "85vh",
          border: "1px solid #e5e7eb",
          boxShadow: "0 24px 64px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.1)",
          display: "flex", flexDirection: "column",
          animation: "modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 20px 16px", borderBottom: "1px solid #f0f0f0",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {step === 2 && (
              <button onClick={() => { setStep(1); setError(null); }} style={{
                background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 10,
                cursor: "pointer", color: "#666", padding: 7, display: "flex",
              }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
            )}
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "rgba(83,74,183,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="18" height="18" fill="none" stroke="#534AB7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#111", lineHeight: 1.3 }}>
                {step === 1 ? "New Group" : "Group Details"}
              </p>
              <p style={{ fontSize: 12, color: "#888", margin: "3px 0 0", lineHeight: 1.4 }}>
                {step === 1 ? "Select members to add" : "Give your group a name"}
              </p>
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

        {/* Error */}
        {error && (
          <div style={{ margin: "10px 16px 0", padding: "8px 12px", fontSize: 12, background: "#FFF0EC", color: "#D85A30", borderRadius: 10 }}>
            {error}
          </div>
        )}

        {/* ── STEP 1: Select Members ── */}
        {step === 1 && (
          <>
            {selectedUsers.length > 0 && (
              <div style={{
                display: "flex", gap: 10, padding: "12px 16px", overflowX: "auto",
                borderBottom: "1px solid #f0f0f0", flexShrink: 0,
              }}>
                {selectedUsers.map((u) => {
                  const uid = u.id?.toString();
                  return (
                    <div key={uid} style={{ position: "relative", flexShrink: 0, textAlign: "center" }}>
                      <MiniAvatar name={u.fullName || u.username} userId={uid} src={u.avatar?.url} size={44} />
                      <button onClick={() => toggleSelect(uid)} style={{
                        position: "absolute", top: -4, right: -4,
                        width: 18, height: 18, borderRadius: "50%",
                        background: "#D85A30", color: "#fff", border: "2px solid #fff",
                        fontSize: 10, lineHeight: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}>✕</button>
                      <p style={{ fontSize: 10, margin: "4px 0 0", maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#888" }}>
                        {u.fullName || u.username}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ padding: "12px 16px 8px", flexShrink: 0 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search people..."
                style={{
                  width: "100%", boxSizing: "border-box", padding: "10px 14px",
                  borderRadius: 12, border: "1px solid #e5e7eb",
                  background: "#f9fafb", fontSize: 13, outline: "none", color: "#111",
                }}
                onFocus={(e) => e.target.style.border = "1px solid #534AB7"}
                onBlur={(e) => e.target.style.border = "1px solid #e5e7eb"}
              />
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "4px 12px" }}>
              {filtered.length === 0 && (
                <p style={{ textAlign: "center", fontSize: 13, color: "#aaa", padding: 24 }}>No users found</p>
              )}
              {filtered.map((u) => {
                const uid = u.id?.toString();
                const isSelected = selectedIds.includes(uid);
                return (
                  <button key={uid} onClick={() => toggleSelect(uid)} style={{
                    display: "flex", alignItems: "center", gap: 12, width: "100%",
                    padding: "10px 12px", border: `1px solid ${isSelected ? "rgba(83,74,183,0.3)" : "transparent"}`,
                    background: isSelected ? "rgba(83,74,183,0.05)" : "transparent",
                    cursor: "pointer", borderRadius: 12, textAlign: "left",
                    marginBottom: 4, transition: "all 0.15s",
                  }}>
                    <MiniAvatar name={u.fullName || u.username} userId={uid} src={u.avatar?.url} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, margin: 0, color: isSelected ? "#3C3489" : "#111" }}>
                        {u.fullName || u.username}
                      </p>
                      {u.username && <p style={{ fontSize: 11, margin: "2px 0 0", color: "#aaa" }}>@{u.username}</p>}
                    </div>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                      border: isSelected ? "none" : "2px solid #e5e7eb",
                      background: isSelected ? "#534AB7" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s",
                    }}>
                      {isSelected && (
                        <svg width="12" height="12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ padding: "12px 16px 18px", borderTop: "1px solid #f0f0f0", flexShrink: 0 }}>
              <button onClick={handleNext} disabled={selectedIds.length < 1} style={{
                width: "100%", padding: "12px 0", borderRadius: 12, border: "none",
                background: selectedIds.length < 1 ? "#f3f4f6" : "#534AB7",
                color: selectedIds.length < 1 ? "#aaa" : "#fff",
                fontSize: 14, fontWeight: 600,
                cursor: selectedIds.length < 1 ? "default" : "pointer",
              }}>
                Next ({selectedIds.length} selected)
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: Group Name ── */}
        {step === 2 && (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
              {/* Group name input */}
              <p style={{ fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 8, marginTop: 0 }}>GROUP NAME</p>
              <div style={{ position: "relative", marginBottom: 4 }}>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Weekend Trip Squad"
                  maxLength={50}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "12px 44px 12px 14px",
                    borderRadius: 12, border: "1px solid #e5e7eb",
                    background: "#f9fafb", fontSize: 14, outline: "none", color: "#111",
                    transition: "border 0.15s",
                  }}
                  onFocus={(e) => e.target.style.border = "1px solid #534AB7"}
                  onBlur={(e) => e.target.style.border = "1px solid #e5e7eb"}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setEmojiOpen((p) => !p); }}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1,
                  }}
                >😊</button>
              </div>
              <p style={{ fontSize: 11, color: "#aaa", textAlign: "right", margin: "4px 4px 12px" }}>{groupName.length}/50</p>

              {emojiOpen && (
                <div onClick={(e) => e.stopPropagation()} style={{ marginBottom: 12 }}>
                  <EmojiPicker
                    onEmojiClick={(ed) => setGroupName((p) => p + ed.emoji)}
                    width="100%" height={260}
                    previewConfig={{ showPreview: false }} skinTonesDisabled
                  />
                </div>
              )}

              {/* Members preview */}
              <p style={{ fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 10 }}>
                MEMBERS ({selectedUsers.length + 1})
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {selectedUsers.map((u) => (
                  <div key={u.id} style={{ textAlign: "center" }}>
                    <MiniAvatar name={u.fullName || u.username} userId={u.id?.toString()} src={u.avatar?.url} size={44} />
                    <p style={{ fontSize: 10, margin: "4px 0 0", maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#888" }}>
                      {u.fullName || u.username}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: "12px 16px 18px", borderTop: "1px solid #f0f0f0", display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={() => { setStep(1); setError(null); }} style={{
                flex: 1, padding: "12px 0", borderRadius: 12,
                border: "1px solid #e5e7eb", background: "transparent",
                fontSize: 13, fontWeight: 500, cursor: "pointer", color: "#666",
              }}>Back</button>
              <button onClick={handleCreate} disabled={creating || !groupName.trim()} style={{
                flex: 1, padding: "12px 0", borderRadius: 12, border: "none",
                background: !groupName.trim() || creating ? "#f3f4f6" : "#534AB7",
                color: !groupName.trim() || creating ? "#aaa" : "#fff",
                fontSize: 13, fontWeight: 600,
                cursor: creating || !groupName.trim() ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                {creating ? (
                  <>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24" style={{ animation: "spin 0.8s linear infinite" }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Creating…
                  </>
                ) : "Create Group"}
              </button>
            </div>
          </>
        )}
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