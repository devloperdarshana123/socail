

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, Image as ImageIcon, Clapperboard, Type,
  Smile, MapPin, Music, Tag, ChevronLeft, ChevronRight,
  Globe, Users, Lock, Settings2
} from "lucide-react";
import EmojiPickerReact from "emoji-picker-react";

const MAX_IMAGES = 10;
const MAX_CAPTION = 2200;

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Everyone", icon: Globe, color: "#22c55e" },
  { value: "followers", label: "Followers only", icon: Users, color: "#3b82f6" },
  { value: "only_me", label: "Only me", icon: Lock, color: "#f59e0b" },
];

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ user, size = 40 }) {
  const initials = user?.fullName
    ? user.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "U";
  const avatarUrl = user?.avatar?.url || user?.avatarUrl || null;
  return (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center font-bold border-2 border-gray-100"
      style={{
        width: size,
        height: size,
        background: avatarUrl ? `url(${avatarUrl}) center/cover` : "#f0e8df",
        fontSize: size * 0.35,
        color: "#6b3f2a",
      }}
    >
      {!avatarUrl && initials}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative flex-shrink-0 border-none cursor-pointer transition-colors duration-300 rounded-xl"
      style={{
        width: 44,
        height: 24,
        background: checked ? "#1e3a5f" : "#e2e8f0",
      }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300"
        style={{ left: checked ? 22 : 2 }}
      />
    </button>
  );
}

// ─── EmojiBtn ─────────────────────────────────────────────────────────────────
// Uses React Portal → renders directly into document.body
// This COMPLETELY escapes any parent overflow:hidden / clip / z-index stack
// Search is built-in to emoji-picker-react
const PICKER_W = 320;
const PICKER_H = 435;

function EmojiBtn({ onSelect, isDark }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  // Compute where to place the picker relative to the button
  const calcCoords = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceAbove = rect.top;
    const spaceBelow = vh - rect.bottom;

    let top;
    if (spaceBelow >= PICKER_H + 12) {
      // Enough space below — open downward
      top = rect.bottom + 8;
    } else if (spaceAbove >= PICKER_H + 12) {
      // Enough space above — open upward
      top = rect.top - PICKER_H - 8;
    } else {
      // Not enough space either side — center vertically in viewport, clamped
      top = Math.max(8, (vh - PICKER_H) / 2);
    }

    // Final clamp: never go off top or bottom of viewport
    top = Math.max(8, Math.min(top, vh - PICKER_H - 8));

    // Horizontal: align to button left, clamp inside viewport
    let left = rect.left;
    if (left + PICKER_W > vw - 8) left = vw - PICKER_W - 8;
    if (left < 8) left = 8;

    setCoords({ top, left });
  };

  const handleToggle = () => {
    if (!open) calcCoords();
    setOpen(v => !v);
  };

  // Close on outside click — check both button and portal picker
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      // portal div has id="emoji-portal-picker"
      const portal = document.getElementById("emoji-portal-picker");
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        portal && !portal.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // Recalc on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const h = () => calcCoords();
    window.addEventListener("scroll", h, true);
    window.addEventListener("resize", h);
    return () => {
      window.removeEventListener("scroll", h, true);
      window.removeEventListener("resize", h);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        onClick={handleToggle}
        className="w-9 h-9 rounded-lg flex items-center justify-center border-none cursor-pointer transition-all duration-200"
        style={{
          background: open ? (isDark ? "rgba(255,255,255,0.1)" : "#eff6ff") : "transparent",
          color: open ? "#1e3a5f" : "#94a3b8",
        }}
      >
        <Smile size={20} />
      </button>

      {/* Portal: renders into document.body — ZERO overflow clipping */}
      {open && createPortal(
        <div
          id="emoji-portal-picker"
          style={{
            position: "fixed",
            top: coords.top,
            left: coords.left,
            zIndex: 999999,
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
          }}
        >
          <EmojiPickerReact
            onEmojiClick={(d) => { onSelect(d.emoji); setOpen(false); }}
            width={PICKER_W}
            height={PICKER_H}
            theme={isDark ? "dark" : "light"}
            searchDisabled={false}
            skinTonesDisabled={false}
            lazyLoadEmojis
          />
        </div>,
        document.body
      )}
    </>
  );
}

