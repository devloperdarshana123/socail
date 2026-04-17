

// import { useState, useEffect, useRef } from "react";
// import { useAuth } from "../context/AuthContext";
// import { useNavigate } from "react-router-dom";
// import { useDispatch, useSelector } from "react-redux";
// import toast from "react-hot-toast";
// import Navbar from "../components/Navbar";
// import {
//   Heart, MessageCircle, Search, Home, Bell, Settings,
//   User, Send, Compass, Bookmark, LogOut, ShieldCheck,
//   Plus, X
// } from "lucide-react";

// import {
//   fetchTrendingPosts,
//   fetchSuggestedUsers,
//   fetchFollowRequestCount,
//   fetchSentFollowRequests,
//   searchAll,
//   clearSearch,
//   toggleFollowRequest,
//   likeTrendingPost,
//   commentTrendingPost,
// } from "../store/slices/Exploreslice";

// export default function Explore() {
//   const { user, logout, isAdmin } = useAuth();
//   const navigate = useNavigate();
//   const dispatch = useDispatch();

//   const {
//     trendingPosts, trendingLoading, exploreHasNext, explorePage,
//     suggestedUsers, searchResults, searching, hasSearched,
//     pendingRequests, followRequests,
//   } = useSelector((s) => s.explore);

//   const [searchQuery, setSearchQuery]   = useState("");
//   const [showComments, setShowComments] = useState({});
//   const [commentInputs, setCommentInputs] = useState({});
//   const sentinelRef = useRef(null);

//   useEffect(() => {
//     dispatch(fetchTrendingPosts(1));
//     dispatch(fetchSuggestedUsers());
//     dispatch(fetchFollowRequestCount());
//     dispatch(fetchSentFollowRequests());
//   }, [dispatch]);

//   useEffect(() => {
//     if (!sentinelRef.current) return;
//     const observer = new IntersectionObserver(
//       (entries) => {
//         if (entries[0].isIntersecting && exploreHasNext && !trendingLoading) {
//           dispatch(fetchTrendingPosts(explorePage + 1));
//         }
//       },
//       { threshold: 0.1 }
//     );
//     observer.observe(sentinelRef.current);
//     return () => observer.disconnect();
//   }, [exploreHasNext, trendingLoading, explorePage, dispatch]);

//   const handleSearch = (e) => {
//     e?.preventDefault();
//     if (!searchQuery.trim()) return;
//     dispatch(searchAll(searchQuery));
//   };

//   const handleClearSearch = () => {
//     setSearchQuery("");
//     dispatch(clearSearch());
//   };

//   const handleFollow = async (userId) => {
//     const isPending = pendingRequests.includes(userId);
//     const result = await dispatch(toggleFollowRequest({ userId, isPending }));
//     if (toggleFollowRequest.fulfilled.match(result)) {
//       toast.success(isPending ? "Request canceled!" : "Follow request sent!");
//     } else {
//       toast.error(result.payload || "Request failed!");
//     }
//   };

//   const handleLike = async (postId) => {
//     const result = await dispatch(likeTrendingPost({ postId, userId: user._id }));
//     if (likeTrendingPost.rejected.match(result)) toast.error("Like failed!");
//   };

//   const handleComment = async (postId) => {
//     const text = commentInputs[postId]?.trim();
//     if (!text) return;
//     const result = await dispatch(commentTrendingPost({ postId, text }));
//     if (commentTrendingPost.fulfilled.match(result)) {
//       setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
//     } else {
//       toast.error("Comment failed!");
//     }
//   };

//   // ── Message navigate ───────────────────────────────────────────────────────
//   const handleMessage = (userId) => navigate(`/messages/${userId}`);

//   const Avatar = ({ src, name, size = "w-10 h-10", textSize = "text-sm" }) =>
//     src ? (
//       <img src={src} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
//     ) : (
//       <div className={`${size} rounded-full bg-linear-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold ${textSize} shrink-0`}>
//         {name?.charAt(0).toUpperCase()}
//       </div>
//     );

