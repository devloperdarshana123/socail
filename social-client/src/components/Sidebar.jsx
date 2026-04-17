import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSelector } from "react-redux";
import { useSocket } from "../context/SocketContext";
import { useDispatch } from "react-redux";
import { useEffect } from "react";
import { incrementFollowRequest } from "../store/slices/Exploreslice";
import {
  LayoutGrid, Telescope, Store, MessageCircle, UserCheck,
  BookMarked, UserCircle, Settings, Plus, LogOut, X, PanelLeftClose, PanelLeftOpen
} from "lucide-react";
const Avatar = ({ src, name, size = "w-10 h-10", textSize = "text-sm" }) =>
  src ? (
    <img src={src} alt="avatar" className={`${size} rounded-full object-cover shrink-0`} />
  ) : (
    <div className={`${size} rounded-full bg-linear-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold ${textSize} shrink-0`}>
      {name?.charAt(0).toUpperCase()}
    </div>
  );

export default function Sidebar({
  onCreatePost,
  drawerOpen,
  setDrawerOpen,
  stats,
  sidebarOpen,
  setSidebarOpen
}){
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { followRequestCount } = useSelector((s) => s.explore);

  const { totalUnread }        = useSelector((s) => s.messages);
const { socket } = useSocket();
const dispatch = useDispatch();

// ✅ Ab — same function reference use karo:
useEffect(() => {
  if (!socket) return;
  const handler = (data) => {
    dispatch(incrementFollowRequest());
  };
  socket.on("follow_request_received", handler);
  return () => {
    socket.off("follow_request_received", handler); // ← handler pass karo
  };
}, [socket, dispatch]);
  
  const navItems = [
  { path: "/feed",            label: "Feed",            icon: <LayoutGrid size={20} />,    badge: null },
  { path: "/explore",         label: "Explore",         icon: <Telescope size={20} />,     badge: null },
  { path: "/marketplace",     label: "Marketplace",     icon: <Store size={20} />,         badge: null },
{ path: "/messages", label: "Messages", icon: <MessageCircle size={20} />, badge: totalUnread || null },
  { path: "/follow-requests", label: "Follow Requests", icon: <UserCheck size={20} />, badge: followRequestCount || null },
  { path: "/saved",           label: "Saved Posts",     icon: <BookMarked size={20} />,    badge: null },
  { path: "/profile",         label: "My Profile",      icon: <UserCircle size={20} />,    badge: null },
  { path: "/settings",        label: "Settings",        icon: <Settings size={20} />,      badge: null },
];

  const NavContent = ({ onNavigate }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
      <button
        onClick={() => { onCreatePost(); onNavigate?.(); }}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white mb-3 hover:opacity-90 transition"
        style={{ background: "#1e3a5f" }}
      >
        <Plus size={16} /> Create Post
      </button>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.label}
              onClick={() => { navigate(item.path); onNavigate?.(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition group
                ${active ? "text-white" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
              style={active ? { background: "#1e3a5f" } : {}}
            >
              <span className={active ? "text-white" : "text-gray-400 group-hover:text-gray-700"}>
                {item.icon}
              </span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
        
      </nav>

      <div className="border-t border-gray-100 my-2" />

      <button
        onClick={() => { logout(); onNavigate?.(); }}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition group"
      >
        <LogOut size={18} className="text-red-400 group-hover:text-red-500" />
        <span className="flex-1 text-left">Log Out</span>
      </button>
    </div>
  );

  return (
    <>

{/* DESKTOP SIDEBAR */}
<div
  className={`hidden lg:flex flex-col shrink-0 transition-all duration-300 ${
    sidebarOpen ? "w-64" : "w-14"
  }`}
>
  {sidebarOpen && <NavContent />}

  {!sidebarOpen && (
    <div className="flex flex-col items-center gap-1 pt-1">
      <button
        onClick={() => onCreatePost()}
        className="w-10 h-10 flex items-center justify-center rounded-xl text-white hover:opacity-90 transition"
        style={{ background: "#1e3a5f" }}
        title="Create Post"
      >
        <Plus size={18} />
      </button>
      {navItems.map((item) => {
        const active = location.pathname === item.path;
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            title={item.label}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition relative
              ${active ? "text-white" : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"}`}
            style={active ? { background: "#1e3a5f" } : {}}
          >
            {item.icon}
            {item.badge && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
        <button
        onClick={() => logout()}
        title="Log Out"
        className="w-10 h-10 flex items-center justify-center rounded-xl transition text-red-400 hover:bg-red-50"
      >
        <LogOut size={18} />
      </button>
    </div>
  )}

  {/* Toggle button - bilkul neeche sticky */}
  <div className={`mt-auto flex ${sidebarOpen ? "justify-end px-2" : "justify-center"} py-3`}>
    <button
      onClick={() => setSidebarOpen(prev => !prev)}
      className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
      style={{ color: "#1e3a5f" }}
      title={sidebarOpen ? "Close Sidebar" : "Open Sidebar"}
    >
      {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
    </button>
  </div>
</div>
      {/* MOBILE DRAWER OVERLAY */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden
          ${drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* MOBILE DRAWER */}
      <div
        className="fixed top-0 left-0 z-50 h-full w-72 bg-gray-50 shadow-2xl transition-transform duration-300 ease-in-out lg:hidden flex flex-col"
        style={{ transform: drawerOpen ? "translateX(0)" : "translateX(-100%)" }}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <Avatar src={user?.avatar} name={user?.name} size="w-9 h-9" textSize="text-sm" />
            <div>
              <p className="text-sm font-bold text-gray-800">{user?.name}</p>
              <span className="text-xs text-gray-500">{user?.designation?.trim() || "EroSocial Member"}</span>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <NavContent onNavigate={() => setDrawerOpen(false)} />
        </div>

        {stats && (
          <div className="px-5 py-4 border-t border-gray-100 bg-white flex gap-6 text-center">
            {[
              { label: "Posts",     value: stats.posts     },
              { label: "Followers", value: stats.followers },
              { label: "Following", value: stats.following },
            ].map(({ label, value }) => (
              <div key={label} className="flex-1">
                <p className="text-sm font-bold text-gray-800">{value}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}