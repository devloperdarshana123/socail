


import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { LogOut, Search, X, User, Settings} from "lucide-react";
import EroviansLogo from "../assets/seller_logo.png";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9001";

export default function Navbar({ onSearch, onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery]     = useState("");
  const [searchOpen, setSearchOpen]       = useState(false);
  const [dropdownOpen, setDropdownOpen]   = useState(false);

  // Search dropdown state
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults]     = useState(false);

  const dropdownRef   = useRef(null);
  const searchRef     = useRef(null);
  const debounceTimer = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target))
        setShowResults(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live search with debounce
  const fetchUsers = useCallback(async (q) => {
    if (!q.trim()) { setSearchResults([]); setShowResults(false); return; }
    setSearchLoading(true);
    try {
      const token = localStorage.getItem("erosocial_token");
      const res = await axios.get(`${BASE_URL}/api/follow/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSearchResults(res.data.users || []);
      setShowResults(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (onSearch) onSearch(val);

    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchUsers(val), 350);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
    if (onSearch) onSearch("");
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(searchQuery);
  };

  const handleUserClick = (userId) => {
    setShowResults(false);
    setSearchQuery("");
    navigate(`/user/${userId}`);
  };

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
  };

  return (
    <nav
      className="sticky top-0 z-50 w-full"
      style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb" }}
    >
      {/* MAIN ROW */}
      <div className="w-full px-4 py-3 flex items-center justify-between gap-3">

        {/* LEFT — Hamburger + Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <img src={EroviansLogo} alt="Erovians" className="h-10 sm:h-12 w-auto object-contain" />
            <div className="w-px h-7 hidden sm:block" style={{ background: "#e5e7eb" }} />
          </div>
        </div>

        {/* CENTER — Search Bar with Live Dropdown */}
        <div className="hidden md:block flex-1 max-w-2xl mx-4 relative" ref={searchRef}>
          <form
            onSubmit={handleSearchSubmit}
            style={{ border: "1.5px solid #d1d5db", borderRadius: "8px", overflow: "hidden", background: "#fff", display: "flex" }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchQuery && setShowResults(true)}
              placeholder="Search Users ..."
              className="flex-1 px-4 py-2.5 text-sm outline-none bg-transparent"
              style={{ color: "#1f2937" }}
              autoComplete="off"
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch} className="px-2 flex items-center" style={{ color: "#9ca3af" }}>
                <X size={14} />
              </button>
            )}
            <button
              type="submit"
              className="px-4 flex items-center justify-center transition hover:opacity-90"
              style={{ background: "#1e3a5f", color: "#ffffff", minWidth: "48px" }}
            >
              <Search size={17} />
            </button>
          </form>

          {/* ── Search Dropdown ── */}
          {showResults && (
            <div
              className="absolute left-0 right-0 mt-2 rounded-2xl shadow-2xl border overflow-hidden z-50"
              style={{ background: "#fff", borderColor: "#e5e7eb", top: "100%" }}
            >
              {searchLoading ? (
                <div className="flex items-center justify-center py-6 gap-2 text-sm text-gray-400">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  No users found for "<span className="font-medium text-gray-600">{searchQuery}</span>"
                </div>
              ) : (
                <div>
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Users
                  </p>
                  {searchResults.map((u) => (
                    <button
                      key={u._id}
                      onClick={() => handleUserClick(u._id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left"
                    >
                      {/* Avatar */}
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                          style={{ background: "#f0e8df", color: "#6b3f2a" }}
                        >
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {u.designation?.trim() || "EroSocial Member"} · {u.followersCount} followers
                        </p>
                      </div>

                      {/* Follow Status Badge */}
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                        style={{
                          background: u.isFollowing ? "#f0fdf4" : u.isPending ? "#f8fafc" : "#fef3e2",
                          color: u.isFollowing ? "#16a34a" : u.isPending ? "#94a3b8" : "#c8956c",
                        }}
                      >
                        {u.isFollowing ? "Following" : u.isPending ? "Requested" : "Follow"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">

          {/* Mobile Search Toggle */}
          <button
            className="md:hidden p-2 rounded-full hover:bg-gray-100 transition"
            style={{ color: "#6b7280" }}
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search size={19} />
          </button>

          {/* Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-gray-50 transition"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="avatar" className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: "#f0e8df", color: "#6b3f2a" }}
                >
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              )}
            </button>

            {/* DROPDOWN MENU */}
            {dropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-2xl shadow-xl border overflow-hidden z-50"
                style={{ background: "#fff", borderColor: "#e5e7eb", top: "100%" }}
              >
                <div className="px-4 py-4 border-b" style={{ borderColor: "#f3f4f6", background: "#fafafa" }}>
                  <div className="flex items-center gap-3">
                    {user?.avatar ? (
                      <img src={user.avatar} alt="avatar" className="w-11 h-11 rounded-full object-cover shrink-0" />
                    ) : (
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold shrink-0"
                        style={{ background: "#f0e8df", color: "#6b3f2a" }}
                      >
                        {user?.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-gray-800">{user?.name}</p>
                      <p className="text-xs text-gray-400">{user?.email}</p>
                    </div>
                  </div>
                </div>

                <div className="py-2">
                  <button
                    onClick={() => { setDropdownOpen(false); navigate("/profile"); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#f0e8df" }}>
                      <User size={15} style={{ color: "#6b3f2a" }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">My Profile</p>
                      <p className="text-xs text-gray-400">View your posts & info</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { setDropdownOpen(false); navigate("/settings"); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#f0f4ff" }}>
                      <Settings size={15} style={{ color: "#4f46e5" }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Settings</p>
                      <p className="text-xs text-gray-400">Account & preferences</p>
                    </div>
                  </button>
                </div>

                <div className="border-t py-2" style={{ borderColor: "#f3f4f6" }}>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition text-left"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#fff0f0" }}>
                      <LogOut size={15} style={{ color: "#ef4444" }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-red-500">Sign Out</p>
                      <p className="text-xs text-gray-400">End your session</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE SEARCH BAR */}
      {searchOpen && (
        <div className="md:hidden px-4 pb-3" ref={searchRef}>
          <form
            onSubmit={handleSearchSubmit}
            className="flex w-full"
            style={{ border: "1.5px solid #d1d5db", borderRadius: "8px", overflow: "hidden", background: "#fff" }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search Users..."
              autoFocus
              autoComplete="off"
              className="flex-1 px-4 py-2.5 text-sm outline-none bg-transparent"
              style={{ color: "#1f2937" }}
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch} className="px-2 flex items-center" style={{ color: "#9ca3af" }}>
                <X size={14} />
              </button>
            )}
            <button
              type="submit"
              className="px-4 flex items-center justify-center"
              style={{ background: "#1e3a5f", color: "#ffffff", minWidth: "48px" }}
            >
              <Search size={17} />
            </button>
          </form>

          {/* Mobile search results */}
          {showResults && (
            <div className="mt-2 rounded-2xl shadow-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#e5e7eb" }}>
              {searchLoading ? (
                <div className="flex items-center justify-center py-5 gap-2 text-sm text-gray-400">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-5 text-center text-sm text-gray-400">No users found</div>
              ) : (
                searchResults.map((u) => (
                  <button
                    key={u._id}
                    onClick={() => { setSearchOpen(false); handleUserClick(u._id); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left border-b border-gray-50 last:border-0"
                  >
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ background: "#f0e8df", color: "#6b3f2a" }}>
                        {u.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
                      <p className="text-xs text-gray-400 truncate">{u.designation?.trim() || "EroSocial Member"}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}