//   const navItems = [
//     { icon: <Home size={18} />,     label: "Feed",            onClick: () => navigate("/"),                 active: false },
//     { icon: <Compass size={18} />,  label: "Explore",         onClick: () => {},                           active: true  },
//     { icon: <Send size={18} />,     label: "Messages",        onClick: () => navigate("/messages"),        active: false },
//     { icon: <Bell size={18} />,     label: "Follow Requests", onClick: () => navigate("/follow-requests"), active: false, badge: followRequests > 0 ? followRequests : null },
//     { icon: <Bookmark size={18} />, label: "Saved Posts",     onClick: () => navigate("/saved"),           active: false },
//     { icon: <User size={18} />,     label: "My Profile",      onClick: () => navigate("/profile"),         active: false },
//     { icon: <Settings size={18} />, label: "Settings",        onClick: () => navigate("/settings"),        active: false },
//   ];

//   return (
//     <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
//       <Navbar />

//       <div className="flex-1 overflow-hidden w-full px-4 py-6 flex gap-6 items-start">

//         {/* LEFT SIDEBAR */}
//         <div className="hidden lg:block w-64 shrink-0">
//           <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
//             <button
//               onClick={() => navigate("/")}
//               className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white mb-3 hover:opacity-90 transition"
//               style={{ background: "#1e3a5f" }}
//             >
//               <Plus size={16} /> Create Post
//             </button>
//             <nav className="space-y-1">
//               {navItems.map((item) => (
//                 <button
//                   key={item.label}
//                   onClick={item.onClick}
//                   className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition group
//                     ${item.active ? "text-white" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
//                   style={item.active ? { background: "#1e3a5f" } : {}}
//                 >
//                   <span className={item.active ? "text-white" : "text-gray-400 group-hover:text-gray-700"}>
//                     {item.icon}
//                   </span>
//                   <span className="flex-1 text-left">{item.label}</span>
//                   {item.badge && (
//                     <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
//                       {item.badge}
//                     </span>
//                   )}
//                 </button>
//               ))}
//             </nav>
//             <div className="border-t border-gray-100 my-2" />
//             {isAdmin && (
//               <button
//                 onClick={() => navigate("/admin")}
//                 className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-purple-600 hover:bg-purple-50 transition group"
//               >
//                 <ShieldCheck size={18} className="text-purple-400 group-hover:text-purple-600" />
//                 <span className="flex-1 text-left">Admin Panel</span>
//               </button>
//             )}
//             <button
//               onClick={logout}
//               className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition group"
//             >
//               <LogOut size={18} className="text-red-400 group-hover:text-red-500" />
//               <span className="flex-1 text-left">Log Out</span>
//             </button>
//           </div>
//         </div>

//         {/* CENTER CONTENT */}
//         <div className="flex-1 min-w-0 h-full overflow-y-auto pr-1 space-y-4 pb-6">

//           {/* Search Bar */}
//           <form onSubmit={handleSearch}>
//             <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
//               <p className="text-sm font-semibold text-gray-700 mb-3">🔍 Search</p>
//               <div className="flex gap-2">
//                 <div className="relative flex-1">
//                   <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
//                   <input
//                     type="text"
//                     value={searchQuery}
//                     onChange={(e) => setSearchQuery(e.target.value)}
//                     placeholder="Find Users and posts..."
//                     className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
//                   />
//                   {searchQuery && (
//                     <button type="button" onClick={handleClearSearch}
//                       className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
//                       <X size={14} />
//                     </button>
//                   )}
//                 </div>
//                 <button
//                   type="submit"
//                   disabled={searching || !searchQuery.trim()}
//                   className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
//                   style={{ background: "#1e3a5f" }}
//                 >
//                   {searching ? "..." : "Search"}
//                 </button>
//               </div>
//             </div>
//           </form>

//           {/* Search Results */}
//           {hasSearched && (
//             <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
//               <p className="text-sm font-semibold text-gray-700">
//                 Search Results for &quot;{searchQuery}&quot;
//               </p>

