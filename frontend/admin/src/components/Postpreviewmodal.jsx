import { useEffect, useRef, useState } from "react";

// ─── Avatar (same logic jo CommentsPage mein hai) ────────────────────────────
function Avatar({ user, size = "sm" }) {
  const sizes  = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm" };
  const colors = [
    "bg-pink-500","bg-violet-500","bg-cyan-500",
    "bg-amber-500","bg-emerald-500","bg-rose-500","bg-indigo-500",
  ];
  const color    = colors[(user?.username?.charCodeAt(0) || 0) % colors.length];
  const avatarUrl = user?.avatar?.url || user?.avatar || user?.profilePicture;
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={user?.username}
        className={`${sizes[size]} rounded-full object-cover ring-2 ring-white shadow-sm shrink-0`}
      />
    );
  }
  const initials = (user?.fullName || user?.username || "?")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={`${sizes[size]} ${color} rounded-full flex items-center justify-center font-bold text-white ring-2 ring-white shadow-sm shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PostPreviewModal({ isOpen, post, onClose }) {
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [mediaError,   setMediaError]   = useState(false);
  const videoRef = useRef(null);

  // Reset state every time modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setVideoPlaying(false);
      setMediaError(false);
      if (videoRef.current) videoRef.current.pause();
    }
  }, [isOpen]);

  // ESC key se close
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    if (isOpen) window.addEventListener("keydown", onKey);
    return ()  => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !post) return null;

  // ── Media helpers ──────────────────────────────────────────────────────────
  const media   = post?.media?.[0];
  const isVideo = media?.resourceType === "video";
  const CLOUD   = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

  const thumbnailUrl =
    media?.thumbnailUrl ||
    (isVideo && media?.publicId
      ? `https://res.cloudinary.com/${CLOUD}/video/upload/so_0,w_700,q_auto,f_jpg/${media.publicId}.jpg`
      : media?.url);

  const videoUrl =
    media?.url ||
    (media?.publicId
      ? `https://res.cloudinary.com/${CLOUD}/video/upload/q_auto/${media.publicId}.mp4`
      : null);

  const postAuthor = post?.author;

  const formatDate = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
        })
      : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal box */}
      <div className="relative bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[88vh]">

        {/* ── Header ── */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3 shrink-0">
          {postAuthor && <Avatar user={postAuthor} size="md" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">
              {postAuthor?.fullName || postAuthor?.username || "Unknown"}
            </p>
            <p className="text-xs text-slate-400">
              @{postAuthor?.username} · {formatDate(post?.createdAt)}
            </p>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 ${
            post?.type === "reel"  ? "bg-violet-100 text-violet-600" :
            post?.type === "image" ? "bg-sky-100 text-sky-600"       :
                                     "bg-slate-200 text-slate-500"
          }`}>
            {post?.type ?? "post"}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Media ── */}
        <div className="bg-slate-950 flex items-center justify-center shrink-0" style={{ minHeight: 260 }}>
          {!media ? (
            <div className="py-16 flex flex-col items-center gap-2">
              <svg className="w-10 h-10 text-slate-600 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs text-slate-500">No media</p>
            </div>
          ) : mediaError ? (
            <div className="py-16 flex flex-col items-center gap-2">
              <svg className="w-9 h-9 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-xs text-slate-500">Media load nahi hui</p>
            </div>
          ) : isVideo && !videoPlaying ? (
            <div className="relative w-full cursor-pointer group" onClick={() => setVideoPlaying(true)}>
              <img
                src={thumbnailUrl}
                alt="video thumbnail"
                className="w-full object-contain"
                style={{ maxHeight: 400 }}
                onError={() => setMediaError(true)}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-black/40 border-2 border-white/70 flex items-center justify-center group-hover:bg-black/60 transition-all">
                  <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
          ) : isVideo && videoPlaying ? (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              className="w-full object-contain"
              style={{ maxHeight: 400 }}
              onError={() => { setMediaError(true); setVideoPlaying(false); }}
            />
          ) : (
            <img
              src={media.url}
              alt="post"
              className="w-full object-contain"
              style={{ maxHeight: 400 }}
              onError={() => setMediaError(true)}
            />
          )}
        </div>

        {/* ── Caption + Stats ── */}
        <div className="px-5 py-4 overflow-y-auto">
          <p className={`text-sm leading-relaxed mb-3 ${post?.caption ? "text-slate-700" : "text-slate-400 italic"}`}>
            {post?.caption?.trim() || "No caption"}
          </p>
          <div className="flex items-center gap-5 text-xs text-slate-400 border-t border-slate-100 pt-3">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(post?.createdAt)}
            </span>
            {post?.likesCount > 0 && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {post.likesCount} likes
              </span>
            )}
            {post?.commentsCount > 0 && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {post.commentsCount} comments
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}