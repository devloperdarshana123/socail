

import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import CustomSelect from "../components/CustomSelect";
import PostPreviewModal from "../components/Postpreviewmodal";
import { getAdminSocket , onAdminSocketReady} from "../lib/adminSocket";
import {
  fetchComments,
  fetchCommentStats,
  updateCommentStatus,
  deleteComment,
  bulkUpdateComments,
  setFilters,
  setPage,
  resetFilters,
  clearErrors,
  selectComments,
  selectCommentsLoading,
  selectCommentsError,
  selectActionLoading,
  selectActionError,
  selectCommentsPagination,
  selectCommentsFilters,
  selectCommentsStats,
} from "../lib/redux/commentsSlice";

// ── Utility ───────────────────────────────────────────────────────────────────

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getInitials(name = "") {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ── Constants — defined OUTSIDE so they never re-create ──────────────────────

// ✅ OPTIMIZATION: All static option arrays outside component
const STATUS_OPTIONS = [
  { value: "",        label: "All Statuses" },
  { value: "active",  label: "Active"       },
  { value: "flagged", label: "Flagged"      },
  { value: "removed", label: "Removed"      },
  { value: "pending", label: "Pending"      },
];

const SORT_OPTIONS = [
  { value: "createdAt",   label: "Newest First"   },
  { value: "reportCount", label: "Most Reported"  },
  { value: "likesCount",  label: "Most Liked"     },
];

const LIMIT_OPTIONS = [
  { value: "12", label: "12 / page" },
  { value: "24", label: "24 / page" },
  { value: "48", label: "48 / page" },
];

const AVATAR_COLORS = [
  "bg-pink-500","bg-violet-500","bg-cyan-500",
  "bg-amber-500","bg-emerald-500","bg-rose-500","bg-indigo-500",
];

const AVATAR_SIZES = { sm: "w-8 h-8 text-xs", md: "w-9 h-9 text-sm" };

const STATUS_MAP = {
  active:  { cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500", label: "Active"  },
  flagged: { cls: "bg-amber-50 text-amber-700 border border-amber-200",       dot: "bg-amber-500",   label: "Flagged" },
  removed: { cls: "bg-red-50 text-red-700 border border-red-200",             dot: "bg-red-500",     label: "Removed" },
  pending: { cls: "bg-sky-50 text-sky-700 border border-sky-200",             dot: "bg-sky-400",     label: "Pending" },
};

const STAT_ACCENTS = {
  blue:    { card: "bg-blue-50 border-blue-100",       icon: "text-blue-500"    },
  amber:   { card: "bg-amber-50 border-amber-100",     icon: "text-amber-500"   },
  red:     { card: "bg-red-50 border-red-100",         icon: "text-red-500"     },
  emerald: { card: "bg-emerald-50 border-emerald-100", icon: "text-emerald-500" },
};

const BULK_CONFIG = {
  approve: { color: "bg-emerald-600 hover:bg-emerald-500", label: "Approve", warn: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  flag:    { color: "bg-amber-500 hover:bg-amber-400",     label: "Flag",    warn: "bg-amber-50 border-amber-200 text-amber-700"       },
  remove:  { color: "bg-red-600 hover:bg-red-500",         label: "Remove",  warn: "bg-red-50 border-red-200 text-red-700"             },
};

// ✅ OPTIMIZATION: Stable skeleton indices outside component
const SKELETON_KEYS = [0, 1, 2, 3, 4, 5];

// ── Spinner (reusable, avoids repeated inline SVG) ────────────────────────────
const Spinner = memo(function Spinner({ size = 4, color = "text-violet-500" }) {
  return (
    <svg className={`w-${size} h-${size} animate-spin ${color}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
});

// ── Avatar ────────────────────────────────────────────────────────────────────

const Avatar = memo(function Avatar({ user, size = "sm" }) {
  const color = AVATAR_COLORS[(user?.username?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  const avatarUrl = user?.avatar?.url || user?.avatar || user?.profilePicture;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={user?.username}
        className={`${AVATAR_SIZES[size]} rounded-full object-cover ring-2 ring-white shadow-sm shrink-0`}
      />
    );
  }
  return (
    <div className={`${AVATAR_SIZES[size]} ${color} rounded-full flex items-center justify-center font-bold text-white ring-2 ring-white shadow-sm shrink-0`}>
      {getInitials(user?.fullName || user?.username || "?")}
    </div>
  );
});

// ── Status Badge ──────────────────────────────────────────────────────────────

const StatusBadge = memo(function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.active;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
});

// ── Stat Card ─────────────────────────────────────────────────────────────────

const StatCard = memo(function StatCard({ label, value, icon, accent }) {
  const a = STAT_ACCENTS[accent] || STAT_ACCENTS.blue;
  return (
    <div className={`rounded-2xl border ${a.card} px-5 py-4 flex items-center gap-4 shadow-sm`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${a.icon}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>
        <p className="text-xs text-slate-400 font-medium mt-1">{label}</p>
      </div>
    </div>
  );
});

// ── Confirm Modal ─────────────────────────────────────────────────────────────

const ConfirmModal = memo(function ConfirmModal({
  isOpen, onClose, onConfirm,
  title, message, confirmLabel = "Confirm",
  danger = false, loading = false,
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
        <h3 className="text-base font-semibold text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 ${danger ? "bg-red-600 hover:bg-red-500 text-white" : "bg-violet-600 hover:bg-violet-500 text-white"}`}>
            {loading && <Spinner />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

// ── Comment Detail Modal ──────────────────────────────────────────────────────

const CommentDetailModal = memo(function CommentDetailModal({
  isOpen, comment, onClose, onApprove, onFlag, onRemove, onDelete, actionLoading,
}) {
  if (!isOpen || !comment) return null;
  const isLoading = actionLoading === comment.id;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar user={comment.author} size="md" />
            <div>
              <p className="text-sm font-bold text-slate-800">{comment.author?.fullName || comment.author?.username}</p>
              <p className="text-xs text-slate-400">@{comment.author?.username} · {timeAgo(comment.createdAt)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-sm text-slate-700 leading-relaxed">{comment.content}</p>
          </div>
          {comment.post && (
            <div className="border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">On Post</p>
              <p className="text-sm font-medium text-slate-700 truncate">{comment.post?.caption || "No caption"}</p>
              <p className="text-xs text-slate-400 mt-0.5">by @{comment.post?.author?.username}</p>
            </div>
          )}
          {comment.reportCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                <p className="text-xs font-semibold text-amber-700">Reported {comment.reportCount} time{comment.reportCount > 1 ? "s" : ""}</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Status:</span>
              <StatusBadge status={comment.status} />
            </div>
            <span className="text-xs text-slate-400">{formatDate(comment.createdAt)}</span>
          </div>
        </div>
        <div className="px-6 pb-5 pt-4 border-t border-slate-100">
          {isLoading ? (
            <div className="flex justify-center py-2"><Spinner size={5} /></div>
          ) : (
            <div className="flex gap-2">
              {comment.status !== "active"  && <button onClick={() => onApprove(comment.id)} className="flex-1 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">Approve</button>}
              {comment.status !== "flagged" && <button onClick={() => onFlag(comment.id)}    className="flex-1 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-white transition-colors">Flag</button>}
              {comment.status !== "removed" && <button onClick={() => onRemove(comment.id)}  className="flex-1 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors">Remove</button>}
              <button onClick={() => onDelete(comment.id)} className="px-3 py-2 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors" title="Permanently delete">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ── Bulk Action Modal ─────────────────────────────────────────────────────────

const BulkActionModal = memo(function BulkActionModal({ isOpen, onClose, onConfirm, count, actionType, loading }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (isOpen) setReason(""); }, [isOpen]);
  if (!isOpen) return null;
  const c = BULK_CONFIG[actionType] || BULK_CONFIG.remove;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-800">Bulk {c.label} — {count} comment{count > 1 ? "s" : ""}</p>
          <p className="text-xs text-slate-400 mt-0.5">This action will be applied to all selected comments and is logged.</p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Reason {actionType !== "approve" && <span className="text-red-400">*</span>}</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              placeholder={actionType === "approve" ? "Reason for approving (optional)" : actionType === "flag" ? "Reason for flagging…" : "Reason for removal…"}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:border-violet-400" />
          </div>
          <div className={`border rounded-xl px-4 py-3 ${c.warn}`}>
            <p className="text-xs font-medium">
              {actionType === "approve" ? `✅ ${count} comment${count > 1 ? "s" : ""} will be approved.`
               : actionType === "flag"  ? `⚠️ ${count} comment${count > 1 ? "s" : ""} will be flagged for review.`
               :                          `🗑️ ${count} comment${count > 1 ? "s" : ""} will be removed.`}
            </p>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={() => onConfirm({ action: actionType, reason })}
            disabled={(actionType !== "approve" && !reason.trim()) || loading}
            className={`px-5 py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2 ${c.color}`}>
            {loading && <Spinner />}
            {c.label} {count} Comment{count > 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
});

// ── Comment Card ──────────────────────────────────────────────────────────────

const CommentCard = memo(function CommentCard({ comment, selected, onSelect, onView, onApprove, onFlag, onRemove, actionLoading }) {
  const isLoading   = actionLoading === comment.id;
  const postAuthor  = comment.post?.author;
  const postCaption = comment.post?.caption;
  const postType    = comment.post?.type;

  // ✅ OPTIMIZATION: stable click handlers per card
  const handleView    = useCallback(() => onView(comment),          [comment, onView]);
  const handleApprove = useCallback(() => onApprove(comment.id),   [comment.id, onApprove]);
  const handleFlag    = useCallback(() => onFlag(comment.id),      [comment.id, onFlag]);
  const handleRemove  = useCallback(() => onRemove(comment.id),    [comment.id, onRemove]);

  return (
    <div className={`bg-white border rounded-2xl shadow-sm hover:shadow-md transition-all group overflow-hidden ${selected ? "border-violet-300 ring-1 ring-violet-200" : "border-slate-200 hover:border-slate-300"}`}>
      {comment.post && (
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${postType === "reel" ? "bg-violet-100 text-violet-600" : postType === "image" ? "bg-sky-100 text-sky-600" : "bg-slate-200 text-slate-500"}`}>
              {postType ?? "post"}
            </span>
            <p className="text-xs text-slate-600 truncate font-medium">
              {postCaption?.trim() || <span className="text-slate-400 italic">No caption</span>}
            </p>
          </div>
          {postAuthor && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Avatar user={postAuthor} size="sm" />
              <span className="text-xs text-slate-400 font-medium hidden sm:block">@{postAuthor.username}</span>
            </div>
          )}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <input type="checkbox" checked={selected} onChange={onSelect} className="mt-1 w-4 h-4 rounded accent-violet-600 cursor-pointer shrink-0" />
          <Avatar user={comment.author} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-slate-800 truncate">{comment.author?.fullName || comment.author?.username}</span>
              {comment.author?.isVerified && (
                <svg className="w-3.5 h-3.5 text-sky-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.945.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.945.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              )}
              <span className="text-xs text-slate-400">@{comment.author?.username}</span>
              <span className="text-xs text-slate-300">·</span>
              <span className="text-xs text-slate-400">{timeAgo(comment.createdAt)}</span>
            </div>
            <p className="text-sm text-slate-700 mt-1.5 leading-relaxed line-clamp-2">{comment.content}</p>
          </div>
        </div>
        <div className="mt-3 ml-7 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={comment.status} />
            {comment.repliesCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                {comment.repliesCount} repl{comment.repliesCount > 1 ? "ies" : "y"}
              </span>
            )}
            {comment.reportCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                {comment.reportCount} report{comment.reportCount > 1 ? "s" : ""}
              </span>
            )}
            {comment.likesCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                {comment.likesCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {isLoading ? (
              <Spinner />
            ) : (
              <>
                <button onClick={handleView}    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">View</button>
                {comment.status !== "active"  && <button onClick={handleApprove} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors">Approve</button>}
                {comment.status !== "flagged" && <button onClick={handleFlag}    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors">Flag</button>}
                {comment.status !== "removed" && <button onClick={handleRemove}  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 transition-colors">Remove</button>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// ── Post Comment Group (Grouped View) ─────────────────────────────────────────

// ✅ OPTIMIZATION: Cloudinary URL builder extracted — not rebuilt per render
function buildThumbnailUrl(m) {
  if (m.thumbnailUrl) return m.thumbnailUrl;
  if (m.resourceType === "video" && m.publicId) {
    return `https://res.cloudinary.com/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/video/upload/so_0,w_300,q_auto,f_jpg/${m.publicId}.jpg`;
  }
  return m.url;
}

const PostCommentGroup = memo(function PostCommentGroup({
  post, comments: groupComments, selected, onSelect, onView,
  onApprove, onFlag, onRemove, actionLoading, onOpenPost,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const postAuthor = post?.author;

  const handleOpenPost = useCallback(() => onOpenPost?.(post), [post, onOpenPost]);
  const toggleCollapse = useCallback(() => setCollapsed((p) => !p), []);

  // ✅ OPTIMIZATION: useMemo for thumbnail — avoids re-computing URL per render
  const thumbnailSrc = useMemo(() => {
    const m = post?.media?.[0];
    return m ? buildThumbnailUrl(m) : null;
  }, [post]);

  const firstMedia = post?.media?.[0];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-4">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        {thumbnailSrc && (
          <div
            className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-slate-200 bg-slate-100 cursor-pointer hover:opacity-75 transition-opacity"
            onClick={handleOpenPost}
            title="Click on post thumbnail to view post details"
          >
            <img src={thumbnailSrc} alt="post" className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = "none"; }} />
            {firstMedia?.resourceType === "video" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <svg className="w-4 h-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              post?.type === "reel"  ? "bg-violet-100 text-violet-600"
              : post?.type === "image" ? "bg-sky-100 text-sky-600"
              : "bg-slate-200 text-slate-500"
            }`}>
              {post?.type ?? "post"}
            </span>
            {postAuthor && (
              <div className="flex items-center gap-1.5">
                <Avatar user={postAuthor} size="sm" />
                <span className="text-xs text-slate-500 font-medium hidden sm:block">@{postAuthor.username}</span>
              </div>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-700 truncate">
            {post?.caption?.trim() || <span className="italic text-slate-400 font-normal">No caption</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 font-medium bg-slate-200 px-2 py-0.5 rounded-full">
            {groupComments.length} comment{groupComments.length > 1 ? "s" : ""}
          </span>
          <button onClick={toggleCollapse} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-400 transition-colors">
            <svg className={`w-4 h-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="divide-y divide-slate-100">
          {groupComments.map((comment) => (
            <GroupCommentRow
              key={comment.id}
              comment={comment}
              selected={selected}
              onSelect={onSelect}
              onView={onView}
              onApprove={onApprove}
              onFlag={onFlag}
              onRemove={onRemove}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ✅ OPTIMIZATION: Extracted into separate memo component to prevent whole-group re-render
const GroupCommentRow = memo(function GroupCommentRow({
  comment, selected, onSelect, onView, onApprove, onFlag, onRemove, actionLoading,
}) {
  const handleSelect  = useCallback(() => onSelect(comment.id),  [comment.id, onSelect]);
  const handleView    = useCallback(() => onView(comment),        [comment, onView]);
  const handleApprove = useCallback(() => onApprove(comment.id), [comment.id, onApprove]);
  const handleFlag    = useCallback(() => onFlag(comment.id),    [comment.id, onFlag]);
  const handleRemove  = useCallback(() => onRemove(comment.id),  [comment.id, onRemove]);

  return (
    <div className="px-4 py-3 hover:bg-slate-50 transition-colors group">
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected.has(comment.id)} onChange={handleSelect} className="mt-1 w-4 h-4 rounded accent-violet-600 cursor-pointer shrink-0" />
        <Avatar user={comment.author} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">{comment.author?.fullName || comment.author?.username}</span>
            {comment.author?.isVerified && (
              <svg className="w-3.5 h-3.5 text-sky-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.945.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.945.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            )}
            <span className="text-xs text-slate-400">@{comment.author?.username}</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed line-clamp-2">{comment.content}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <StatusBadge status={comment.status} />
            {comment.repliesCount > 0 && <span className="text-xs text-slate-400">{comment.repliesCount} repl{comment.repliesCount > 1 ? "ies" : "y"}</span>}
            {comment.reportCount  > 0 && <span className="text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">⚠ {comment.reportCount} report{comment.reportCount > 1 ? "s" : ""}</span>}
            {comment.likesCount   > 0 && <span className="text-xs text-slate-400">♥ {comment.likesCount}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {actionLoading === comment.id ? (
            <Spinner />
          ) : (
            <>
              <button onClick={handleView}    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">View</button>
              {comment.status !== "active"  && <button onClick={handleApprove} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors">Approve</button>}
              {comment.status !== "flagged" && <button onClick={handleFlag}    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors">Flag</button>}
              {comment.status !== "removed" && <button onClick={handleRemove}  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 transition-colors">Remove</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

// ── Skeleton Card ─────────────────────────────────────────────────────────────

const SkeletonCard = memo(function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-4 h-4 bg-slate-100 rounded mt-1 shrink-0" />
        <div className="w-8 h-8 bg-slate-100 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <div className="h-3.5 bg-slate-100 rounded-full w-28" />
            <div className="h-3.5 bg-slate-100 rounded-full w-16" />
          </div>
          <div className="h-3 bg-slate-100 rounded-full w-full" />
          <div className="h-3 bg-slate-100 rounded-full w-4/5" />
        </div>
      </div>
      <div className="mt-3 ml-11 h-8 bg-slate-50 rounded-xl" />
      <div className="mt-3 ml-11 flex gap-2">
        <div className="h-6 bg-slate-100 rounded-full w-16" />
        <div className="h-6 bg-slate-100 rounded-full w-20" />
      </div>
    </div>
  );
});

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CommentsPage() {
  const dispatch = useDispatch();

  const comments      = useSelector(selectComments);
  const loading       = useSelector(selectCommentsLoading);
  const error         = useSelector(selectCommentsError);
  const actionLoading = useSelector(selectActionLoading);
  const actionError   = useSelector(selectActionError);
  const stats         = useSelector(selectCommentsStats);
  const { totalComments, totalPages, currentPage } = useSelector(selectCommentsPagination);
  const filters = useSelector(selectCommentsFilters);

  const [searchInput, setSearchInput]     = useState(filters.search);
  const debouncedSearch                   = useDebounce(searchInput, 450);
  const [selected, setSelected]           = useState(new Set());
  const [viewMode, setViewMode]           = useState("flat");
  const [detailModal, setDetailModal]     = useState({ open: false, comment: null });
  const [deleteModal, setDeleteModal]     = useState({ open: false, commentId: null });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [bulkModal, setBulkModal]         = useState({ open: false, type: "remove" });
  const [bulkLoading, setBulkLoading]     = useState(false);
  const [postPreview, setPostPreview]     = useState({ open: false, post: null });
  const [toast, setToast]                 = useState(null);

  // ✅ OPTIMIZATION: toast timer ref — prevents memory leak
  const toastTimer = useRef(null);
  const showToast = useCallback((message, type = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // ✅ OPTIMIZATION: useMemo for grouped view — only recomputes when comments/viewMode change
  const groupedComments = useMemo(() => {
    if (viewMode === "flat") return null;
    const groups = new Map();
    comments.forEach((comment) => {
      const postId = comment.post?.id ?? "unknown";
      if (!groups.has(postId)) groups.set(postId, { post: comment.post, comments: [] });
      groups.get(postId).comments.push(comment);
    });
    return Array.from(groups.values());
  }, [comments, viewMode]);

  useEffect(() => {
    dispatch(fetchComments({
      search:    filters.search    || undefined,
      status:    filters.status    || undefined,
      sortBy:    filters.sortBy,
      sortOrder: filters.sortOrder,
      page:      filters.page,
      limit:     filters.limit,
    }));
    dispatch(fetchCommentStats());
  }, [dispatch, filters]);

  // ✅ OPTIMIZATION: deps fixed
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      dispatch(setFilters({ search: debouncedSearch, page: 1 }));
    }
  }, [debouncedSearch, filters.search, dispatch]);

  useEffect(() => {
    if (actionError) {
      showToast(actionError, "error");
      dispatch(clearErrors());
    }
  }, [actionError, showToast, dispatch]);

 // filters ka ref rakho — latest value milegi bina re-subscribe ke
const filtersRef = useRef(filters);
useEffect(() => { filtersRef.current = filters; }, [filters]);

// socket useEffect — sirf ek baar register hoga


// useEffect(() => {
//   const handler = (payload) => {
//     if (payload.type !== "admin_new_comment") return;
//     const f = filtersRef.current;
//     dispatch(fetchComments({
//       search:    f.search    || undefined,
//       status:    f.status    || undefined,
//       sortBy:    f.sortBy,
//       sortOrder: f.sortOrder,
//       page:      f.page,
//       limit:     f.limit,
//     }));
//     dispatch(fetchCommentStats());
//   };

//   const s = getAdminSocket();
//   if (s?.connected) {
//     s.on("admin:notification", handler);
//     return () => s.off("admin:notification", handler);
//   }

//   const unsubscribe = onAdminSocketReady((readySocket) => {
//     readySocket.on("admin:notification", handler);
//   });

//   return () => {
//     unsubscribe();
//     const current = getAdminSocket();
//     current?.off("admin:notification", handler);
//   };
// }, [dispatch]);


// ✅ Throttle ref — pending refetch timer track karta hai
const refetchTimerRef = useRef(null);

useEffect(() => {
  const doRefetch = () => {
    const f = filtersRef.current;
    dispatch(fetchComments({
      search:    f.search    || undefined,
      status:    f.status    || undefined,
      sortBy:    f.sortBy,
      sortOrder: f.sortOrder,
      page:      f.page,
      limit:     f.limit,
    }));
    dispatch(fetchCommentStats());
  };

  const handler = (payload) => {
    if (payload.type !== "admin_new_comment") return;
    // ✅ Agar pehle se ek refetch schedule hai, toh naya schedule mat karo — wait karne do
    if (refetchTimerRef.current) return;
    refetchTimerRef.current = setTimeout(() => {
      doRefetch();
      refetchTimerRef.current = null;
    }, 3000); // 3 second mein max ek refresh
  };

  const s = getAdminSocket();
  if (s?.connected) {
    s.on("admin:notification", handler);
    return () => {
      s.off("admin:notification", handler);
      clearTimeout(refetchTimerRef.current);
    };
  }

  const unsubscribe = onAdminSocketReady((readySocket) => {
    readySocket.on("admin:notification", handler);
  });

  return () => {
    unsubscribe();
    const current = getAdminSocket();
    current?.off("admin:notification", handler);
    clearTimeout(refetchTimerRef.current);
  };
}, [dispatch]);

  // ✅ OPTIMIZATION: stable callback — not re-created per render
  const handleFilterChange = useCallback(
    (key, value) => dispatch(setFilters({ [key]: value, page: 1 })),
    [dispatch]
  );

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => prev.size === comments.length ? new Set() : new Set(comments.map((c) => c.id)));
  }, [comments]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const handleStatusAction = useCallback(async (commentId, status) => {
    const result = await dispatch(updateCommentStatus({ commentId, status }));
    if (!result.error) {
      const label = status === "active" ? "approved" : status === "flagged" ? "flagged" : "removed";
      showToast(`Comment ${label}`);
      setDetailModal((prev) =>
        prev.open && prev.comment?.id === commentId
          ? { ...prev, comment: { ...prev.comment, status } }
          : prev
      );
    }
  }, [dispatch, showToast]);

  const handleDeleteConfirm = useCallback(async () => {
    setDeleteLoading(true);
    const result = await dispatch(deleteComment(deleteModal.commentId));
    setDeleteLoading(false);
    if (!result.error) {
      showToast("Comment deleted");
      setDeleteModal({ open: false, commentId: null });
      setDetailModal((prev) => prev.open ? { open: false, comment: null } : prev);
    }
  }, [dispatch, deleteModal.commentId, showToast]);

  const handleBulkConfirm = useCallback(async ({ action, reason }) => {
    setBulkLoading(true);
    const result = await dispatch(bulkUpdateComments({ commentIds: Array.from(selected), action, reason }));
    setBulkLoading(false);
    if (!result.error) {
      // const { success = [], failed = [] } = result.payload?.data ?? {};
      // const word = action === "approve" ? "approved" : action === "flag" ? "flagged" : "removed";
      // showToast(failed.length > 0
      //   ? `${success.length} ${word}, ${failed.length} failed`
      //   : `${success.length} comment${success.length > 1 ? "s" : ""} ${word}`
      // );

      const modified = result.payload?.data?.modified ?? 0;
const failed   = result.payload?.data?.failed   ?? 0;
const word     = action === "approve" ? "approved" : action === "flag" ? "flagged" : "removed";
showToast(failed > 0
  ? `${modified} ${word}, ${failed} failed`
  : `${modified} comment${modified > 1 ? "s" : ""} ${word}`
);
      clearSelection();
      setBulkModal({ open: false, type: "remove" });
    }
  }, [dispatch, selected, showToast, clearSelection]);

  // ✅ OPTIMIZATION: stable pagination handler
  const handlePrevPage = useCallback(() => dispatch(setPage(currentPage - 1)), [dispatch, currentPage]);
  const handleNextPage = useCallback(() => dispatch(setPage(currentPage + 1)), [dispatch, currentPage]);

  // ✅ OPTIMIZATION: useMemo for pagination buttons — replaces inline Array.from IIFE
  const pageButtons = useMemo(() => {
    return Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
      let page;
      if (totalPages <= 7)                    { page = i + 1; }
      else if (currentPage <= 4)              { page = i + 1; if (i === 6) page = totalPages; }
      else if (currentPage >= totalPages - 3) { page = totalPages - 6 + i; if (i === 0) page = 1; }
      else { const pages = [1, currentPage - 1, currentPage, currentPage + 1, totalPages]; page = pages[Math.min(i, 4)]; }
      return page;
    });
  }, [currentPage, totalPages]);

  const handleResetFilters = useCallback(() => {
    dispatch(resetFilters());
    setSearchInput("");
  }, [dispatch]);

  const handleSearchClear = useCallback(() => {
    setSearchInput("");
    dispatch(setFilters({ search: "", page: 1 }));
  }, [dispatch]);

  const handleViewDetail = useCallback((c) => setDetailModal({ open: true, comment: c }), []);
  const handleCloseDetail = useCallback(() => setDetailModal({ open: false, comment: null }), []);
  const handleOpenDelete = useCallback((id) => setDeleteModal({ open: true, commentId: id }), []);
  const handleCloseDelete = useCallback(() => setDeleteModal({ open: false, commentId: null }), []);
  const handleOpenPostPreview = useCallback((p) => setPostPreview({ open: true, post: p }), []);
  const handleClosePostPreview = useCallback(() => setPostPreview({ open: false, post: null }), []);
  const handleCloseBulk = useCallback(() => setBulkModal({ open: false, type: "remove" }), []);

  const handleApprove = useCallback((id) => handleStatusAction(id, "active"),   [handleStatusAction]);
  const handleFlag    = useCallback((id) => handleStatusAction(id, "flagged"),  [handleStatusAction]);
  const handleRemove  = useCallback((id) => handleStatusAction(id, "removed"),  [handleStatusAction]);

  // ✅ OPTIMIZATION: stat values memoized so StatCards don't re-render on unrelated state changes
  const statValues = useMemo(() => ({
    total:   loading ? "—" : (stats.total || totalComments).toLocaleString(),
    flagged: loading ? "—" : stats.flagged,
    removed: loading ? "—" : stats.removed,
    pending: loading ? "—" : stats.pending,
  }), [loading, stats, totalComments]);

  return (
    <>
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-xl text-sm font-semibold shadow-lg border ${toast.type === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
          {toast.message}
        </div>
      )}

      <CommentDetailModal
        isOpen={detailModal.open}
        comment={detailModal.comment}
        onClose={handleCloseDetail}
        onApprove={handleApprove}
        onFlag={handleFlag}
        onRemove={handleRemove}
        onDelete={handleOpenDelete}
        actionLoading={actionLoading}
      />

      <PostPreviewModal
        isOpen={postPreview.open}
        post={postPreview.post}
        onClose={handleClosePostPreview}
      />

      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={handleCloseDelete}
        onConfirm={handleDeleteConfirm}
        title="Delete Comment"
        message="Permanently delete this comment? This cannot be undone."
        confirmLabel="Delete"
        danger
        loading={deleteLoading}
      />

      <BulkActionModal
        isOpen={bulkModal.open}
        onClose={handleCloseBulk}
        onConfirm={handleBulkConfirm}
        count={selected.size}
        actionType={bulkModal.type}
        loading={bulkLoading}
      />

      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">

          {/* Header */}
          <div className="flex items-center justify-between mb-7">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">Comments</h1>
              <p className="text-sm text-slate-400 mt-0.5">{loading ? "Loading…" : `${totalComments.toLocaleString()} total comments`}</p>
            </div>
            <button onClick={handleResetFilters} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors border border-slate-200 bg-white rounded-lg px-3 py-2 hover:bg-slate-50">
              Reset filters
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
            <StatCard label="Total Comments" value={statValues.total}   accent="blue"    icon={<svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>} />
            <StatCard label="Flagged"        value={statValues.flagged} accent="amber"   icon={<svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6H13l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>} />
            <StatCard label="Removed"        value={statValues.removed} accent="red"     icon={<svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>} />
            <StatCard label="Pending Review" value={statValues.pending} accent="emerald" icon={<svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          </div>

          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 mb-5 shadow-sm">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-55 max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search comment text, username…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors" />
                {searchInput && (
                  <button onClick={handleSearchClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
                )}
              </div>
              <CustomSelect value={filters.status}         onChange={(val) => handleFilterChange("status", val)}          options={STATUS_OPTIONS} />
              <CustomSelect value={filters.sortBy}         onChange={(val) => handleFilterChange("sortBy", val)}          options={SORT_OPTIONS} />
              <CustomSelect value={String(filters.limit)}  onChange={(val) => handleFilterChange("limit", Number(val))}   options={LIMIT_OPTIONS} />

              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                <button onClick={() => setViewMode("flat")}    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${viewMode === "flat"    ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>☰ Flat</button>
                <button onClick={() => setViewMode("grouped")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${viewMode === "grouped" ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>⊞ Grouped</button>
              </div>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-xl">
              <span className="text-sm font-semibold text-violet-700">{selected.size} selected</span>
              <button onClick={() => setBulkModal({ open: true, type: "approve" })} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">Approve All</button>
              <button onClick={() => setBulkModal({ open: true, type: "flag" })}    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-white transition-colors">Flag All</button>
              <button onClick={() => setBulkModal({ open: true, type: "remove" })}  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors">Remove All</button>
              <button onClick={clearSelection} className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition-colors">Clear selection</button>
            </div>
          )}

          {/* Select All Bar */}
          {!loading && comments.length > 0 && (
            <div className="flex items-center gap-2 mb-3 px-1">
              <input type="checkbox" checked={selected.size === comments.length} onChange={toggleSelectAll} className="w-4 h-4 rounded accent-violet-600 cursor-pointer" />
              <span className="text-xs text-slate-400 font-medium">{selected.size === comments.length ? "Deselect all" : "Select all on this page"}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => dispatch(fetchComments({ ...filters }))} className="text-xs underline hover:text-red-900 font-medium">Retry</button>
            </div>
          )}

          {/* Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {SKELETON_KEYS.map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : comments.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl py-20 flex flex-col items-center gap-3 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <p className="text-sm font-medium text-slate-500">No comments found</p>
              <p className="text-xs text-slate-400">Try adjusting your filters</p>
            </div>
          ) : viewMode === "grouped" ? (
            <div>
              {groupedComments.map(({ post, comments: groupComments }) => (
                <PostCommentGroup
                  key={post?.id ?? "unknown"}
                  post={post}
                  comments={groupComments}
                  selected={selected}
                  onSelect={toggleSelect}
                  onView={handleViewDetail}
                  onApprove={handleApprove}
                  onOpenPost={handleOpenPostPreview}
                  onFlag={handleFlag}
                  onRemove={handleRemove}
                  actionLoading={actionLoading}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {comments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  selected={selected.has(comment.id)}
                  onSelect={() => toggleSelect(comment.id)}
                  onView={handleViewDetail}
                  onApprove={handleApprove}
                  onFlag={handleFlag}
                  onRemove={handleRemove}
                  actionLoading={actionLoading}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 px-1">
              <p className="text-xs text-slate-400 font-medium">Page {currentPage} of {totalPages}</p>
              <div className="flex items-center gap-1">
                <button onClick={handlePrevPage} disabled={currentPage <= 1}       className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">← Prev</button>
                {pageButtons.map((page, i) => (
                  <button key={i} onClick={() => dispatch(setPage(page))}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${page === currentPage ? "bg-violet-600 text-white shadow-sm" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"}`}>
                    {page}
                  </button>
                ))}
                <button onClick={handleNextPage} disabled={currentPage >= totalPages} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next →</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}