//               {searchResults.users.length > 0 && (
//                 <div>
//                   <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Users</p>
//                   <div className="space-y-2">
//                     {searchResults.users.map((u) => (
//                       <div key={u._id} className="flex items-center justify-between gap-2">
//                         <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
//                           onClick={() => navigate(`/profile/${u._id}`)}>
//                           <Avatar src={u.avatar} name={u.name} size="w-9 h-9" textSize="text-xs" />
//                           <div className="min-w-0">
//                             <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
//                             <p className="text-xs text-gray-400 truncate">{u.designation?.trim() || "EroSocial Member"}</p>
//                           </div>
//                         </div>

//                         {u._id !== user?._id && (
//                           <div className="flex items-center gap-1.5 shrink-0">
//                             {/* ── MESSAGE BUTTON ── */}
//                             <button
//                               onClick={() => handleMessage(u._id)}
//                               title="Send message"
//                               className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50 transition"
//                             >
//                               <Send size={13} />
//                             </button>
//                             {/* ── FOLLOW BUTTON ── */}
//                             <button
//                               onClick={() => handleFollow(u._id)}
//                               className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition hover:opacity-80"
//                               style={{
//                                 borderColor: "#1e3a5f",
//                                 color: pendingRequests.includes(u._id) ? "#94a3b8" : "#1e3a5f",
//                                 background: pendingRequests.includes(u._id) ? "#f1f5f9" : "transparent",
//                               }}
//                             >
//                               {pendingRequests.includes(u._id) ? "Requested" : "Follow"}
//                             </button>
//                           </div>
//                         )}
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               )}

//               {searchResults.posts.length > 0 && (
//                 <div>
//                   <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Posts</p>
//                   <div className="space-y-3">
//                     {searchResults.posts.map((post) => (
//                       <div key={post._id} className="border border-gray-100 rounded-xl p-3">
//                         <div className="flex items-center justify-between gap-2 mb-2">
//                           <div className="flex items-center gap-2 flex-1 min-w-0">
//                             <Avatar src={post.author?.avatar} name={post.author?.name} size="w-8 h-8" textSize="text-xs" />
//                             <div className="min-w-0">
//                               <p className="text-xs font-semibold text-gray-800 truncate">{post.author?.name}</p>
//                               <p className="text-xs text-gray-400 truncate">{post.author?.designation?.trim() || "EroSocial Member"}</p>
//                             </div>
//                           </div>
//                           {post.author?._id !== user?._id && (
//                             <button
//                               onClick={() => handleMessage(post.author?._id)}
//                               title="Send message"
//                               className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition shrink-0"
//                             >
//                               <Send size={13} />
//                             </button>
//                           )}
//                         </div>
//                         {post.caption && <p className="text-sm text-gray-700">{post.caption}</p>}
//                         {post.image && <img src={post.image} alt="post" className="w-full rounded-lg mt-2" />}
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               )}

//               {searchResults.users.length === 0 && searchResults.posts.length === 0 && !searching && (
//                 <div className="text-center py-8 text-gray-400">
//                   <p className="text-3xl mb-2">🔍</p>
//                   <p className="text-sm">Result not found!</p>
//                 </div>
//               )}
//             </div>
//           )}

//           {/* Explore Posts */}
//           {!hasSearched && (
//             <>
//               <div className="flex items-center gap-2 px-1">
//                 <p className="text-sm font-semibold text-gray-700">🌍 Explore Posts</p>
//                 <span className="text-xs text-gray-400">— Most liked posts</span>
//               </div>

//               {trendingLoading && trendingPosts.length === 0 ? (
//                 <div className="text-center py-16 text-gray-400">Loading...</div>
//               ) : trendingPosts.length === 0 ? (
//                 <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
//                   <p className="text-4xl mb-3">📸</p>
//                   <p className="text-lg font-medium">No posts right now!</p>
//                 </div>
//               ) : (
//                 <>
//                   {trendingPosts.map((post) => (
//                     <div key={post._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

