

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";

// ── Helpers ───────────────────────────────────────────────────
function fmtCount(n = 0) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Media carousel item ───────────────────────────────────────
function MediaItem({ item, postType, active }) {
  const isVideo =
    postType === "reel" ||
    item?.resourceType === "video" ||
    /\.(mp4|mov|webm|avi)$/i.test(item?.url ?? "");

  if (isVideo) {
    return (
      <video
        src={item?.url}
        className="w-full h-full object-contain"
        controls
        autoPlay={active}
        playsInline
        loop
      />
    );
  }
  return (
    <img
      src={item?.url}
      alt=""
      className="w-full h-full object-contain"
      draggable={false}
    />
  );
}

// ── Badge component ───────────────────────────────────────────
function Badge({ type }) {
  const map = {
    image: { label: "Photo",  cls: "bg-sky-100 text-sky-700 border-sky-200"    },
    reel:  { label: "Reel",   cls: "bg-pink-100 text-pink-700 border-pink-200"  },
    text:  { label: "Text",   cls: "bg-amber-100 text-amber-700 border-amber-200" },
  };
  const { label, cls } = map[type] ?? { label: type, cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px]
      font-bold border ${cls} uppercase tracking-wide`}>
      {label}
    </span>
  );
}

// ── Stat pill ─────────────────────────────────────────────────
function Stat({ icon, value, label }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-2xl
      bg-slate-50 border border-slate-100 min-w-16">
      <span className="text-slate-500">{icon}</span>
      <span className="text-sm font-bold text-slate-800 leading-none">{fmtCount(value)}</span>
      <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function PostDetailModal({ post, onClose, onDelete, deleteLoading }) {
  const navigate              = useNavigate();
  const [mediaIdx, setMediaIdx] = useState(0);
  const [showDel,  setShowDel]  = useState(false);
  const backdropRef             = useRef(null);

  // Reset on new post
  useEffect(() => { setMediaIdx(0); setShowDel(false); }, [post?._id]);

  // Escape key
  useEffect(() => {
    if (!post) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [post, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!post) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [post]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === backdropRef.current) onClose();
  }, [onClose]);

  const handleDelete = useCallback(async () => {
    if (onDelete) await onDelete(post._id);
    onClose();
  }, [onDelete, post, onClose]);

  if (!post) return null;

  const author    = post.author;
  const mediaList = Array.isArray(post.media) ? post.media : [];
  const hasMedia  = mediaList.length > 0;
  const isText    = post.type === "text";
  const curMedia  = mediaList[mediaIdx];

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
    >
      {/* ── Modal shell ── */}
      <div
        className="relative bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col
          w-full max-w-4xl"
        style={{ maxHeight: "calc(100vh - 48px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Close button ── */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/90
            border border-slate-200 flex items-center justify-center
            hover:bg-slate-100 shadow-sm transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* ── Body ── */}
        <div className="flex flex-col sm:flex-row overflow-hidden" style={{ minHeight: 0 }}>

          {/* ── LEFT — media panel ── */}
          <div className="sm:w-[55%] bg-black shrink-0 flex items-center justify-center
            relative" style={{ minHeight: 320, maxHeight: "calc(100vh - 100px)" }}>

            {isText ? (
              /* Text post */
              <div className="w-full h-full flex items-center justify-center p-8"
                style={{ background: "linear-gradient(135deg,#fdf6ec,#fef9f3)" }}>
                <p className="text-slate-700 text-sm leading-relaxed text-center font-medium
                  max-w-xs whitespace-pre-wrap">
                  {post.caption || "—"}
                </p>
              </div>
            ) : hasMedia ? (
              <>
                <div className="w-full h-full flex items-center justify-center"
                  style={{ maxHeight: "70vh" }}>
                  <MediaItem
                    item={curMedia}
                    postType={post.type}
                    active={true}
                  />
                </div>

                {/* Carousel nav */}
                {mediaList.length > 1 && (
                  <>
                    {/* Prev */}
                    {mediaIdx > 0 && (
                      <button
                        onClick={() => setMediaIdx((i) => i - 1)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8
                          rounded-full bg-black/50 hover:bg-black/70 flex items-center
                          justify-center transition-colors"
                      >
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    )}
                    {/* Next */}
                    {mediaIdx < mediaList.length - 1 && (
                      <button
                        onClick={() => setMediaIdx((i) => i + 1)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8
                          rounded-full bg-black/50 hover:bg-black/70 flex items-center
                          justify-center transition-colors"
                      >
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                    {/* Dots */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {mediaList.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setMediaIdx(i)}
                          className={`rounded-full transition-all ${
                            i === mediaIdx
                              ? "w-4 h-1.5 bg-white"
                              : "w-1.5 h-1.5 bg-white/50"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              /* No media fallback */
              <div className="flex flex-col items-center gap-2 text-slate-600">
                <svg className="w-12 h-12 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586
                       a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6
                       a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-xs text-slate-400">No media</p>
              </div>
            )}
          </div>

          {/* ── RIGHT — details panel ── */}
          <div className="sm:w-[45%] flex flex-col overflow-y-auto">

            {/* Author header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <div className="relative shrink-0">
                {author?.profilePicture ? (
                  <img
                    src={author.profilePicture}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-violet-400
                    to-pink-400 flex items-center justify-center text-white font-bold text-sm">
                    {(author?.username?.[0] ?? "?").toUpperCase()}
                  </div>
                )}
                {author?.isVerified && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full
                    bg-blue-500 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { onClose(); navigate(`/users/${author?._id}`); }}
                    className="text-sm font-bold text-slate-800 hover:text-violet-600
                      truncate transition-colors leading-none"
                  >
                    @{author?.username}
                  </button>
                  <Badge type={post.type} />
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{author?.fullName}</p>
              </div>
            </div>

            {/* Caption */}
            {post.caption && post.type !== "text" && (
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap
                  line-clamp-5">
                  {post.caption}
                </p>
              </div>
            )}

            {/* Stats */}
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex gap-2 flex-wrap">
                <Stat
                  icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>}
                  value={post.likesCount ?? 0}
                  label="Likes"
                />
                <Stat
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>}
                  value={post.commentsCount ?? 0}
                  label="Comments"
                />
                {(post.viewsCount ?? 0) > 0 && (
                  <Stat
                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>}
                    value={post.viewsCount ?? 0}
                    label="Views"
                  />
                )}
              </div>
            </div>

            {/* Meta info */}
            <div className="px-5 py-4 border-b border-slate-100 space-y-2.5">
              <MetaRow label="Post ID">
                <span className="font-mono text-[10px] text-slate-500 bg-slate-50
                  border border-slate-200 rounded px-1.5 py-0.5 select-all">
                  {post._id}
                </span>
              </MetaRow>
              <MetaRow label="Posted on">
                <span className="text-xs text-slate-600">{formatDate(post.createdAt)}</span>
              </MetaRow>
              {mediaList.length > 0 && (
                <MetaRow label="Media">
                  <span className="text-xs text-slate-600">
                    {mediaList.length} item{mediaList.length !== 1 ? "s" : ""}
                    {mediaIdx > 0 && ` · viewing ${mediaIdx + 1} of ${mediaList.length}`}
                  </span>
                </MetaRow>
              )}
            </div>

            {/* Actions */}
            <div className="px-5 py-4 mt-auto space-y-2">
              {/* Go to user */}
              <button
                onClick={() => { onClose(); navigate(`/users/${author?._id}`); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl
                  border border-slate-200 bg-white hover:bg-slate-50 text-slate-700
                  text-sm font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                View Author Profile
              </button>

              {/* Delete — only if onDelete prop provided */}
              {onDelete && (
                <>
                  {!showDel ? (
                    <button
                      onClick={() => setShowDel(true)}
                      className="w-full py-2.5 rounded-2xl bg-red-50 border border-red-200
                        text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors
                        flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Post
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
                      <p className="text-xs text-red-700 font-semibold text-center mb-2.5">
                        This action cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowDel(false)}
                          disabled={deleteLoading === post._id}
                          className="flex-1 py-2 rounded-xl bg-white border border-slate-200
                            text-slate-600 text-xs font-semibold hover:bg-slate-50
                            transition-colors disabled:opacity-40"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={deleteLoading === post._id}
                          className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600
                            text-white text-xs font-bold transition-colors
                            disabled:opacity-40 flex items-center justify-center gap-1.5"
                        >
                          {deleteLoading === post._id ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10"
                                stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : "Confirm Delete"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helper ──────────────────────────────────────────────
function MetaRow({ label, children }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400
        w-16 shrink-0 mt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}