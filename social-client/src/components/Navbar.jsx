
// // // import { useState, useRef, useEffect, useCallback } from "react";
// // // import { useAuth } from "../context/AuthContext";
// // // import { useNavigate, useLocation } from "react-router-dom";
// // // import { LogOut, Search, X, User, Settings, Menu } from "lucide-react";
// // // import EroviansLogo from "../assets/seller_logo.png";
// // // import axios from "axios";

// // // const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9001";

// // // const NAV_LINKS = [
// // //   { label: "Feed",     path: "/" },
// // //   { label: "Explore",  path: "/explore" },
// // //   { label: "Messages", path: "/messages" },
// // //   { label: "Requests", path: "/follow-requests" },
// // //   { label: "Saved",    path: "/saved" },
// // // ];

// // // export default function Navbar({ onSearch, onCreatePost }) {
// // //   const { user, logout } = useAuth();
// // //   const navigate  = useNavigate();
// // //   const location  = useLocation();

// // //   const [searchQuery,   setSearchQuery]   = useState("");
// // //   const [searchOpen,    setSearchOpen]    = useState(false);
// // //   const [dropdownOpen,  setDropdownOpen]  = useState(false);
// // //   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
// // //   const [searchResults, setSearchResults] = useState([]);
// // //   const [searchLoading, setSearchLoading] = useState(false);
// // //   const [showResults,   setShowResults]   = useState(false);

// // //   const dropdownRef   = useRef(null);
// // //   const searchRef     = useRef(null);
// // //   const debounceTimer = useRef(null);

// // //   useEffect(() => {
// // //     const handleClickOutside = (e) => {
// // //       if (dropdownRef.current && !dropdownRef.current.contains(e.target))
// // //         setDropdownOpen(false);
// // //       if (searchRef.current && !searchRef.current.contains(e.target))
// // //         setShowResults(false);
// // //     };
// // //     document.addEventListener("mousedown", handleClickOutside);
// // //     return () => document.removeEventListener("mousedown", handleClickOutside);
// // //   }, []);

// // //   const fetchUsers = useCallback(async (q) => {
// // //     if (!q.trim()) { setSearchResults([]); setShowResults(false); return; }
// // //     setSearchLoading(true);
// // //     try {
// // //       const token = localStorage.getItem("erosocial_token");
// // //       const res = await axios.get(`${BASE_URL}/api/follow/search?q=${encodeURIComponent(q)}`, {
// // //         headers: { Authorization: `Bearer ${token}` },
// // //       });
// // //       setSearchResults(res.data.users || []);
// // //       setShowResults(true);
// // //     } catch {
// // //       setSearchResults([]);
// // //     } finally {
// // //       setSearchLoading(false);
// // //     }
// // //   }, []);

// // //   const handleSearchChange = (e) => {
// // //     const val = e.target.value;
// // //     setSearchQuery(val);
// // //     if (onSearch) onSearch(val);
// // //     clearTimeout(debounceTimer.current);
// // //     debounceTimer.current = setTimeout(() => fetchUsers(val), 350);
// // //   };

// // //   const clearSearch = () => {
// // //     setSearchQuery(""); setSearchResults([]);
// // //     setShowResults(false);
// // //     if (onSearch) onSearch("");
// // //   };

// // //   const handleSearchSubmit = (e) => {
// // //     e.preventDefault();
// // //     if (onSearch) onSearch(searchQuery);
// // //   };

// // //   const handleUserClick = (userId) => {
// // //     setShowResults(false); setSearchQuery("");
// // //     navigate(`/user/${userId}`);
// // //   };

// // //   const handleLogout = () => { setDropdownOpen(false); logout(); };

// // //   const UserAvatar = ({ size = "w-9 h-9", text = "text-sm" }) =>
// // //     user?.avatar ? (
// // //       <img src={user.avatar} alt="avatar" className={`${size} rounded-full object-cover shrink-0`} />
// // //     ) : (
// // //       <div className={`${size} ${text} rounded-full flex items-center justify-center font-bold shrink-0`}
// // //         style={{ background: "#f0e8df", color: "#6b3f2a" }}>
// // //         {user?.name?.charAt(0).toUpperCase()}
// // //       </div>
// // //     );

// // //   return (
// // //     <nav className="sticky top-0 z-9999 w-full bg-white border-b border-gray-200">

// // //       {/* ── MAIN ROW ── */}
// // //       <div className="w-full px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3">

// // //         {/* Logo */}
// // //         <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={() => navigate("/")}>
// // //           <img src={EroviansLogo} alt="Erovians" className="h-8 sm:h-10 w-auto object-contain" />
// // //           <div className="w-px h-6 hidden sm:block bg-gray-200" />
// // //         </div>

// // //         {/* Desktop Search */}
// // //         <div className="hidden md:block flex-1 max-w-xs lg:max-w-sm xl:max-w-md relative" ref={searchRef}>
// // //           <form onSubmit={handleSearchSubmit}
// // //             className="flex border border-gray-300 rounded-lg overflow-hidden bg-white">
// // //             <input
// // //               type="text" value={searchQuery}
// // //               onChange={handleSearchChange}
// // //               onFocus={() => searchQuery && setShowResults(true)}
// // //               placeholder="Search Users..."
// // //               className="flex-1 px-3 py-2 text-sm outline-none bg-transparent text-gray-800"
// // //               autoComplete="off"
// // //             />
// // //             {searchQuery && (
// // //               <button type="button" onClick={clearSearch} className="px-2 text-gray-400">
// // //                 <X size={13} />
// // //               </button>
// // //             )}
// // //             <button type="submit"
// // //               className="px-3 flex items-center justify-center hover:opacity-90 transition"
// // //               style={{ background: "#1e3a5f", color: "#fff", minWidth: 40 }}>
// // //               <Search size={15} />
// // //             </button>
// // //           </form>

// // //           {/* Search Dropdown */}
// // //           {showResults && (
// // //             <div className="absolute left-0 right-0 mt-1.5 rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 bg-white"
// // //               style={{ top: "100%" }}>
// // //               {searchLoading ? (
// // //                 <div className="flex items-center justify-center py-5 gap-2 text-sm text-gray-400">
// // //                   <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
// // //                   Searching...
// // //                 </div>
// // //               ) : searchResults.length === 0 ? (
// // //                 <div className="py-5 text-center text-sm text-gray-400">
// // //                   No users found for "<span className="font-medium text-gray-600">{searchQuery}</span>"
// // //                 </div>
// // //               ) : (
// // //                 <div>
// // //                   <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Users</p>
// // //                   {searchResults.map((u) => (
// // //                     <button key={u._id} onClick={() => handleUserClick(u._id)}
// // //                       className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left">
// // //                       {u.avatar ? (
// // //                         <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
// // //                       ) : (
// // //                         <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
// // //                           style={{ background: "#f0e8df", color: "#6b3f2a" }}>
// // //                           {u.name?.charAt(0).toUpperCase()}
// // //                         </div>
// // //                       )}
// // //                       <div className="flex-1 min-w-0">
// // //                         <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
// // //                         <p className="text-xs text-gray-400 truncate">
// // //                           {u.designation?.trim() || "EroSocial Member"} · {u.followersCount} followers
// // //                         </p>
// // //                       </div>
// // //                       <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
// // //                         style={{
// // //                           background: u.isFollowing ? "#f0fdf4" : u.isPending ? "#f8fafc" : "#fef3e2",
// // //                           color: u.isFollowing ? "#16a34a" : u.isPending ? "#94a3b8" : "#c8956c",
// // //                         }}>
// // //                         {u.isFollowing ? "Following" : u.isPending ? "Requested" : "Follow"}
// // //                       </span>
// // //                     </button>
// // //                   ))}
// // //                 </div>
// // //               )}
// // //             </div>
// // //           )}
// // //         </div>