//                       {/* Post header with Message button */}
//                       <div className="flex items-center justify-between px-4 py-3">
//                         <div className="flex items-center gap-3 flex-1 min-w-0">
//                           <Avatar src={post.author?.avatar} name={post.author?.name} />
//                           <div className="min-w-0">
//                             <p className="text-sm font-semibold text-gray-800 truncate">{post.author?.name}</p>
//                             <p className="text-xs text-gray-400 truncate">
//                               {post.author?.designation?.trim() || "EroSocial Member"}
//                             </p>
//                           </div>
//                         </div>

//                         <div className="flex items-center gap-1.5 shrink-0">
//                           {(post.likes?.length || 0) >= 5 && (
//                             <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-500">
//                               🔥 {post.likes?.length}
//                             </span>
//                           )}
//                           {/* ── MESSAGE BUTTON on post ── */}
//                           {post.author?._id !== user?._id && (
//                             <button
//                               onClick={() => handleMessage(post.author?._id)}
//                               title={`Message ${post.author?.name}`}
//                               className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition"
//                             >
//                               <Send size={14} />
//                             </button>
//                           )}
//                         </div>
//                       </div>

//                       {post.image && (
//                         <img src={post.image} alt="post" className="w-full object-cover" style={{ maxHeight: "500px" }} />
//                       )}

//                       <div className="px-4 pt-3 flex items-center gap-4">
//                         <button
//                           onClick={() => handleLike(post._id)}
//                           className={`flex items-center gap-1.5 text-sm font-medium transition ${
//                             post.likes?.includes(user?._id) ? "text-red-500" : "text-gray-400 hover:text-red-400"
//                           }`}
//                         >
//                           <Heart size={20} fill={post.likes?.includes(user?._id) ? "currentColor" : "none"} />
//                           {post.likes?.length || 0}
//                         </button>
//                         <button
//                           onClick={() => setShowComments((prev) => ({ ...prev, [post._id]: !prev[post._id] }))}
//                           className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-indigo-500 transition"
//                         >
//                           <MessageCircle size={20} />
//                           {post.comments?.length || 0}
//                         </button>
//                       </div>

//                       {post.caption && (
//                         <div className="px-4 py-2">
//                           <span className="text-sm font-semibold text-gray-800 mr-2">{post.author?.name}</span>
//                           <span className="text-sm text-gray-700">{post.caption}</span>
//                         </div>
//                       )}

//                       {showComments[post._id] && (
//                         <div className="px-4 pb-3 space-y-2 border-t border-gray-50 mt-2 pt-2">
//                           {post.comments?.slice(-3).map((c, i) => (
//                             <div key={i} className="flex items-start gap-2">
//                               <Avatar src={c.user?.avatar} name={c.user?.name} size="w-6 h-6" textSize="text-xs" />
//                               <div>
//                                 <span className="text-xs font-semibold text-gray-800 mr-1">{c.user?.name}</span>
//                                 <span className="text-xs text-gray-600">{c.text}</span>
//                               </div>
//                             </div>
//                           ))}
//                           <div className="flex gap-2 mt-2">
//                             <input
//                               type="text"
//                               value={commentInputs[post._id] || ""}
//                               onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post._id]: e.target.value }))}
//                               onKeyDown={(e) => e.key === "Enter" && handleComment(post._id)}
//                               placeholder="Write comment..."
//                               className="flex-1 text-xs px-3 py-1.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
//                             />
//                             <button onClick={() => handleComment(post._id)}
//                               className="text-xs text-indigo-600 font-medium hover:text-indigo-700 px-2">
//                               Post
//                             </button>
//                           </div>
//                         </div>
//                       )}

//                       <p className="px-4 pb-3 text-xs text-gray-400">
//                         {new Date(post.createdAt).toLocaleDateString("en-IN", {
//                           day: "2-digit", month: "short", year: "numeric",
//                         })}
//                       </p>
//                     </div>
//                   ))}

//                   {exploreHasNext && (
//                     <div ref={sentinelRef} className="py-6 flex justify-center">
//                       {trendingLoading && (
//                         <div className="flex items-center gap-2 text-sm text-gray-400">
//                           <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
//                           Loading...
//                         </div>
//                       )}
//                     </div>
//                   )}
//                 </>
//               )}
//             </>
//           )}
//         </div>

