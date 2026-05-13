import { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { Search, X, User, Settings, LogOut, Menu, Bell } from "lucide-react";
import EroviansLogo from "../assets/seller_logo.png";
import { logoutUser } from "../lib/redux/authSlice";
import { resetProfile } from "../lib/redux/userProfileSlice";

const selectUser          = (state) => state.auth.user;
const selectLogoutLoading = (state) => state.auth.logout?.loading ?? false;

export default function Navbar({ onCreatePost }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const user          = useSelector(selectUser);
  const logoutLoading = useSelector(selectLogoutLoading);

  const [dropdownOpen,   setDropdownOpen]   = useState(false);
  const [showNotifs,     setShowNotifs]     = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen,     setSearchOpen]     = useState(false);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [activeLink,     setActiveLink]     = useState("Feed");

  const dropdownRef = useRef(null);
  const notifRef    = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (notifRef.current    && !notifRef.current.contains(e.target))    setShowNotifs(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
    setShowNotifs(false);
  }, [location.pathname]);

  const NAV_LINKS = [
    { label: "Feed",     path: "/feed" },
    { label: "Explore",  path: "/explore" },
    { label: "Messages", path: "/messages", badge: 3 },
    { label: "Saved",    path: "/saved" },
  ];

  const NOTIFS = [
    { type: "like",    name: "Rahul", text: "liked your post" },
    { type: "comment", name: "Priya", text: "commented on your post" },
    { type: "reply",   name: "Sara",  text: "replied to your comment" },
  ];

  const avatarUrl = user?.avatarUrl || user?.avatar?.url || null;
  const initials  = user?.fullName
    ? user.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const handleLogout = async () => {
    setDropdownOpen(false);
    await dispatch(logoutUser());
    navigate("/");
  };

  const AvatarCircle = ({ size = 36, fontSize = 14 }) => (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: avatarUrl ? `url(${avatarUrl}) center/cover no-repeat` : "#f0e8df",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize, fontWeight: 700, color: "#6b3f2a", flexShrink: 0,
      }}
    >
      {!avatarUrl && initials}
    </div>
  );

  return (
    <nav
      className="sticky top-0 w-full bg-white border-b border-gray-200"
      style={{ zIndex: 9999 }}
    >
      {/* ── MAIN ROW ── */}
      <div className="w-full px-4 flex items-center gap-2 h-14">

      {/* Hamburger */}
<button
  className="lg:hidden p-2 rounded-full hover:bg-gray-100 text-gray-500"
  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
>
  <Menu size={18} />
</button>

{/* Logo — mobile center (flex-1 se center) */}
<div className="lg:hidden flex-1 flex justify-center">
  <img src={EroviansLogo} alt="Erovians" className="h-8 w-auto object-contain" />
</div>

        {/* Logo — desktop */}
        <div
          className="hidden lg:flex items-center gap-3 shrink-0 cursor-pointer"
          onClick={() => navigate("/feed")}
        >
          <img src={EroviansLogo} alt="Erovians" className="h-10 w-auto object-contain" />
          <div className="w-px h-6 bg-gray-200" />
        </div>

        {/* Search — desktop */}
        <div className="hidden md:flex flex-1 max-w-sm border border-gray-300 rounded-lg overflow-hidden">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Users..."
            className="flex-1 px-3 py-2 text-sm outline-none text-gray-800"
            autoComplete="off"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="px-2 text-gray-400">
              <X size={13} />
            </button>
          )}
          <button
            className="px-3 flex items-center justify-center"
            style={{ background: "#1e3a5f", minWidth: 40 }}
          >
            <Search size={15} color="#fff" />
          </button>
        </div>

        {/* Nav Links — desktop */}
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
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="hidden lg:block flex-1" />

        {/* + Post button */}
        <button
          onClick={onCreatePost}
          className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-full hover:opacity-90 shrink-0"
          style={{ background: "#1e3a5f" }}
        >
          + Post
        </button>

        {/* Bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setShowNotifs(!showNotifs); setDropdownOpen(false); }}
            className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500"
          >
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          </button>

          {showNotifs && (
            <div
              className="absolute right-0 w-80 rounded-2xl shadow-xl border border-gray-100 bg-white overflow-hidden"
              style={{ top: "calc(100% + 8px)", zIndex: 9999 }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-800">Notifications</p>
                <button onClick={() => setShowNotifs(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
              {NOTIFS.map((n, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm"
                    style={{ background: n.type === "like" ? "#fff0f0" : n.type === "comment" ? "#f0f4ff" : "#f0fdf4" }}
                  >
                    {n.type === "like" ? "❤️" : n.type === "comment" ? "💬" : "↩️"}
                  </div>
                  <div>
                    <p className="text-xs text-gray-700">
                      <span className="font-semibold">{n.name}</span> {n.text}
                    </p>
                    <p className="text-[10px] text-gray-300 mt-0.5">just now</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile Search Icon */}
        <button
          className="md:hidden p-2 rounded-full hover:bg-gray-100 text-gray-500"
          onClick={() => setSearchOpen(!searchOpen)}
        >
          <Search size={18} />
        </button>

        {/* ── Avatar + Dropdown ── */}
        <div ref={dropdownRef} className="relative shrink-0">
          <button
            onClick={() => { setDropdownOpen(!dropdownOpen); setShowNotifs(false); }}
            className="p-1.5 rounded-xl hover:bg-gray-50"
          >
            <AvatarCircle size={30} fontSize={12} />
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 w-64 rounded-2xl shadow-xl border border-gray-100 overflow-hidden bg-white"
              style={{ top: "calc(100% + 8px)", zIndex: 9999 }}
            >
              {/* User Info */}
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                <AvatarCircle size={42} fontSize={16} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {user?.fullName || "User"}
                    {user?.isVerifiedBadge && (
                      <span className="ml-1 text-blue-500 text-xs">✓</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {user?.username ? `@${user.username}` : user?.email || ""}
                  </p>
                </div>
              </div>

              {/* Menu Items */}
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
                    <p className="text-xs text-gray-400">View your posts & info</p>
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
                    <p className="text-xs text-gray-400">Account & preferences</p>
                  </div>
                </button>
              </div>

              {/* Logout */}
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
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Users..."
              autoFocus
              className="flex-1 px-3 py-2 text-sm outline-none text-gray-800"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="px-2 text-gray-400">
                <X size={13} />
              </button>
            )}
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
                    {badge}
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