// // //         {/* Desktop Nav Links */}
// // //         <div className="hidden lg:flex items-center gap-0.5 ml-1">
// // //           {NAV_LINKS.map(({ label, path }) => {
// // //             const active = location.pathname === path;
// // //             return (
// // //               <button key={path} onClick={() => navigate(path)}
// // //                 className="px-3 py-1.5 text-sm rounded-lg transition hover:bg-stone-100 whitespace-nowrap"
// // //                 style={{
// // //                   color: active ? "#1e3a5f" : "#6b7280",
// // //                   fontWeight: active ? 700 : 500,
// // //                   background: active ? "#f0f4ff" : "transparent",
// // //                 }}>
// // //                 {label}
// // //               </button>
// // //             );
// // //           })}
// // //         </div>

// // //         {/* Spacer */}
// // //         <div className="flex-1" />


// // // <button
// // //   onClick={onCreatePost}
// // //   className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-full transition hover:opacity-90 shrink-0"
// // //   style={{ background: "#1e3a5f" }}
// // // >
// // //   + Post
// // // </button>


// // //         {/* Mobile Search Icon */}
// // //         <button className="md:hidden p-2 rounded-full hover:bg-gray-100 transition text-gray-500"
// // //           onClick={() => setSearchOpen(!searchOpen)}>
// // //           <Search size={18} />
// // //         </button>

// // //         {/* Mobile Hamburger */}
// // //         <button className="lg:hidden p-2 rounded-full hover:bg-gray-100 transition text-gray-500"
// // //           onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
// // //           <Menu size={18} />
// // //         </button>

// // //         {/* Profile Dropdown */}
// // //         <div className="relative shrink-0" ref={dropdownRef}>
// // //           <button onClick={() => setDropdownOpen(!dropdownOpen)}
// // //             className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-50 transition">
// // //             <UserAvatar />
// // //           </button>

// // //           {dropdownOpen && (
// // //             <div className="absolute right-0 mt-2 w-60 rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-9999 bg-white"
// // //               style={{ top: "100%" }}>
// // //               <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
// // //                 <div className="flex items-center gap-3">
// // //                   <UserAvatar size="w-10 h-10" text="text-base" />
// // //                   <div>
// // //                     <p className="text-sm font-bold text-gray-800">{user?.name}</p>
// // //                     <p className="text-xs text-gray-400 truncate max-w-35">{user?.email}</p>
// // //                   </div>
// // //                 </div>
// // //               </div>
// // //               <div className="py-1.5">
// // //                 <button onClick={() => { setDropdownOpen(false); navigate("/profile"); }}
// // //                   className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left">
// // //                   <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#f0e8df" }}>
// // //                     <User size={13} style={{ color: "#6b3f2a" }} />
// // //                   </div>
// // //                   <div>
// // //                     <p className="text-sm font-semibold text-gray-800">My Profile</p>
// // //                     <p className="text-xs text-gray-400">View your posts & info</p>
// // //                   </div>
// // //                 </button>
// // //                 <button onClick={() => { setDropdownOpen(false); navigate("/settings"); }}
// // //                   className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left">
// // //                   <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#f0f4ff" }}>
// // //                     <Settings size={13} style={{ color: "#4f46e5" }} />
// // //                   </div>
// // //                   <div>
// // //                     <p className="text-sm font-semibold text-gray-800">Settings</p>
// // //                     <p className="text-xs text-gray-400">Account & preferences</p>
// // //                   </div>
// // //                 </button>
// // //               </div>
// // //               <div className="border-t border-gray-100 py-1.5">
// // //                 <button onClick={handleLogout}
// // //                   className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition text-left">
// // //                   <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#fff0f0" }}>
// // //                     <LogOut size={13} style={{ color: "#ef4444" }} />
// // //                   </div>
// // //                   <div>
// // //                     <p className="text-sm font-semibold text-red-500">Sign Out</p>
// // //                     <p className="text-xs text-gray-400">End your session</p>
// // //                   </div>
// // //                 </button>
// // //               </div>
// // //             </div>
// // //           )}
// // //         </div>
// // //       </div>

// // //       {/* ── MOBILE SEARCH BAR ── */}
// // //       {searchOpen && (
// // //         <div className="md:hidden px-3 pb-2.5" ref={searchRef}>
// // //           <form onSubmit={handleSearchSubmit}
// // //             className="flex border border-gray-300 rounded-lg overflow-hidden bg-white">
// // //             <input
// // //               type="text" value={searchQuery}
// // //               onChange={handleSearchChange}
// // //               placeholder="Search Users..."
// // //               autoFocus autoComplete="off"
// // //               className="flex-1 px-3 py-2 text-sm outline-none bg-transparent text-gray-800"
// // //             />
// // //             {searchQuery && (
// // //               <button type="button" onClick={clearSearch} className="px-2 text-gray-400">
// // //                 <X size={13} />
// // //               </button>
// // //             )}
// // //             <button type="submit"
// // //               className="px-3 flex items-center justify-center"
// // //               style={{ background: "#1e3a5f", color: "#fff", minWidth: 40 }}>
// // //               <Search size={15} />
// // //             </button>
// // //           </form>

// // //           {showResults && (
// // //             <div className="mt-1.5 rounded-2xl shadow-xl border border-gray-100 overflow-hidden bg-white">
// // //               {searchLoading ? (
// // //                 <div className="flex items-center justify-center py-4 gap-2 text-sm text-gray-400">
// // //                   <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
// // //                   Searching...
// // //                 </div>
// // //               ) : searchResults.length === 0 ? (
// // //                 <div className="py-4 text-center text-sm text-gray-400">No users found</div>
// // //               ) : (
// // //                 searchResults.map((u) => (
// // //                   <button key={u._id}
// // //                     onClick={() => { setSearchOpen(false); handleUserClick(u._id); }}
// // //                     className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left border-b border-gray-50 last:border-0">
// // //                     {u.avatar ? (
// // //                       <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
// // //                     ) : (
// // //                       <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
// // //                         style={{ background: "#f0e8df", color: "#6b3f2a" }}>
// // //                         {u.name?.charAt(0).toUpperCase()}
// // //                       </div>
// // //                     )}
// // //                     <div className="flex-1 min-w-0">
// // //                       <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
// // //                       <p className="text-xs text-gray-400 truncate">{u.designation?.trim() || "EroSocial Member"}</p>
// // //                     </div>
// // //                   </button>
// // //                 ))
// // //               )}
// // //             </div>
// // //           )}
// // //         </div>
// // //       )}