//         {/* RIGHT SIDEBAR */}
//         <div className="hidden xl:block w-64 shrink-0">
//           <div className="space-y-4">
//             <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
//               <p className="text-sm font-semibold text-gray-500 mb-4">Suggestions For You</p>
//               <div className="space-y-3">
//                 {suggestedUsers.slice(0, 5).map((u, i) => (
//                   <div key={u._id || i} className="flex items-center justify-between gap-2">
//                     <div className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
//                       onClick={() => navigate(`/profile/${u._id}`)}>
//                       {u.avatar ? (
//                         <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
//                       ) : (
//                         <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
//                           style={{
//                             background: ["#f0e8df","#fde8e8","#e8f5e9","#ede7f6","#fff8e1"][i % 5],
//                             color:      ["#6b3f2a","#c0392b","#2e7d32","#6a1b9a","#f57f17"][i % 5],
//                           }}>
//                           {u.name?.charAt(0).toUpperCase()}
//                         </div>
//                       )}
//                       <div className="min-w-0">
//                         <p className="text-xs font-semibold text-gray-800 leading-tight truncate">{u.name}</p>
//                         <p className="text-xs text-gray-400 truncate">{u.designation?.trim() || "EroSocial Member"}</p>
//                       </div>
//                     </div>

//                     {/* Message + Follow */}
//                     <div className="flex items-center gap-1 shrink-0">
//                       <button
//                         onClick={() => handleMessage(u._id)}
//                         title="Send message"
//                         className="p-1 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition"
//                       >
//                         <Send size={13} />
//                       </button>
//                       <button
//                         onClick={() => handleFollow(u._id)}
//                         className="text-xs font-semibold transition hover:opacity-70"
//                         style={{ color: pendingRequests.includes(u._id) ? "#94a3b8" : "#c8956c" }}
//                       >
//                         {pendingRequests.includes(u._id) ? "Req." : "Follow"}
//                       </button>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>
//             <div className="px-2">
//               <p className="text-xs text-gray-400 leading-relaxed">EroSocial · Erovians Community · Marbles, Tiles, Stones</p>
//               <p className="text-xs text-gray-300 mt-2">© 2025 EroSocial</p>
//             </div>
//           </div>
//         </div>

//       </div>
//     </div>
//   );
// }




import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  Heart, MessageCircle, Search, Send, X
} from "lucide-react";

import {
  fetchTrendingPosts, fetchSuggestedUsers, fetchFollowRequestCount,
  fetchSentFollowRequests, searchAll, clearSearch,
  toggleFollowRequest, likeTrendingPost, commentTrendingPost,
} from "../store/slices/Exploreslice";

const Avatar = ({ src, name, size = "w-10 h-10", textSize = "text-sm" }) =>
  src ? (
    <img src={src} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
  ) : (
    <div className={`${size} rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold ${textSize} shrink-0`}>
      {name?.charAt(0).toUpperCase()}
    </div>
  );

