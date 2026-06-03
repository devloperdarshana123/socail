
import { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Search, X, User, Settings, LogOut, Menu, Bell,
  Heart, MessageCircle, UserPlus, UserCheck, Repeat2,
} from "lucide-react";
import EroviansLogo from "../assets/seller_logo.png";
import { logoutUser } from "../lib/redux/authSlice";
import { selectTotalUnread } from "../lib/redux/chatSlice";
import { fetchNotifications, markAllRead } from "../lib/redux/notificationSlice";

// ── Selectors ─────────────────────────────────────────────────────────────────
const selectUser          = (s) => s.auth.user;
const selectLogoutLoading = (s) => s.auth.logout?.loading ?? false;
const selectAvatar        = (s) => s.userProfile?.avatar?.url || null;
// const selectNotifications = (s) => s.notifications.notifications;
const selectNotifications = (s) => s.notifications?.notifications ?? [];
const selectUnreadCount   = (s) => s.notifications.unreadCount;

// ── Notification helpers ──────────────────────────────────────────────────────
const NOTIF_CONFIG = {
  post_like:               { icon: (s) => <Heart       size={s} fill="#ef4444" color="#ef4444" />, bg: "#fff0f0", text: "liked your post" },
  like:                    { icon: (s) => <Heart       size={s} fill="#ef4444" color="#ef4444" />, bg: "#fff0f0", text: "liked your post" },
  post_comment:            { icon: (s) => <MessageCircle size={s} color="#4f46e5" />,               bg: "#f0f4ff", text: "commented on your post" },
  comment:                 { icon: (s) => <MessageCircle size={s} color="#4f46e5" />,               bg: "#f0f4ff", text: "commented on your post" },
  comment_reply:           { icon: (s) => <MessageCircle size={s} color="#4f46e5" />,               bg: "#f0f4ff", text: "replied to your comment" },
  comment_like:            { icon: (s) => <Heart       size={s} fill="#f97316" color="#f97316" />, bg: "#fff7ed", text: "liked your comment" },
  follow_request:          { icon: (s) => <UserPlus    size={s} color="#a855f7" />,                bg: "#fdf4ff", text: "sent you a follow request" },
  follow_request_accepted: { icon: (s) => <UserCheck   size={s} color="#22c55e" />,                bg: "#f0fdf4", text: "accepted your follow request" },
  follow:                  { icon: (s) => <UserPlus    size={s} color="#a855f7" />,                bg: "#fdf4ff", text: "started following you" },
  story_reaction:          { icon: (s) => <Heart       size={s} fill="#f97316" color="#f97316" />, bg: "#fff7ed", text: "reacted to your story" },
  story_reply:             { icon: (s) => <MessageCircle size={s} color="#f97316" />,               bg: "#fff7ed", text: "replied to your story" },
};
const getNotifCfg = (type) => NOTIF_CONFIG[type] ?? {
  icon: (s) => <Bell size={s} color="#6b7280" />,
  bg:   "#f9fafb",
  text: "sent you a notification",
};