// // //       {/* ── MOBILE NAV MENU ── */}
// // //       {mobileMenuOpen && (
// // //         <div className="lg:hidden border-t border-gray-100 px-3 py-2 bg-white">
// // //           <div className="flex flex-col gap-0.5">
// // //             {NAV_LINKS.map(({ label, path }) => {
// // //               const active = location.pathname === path;
// // //               return (
// // //                 <button key={path}
// // //                   onClick={() => { navigate(path); setMobileMenuOpen(false); }}
// // //                   className="w-full text-left px-4 py-2.5 text-sm rounded-xl transition hover:bg-stone-50"
// // //                   style={{
// // //                     color: active ? "#1e3a5f" : "#374151",
// // //                     fontWeight: active ? 700 : 500,
// // //                     background: active ? "#f0f4ff" : "transparent",
// // //                   }}>
// // //                   {label}
// // //                 </button>
// // //               );
// // //             })}
// // //           </div>
// // //         </div>
// // //       )}
// // //     </nav>
// // //   );
// // // }




// // import { useState, useRef, useEffect, useCallback } from "react";
// // import { useDispatch, useSelector } from "react-redux";
// // import { useAuth } from "../context/AuthContext";
// // import { useNavigate, useLocation } from "react-router-dom";
// // import { LogOut, Search, X, User, Settings, Menu } from "lucide-react";
// // import EroviansLogo from "../assets/seller_logo.png";
// // import axios from "axios";
// // import { fetchTotalUnread } from "../store/slices/Messageslice";
// // import { fetchFollowRequests } from "../store/slices/Followslice";

// // const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9001";

// // export default function Navbar({ onSearch, onCreatePost }) {
// //   const { user, logout } = useAuth();
// //   const navigate  = useNavigate();
// //   const location  = useLocation();
// //   const dispatch  = useDispatch();

// //   const totalUnread    = useSelector((state) => state.messages.totalUnread);
// //   const followRequests = useSelector((state) => state.follow.requests);
// //   const requestCount   = followRequests.length;

// //   const [searchQuery,    setSearchQuery]    = useState("");
// //   const [searchOpen,     setSearchOpen]     = useState(false);
// //   const [dropdownOpen,   setDropdownOpen]   = useState(false);
// //   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
// //   const [searchResults,  setSearchResults]  = useState([]);
// //   const [searchLoading,  setSearchLoading]  = useState(false);
// //   const [showResults,    setShowResults]    = useState(false);

// //   const dropdownRef   = useRef(null);
// //   const searchRef     = useRef(null);
// //   const debounceTimer = useRef(null);

// //   // Fetch unread counts on mount
// //   useEffect(() => {
// //     dispatch(fetchTotalUnread());
// //     dispatch(fetchFollowRequests());
// //   }, [dispatch]);

// //   useEffect(() => {
// //     const handleClickOutside = (e) => {
// //       if (dropdownRef.current && !dropdownRef.current.contains(e.target))
// //         setDropdownOpen(false);
// //       if (searchRef.current && !searchRef.current.contains(e.target))
// //         setShowResults(false);
// //     };
// //     document.addEventListener("mousedown", handleClickOutside);
// //     return () => document.removeEventListener("mousedown", handleClickOutside);
// //   }, []);

// //   const fetchUsers = useCallback(async (q) => {
// //     if (!q.trim()) { setSearchResults([]); setShowResults(false); return; }
// //     setSearchLoading(true);
// //     try {
// //       const token = localStorage.getItem("erosocial_token");
// //       const res = await axios.get(`${BASE_URL}/api/follow/search?q=${encodeURIComponent(q)}`, {
// //         headers: { Authorization: `Bearer ${token}` },
// //       });
// //       setSearchResults(res.data.users || []);
// //       setShowResults(true);
// //     } catch {
// //       setSearchResults([]);
// //     } finally {
// //       setSearchLoading(false);
// //     }
// //   }, []);

// //   const handleSearchChange = (e) => {
// //     const val = e.target.value;
// //     setSearchQuery(val);
// //     if (onSearch) onSearch(val);
// //     clearTimeout(debounceTimer.current);
// //     debounceTimer.current = setTimeout(() => fetchUsers(val), 350);
// //   };

// //   const clearSearch = () => {
// //     setSearchQuery(""); setSearchResults([]);
// //     setShowResults(false);
// //     if (onSearch) onSearch("");
// //   };

// //   const handleSearchSubmit = (e) => {
// //     e.preventDefault();
// //     if (onSearch) onSearch(searchQuery);
// //   };

// //   const handleUserClick = (userId) => {
// //     setShowResults(false); setSearchQuery("");
// //     navigate(`/user/${userId}`);
// //   };

// //   const handleLogout = () => { setDropdownOpen(false); logout(); };

// //   // Nav links with dynamic badge counts
// //   const NAV_LINKS = [
// //     { label: "Feed",     path: "/" },
// //     { label: "Explore",  path: "/explore" },
// //     { label: "Messages", path: "/messages",        badge: totalUnread },
// //     { label: "Requests", path: "/follow-requests", badge: requestCount },
// //     { label: "Saved",    path: "/saved" },
// //   ];

// //   const UserAvatar = ({ size = "w-9 h-9", text = "text-sm" }) =>
// //     user?.avatar ? (
// //       <img src={user.avatar} alt="avatar" className={`${size} rounded-full object-cover shrink-0`} />
// //     ) : (
// //       <div className={`${size} ${text} rounded-full flex items-center justify-center font-bold shrink-0`}
// //         style={{ background: "#f0e8df", color: "#6b3f2a" }}>
// //         {user?.name?.charAt(0).toUpperCase()}
// //       </div>
// //     );

// //   return (
// //     <nav className="sticky top-0 z-9999 w-full bg-white border-b border-gray-200">

// //       {/* ── MAIN ROW ── */}
// //       <div className="w-full px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3">

// //         {/* Logo */}
// //         <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={() => navigate("/")}>
// //           <img src={EroviansLogo} alt="Erovians" className="h-8 sm:h-10 w-auto object-contain" />
// //           <div className="w-px h-6 hidden sm:block bg-gray-200" />
// //         </div>

