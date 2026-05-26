import { useEffect, useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchReports, fetchReportById, updateReportStatus, bulkUpdateReports,
  setFilters, setPage, resetFilters,
  openReport, closeReport,
  toggleSelectId, selectAllIds, clearSelectedIds,
  selectReports, selectReportsLoading, selectReportsError,
  selectReportsPagination, selectReportsCounts, selectReportsFilters,
  selectSelectedReport, selectDetailLoading, selectActionLoading,
  selectBulkLoading, selectSelectedIds,
} from "../lib/redux/reportsSlice";

// ─────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: "",                      label: "All"           },
  { key: "pending",               label: "Pending"       },
  { key: "under_review",          label: "Under Review"  },
  { key: "resolved_action_taken", label: "Action Taken"  },
  { key: "resolved_no_action",    label: "No Action"     },
  { key: "dismissed",             label: "Dismissed"     },
];

const REASON_LABELS = {
  spam:                      "Spam",
  nudity_or_sexual_content:  "Nudity / Sexual",
  hate_speech:               "Hate Speech",
  violence_or_dangerous:     "Violence",
  harassment_or_bullying:    "Harassment",
  false_information:         "False Info",
  intellectual_property:     "IP Violation",
  self_harm_or_suicide:      "Self Harm",
  scam_or_fraud:             "Scam / Fraud",
  illegal_activity:          "Illegal Activity",
  other:                     "Other",
};

const ACTION_OPTIONS = [
  { value: "none",             label: "No action"       },
  { value: "user_warned",      label: "Warn user"       },
  { value: "content_removed",  label: "Remove content"  },
  { value: "user_suspended",   label: "Suspend user"    },
  { value: "user_banned",      label: "Ban user"        },
  { value: "other",            label: "Other"           },
];

const STATUS_OPTIONS = [
  { value: "under_review",          label: "Mark Under Review"  },
  { value: "resolved_action_taken", label: "Resolve — Action Taken" },
  { value: "resolved_no_action",    label: "Resolve — No Action"    },
  { value: "dismissed",             label: "Dismiss"             },
];

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function avatarUrl(user) {
  if (!user) return null;
  const av = user.avatar;
  if (!av) return null;
  if (typeof av === "string") return av;
  return av.url ?? av.secure_url ?? null;
}

// ─────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────