export default function Explore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const {
    trendingPosts, trendingLoading, exploreHasNext, explorePage,
    suggestedUsers, searchResults, searching, hasSearched, pendingRequests,
  } = useSelector((s) => s.explore);

  const [searchQuery, setSearchQuery]     = useState("");
  const [showComments, setShowComments]   = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const sentinelRef = useRef(null);

  useEffect(() => {
    dispatch(fetchTrendingPosts(1));
    dispatch(fetchSuggestedUsers());
    dispatch(fetchFollowRequestCount());
    dispatch(fetchSentFollowRequests());
  }, [dispatch]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && exploreHasNext && !trendingLoading)
          dispatch(fetchTrendingPosts(explorePage + 1));
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [exploreHasNext, trendingLoading, explorePage, dispatch]);

  const handleSearch = (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    dispatch(searchAll(searchQuery));
  };

  const handleClearSearch = () => { setSearchQuery(""); dispatch(clearSearch()); };

  const handleFollow = async (userId) => {
    const isPending = pendingRequests.includes(userId);
    const result = await dispatch(toggleFollowRequest({ userId, isPending }));
    if (toggleFollowRequest.fulfilled.match(result))
      toast.success(isPending ? "Request canceled!" : "Follow request sent!");
    else toast.error(result.payload || "Request failed!");
  };

  const handleLike = async (postId) => {
    const result = await dispatch(likeTrendingPost({ postId, userId: user._id }));
    if (likeTrendingPost.rejected.match(result)) toast.error("Like failed!");
  };

  const handleComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    const result = await dispatch(commentTrendingPost({ postId, text }));
    if (commentTrendingPost.fulfilled.match(result))
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    else toast.error("Comment failed!");
  };

  const handleMessage = (userId) => navigate(`/messages/${userId}`);

  return (
    <div className="flex gap-6 items-start w-full">

      {/* CENTER CONTENT */}
      <div className="flex-1 min-w-0 space-y-4 pb-6">

        {/* Search Bar */}
        <form onSubmit={handleSearch}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">🔍 Search</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find Users and posts..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                {searchQuery && (
                  <button type="button" onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button type="submit" disabled={searching || !searchQuery.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
                style={{ background: "#1e3a5f" }}>
                {searching ? "..." : "Search"}
              </button>
            </div>
          </div>
        </form>

        {/* Search Results */}
        {hasSearched && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
            <p className="text-sm font-semibold text-gray-700">
              Search Results for &quot;{searchQuery}&quot;
            </p>
            {searchResults.users.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Users</p>
                <div className="space-y-2">
                  {searchResults.users.map((u) => (
                    <div key={u._id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar src={u.avatar} name={u.name} size="w-9 h-9" textSize="text-xs" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.designation?.trim() || "EroSocial Member"}</p>
                        </div>
                      </div>
                      {u._id !== user?._id && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => handleMessage(u._id)}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50 transition">
                            <Send size={13} />
                          </button>
                          <button onClick={() => handleFollow(u._id)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition hover:opacity-80"
                            style={{
                              borderColor: "#1e3a5f",
                              color: pendingRequests.includes(u._id) ? "#94a3b8" : "#1e3a5f",
                              background: pendingRequests.includes(u._id) ? "#f1f5f9" : "transparent",
                            }}>
                            {pendingRequests.includes(u._id) ? "Requested" : "Follow"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchResults.posts.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Posts</p>
                <div className="space-y-3">
                  {searchResults.posts.map((post) => (
                    <div key={post._id} className="border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Avatar src={post.author?.avatar} name={post.author?.name} size="w-8 h-8" textSize="text-xs" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{post.author?.name}</p>
                            <p className="text-xs text-gray-400 truncate">{post.author?.designation?.trim() || "EroSocial Member"}</p>
                          </div>
                        </div>
                        {post.author?._id !== user?._id && (
                          <button onClick={() => handleMessage(post.author?._id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition shrink-0">
                            <Send size={13} />
                          </button>
                        )}
                      </div>
                      {post.caption && <p className="text-sm text-gray-700">{post.caption}</p>}
                      {post.image && <img src={post.image} alt="post" className="w-full rounded-lg mt-2" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchResults.users.length === 0 && searchResults.posts.length === 0 && !searching && (
              <div className="text-center py-8 text-gray-400">
                <p className="text-3xl mb-2">🔍</p>
                <p className="text-sm">Result not found!</p>
              </div>
            )}
          </div>
        )}

        {/* Explore Posts */}
        {!hasSearched && (
          <>
            <div className="flex items-center gap-2 px-1">
              <p className="text-sm font-semibold text-gray-700">🌍 Explore Posts</p>
              <span className="text-xs text-gray-400">— Most liked posts</span>
            </div>

            {trendingLoading && trendingPosts.length === 0 ? (
              <div className="text-center py-16 text-gray-400">Loading...</div>
            ) : trendingPosts.length === 0 ? (
              <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
                <p className="text-4xl mb-3">📸</p>
                <p className="text-lg font-medium">No posts right now!</p>
              </div>
            ) : (
              <>
                {trendingPosts.map((post) => (
                  <div key={post._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar src={post.author?.avatar} name={post.author?.name} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{post.author?.name}</p>
                          <p className="text-xs text-gray-400 truncate">{post.author?.designation?.trim() || "EroSocial Member"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(post.likes?.length || 0) >= 5 && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-500">
                            🔥 {post.likes?.length}
                          </span>
                        )}
                        {post.author?._id !== user?._id && (
                          <button onClick={() => handleMessage(post.author?._id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition">
                            <Send size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {post.image && (
                      <img src={post.image} alt="post" className="w-full object-cover" style={{ maxHeight: "500px" }} />
                    )}

                    <div className="px-4 pt-3 flex items-center gap-4">
                      <button onClick={() => handleLike(post._id)}
                        className={`flex items-center gap-1.5 text-sm font-medium transition ${post.likes?.includes(user?._id) ? "text-red-500" : "text-gray-400 hover:text-red-400"}`}>
                        <Heart size={20} fill={post.likes?.includes(user?._id) ? "currentColor" : "none"} />
                        {post.likes?.length || 0}
                      </button>
                      <button onClick={() => setShowComments((prev) => ({ ...prev, [post._id]: !prev[post._id] }))}
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-indigo-500 transition">
                        <MessageCircle size={20} />
                        {post.comments?.length || 0}
                      </button>
                    </div>

                    {post.caption && (
                      <div className="px-4 py-2">
                        <span className="text-sm font-semibold text-gray-800 mr-2">{post.author?.name}</span>
                        <span className="text-sm text-gray-700">{post.caption}</span>
                      </div>
                    )}

                    {showComments[post._id] && (
                      <div className="px-4 pb-3 space-y-2 border-t border-gray-50 mt-2 pt-2">
                        {post.comments?.slice(-3).map((c, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <Avatar src={c.user?.avatar} name={c.user?.name} size="w-6 h-6" textSize="text-xs" />
                            <div>
                              <span className="text-xs font-semibold text-gray-800 mr-1">{c.user?.name}</span>
                              <span className="text-xs text-gray-600">{c.text}</span>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-2">
                          <input type="text"
                            value={commentInputs[post._id] || ""}
                            onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post._id]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && handleComment(post._id)}
                            placeholder="Write comment..."
                            className="flex-1 text-xs px-3 py-1.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                          <button onClick={() => handleComment(post._id)}
                            className="text-xs text-indigo-600 font-medium hover:text-indigo-700 px-2">
                            Post
                          </button>
                        </div>
                      </div>
                    )}

                    <p className="px-4 pb-3 text-xs text-gray-400">
                      {new Date(post.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                ))}

                {exploreHasNext && (
                  <div ref={sentinelRef} className="py-6 flex justify-center">
                    {trendingLoading && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                        Loading...
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="hidden xl:block w-64 shrink-0">
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-sm font-semibold text-gray-500 mb-4">Suggestions For You</p>
            <div className="space-y-3">
              {suggestedUsers.slice(0, 5).map((u, i) => (
                <div key={u._id || i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{
                          background: ["#f0e8df","#fde8e8","#e8f5e9","#ede7f6","#fff8e1"][i % 5],
                          color:      ["#6b3f2a","#c0392b","#2e7d32","#6a1b9a","#f57f17"][i % 5],
                        }}>
                        {u.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 leading-tight truncate">{u.name}</p>
                      <p className="text-xs text-gray-400 truncate">{u.designation?.trim() || "EroSocial Member"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleMessage(u._id)}
                      className="p-1 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition">
                      <Send size={13} />
                    </button>
                    <button onClick={() => handleFollow(u._id)}
                      className="text-xs font-semibold transition hover:opacity-70"
                      style={{ color: pendingRequests.includes(u._id) ? "#94a3b8" : "#c8956c" }}>
                      {pendingRequests.includes(u._id) ? "Req." : "Follow"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="px-2">
            <p className="text-xs text-gray-400 leading-relaxed">EroSocial · Erovians Community · Marbles, Tiles, Stones</p>
            <p className="text-xs text-gray-300 mt-2">© 2025 EroSocial</p>
          </div>
        </div>
      </div>

    </div>
  );
}