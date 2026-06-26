import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import chatApi from "../lib/services/chatApi";

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

export default function AddMemberModal({ following = [], existingMemberIds = [], conversationId, onClose, onAdded }) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  // Jo already group mein hain unko list se hata do
  const eligible = useMemo(
    () => following.filter((u) => !existingMemberIds.includes(u.id?.toString())),
    [following, existingMemberIds]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return eligible.filter((u) => (u.fullName || u.username || "").toLowerCase().includes(q));
  }, [eligible, search]);

  const toggleSelect = (userId) => {
    setSelectedIds((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
  };

  const handleAdd = async () => {
    if (selectedIds.length < 1) { setError("Please select at least one member."); return; }
    setAdding(true); setError(null);
    try {
      // Ek ek karke add karo (backend ek user id leta hai)
      for (const uid of selectedIds) {
        await chatApi.addGroupMember(conversationId, uid);
      }
      onAdded?.();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add member(s).");
    } finally {
      setAdding(false);
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
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#ffffff", borderRadius: 20,
          width: "100%", maxWidth: 420, maxHeight: "85vh",
          border: "1px solid #e5e7eb",
          boxShadow: "0 24px 64px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.1)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 20px 16px", borderBottom: "1px solid #f0f0f0",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#111" }}>Add Members</p>
            <p style={{ fontSize: 12, color: "#888", margin: "3px 0 0" }}>Select people to add to the group</p>
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

        {error && (
          <div style={{ margin: "10px 16px 0", padding: "8px 12px", fontSize: 12, background: "#FFF0EC", color: "#D85A30", borderRadius: 10 }}>
            {error}
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
          />
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "4px 12px" }}>
          {filtered.length === 0 && (
            <p style={{ textAlign: "center", fontSize: 13, color: "#aaa", padding: 24 }}>
              {eligible.length === 0 ? "Everyone you follow is already in this group" : "No users found"}
            </p>
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
          <button onClick={handleAdd} disabled={adding || selectedIds.length < 1} style={{
            width: "100%", padding: "12px 0", borderRadius: 12, border: "none",
            background: selectedIds.length < 1 || adding ? "#f3f4f6" : "#534AB7",
            color: selectedIds.length < 1 || adding ? "#aaa" : "#fff",
            fontSize: 14, fontWeight: 600,
            cursor: selectedIds.length < 1 || adding ? "default" : "pointer",
          }}>
            {adding ? "Adding…" : `Add (${selectedIds.length} selected)`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}