// //         {/* Desktop Search */}
// //         <div className="hidden md:block flex-1 max-w-xs lg:max-w-sm xl:max-w-md relative" ref={searchRef}>
// //           <form onSubmit={handleSearchSubmit}
// //             className="flex border border-gray-300 rounded-lg overflow-hidden bg-white">
// //             <input
// //               type="text" value={searchQuery}
// //               onChange={handleSearchChange}
// //               onFocus={() => searchQuery && setShowResults(true)}
// //               placeholder="Search Users..."
// //               className="flex-1 px-3 py-2 text-sm outline-none bg-transparent text-gray-800"
// //               autoComplete="off"
// //             />
// //             {searchQuery && (
// //               <button type="button" onClick={clearSearch} className="px-2 text-gray-400">
// //                 <X size={13} />
// //               </button>
// //             )}
// //             <button type="submit"
// //               className="px-3 flex items-center justify-center hover:opacity-90 transition"
// //               style={{ background: "#1e3a5f", color: "#fff", minWidth: 40 }}>
// //               <Search size={15} />
// //             </button>
// //           </form>

// //           {/* Search Dropdown */}
// //           {showResults && (
// //             <div className="absolute left-0 right-0 mt-1.5 rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 bg-white"
// //               style={{ top: "100%" }}>
// //               {searchLoading ? (
// //                 <div className="flex items-center justify-center py-5 gap-2 text-sm text-gray-400">
// //                   <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
// //                   Searching...
// //                 </div>
// //               ) : searchResults.length === 0 ? (
// //                 <div className="py-5 text-center text-sm text-gray-400">
// //                   No users found for "<span className="font-medium text-gray-600">{searchQuery}</span>"
// //                 </div>
// //               ) : (
// //                 <div>
// //                   <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Users</p>
// //                   {searchResults.map((u) => (
// //                     <button key={u._id} onClick={() => handleUserClick(u._id)}
// //                       className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left">
// //                       {u.avatar ? (
// //                         <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
// //                       ) : (
// //                         <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
// //                           style={{ background: "#f0e8df", color: "#6b3f2a" }}>
// //                           {u.name?.charAt(0).toUpperCase()}
// //                         </div>
// //                       )}
// //                       <div className="flex-1 min-w-0">
// //                         <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
// //                         <p className="text-xs text-gray-400 truncate">
// //                           {u.designation?.trim() || "EroSocial Member"} · {u.followersCount} followers
// //                         </p>
// //                       </div>
// //                       <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
// //                         style={{
// //                           background: u.isFollowing ? "#f0fdf4" : u.isPending ? "#f8fafc" : "#fef3e2",
// //                           color: u.isFollowing ? "#16a34a" : u.isPending ? "#94a3b8" : "#c8956c",
// //                         }}>
// //                         {u.isFollowing ? "Following" : u.isPending ? "Requested" : "Follow"}
// //                       </span>
// //                     </button>
// //                   ))}
// //                 </div>
// //               )}
// //             </div>
// //           )}
// //         </div>

// //         {/* Desktop Nav Links with Badges */}
// //         <div className="hidden lg:flex items-center gap-0.5 ml-1">
// //           {NAV_LINKS.map(({ label, path, badge }) => {
// //             const active = location.pathname === path;
// //             return (
// //               <button key={path} onClick={() => navigate(path)}
// //                 className="relative px-3 py-1.5 text-sm rounded-lg transition hover:bg-stone-100 whitespace-nowrap"
// //                 style={{
// //                   color: active ? "#1e3a5f" : "#6b7280",
// //                   fontWeight: active ? 700 : 500,
// //                   background: active ? "#f0f4ff" : "transparent",
// //                 }}>
// //                 {label}
// //                 {badge > 0 && (
// //                   <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
// //                     {badge > 99 ? "99+" : badge}
// //                   </span>
// //                 )}
// //               </button>
// //             );
// //           })}
// //         </div>

// //         {/* Spacer */}
// //         <div className="flex-1" />

// //         <button
// //           onClick={onCreatePost}
// //           className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-full transition hover:opacity-90 shrink-0"
// //           style={{ background: "#1e3a5f" }}
// //         >
// //           + Post
// //         </button>

// //         {/* Mobile Search Icon */}
// //         <button className="md:hidden p-2 rounded-full hover:bg-gray-100 transition text-gray-500"
// //           onClick={() => setSearchOpen(!searchOpen)}>
// //           <Search size={18} />
// //         </button>

// //         {/* Mobile Hamburger */}
// //         <button className="lg:hidden p-2 rounded-full hover:bg-gray-100 transition text-gray-500"
// //           onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
// //           <Menu size={18} />
// //         </button>

// //         {/* Profile Dropdown */}
// //         <div className="relative shrink-0" ref={dropdownRef}>
// //           <button onClick={() => setDropdownOpen(!dropdownOpen)}
// //             className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-50 transition">
// //             <UserAvatar />
// //           </button>

// //           {dropdownOpen && (
// //             <div className="absolute right-0 mt-2 w-60 rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-9999 bg-white"
// //               style={{ top: "100%" }}>
// //               <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
// //                 <div className="flex items-center gap-3">
// //                   <UserAvatar size="w-10 h-10" text="text-base" />
// //                   <div>
// //                     <p className="text-sm font-bold text-gray-800">{user?.name}</p>
// //                     <p className="text-xs text-gray-400 truncate max-w-35">{user?.email}</p>
// //                   </div>
// //                 </div>
// //               </div>
// //               <div className="py-1.5">
// //                 <button onClick={() => { setDropdownOpen(false); navigate("/profile"); }}
// //                   className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left">
// //                   <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#f0e8df" }}>
// //                     <User size={13} style={{ color: "#6b3f2a" }} />
// //                   </div>
// //                   <div>
// //                     <p className="text-sm font-semibold text-gray-800">My Profile</p>
// //                     <p className="text-xs text-gray-400">View your posts & info</p>
// //                   </div>
// //                 </button>
// //                 <button onClick={() => { setDropdownOpen(false); navigate("/settings"); }}
// //                   className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left">
// //                   <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#f0f4ff" }}>
// //                     <Settings size={13} style={{ color: "#4f46e5" }} />
// //                   </div>
// //                   <div>
// //                     <p className="text-sm font-semibold text-gray-800">Settings</p>
// //                     <p className="text-xs text-gray-400">Account & preferences</p>
// //                   </div>
// //                 </button>
// //               </div>
// //               <div className="border-t border-gray-100 py-1.5">
// //                 <button onClick={handleLogout}
// //                   className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition text-left">
// //                   <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#fff0f0" }}>
// //                     <LogOut size={13} style={{ color: "#ef4444" }} />
// //                   </div>
// //                   <div>
// //                     <p className="text-sm font-semibold text-red-500">Sign Out</p>
// //                     <p className="text-xs text-gray-400">End your session</p>
// //                   </div>
// //                 </button>
// //               </div>
// //             </div>
// //           )}
// //         </div>
// //       </div>

