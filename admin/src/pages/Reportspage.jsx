1

import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchReports, fetchReportById, fetchReportHistory,
  updateReportStatus, bulkUpdateReports,
  claimReport, releaseReport, escalateReport,
  setFilters, setPage, resetFilters,
  closeReport, toggleSelectId, selectAllIds, clearSelectedIds, clearClaimError,
  selectReports, selectReportsLoading, selectReportsError,
  selectReportsPagination, selectReportsCounts, selectReportsPriorities,
  selectReportsFilters, selectSelectedReport, selectReportHistory,
  selectDetailLoading, selectHistoryLoading, selectActionLoading,
  selectClaimLoading, selectClaimError, selectEscalateLoading,
  selectBulkLoading, selectSelectedIds,
} from "../lib/redux/reportsSlice";

// ─────────────────────────────────────────────────────────────
//  Constants  (module-level — never recreated)
// ─────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: "",                      label: "All"          },
  { key: "pending",               label: "Pending"      },
  { key: "under_review",          label: "In Review"    },
  { key: "resolved_action_taken", label: "Action Taken" },
  { key: "resolved_no_action",    label: "No Action"    },
  { key: "dismissed",             label: "Dismissed"    },
];

const REASON_LABELS = {
  spam:                     "Spam",
  nudity_or_sexual_content: "Nudity / Sexual",
  hate_speech:              "Hate Speech",
  violence_or_dangerous:    "Violence",
  harassment_or_bullying:   "Harassment",
  false_information:        "False Info",
  intellectual_property:    "IP Violation",
  self_harm_or_suicide:     "Self Harm",
  scam_or_fraud:            "Scam / Fraud",
  illegal_activity:         "Illegal Activity",
  other:                    "Other",
};

const ACTION_OPTIONS = [
  { value: "none",            label: "No action"      },
  { value: "user_warned",     label: "Warn user"      },
  { value: "content_removed", label: "Remove content" },
  { value: "user_suspended",  label: "Suspend user"   },
  { value: "user_banned",     label: "Ban user"       },
  { value: "other",           label: "Other"          },
];

const DESTRUCTIVE_ACTIONS = new Set(["user_suspended", "user_banned", "content_removed"]);

const STATUS_OPTIONS = [
  { value: "under_review",          label: "Mark Under Review"      },
  { value: "resolved_action_taken", label: "Resolve — Action Taken" },
  { value: "resolved_no_action",    label: "Resolve — No Action"    },
  { value: "dismissed",             label: "Dismiss"                },
];

const STATUS_STYLES = {
  pending:               { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-400"   },
  under_review:          { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200",     dot: "bg-sky-400"     },
  resolved_action_taken: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-400" },
  resolved_no_action:    { bg: "bg-slate-100",  text: "text-slate-600",   border: "border-slate-200",   dot: "bg-slate-400"   },
  dismissed:             { bg: "bg-rose-50",    text: "text-rose-600",    border: "border-rose-200",    dot: "bg-rose-400"    },
};

const STATUS_LABELS = {
  pending:               "Pending",
  under_review:          "In Review",
  resolved_action_taken: "Action Taken",
  resolved_no_action:    "No Action",
  dismissed:             "Dismissed",
};

const PRIORITY_STYLES = {
  low:      { bg: "bg-slate-100",  text: "text-slate-500",  label: "Low"      },
  medium:   { bg: "bg-amber-50",   text: "text-amber-600",  label: "Medium"   },
  high:     { bg: "bg-orange-50",  text: "text-orange-600", label: "High"     },
  critical: { bg: "bg-red-50",     text: "text-red-600",    label: "Critical" },
};

// Filter select configs — module-level, never recreated
const REASON_OPTIONS = [
  { value: "", label: "All reasons" },
  ...Object.entries(REASON_LABELS).map(([k, v]) => ({ value: k, label: v })),
];

const TARGET_OPTIONS = [
  { value: "",        label: "All types"  },
  { value: "Post",    label: "📸 Post"    },
  { value: "User",    label: "👤 User"    },
  { value: "Comment", label: "💬 Comment" },
];

const PRIORITY_OPTIONS = [
  { value: "",         label: "All priorities" },
  { value: "critical", label: "⚡ Critical"    },
  { value: "high",     label: "↑ High"         },
  { value: "medium",   label: "→ Medium"       },
  { value: "low",      label: "↓ Low"          },
];

const SORT_OPTIONS = [
  { value: "desc", label: "Newest first" },
  { value: "asc",  label: "Oldest first" },
];

const TOGGLE_PILLS = [
  { key: "escalated",     label: "🔺 Escalated" },
  { key: "claimedByMe",   label: "🔒 My claims" },
  { key: "unclaimedOnly", label: "🔓 Unclaimed" },
];

const PRIORITY_BAR_ITEMS = [
  { key: "critical", label: "Critical", color: "text-red-600",    bg: "bg-red-500"    },
  { key: "high",     label: "High",     color: "text-orange-600", bg: "bg-orange-400" },
  { key: "medium",   label: "Medium",   color: "text-amber-600",  bg: "bg-amber-400"  },
  { key: "low",      label: "Low",      color: "text-slate-500",  bg: "bg-slate-300"  },
];

const TOAST_DURATION = 3500;

// ─────────────────────────────────────────────────────────────
//  Helpers  (module-level pure functions)
// ─────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtTimeAgo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function avatarUrl(user) {
  if (!user) return null;
  const av = user.avatar;
  if (!av) return null;
  if (typeof av === "string") return av;
  return av.url ?? av.secure_url ?? null;
}

// Stable selector — defined outside component to avoid inline function recreation
const selectCurrentAdminId = (s) =>
  s.adminAuth?.admin?._id ?? s.auth?.user?._id ?? null;

// ─────────────────────────────────────────────────────────────
//  Micro Components
// ─────────────────────────────────────────────────────────────

function Avatar({ user, size = 32 }) {
  const url    = avatarUrl(user);
  const colors = ["bg-violet-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];
  const color  = colors[(user?.username?.charCodeAt(0) ?? 0) % colors.length];
  const initials = (user?.fullName ?? user?.username ?? "?")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const s = { width: size, height: size, minWidth: size, fontSize: size * 0.38 };
  if (url) return <img src={url} alt="" style={s} className="rounded-full object-cover shrink-0 ring-2 ring-white" />;
  return (
    <div style={s} className={`${color} rounded-full flex items-center justify-center font-bold text-white shrink-0 ring-2 ring-white`}>
      {initials}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text} ${s.border} transition-all duration-200`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const p = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.low;
  const icons = { low: "↓", medium: "→", high: "↑", critical: "⚡" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${p.bg} ${p.text} transition-all duration-200`}>
      {icons[priority] ?? "·"} {p.label}
    </span>
  );
}

function EscalatedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-100 animate-pulse">
      🔺 Escalated
    </span>
  );
}

function ClaimBadge({ claimedBy }) {
  if (!claimedBy) return null;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1e3a5f]/8 text-[#1e3a5f] border border-[#1e3a5f]/15">
      🔒 @{claimedBy.username}
    </span>
  );
}

function Spinner({ size = 20, className = "text-[#1e3a5f]" }) {
  return (
    <svg style={{ width: size, height: size }} className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function TargetPreview({ report }) {
  const { targetModel, targetId } = report;
  if (!targetId) return <span className="text-slate-400 text-xs">—</span>;

  if (targetModel === "Post") {
    const media      = targetId.media?.[0];
    const isVideo    = media?.resourceType === "video";
    const previewUrl = isVideo ? (media?.thumbnailUrl || media?.url) : media?.url;

    return (
      <div className="flex items-center gap-2">
        <div className="relative shrink-0">
          {previewUrl ? (
            <>
              <img src={previewUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-100 transition-transform duration-200 group-hover:scale-105" />
              {isVideo && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-violet-500 rounded-full flex items-center justify-center">
                  <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </span>
              )}
            </>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-700 truncate max-w-[120px]">{targetId.caption || "(no caption)"}</p>
          <p className="text-[10px] text-slate-400">{targetId.type === "reel" ? "Reel" : "Post"}</p>
        </div>
      </div>
    );
  }

  if (targetModel === "User") {
    return (
      <div className="flex items-center gap-2">
        <Avatar user={targetId} size={28} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-700 truncate max-w-[100px]">@{targetId.username}</p>
          <p className="text-[10px] text-slate-400">User</p>
        </div>
      </div>
    );
  }

  return <span className="text-xs text-slate-500">{targetModel}</span>;
}

// ─────────────────────────────────────────────────────────────
//  Confirm Dialog
// ─────────────────────────────────────────────────────────────

function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mx-auto">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all duration-150 disabled:opacity-40">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 active:scale-[0.98] text-white text-sm font-semibold transition-all duration-150 disabled:opacity-40 flex items-center justify-center gap-2">
            {loading && <Spinner size={14} className="text-white" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Escalate Modal
// ─────────────────────────────────────────────────────────────

function EscalateModal({ open, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState("");

  // Reset reason when modal closes
  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center mx-auto">
          <span className="text-lg">🔺</span>
        </div>
        <div className="text-center">
          <h3 className="text-sm font-bold text-slate-800">Escalate Report</h3>
          <p className="text-xs text-slate-500 mt-1">This will flag the report for senior admin review.</p>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Reason (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Why does this need senior review?"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all duration-200"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all duration-150">
            Cancel
          </button>
          <button onClick={() => onConfirm(reason)} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2">
            {loading && <Spinner size={14} className="text-white" />}
            Escalate
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  History Tab
// ─────────────────────────────────────────────────────────────

function HistoryTab({ reportId, history, loading }) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (reportId && !history) {
      dispatch(fetchReportHistory({ id: reportId }));
    }
  }, [dispatch, reportId, history]); // FIX: all three deps required

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={28} />
      </div>
    );
  }

  if (!history) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
        <div className="text-center flex-1">
          <p className="text-lg font-bold text-slate-800">{history.total}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total reports</p>
        </div>
        <div className="w-px h-8 bg-slate-200" />
        <div className="text-center flex-1">
          <p className="text-lg font-bold text-amber-600">{history.openCount}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Open</p>
        </div>
        <div className="w-px h-8 bg-slate-200" />
        <div className="text-center flex-1">
          <p className="text-lg font-bold text-emerald-600">{history.total - history.openCount}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Resolved</p>
        </div>
      </div>

      {history.items.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">No other reports on this target</p>
      ) : history.items.map((r) => (
        <div key={r._id} className="p-3 bg-white rounded-xl border border-slate-100 space-y-1.5 hover:border-slate-200 hover:shadow-sm transition-all duration-200">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar user={r.reportedBy} size={22} />
              <p className="text-xs font-medium text-slate-700 truncate">@{r.reportedBy?.username ?? "—"}</p>
            </div>
            <StatusBadge status={r.status} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
              {REASON_LABELS[r.reason] ?? r.reason}
            </span>
            <span className="text-[10px] text-slate-400">{fmtTimeAgo(r.createdAt)}</span>
          </div>
          {r.reviewedBy && (
            <p className="text-[10px] text-slate-400">
              Reviewed by @{r.reviewedBy.username} · {r.actionTaken}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Detail Panel
// ─────────────────────────────────────────────────────────────

function DetailPanel({
  report, loading, actionLoading, claimLoading, escalateLoading,
  claimError, history, historyLoading,
  onClose, onUpdate, onClaim, onRelease, onEscalate, currentAdminId,
}) {
  const [status,        setStatus]        = useState("");
  const [actionTaken,   setActionTaken]   = useState("none");
  const [moderatorNote, setModeratorNote] = useState("");
  const [activeTab,     setActiveTab]     = useState("detail");
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [showEscalate,  setShowEscalate]  = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(null);

  const reportId = report?._id;

  // Reset form when report changes
  useEffect(() => {
    if (reportId) {
      setStatus("");
      setActionTaken("none");
      setModeratorNote("");
      setActiveTab("detail");
      setShowConfirm(false);
      setShowEscalate(false);
      setPendingSubmit(null);
    }
  }, [reportId]);

  const busy      = actionLoading === reportId;
  const claimBusy = claimLoading  === reportId;
  const escalBusy = escalateLoading === reportId;
  const isClaimed    = !!report?.claimedBy;
  const claimedByMe  = report?.claimedBy?._id === currentAdminId || report?.claimedBy === currentAdminId;

  const handleSubmitClick = useCallback(() => {
    if (!status || !report) return;
    const args = { id: report._id, status, actionTaken, moderatorNote };
    if (DESTRUCTIVE_ACTIONS.has(actionTaken)) {
      setPendingSubmit(args);
      setShowConfirm(true);
    } else {
      onUpdate(args);
    }
  }, [status, actionTaken, moderatorNote, report, onUpdate]);

  const handleConfirm = useCallback(() => {
    setShowConfirm(false);
    if (pendingSubmit) {
      onUpdate(pendingSubmit);
      setPendingSubmit(null);
    }
  }, [pendingSubmit, onUpdate]);

  const handleCancelConfirm = useCallback(() => {
    setShowConfirm(false);
    setPendingSubmit(null);
  }, []);

  const handleEscalateConfirm = useCallback((reason) => {
    setShowEscalate(false);
    onEscalate({ id: report._id, reason });
  }, [report, onEscalate]);

  const destructiveLabel = useMemo(
    () => ACTION_OPTIONS.find((a) => a.value === pendingSubmit?.actionTaken)?.label ?? "this action",
    [pendingSubmit?.actionTaken]
  );

  return (
    <>
      <ConfirmDialog
        open={showConfirm}
        title="Confirm action"
        description={`You are about to: ${destructiveLabel}. This cannot be undone.`}
        confirmLabel="Confirm"
        onConfirm={handleConfirm}
        onCancel={handleCancelConfirm}
        loading={busy}
      />
      <EscalateModal
        open={showEscalate}
        onConfirm={handleEscalateConfirm}
        onCancel={() => setShowEscalate(false)}
        loading={escalBusy}
      />

      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300" onClick={onClose} />

        <div className="w-full max-w-full md:max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col
          animate-in slide-in-from-right duration-300">

          {/* Header */}
          <div className="flex items-center justify-between px-4 md:px-5 py-4 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-sm z-10">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Report Detail</h2>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">#{report?._id?.slice(-8)}</p>
            </div>
            <div className="flex items-center gap-2">
              {report && !report.escalated && (
                <button
                  onClick={() => setShowEscalate(true)}
                  disabled={escalBusy}
                  className="px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50 text-purple-600 text-xs font-semibold
                    hover:bg-purple-100 active:scale-[0.97] transition-all duration-150 disabled:opacity-40 flex items-center gap-1">
                  {escalBusy ? <Spinner size={12} className="text-purple-600" /> : "🔺"}
                  Escalate
                </button>
              )}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full hover:bg-slate-100 active:scale-[0.95] flex items-center justify-center text-slate-500 transition-all duration-150">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center"><Spinner size={32} /></div>
          ) : report ? (
            <>
              {/* Claim bar */}
              <div className="px-4 md:px-5 py-3 border-b border-slate-50 bg-slate-50/50">
                {claimError?.code === "ALREADY_CLAIMED" ? (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 animate-in fade-in duration-200">
                    <span>⚠</span>
                    <span className="flex-1">{claimError.message}</span>
                  </div>
                ) : isClaimed ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">
                        🔒 Claimed by <span className="font-semibold">@{report.claimedBy?.username}</span>
                        {claimedByMe && " (you)"}
                      </span>
                      {report.claimExpiresAt && (
                        <span className="text-[10px] text-slate-400">· expires {fmtTimeAgo(report.claimExpiresAt)}</span>
                      )}
                    </div>
                    {claimedByMe && (
                      <button
                        onClick={() => onRelease(report._id)}
                        disabled={claimBusy}
                        className="text-[11px] font-semibold text-slate-500 hover:text-red-500 transition-colors duration-150 disabled:opacity-40 flex items-center gap-1">
                        {claimBusy ? <Spinner size={10} /> : null} Release
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => onClaim({ id: report._id })}
                    disabled={claimBusy}
                    className="w-full py-2 rounded-xl border border-[#1e3a5f]/20 bg-white text-[#1e3a5f] text-xs font-semibold
                      hover:bg-[#1e3a5f]/5 active:scale-[0.98] transition-all duration-150 disabled:opacity-40 flex items-center justify-center gap-2">
                    {claimBusy ? <Spinner size={12} /> : null}
                    🔓 Claim report to review
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100 px-4 md:px-5">
                {["detail", "history"].map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`py-3 px-1 mr-4 text-xs font-semibold border-b-2 transition-all duration-200 capitalize
                      ${activeTab === tab
                        ? "border-[#1e3a5f] text-[#1e3a5f]"
                        : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                    {tab}
                    {tab === "history" && report.otherReportsOnTarget > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-600">
                        {report.otherReportsOnTarget}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex-1 p-4 md:p-5 space-y-5 overflow-y-auto">
                {activeTab === "history" ? (
                  <HistoryTab reportId={report._id} history={history} loading={historyLoading} />
                ) : (
                  <>
                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={report.status} />
                      <PriorityBadge priority={report.priority ?? "low"} />
                      {report.escalated && <EscalatedBadge />}
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-slate-100 text-slate-600 border-slate-200">
                        {REASON_LABELS[report.reason] ?? report.reason}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-slate-100 text-slate-600 border-slate-200">
                        {report.targetModel}
                      </span>
                    </div>

                    {/* Escalation info */}
                    {report.escalated && report.escalationReason && (
                      <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl animate-in fade-in duration-300">
                        <p className="text-[11px] font-semibold text-purple-700 mb-1">Escalation reason</p>
                        <p className="text-xs text-purple-600">{report.escalationReason}</p>
                        <p className="text-[10px] text-purple-400 mt-1">
                          by @{report.escalatedBy?.username} · {fmtTimeAgo(report.escalatedAt)}
                        </p>
                      </div>
                    )}

                    {/* Reported by */}
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Reported by</p>
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors duration-200">
                        <Avatar user={report.reportedBy} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">{report.reportedBy?.fullName ?? "—"}</p>
                          <p className="text-xs text-slate-400">@{report.reportedBy?.username}</p>
                        </div>
                        <p className="text-[11px] text-slate-400 shrink-0">{fmtDate(report.createdAt)}</p>
                      </div>
                    </div>

                    {/* Target */}
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                        Reported {report.targetModel}
                      </p>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        {report.targetModel === "Post" && report.targetId ? (
                          <div className="space-y-2">
                            {(() => {
                              const m = report.targetId.media?.[0];
                              if (!m) return null;
                              const isVideo = m.resourceType === "video";
                              if (isVideo) {
                                return (
                                  <video src={m.url} controls controlsList="nodownload"
                                    className="w-full h-36 md:h-40 rounded-lg bg-black"
                                    preload="metadata" poster={m.thumbnailUrl || undefined} />
                                );
                              }
                              return <img src={m.url} alt="" className="w-full h-36 md:h-40 object-cover rounded-lg" />;
                            })()}
                            {report.targetId.caption && (
                              <p className="text-xs text-slate-700 leading-relaxed">{report.targetId.caption}</p>
                            )}
                            {report.targetId.author && (
                              <div className="flex items-center gap-2 pt-1">
                                <Avatar user={report.targetId.author} size={20} />
                                <p className="text-[11px] text-slate-500">by @{report.targetId.author.username}</p>
                              </div>
                            )}
                          </div>
                        ) : report.targetModel === "User" && report.targetId ? (
                          <div className="flex items-center gap-3">
                            <Avatar user={report.targetId} size={40} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{report.targetId.fullName}</p>
                              <p className="text-xs text-slate-400">@{report.targetId.username}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">Target no longer available</p>
                        )}
                      </div>
                      {report.openReportsOnTarget > 0 && (
                        <button
                          onClick={() => setActiveTab("history")}
                          className="text-[11px] text-amber-600 mt-1.5 font-medium hover:underline text-left transition-colors duration-150">
                          ⚠ {report.openReportsOnTarget} more open report(s) on this {report.targetModel.toLowerCase()} — view history
                        </button>
                      )}
                    </div>

                    {/* Reporter note */}
                    {report.description && (
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Reporter's note</p>
                        <p className="text-xs text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-100 leading-relaxed">
                          {report.description}
                        </p>
                      </div>
                    )}

                    {/* Previous review */}
                    {report.status !== "pending" && (
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Previous review</p>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                          <div className="flex items-center gap-2">
                            {report.reviewedBy && <Avatar user={report.reviewedBy} size={20} />}
                            <p className="text-xs text-slate-600 truncate">
                              {report.reviewedBy?.username ?? "—"} · {fmtDateTime(report.reviewedAt)}
                            </p>
                          </div>
                          <p className="text-xs text-slate-500">
                            Action: <span className="font-semibold">{report.actionTaken ?? "none"}</span>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Action form */}
                    <div className="border-t border-slate-100 pt-4 space-y-3">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Take action</p>

                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">New status</label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700
                            focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all duration-200">
                          <option value="">Select status…</option>
                          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Action taken</label>
                        <select
                          value={actionTaken}
                          onChange={(e) => setActionTaken(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700
                            focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all duration-200">
                          {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {DESTRUCTIVE_ACTIONS.has(actionTaken) && (
                          <p className="text-[10px] text-red-500 mt-1 animate-in fade-in duration-200">⚠ This action requires confirmation</p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">
                          Moderator note <span className="text-slate-400 font-normal">(internal)</span>
                        </label>
                        <textarea
                          value={moderatorNote}
                          onChange={(e) => setModeratorNote(e.target.value)}
                          rows={3}
                          placeholder="Internal notes — not visible to users"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700
                            placeholder-slate-400 resize-none focus:outline-none focus:border-[#1e3a5f]
                            focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all duration-200"
                        />
                      </div>

                      <button
                        onClick={handleSubmitClick}
                        disabled={!status || busy}
                        className={`w-full py-3 rounded-xl text-white text-sm font-semibold
                          transition-all duration-200 active:scale-[0.98] disabled:opacity-40
                          flex items-center justify-center gap-2
                          ${DESTRUCTIVE_ACTIONS.has(actionTaken)
                            ? "bg-red-500 hover:bg-red-600 hover:shadow-red-200 hover:shadow-md"
                            : "bg-[#1e3a5f] hover:bg-[#162d4a] hover:shadow-[#1e3a5f]/20 hover:shadow-md"}`}>
                        {busy && <Spinner size={16} className="text-white" />}
                        {busy ? "Saving…" : DESTRUCTIVE_ACTIONS.has(actionTaken) ? "Review & Confirm" : "Submit decision"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  Mobile Report Card
// ─────────────────────────────────────────────────────────────

function MobileReportCard({ report, selected, onSelect, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border p-4 transition-all duration-200 cursor-pointer
        active:scale-[0.99] hover:shadow-md hover:-translate-y-0.5
        ${selected
          ? "border-[#1e3a5f] bg-blue-50/30 shadow-md ring-1 ring-[#1e3a5f]/10"
          : "border-slate-200 shadow-sm hover:border-slate-300"}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={onSelect}
          className="mt-1 accent-[#1e3a5f] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar user={report.reportedBy} size={26} />
              <p className="text-xs font-semibold text-slate-700 truncate">@{report.reportedBy?.username ?? "—"}</p>
            </div>
            <StatusBadge status={report.status} />
          </div>
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <PriorityBadge priority={report.priority ?? "low"} />
            {report.escalated && <EscalatedBadge />}
            {report.claimedBy && <ClaimBadge claimedBy={report.claimedBy} />}
          </div>
          <div className="flex items-center gap-3 mb-2">
            <TargetPreview report={report} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
              {REASON_LABELS[report.reason] ?? report.reason}
            </span>
            <span className="text-[10px] text-slate-400">{fmtDate(report.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Priority Summary Bar
// ─────────────────────────────────────────────────────────────

function PrioritySummaryBar({ priorities }) {
  const total = useMemo(
    () => Object.values(priorities).reduce((a, b) => a + b, 0),
    [priorities]
  );
  if (total === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 mb-4 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Open report priority</p>
        <p className="text-[11px] text-slate-500 font-medium">{total} open</p>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-2">
        {PRIORITY_BAR_ITEMS.map(({ key, bg }) => {
          const pct = (priorities[key] / total) * 100;
          return pct > 0 ? (
            <div key={key}
              style={{ width: `${pct}%`, transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)" }}
              className={`${bg} rounded-full`} />
          ) : null;
        })}
      </div>
      <div className="flex gap-3 flex-wrap">
        {PRIORITY_BAR_ITEMS.map(({ key, label, color }) => priorities[key] > 0 && (
          <span key={key} className={`text-[10px] font-semibold ${color}`}>
            {label}: {priorities[key]}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Empty State  (extracted to avoid duplication)
// ─────────────────────────────────────────────────────────────

function EmptyState({ message = "No reports found" }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
        <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-500">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const dispatch        = useDispatch();
  const reports         = useSelector(selectReports);
  const loading         = useSelector(selectReportsLoading);
  const error           = useSelector(selectReportsError);
  const pagination      = useSelector(selectReportsPagination);
  const counts          = useSelector(selectReportsCounts);
  const priorities      = useSelector(selectReportsPriorities);
  const filters         = useSelector(selectReportsFilters);
  const selectedReport  = useSelector(selectSelectedReport);
  const reportHistory   = useSelector(selectReportHistory);
  const detailLoading   = useSelector(selectDetailLoading);
  const historyLoading  = useSelector(selectHistoryLoading);
  const actionLoading   = useSelector(selectActionLoading);
  const claimLoading    = useSelector(selectClaimLoading);
  const claimError      = useSelector(selectClaimError);
  const escalateLoading = useSelector(selectEscalateLoading);
  const bulkLoading     = useSelector(selectBulkLoading);
  const selectedIds     = useSelector(selectSelectedIds);
  const currentAdminId  = useSelector(selectCurrentAdminId); // FIX: stable selector

  const [toast,       setToast]       = useState(null);
  const [bulkAction,  setBulkAction]  = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // FIX: useRef for toast timer to properly clear on unmount
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg, type = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // FIX: Destructure individual primitive/stable values from filters
  // so loadReports doesn't re-run when the filters object reference changes
  const {
    status:        filterStatus,
    targetModel:   filterTargetModel,
    reason:        filterReason,
    priority:      filterPriority,
    escalated:     filterEscalated,
    claimedByMe:   filterClaimedByMe,
    unclaimedOnly: filterUnclaimedOnly,
    sortOrder:     filterSortOrder,
    page:          filterPage,
    limit:         filterLimit,
  } = filters;

  const loadReports = useCallback(() => {
    dispatch(fetchReports({
      status:        filterStatus        || undefined,
      targetModel:   filterTargetModel   || undefined,
      reason:        filterReason        || undefined,
      priority:      filterPriority      || undefined,
      escalated:     filterEscalated     || undefined,
      claimedByMe:   filterClaimedByMe   || undefined,
      unclaimedOnly: filterUnclaimedOnly || undefined,
      sortOrder:     filterSortOrder,
      page:          filterPage,
      limit:         filterLimit,
    }));
  }, [
    dispatch,
    filterStatus, filterTargetModel, filterReason, filterPriority,
    filterEscalated, filterClaimedByMe, filterUnclaimedOnly,
    filterSortOrder, filterPage, filterLimit,
  ]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleRowClick = useCallback((report) => {
    dispatch(fetchReportById(report._id));
  }, [dispatch]);

  const handleUpdate = useCallback(async (args) => {
    const res = await dispatch(updateReportStatus(args));
    if (!res.error) {
      showToast("Report updated successfully");
      dispatch(closeReport());
      loadReports();
    } else {
      showToast(res.payload ?? "Failed to update", "error");
    }
  }, [dispatch, showToast, loadReports]);

  const handleClaim = useCallback(async (args) => {
    const res = await dispatch(claimReport(args));
    if (res.error && res.payload?.code !== "ALREADY_CLAIMED") {
      showToast(res.payload?.message ?? "Failed to claim", "error");
    } else if (!res.error) {
      showToast("Report claimed — you have 30 min to review");
    }
  }, [dispatch, showToast]);

  const handleRelease = useCallback(async (id) => {
    const res = await dispatch(releaseReport(id));
    if (!res.error) showToast("Claim released");
    else showToast("Failed to release", "error");
  }, [dispatch, showToast]);

  const handleEscalate = useCallback(async ({ id, reason }) => {
    const res = await dispatch(escalateReport({ id, reason }));
    if (!res.error) showToast("Report escalated to senior admin");
    else showToast(res.payload ?? "Failed to escalate", "error");
  }, [dispatch, showToast]);

  const handleBulkSubmit = useCallback(async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    const [status, actionTaken = "none"] = bulkAction.split("|");
    const res = await dispatch(bulkUpdateReports({ ids: selectedIds, status, actionTaken }));
    if (!res.error) {
      showToast(`${res.payload.modifiedCount} report(s) updated`);
      setBulkAction("");
      loadReports();
    } else {
      showToast(res.payload ?? "Bulk update failed", "error");
    }
  }, [dispatch, bulkAction, selectedIds, showToast, loadReports]);

  const allSelected = reports.length > 0 && selectedIds.length === reports.length;

  const handleToggleSelectAll = useCallback(() => {
    allSelected ? dispatch(clearSelectedIds()) : dispatch(selectAllIds());
  }, [dispatch, allSelected]);

  const hasActiveFilters = useMemo(() =>
    !!(filterStatus || filterTargetModel || filterReason || filterPriority || filterEscalated || filterClaimedByMe || filterUnclaimedOnly),
    [filterStatus, filterTargetModel, filterReason, filterPriority, filterEscalated, filterClaimedByMe, filterUnclaimedOnly]
  );

  // Filter select rows — stable array referencing module-level option arrays
  const filterSelects = useMemo(() => [
    { value: filterTargetModel, onChange: (v) => dispatch(setFilters({ targetModel: v })),   options: TARGET_OPTIONS   },
    { value: filterReason,      onChange: (v) => dispatch(setFilters({ reason: v })),         options: REASON_OPTIONS   },
    { value: filterPriority,    onChange: (v) => dispatch(setFilters({ priority: v })),       options: PRIORITY_OPTIONS },
    { value: filterSortOrder,   onChange: (v) => dispatch(setFilters({ sortOrder: v })),      options: SORT_OPTIONS     },
  ], [dispatch, filterTargetModel, filterReason, filterPriority, filterSortOrder]);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 left-4 md:left-auto md:w-80 z-60 px-4 py-3 rounded-xl text-sm font-semibold
          shadow-lg border animate-in slide-in-from-top-2 fade-in duration-300
          ${toast.type === "error"
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
          {toast.msg}
        </div>
      )}

      {/* Detail panel */}
      {(selectedReport || detailLoading) && (
        <DetailPanel
          report={selectedReport}
          loading={detailLoading}
          actionLoading={actionLoading}
          claimLoading={claimLoading}
          escalateLoading={escalateLoading}
          claimError={claimError}
          history={reportHistory}
          historyLoading={historyLoading}
          currentAdminId={currentAdminId}
          onClose={() => { dispatch(closeReport()); dispatch(clearClaimError()); }}
          onUpdate={handleUpdate}
          onClaim={handleClaim}
          onRelease={handleRelease}
          onEscalate={handleEscalate}
        />
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 md:py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">Reports</h1>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">Review and action user-submitted reports</p>
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="md:hidden flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white
              text-sm font-semibold text-slate-600 shadow-sm hover:shadow-md hover:border-slate-300
              active:scale-[0.97] transition-all duration-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Filter
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-[#1e3a5f] animate-pulse" />}
          </button>
        </div>

        {/* Priority summary bar */}
        <PrioritySummaryBar priorities={priorities} />

        {/* Status tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1 mb-4 overflow-x-auto shadow-sm scrollbar-hide">
          {STATUS_TABS.map((tab) => {
            const count  = tab.key === "" ? counts.all : counts[tab.key] ?? 0;
            const active = filterStatus === tab.key;
            return (
              <button key={tab.key}
                onClick={() => dispatch(setFilters({ status: tab.key }))}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
                  whitespace-nowrap transition-all duration-200 active:scale-[0.97]
                  ${active
                    ? "bg-[#1e3a5f] text-white shadow-sm shadow-[#1e3a5f]/30"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}>
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-all duration-200
                  ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className={`${showFilters ? "block" : "hidden"} md:block mb-4`}>
          <div className="flex flex-wrap gap-2 md:gap-3">
            {filterSelects.map((sel, i) => (
              <select key={i}
                value={sel.value}
                onChange={(e) => sel.onChange(e.target.value)}
                className="flex-1 min-w-32 bg-white border border-slate-200 rounded-xl px-3 py-2
                  text-sm text-slate-700 focus:outline-none focus:border-[#1e3a5f]
                  focus:ring-2 focus:ring-[#1e3a5f]/10 shadow-sm
                  hover:border-slate-300 hover:shadow-md
                  transition-all duration-200 cursor-pointer appearance-none">
                {sel.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ))}

            <div className="flex gap-2 flex-wrap">
              {TOGGLE_PILLS.map(({ key, label }) => {
                const active = filters[key] === "true";
                return (
                  <button key={key}
                    onClick={() => dispatch(setFilters({ [key]: active ? "" : "true" }))}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border
                      transition-all duration-200 shadow-sm active:scale-[0.97]
                      ${active
                        ? "bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-[#1e3a5f]/20 shadow-md"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-md"}`}>
                    {label}
                  </button>
                );
              })}
            </div>

            {hasActiveFilters && (
              <button
                onClick={() => dispatch(resetFilters())}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-500
                  hover:text-slate-800 hover:bg-slate-50 hover:shadow-md hover:border-slate-300
                  active:scale-[0.97] shadow-sm transition-all duration-200">
                ✕ Reset
              </button>
            )}
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4 bg-[#1e3a5f]/5 border border-[#1e3a5f]/20
            rounded-2xl px-4 py-3 animate-in slide-in-from-top-1 fade-in duration-200">
            <span className="text-xs font-bold text-[#1e3a5f]">{selectedIds.length} selected</span>
            <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}
              className="flex-1 min-w-40 bg-white border border-[#1e3a5f]/20 rounded-xl px-3 py-1.5
                text-xs text-slate-700 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10
                transition-all duration-200">
              <option value="">Bulk action…</option>
              <option value="under_review|none">Mark Under Review</option>
              <option value="resolved_action_taken|content_removed">Resolve + Remove Content</option>
              <option value="dismissed|none">Dismiss All</option>
            </select>
            <button onClick={handleBulkSubmit} disabled={!bulkAction || bulkLoading}
              className="px-4 py-1.5 rounded-xl bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-xs font-bold
                transition-all duration-200 active:scale-[0.97] disabled:opacity-40
                hover:shadow-md hover:shadow-[#1e3a5f]/20 flex items-center gap-1.5">
              {bulkLoading && <Spinner size={12} className="text-white" />}
              Apply
            </button>
            <button
              onClick={() => dispatch(clearSelectedIds())}
              className="ml-auto text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100
                active:scale-[0.95] transition-all duration-150">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Desktop table */}
        <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-[28px_1fr_1fr_1fr_90px_120px_110px_32px] gap-3 px-4 py-3
            border-b border-slate-100 bg-slate-50/80">
            <input type="checkbox" checked={allSelected}
              onChange={handleToggleSelectAll}
              className="accent-[#1e3a5f] mt-0.5" />
            {["Reporter", "Target", "Reason", "Priority", "Status", "Date", ""].map((h, i) => (
              <p key={i} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{h}</p>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3">
              <Spinner size={28} /><p className="text-sm text-slate-400">Loading reports…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sm text-red-500 font-medium">{error}</p>
              <button onClick={loadReports}
                className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-semibold text-slate-600
                  hover:bg-slate-200 active:scale-[0.97] transition-all duration-150">
                Retry
              </button>
            </div>
          ) : reports.length === 0 ? (
            <EmptyState />
          ) : reports.map((report, idx) => {
            const selected = selectedIds.includes(report._id);
            return (
              <div key={report._id}
                style={{ animationDelay: `${idx * 30}ms` }}
                className={`grid grid-cols-[28px_1fr_1fr_1fr_90px_120px_110px_32px] gap-3 px-4 py-3.5
                  border-b border-slate-50 items-center cursor-pointer group
                  transition-all duration-150
                  hover:bg-slate-50/80 hover:shadow-[inset_3px_0_0_#1e3a5f]
                  animate-in fade-in slide-in-from-bottom-1
                  ${selected ? "bg-blue-50/30 shadow-[inset_3px_0_0_#1e3a5f]" : ""}`}
                onClick={() => handleRowClick(report)}>

                <input type="checkbox" checked={selected}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => dispatch(toggleSelectId(report._id))}
                  className="accent-[#1e3a5f]" />

                <div className="flex items-center gap-2 min-w-0">
                  <Avatar user={report.reportedBy} size={26} />
                  <p className="text-xs font-medium text-slate-700 truncate">@{report.reportedBy?.username ?? "—"}</p>
                </div>

                <TargetPreview report={report} />

                <p className="text-xs text-slate-600 truncate">{REASON_LABELS[report.reason] ?? report.reason}</p>

                <div className="flex flex-col gap-1">
                  <PriorityBadge priority={report.priority ?? "low"} />
                  {report.escalated && <EscalatedBadge />}
                </div>

                <StatusBadge status={report.status} />

                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-slate-400">{fmtDate(report.createdAt)}</p>
                  {report.claimedBy && <ClaimBadge claimedBy={report.claimedBy} />}
                </div>

                <svg className="w-4 h-4 text-slate-300 group-hover:text-[#1e3a5f] group-hover:translate-x-0.5
                  transition-all duration-200"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            );
          })}
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3">
              <Spinner size={28} /><p className="text-sm text-slate-400">Loading…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sm text-red-500 font-medium">{error}</p>
              <button onClick={loadReports}
                className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-semibold text-slate-600
                  hover:bg-slate-200 active:scale-[0.97] transition-all duration-150">
                Retry
              </button>
            </div>
          ) : reports.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="flex items-center gap-2 px-1">
                <input type="checkbox" checked={allSelected}
                  onChange={handleToggleSelectAll}
                  className="accent-[#1e3a5f]" />
                <span className="text-xs text-slate-500 font-medium">Select all</span>
              </div>
              {reports.map((report, idx) => (
                <div key={report._id}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  className="animate-in fade-in slide-in-from-bottom-1">
                  <MobileReportCard
                    report={report}
                    selected={selectedIds.includes(report._id)}
                    onSelect={() => dispatch(toggleSelectId(report._id))}
                    onClick={() => handleRowClick(report)}
                  />
                </div>
              ))}
            </>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 gap-2">
            <p className="text-xs text-slate-400 hidden sm:block">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
            </p>
            <p className="text-xs text-slate-400 sm:hidden">
              {pagination.page}/{pagination.totalPages}
            </p>
            <div className="flex gap-1.5">
              <button onClick={() => dispatch(setPage(filterPage - 1))}
                disabled={filterPage <= 1}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200
                  hover:bg-slate-50 hover:shadow-md hover:border-slate-300
                  active:scale-[0.97] text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed
                  transition-all duration-200 shadow-sm">
                ← Prev
              </button>
              <button onClick={() => dispatch(setPage(filterPage + 1))}
                disabled={filterPage >= pagination.totalPages}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200
                  hover:bg-slate-50 hover:shadow-md hover:border-slate-300
                  active:scale-[0.97] text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed
                  transition-all duration-200 shadow-sm">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}