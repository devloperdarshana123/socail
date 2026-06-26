

import { useEffect, useState, useCallback, useRef, memo, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import CustomSelect from "../components/CustomSelect";
import {
  fetchUsers, updateUserStatus, toggleVerifiedBadge, deleteUser,
  setFilters, setPage, clearErrors, resetFilters, bulkUpdateStatus,
  selectUsers, selectUsersLoading, selectUsersError,
  selectActionLoading, selectActionError,
  selectUsersPagination, selectUsersFilters,
} from "../lib/redux/usersSlice";
import { UsersTableSkeleton } from "../components/skeletons";

// ─── Constants (module-level — never recreated) ───────────────────────────────

const AVATAR_COLORS = [
  "bg-pink-500", "bg-violet-500", "bg-cyan-500",
  "bg-amber-500", "bg-emerald-500", "bg-rose-500", "bg-indigo-500",
];

const AVATAR_SIZES = {
  sm: "w-8 h-8 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base",
};

const STATUS_BADGE_MAP = {
  active:    { cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500", label: "Active"    },
  suspended: { cls: "bg-amber-50 text-amber-700 border border-amber-200",       dot: "bg-amber-500",   label: "Suspended" },
  banned:    { cls: "bg-red-50 text-red-700 border border-red-200",             dot: "bg-red-500",     label: "Banned"    },
};

const ROLE_BADGE_MAP = {
  user:      "bg-slate-100 text-slate-600 border border-slate-200",
  moderator: "bg-violet-50 text-violet-700 border border-violet-200",
};

const STAT_ACCENTS = {
  blue:    { card: "bg-blue-50 border-blue-100",     icon: "text-blue-500",    iconBg: "bg-blue-100"    },
  violet:  { card: "bg-violet-50 border-violet-100", icon: "text-violet-500",  iconBg: "bg-violet-100"  },
  emerald: { card: "bg-emerald-50 border-emerald-100",icon: "text-emerald-500",iconBg: "bg-emerald-100" },
  amber:   { card: "bg-amber-50 border-amber-100",   icon: "text-amber-500",   iconBg: "bg-amber-100"   },
};

const DURATION_PRESETS = [
  { value: "1d",   label: "1 Day",     desc: "Minor violation" },
  { value: "3d",   label: "3 Days",    desc: "Repeat offense"  },
  { value: "7d",   label: "7 Days",    desc: "Serious violation"},
  { value: "14d",  label: "14 Days",   desc: "Severe behavior" },
  { value: "30d",  label: "30 Days",   desc: "Critical breach" },
  { value: "perm", label: "Permanent", desc: "No expiry", danger: true },
];

const DAYS_MAP = { "1d": 1, "3d": 3, "7d": 7, "14d": 14, "30d": 30 };

// ─── Pure utilities ────────────────────────────────────────────────────────────

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

// FIX: guard against empty string from double-spaces (w[0] on "" → undefined)
function getInitials(name = "") {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function parseDays(val) {
  return DAYS_MAP[val] ?? 0;
}

// ─── Shared UI primitives (all memoized) ──────────────────────────────────────

const StatusBadge = memo(function StatusBadge({ status }) {
  const s = STATUS_BADGE_MAP[status] ?? STATUS_BADGE_MAP.active;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
});

const RoleBadge = memo(function RoleBadge({ role }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_BADGE_MAP[role] ?? ROLE_BADGE_MAP.user}`}>
      {role === "moderator" ? "Moderator" : "User"}
    </span>
  );
});

// const Avatar = memo(function Avatar({ user, size = "md" }) {
//   const color = AVATAR_COLORS[(user?.username?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
//   if (user?.profilePicture) {
//     return (
//       <img
//         src={user.profilePicture}
//         alt={user.username}
//         className={`${AVATAR_SIZES[size]} rounded-full object-cover ring-2 ring-white shadow-sm`}
//       />
//     );
//   }
//   return (
//     <div className={`${AVATAR_SIZES[size]} ${color} rounded-full flex items-center justify-center font-bold text-white ring-2 ring-white shadow-sm shrink-0`}>
//       {getInitials(user?.fullName || user?.username || "?")}
//     </div>
//   );
// });

// BAAD:
const Avatar = memo(function Avatar({ user, size = "md", onClick }) {
  const color = AVATAR_COLORS[(user?.username?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
  if (user?.profilePicture) {
    return (
      <img
        src={user.profilePicture}
        alt={user.username}
        onClick={onClick}
        className={`${AVATAR_SIZES[size]} rounded-full object-cover ring-2 ring-white shadow-sm ${onClick ? "cursor-pointer" : ""}`}
      />
    );
  }
  return (
    <div
      onClick={onClick}
      className={`${AVATAR_SIZES[size]} ${color} rounded-full flex items-center justify-center font-bold text-white ring-2 ring-white shadow-sm shrink-0 ${onClick ? "cursor-pointer" : ""}`}
    >
      {getInitials(user?.fullName || user?.username || "?")}
    </div>
  );
});
const StatCard = memo(function StatCard({ label, value, icon, accent }) {
  const a = STAT_ACCENTS[accent] ?? STAT_ACCENTS.blue;
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

const ConfirmModal = memo(function ConfirmModal({
  isOpen, onClose, onConfirm, title, message,
  confirmLabel = "Confirm", danger = false, loading = false,
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
        <h3 className="text-base font-semibold text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2
              ${danger ? "bg-red-600 hover:bg-red-500 text-white" : "bg-violet-600 hover:bg-violet-500 text-white"}`}
          >
            {loading && <SpinIcon />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Shared spinner (eliminates the 5 identical inline SVGs) ─────────────────

function SpinIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Shared duration grid (was copy-pasted between SuspendModal + BulkActionModal) ─

const DurationGrid = memo(function DurationGrid({ duration, onChange }) {
  // FIX: expiry label computed once per duration selection, not inside map
  const selected = DURATION_PRESETS.find((p) => p.value === duration);

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Duration</p>
      <div className="grid grid-cols-3 gap-2">
        {DURATION_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className={`rounded-xl border py-2.5 px-2 text-center transition-all ${
              duration === p.value
                ? p.danger ? "border-red-400 bg-red-50" : "border-violet-400 bg-violet-50"
                : "border-slate-200 hover:border-slate-300 bg-slate-50"
            }`}
          >
            <p className={`text-sm font-bold ${
              duration === p.value
                ? p.danger ? "text-red-600" : "text-violet-700"
                : "text-slate-700"
            }`}>
              {p.label}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">{p.desc}</p>
          </button>
        ))}
      </div>
      {selected && (
        <p className="text-xs text-slate-400 mt-2 text-center">
          {selected.value === "perm"
            ? "⚠️ Permanent — cannot auto-expire"
            : `Expires: ${new Date(Date.now() + parseDays(selected.value) * 86_400_000)
                .toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
          }
        </p>
      )}
    </div>
  );
});

// ─── SuspendModal ─────────────────────────────────────────────────────────────

const SuspendModal = memo(function SuspendModal({ isOpen, onClose, onConfirm, user, loading }) {
  const [duration, setDuration] = useState("7d");
  const [reason,   setReason]   = useState("");
  const [action,   setAction]   = useState("suspend");

  useEffect(() => {
    if (isOpen && user) {
      setDuration("7d");
      setReason("");
      setAction(user.accountStatus === "suspended" ? "lift" : "suspend");
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const isSuspended = user.accountStatus === "suspended";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">

        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Avatar user={user} size="md" />
            <div>
              <p className="text-sm font-bold text-slate-800">{user.fullName || user.username}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-slate-400">@{user.username}</p>
                <StatusBadge status={user.accountStatus} />
              </div>
            </div>
          </div>

          <div className="flex gap-1 mt-4 bg-slate-100 rounded-xl p-1">
            {isSuspended ? (
              <button
                type="button"
                onClick={() => setAction("lift")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all
                  ${action === "lift" ? "bg-white shadow-sm text-emerald-600" : "text-slate-500 hover:text-slate-700"}`}
              >
                Lift Suspension
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAction("suspend")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all
                  ${action === "suspend" ? "bg-white shadow-sm text-amber-600" : "text-slate-500 hover:text-slate-700"}`}
              >
                Suspend
              </button>
            )}
            <button
              type="button"
              onClick={() => setAction("ban")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${action === "ban" ? "bg-white shadow-sm text-red-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              Ban
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {action === "suspend" && (
            <DurationGrid duration={duration} onChange={setDuration} />
          )}

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
              Reason {action !== "lift" && <span className="text-red-400">*</span>}
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={
                action === "lift"    ? "Reason for lifting (optional)" :
                action === "ban"     ? "Reason for permanent ban…"     :
                "Describe the violation…"
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm
                text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:border-violet-400"
            />
          </div>

          {isSuspended && user.activeSuspension?.expiresAt && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-amber-700">Current Suspension</p>
              <p className="text-xs text-amber-600 mt-1">{user.activeSuspension.reason}</p>
              <p className="text-xs text-amber-500 mt-1">
                Expires: {new Date(user.activeSuspension.expiresAt)
                  .toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ action, duration, reason })}
            disabled={(action !== "lift" && !reason.trim()) || loading}
            className={`px-5 py-2 rounded-xl text-sm font-medium text-white transition-colors
              disabled:opacity-50 flex items-center gap-2 ${
                action === "ban"  ? "bg-red-600 hover:bg-red-500"     :
                action === "lift" ? "bg-emerald-600 hover:bg-emerald-500" :
                "bg-amber-500 hover:bg-amber-400"
              }`}
          >
            {loading && <SpinIcon />}
            {action === "lift" ? "Lift Suspension" : action === "ban" ? "Ban Account" : "Suspend"}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── BulkActionModal ──────────────────────────────────────────────────────────

const BulkActionModal = memo(function BulkActionModal({
  isOpen, onClose, onConfirm, count, actionType, loading,
}) {
  const [duration, setDuration] = useState("7d");
  const [reason,   setReason]   = useState("");

  useEffect(() => {
    if (isOpen) { setDuration("7d"); setReason(""); }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">

        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                {actionType === "lift" ? "Bulk Lift Suspension" : "Bulk Suspend"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {count} user{count > 1 ? "s" : ""} will be {actionType === "lift" ? "unsuspended" : "suspended"}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* FIX: reuse DurationGrid instead of copy-pasted markup */}
          {actionType !== "lift" && (
            <DurationGrid duration={duration} onChange={setDuration} />
          )}

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
              Reason <span className="text-red-400">*</span>
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Reason for bulk suspension…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm
                text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:border-violet-400"
            />
          </div>

          <div className={`border rounded-xl px-4 py-3 ${
            actionType === "lift" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
          }`}>
            <p className={`text-xs font-medium ${actionType === "lift" ? "text-emerald-600" : "text-red-600"}`}>
              {actionType === "lift"
                ? `✅ This will lift suspension for ${count} user${count > 1 ? "s" : ""}. This action is logged.`
                : `⚠️ This will suspend ${count} user${count > 1 ? "s" : ""} at once. This action is logged.`}
            </p>
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ duration, reason, actionType })}
            disabled={(actionType !== "lift" && !reason.trim()) || loading}
            className={`px-5 py-2 rounded-xl text-sm font-medium text-white transition-colors
              disabled:opacity-50 flex items-center gap-2
              ${actionType === "lift" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-amber-500 hover:bg-amber-400"}`}
          >
            {loading && <SpinIcon />}
            {actionType === "lift"
              ? `Lift ${count} Suspension${count > 1 ? "s" : ""}`
              : `Suspend ${count} User${count > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── UserRowMenu ──────────────────────────────────────────────────────────────

const UserRowMenu = memo(function UserRowMenu({
  user, onStatusChange, onToggleVerify, onDelete, actionLoading,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isLoading = actionLoading === user.id;

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isLoading}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
      >
        {isLoading
          ? <svg className="w-4 h-4 animate-spin text-violet-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
            </svg>
        }
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
          <button
            type="button"
            onClick={() => { setOpen(false); onStatusChange(user); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Change Status
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onToggleVerify(user.id); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z"/>
            </svg>
            {user.isVerified ? "Remove Verified" : "Mark Verified"}
          </button>
          <div className="border-t border-slate-100 my-1" />
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete(user); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Delete Account
          </button>
        </div>
      )}
    </div>
  );
});

// ─── SortIcon — defined outside page so it never re-creates on page re-render ─

// FIX: was defined inside UsersPage body — new function reference every render
function SortIcon({ col, sortBy, sortOrder }) {
  if (sortBy !== col) return <span className="text-slate-300 ml-1">↕</span>;
  return <span className="text-violet-500 ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>;
}

// ─── Pagination helper — stable page array, no duplicate keys ────────────────

// FIX: inline pagination logic produced duplicate `page` values when using index as key
function buildPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set([1, totalPages]);
  for (let d = -2; d <= 2; d++) {
    const p = currentPage + d;
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  // Sort and insert ellipsis markers (null)
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push(null); // gap
    result.push(sorted[i]);
  }
  return result;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const users         = useSelector(selectUsers);
  const loading       = useSelector(selectUsersLoading);
  const error         = useSelector(selectUsersError);
  const actionLoading = useSelector(selectActionLoading);
  const actionError   = useSelector(selectActionError);
  const { totalUsers, totalPages, currentPage } = useSelector(selectUsersPagination);
  const filters = useSelector(selectUsersFilters);

  const [searchInput,  setSearchInput]  = useState(filters.search);
  const [statusModal,  setStatusModal]  = useState({ open: false, user: null });
  const [deleteModal,  setDeleteModal]  = useState({ open: false, user: null });
  const [deleteLoading,setDeleteLoading]= useState(false);
  const [toast,        setToast]        = useState(null);
  const [selected,     setSelected]     = useState(new Set());
  const [bulkModal,    setBulkModal]    = useState({ open: false, type: "suspend" });
  const [bulkLoading,  setBulkLoading]  = useState(false);

  const debouncedSearch = useDebounce(searchInput, 450);

  // FIX: timer ref to prevent memory leak on unmount
  const toastTimer = useRef(null);

  const showToast = useCallback((message, type = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // ── Fetch on filter change ────────────────────────────────────
  useEffect(() => {
    dispatch(fetchUsers({
      search:    filters.search,
      role:      filters.role      || undefined,
      status:    filters.status    || undefined,
      verified:  filters.verified  || undefined,
      sortBy:    filters.sortBy,
      sortOrder: filters.sortOrder,
      page:      filters.page,
      limit:     filters.limit,
    }));
  }, [dispatch, filters]);

  // FIX: added missing deps (filters.search, dispatch)
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      dispatch(setFilters({ search: debouncedSearch, page: 1 }));
    }
  }, [debouncedSearch, filters.search, dispatch]);

  // FIX: added missing deps (showToast, dispatch)
  useEffect(() => {
    if (actionError) {
      showToast(actionError, "error");
      dispatch(clearErrors());
    }
  }, [actionError, showToast, dispatch]);

  // ── Selection helpers (stable refs via useCallback) ──────────
  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === users.length ? new Set() : new Set(users.map((u) => u.id)),
    );
  }, [users]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  // ── Filter / sort helpers ────────────────────────────────────
  const handleFilterChange = useCallback((key, value) => {
    dispatch(setFilters({ [key]: value, page: 1 }));
  }, [dispatch]);

  const handleSort = useCallback((col) => {
    if (filters.sortBy === col) {
      dispatch(setFilters({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" }));
    } else {
      dispatch(setFilters({ sortBy: col, sortOrder: "desc" }));
    }
  }, [dispatch, filters.sortBy, filters.sortOrder]);

  // ── Action handlers ──────────────────────────────────────────

  // FIX: res.meta?.requestStatus — RTK thunk rejection check (same as previous reviews)
  const handleStatusConfirm = useCallback(async ({ action, duration, reason }) => {
    const statusMap = { suspend: "suspended", lift: "active", ban: "banned" };
    const res = await dispatch(updateUserStatus({
      userId:   statusModal.user.id,
      status:   statusMap[action],
      reason,
      duration: action === "suspend" ? duration : undefined,
    }));
    if (res.meta?.requestStatus !== "rejected") {
      showToast(
        action === "lift"    ? `@${statusModal.user.username} suspension lifted` :
        action === "ban"     ? `@${statusModal.user.username} banned`            :
                               `@${statusModal.user.username} suspended`,
      );
      setStatusModal({ open: false, user: null });
    } else {
      showToast("Failed to update status", "error");
    }
  }, [dispatch, statusModal.user, showToast]);

  const handleDeleteConfirm = useCallback(async () => {
    setDeleteLoading(true);
    const res = await dispatch(deleteUser(deleteModal.user.id));
    setDeleteLoading(false);
    if (res.meta?.requestStatus !== "rejected") {
      showToast(`@${deleteModal.user.username} deleted`);
      setDeleteModal({ open: false, user: null });
    } else {
      showToast("Failed to delete user", "error");
    }
  }, [dispatch, deleteModal.user, showToast]);

  const handleBulkConfirm = useCallback(async ({ duration, reason, actionType }) => {
    setBulkLoading(true);
    const res = await dispatch(bulkUpdateStatus({
      userIds:  Array.from(selected),
      status:   actionType === "lift" ? "active" : "suspended",
      duration: actionType === "lift" ? undefined : duration,
      reason,
    }));
    setBulkLoading(false);

    if (res.meta?.requestStatus !== "rejected") {
      // FIX: null-guard payload before destructuring
      const { success = [], failed = [] } = res.payload?.data ?? {};
      const word = actionType === "lift" ? "unsuspended" : "suspended";
      showToast(
        failed.length > 0
          ? `${success.length} ${word}, ${failed.length} failed`
          : `${success.length} user${success.length !== 1 ? "s" : ""} ${word}`,
      );
      clearSelection();
      setBulkModal({ open: false, type: "suspend" });
      dispatch(fetchUsers({ ...filters }));
    } else {
      showToast("Bulk action failed", "error");
    }
  }, [dispatch, selected, filters, showToast, clearSelection]);

  const handleToggleVerify = useCallback(async (userId) => {
    const res = await dispatch(toggleVerifiedBadge(userId));
    if (res.meta?.requestStatus !== "rejected") {
      const u = users.find((x) => x._id === userId);
      showToast(`@${u?.username} ${u?.isVerified ? "unverified" : "verified"}`);
    } else {
      showToast("Failed to update badge", "error");
    }
  }, [dispatch, users, showToast]);

  // ── Derived stats (useMemo — only recalc when users changes) ─
  // FIX: was three separate .filter() passes on every render
  const { activeCount, verifiedCount, suspendedCount } = useMemo(() => {
    let active = 0, verified = 0, suspended = 0;
    for (const u of users) {
      if (u.status === "active")                               active++;
      if (u.isVerified)                                        verified++;
      if (u.status === "suspended" || u.status === "banned")  suspended++;
    }
    return { activeCount: active, verifiedCount: verified, suspendedCount: suspended };
  }, [users]);

  // ── Pagination page list (memoized) ──────────────────────────
  const pageNumbers = useMemo(
    () => buildPageNumbers(currentPage, totalPages),
    [currentPage, totalPages],
  );

  return (
    <>
      {/* FIX: z-[100] — z-100 is not a valid Tailwind arbitrary class */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-xl text-sm font-semibold shadow-lg border ${
          toast.type === "error"
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-emerald-50 border-emerald-200 text-emerald-700"
        }`}>
          {toast.message}
        </div>
      )}

      <SuspendModal
        isOpen={statusModal.open}
        user={statusModal.user}
        onClose={() => setStatusModal({ open: false, user: null })}
        onConfirm={handleStatusConfirm}
        loading={actionLoading === statusModal.user?.id}
      />
      <BulkActionModal
        isOpen={bulkModal.open}
        onClose={() => setBulkModal({ open: false, type: "suspend" })}
        onConfirm={handleBulkConfirm}
        count={selected.size}
        actionType={bulkModal.type}
        loading={bulkLoading}
      />
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, user: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Account"
        message={`Permanently delete @${deleteModal.user?.username}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleteLoading}
      />

      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">

          {/* Header */}
          <div className="flex items-center justify-between mb-7">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">Users</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {loading ? "Loading…" : `${totalUsers.toLocaleString()} total users`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { dispatch(resetFilters()); setSearchInput(""); }}
              className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors border border-slate-200 bg-white rounded-lg px-3 py-2 hover:bg-slate-50"
            >
              Reset filters
            </button>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
            <StatCard
              label="Total Users"
              value={loading ? "—" : totalUsers.toLocaleString()}
              accent="blue"
              icon={<svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20H7m10 0v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2m14-10a4 4 0 11-8 0 4 4 0 018 0z"/></svg>}
            />
            <StatCard
              label="Active"
              value={loading ? "—" : activeCount}
              accent="emerald"
              icon={<svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            />
            <StatCard
              label="Verified"
              value={loading ? "—" : verifiedCount}
              accent="violet"
              icon={<svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z"/></svg>}
            />
            <StatCard
              label="Restricted"
              value={loading ? "—" : suspendedCount}
              accent="amber"
              icon={<svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>}
            />
          </div>

          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 mb-5 shadow-sm">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-55 max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search name, username, email…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => { setSearchInput(""); dispatch(setFilters({ search: "", page: 1 })); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
              <CustomSelect value={filters.role}     onChange={(val) => handleFilterChange("role", val)}     options={[{ value: "", label: "All Roles" }, { value: "user", label: "User" }, { value: "moderator", label: "Moderator" }]} />
              <CustomSelect value={filters.status}   onChange={(val) => handleFilterChange("status", val)}   options={[{ value: "", label: "All Statuses" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "banned", label: "Banned" }]} />
              <CustomSelect value={filters.verified} onChange={(val) => handleFilterChange("verified", val)} options={[{ value: "", label: "All" }, { value: "true", label: "Verified ✓" }, { value: "false", label: "Unverified" }]} />
              <CustomSelect value={String(filters.limit)} onChange={(val) => handleFilterChange("limit", Number(val))} options={[{ value: "12", label: "12 / page" }, { value: "24", label: "24 / page" }, { value: "50", label: "50 / page" }]} />
            </div>
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-xl">
              <span className="text-sm font-semibold text-violet-700">{selected.size} selected</span>
              <button
                type="button"
                onClick={() => setBulkModal({ open: true, type: "suspend" })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-white transition-colors"
              >
                Suspend All
              </button>
              <button
                type="button"
                onClick={() => setBulkModal({ open: true, type: "lift" })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                Unsuspend All
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Clear selection
              </button>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => dispatch(fetchUsers({ ...filters }))}
                className="text-xs underline hover:text-red-900 font-medium"
              >
                Retry
              </button>
            </div>
          )}

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === users.length && users.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded accent-violet-600 cursor-pointer"
                      />
                    </th>
                    {[
                      { label: "User",      col: "fullName"       },
                      { label: "Role",      col: null             },
                      { label: "Status",    col: "accountStatus"  },
                      { label: "Posts",     col: "postsCount"     },
                      { label: "Followers", col: "followersCount" },
                      { label: "Joined",    col: "createdAt"      },
                      { label: "",          col: null             },
                    ].map(({ label, col }) => (
                      <th
                        key={label || "__actions"}
                        onClick={col ? () => handleSort(col) : undefined}
                        className={`px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider
                          ${col ? "cursor-pointer hover:text-slate-600 select-none" : ""}`}
                      >
                        <span className="inline-flex items-center">
                          {label}
                          {col && <SortIcon col={col} sortBy={filters.sortBy} sortOrder={filters.sortOrder} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <UsersTableSkeleton />
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                            </svg>
                          </div>
                          <p className="text-sm font-medium text-slate-500">No users found</p>
                          <p className="text-xs text-slate-400">Try adjusting your filters</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group">
                        <td className="px-4 py-3.5 w-10">
                          <input
                            type="checkbox"
                            checked={selected.has(user.id)}
                            onChange={() => toggleSelect(user.id)}
                            className="w-4 h-4 rounded accent-violet-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            {/* <Avatar user={user} /> */}
                            <Avatar user={user} onClick={() => navigate(`/users/${user.id}`)} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-slate-800 truncate">
                                  {user.fullName || user.username}
                                </span>
                                {user.isVerified && (
                                  <svg className="w-3.5 h-3.5 text-sky-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                                  </svg>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 truncate">@{user.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5"><RoleBadge role={user.role} /></td>
                        <td className="px-4 py-3.5"><StatusBadge status={user.status} /></td>
                        <td className="px-4 py-3.5 text-sm font-medium text-slate-600 tabular-nums">{(user.postsCount ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-sm font-medium text-slate-600 tabular-nums">{(user.followersCount ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-sm text-slate-400">{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => navigate(`/users/${user.id}`)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-colors"
                            >
                              View
                            </button>
                            <UserRowMenu
                              user={user}
                              onStatusChange={(u) => setStatusModal({ open: true, user: u })}
                              onToggleVerify={handleToggleVerify}
                              onDelete={(u) => setDeleteModal({ open: true, user: u })}
                              actionLoading={actionLoading}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3.5 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-400 font-medium">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => dispatch(setPage(currentPage - 1))}
                    disabled={currentPage <= 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Prev
                  </button>
                  {/* FIX: buildPageNumbers returns stable unique values — use page as key, render "…" for nulls */}
                  {pageNumbers.map((page, i) =>
                    page === null ? (
                      <span key={`gap-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400">…</span>
                    ) : (
                      <button
                        key={page}
                        type="button"
                        onClick={() => dispatch(setPage(page))}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          page === currentPage
                            ? "bg-violet-600 text-white shadow-sm"
                            : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"
                        }`}
                      >
                        {page}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    onClick={() => dispatch(setPage(currentPage + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}