// //       {/* ── MOBILE SEARCH BAR ── */}
// //       {searchOpen && (
// //         <div className="md:hidden px-3 pb-2.5" ref={searchRef}>
// //           <form onSubmit={handleSearchSubmit}
// //             className="flex border border-gray-300 rounded-lg overflow-hidden bg-white">
// //             <input
// //               type="text" value={searchQuery}
// //               onChange={handleSearchChange}
// //               placeholder="Search Users..."
// //               autoFocus autoComplete="off"
// //               className="flex-1 px-3 py-2 text-sm outline-none bg-transparent text-gray-800"
// //             />
// //             {searchQuery && (
// //               <button type="button" onClick={clearSearch} className="px-2 text-gray-400">
// //                 <X size={13} />
// //               </button>
// //             )}
// //             <button type="submit"
// //               className="px-3 flex items-center justify-center"
// //               style={{ background: "#1e3a5f", color: "#fff", minWidth: 40 }}>
// //               <Search size={15} />
// //             </button>
// //           </form>

// //           {showResults && (
// //             <div className="mt-1.5 rounded-2xl shadow-xl border border-gray-100 overflow-hidden bg-white">
// //               {searchLoading ? (
// //                 <div className="flex items-center justify-center py-4 gap-2 text-sm text-gray-400">
// //                   <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
// //                   Searching...
// //                 </div>
// //               ) : searchResults.length === 0 ? (
// //                 <div className="py-4 text-center text-sm text-gray-400">No users found</div>
// //               ) : (
// //                 searchResults.map((u) => (
// //                   <button key={u._id}
// //                     onClick={() => { setSearchOpen(false); handleUserClick(u._id); }}
// //                     className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left border-b border-gray-50 last:border-0">
// //                     {u.avatar ? (
// //                       <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
// //                     ) : (
// //                       <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
// //                         style={{ background: "#f0e8df", color: "#6b3f2a" }}>
// //                         {u.name?.charAt(0).toUpperCase()}
// //                       </div>
// //                     )}
// //                     <div className="flex-1 min-w-0">
// //                       <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
// //                       <p className="text-xs text-gray-400 truncate">{u.designation?.trim() || "EroSocial Member"}</p>
// //                     </div>
// //                   </button>
// //                 ))
// //               )}
// //             </div>
// //           )}
// //         </div>
// //       )}

// //       {/* ── MOBILE NAV MENU with Badges ── */}
// //       {mobileMenuOpen && (
// //         <div className="lg:hidden border-t border-gray-100 px-3 py-2 bg-white">
// //           <div className="flex flex-col gap-0.5">
// //             {NAV_LINKS.map(({ label, path, badge }) => {
// //               const active = location.pathname === path;
// //               return (
// //                 <button key={path}
// //                   onClick={() => { navigate(path); setMobileMenuOpen(false); }}
// //                   className="relative w-full text-left px-4 py-2.5 text-sm rounded-xl transition hover:bg-stone-50"
// //                   style={{
// //                     color: active ? "#1e3a5f" : "#374151",
// //                     fontWeight: active ? 700 : 500,
// //                     background: active ? "#f0f4ff" : "transparent",
// //                   }}>
// //                   {label}
// //                   {badge > 0 && (
// //                     <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
// //                       {badge > 99 ? "99+" : badge}
// //                     </span>
// //                   )}
// //                 </button>
// //               );
// //             })}
// //           </div>
// //         </div>
// //       )}
// //     </nav>
// //   );
// // }




// import { useState, useRef, useEffect, useCallback } from "react";
// import { useDispatch, useSelector } from "react-redux";
// import { useAuth } from "../context/AuthContext";
// import { useNavigate, useLocation } from "react-router-dom";
// import { LogOut, Search, X, User, Settings, Menu } from "lucide-react";
// import EroviansLogo from "../assets/seller_logo.png";
// import axios from "axios";
// import { fetchTotalUnread } from "../store/slices/Messageslice";
// import { fetchFollowRequests } from "../store/slices/Followslice";
// import { chatSocket as socket } from "../services/socket";

// const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9001";

// export default function Navbar({ onSearch, onCreatePost }) {
//   const { user, logout } = useAuth();
//   const navigate  = useNavigate();
//   const location  = useLocation();
//   const dispatch  = useDispatch();

//   const totalUnread    = useSelector((state) => state.messages.totalUnread);
//   const followRequests = useSelector((state) => state.follow.requests);
//   const requestCount   = followRequests.length;

//   const [searchQuery,    setSearchQuery]    = useState("");
//   const [searchOpen,     setSearchOpen]     = useState(false);
//   const [dropdownOpen,   setDropdownOpen]   = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [searchResults,  setSearchResults]  = useState([]);
//   const [searchLoading,  setSearchLoading]  = useState(false);
//   const [showResults,    setShowResults]    = useState(false);

//   const dropdownRef   = useRef(null);
//   const searchRef     = useRef(null);
//   const debounceTimer = useRef(null);

//   // ── Fetch counts + socket listeners ──────────────────────────────────────
//   useEffect(() => {
//     dispatch(fetchTotalUnread());
//     dispatch(fetchFollowRequests());

//     // Naya follow request aane pe badge update karo
//     const handleNewFollowRequest = () => {
//       dispatch(fetchFollowRequests());
//     };

//     socket.on("follow_request_received", handleNewFollowRequest);

//     return () => {
//       socket.off("follow_request_received", handleNewFollowRequest);
//     };
//   }, [dispatch]);

//   useEffect(() => {
//     const handleClickOutside = (e) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target))
//         setDropdownOpen(false);
//       if (searchRef.current && !searchRef.current.contains(e.target))
//         setShowResults(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   const fetchUsers = useCallback(async (q) => {
//     if (!q.trim()) { setSearchResults([]); setShowResults(false); return; }
//     setSearchLoading(true);
//     try {
//       const token = localStorage.getItem("erosocial_token");
//       const res = await axios.get(`${BASE_URL}/api/follow/search?q=${encodeURIComponent(q)}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       setSearchResults(res.data.users || []);
//       setShowResults(true);
//     } catch {
//       setSearchResults([]);
//     } finally {
//       setSearchLoading(false);
//     }
//   }, []);

//   const handleSearchChange = (e) => {
//     const val = e.target.value;
//     setSearchQuery(val);
//     if (onSearch) onSearch(val);
//     clearTimeout(debounceTimer.current);
//     debounceTimer.current = setTimeout(() => fetchUsers(val), 350);
//   };

//   const clearSearch = () => {
//     setSearchQuery(""); setSearchResults([]);
//     setShowResults(false);
//     if (onSearch) onSearch("");
//   };

//   const handleSearchSubmit = (e) => {
//     e.preventDefault();
//     if (onSearch) onSearch(searchQuery);
//   };

//   const handleUserClick = (userId) => {
//     setShowResults(false); setSearchQuery("");
//     navigate(`/user/${userId}`);
//   };

//   const handleLogout = () => { setDropdownOpen(false); logout(); };

//   // Nav links with dynamic badge counts
//   const NAV_LINKS = [
//     { label: "Feed",     path: "/" },
//     { label: "Explore",  path: "/explore" },
//     { label: "Messages", path: "/messages",        badge: totalUnread },
//     { label: "Requests", path: "/follow-requests", badge: requestCount },
//     { label: "Saved",    path: "/saved" },
//   ];