// ─── MediaGrid ────────────────────────────────────────────────────────────────
function MediaGrid({ files, onRemove, onMove }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {files.map((m, idx) => (
        <div key={idx} className="relative rounded-xl overflow-hidden w-[72px] h-[72px] flex-shrink-0">
          {m.type === "video"
            ? <video src={m.previewUrl} className="w-full h-full object-cover" muted />
            : <img src={m.previewUrl} alt="" className="w-full h-full object-cover" />
          }
          {/* Remove */}
          <button
            onClick={() => onRemove(idx)}
            className="absolute top-0.5 right-0.5 bg-black/60 border-none rounded-full w-[18px] h-[18px] flex items-center justify-center cursor-pointer"
          >
            <X size={10} color="#fff" />
          </button>
          {/* Order badge */}
          <div className="absolute bottom-0.5 left-0.5 bg-black/50 rounded text-white text-[10px] font-bold px-1">
            {idx + 1}
          </div>
          {/* Move left */}
          {idx > 0 && (
            <button
              onClick={() => onMove(idx, idx - 1)}
              className="absolute bottom-0.5 right-0.5 bg-black/50 border-none rounded w-4 h-4 flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft size={10} color="#fff" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PostCreatorModal({ isOpen, onClose, currentUser, onSubmit }) {
  const [tab, setTab] = useState("image");
  const [caption, setCaption] = useState("");
  const [mediaFiles, setMedia] = useState([]);
  const [visibility, setVis] = useState("public");
  const [showVis, setShowVis] = useState(false);
  const [location, setLocation] = useState("");
  const [commentsOff, setCommentsOff] = useState(false);
  const [likesHide, setLikesHide] = useState(false);
  const [showAdv, setShowAdv] = useState(false);
  const [submitting, setSub] = useState(false);
  const [error, setError] = useState("");
  const [isDark, setIsDark] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Responsive check
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const visRef = useRef(null);

  const accent = "#1e3a5f";
  const brand = "#bd8d5e";

  // Close visibility dropdown on outside click
  useEffect(() => {
    const h = (e) => { if (visRef.current && !visRef.current.contains(e.target)) setShowVis(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  const reset = useCallback(() => {
    setTab("image");
    setCaption("");
    setMedia(prev => { prev.forEach(m => URL.revokeObjectURL(m.previewUrl)); return []; });
    setVis("public");
    setLocation("");
    setCommentsOff(false);
    setLikesHide(false);
    setShowAdv(false);
    setShowVis(false);
    setError("");
  }, []);

  const handleClose = () => { reset(); onClose(); };

  const resolveType = () => {
    if (tab === "reel") return "reel";
    if (tab === "image" && mediaFiles.length > 0) return "image";
    return "text";
  };

  const parseCaption = (text) => ({
    hashtags: [...new Set([...text.matchAll(/#(\w+)/g)].map(m => m[1].toLowerCase()))],
    mentions: [...new Set([...text.matchAll(/@(\w+)/g)].map(m => m[1].toLowerCase()))],
  });

  const handleImages = (e) => {
    const files = Array.from(e.target.files || []);
    const slots = MAX_IMAGES - mediaFiles.length;
    const toAdd = files.slice(0, slots).map(f => ({ file: f, previewUrl: URL.createObjectURL(f), type: "image" }));
    setMedia(prev => [...prev, ...toAdd]);
    e.target.value = "";
  };

  const handleReel = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMedia(prev => { prev.forEach(m => URL.revokeObjectURL(m.previewUrl)); return [{ file, previewUrl: URL.createObjectURL(file), type: "video" }]; });
    e.target.value = "";
  };

  const removeMedia = (idx) => setMedia(prev => { URL.revokeObjectURL(prev[idx].previewUrl); return prev.filter((_, i) => i !== idx); });
  const moveMedia = (from, to) => setMedia(prev => { const a = [...prev]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; });

  const handleSubmit = async (isDraft = false) => {
    setError("");
    const type = resolveType();
    if (type === "reel" && mediaFiles.length !== 1) return setError("Reel mein exactly 1 video honi chahiye.");
    if (type === "image" && mediaFiles.length < 1) return setError("Image post mein kam se kam 1 image zaroor ho.");
    if (type === "text" && !caption.trim()) return setError("Text post mein caption required hai.");

    const { hashtags, mentions } = parseCaption(caption);
    const fd = new FormData();
    fd.append("type", type);
    fd.append("caption", caption.trim());
    fd.append("visibility", visibility);
    fd.append("commentsDisabled", commentsOff);
    fd.append("likesHidden", likesHide);
    fd.append("isDraft", isDraft);
    if (location.trim()) fd.append("location", JSON.stringify({ name: location.trim() }));
    hashtags.forEach(h => fd.append("hashtags[]", h));
    mentions.forEach(m => fd.append("mentions[]", m));
    mediaFiles.forEach(m => fd.append("media", m.file));

    try {
      setSub(true);
      await onSubmit(fd);
      reset(); onClose();
    } catch (err) {
      setError(err?.message || "Post share nahi ho saka. Dobara try karo.");
    } finally {
      setSub(false);
    }
  };

  if (!isOpen) return null;

  const charLeft = MAX_CAPTION - caption.length;
  const visOpt = VISIBILITY_OPTIONS.find(v => v.value === visibility);
  const VisIcon = visOpt.icon;
  const canShare = !submitting && (caption.trim().length > 0 || mediaFiles.length > 0);
  const postType = resolveType();

  return (
    <>
      <style>{`
        @keyframes pcmFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pcmSlideUp { from { opacity: 0; transform: translateY(24px) scale(.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes spin       { to { transform: rotate(360deg) } }
        .pcm-overlay  { animation: pcmFadeIn  .2s ease; }
        .pcm-modal    { animation: pcmSlideUp .28s cubic-bezier(.16,1,.3,1); }
        .pcm-textarea:focus { border-color: ${accent} !important; outline: none; }
        .pcm-row:focus-within { border-color: ${accent} !important; }
        .pcm-spin { animation: spin .8s linear infinite; }
      `}</style>

      {/* Overlay */}
      <div
        className="pcm-overlay fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}
        onClick={e => e.target === e.currentTarget && handleClose()}
      >
        {/* Modal */}
        <div
          className="pcm-modal w-full overflow-hidden"
          style={{
            maxWidth: isMobile ? "100%" : 860,
            width: "100%",
            borderRadius: isMobile ? 0 : 28,
            boxShadow: isMobile ? "none" : "0 32px 80px rgba(0,0,0,0.3)",
            height: isMobile ? "100%" : "auto",
            minHeight: isMobile ? "100%" : 520,
            maxHeight: isMobile ? "100%" : "min(95vh, 800px)",
            background: isDark ? "#111827" : "#ffffff",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            position: isMobile ? "fixed" : "relative",
            inset: isMobile ? 0 : "auto",
            zIndex: 100,
          }}
        >

          {/* ══════ LEFT ══════ */}
          {!isMobile && (
            <div
              className="pcm-section pcm-section-left flex flex-col overflow-y-auto"
              style={{
                flex: 1,
                padding: "24px 20px",
                borderRight: `1px solid ${isDark ? "#374151" : "#f1f5f9"}`,
                background: isDark ? "#1f2937" : "#f9fafb",
              }}
            >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-lg font-extrabold" style={{ color: isDark ? "#f1f5f9" : "#111827" }}>
                New Post
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setIsDark(d => !d)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-black/5"
                  style={{ background: "transparent", border: `1px solid ${isDark ? "#374151" : "#f1f5f9"}` }}
                >
                  <span className="text-base">{isDark ? "☀️" : "🌙"}</span>
                </button>
                <button
                  onClick={handleClose}
                  className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-black/5"
                  style={{ background: "transparent", border: `1px solid ${isDark ? "#374151" : "#f1f5f9"}` }}
                >
                  <X size={18} color={isDark ? "#9ca3af" : "#6b7280"} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-5">
              {[
                { id: "image", label: "Photo", Icon: ImageIcon },
                { id: "reel", label: "Video", Icon: Clapperboard },
                { id: "text", label: "Text", Icon: Type },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => { setTab(id); setMedia(prev => { prev.forEach(m => URL.revokeObjectURL(m.previewUrl)); return []; }); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold cursor-pointer transition-all duration-200 border"
                  style={{
                    background: tab === id ? accent : "transparent",
                    color: tab === id ? "#fff" : (isDark ? "#9ca3af" : "#6b7280"),
                    borderColor: tab === id ? accent : (isDark ? "#374151" : "#f1f5f9"),
                  }}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {/* Upload Zone */}
            {tab !== "text" && (
              <>
                <label
                  className="flex-1 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed min-h-[200px] cursor-pointer transition-all duration-200 hover:opacity-80"
                  style={{ borderColor: isDark ? "#374151" : "#e5e7eb" }}
                >
                  <div
                    className="w-16 h-16 rounded-[18px] flex items-center justify-center border"
                    style={{
                      background: isDark ? "#374151" : "#fff",
                      borderColor: isDark ? "#4b5563" : "#f1f5f9",
                    }}
                  >
                    {tab === "image"
                      ? <ImageIcon size={28} color={brand} />
                      : <Clapperboard size={28} color={brand} />
                    }
                  </div>
                  <span className="text-[15px] font-bold" style={{ color: isDark ? "#f1f5f9" : "#111827" }}>
                    {tab === "image" ? "Upload Photos" : "Upload Video"}
                  </span>
                  <span className="text-[13px]" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                    {tab === "image" ? `Up to ${MAX_IMAGES} images` : "MP4, MOV, WEBM · Max 100MB"}
                  </span>
                  <span className="text-[13px] font-semibold" style={{ color: brand }}>Browse files</span>
                  <input
                    type="file"
                    accept={tab === "image" ? "image/*" : "video/*"}
                    multiple={tab === "image"}
                    hidden
                    onChange={tab === "image" ? handleImages : handleReel}
                  />
                </label>

                {mediaFiles.length > 0 && (
                  <MediaGrid files={mediaFiles} onRemove={removeMedia} onMove={moveMedia} />
                )}

                {tab === "image" && mediaFiles.length > 0 && mediaFiles.length < MAX_IMAGES && (
                  <label
                    className="inline-flex items-center gap-1.5 mt-2.5 text-[13px] font-semibold cursor-pointer"
                    style={{ color: brand }}
                  >
                    <ImageIcon size={14} /> Add more ({MAX_IMAGES - mediaFiles.length} left)
                    <input type="file" accept="image/*" multiple hidden onChange={handleImages} />
                  </label>
                )}
              </>
            )}

            {tab === "text" && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                <div
                  className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center border"
                  style={{
                    background: isDark ? "#374151" : "#fff",
                    borderColor: isDark ? "#4b5563" : "#f1f5f9",
                  }}
                >
                  <Type size={32} color={brand} />
                </div>
                <span className="text-[15px] font-bold" style={{ color: isDark ? "#f1f5f9" : "#111827" }}>Text Post</span>
                <span className="text-[13px] text-center" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                  Share your thoughts, stories, or anything on your mind
                </span>
              </div>
            )}

            {/* Post type badge */}
            <div className="mt-auto pt-4">
              <span
                className="text-[11px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full"
                style={{
                  background: isDark ? "#374151" : "#f1f5f9",
                  color: isDark ? "#9ca3af" : "#6b7280",
                }}
              >
                {postType} post
              </span>
            </div>
          </div>
        )}

          {/* ══════ RIGHT ══════ */}
          <div
            className="pcm-section pcm-section-right flex flex-col overflow-y-auto"
            style={{
              flex: 1.15,
              padding: "24px 20px",
              background: isDark ? "#111827" : "#ffffff",
            }}
          >
            {/* Mobile Header */}
            {isMobile && (
              <div className="flex items-center justify-between mb-6 pb-4 border-b"
                   style={{ borderColor: isDark ? "#374151" : "#f1f5f9" }}>
                <button onClick={handleClose} className="p-2 -ml-2" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                  <X size={24} />
                </button>
                <span className="text-lg font-bold" style={{ color: isDark ? "#f1f5f9" : "#111827" }}>
                  New Post
                </span>
                <button 
                  onClick={() => handleSubmit(false)}
                  disabled={!canShare}
                  className="text-sm font-bold" 
                  style={{ color: canShare ? brand : "#9ca3af" }}
                >
                  Share
                </button>
              </div>
            )}

            {/* User info */}
            <div className="flex items-center gap-3 mb-5" style={{ marginBottom: isMobile ? 12 : 20 }}>
              <Avatar user={currentUser} />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold" style={{ color: isDark ? "#f1f5f9" : "#111827" }}>
                  {currentUser?.fullName || "User"}
                </div>

                {/* Visibility dropdown */}
                <div ref={visRef} className="relative inline-block">
                  <button
                    onClick={() => setShowVis(v => !v)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-semibold cursor-pointer mt-0.5 border-none"
                    style={{
                      background: isDark ? "#374151" : "#f1f5f9",
                      color: isDark ? "#9ca3af" : "#6b7280",
                    }}
                  >
                    <VisIcon size={12} color={visOpt.color} />
                    {visOpt.label}
                    <ChevronRight
                      size={10}
                      style={{ transform: showVis ? "rotate(90deg)" : "none", transition: "transform .2s" }}
                    />
                  </button>

                  {showVis && (
                    <div
                      className="absolute left-0 min-w-[200px] rounded-2xl overflow-hidden z-50"
                      style={{
                        top: "calc(100% + 6px)",
                        background: isDark ? "#111827" : "#ffffff",
                        border: `1px solid ${isDark ? "#374151" : "#f1f5f9"}`,
                        boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
                      }}
                    >
                      {VISIBILITY_OPTIONS.map(opt => {
                        const OIcon = opt.icon;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => { setVis(opt.value); setShowVis(false); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 border-none cursor-pointer text-sm transition-colors duration-150"
                            style={{
                              background: visibility === opt.value ? (isDark ? "#374151" : "#f0f4ff") : "transparent",
                              color: isDark ? "#f1f5f9" : "#111827",
                              fontWeight: visibility === opt.value ? 700 : 500,
                            }}
                          >
                            <OIcon size={16} color={opt.color} />
                            {opt.label}
                            {visibility === opt.value && (
                              <span className="ml-auto text-xs" style={{ color: accent }}>✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Caption textarea */}
            <div className="relative mb-3">
              <textarea
                className="pcm-textarea w-full resize-none text-[15px] leading-relaxed rounded-2xl px-4 pt-3.5 border transition-colors duration-200 font-[inherit]"
                value={caption}
                onChange={e => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                placeholder="What's on your mind? Use #hashtags and @mentions..."
                style={{
                  minHeight: 140,
                  paddingBottom: 44,
                  background: isDark ? "#1f2937" : "#f9fafb",
                  color: isDark ? "#f1f5f9" : "#111827",
                  borderColor: isDark ? "#374151" : "#f1f5f9",
                }}
              />
              {/* Toolbar */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-1">
                {/* Mobile-only media buttons */}
                {isMobile && (
                  <div className="flex items-center gap-1">
                    <label className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer hover:bg-black/5" style={{ color: "#94a3b8" }}>
                      <ImageIcon size={20} />
                      <input type="file" accept="image/*" multiple hidden onChange={handleImages} />
                    </label>
                    <label className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer hover:bg-black/5" style={{ color: "#94a3b8" }}>
                      <Clapperboard size={20} />
                      <input type="file" accept="video/*" hidden onChange={handleReel} />
                    </label>
                  </div>
                )}

                {/* Emoji picker — uses fixed positioning, never clips */}
                <EmojiBtn onSelect={e => setCaption(c => c + e)} isDark={isDark} />

                <button
                  type="button"
                  title="Tag people"
                  className="w-9 h-9 rounded-lg flex items-center justify-center border-none cursor-pointer transition-all duration-200 bg-transparent hover:bg-black/5"
                  style={{ color: isDark ? "#94a3b8" : "#94a3b8" }}
                >
                  <Tag size={18} />
                </button>
                <button
                  type="button"
                  title="Add music"
                  className="w-9 h-9 rounded-lg flex items-center justify-center border-none cursor-pointer transition-all duration-200 bg-transparent hover:bg-black/5"
                  style={{ color: isDark ? "#94a3b8" : "#94a3b8" }}
                >
                  <Music size={18} />
                </button>
                <span
                  className="ml-auto text-xs font-semibold"
                  style={{ color: charLeft < 100 ? "#ef4444" : (isDark ? "#9ca3af" : "#6b7280") }}
                >
                  {charLeft}
                </span>
              </div>
            </div>

            {/* Media Preview (Mobile) */}
            {isMobile && mediaFiles.length > 0 && (
              <div className="mb-4">
                <MediaGrid files={mediaFiles} onRemove={removeMedia} onMove={moveMedia} />
              </div>
            )}

            {/* Location */}
            <div
              className="pcm-row flex items-center gap-2.5 px-4 py-2.5 rounded-[14px] border mb-2.5 transition-colors duration-200"
              style={{ borderColor: isDark ? "#374151" : "#f1f5f9" }}
            >
              <MapPin size={17} color={location ? brand : (isDark ? "#9ca3af" : "#6b7280")} />
              <input
                className="border-none outline-none bg-transparent text-sm flex-1 font-[inherit]"
                placeholder="Add location..."
                value={location}
                onChange={e => setLocation(e.target.value)}
                style={{ color: isDark ? "#f1f5f9" : "#111827" }}
              />
              {location && (
                <button
                  onClick={() => setLocation("")}
                  className="bg-transparent border-none cursor-pointer"
                >
                  <X size={14} color={isDark ? "#9ca3af" : "#6b7280"} />
                </button>
              )}
            </div>

            {/* Advanced Settings */}
            <button
              type="button"
              onClick={() => setShowAdv(v => !v)}
              className="flex items-center gap-2 bg-transparent border-none cursor-pointer text-[13px] font-semibold py-1 mb-1"
              style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
            >
              <Settings2 size={15} />
              Advanced settings
              <ChevronRight
                size={14}
                className="ml-auto"
                style={{ transform: showAdv ? "rotate(90deg)" : "none", transition: "transform .2s" }}
              />
            </button>

            {showAdv && (
              <div
                className="rounded-2xl px-4 mb-3"
                style={{ background: isDark ? "#1f2937" : "#f9fafb" }}
              >
                <div
                  className="flex items-center justify-between py-3.5 border-b"
                  style={{ borderColor: isDark ? "#374151" : "#f1f5f9" }}
                >
                  <div>
                    <div className="text-sm font-semibold" style={{ color: isDark ? "#f1f5f9" : "#111827" }}>
                      Disable comments
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                      No one can comment on this post
                    </div>
                  </div>
                  <Toggle checked={commentsOff} onChange={setCommentsOff} />
                </div>
                <div className="flex items-center justify-between py-3.5">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: isDark ? "#f1f5f9" : "#111827" }}>
                      Hide like count
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                      Others won't see how many likes
                    </div>
                  </div>
                  <Toggle checked={likesHide} onChange={setLikesHide} />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-[13px] text-red-500 font-semibold mb-3">
                ⚠️ {error}
              </div>
            )}

            {/* Footer */}
            {!isMobile && (
              <div className="flex items-center gap-2.5 mt-auto pt-4">
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={!canShare}
                  className="px-6 py-2.5 rounded-full text-sm font-semibold cursor-pointer transition-all duration-200 border disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: isDark ? "#374151" : "#f1f5f9",
                    background: "transparent",
                    color: isDark ? "#9ca3af" : "#6b7280",
                  }}
                >
                  Save Draft
                </button>

                <div className="flex-1" />

                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-full text-sm font-semibold cursor-pointer transition-all duration-200 border"
                  style={{
                    borderColor: isDark ? "#374151" : "#f1f5f9",
                    background: "transparent",
                    color: isDark ? "#9ca3af" : "#6b7280",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={!canShare}
                  className="px-9 py-2.5 rounded-full text-[15px] font-bold cursor-pointer transition-all duration-200 flex items-center gap-2 border-none disabled:opacity-55 disabled:cursor-not-allowed hover:-translate-y-px"
                  style={{
                    background: brand,
                    color: "#fff",
                    boxShadow: "0 4px 18px rgba(189,141,94,.4)",
                  }}
                >
                  {submitting ? (
                    <>
                      <span
                        className="pcm-spin inline-block w-4 h-4 rounded-full border-2"
                        style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
                      />
                      Sharing...
                    </>
                  ) : "Share Post"}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}