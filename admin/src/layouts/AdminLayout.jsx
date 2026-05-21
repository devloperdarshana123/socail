// src/layouts/AdminLayout.jsx
import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { adminLogout  } from "../lib/redux/AdminauthSlice";

// ─── Nav Items ────────────────────────────────────────────────────────────────

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
    badge: true, // show count badge
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

// ─── Avatar ───────────────────────────────────────────────────────────────────

function AdminAvatar({ admin }) {
  const name = admin?.username || admin?.email || "A";
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-lg shadow-violet-900/40">
      {initials}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ collapsed, onToggle }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { admin } = useSelector((s) => s.adminAuth);
  const [loggingOut, setLoggingOut] = useState(false);

  // Pending reports count — wire this to your reportsSlice later
  const pendingReports = useSelector((s) => s.reports?.pendingCount ?? 0);

  const handleLogout = async () => {
    setLoggingOut(true);
    await dispatch(adminLogout());
    navigate("/", { replace: true });
  };

  return (
    <>
      {/* ── Sidebar panel ─────────────────────────────────────── */}
      <aside
        className={`
          fixed left-0 top-0 h-full z-30 flex flex-col
          bg-[#0b0f1a] border-r border-white/[0.06]
          transition-all duration-300 ease-in-out
          ${collapsed ? "w-[68px]" : "w-[220px]"}
        `}
      >
        {/* ── Logo / Brand ─────────────────────────────────────── */}
        <div className="flex items-center h-[60px] px-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Logo mark */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-900/50">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-white tracking-tight leading-none">Admin</p>
                <p className="text-[10px] text-white/30 mt-0.5 tracking-wider uppercase">Panel</p>
              </div>
            )}
          </div>

          {/* Collapse toggle */}
          <button
            onClick={onToggle}
            className={`ml-auto w-6 h-6 flex items-center justify-center rounded-md text-white/30 hover:text-white hover:bg-white/8 transition-colors flex-shrink-0 ${collapsed ? "mx-auto" : ""}`}
            title={collapsed ? "Expand" : "Collapse"}
          >
            <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        {/* ── Nav Links ─────────────────────────────────────────── */}
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
                    ? "bg-indigo-600/20 text-indigo-300"
                    : "text-white/40 hover:text-white/80 hover:bg-white/[0.05]"
                  }
                `}
              >
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r-full" />
                )}

                {/* Icon */}
                <span className={`w-5 h-5 flex-shrink-0 transition-colors ${isActive ? "text-indigo-400" : "text-white/35 group-hover:text-white/70"}`}>
                  {item.icon}
                </span>

                {/* Label */}
                {!collapsed && (
                  <span className="text-[13px] font-medium tracking-tight truncate">
                    {item.label}
                  </span>
                )}

                {/* Badge */}
                {item.badge && pendingReports > 0 && (
                  <span className={`
                    flex-shrink-0 min-w-[18px] h-[18px] rounded-full
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
                    bg-[#1a2035] border border-white/10 rounded-lg
                    text-xs font-medium text-white whitespace-nowrap
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

        {/* ── Bottom: Admin Info + Logout ──────────────────────── */}
        <div className="flex-shrink-0 border-t border-white/[0.06] p-2.5">
          {/* Admin info */}
          <div className={`flex items-center gap-2.5 px-2 py-2 rounded-xl mb-1 overflow-hidden ${collapsed ? "justify-center" : ""}`}>
            <AdminAvatar admin={admin} />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white/80 truncate leading-none">
                  {admin?.username || "Super Admin"}
                </p>
                <p className="text-[10px] text-white/30 mt-0.5 truncate">
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
              group w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl
              text-white/35 hover:text-rose-400 hover:bg-rose-500/10
              transition-all duration-150
              ${collapsed ? "justify-center" : ""}
            `}
          >
            <span className="w-5 h-5 flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            {!collapsed && (
              <span className="text-[13px] font-medium tracking-tight">Logout</span>
            )}
            {collapsed && (
              <span className="
                pointer-events-none absolute left-full ml-3 px-2.5 py-1.5
                bg-[#1a2035] border border-white/10 rounded-lg
                text-xs font-medium text-white whitespace-nowrap
                opacity-0 group-hover:opacity-100 transition-opacity duration-150
                shadow-xl z-50
              ">
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>

    </>
  );
}

// ─── Top Header ───────────────────────────────────────────────────────────────

function TopHeader({ collapsed }) {
  const location = useLocation();

  const pageTitle = {
    "/dashboard": "Dashboard",
    "/users": "Users",
    "/posts": "Posts",
    "/reports": "Reports",
    "/settings": "Settings",
  };

  // Match prefix for nested routes like /users/123
  const title =
    Object.entries(pageTitle).find(([path]) =>
      path === "/dashboard"
        ? location.pathname === "/dashboard"
        : location.pathname.startsWith(path)
    )?.[1] || "Admin";

  return (
    <header
      className={`
        fixed top-0 right-0 z-20 h-[60px]
        flex items-center px-6
        bg-[#0d1117]/80 backdrop-blur-md
        border-b border-white/[0.06]
        transition-all duration-300
        ${collapsed ? "left-[68px]" : "left-[220px]"}
      `}
    >
      <h1 className="text-[15px] font-semibold text-white/90 tracking-tight">{title}</h1>
    </header>
  );
}

// ─── AdminLayout ──────────────────────────────────────────────────────────────

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

  // Persist collapse preference
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
    <div className="min-h-screen bg-[#0d1117]">
      <Sidebar collapsed={collapsed} onToggle={handleToggle} />
      <TopHeader collapsed={collapsed} />

      {/* Main content area */}
      <main
        className={`
          transition-all duration-300 pt-[60px]
          ${collapsed ? "ml-[68px]" : "ml-[220px]"}
        `}
      >
        <Outlet />
      </main>
    </div>
  );
}