//   const UserAvatar = ({ size = "w-9 h-9", text = "text-sm" }) =>
//     user?.avatar ? (
//       <img src={user.avatar} alt="avatar" className={`${size} rounded-full object-cover shrink-0`} />
//     ) : (
//       <div className={`${size} ${text} rounded-full flex items-center justify-center font-bold shrink-0`}
//         style={{ background: "#f0e8df", color: "#6b3f2a" }}>
//         {user?.name?.charAt(0).toUpperCase()}
//       </div>
//     );

//   return (
//     <nav className="sticky top-0 z-9999 w-full bg-white border-b border-gray-200">

//       {/* ── MAIN ROW ── */}
//       <div className="w-full px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3">

//         {/* Logo */}
//         <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={() => navigate("/")}>
//           <img src={EroviansLogo} alt="Erovians" className="h-8 sm:h-10 w-auto object-contain" />
//           <div className="w-px h-6 hidden sm:block bg-gray-200" />
//         </div>

//         {/* Desktop Search */}
//         <div className="hidden md:block flex-1 max-w-xs lg:max-w-sm xl:max-w-md relative" ref={searchRef}>
//           <form onSubmit={handleSearchSubmit}
//             className="flex border border-gray-300 rounded-lg overflow-hidden bg-white">
//             <input
//               type="text" value={searchQuery}
//               onChange={handleSearchChange}
//               onFocus={() => searchQuery && setShowResults(true)}
//               placeholder="Search Users..."
//               className="flex-1 px-3 py-2 text-sm outline-none bg-transparent text-gray-800"
//               autoComplete="off"
//             />
//             {searchQuery && (
//               <button type="button" onClick={clearSearch} className="px-2 text-gray-400">
//                 <X size={13} />
//               </button>
//             )}
//             <button type="submit"
//               className="px-3 flex items-center justify-center hover:opacity-90 transition"
//               style={{ background: "#1e3a5f", color: "#fff", minWidth: 40 }}>
//               <Search size={15} />
//             </button>
//           </form>

//           {/* Search Dropdown */}
//           {showResults && (
//             <div className="absolute left-0 right-0 mt-1.5 rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 bg-white"
//               style={{ top: "100%" }}>
//               {searchLoading ? (
//                 <div className="flex items-center justify-center py-5 gap-2 text-sm text-gray-400">
//                   <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
//                   Searching...
//                 </div>
//               ) : searchResults.length === 0 ? (
//                 <div className="py-5 text-center text-sm text-gray-400">
//                   No users found for "<span className="font-medium text-gray-600">{searchQuery}</span>"
//                 </div>
//               ) : (
//                 <div>
//                   <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Users</p>
//                   {searchResults.map((u) => (
//                     <button key={u._id} onClick={() => handleUserClick(u._id)}
//                       className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left">
//                       {u.avatar ? (
//                         <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
//                       ) : (
//                         <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
//                           style={{ background: "#f0e8df", color: "#6b3f2a" }}>
//                           {u.name?.charAt(0).toUpperCase()}
//                         </div>
//                       )}
//                       <div className="flex-1 min-w-0">
//                         <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
//                         <p className="text-xs text-gray-400 truncate">
//                           {u.designation?.trim() || "EroSocial Member"} · {u.followersCount} followers
//                         </p>
//                       </div>
//                       <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
//                         style={{
//                           background: u.isFollowing ? "#f0fdf4" : u.isPending ? "#f8fafc" : "#fef3e2",
//                           color: u.isFollowing ? "#16a34a" : u.isPending ? "#94a3b8" : "#c8956c",
//                         }}>
//                         {u.isFollowing ? "Following" : u.isPending ? "Requested" : "Follow"}
//                       </span>
//                     </button>
//                   ))}
//                 </div>
//               )}
//             </div>
//           )}
//         </div>

//         {/* Desktop Nav Links with Badges */}
//         <div className="hidden lg:flex items-center gap-0.5 ml-1">
//           {NAV_LINKS.map(({ label, path, badge }) => {
//             const active = location.pathname === path;
//             return (
//               <button key={path} onClick={() => navigate(path)}
//                 className="relative px-3 py-1.5 text-sm rounded-lg transition hover:bg-stone-100 whitespace-nowrap"
//                 style={{
//                   color: active ? "#1e3a5f" : "#6b7280",
//                   fontWeight: active ? 700 : 500,
//                   background: active ? "#f0f4ff" : "transparent",
//                 }}>
//                 {label}
//                 {badge > 0 && (
//                   <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
//                     {badge > 99 ? "99+" : badge}
//                   </span>
//                 )}
//               </button>
//             );
//           })}
//         </div>

//         {/* Spacer */}
//         <div className="flex-1" />

//         <button
//           onClick={onCreatePost}
//           className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-full transition hover:opacity-90 shrink-0"
//           style={{ background: "#1e3a5f" }}
//         >
//           + Post
//         </button>

//         {/* Mobile Search Icon */}
//         <button className="md:hidden p-2 rounded-full hover:bg-gray-100 transition text-gray-500"
//           onClick={() => setSearchOpen(!searchOpen)}>
//           <Search size={18} />
//         </button>

//         {/* Mobile Hamburger — red dot agar koi badge ho */}
//         <button className="lg:hidden relative p-2 rounded-full hover:bg-gray-100 transition text-gray-500"
//           onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
//           <Menu size={18} />
//           {(totalUnread > 0 || requestCount > 0) && (
//             <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
//           )}
//         </button>

//         {/* Profile Dropdown */}
//         <div className="relative shrink-0" ref={dropdownRef}>
//           <button onClick={() => setDropdownOpen(!dropdownOpen)}
//             className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-50 transition">
//             <UserAvatar />
//           </button>

