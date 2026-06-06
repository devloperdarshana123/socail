import { useState, useRef, useEffect } from "react";
import { Bell, X, Users, Flag, CheckCheck } from "lucide-react";
import { useAdminNotifications } from "../hooks/useAdminNotifications";

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60)   return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function NotificationIcon({ type }) {
  if (type === "admin_new_user")   return <Users size={14} className="text-violet-500" />;
  if (type === "admin_new_report") return <Flag  size={14} className="text-red-500" />;
  return <Bell size={14} className="text-slate-400" />;
}

export default function AdminNotificationBell() {
  const { notifications, unreadCount, markAllRead, clearAll } = useAdminNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open && unreadCount > 0) markAllRead();
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center
          rounded-xl border border-slate-200 bg-white hover:bg-slate-50
          transition-colors shadow-sm"
      >
        <Bell size={18} className="text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500
            text-white text-[10px] font-bold rounded-full flex items-center
            justify-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white border border-slate-200
          rounded-2xl shadow-xl z-50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3
            border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllRead}
                    className="text-[10px] text-violet-600 hover:text-violet-700
                      font-semibold flex items-center gap-1"
                  >
                    <CheckCheck size={12} />
                    Mark all read
                  </button>
                  <button
                    onClick={clearAll}
                    className="text-[10px] text-slate-400 hover:text-slate-600
                      font-semibold flex items-center gap-1"
                  >
                    <X size={12} />
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell size={24} className="text-slate-300" />
                <p className="text-xs text-slate-400 font-medium">No notifications yet</p>
              </div>
            ) : (
            notifications.map((n) => (
  <div key={n._id ?? n.createdAt}
                  className={`flex items-start gap-3 px-4 py-3 border-b
                    border-slate-50 last:border-0 transition-colors
                    ${!n.isRead ? "bg-violet-50/50" : "bg-white"}`}
                >
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center
                    justify-center shrink-0 mt-0.5">
                    <NotificationIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700">{n.label}</p>
                    {n.meta?.username && (
                      <p className="text-[11px] text-slate-500 truncate">
                        @{n.meta.username}
                      </p>
                    )}
                    {n.meta?.fullName && !n.meta?.username && (
                      <p className="text-[11px] text-slate-500 truncate">
                        {n.meta.fullName}
                      </p>
                    )}
                    {n.meta?.reason && (
                      <p className="text-[11px] text-slate-500 truncate capitalize">
                        {n.meta.reason.replaceAll("_", " ")}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}