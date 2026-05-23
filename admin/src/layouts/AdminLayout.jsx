


// src/layouts/AdminLayout.jsx
import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { adminLogout } from "../lib/redux/AdminauthSlice";

const NAV_ITEMS = [
  {
    path: "/dashboard",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    path: "/users",
    label: "Users",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    path: "/posts",
    label: "Posts",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    path: "/reports",
    label: "Reports",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    ),
    badge: true,
  },
  {
    path: "/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

function AdminAvatar({ admin }) {
  const name = admin?.username || admin?.email || "A";
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md shadow-violet-200">
      {initials}
    </div>
  );
}

function Sidebar({ collapsed, onToggle }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { admin } = useSelector((s) => s.adminAuth);
  const [loggingOut, setLoggingOut] = useState(false);
  const pendingReports = useSelector((s) => s.reports?.pendingCount ?? 0);

  const handleLogout = async () => {
    setLoggingOut(true);
    await dispatch(adminLogout());
    navigate("/", { replace: true });
  };

  return (
    <aside
      className={`
        fixed left-0 top-0 h-full z-30 flex flex-col
        bg-white border-r border-slate-200
        transition-all duration-300 ease-in-out
        ${collapsed ? "w-17" : "w-55"}
      `}
    >
      {/* Logo */}
      <div className="flex items-center h-15 px-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md shadow-violet-200">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-800 tracking-tight leading-none">Admin</p>
              <p className="text-[10px] text-slate-400 mt-0.5 tracking-wider uppercase font-medium">Panel</p>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className={`ml-auto w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0 ${collapsed ? "mx-auto" : ""}`}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2.5 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === "/dashboard"
              ? location.pathname === "/dashboard"
              : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`
                group relative flex items-center gap-3 rounded-xl px-2.5 py-2.5
                transition-all duration-150 select-none
                ${isActive
                  ? "bg-violet-50 text-violet-700"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }
              `}
            >
              {/* Active indicator */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-violet-500 rounded-r-full" />
              )}

              {/* Icon */}
              <span className={`w-5 h-5 shrink-0 transition-colors ${isActive ? "text-violet-600" : "text-slate-400 group-hover:text-slate-600"}`}>
                {item.icon}
              </span>

              {/* Label */}
              {!collapsed && (
                <span className={`text-[13px] font-semibold tracking-tight truncate ${isActive ? "text-violet-700" : ""}`}>
                  {item.label}
                </span>
              )}

              {/* Badge */}
              {item.badge && pendingReports > 0 && (
                <span className={`
                  shrink-0 min-w-4.5 h-4.5 rounded-full
                  bg-rose-500 text-white text-[10px] font-bold
                  flex items-center justify-center px-1
                  ${collapsed ? "absolute -top-1 -right-1" : "ml-auto"}
                `}>
                  {pendingReports > 99 ? "99+" : pendingReports}
                </span>
              )}

              {/* Tooltip when collapsed */}
              {collapsed && (
                <span className="
                  pointer-events-none absolute left-full ml-3 px-2.5 py-1.5
                  bg-slate-800 rounded-lg
                  text-xs font-semibold text-white whitespace-nowrap
                  opacity-0 group-hover:opacity-100 transition-opacity duration-150
                  shadow-xl z-50
                ">
                  {item.label}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="shrink-0 border-t border-slate-100 p-2.5">
        {/* Admin info */}
        <div className={`flex items-center gap-2.5 px-2 py-2 rounded-xl mb-1 overflow-hidden ${collapsed ? "justify-center" : ""}`}>
          <AdminAvatar admin={admin} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-700 truncate leading-none">
                {admin?.username || "Super Admin"}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                {admin?.email || ""}
              </p>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title={collapsed ? "Logout" : undefined}
          className={`
            group relative w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl
            text-slate-400 hover:text-rose-600 hover:bg-rose-50
            transition-all duration-150 disabled:opacity-50
            ${collapsed ? "justify-center" : ""}
          `}
        >
          <span className="w-5 h-5 shrink-0">
            {loggingOut
              ? <svg className="animate-spin text-rose-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            }
          </span>
          {!collapsed && (
            <span className="text-[13px] font-semibold tracking-tight">
              {loggingOut ? "Logging out…" : "Logout"}
            </span>
          )}
          {collapsed && (
            <span className="
              pointer-events-none absolute left-full ml-3 px-2.5 py-1.5
              bg-slate-800 rounded-lg
              text-xs font-semibold text-white whitespace-nowrap
              opacity-0 group-hover:opacity-100 transition-opacity duration-150
              shadow-xl z-50
            ">
              Logout
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}



export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("adminSidebarCollapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const handleToggle = () => {
    setCollapsed((c) => {
      localStorage.setItem("adminSidebarCollapsed", String(!c));
      return !c;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar collapsed={collapsed} onToggle={handleToggle} />
      <main
        className={`
          transition-all duration-300 pt-15
          ${collapsed ? "ml-17" : "ml-55"}
        `}
      >
        <Outlet />
      </main>
    </div>
  );
}