//           {dropdownOpen && (
//             <div className="absolute right-0 mt-2 w-60 rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-9999 bg-white"
//               style={{ top: "100%" }}>
//               <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
//                 <div className="flex items-center gap-3">
//                   <UserAvatar size="w-10 h-10" text="text-base" />
//                   <div>
//                     <p className="text-sm font-bold text-gray-800">{user?.name}</p>
//                     <p className="text-xs text-gray-400 truncate max-w-35">{user?.email}</p>
//                   </div>
//                 </div>
//               </div>
//               <div className="py-1.5">
//                 <button onClick={() => { setDropdownOpen(false); navigate("/profile"); }}
//                   className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left">
//                   <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#f0e8df" }}>
//                     <User size={13} style={{ color: "#6b3f2a" }} />
//                   </div>
//                   <div>
//                     <p className="text-sm font-semibold text-gray-800">My Profile</p>
//                     <p className="text-xs text-gray-400">View your posts & info</p>
//                   </div>
//                 </button>
//                 <button onClick={() => { setDropdownOpen(false); navigate("/settings"); }}
//                   className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left">
//                   <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#f0f4ff" }}>
//                     <Settings size={13} style={{ color: "#4f46e5" }} />
//                   </div>
//                   <div>
//                     <p className="text-sm font-semibold text-gray-800">Settings</p>
//                     <p className="text-xs text-gray-400">Account & preferences</p>
//                   </div>
//                 </button>
//               </div>
//               <div className="border-t border-gray-100 py-1.5">
//                 <button onClick={handleLogout}
//                   className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition text-left">
//                   <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#fff0f0" }}>
//                     <LogOut size={13} style={{ color: "#ef4444" }} />
//                   </div>
//                   <div>
//                     <p className="text-sm font-semibold text-red-500">Sign Out</p>
//                     <p className="text-xs text-gray-400">End your session</p>
//                   </div>
//                 </button>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* ── MOBILE SEARCH BAR ── */}
//       {searchOpen && (
//         <div className="md:hidden px-3 pb-2.5" ref={searchRef}>
//           <form onSubmit={handleSearchSubmit}
//             className="flex border border-gray-300 rounded-lg overflow-hidden bg-white">
//             <input
//               type="text" value={searchQuery}
//               onChange={handleSearchChange}
//               placeholder="Search Users..."
//               autoFocus autoComplete="off"
//               className="flex-1 px-3 py-2 text-sm outline-none bg-transparent text-gray-800"
//             />
//             {searchQuery && (
//               <button type="button" onClick={clearSearch} className="px-2 text-gray-400">
//                 <X size={13} />
//               </button>
//             )}
//             <button type="submit"
//               className="px-3 flex items-center justify-center"
//               style={{ background: "#1e3a5f", color: "#fff", minWidth: 40 }}>
//               <Search size={15} />
//             </button>
//           </form>

//           {showResults && (
//             <div className="mt-1.5 rounded-2xl shadow-xl border border-gray-100 overflow-hidden bg-white">
//               {searchLoading ? (
//                 <div className="flex items-center justify-center py-4 gap-2 text-sm text-gray-400">
//                   <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
//                   Searching...
//                 </div>
//               ) : searchResults.length === 0 ? (
//                 <div className="py-4 text-center text-sm text-gray-400">No users found</div>
//               ) : (
//                 searchResults.map((u) => (
//                   <button key={u._id}
//                     onClick={() => { setSearchOpen(false); handleUserClick(u._id); }}
//                     className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left border-b border-gray-50 last:border-0">
//                     {u.avatar ? (
//                       <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
//                     ) : (
//                       <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
//                         style={{ background: "#f0e8df", color: "#6b3f2a" }}>
//                         {u.name?.charAt(0).toUpperCase()}
//                       </div>
//                     )}
//                     <div className="flex-1 min-w-0">
//                       <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
//                       <p className="text-xs text-gray-400 truncate">{u.designation?.trim() || "EroSocial Member"}</p>
//                     </div>
//                   </button>
//                 ))
//               )}
//             </div>
//           )}
//         </div>
//       )}

//       {/* ── MOBILE NAV MENU with Badges ── */}
//       {mobileMenuOpen && (
//         <div className="lg:hidden border-t border-gray-100 px-3 py-2 bg-white">
//           <div className="flex flex-col gap-0.5">
//             {NAV_LINKS.map(({ label, path, badge }) => {
//               const active = location.pathname === path;
//               return (
//                 <button key={path}
//                   onClick={() => { navigate(path); setMobileMenuOpen(false); }}
//                   className="w-full flex items-center justify-between px-4 py-2.5 text-sm rounded-xl transition hover:bg-stone-50"
//                   style={{
//                     color: active ? "#1e3a5f" : "#374151",
//                     fontWeight: active ? 700 : 500,
//                     background: active ? "#f0f4ff" : "transparent",
//                   }}>
//                   <span>{label}</span>
//                   {badge > 0 && (
//                     <span className="inline-flex items-center justify-center min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5">
//                       {badge > 99 ? "99+" : badge}
//                     </span>
//                   )}
//                 </button>
//               );
//             })}
//           </div>
//         </div>
//       )}
//     </nav>
//   );
// }




import { useState, useRef, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Search, X, User, Settings, Menu } from "lucide-react";
import EroviansLogo from "../assets/seller_logo.png";
import axios from "axios";
import { fetchTotalUnread, incrementUnread } from "../store/slices/Messageslice"; // ✅ incrementUnread add kiya
import { fetchFollowRequests } from "../store/slices/Followslice";
import { chatSocket as socket } from "../services/socket";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9001";

