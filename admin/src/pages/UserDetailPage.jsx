
import { useEffect, useState, useCallback, useRef, memo, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { UserDetailSkeleton } from "../components/skeletons";
import PostDetailModal from "../components/PostDetailmodal";
import {
  fetchUserById,
  fetchUserPosts,
  adminDeletePost,
  updateUserStatus,
  toggleVerifiedBadge,
  selectUserDetail,
  selectDetailLoading,
  selectPostsLoading,
  selectActionLoading,
} from "../lib/redux/usersSlice";
import { Calendar, MapPin, Tag, KeyRound } from "lucide-react";

// ─── Constants (module-level — never recreated) ───────────────────────────────

// FIX: was inside Avatar component, rebuilt every render
const AVATAR_COLORS = [
  "bg-pink-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-amber-500",
  "bg-emerald-500",
];

// FIX: stable skeleton key array — no inline [...Array(N)] allocations in render
const SKELETON_POST_KEYS = Array.from({ length: 12 }, (_, i) => i);

const STATUS_BADGE_MAP = {
  active:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  suspended:   "bg-amber-50 text-amber-700 border-amber-200",
  banned:      "bg-red-50 text-red-700 border-red-200",
  pending:     "bg-sky-50 text-sky-700 border-sky-200",
  deactivated: "bg-slate-100 text-slate-600 border-slate-200",
};
const DURATION_OPTIONS = [
  { value: "1d",   label: "1 Day"    },
  { value: "3d",   label: "3 Days"   },
  { value: "7d",   label: "7 Days"   },
  { value: "14d",  label: "14 Days"  },
  { value: "30d",  label: "30 Days"  },
  { value: "perm", label: "Permanent" },
];

// ─── Pure utilities ────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtCount(n = 0) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// FIX: guard against empty strings from double-spaces in name
function getInitials(name = "") {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")   // w[0] is undefined on "", fallback to ""
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// FIX: resolve once, return early — previous version re-evaluated src twice
function resolveThumb(post) {
  const media = post?.media?.[0];
  if (!media?.url) return null;

  const isVid =
    post.type === "reel" ||
    media.resourceType === "video" ||
    /\.(mp4|mov|webm|avi)$/i.test(media.url);

  if (!isVid) return media.url;

  if (media.thumbnailUrl) return media.thumbnailUrl;

  // Cloudinary video → JPEG thumbnail transform
  const cloudinaryThumb = media.url
    .replace("/upload/", "/upload/so_0,w_400,h_400,c_fill,f_jpg,q_auto/")
    .replace(/\.(mp4|mov|webm|avi)$/i, ".jpg");

  // Only use the transformed URL if it actually changed (i.e. it's a Cloudinary URL)
  return cloudinaryThumb !== media.url ? cloudinaryThumb : media.url;
}

// ─── Sub-components (all memoized) ────────────────────────────────────────────

const Avatar = memo(function Avatar({ user, size = 56 }) {
  // FIX: AVATAR_COLORS is module-level; color derived once per render, not per array alloc
  const color = AVATAR_COLORS[(user?.username?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
  const s     = `${size}px`;
  // FIX: resolve src once — original checked condition with || then re-evaluated in src={}
  const src   = user?.profilePicture || user?.avatar?.url;

  if (src) {
    return (
      <img
        src={src}
        alt={user.username}
        style={{ width: s, height: s }}
        className="rounded-full object-cover ring-4 ring-white shadow-md shrink-0"
      />
    );
  }
  return (
    <div
      style={{ width: s, height: s, fontSize: size * 0.35 }}
      className={`${color} rounded-full flex items-center justify-center font-bold text-white ring-4 ring-white shadow-md shrink-0`}
    >
      {getInitials(user?.fullName || user?.username || "?")}
    </div>
  );
});

const StatusBadge = memo(function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border
        ${STATUS_BADGE_MAP[status] ?? STATUS_BADGE_MAP.active}`}
    >
      {status}
    </span>
  );
});

const StatBox = memo(function StatBox({ label, value, color = "text-slate-800" }) {
  return (
    <div className="bg-slate-50 rounded-xl px-4 py-3 text-center border border-slate-100">
      <p className={`text-xl font-bold ${color}`}>{fmtCount(value ?? 0)}</p>
      <p className="text-xs text-slate-400 font-medium mt-0.5">{label}</p>
    </div>
  );
});

// ─── Post thumbnail ────────────────────────────────────────────────────────────

const PostTile = memo(function PostTile({ post, onDelete, onClick }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const reasonRef = useRef("");
  const isText = post.type === "text";
  const isVid  = post.type === "reel" || post.media?.[0]?.resourceType === "video";
  const thumb  = resolveThumb(post);

  // FIX: onDelete is stable (useCallback in parent) so this dep is safe
  const handleConfirmDelete = useCallback((e) => {
    e.stopPropagation();
    const reason = reasonRef.current?.trim() || "Violation of community guidelines";
    onDelete(post._id, reason);
    setConfirmDel(false);
  }, [onDelete, post._id]);

  return (
    <div
      className="relative group rounded-xl overflow-hidden border border-slate-100 bg-slate-50"
      style={{ paddingBottom: "100%", height: 0 }}
      onClick={onClick}
    >
      <div className="absolute inset-0">

        {isText ? (
          <div
            className="w-full h-full p-3 flex items-start"
            style={{ background: "linear-gradient(135deg, #f5ece0, #fdf9f5)" }}
          >
            <p className="text-xs text-slate-700 leading-relaxed line-clamp-5">
              {post.caption || "—"}
            </p>
          </div>
        ) : thumb ? (
          <img
            src={thumb}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              if (e.currentTarget.parentNode) {
                (e.currentTarget.parentNode).style.background = "#e2e8f0";
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-200">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
        )}

        {isVid && (
          <div className="absolute top-1.5 right-1.5 bg-black/50 rounded-full p-1">
            <svg className="w-3 h-3 text-white fill-white" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50
          transition-all duration-200 flex flex-col items-center justify-center gap-2
          opacity-0 group-hover:opacity-100"
        >
          <div className="flex gap-3 text-white text-xs font-semibold">
            <span>❤ {post.likesCount ?? 0}</span>
            <span>💬 {post.commentsCount ?? 0}</span>
          </div>
          <p className="text-white text-[10px] px-2 text-center opacity-70">
            {formatDate(post.createdAt)}
          </p>
          {/* FIX: type="button" on all buttons */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setConfirmDel(true); }}
            className="mt-1 flex items-center gap-1 bg-red-500 hover:bg-red-600
              text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Delete
          </button>
        </div>
      </div>

      {confirmDel && (
        <div className="absolute inset-0 z-10 bg-white/95 flex flex-col items-center
          justify-center gap-3 p-3 rounded-xl"
        >
          <p className="text-xs font-bold text-slate-800 text-center">Delete this post?</p>
          <input
            type="text"
            placeholder="Reason (optional)"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onChange={(e) => { reasonRef.current = e.target.value; }}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200
              text-xs text-slate-700 placeholder-slate-400
              focus:outline-none focus:border-red-300 transition-colors"
          />
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setConfirmDel(false); }}
              className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs
                font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="flex-1 py-1.5 rounded-lg bg-red-500 hover:bg-red-600
                text-white text-xs font-bold transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Status change modal ───────────────────────────────────────────────────────

// const StatusModal = memo(function StatusModal({ user, onClose, onConfirm, loading }) {
//   const [status, setStatus] = useState("");
//   const [reason, setReason] = useState("");

//   // FIX: useMemo — opts was rebuilt every render
//   const opts = useMemo(
//     () => ["active", "suspended", "banned", "deactivated"].filter((s) => s !== user?.status),
//     [user?.status],
//   );

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
//       <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
//       <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
//         <h3 className="text-sm font-bold text-slate-800 mb-1">Change Account Status</h3>
//         <p className="text-xs text-slate-400 mb-4">@{user?.username}</p>
//         <div className="space-y-2 mb-4">
//           {opts.map((opt) => (
//             <label
//               key={opt}
//               className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors
//                 ${status === opt ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:border-slate-300"}`}
//             >
//               <input
//                 type="radio"
//                 name="status"
//                 value={opt}
//                 checked={status === opt}
//                 onChange={() => setStatus(opt)}
//                 className="accent-violet-600"
//               />
//               <span className="text-sm font-semibold capitalize text-slate-700">{opt}</span>
//             </label>
//           ))}
//         </div>
//         <textarea
//           value={reason}
//           onChange={(e) => setReason(e.target.value)}
//           placeholder="Reason (optional)"
//           rows={2}
//           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm
//             text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:border-violet-400 mb-4"
//         />
//         <div className="flex gap-3">
//           {/* FIX: type="button" on all buttons */}
//           <button
//             type="button"
//             onClick={onClose}
//             className="flex-1 py-2 rounded-xl bg-slate-100 text-sm font-semibold text-slate-600 hover:bg-slate-200"
//           >
//             Cancel
//           </button>
//           <button
//             type="button"
//             onClick={() => onConfirm({ status, reason })}
//             disabled={!status || loading}
//             className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm
//               font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
//           >
//             {loading && (
//               <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
//                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
//                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
//               </svg>
//             )}
//             Update
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// });

const StatusModal = memo(function StatusModal({ user, onClose, onConfirm, loading }) {
  const [status,   setStatus]   = useState("");
  const [reason,   setReason]   = useState("");
  const [duration, setDuration] = useState("7d");

  const opts = useMemo(
    () => ["active", "suspended", "banned", "deactivated"].filter((s) => s !== user?.status),
    [user?.status],
  );

  const needsDuration = status === "suspended";
  const canSubmit = Boolean(status && reason.trim() && (!needsDuration || duration));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-sm font-bold text-slate-800 mb-1">Change Account Status</h3>
        <p className="text-xs text-slate-400 mb-4">@{user?.username}</p>
        <div className="space-y-2 mb-4">
          {opts.map((opt) => (
            <label
              key={opt}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                ${status === opt ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:border-slate-300"}`}
            >
              <input
                type="radio"
                name="status"
                value={opt}
                checked={status === opt}
                onChange={() => setStatus(opt)}
                className="accent-violet-600"
              />
              <span className="text-sm font-semibold capitalize text-slate-700">{opt}</span>
            </label>
          ))}
        </div>

        {needsDuration && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
              Duration <span className="text-red-400">*</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDuration(d.value)}
                  className={`rounded-xl border py-2 px-2 text-center text-xs font-semibold transition-all
                    ${duration === d.value
                      ? "border-violet-400 bg-violet-50 text-violet-700"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-600"}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required)"
          rows={2}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm
            text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:border-violet-400 mb-4"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-slate-100 text-sm font-semibold text-slate-600 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ status, reason, duration: needsDuration ? duration : undefined })}
            disabled={!canSubmit || loading}
            className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm
              font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            Update
          </button>
        </div>
      </div>
    </div>
  );
});
// ─── Error state ──────────────────────────────────────────────────────────────

const ErrorState = memo(function ErrorState({ onRetry }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-1">Failed to load user</p>
        <p className="text-xs text-slate-400 mb-4">Something went wrong while fetching user details.</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-500 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
});

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UserDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const detail        = useSelector(selectUserDetail);
  const detailLoading = useSelector(selectDetailLoading);
  const postsLoading  = useSelector(selectPostsLoading);
  const actionLoading = useSelector(selectActionLoading);

  const [toast,        setToast]        = useState(null);
  const [statusModal,  setStatusModal]  = useState(false);
  const [postsPage,    setPostsPage]    = useState(1);
  const [selectedPost, setSelectedPost] = useState(null);
  const [fetchError,   setFetchError]   = useState(false);

  // FIX: ref for timer — prevents memory leak when component unmounts mid-countdown
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, type = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // ── Fetch user detail ────────────────────────────────────────

  const loadUser = useCallback(async () => {
    setFetchError(false);
    // FIX: use RTK's rejected action check — res.meta.requestStatus is the correct field
    const res = await dispatch(fetchUserById(id));
    if (res.meta?.requestStatus === "rejected") setFetchError(true);
  }, [id, dispatch]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // ── Fetch posts when page changes ────────────────────────────

  useEffect(() => {
    dispatch(fetchUserPosts({ userId: id, page: postsPage, limit: 18 }));
  }, [id, postsPage, dispatch]);

  // ── Action handlers ──────────────────────────────────────────

  // const handleStatusConfirm = useCallback(async ({ status, reason }) => {
  //   const res = await dispatch(updateUserStatus({ userId: id, status, reason }));
  //   if (res.meta?.requestStatus !== "rejected") {
  //     showToast(`Status updated to ${status}`);
  //     setStatusModal(false);
  //     dispatch(fetchUserById(id));
  //   } else {
  //     showToast("Failed to update status", "error");
  //   }
  // }, [dispatch, id, showToast]);

  const handleStatusConfirm = useCallback(async ({ status, reason, duration }) => {
  const res = await dispatch(updateUserStatus({ userId: id, status, reason, duration }));
  if (res.meta?.requestStatus !== "rejected") {
    showToast(`Status updated to ${status}`);
    setStatusModal(false);
    dispatch(fetchUserById(id));
  } else {
    showToast("Failed to update status", "error");
  }
}, [dispatch, id, showToast]);

  const handleToggleVerify = useCallback(async () => {
    const res = await dispatch(toggleVerifiedBadge(id));
    if (res.meta?.requestStatus !== "rejected") showToast("Verified badge updated");
    else showToast("Failed to update badge", "error");
  }, [dispatch, id, showToast]);

  // FIX: stable reference — PostTile's useCallback depends on this
  const handleDeletePost = useCallback(async (postId, reason) => {
    const res = await dispatch(adminDeletePost({
      postId,
      reason: reason || "Violation of community guidelines",
    }));
    if (res.meta?.requestStatus !== "rejected") showToast("Post deleted");
    else showToast("Failed to delete post", "error");
  }, [dispatch, showToast]);

  // FIX: stable close handler for PostDetailModal — avoids inline arrow on every render
  const handleClosePost = useCallback(() => setSelectedPost(null), []);

  const handleModalDelete = useCallback(async (postId, reason) => {
    await handleDeletePost(postId, reason);
    setSelectedPost(null);
  }, [handleDeletePost]);

  // ── FIX: actionLoading is boolean — cast once, don't compare to id string ──
  const isActioning = Boolean(actionLoading);

  // ── Guards ───────────────────────────────────────────────────
  if (detailLoading) return <UserDetailSkeleton />;
  if (fetchError)    return <ErrorState onRetry={loadUser} />;
  if (!detail)       return <UserDetailSkeleton />;

  // FIX: guard user explicitly — if API returns detail without user, render below would throw
  const { user, posts = [], reportStats = {}, postsPagination = {} } = detail;
  if (!user) return <ErrorState onRetry={loadUser} />;

  const totalPostPages = postsPagination.totalPages ?? 1;

  return (
    <>
      {/* FIX: z-[100] — z-100 is not a valid Tailwind class */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-xl text-sm
            font-semibold shadow-lg border ${
              toast.type === "error"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
        >
          {toast.msg}
        </div>
      )}

      <PostDetailModal
        post={selectedPost}
        onClose={handleClosePost}
        onDelete={handleModalDelete}
        deleteLoading={isActioning}
        hideAuthorNav={true}
      />

      {statusModal && (
        <StatusModal
          user={user}
          onClose={() => setStatusModal(false)}
          onConfirm={handleStatusConfirm}
          loading={isActioning}
        />
      )}

      <div className="min-h-screen bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs mb-6">
            <button
              type="button"
              onClick={() => navigate("/users")}
              className="text-slate-400 hover:text-violet-600 font-medium transition-colors"
            >
              Users
            </button>
            <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
            <span className="text-slate-700 font-semibold truncate max-w-48">
              {user.fullName || user.username || "..."}
            </span>
          </nav>

          {/* ── User Profile Card ── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-5">

              <Avatar user={user} size={72} />

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold text-slate-800">{user.fullName}</h1>
                  {user.isVerified && (
                    <svg className="w-5 h-5 text-sky-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  )}
                  <StatusBadge status={user.status ?? user.accountStatus} />
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 capitalize">
                    {user.role}
                  </span>
                </div>

                <p className="text-sm text-slate-400 mb-1">@{user.username}</p>
                <p className="text-sm text-slate-500 mb-3">{user.email}</p>

                <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar size={13} className="text-slate-400" />
                    Joined {formatDate(user.createdAt)}
                  </span>
                  {user.location?.city && (
                    <span className="flex items-center gap-1">
                      <MapPin size={13} className="text-slate-400" />
                      {user.location.city}
                    </span>
                  )}
                  {user.businessCategory && (
                    <span className="flex items-center gap-1">
                      <Tag size={13} className="text-slate-400" />
                      {user.businessCategory}
                    </span>
                  )}
                  {user.authProvider && (
                    <span className="flex items-center gap-1">
                      <KeyRound size={13} className="text-slate-400" />
                      {user.authProvider}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setStatusModal(true)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-50
                    hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors"
                >
                  Change Status
                </button>
                <button
                  type="button"
                  onClick={handleToggleVerify}
                  disabled={isActioning}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-50
                    hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors
                    disabled:opacity-40"
                >
                  {user.isVerified ? "Remove Badge" : "Verify Badge"}
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
              <StatBox label="Posts"           value={user.postsCount}     color="text-violet-600" />
              <StatBox label="Followers"       value={user.followersCount} color="text-sky-600" />
              <StatBox label="Following"       value={user.followingCount} color="text-slate-800" />
              <StatBox label="Reports"         value={reportStats.total}   color="text-amber-600" />
              <StatBox label="Pending Reports" value={reportStats.pending} color="text-red-600" />
            </div>
          </div>

          {/* ── Posts Section ── */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-800">Posts</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {user.postsCount ?? 0} total • hover to delete
                </p>
              </div>
              {postsLoading && (
                <svg className="w-5 h-5 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
            </div>

            <div className="p-4">
              {posts.length === 0 && !postsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-500">No posts yet</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {postsLoading
                      // FIX: SKELETON_POST_KEYS is module-level — no inline array allocation
                      ? SKELETON_POST_KEYS.map((i) => (
                          <div
                            key={i}
                            style={{ paddingBottom: "100%", height: 0 }}
                            className="relative rounded-xl overflow-hidden"
                          >
                            <div className="absolute inset-0 bg-slate-100 animate-pulse rounded-xl" />
                          </div>
                        ))
                      : posts.map((post) => (
                          <PostTile
                            key={post._id}
                            post={post}
                            onDelete={handleDeletePost}
                            onClick={() => setSelectedPost({ ...post, author: post.author ?? user })}
                          />
                        ))
                    }
                  </div>

                  {totalPostPages > 1 && (
                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                      <p className="text-xs text-slate-400">
                        Page {postsPage} of {totalPostPages}
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPostsPage((p) => Math.max(1, p - 1))}
                          disabled={postsPage <= 1}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white
                            border border-slate-200 hover:bg-slate-50 text-slate-600
                            disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          ← Prev
                        </button>
                        <button
                          type="button"
                          onClick={() => setPostsPage((p) => Math.min(totalPostPages, p + 1))}
                          disabled={postsPage >= totalPostPages}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white
                            border border-slate-200 hover:bg-slate-50 text-slate-600
                            disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          Next →
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
    </>
  );
}