function Avatar({ user, size = 32 }) {
  const url = avatarUrl(user);
  const s   = `${size}px`;
  const colors = ["bg-violet-500","bg-sky-500","bg-emerald-500","bg-amber-500","bg-rose-500"];
  const color  = colors[(user?.username?.charCodeAt(0) ?? 0) % colors.length];
  const initials = (user?.fullName ?? user?.username ?? "?")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  if (url) {
    return (
      <img src={url} alt={user?.username ?? ""}
        style={{ width: s, height: s }}
        className="rounded-full object-cover shrink-0" />
    );
  }
  return (
    <div style={{ width: s, height: s, fontSize: size * 0.38 }}
      className={`${color} rounded-full flex items-center justify-center
        font-bold text-white shrink-0`}>
      {initials}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending:               "bg-amber-50 text-amber-700 border-amber-200",
    under_review:          "bg-sky-50 text-sky-700 border-sky-200",
    resolved_action_taken: "bg-emerald-50 text-emerald-700 border-emerald-200",
    resolved_no_action:    "bg-slate-100 text-slate-600 border-slate-200",
    dismissed:             "bg-rose-50 text-rose-600 border-rose-200",
  };
  const label = {
    pending:               "Pending",
    under_review:          "Under Review",
    resolved_action_taken: "Action Taken",
    resolved_no_action:    "No Action",
    dismissed:             "Dismissed",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full
      text-[11px] font-semibold border ${map[status] ?? map.pending}`}>
      {label[status] ?? status}
    </span>
  );
}

function TargetPreview({ report }) {
  const { targetModel, targetId } = report;
  if (!targetId) return <span className="text-slate-400 text-xs">—</span>;

  if (targetModel === "Post") {
    const media = targetId.media?.[0];
    return (
      <div className="flex items-center gap-2">
        {media?.url ? (
          <img src={media.url} alt=""
            className="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-100" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-700 truncate max-w-36">
            {targetId.caption || "(no caption)"}
          </p>
          <p className="text-[10px] text-slate-400">Post</p>
        </div>
      </div>
    );
  }

  if (targetModel === "User") {
    return (
      <div className="flex items-center gap-2">
        <Avatar user={targetId} size={28} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-700 truncate max-w-36">
            @{targetId.username}
          </p>
          <p className="text-[10px] text-slate-400">User</p>
        </div>
      </div>
    );
  }

  return <span className="text-xs text-slate-500">{targetModel}</span>;
}

// ── Spinner ───────────────────────────────────────────────────
function Spinner({ size = 20 }) {
  return (
    <svg style={{ width: size, height: size }} className="animate-spin text-violet-400"
      fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
//  Detail Panel
// ─────────────────────────────────────────────────────────────

function DetailPanel({ report, loading, actionLoading, onClose, onUpdate }) {
  const [status,        setStatus]        = useState("");
  const [actionTaken,   setActionTaken]   = useState("none");
  const [moderatorNote, setModeratorNote] = useState("");
  const [submitted,     setSubmitted]     = useState(false);

  useEffect(() => {
    if (report) {
      setStatus("");
      setActionTaken("none");
      setModeratorNote("");
      setSubmitted(false);
    }
  }, [report?._id]);

  if (!report && !loading) return null;

 const busy = !!actionLoading && actionLoading === report?._id;

  const handleSubmit = () => {
    if (!status) return;
    setSubmitted(true);
    onUpdate({ id: report._id, status, actionTaken, moderatorNote });
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Report Detail</h2>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">#{report?._id?.slice(-8)}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center
              justify-center transition-colors text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner size={32} />
          </div>
        ) : report ? (
          <div className="flex-1 p-5 space-y-5">

            {/* Status + reason */}
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={report.status} />
              <span className="inline-flex items-center px-2 py-0.5 rounded-full
                text-[11px] font-semibold border bg-slate-100 text-slate-600 border-slate-200">
                {REASON_LABELS[report.reason] ?? report.reason}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full
                text-[11px] font-semibold border bg-slate-100 text-slate-600 border-slate-200">
                {report.targetModel}
              </span>
            </div>

            {/* Reported by */}
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Reported by
              </p>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <Avatar user={report.reportedBy} size={36} />
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {report.reportedBy?.fullName ?? "—"}
                  </p>
                  <p className="text-xs text-slate-400">@{report.reportedBy?.username}</p>
                </div>
                <p className="ml-auto text-[11px] text-slate-400">{fmtDate(report.createdAt)}</p>
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
                    {report.targetId.media?.[0]?.url && (
                      <img src={report.targetId.media[0].url} alt=""
                        className="w-full h-40 object-cover rounded-lg" />
                    )}
                    {report.targetId.caption && (
                      <p className="text-xs text-slate-700 leading-relaxed line-clamp-4">
                        {report.targetId.caption}
                      </p>
                    )}
                    {report.targetId.author && (
                      <div className="flex items-center gap-2 pt-1">
                        <Avatar user={report.targetId.author} size={20} />
                        <p className="text-[11px] text-slate-500">
                          by @{report.targetId.author.username}
                        </p>
                      </div>
                    )}
                  </div>
                ) : report.targetModel === "User" && report.targetId ? (
                  <div className="flex items-center gap-3">
                    <Avatar user={report.targetId} size={40} />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {report.targetId.fullName}
                      </p>
                      <p className="text-xs text-slate-400">@{report.targetId.username}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Target no longer available</p>
                )}
              </div>
              {report.otherReportsOnTarget > 0 && (
                <p className="text-[11px] text-amber-600 mt-1.5 font-medium">
                  ⚠ {report.otherReportsOnTarget} other report(s) on this {report.targetModel.toLowerCase()}
                </p>
              )}
            </div>

            {/* Description */}
            {report.description && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Reporter's note
                </p>
                <p className="text-xs text-slate-700 bg-slate-50 rounded-xl p-3
                  border border-slate-100 leading-relaxed">
                  {report.description}
                </p>
              </div>
            )}

            {/* Previous action */}
            {report.status !== "pending" && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Previous review
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <div className="flex items-center gap-2">
                    {report.reviewedBy && <Avatar user={report.reviewedBy} size={20} />}
                    <p className="text-xs text-slate-600">
                      {report.reviewedBy?.username ?? "—"} · {fmtDateTime(report.reviewedAt)}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    Action: <span className="font-semibold">{report.actionTaken ?? "none"}</span>
                  </p>
                </div>
              </div>
            )}

            {/* ── Action form ── */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                Take action
              </p>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">New status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2
                    text-sm text-slate-700 focus:outline-none focus:border-violet-400">
                  <option value="">Select status…</option>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Action taken</label>
                <select value={actionTaken} onChange={(e) => setActionTaken(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2
                    text-sm text-slate-700 focus:outline-none focus:border-violet-400">
                  {ACTION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Moderator note <span className="text-slate-400 font-normal">(internal)</span>
                </label>
                <textarea value={moderatorNote} onChange={(e) => setModeratorNote(e.target.value)}
                  rows={3} placeholder="Internal notes — not visible to users"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2
                    text-sm text-slate-700 placeholder-slate-400 resize-none
                    focus:outline-none focus:border-violet-400"/>
              </div>

              <button onClick={handleSubmit}
                disabled={!status || busy}
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500
                  text-white text-sm font-semibold transition-colors
                  disabled:opacity-40 flex items-center justify-center gap-2">
                {busy && <Spinner size={16} />}
                {busy ? "Saving…" : "Submit decision"}
              </button>
            </div>

          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const dispatch      = useDispatch();
  const reports       = useSelector(selectReports);
  const loading       = useSelector(selectReportsLoading);
  const error         = useSelector(selectReportsError);
  const pagination    = useSelector(selectReportsPagination);
  const counts        = useSelector(selectReportsCounts);
  const filters       = useSelector(selectReportsFilters);
  const selectedReport = useSelector(selectSelectedReport);
  const detailLoading = useSelector(selectDetailLoading);
  const actionLoading = useSelector(selectActionLoading);
  const bulkLoading   = useSelector(selectBulkLoading);
  const selectedIds   = useSelector(selectSelectedIds);

  const [toast,      setToast]      = useState(null);
  const [bulkAction, setBulkAction] = useState("");

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Fetch on filter change ────────────────────────────────────
  useEffect(() => {
    dispatch(fetchReports({
      status:      filters.status      || undefined,
      targetModel: filters.targetModel || undefined,
      reason:      filters.reason      || undefined,
      sortOrder:   filters.sortOrder,
      page:        filters.page,
      limit:       filters.limit,
    }));
  }, [filters, dispatch]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleRowClick = (report) => {
    dispatch(fetchReportById(report._id));
  };

 const handleUpdate = async (args) => {
  const res = await dispatch(updateReportStatus(args));
  if (!res.error) {
    showToast("Report updated successfully");
    dispatch(closeReport());          // ← yeh add karo
    dispatch(fetchReports({
      status:      filters.status      || undefined,
      targetModel: filters.targetModel || undefined,
      page:        filters.page,
      limit:       filters.limit,
    }));
  } else {
    showToast(res.payload ?? "Failed to update", "error");
  }
};

  const handleBulkSubmit = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    const [status, actionTaken = "none"] = bulkAction.split("|");
    const res = await dispatch(bulkUpdateReports({ ids: selectedIds, status, actionTaken }));
    if (!res.error) {
      showToast(`${res.payload.modifiedCount} report(s) updated`);
      setBulkAction("");
      dispatch(fetchReports({ page: filters.page, limit: filters.limit }));
    } else {
      showToast(res.payload ?? "Bulk update failed", "error");
    }
  };

  const allSelected =
    reports.length > 0 && selectedIds.length === reports.length;

  // ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl text-sm
          font-semibold shadow-lg border transition-all
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
          onClose={() => dispatch(closeReport())}
          onUpdate={handleUpdate}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Review and action user-submitted reports
          </p>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl
          p-1 mb-5 overflow-x-auto shadow-sm">
          {STATUS_TABS.map((tab) => {
            const count = tab.key === "" ? counts.all : counts[tab.key] ?? 0;
            const active = filters.status === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => dispatch(setFilters({ status: tab.key }))}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs
                  font-semibold whitespace-nowrap transition-all duration-150
                  ${active
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}
              >
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
                  ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap gap-3 mb-5">
          <select
            value={filters.targetModel}
            onChange={(e) => dispatch(setFilters({ targetModel: e.target.value }))}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm
              text-slate-700 focus:outline-none focus:border-violet-400 shadow-sm"
          >
            <option value="">All types</option>
            <option value="Post">Post</option>
            <option value="User">User</option>
            <option value="Comment">Comment</option>
          </select>

          <select
            value={filters.reason}
            onChange={(e) => dispatch(setFilters({ reason: e.target.value }))}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm
              text-slate-700 focus:outline-none focus:border-violet-400 shadow-sm"
          >
            <option value="">All reasons</option>
            {Object.entries(REASON_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            value={filters.sortOrder}
            onChange={(e) => dispatch(setFilters({ sortOrder: e.target.value }))}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm
              text-slate-700 focus:outline-none focus:border-violet-400 shadow-sm"
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>

          {(filters.status || filters.targetModel || filters.reason) && (
            <button
              onClick={() => dispatch(resetFilters())}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white
                text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50
                shadow-sm transition-colors"
            >
              Reset filters
            </button>
          )}

          {/* Bulk action bar — shows when rows selected */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 ml-auto bg-violet-50
              border border-violet-200 rounded-xl px-3 py-1.5">
              <span className="text-xs font-semibold text-violet-700">
                {selectedIds.length} selected
              </span>
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="bg-white border border-violet-200 rounded-lg px-2 py-1
                  text-xs text-slate-700 focus:outline-none"
              >
                <option value="">Bulk action…</option>
                <option value="under_review|none">Mark Under Review</option>
                <option value="resolved_action_taken|content_removed">Resolve + Remove Content</option>
                <option value="dismissed|none">Dismiss All</option>
              </select>
              <button
                onClick={handleBulkSubmit}
                disabled={!bulkAction || bulkLoading}
                className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500
                  text-white text-xs font-bold transition-colors disabled:opacity-40
                  flex items-center gap-1"
              >
                {bulkLoading && <Spinner size={12} />}
                Apply
              </button>
              <button
                onClick={() => dispatch(clearSelectedIds())}
                className="text-violet-400 hover:text-violet-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

          {/* Table header */}
          <div className="grid grid-cols-[28px_1fr_1fr_1fr_120px_100px_40px]
            gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => allSelected
                ? dispatch(clearSelectedIds())
                : dispatch(selectAllIds())}
              className="accent-violet-600 mt-0.5"
            />
            {["Reporter","Target","Reason","Status","Date",""].map((h, i) => (
              <p key={i} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                {h}
              </p>
            ))}
          </div>

          {/* Rows */}
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3">
              <Spinner size={28} />
              <p className="text-sm text-slate-400">Loading reports…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sm text-red-500 font-medium">{error}</p>
              <button onClick={() => dispatch(fetchReports(filters))}
                className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-semibold
                  text-slate-600 hover:bg-slate-200 transition-colors">
                Retry
              </button>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-500">No reports found</p>
            </div>
          ) : (
            reports.map((report) => {
              const selected = selectedIds.includes(report._id);
              return (
                <div
                  key={report._id}
                  className={`grid grid-cols-[28px_1fr_1fr_1fr_120px_100px_40px]
                    gap-3 px-4 py-3.5 border-b border-slate-50 items-center
                    hover:bg-slate-50 transition-colors cursor-pointer
                    ${selected ? "bg-violet-50/50" : ""}`}
                  onClick={() => handleRowClick(report)}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => dispatch(toggleSelectId(report._id))}
                    className="accent-violet-600"
                  />

                  {/* Reporter */}
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar user={report.reportedBy} size={28} />
                    <p className="text-xs font-medium text-slate-700 truncate">
                      @{report.reportedBy?.username ?? "—"}
                    </p>
                  </div>

                  {/* Target */}
                  <TargetPreview report={report} />

                  {/* Reason */}
                  <p className="text-xs text-slate-600 truncate">
                    {REASON_LABELS[report.reason] ?? report.reason}
                  </p>

                  {/* Status */}
                  <StatusBadge status={report.status} />

                  {/* Date */}
                  <p className="text-[11px] text-slate-400">{fmtDate(report.createdAt)}</p>

                  {/* Arrow */}
                  <svg className="w-4 h-4 text-slate-300" fill="none"
                    stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-slate-400">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => dispatch(setPage(filters.page - 1))}
                disabled={filters.page <= 1}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white
                  border border-slate-200 hover:bg-slate-50 text-slate-600
                  disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                ← Prev
              </button>
              <button
                onClick={() => dispatch(setPage(filters.page + 1))}
                disabled={filters.page >= pagination.totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white
                  border border-slate-200 hover:bg-slate-50 text-slate-600
                  disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                Next →
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}