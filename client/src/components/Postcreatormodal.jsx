

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, Image as ImageIcon, Clapperboard, Type,
  Smile, MapPin, Music, Tag, ChevronLeft, ChevronRight,
  Globe, Users, Lock, Settings2,
} from "lucide-react";
import EmojiPickerReact from "emoji-picker-react";
import ImageVideoUploader from "./ImageVideoUploader";

const MAX_CAPTION = 2200;

const VISIBILITY_OPTIONS = [
  { value: "public",    label: "Everyone",       icon: Globe,  color: "#22c55e" },
  { value: "followers", label: "Followers only",  icon: Users,  color: "#3b82f6" },
  { value: "only_me",  label: "Only me",          icon: Lock,   color: "#f59e0b" },
];

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ user, size = 40 }) {
  const initials   = user?.fullName
    ? user.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "U";
  const avatarUrl  = user?.avatar?.url || user?.avatarUrl || null;
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-bold border-2 border-gray-100"
      style={{
        width:      size,
        height:     size,
        background: avatarUrl ? `url(${avatarUrl}) center/cover` : "#f0e8df",
        fontSize:   size * 0.35,
        color:      "#6b3f2a",
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
      className="relative shrink-0 border-none cursor-pointer transition-colors duration-300 rounded-xl"
      style={{ width: 44, height: 24, background: checked ? "#1e3a5f" : "#e2e8f0" }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300"
        style={{ left: checked ? 22 : 2 }}
      />
    </button>
  );
}

// ─── EmojiBtn ─────────────────────────────────────────────────────────────────
const PICKER_W = 320;
const PICKER_H = 435;

function EmojiBtn({ onSelect, isDark }) {
  const [open, setOpen]     = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef              = useRef(null);

  const calcCoords = () => {
    if (!btnRef.current) return;
    const rect     = btnRef.current.getBoundingClientRect();
    const vw       = window.innerWidth;
    const vh       = window.innerHeight;
    const spaceAbove = rect.top;
    const spaceBelow = vh - rect.bottom;
    let top;
    if      (spaceBelow >= PICKER_H + 12) top = rect.bottom + 8;
    else if (spaceAbove >= PICKER_H + 12) top = rect.top - PICKER_H - 8;
    else                                  top = Math.max(8, (vh - PICKER_H) / 2);
    top = Math.max(8, Math.min(top, vh - PICKER_H - 8));
    let left = rect.left;
    if (left + PICKER_W > vw - 8) left = vw - PICKER_W - 8;
    if (left < 8)                 left = 8;
    setCoords({ top, left });
  };

  const handleToggle = () => { if (!open) calcCoords(); setOpen((v) => !v); };

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      const portal = document.getElementById("emoji-portal-picker");
      if (btnRef.current && !btnRef.current.contains(e.target) &&
          portal && !portal.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = () => calcCoords();
    window.addEventListener("scroll", h, true);
    window.addEventListener("resize", h);
    return () => { window.removeEventListener("scroll", h, true); window.removeEventListener("resize", h); };
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
          color:      open ? "#1e3a5f" : "#94a3b8",
        }}
      >
        <Smile size={20} />
      </button>
      {open && createPortal(
        <div
          id="emoji-portal-picker"
          style={{ position: "fixed", top: coords.top, left: coords.left,
                   zIndex: 999999, borderRadius: 16, overflow: "hidden",
                   boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}
        >
          <EmojiPickerReact
            onEmojiClick={(d) => { onSelect(d.emoji); setOpen(false); }}
            width={PICKER_W} height={PICKER_H}
            theme={isDark ? "dark" : "light"}
            searchDisabled={false} skinTonesDisabled={false} lazyLoadEmojis
          />
        </div>,
        document.body,
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PostCreatorModal({ isOpen, onClose, currentUser, onSubmit }) {
  const [tab,        setTab]        = useState("image");
  const [caption,    setCaption]    = useState("");
  // ✅ Single source of truth for uploaded media (Cloudinary objects)
  const [mediaItems, setMediaItems] = useState([]);
  const [visibility, setVis]        = useState("public");
  const [showVis,    setShowVis]    = useState(false);
  const [location,   setLocation]   = useState("");
  const [commentsOff,setCommentsOff]= useState(false);
  const [likesHide,  setLikesHide]  = useState(false);
  const [showAdv,    setShowAdv]    = useState(false);
  const [submitting, setSub]        = useState(false);
  const [error,      setError]      = useState("");
  const [isDark,     setIsDark]     = useState(false);
 const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  const visRef = useRef(null);
  const accent = "#1e3a5f";
  const brand  = "#bd8d5e";

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    const h = (e) => { if (visRef.current && !visRef.current.contains(e.target)) setShowVis(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [handleClose]);

  // ✅ reset: no URL.revokeObjectURL needed — we store Cloudinary URLs now
  const reset = useCallback(() => {
    setTab("image");
    setCaption("");
    setMediaItems([]);
    setVis("public");
    setLocation("");
    setCommentsOff(false);
    setLikesHide(false);
    setShowAdv(false);
    setShowVis(false);
    setError("");
  }, []);

  const handleClose = () => { reset(); onClose(); };

  // ✅ resolveType uses mediaItems (correct state name)
  const resolveType = () => {
    if (tab === "reel")                               return "reel";
    if (tab === "image" && mediaItems.length > 0)     return "image";
    return "text";
  };

  const parseCaption = (text) => ({
    hashtags: [...new Set([...text.matchAll(/#(\w+)/g)].map((m) => m[1].toLowerCase()))],
    mentions: [...new Set([...text.matchAll(/@(\w+)/g)].map((m) => m[1].toLowerCase()))],
  });

  // ✅ canShare uses mediaItems
  const canShare = !submitting && (caption.trim().length > 0 || mediaItems.length > 0);
  const postType = resolveType();
  const charLeft = MAX_CAPTION - caption.length;

  const handleSubmit = async (isDraft = false) => {
  setError("");
  const type = resolveType();

  if (isDraft) {
    // Draft: just needs something — image OR caption
    if (mediaItems.length === 0 && !caption.trim()) {
      return setError("Add a caption or upload media before saving a draft.");
    }
  } else {
    // Published post: strict validation
    if (type === "reel"  && mediaItems.length !== 1) return setError("Reel needs exactly 1 video.");
    if (type === "image" && mediaItems.length < 1)   return setError("Image post needs at least 1 image.");
    if (type === "text"  && !caption.trim())          return setError("Text post needs a caption.");
  }

    const { hashtags, mentions } = parseCaption(caption);

    try {
      setSub(true);
      await onSubmit({
        type,
        caption:          caption.trim(),
        visibility,
        commentsDisabled: commentsOff,
        likesHidden:      likesHide,
        isDraft,
        location:         location.trim() ? JSON.stringify({ name: location.trim() }) : null,
        hashtags,
        mentions,
        media:            mediaItems,  // ← Cloudinary objects, already uploaded
      });
      reset();
      onClose();
    } catch (err) {
      setError(err?.message || "Post could not be shared. Please try again.");
    } finally {
      setSub(false);
    }
  };

  if (!isOpen) return null;

  const visOpt = VISIBILITY_OPTIONS.find((v) => v.value === visibility);
  const VisIcon = visOpt.icon;

  const tabList = [
    { id: "image", label: "Photo",  Icon: ImageIcon  },
    { id: "reel",  label: "Video",  Icon: Clapperboard },
    { id: "text",  label: "Text",   Icon: Type       },
  ];

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
        className="pcm-overlay fixed inset-0 z-9999 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        {/* Modal */}
        <div
          className="pcm-modal w-full overflow-hidden"
          style={{
            maxWidth:      isMobile ? "100%" : 860,
            width:         "100%",
            borderRadius:  isMobile ? 0 : 28,
            boxShadow:     isMobile ? "none" : "0 32px 80px rgba(0,0,0,0.3)",
            height:        isMobile ? "100%" : "auto",
            minHeight:     isMobile ? "100%" : 520,
            maxHeight:     isMobile ? "100%" : "min(95vh,800px)",
            background:    isDark ? "#111827" : "#ffffff",
            display:       "flex",
            flexDirection: isMobile ? "column" : "row",
            position:      isMobile ? "fixed" : "relative",
            inset:         isMobile ? 0 : "auto",
            zIndex:        100,
          }}
        >

          {/* ══════ LEFT PANEL ══════ */}
          {!isMobile && (
            <div
              style={{
                flex:         1,
                padding:      "24px 20px",
                borderRight:  `1px solid ${isDark ? "#374151" : "#f1f5f9"}`,
                background:   isDark ? "#1f2937" : "#f9fafb",
                display:      "flex",
                flexDirection:"column",
                overflowY:    "auto",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-lg font-extrabold" style={{ color: isDark ? "#f1f5f9" : "#111827" }}>
                  New Post
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setIsDark((d) => !d)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer hover:bg-black/5"
                    style={{ background: "transparent", border: `1px solid ${isDark ? "#374151" : "#f1f5f9"}` }}
                  >
                    <span className="text-base">{isDark ? "☀️" : "🌙"}</span>
                  </button>
                  <button
                    onClick={handleClose}
                    className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer hover:bg-black/5"
                    style={{ background: "transparent", border: `1px solid ${isDark ? "#374151" : "#f1f5f9"}` }}
                  >
                    <X size={18} color={isDark ? "#9ca3af" : "#6b7280"} />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-5">
                {tabList.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => { setTab(id); setMediaItems([]); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold cursor-pointer transition-all duration-200 border"
                    style={{
                      background:   tab === id ? accent : "transparent",
                      color:        tab === id ? "#fff" : (isDark ? "#9ca3af" : "#6b7280"),
                      borderColor:  tab === id ? accent : (isDark ? "#374151" : "#f1f5f9"),
                    }}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>

              {/* ✅ Uploader — shown for image & reel tabs */}
              {tab !== "text" && (
                <ImageVideoUploader
                  onUploadComplete={setMediaItems}
                  isDark={isDark}
                />
              )}

              {/* Text tab — inline textarea */}
              {tab === "text" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <span className="text-[13px] font-semibold" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                    Write your post
                  </span>
                  <textarea
                    className="pcm-textarea w-full resize-none rounded-2xl px-4 py-3.5 border transition-colors duration-200 font-[inherit]"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                    placeholder="What's on your mind? Use #hashtags and @mentions…"
                    style={{
                      minHeight:   220, flex: 1,
                      fontSize:    15,  lineHeight: 1.6,
                      background:  isDark ? "#1f2937" : "#fff",
                      color:       isDark ? "#f1f5f9" : "#111827",
                      borderColor: isDark ? "#374151" : "#e5e7eb",
                    }}
                  />
                  <span
                    className="text-xs font-semibold text-right"
                    style={{ color: charLeft < 100 ? "#ef4444" : (isDark ? "#9ca3af" : "#6b7280") }}
                  >
                    {charLeft} chars left
                  </span>
                </div>
              )}

              {/* Post type badge */}
              <div className="mt-auto pt-4">
                <span
                  className="text-[11px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full"
                  style={{ background: isDark ? "#374151" : "#f1f5f9", color: isDark ? "#9ca3af" : "#6b7280" }}
                >
                  {postType} post
                </span>
              </div>
            </div>
          )}

          {/* ══════ RIGHT PANEL ══════ */}
          <div
            style={{
              flex:         1.15,
              padding:      "24px 20px",
              background:   isDark ? "#111827" : "#ffffff",
              display:      "flex",
              flexDirection:"column",
              overflowY:    "auto",
            }}
          >
            {/* Mobile Header */}
            {isMobile && (
              <div
                className="flex items-center justify-between mb-6 pb-4 border-b"
                style={{ borderColor: isDark ? "#374151" : "#f1f5f9" }}
              >
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

            {/* Mobile: tabs + uploader */}
            {isMobile && (
              <>
                <div className="flex gap-2 mb-4">
                  {tabList.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      onClick={() => { setTab(id); setMediaItems([]); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border"
                      style={{
                        background:  tab === id ? accent : "transparent",
                        color:       tab === id ? "#fff" : (isDark ? "#9ca3af" : "#6b7280"),
                        borderColor: tab === id ? accent : (isDark ? "#374151" : "#e5e7eb"),
                      }}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  ))}
                </div>
                {tab !== "text" && (
                  <div className="mb-4">
                    <ImageVideoUploader onUploadComplete={setMediaItems} isDark={isDark} />
                  </div>
                )}
              </>
            )}

            {/* User info + visibility */}
            <div className="flex items-center gap-3 mb-5">
              <Avatar user={currentUser} />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold" style={{ color: isDark ? "#f1f5f9" : "#111827" }}>
                  {currentUser?.fullName || "User"}
                </div>
                <div ref={visRef} className="relative inline-block">
                  <button
                    onClick={() => setShowVis((v) => !v)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-semibold cursor-pointer mt-0.5 border-none"
                    style={{ background: isDark ? "#374151" : "#f1f5f9", color: isDark ? "#9ca3af" : "#6b7280" }}
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
                      className="absolute left-0 min-w-50 rounded-2xl overflow-hidden z-50"
                      style={{
                        top:        "calc(100% + 6px)",
                        background: isDark ? "#111827" : "#ffffff",
                        border:     `1px solid ${isDark ? "#374151" : "#f1f5f9"}`,
                        boxShadow:  "0 12px 40px rgba(0,0,0,0.15)",
                      }}
                    >
                      {VISIBILITY_OPTIONS.map((opt) => {
                        const OIcon = opt.icon;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => { setVis(opt.value); setShowVis(false); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 border-none cursor-pointer text-sm transition-colors"
                            style={{
                              background: visibility === opt.value ? (isDark ? "#374151" : "#f0f4ff") : "transparent",
                              color:      isDark ? "#f1f5f9" : "#111827",
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
                className="pcm-textarea w-full resize-none rounded-2xl px-4 pt-3.5 border transition-colors font-[inherit]"
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                placeholder="What's on your mind? Use #hashtags and @mentions…"
                style={{
                  minHeight:   140,
                  paddingBottom: 44,
                  fontSize:    15,
                  lineHeight:  1.6,
                  background:  isDark ? "#1f2937" : "#f9fafb",
                  color:       isDark ? "#f1f5f9" : "#111827",
                  borderColor: isDark ? "#374151" : "#f1f5f9",
                }}
              />
              {/* Toolbar */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-1">
                <EmojiBtn onSelect={(e) => setCaption((c) => c + e)} isDark={isDark} />
                <button
                  type="button"
                  title="Tag people"
                  className="w-9 h-9 rounded-lg flex items-center justify-center border-none cursor-pointer bg-transparent hover:bg-black/5"
                  style={{ color: "#94a3b8" }}
                >
                  <Tag size={18} />
                </button>
                <button
                  type="button"
                  title="Add music"
                  className="w-9 h-9 rounded-lg flex items-center justify-center border-none cursor-pointer bg-transparent hover:bg-black/5"
                  style={{ color: "#94a3b8" }}
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

            {/* Location */}
            <div
              className="pcm-row flex items-center gap-2.5 px-4 py-2.5 rounded-[14px] border mb-2.5 transition-colors"
              style={{ borderColor: isDark ? "#374151" : "#f1f5f9" }}
            >
              <MapPin size={17} color={location ? brand : (isDark ? "#9ca3af" : "#6b7280")} />
              <input
                className="border-none outline-none bg-transparent text-sm flex-1 font-[inherit]"
                placeholder="Add location…"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{ color: isDark ? "#f1f5f9" : "#111827" }}
              />
              {location && (
                <button onClick={() => setLocation("")} className="bg-transparent border-none cursor-pointer">
                  <X size={14} color={isDark ? "#9ca3af" : "#6b7280"} />
                </button>
              )}
            </div>

            {/* Advanced settings */}
            <button
              type="button"
              onClick={() => setShowAdv((v) => !v)}
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
              <div className="rounded-2xl px-4 mb-3" style={{ background: isDark ? "#1f2937" : "#f9fafb" }}>
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
                  className="px-6 py-2.5 rounded-full text-sm font-semibold cursor-pointer transition-all border disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: isDark ? "#374151" : "#f1f5f9",
                    background:  "transparent",
                    color:       isDark ? "#9ca3af" : "#6b7280",
                  }}
                >
                  Save Draft
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-full text-sm font-semibold cursor-pointer border"
                  style={{
                    borderColor: isDark ? "#374151" : "#f1f5f9",
                    background:  "transparent",
                    color:       isDark ? "#9ca3af" : "#6b7280",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={!canShare}
                  className="px-9 py-2.5 rounded-full text-[15px] font-bold cursor-pointer transition-all flex items-center gap-2 border-none disabled:opacity-55 disabled:cursor-not-allowed hover:-translate-y-px"
                  style={{ background: brand, color: "#fff", boxShadow: "0 4px 18px rgba(189,141,94,.4)" }}
                >
                  {submitting ? (
                    <>
                      <span
                        className="pcm-spin inline-block w-4 h-4 rounded-full border-2"
                        style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
                      />
                      Sharing…
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