export default function Navbar({ onSearch, onCreatePost }) {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const dispatch  = useDispatch();

  const totalUnread    = useSelector((state) => state.messages.totalUnread);
  const followRequests = useSelector((state) => state.follow.requests);
  const requestCount   = followRequests.length;

  const [searchQuery,    setSearchQuery]    = useState("");
  const [searchOpen,     setSearchOpen]     = useState(false);
  const [dropdownOpen,   setDropdownOpen]   = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchResults,  setSearchResults]  = useState([]);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const [showResults,    setShowResults]    = useState(false);

  const dropdownRef   = useRef(null);
  const searchRef     = useRef(null);
  const debounceTimer = useRef(null);

  // ✅ locationRef — stale closure se bachne ke liye
  const locationRef = useRef(location.pathname);
  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  // ── Fetch counts + socket listeners ──────────────────────────────────────
  useEffect(() => {
    dispatch(fetchTotalUnread());
    dispatch(fetchFollowRequests());

    // ✅ Naya message aane pe badge instantly update karo
    const handleNewMessage = () => {
      if (locationRef.current !== "/messages") {
        dispatch(incrementUnread());
      }
    };

    // Naya follow request aane pe badge update karo
    const handleNewFollowRequest = () => {
      dispatch(fetchFollowRequests());
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("follow_request_received", handleNewFollowRequest);

    return () => {
socket.off("newMessage", handleNewMessage);
      socket.off("follow_request_received", handleNewFollowRequest);
    };
  }, [dispatch]);

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
    setSearchQuery(""); setSearchResults([]);
    setShowResults(false);
    if (onSearch) onSearch("");
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(searchQuery);
  };

  const handleUserClick = (userId) => {
    setShowResults(false); setSearchQuery("");
    navigate(`/user/${userId}`);
  };

  const handleLogout = () => { setDropdownOpen(false); logout(); };

  // Nav links with dynamic badge counts
  const NAV_LINKS = [
    { label: "Feed",     path: "/" },
    { label: "Explore",  path: "/explore" },
    { label: "Messages", path: "/messages",        badge: totalUnread },
    { label: "Requests", path: "/follow-requests", badge: requestCount },
    { label: "Saved",    path: "/saved" },
  ];

  const UserAvatar = ({ size = "w-9 h-9", text = "text-sm" }) =>
    user?.avatar ? (
      <img src={user.avatar} alt="avatar" className={`${size} rounded-full object-cover shrink-0`} />
    ) : (
      <div className={`${size} ${text} rounded-full flex items-center justify-center font-bold shrink-0`}
        style={{ background: "#f0e8df", color: "#6b3f2a" }}>
        {user?.name?.charAt(0).toUpperCase()}
      </div>
    );

  return (
    <nav className="sticky top-0 z-9999 w-full bg-white border-b border-gray-200">

      {/* ── MAIN ROW ── */}
      <div className="w-full px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3">

        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={() => navigate("/")}>
          <img src={EroviansLogo} alt="Erovians" className="h-8 sm:h-10 w-auto object-contain" />
          <div className="w-px h-6 hidden sm:block bg-gray-200" />
        </div>

        {/* Desktop Search */}
        <div className="hidden md:block flex-1 max-w-xs lg:max-w-sm xl:max-w-md relative" ref={searchRef}>
          <form onSubmit={handleSearchSubmit}
            className="flex border border-gray-300 rounded-lg overflow-hidden bg-white">
            <input
              type="text" value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchQuery && setShowResults(true)}
              placeholder="Search Users..."
              className="flex-1 px-3 py-2 text-sm outline-none bg-transparent text-gray-800"
              autoComplete="off"
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch} className="px-2 text-gray-400">
                <X size={13} />
              </button>
            )}
            <button type="submit"
              className="px-3 flex items-center justify-center hover:opacity-90 transition"
              style={{ background: "#1e3a5f", color: "#fff", minWidth: 40 }}>
              <Search size={15} />
            </button>
          </form>

          {/* Search Dropdown */}
          {showResults && (
            <div className="absolute left-0 right-0 mt-1.5 rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 bg-white"
              style={{ top: "100%" }}>
              {searchLoading ? (
                <div className="flex items-center justify-center py-5 gap-2 text-sm text-gray-400">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-5 text-center text-sm text-gray-400">
                  No users found for "<span className="font-medium text-gray-600">{searchQuery}</span>"
                </div>
              ) : (
                <div>
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Users</p>
                  {searchResults.map((u) => (
                    <button key={u._id} onClick={() => handleUserClick(u._id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left">
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
                        <p className="text-xs text-gray-400 truncate">
                          {u.designation?.trim() || "EroSocial Member"} · {u.followersCount} followers
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                        style={{
                          background: u.isFollowing ? "#f0fdf4" : u.isPending ? "#f8fafc" : "#fef3e2",
                          color: u.isFollowing ? "#16a34a" : u.isPending ? "#94a3b8" : "#c8956c",
                        }}>
                        {u.isFollowing ? "Following" : u.isPending ? "Requested" : "Follow"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Desktop Nav Links with Badges */}
        <div className="hidden lg:flex items-center gap-0.5 ml-1">
          {NAV_LINKS.map(({ label, path, badge }) => {
            const active = location.pathname === path;
            return (
              <button key={path} onClick={() => navigate(path)}
                className="relative px-3 py-1.5 text-sm rounded-lg transition hover:bg-stone-100 whitespace-nowrap"
                style={{
                  color: active ? "#1e3a5f" : "#6b7280",
                  fontWeight: active ? 700 : 500,
                  background: active ? "#f0f4ff" : "transparent",
                }}>
                {label}
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        <button
          onClick={onCreatePost}
          className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-full transition hover:opacity-90 shrink-0"
          style={{ background: "#1e3a5f" }}
        >
          + Post
        </button>

        {/* Mobile Search Icon */}
        <button className="md:hidden p-2 rounded-full hover:bg-gray-100 transition text-gray-500"
          onClick={() => setSearchOpen(!searchOpen)}>
          <Search size={18} />
        </button>

        {/* Mobile Hamburger — red dot agar koi badge ho */}
        <button className="lg:hidden relative p-2 rounded-full hover:bg-gray-100 transition text-gray-500"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <Menu size={18} />
          {(totalUnread > 0 || requestCount > 0) && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
          )}
        </button>

        {/* Profile Dropdown */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-50 transition">
            <UserAvatar />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-9999 bg-white"
              style={{ top: "100%" }}>
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-3">
                  <UserAvatar size="w-10 h-10" text="text-base" />
                  <div>
                    <p className="text-sm font-bold text-gray-800">{user?.name}</p>
                    <p className="text-xs text-gray-400 truncate max-w-35">{user?.email}</p>
                  </div>
                </div>
              </div>
              <div className="py-1.5">
                <button onClick={() => { setDropdownOpen(false); navigate("/profile"); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#f0e8df" }}>
                    <User size={13} style={{ color: "#6b3f2a" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">My Profile</p>
                    <p className="text-xs text-gray-400">View your posts & info</p>
                  </div>
                </button>
                <button onClick={() => { setDropdownOpen(false); navigate("/settings"); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#f0f4ff" }}>
                    <Settings size={13} style={{ color: "#4f46e5" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Settings</p>
                    <p className="text-xs text-gray-400">Account & preferences</p>
                  </div>
                </button>
              </div>
              <div className="border-t border-gray-100 py-1.5">
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition text-left">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#fff0f0" }}>
                    <LogOut size={13} style={{ color: "#ef4444" }} />
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

      {/* ── MOBILE SEARCH BAR ── */}
      {searchOpen && (
        <div className="md:hidden px-3 pb-2.5" ref={searchRef}>
          <form onSubmit={handleSearchSubmit}
            className="flex border border-gray-300 rounded-lg overflow-hidden bg-white">
            <input
              type="text" value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search Users..."
              autoFocus autoComplete="off"
              className="flex-1 px-3 py-2 text-sm outline-none bg-transparent text-gray-800"
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch} className="px-2 text-gray-400">
                <X size={13} />
              </button>
            )}
            <button type="submit"
              className="px-3 flex items-center justify-center"
              style={{ background: "#1e3a5f", color: "#fff", minWidth: 40 }}>
              <Search size={15} />
            </button>
          </form>

          {showResults && (
            <div className="mt-1.5 rounded-2xl shadow-xl border border-gray-100 overflow-hidden bg-white">
              {searchLoading ? (
                <div className="flex items-center justify-center py-4 gap-2 text-sm text-gray-400">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-4 text-center text-sm text-gray-400">No users found</div>
              ) : (
                searchResults.map((u) => (
                  <button key={u._id}
                    onClick={() => { setSearchOpen(false); handleUserClick(u._id); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left border-b border-gray-50 last:border-0">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
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

      {/* ── MOBILE NAV MENU with Badges ── */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-100 px-3 py-2 bg-white">
          <div className="flex flex-col gap-0.5">
            {NAV_LINKS.map(({ label, path, badge }) => {
              const active = location.pathname === path;
              return (
                <button key={path}
                  onClick={() => { navigate(path); setMobileMenuOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm rounded-xl transition hover:bg-stone-50"
                  style={{
                    color: active ? "#1e3a5f" : "#374151",
                    fontWeight: active ? 700 : 500,
                    background: active ? "#f0f4ff" : "transparent",
                  }}>
                  <span>{label}</span>
                  {badge > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}