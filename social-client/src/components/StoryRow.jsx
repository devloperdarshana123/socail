import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../context/AuthContext";
import { fetchStories, uploadStory, markStoryViewed, deleteStory } from "../store/slices/storySlice";
import { Plus, X, Trash2, ChevronLeft, ChevronRight, Image, Type } from "lucide-react";
import toast from "react-hot-toast";

const Avatar = ({ src, name, size = 48 }) =>
  src ? (
    <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg,#c8956c,#a07050)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: size * 0.38,
    }}>
      {name?.charAt(0).toUpperCase()}
    </div>
  );

// ── Story Viewer Modal ────────────────────────────────────────────────────────
function StoryViewer({ group, onClose, onDelete, currentUserId }) {
  const dispatch = useDispatch();
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);
  const story = group.stories[idx];

  const next = () => {
    if (idx < group.stories.length - 1) setIdx(idx + 1);
    else onClose();
  };
  const prev = () => { if (idx > 0) setIdx(idx - 1); };

  useEffect(() => {
    if (story) dispatch(markStoryViewed(story._id));
    timerRef.current = setTimeout(next, 5000);
    return () => clearTimeout(timerRef.current);
  }, [idx, story?._id]);

  if (!story) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{ position: "relative", width: 380, maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>

        {/* Progress bars */}
        <div style={{ display: "flex", gap: 4, position: "absolute", top: 12, left: 12, right: 12, zIndex: 10 }}>
          {group.stories.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.3)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                background: "#fff",
                width: i < idx ? "100%" : i === idx ? "100%" : "0%",
                transition: i === idx ? "width 5s linear" : "none",
              }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div style={{ position: "absolute", top: 24, left: 12, right: 12, zIndex: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar src={group.user.avatar} name={group.user.name} size={36} />
          <div>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 13, margin: 0 }}>{group.user.name}</p>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, margin: 0 }}>
              {new Date(story.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {story.user?._id === currentUserId || story.user === currentUserId ? (
              <button onClick={() => { onDelete(story._id); if (group.stories.length === 1) onClose(); else next(); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
                <Trash2 size={16} />
              </button>
            ) : null}
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Story Content */}
        <div style={{ borderRadius: 16, overflow: "hidden", background: "#111", minHeight: 560, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {story.mediaType === "image" && (
            <img src={story.mediaUrl} alt="story" style={{ width: "100%", maxHeight: 620, objectFit: "cover" }} />
          )}
          {story.mediaType === "video" && (
            <video src={story.mediaUrl} autoPlay muted playsInline style={{ width: "100%", maxHeight: 620 }} />
          )}
          {story.mediaType === "text" && (
            <div style={{
              width: "100%", minHeight: 560, background: story.textBg || "#6366f1",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 32,
            }}>
              <p style={{ color: "#fff", fontSize: 22, fontWeight: 700, textAlign: "center", lineHeight: 1.5 }}>
                {story.textContent}
              </p>
            </div>
          )}
        </div>

        {/* Nav buttons */}
        {idx > 0 && (
          <button onClick={prev} style={{
            position: "absolute", left: -44, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
            width: 36, height: 36, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          }}><ChevronLeft size={20} /></button>
        )}
        {idx < group.stories.length - 1 && (
          <button onClick={next} style={{
            position: "absolute", right: -44, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
            width: 36, height: 36, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          }}><ChevronRight size={20} /></button>
        )}
      </div>
    </div>
  );
}

// ── Upload Modal ──────────────────────────────────────────────────────────────
function UploadModal({ onClose }) {
  const dispatch = useDispatch();
  const { uploading } = useSelector((s) => s.story);
  const [tab, setTab] = useState("image"); // image | text
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [text, setText] = useState("");
  const [bg, setBg] = useState("#6366f1");

  const COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#1e3a5f","#c8956c","#111827"];

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setTab(f.type.startsWith("video") ? "video" : "image");
  };

  const handleSubmit = async () => {
    const fd = new FormData();
    if (tab === "text") {
      if (!text.trim()) { toast.error("Text likho!"); return; }
      fd.append("mediaType", "text");
      fd.append("textContent", text);
      fd.append("textBg", bg);
    } else {
      if (!file) { toast.error("File choose karo!"); return; }
      fd.append("mediaType", file.type.startsWith("video") ? "video" : "image");
      fd.append("media", file);
    }
    const res = await dispatch(uploadStory(fd));
    if (uploadStory.fulfilled.match(res)) { toast.success("Story posted! 🎉"); onClose(); }
    else toast.error(res.payload || "Upload failed!");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 20, width: 400, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #e8e0d8" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1a1614" }}>Add Story</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e8e0d8" }}>
          {[["image", <Image size={14} />, "Photo/Video"], ["text", <Type size={14} />, "Text"]].map(([t, icon, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "12px", border: "none", cursor: "pointer",
              background: tab === t ? "#f5f2f0" : "#fff",
              borderBottom: tab === t ? "2px solid #c8956c" : "2px solid transparent",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              fontSize: 13, fontWeight: 600, color: tab === t ? "#c8956c" : "#6b6560",
            }}>
              {icon}{label}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          {tab !== "text" ? (
            <div>
              <label style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                border: "2px dashed #e8e0d8", borderRadius: 12, padding: 32, cursor: "pointer",
                background: "#f5f2f0", gap: 8,
              }}>
                {preview ? (
                  file?.type.startsWith("video")
                    ? <video src={preview} style={{ width: "100%", borderRadius: 8, maxHeight: 180 }} controls />
                    : <img src={preview} alt="preview" style={{ width: "100%", borderRadius: 8, maxHeight: 180, objectFit: "cover" }} />
                ) : (
                  <>
                    <Image size={32} color="#c8956c" />
                    <p style={{ margin: 0, fontSize: 13, color: "#6b6560" }}>Click to choose photo or video</p>
                  </>
                )}
                <input type="file" accept="image/*,video/*" onChange={handleFile} style={{ display: "none" }} />
              </label>
            </div>
          ) : (
            <div>
              <div style={{ borderRadius: 12, overflow: "hidden", background: bg, padding: 24, minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <textarea value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="Write Something..."
                  style={{ background: "none", border: "none", outline: "none", color: "#fff", fontSize: 18, fontWeight: 700, textAlign: "center", resize: "none", width: "100%", fontFamily: "inherit" }}
                  rows={4}
                />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setBg(c)} style={{
                    width: 28, height: 28, borderRadius: "50%", background: c, border: bg === c ? "3px solid #1a1614" : "2px solid transparent", cursor: "pointer",
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "0 20px 20px", display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 999, border: "1px solid #e8e0d8", background: "#fff", cursor: "pointer", fontSize: 13, color: "#6b6560" }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={uploading} style={{
            flex: 1, padding: "10px", borderRadius: 999, border: "none",
            background: "#c8956c", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: uploading ? 0.7 : 1,
          }}>
            {uploading ? "Posting..." : "Post Story 🚀"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Story Row ────────────────────────────────────────────────────────────
export default function StoryRow() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { groups, loading } = useSelector((s) => s.story);
  const [showUpload, setShowUpload] = useState(false);
  const [viewingGroup, setViewingGroup] = useState(null);

  useEffect(() => { dispatch(fetchStories()); }, [dispatch]);

  const handleDelete = async (storyId) => {
    await dispatch(deleteStory(storyId));
    toast.success("Story deleted!");
  };

  return (
    <>
      <div className="bg-white border border-stone-200 rounded-2xl px-5 py-3.5 flex gap-4 overflow-x-auto mb-4"
        style={{ scrollbarWidth: "none" }}>

        {/* Add Story Button */}
        <div onClick={() => setShowUpload(true)} className="flex flex-col items-center gap-1.5 cursor-pointer shrink-0">
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-stone-300 flex items-center justify-center bg-stone-50 text-amber-500 hover:border-amber-400 hover:bg-amber-50 transition">
            <Plus size={20} />
          </div>
          <span className="text-xs text-stone-400">Add</span>
        </div>

        {/* Story Groups */}
        {loading && (groups ?? []).length === 0 ? (
          <div className="flex items-center text-xs text-stone-300 px-2">Loading...</div>
        ) : (
          (groups ?? []).map((group)  => {
            const isMe = group.user._id === user?._id;
            return (
              <div key={group.user._id} onClick={() => setViewingGroup(group)}
                className="flex flex-col items-center gap-1.5 cursor-pointer shrink-0">
                <div style={{
                  padding: 2, borderRadius: "50%",
                  background: group.hasUnread
                    ? "linear-gradient(135deg,#c8956c,#a07050)"
                    : "linear-gradient(135deg,#d1d5db,#9ca3af)",
                }}>
                  <div style={{ padding: 2, borderRadius: "50%", background: "#fff" }}>
                    <Avatar src={group.user.avatar} name={group.user.name} size={48} />
                  </div>
                </div>
                <span className="text-xs text-stone-400 max-w-14.5 truncate">
                  {isMe ? "You" : group.user.name?.split(" ")[0]}
                </span>
              </div>
            );
          })
        )}
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}

      {viewingGroup && (
        <StoryViewer
          group={viewingGroup}
          onClose={() => setViewingGroup(null)}
          onDelete={handleDelete}
          currentUserId={user?._id}
        />
      )}
    </>
  );
}