// ── Time formatter ────────────────────────────────────────────────────────────
const fmtTime = (iso) => {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ─────────────────────────────────────────────────────────────────────────────

export default function Navbar({ onCreatePost }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const user          = useSelector(selectUser);
  const logoutLoading = useSelector(selectLogoutLoading);
  const profileAvatar = useSelector(selectAvatar);
  const totalUnread   = useSelector(selectTotalUnread);
  const notifications = useSelector(selectNotifications);
  const unreadCount   = useSelector(selectUnreadCount);

  const [dropdownOpen,   setDropdownOpen]   = useState(false);
  const [showNotifs,     setShowNotifs]     = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen,     setSearchOpen]     = useState(false);
  const [activeLink,     setActiveLink]     = useState("Feed");

  const dropdownRef = useRef(null);
  const notifRef    = useRef(null);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (notifRef.current    && !notifRef.current.contains(e.target))    setShowNotifs(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Fetch notifications on mount ─────────────────────────────────────────
  useEffect(() => {
    if (user?._id) dispatch(fetchNotifications());
  }, [user?._id, dispatch]);

  // ── Close panels on route change ─────────────────────────────────────────
  useEffect(() => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
    setShowNotifs(false);
  }, [location.pathname]);

  // ── Sync active nav link ──────────────────────────────────────────────────
  useEffect(() => {
    const map = {
      "/feed":     "Feed",
      "/explore":  "Explore",
      "/messages": "Messages",
      "/saved":    "Saved",
    };
    const match = map[location.pathname];
    if (match) setActiveLink(match);
  }, [location.pathname]);

  // ── Nav links ─────────────────────────────────────────────────────────────
  // NOTE: All socket events (notifications, messages, online) are handled
  //       exclusively in useSocketInit.js — Navbar has ZERO socket listeners.
  //       Toast for messages is shown by useSocketInit via react-hot-toast.
  const NAV_LINKS = [
    { label: "Feed",     path: "/feed" },
    { label: "Explore",  path: "/explore" },
    { label: "Messages", path: "/messages", badge: totalUnread },
    { label: "Saved",    path: "/saved" },
  ];

  const avatarUrl = profileAvatar || user?.avatarUrl || user?.avatar?.url || null;
  const initials  = user?.fullName
    ? user.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const handleLogout = async () => {
    setDropdownOpen(false);
    await dispatch(logoutUser());
    navigate("/");
  };

  const AvatarCircle = ({ size = 36, fontSize = 14 }) => (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: avatarUrl ? `url(${avatarUrl}) center/cover no-repeat` : "#f0e8df",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize, fontWeight: 700, color: "#6b3f2a", flexShrink: 0,
    }}>
      {!avatarUrl && initials}
    </div>
  );

  return (
    <nav className="sticky top-0 w-full bg-white border-b border-gray-200" style={{ zIndex: 9999 }}>

      {/* ── MAIN ROW ── */}
      <div className="w-full px-4 flex items-center gap-2 h-14">

        {/* Hamburger */}
        <button className="lg:hidden p-2 rounded-full hover:bg-gray-100 text-gray-500"
          onClick={() => setMobileMenuOpen((v) => !v)}>
          <Menu size={18} />
        </button>

        {/* Logo — mobile */}
        <div className="lg:hidden flex-1 flex justify-center">
          <img src={EroviansLogo} alt="Erovians" className="h-8 w-auto object-contain" />
        </div>

        {/* Logo — desktop */}
        <div className="hidden lg:flex items-center gap-3 shrink-0 cursor-pointer"
          onClick={() => navigate("/feed")}>
          <img src={EroviansLogo} alt="Erovians" className="h-10 w-auto object-contain" />
          <div className="w-px h-6 bg-gray-200" />
        </div>

        {/* Search — desktop */}
        <div className="hidden md:flex flex-1 max-w-sm border border-gray-300 rounded-lg overflow-hidden">
          <input type="text" placeholder="Search Users..."
            className="flex-1 px-3 py-2 text-sm outline-none text-gray-800" autoComplete="off" />
          <button className="px-3 flex items-center justify-center" style={{ background: "#1e3a5f", minWidth: 40 }}>
            <Search size={15} color="#fff" />
          </button>
        </div>

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-0.5 ml-1">
          {NAV_LINKS.map(({ label, path, badge }) => (
            <button
              key={label}
              onClick={() => { setActiveLink(label); navigate(path); }}
              className="relative px-3 py-1.5 text-sm rounded-lg transition hover:bg-stone-100 whitespace-nowrap"
              style={{
                color:      activeLink === label ? "#1e3a5f" : "#6b7280",
                fontWeight: activeLink === label ? 700 : 500,
                background: activeLink === label ? "#f0f4ff" : "transparent",
              }}
            >
              {label}
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="hidden lg:block flex-1" />

        {/* + Post */}
        <button
          onClick={onCreatePost}
          className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-full hover:opacity-90 shrink-0"
          style={{ background: "#1e3a5f" }}
        >
          + Post
        </button>

        {/* ── Bell + Notifications panel ── */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => {
              const opening = !showNotifs;
              setShowNotifs(opening);
              setDropdownOpen(false);
              if (opening) dispatch(markAllRead());
            }}
            className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div
              className="absolute right-0 w-80 rounded-2xl shadow-xl border border-gray-100 bg-white overflow-hidden"
              style={{ top: "calc(100% + 8px)", zIndex: 9999 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-800">Notifications</p>
                <button onClick={() => setShowNotifs(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>

              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-2xl mb-2">🔔</p>
                  <p className="text-xs text-gray-400">No notifications yet</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                  {notifications.map((n) => {
                    const cfg        = getNotifCfg(n.type);
                    const senderName = n.sender?.fullName || n.sender?.username || "Someone";
                    return (
                      <div
                        key={n._id}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${!n.isRead ? "bg-blue-50/40" : ""}`}
                      >
                        {/* Icon circle */}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: cfg.bg }}
                        >
                          {cfg.icon(15)}
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 leading-snug">
                            <span className="font-semibold">{senderName}</span>{" "}
                            {cfg.text}
                            {/* Show reaction emoji if available */}
                            {n.type === "story_reaction" && n.meta?.reaction
                              ? ` ${n.meta.reaction}`
                              : ""}
                          </p>
                          {n.text && (
                            <p className="text-[11px] text-gray-400 mt-0.5 truncate">"{n.text}"</p>
                          )}
                          <p className="text-[10px] text-gray-300 mt-0.5">{fmtTime(n.createdAt)}</p>
                        </div>

                        {/* Unread dot */}
                        {!n.isRead && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile search toggle */}
        <button className="md:hidden p-2 rounded-full hover:bg-gray-100 text-gray-500"
          onClick={() => setSearchOpen((v) => !v)}>
          <Search size={18} />
        </button>

        {/* ── Avatar + Dropdown ── */}
        <div ref={dropdownRef} className="relative shrink-0">
          <button
            onClick={() => { setDropdownOpen((v) => !v); setShowNotifs(false); }}
            className="p-1.5 rounded-xl hover:bg-gray-50"
          >
            <AvatarCircle size={30} fontSize={12} />
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 w-64 rounded-2xl shadow-xl border border-gray-100 overflow-hidden bg-white"
              style={{ top: "calc(100% + 8px)", zIndex: 9999 }}
            >
              {/* User info */}
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                <AvatarCircle size={42} fontSize={16} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {user?.fullName || "User"}
                    {user?.isVerifiedBadge && <span className="ml-1 text-blue-500 text-xs">✓</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {user?.username ? `@${user.username}` : user?.email || ""}
                  </p>
                </div>
              </div>

              <div className="py-1.5">
                <button
                  onClick={() => { navigate("/profile"); setDropdownOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#f0e8df" }}>
                    <User size={13} style={{ color: "#6b3f2a" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">My Profile</p>
                    <p className="text-xs text-gray-400">View your posts &amp; info</p>
                  </div>
                </button>
                <button
                  onClick={() => { navigate("/settings"); setDropdownOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#f0f4ff" }}>
                    <Settings size={13} style={{ color: "#4f46e5" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Settings</p>
                    <p className="text-xs text-gray-400">Account &amp; preferences</p>
                  </div>
                </button>
              </div>

              <div className="border-t border-gray-100 py-1.5">
                <button
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-left disabled:opacity-50"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#fff0f0" }}>
                    <LogOut size={13} style={{ color: "#ef4444" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-500">
                      {logoutLoading ? "Signing out…" : "Sign Out"}
                    </p>
                    <p className="text-xs text-gray-400">End your session</p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE SEARCH ── */}
      {searchOpen && (
        <div className="md:hidden px-3 pb-2.5">
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <input type="text" placeholder="Search Users..." autoFocus
              className="flex-1 px-3 py-2 text-sm outline-none text-gray-800" />
            <button className="px-3 flex items-center" style={{ background: "#1e3a5f", minWidth: 40 }}>
              <Search size={15} color="#fff" />
            </button>
          </div>
        </div>
      )}

      {/* ── MOBILE NAV MENU ── */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-100 px-3 py-2 bg-white">
          <div className="flex flex-col gap-0.5">
            {NAV_LINKS.map(({ label, path, badge }) => (
              <button
                key={label}
                onClick={() => { setActiveLink(label); navigate(path); setMobileMenuOpen(false); }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm rounded-xl hover:bg-stone-50"
                style={{
                  color:      activeLink === label ? "#1e3a5f" : "#374151",
                  fontWeight: activeLink === label ? 700 : 500,
                  background: activeLink === label ? "#f0f4ff" : "transparent",
                }}
              >
                <span>{label}</span>
                {badge > 0 && (
                  <span className="min-w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => { onCreatePost(); setMobileMenuOpen(false); }}
              className="w-full flex items-center justify-center gap-1.5 mt-2 px-4 py-2.5 text-sm font-semibold text-white rounded-xl"
              style={{ background: "#1e3a5f" }}
            >
              + Post
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}