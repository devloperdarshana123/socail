import { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Shield, Search, X, ChevronLeft, ChevronRight,
  RotateCcw, Loader2, SlidersHorizontal, Calendar,
  User, FileText, Settings, Lock, AlertTriangle,
  CheckCircle, Eye, Filter, Activity, Clock,
  LogIn, LogOut, Trash2, BadgeCheck, Ban,
  PauseCircle, PlayCircle, BarChart2, ChevronDown,
} from "lucide-react";
import {
  fetchAuditLogs,
  fetchAuditStats,
  fetchAuditConstants,
  fetchAuditLogById,
  setFilters,
  setPage,
  clearFilters,
  clearSelectedLog,
  clearErrors,
  selectAuditLogs,
  selectAuditPagination,
  selectAuditLoading,
  selectAuditError,
  selectAuditFilters,
  selectAuditStats,
  selectAuditStatsLoading,
  selectAuditConstants,
  selectSelectedLog,
  selectDetailLoading,
} from "../lib/redux/auditLogSlice";

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function useDebounce(value, delay = 400) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)   return "just now";
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return formatDate(iso);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Action metadata — icon, label, colour per action string
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_META = {
  "admin.login":                   { icon: LogIn,        label: "Admin Login",              color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
  "admin.logout":                  { icon: LogOut,       label: "Admin Logout",             color: "text-slate-500",  bg: "bg-slate-50 border-slate-200" },
  "admin.password_changed":        { icon: Lock,         label: "Password Changed",         color: "text-amber-600",  bg: "bg-amber-50 border-amber-100" },
  "admin.session_revoked":         { icon: X,            label: "Session Revoked",          color: "text-orange-500", bg: "bg-orange-50 border-orange-100" },
  "admin.all_sessions_revoked":    { icon: X,            label: "All Sessions Revoked",     color: "text-red-500",    bg: "bg-red-50 border-red-100" },
  "user.banned":                   { icon: Ban,          label: "User Banned",              color: "text-red-600",    bg: "bg-red-50 border-red-100" },
  "user.suspended":                { icon: PauseCircle,  label: "User Suspended",           color: "text-orange-600", bg: "bg-orange-50 border-orange-100" },
  "user.unsuspended":              { icon: PlayCircle,   label: "User Unsuspended",         color: "text-emerald-600",bg: "bg-emerald-50 border-emerald-100" },
  "user.activated":                { icon: CheckCircle,  label: "User Activated",           color: "text-emerald-600",bg: "bg-emerald-50 border-emerald-100" },
  "user.deleted":                  { icon: Trash2,       label: "User Deleted",             color: "text-red-600",    bg: "bg-red-50 border-red-100" },
  "user.badge_granted":            { icon: BadgeCheck,   label: "Badge Granted",            color: "text-[#1e3a5f]",  bg: "bg-[#e8eef5] border-[#c5d3e0]" },
  "user.badge_revoked":            { icon: BadgeCheck,   label: "Badge Revoked",            color: "text-slate-500",  bg: "bg-slate-50 border-slate-200" },
  "post.deleted":                  { icon: Trash2,       label: "Post Deleted",             color: "text-red-600",    bg: "bg-red-50 border-red-100" },
  "report.resolved":               { icon: CheckCircle,  label: "Report Resolved",          color: "text-emerald-600",bg: "bg-emerald-50 border-emerald-100" },
  "report.dismissed":              { icon: X,            label: "Report Dismissed",         color: "text-slate-500",  bg: "bg-slate-50 border-slate-200" },
  "report.bulk_updated":           { icon: Activity,     label: "Reports Bulk Updated",     color: "text-[#1e3a5f]",  bg: "bg-[#e8eef5] border-[#c5d3e0]" },
  "settings.profile_updated":      { icon: User,         label: "Profile Updated",          color: "text-[#1e3a5f]",  bg: "bg-[#e8eef5] border-[#c5d3e0]" },
  "settings.avatar_updated":       { icon: User,         label: "Avatar Updated",           color: "text-[#1e3a5f]",  bg: "bg-[#e8eef5] border-[#c5d3e0]" },
  "settings.notifications_updated":{ icon: Settings,     label: "Notifications Updated",    color: "text-[#1e3a5f]",  bg: "bg-[#e8eef5] border-[#c5d3e0]" },
};

const CATEGORY_META = {
  auth:     { icon: Lock,     label: "Auth",     color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  user:     { icon: User,     label: "User",     color: "text-red-600",    bg: "bg-red-50 border-red-200" },
  content:  { icon: FileText, label: "Content",  color: "text-[#1e3a5f]",  bg: "bg-[#e8eef5] border-[#c5d3e0]" },
  settings: { icon: Settings, label: "Settings", color: "text-slate-600",  bg: "bg-slate-50 border-slate-200" },
};

function getActionMeta(action) {
  return ACTION_META[action] ?? { icon: Activity, label: action, color: "text-slate-500", bg: "bg-slate-50 border-slate-200" };
}
function getCategoryMeta(cat) {
  return CATEGORY_META[cat] ?? { icon: Activity, label: cat, color: "text-slate-500", bg: "bg-slate-50 border-slate-200" };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Stat Card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, accent, loading }) {
  return (
    <div className={`rounded-2xl border ${accent.cardBg} px-4 py-4 sm:px-6 sm:py-5
      flex items-center gap-3 sm:gap-5 shadow-sm
      hover:shadow-md transition-all duration-300 hover:-translate-y-0.5`}>
      <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 ${accent.icon}`}>
        <Icon size={20} className="sm:hidden" />
        <Icon size={28} className="hidden sm:block" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-none tracking-tight">
          {loading ? "—" : (typeof value === "number" ? value.toLocaleString() : value ?? "—")}
        </p>
        <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Log Row
// ─────────────────────────────────────────────────────────────────────────────
function AdminAvatar({ name, avatarUrl }) {
  const [imgError, setImgError] = useState(false);
  const initials = (name ?? "A")
    .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const uiAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name ?? "Admin")}&background=1e3a5f&color=fff&size=64&bold=true&format=svg`;
  if (avatarUrl && !imgError) {
    return (
      <img src={avatarUrl} alt={initials}
        onError={() => setImgError(true)}
        className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-white" />
    );
  }
  return (
    <img src={uiAvatar} alt={initials}
      onError={() => setImgError(true)}
      className="w-7 h-7 rounded-full object-cover shrink-0" />
  );
}

function LogRow({ log, onOpen }) {
  const meta = getActionMeta(log.action);
  const catMeta = getCategoryMeta(log.category);
  const Icon = meta.icon;

  return (
    <tr
      onClick={() => onOpen(log)}
      className="border-b border-slate-100 hover:bg-[#f0f4f8] cursor-pointer transition-colors group"
    >
      {/* Action */}
      <td className="px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
<div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0">
            <Icon size={14} className={`sm:hidden ${meta.color}`} />
            <Icon size={16} className={`hidden sm:block ${meta.color}`} />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-tight">
              {meta.label}
            </p>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border mt-0.5 ${catMeta.bg} ${catMeta.color}`}>
              {log.category}
            </span>
          </div>
        </div>
      </td>

      {/* Admin */}
      <td className="px-4 py-3 sm:px-6 sm:py-4 hidden sm:table-cell">
        <div className="flex items-center gap-2">
          <AdminAvatar
  name={log.performedByName}
  avatarUrl={log.performedBy?.avatar?.url}
/>
          <div>
            <p className="text-xs font-semibold text-slate-700 leading-tight">{log.performedByName ?? "Unknown"}</p>
            {log.performedBy?.username && (
              <p className="text-[10px] text-slate-400">@{log.performedBy.username}</p>
            )}
          </div>
        </div>
      </td>

      {/* Target */}
      <td className="px-4 py-3 sm:px-6 sm:py-4 hidden md:table-cell">
        {log.targetMeta?.username || log.targetMeta?.email ? (
          <div>
            {log.targetMeta.username && (
              <p className="text-xs font-semibold text-slate-700">@{log.targetMeta.username}</p>
            )}
            {log.targetMeta.email && (
              <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{log.targetMeta.email}</p>
            )}
          </div>
        ) : log.targetMeta?.reason ? (
          <p className="text-xs text-slate-500 truncate max-w-[140px]">{log.targetMeta.reason}</p>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>

      {/* IP */}
      <td className="px-4 py-3 sm:px-6 sm:py-4 hidden lg:table-cell">
        <span className="text-[11px] font-mono text-slate-400">
          {log.ipAddress ?? "—"}
        </span>
      </td>

      {/* Time */}
      <td className="px-4 py-3 sm:px-6 sm:py-4 text-right">
        <div>
          <p className="text-xs font-medium text-slate-600 whitespace-nowrap">{timeAgo(log.createdAt)}</p>
          <p className="text-[10px] text-slate-400 hidden sm:block mt-0.5">{formatDate(log.createdAt)}</p>
        </div>
      </td>

      {/* Arrow */}
      <td className="pr-4 sm:pr-6">
        <ChevronRight size={14} className="text-slate-300 group-hover:text-[#1e3a5f] transition-colors" />
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Log Skeleton Row
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      <td className="px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-200 animate-pulse shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3 w-28 bg-slate-200 animate-pulse rounded" />
            <div className="h-2.5 w-14 bg-slate-100 animate-pulse rounded" />
          </div>
        </div>
      </td>
      <td className="px-6 py-4 hidden sm:table-cell">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-200 animate-pulse" />
          <div className="h-3 w-24 bg-slate-200 animate-pulse rounded" />
        </div>
      </td>
      <td className="px-6 py-4 hidden md:table-cell">
        <div className="h-3 w-20 bg-slate-200 animate-pulse rounded" />
      </td>
      <td className="px-6 py-4 hidden lg:table-cell">
        <div className="h-3 w-24 bg-slate-200 animate-pulse rounded" />
      </td>
      <td className="px-6 py-4 text-right">
        <div className="h-3 w-14 bg-slate-200 animate-pulse rounded ml-auto" />
      </td>
      <td className="pr-6" />
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Detail Modal
// ─────────────────────────────────────────────────────────────────────────────

function DetailModal({ log, loading, onClose }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!log && !loading) return null;

  const meta = log ? getActionMeta(log.action) : null;
  const Icon = meta?.icon ?? Activity;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#f8fafc]">
          <div className="flex items-center gap-3">
            {loading ? (
              <Loader2 size={18} className="text-[#1e3a5f] animate-spin" />
            ) : (
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${meta?.bg}`}>
                <Icon size={16} className={meta?.color} />
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-slate-800">
                {loading ? "Loading…" : meta?.label}
              </p>
              {log && (
                <p className="text-[10px] text-slate-400 font-mono">{log._id}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X size={14} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-6 flex items-center justify-center h-48">
            <Loader2 size={28} className="text-[#1e3a5f] animate-spin" />
          </div>
        ) : log ? (
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

            {/* Row helper */}
            {[
              { label: "Action",      value: log.action },
              { label: "Category",    value: log.category },
              { label: "Performed by",value: `${log.performedByName ?? "—"}${log.performedBy?.username ? ` (@${log.performedBy.username})` : ""}` },
              { label: "Time",        value: formatDateTime(log.createdAt) },
              { label: "IP Address",  value: log.ipAddress ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-3">
                <p className="text-[11px] font-semibold text-slate-400 w-28 shrink-0 pt-0.5">{label}</p>
                <p className="text-xs text-slate-700 font-medium break-all">{value}</p>
              </div>
            ))}

            {/* Target meta */}
            {log.targetMeta && Object.keys(log.targetMeta).length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-400 mb-2">Target Info</p>
                <div className="bg-[#f8fafc] border border-slate-100 rounded-xl p-3 space-y-2">
                  {Object.entries(log.targetMeta).map(([k, v]) =>
                    v != null && v !== "" ? (
                      <div key={k} className="flex gap-3">
                        <p className="text-[10px] font-semibold text-slate-400 w-20 shrink-0 capitalize pt-0.5">{k}</p>
                        <p className="text-[11px] text-slate-700 font-medium break-all">{String(v)}</p>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {/* Note */}
            {log.note && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-400 mb-1.5">Note</p>
                <p className="text-xs text-slate-600 bg-[#f8fafc] border border-slate-100 rounded-xl p-3">
                  {log.note}
                </p>
              </div>
            )}

            {/* User agent */}
            {log.userAgent && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-400 mb-1.5">User Agent</p>
                <p className="text-[10px] font-mono text-slate-400 bg-[#f8fafc] border border-slate-100 rounded-xl p-3 break-all">
                  {log.userAgent}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const dispatch = useDispatch();

  const logs          = useSelector(selectAuditLogs);
  const pagination    = useSelector(selectAuditPagination);
  const loading       = useSelector(selectAuditLoading);
  const error         = useSelector(selectAuditError);
  const filters       = useSelector(selectAuditFilters);
  const stats         = useSelector(selectAuditStats);
  const statsLoading  = useSelector(selectAuditStatsLoading);
  const constants     = useSelector(selectAuditConstants);
  const selectedLog   = useSelector(selectSelectedLog);
  const detailLoading = useSelector(selectDetailLoading);

  const [searchInput,  setSearchInput]  = useState(filters.search ?? "");
  const [filterOpen,   setFilterOpen]   = useState(false);
  const [toast,        setToast]        = useState(null);
  const [modalOpen,    setModalOpen]    = useState(false);

  const debouncedSearch = useDebounce(searchInput, 450);

  const showToast = useCallback((msg, type = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Initial load
  useEffect(() => {
    dispatch(fetchAuditStats(30));
    dispatch(fetchAuditConstants());
  }, [dispatch]);

  // Fetch logs whenever filters change
  useEffect(() => {
    dispatch(fetchAuditLogs(filters));
  }, [dispatch, filters]);

  // Debounced search
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      dispatch(setFilters({ search: debouncedSearch }));
    }
  }, [debouncedSearch]);

  // Error toast
  useEffect(() => {
    if (error) {
      showToast(error, "error");
      dispatch(clearErrors());
    }
  }, [error]);

  const handleOpenDetail = useCallback((log) => {
    dispatch(fetchAuditLogById(log._id));
    setModalOpen(true);
  }, [dispatch]);

  const handleCloseDetail = useCallback(() => {
    setModalOpen(false);
    dispatch(clearSelectedLog());
  }, [dispatch]);

  const handleReset = useCallback(() => {
    dispatch(clearFilters());
    setSearchInput("");
  }, [dispatch]);

  // Build stat cards from stats
  const totalLogs    = pagination.total ?? 0;
  const catBreakdown = stats?.categoryBreakdown ?? [];
  const getCount     = (cat) => catBreakdown.find((c) => c._id === cat)?.count ?? 0;

  const STAT_CARDS = [
    {
      icon: Activity, label: "Total Actions",
      value: totalLogs,
      accent: { cardBg: "bg-[#e8eef5] border-[#c5d3e0] hover:bg-[#dce5f0] hover:border-[#b5c5d5]", icon: "text-[#1e3a5f]" },
    },
    {
      icon: User, label: "User Actions",
      value: getCount("user"),
      accent: { cardBg: "bg-red-50 border-red-100 hover:bg-red-100/50 hover:border-red-200", icon: "text-red-500" },
    },
    {
      icon: FileText, label: "Content Actions",
      value: getCount("content"),
      accent: { cardBg: "bg-amber-50 border-amber-100 hover:bg-amber-100/50 hover:border-amber-200", icon: "text-amber-500" },
    },
    {
      icon: Lock, label: "Auth Events",
      value: getCount("auth"),
      accent: { cardBg: "bg-emerald-50 border-emerald-100 hover:bg-emerald-100/50 hover:border-emerald-200", icon: "text-emerald-500" },
    },
  ];

  const CATEGORY_FILTERS = [
    { value: "",         label: "All"      },
    { value: "auth",     label: "Auth"     },
    { value: "user",     label: "User"     },
    { value: "content",  label: "Content"  },
    { value: "settings", label: "Settings" },
  ];

  const curPage    = pagination.page       ?? 1;
  const totalPages = pagination.totalPages ?? 1;

  // Build action options for dropdown from constants or fallback to ACTION_META keys
  const actionOptions = constants?.actions
    ? Object.values(constants.actions)
    : Object.keys(ACTION_META);

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 left-4 sm:left-auto sm:right-5 sm:top-5 z-50
          px-4 py-3 rounded-2xl text-sm font-semibold shadow-xl border
          pointer-events-none animate-fade-in text-center sm:text-left
          ${toast.type === "error"
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
          {toast.msg}
        </div>
      )}

      {/* Detail Modal */}
      {modalOpen && (
        <DetailModal
          log={selectedLog}
          loading={detailLoading}
          onClose={handleCloseDetail}
        />
      )}

      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-8">

          {/* ── Page Header ── */}
          <div className="flex items-center justify-between mb-5 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Shield size={22} className="text-[#1e3a5f] sm:hidden" />
                <Shield size={28} className="text-[#1e3a5f] hidden sm:block" />
                Audit Log
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5 sm:mt-1 flex items-center gap-1.5">
                <Clock size={12} />
                {loading ? "Loading…" : `${totalLogs.toLocaleString()} total actions recorded`}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500
                hover:text-slate-800 border border-slate-200 bg-white rounded-xl
                px-2.5 py-2 sm:px-3.5 sm:py-2.5 hover:bg-slate-50 hover:border-slate-300
                transition-all duration-150 shadow-sm"
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">Reset filters</span>
              <span className="sm:hidden">Reset</span>
            </button>
          </div>

          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-5 sm:mb-8">
            {STAT_CARDS.map((card) => (
              <StatCard key={card.label} {...card} loading={statsLoading} />
            ))}
          </div>

          {/* ── Filter Bar ── */}
          <div className="bg-white border border-slate-200 rounded-2xl px-3 py-3 sm:px-5 sm:py-4 mb-4 sm:mb-6 shadow-sm">

            {/* Mobile: search + toggle */}
            <div className="flex items-center gap-2 sm:hidden">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search admin or user…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl
                    pl-9 pr-8 py-2 text-sm text-slate-700 placeholder-slate-400
                    focus:outline-none focus:border-[#1e3a5f] focus:bg-white transition-all"
                />
                {searchInput && (
                  <button
                    onClick={() => { setSearchInput(""); dispatch(setFilters({ search: "" })); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setFilterOpen(v => !v)}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl border text-xs font-semibold
                  transition-colors shrink-0
                  ${filterOpen
                    ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                    : "bg-slate-50 text-slate-600 border-slate-200"}`}
              >
                <SlidersHorizontal size={13} />
                Filter
              </button>
            </div>

            {/* Mobile: collapsible extras */}
            {filterOpen && (
              <div className="flex flex-col gap-2.5 mt-3 sm:hidden">
                {/* Category pills */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 overflow-x-auto">
                  {CATEGORY_FILTERS.map(({ value, label }) => (
                    <button key={value}
                      onClick={() => dispatch(setFilters({ category: value }))}
                      className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-xs font-semibold transition-all shrink-0
                        ${filters.category === value
                          ? "bg-white text-[#1e3a5f] shadow-sm border border-slate-200"
                          : "text-slate-500 hover:text-slate-700"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Date range */}
                <div className="flex gap-2">
                  <input type="date" value={filters.startDate}
                    onChange={(e) => dispatch(setFilters({ startDate: e.target.value }))}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2
                      text-xs text-slate-600 focus:outline-none focus:border-[#1e3a5f] cursor-pointer" />
                  <input type="date" value={filters.endDate}
                    onChange={(e) => dispatch(setFilters({ endDate: e.target.value }))}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2
                      text-xs text-slate-600 focus:outline-none focus:border-[#1e3a5f] cursor-pointer" />
                </div>

                {/* Action + per page */}
                <div className="flex gap-2">
                  <select value={filters.action}
                    onChange={(e) => dispatch(setFilters({ action: e.target.value }))}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2
                      text-xs text-slate-600 focus:outline-none focus:border-[#1e3a5f] cursor-pointer">
                    <option value="">All actions</option>
                    {actionOptions.map((a) => (
                      <option key={a} value={a}>{ACTION_META[a]?.label ?? a}</option>
                    ))}
                  </select>
                  <select value={filters.limit}
                    onChange={(e) => dispatch(setFilters({ limit: Number(e.target.value) }))}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2
                      text-xs text-slate-600 focus:outline-none focus:border-[#1e3a5f] cursor-pointer">
                    <option value={20}>20/page</option>
                    <option value={50}>50/page</option>
                    <option value={100}>100/page</option>
                  </select>
                </div>
              </div>
            )}

            {/* Desktop: all in one row */}
            <div className="hidden sm:flex flex-wrap gap-3 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search admin name or target user…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl
                    pl-10 pr-9 py-2.5 text-sm text-slate-700 placeholder-slate-400
                    focus:outline-none focus:border-[#1e3a5f] focus:bg-white transition-all duration-150"
                />
                {searchInput && (
                  <button
                    onClick={() => { setSearchInput(""); dispatch(setFilters({ search: "" })); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Category pills */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1">
                {CATEGORY_FILTERS.map(({ value, label }) => (
                  <button key={value}
                    onClick={() => dispatch(setFilters({ category: value }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
                      ${filters.category === value
                        ? "bg-white text-[#1e3a5f] shadow-sm border border-slate-200"
                        : "text-slate-500 hover:text-slate-700"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Action dropdown */}
              <select value={filters.action}
                onChange={(e) => dispatch(setFilters({ action: e.target.value }))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5
                  text-sm text-slate-600 focus:outline-none focus:border-[#1e3a5f] cursor-pointer transition-colors">
                <option value="">All actions</option>
                {actionOptions.map((a) => (
                  <option key={a} value={a}>{ACTION_META[a]?.label ?? a}</option>
                ))}
              </select>

              {/* Date range */}
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400 shrink-0" />
                <input type="date" value={filters.startDate}
                  onChange={(e) => dispatch(setFilters({ startDate: e.target.value }))}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5
                    text-sm text-slate-600 focus:outline-none focus:border-[#1e3a5f] cursor-pointer transition-colors" />
                <span className="text-slate-400 text-xs">to</span>
                <input type="date" value={filters.endDate}
                  onChange={(e) => dispatch(setFilters({ endDate: e.target.value }))}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5
                    text-sm text-slate-600 focus:outline-none focus:border-[#1e3a5f] cursor-pointer transition-colors" />
              </div>

              {/* Per page */}
              <select value={filters.limit}
                onChange={(e) => dispatch(setFilters({ limit: Number(e.target.value) }))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5
                  text-sm text-slate-600 focus:outline-none focus:border-[#1e3a5f] cursor-pointer transition-colors">
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-[#f8fafc]">
                    <th className="px-4 py-3 sm:px-6 sm:py-3.5 text-left text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                      Admin
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">
                      Target
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                      IP Address
                    </th>
                    <th className="px-4 py-3 sm:px-6 sm:py-3.5 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="pr-4 sm:pr-6" />
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
                    : logs.length === 0
                    ? (
                      <tr>
                        <td colSpan={6}>
                          <div className="flex flex-col items-center justify-center py-20 sm:py-28 gap-4">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-[#e8eef5] flex items-center justify-center">
                              <Shield size={28} className="text-[#1e3a5f]/30 sm:hidden" />
                              <Shield size={32} className="text-[#1e3a5f]/30 hidden sm:block" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-bold text-slate-600">No logs found</p>
                              <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or date range</p>
                            </div>
                            <button
                              onClick={handleReset}
                              className="text-xs font-semibold text-[#1e3a5f] hover:text-[#162d4a]
                                underline underline-offset-2 transition-colors"
                            >
                              Clear all filters
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                    : logs.map((log) => (
                      <LogRow key={log._id} log={log} onOpen={handleOpenDetail} />
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Pagination ── */}
          {!loading && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4
              mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-200">
              <p className="text-xs text-slate-400 font-medium text-center sm:text-left order-2 sm:order-1">
                Page {curPage} of {totalPages} · {totalLogs.toLocaleString()} total logs
              </p>
              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center order-1 sm:order-2">
                <button
                  onClick={() => dispatch(setPage(curPage - 1))}
                  disabled={curPage <= 1}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs
                    font-semibold bg-white border border-slate-200 hover:bg-slate-50
                    text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed
                    transition-colors shadow-sm"
                >
                  <ChevronLeft size={13} /> Prev
                </button>

                {(() => {
                  const pages = [];
                  let start = Math.max(1, curPage - 2);
                  let end   = Math.min(totalPages, start + 4);
                  if (end - start < 4) start = Math.max(1, end - 4);
                  for (let i = start; i <= end; i++) pages.push(i);
                  return pages.map((p) => (
                    <button key={p}
                      onClick={() => dispatch(setPage(p))}
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-xs font-bold transition-all duration-150
                        ${p === curPage
                          ? "bg-[#1e3a5f] text-white shadow-sm scale-105"
                          : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"}`}
                    >{p}</button>
                  ));
                })()}

                <button
                  onClick={() => dispatch(setPage(curPage + 1))}
                  disabled={curPage >= totalPages}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs
                    font-semibold bg-white border border-slate-200 hover:bg-slate-50
                    text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed
                    transition-colors shadow-sm"
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}