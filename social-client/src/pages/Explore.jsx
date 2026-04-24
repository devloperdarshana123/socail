

// // import { useState, useEffect, useRef } from "react";
// // import { useAuth } from "../context/AuthContext";
// // import { useNavigate } from "react-router-dom";
// // import { useDispatch, useSelector } from "react-redux";
// // import toast from "react-hot-toast";
// // import {
// //   Heart, MessageCircle, Search, Send, X ,Share2
// // } from "lucide-react";

// // import {
// //   fetchTrendingPosts, fetchSuggestedUsers, fetchFollowRequestCount,
// //   fetchSentFollowRequests, searchAll, clearSearch,
// //   toggleFollowRequest, likeTrendingPost, commentTrendingPost,
// // } from "../store/slices/Exploreslice";

// // const Avatar = ({ src, name, size = "w-10 h-10", textSize = "text-sm" }) =>
// //   src ? (
// //     <img src={src} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
// //   ) : (
// //     <div className={`${size} rounded-full bg-linear-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold ${textSize} shrink-0`}>
// //       {name?.charAt(0).toUpperCase()}
// //     </div>
// //   );

// // export default function Explore() {
// //   const { user } = useAuth();
// //   const navigate = useNavigate();
// //   const dispatch = useDispatch();

// //   const {
// //     trendingPosts, trendingLoading, exploreHasNext, explorePage,
// //     suggestedUsers, searchResults, searching, hasSearched, pendingRequests,
// //   } = useSelector((s) => s.explore);

// //   const [searchQuery, setSearchQuery]     = useState("");
// //   const [showComments, setShowComments]   = useState({});
// //   const [commentInputs, setCommentInputs] = useState({});
// //   const sentinelRef = useRef(null);

// //   useEffect(() => {
// //     dispatch(fetchTrendingPosts(1));
// //     dispatch(fetchSuggestedUsers());
// //     dispatch(fetchFollowRequestCount());
// //     dispatch(fetchSentFollowRequests());
// //   }, [dispatch]);

// //   useEffect(() => {
// //     if (!sentinelRef.current) return;
// //     const observer = new IntersectionObserver(
// //       (entries) => {
// //         if (entries[0].isIntersecting && exploreHasNext && !trendingLoading)
// //           dispatch(fetchTrendingPosts(explorePage + 1));
// //       },
// //       { threshold: 0.1 }
// //     );
// //     observer.observe(sentinelRef.current);
// //     return () => observer.disconnect();
// //   }, [exploreHasNext, trendingLoading, explorePage, dispatch]);

// //   const handleSearch = (e) => {
// //     e?.preventDefault();
// //     if (!searchQuery.trim()) return;
// //     dispatch(searchAll(searchQuery));
// //   };

// //   const handleClearSearch = () => { setSearchQuery(""); dispatch(clearSearch()); };

// //   const handleFollow = async (userId) => {
// //     const isPending = pendingRequests.includes(userId);
// //     const result = await dispatch(toggleFollowRequest({ userId, isPending }));
// //     if (toggleFollowRequest.fulfilled.match(result))
// //       toast.success(isPending ? "Request canceled!" : "Follow request sent!");
// //     else toast.error(result.payload || "Request failed!");
// //   };

// //   const handleLike = async (postId) => {
// //     const result = await dispatch(likeTrendingPost({ postId, userId: user._id }));
// //     if (likeTrendingPost.rejected.match(result)) toast.error("Like failed!");
// //   };

// //   const handleComment = async (postId) => {
// //     const text = commentInputs[postId]?.trim();
// //     if (!text) return;
// //     const result = await dispatch(commentTrendingPost({ postId, text }));
// //     if (commentTrendingPost.fulfilled.match(result))
// //       setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
// //     else toast.error("Comment failed!");
// //   };

// //   const handleMessage = (userId) => navigate(`/messages/${userId}`);

// //   return (
// //     <div className="flex gap-6 items-start w-full px-4 md:px-8 lg:px-16">

// //       {/* CENTER CONTENT */}
// //       <div className="flex-1 min-w-0 space-y-4 pb-6">

// //         {/* Search Bar */}
       

       

// //         {/* Explore Posts */}
// //         {!hasSearched && (
// //           <>
          

// //             {trendingLoading && trendingPosts.length === 0 ? (
// //               <div className="text-center py-16 text-gray-400">Loading...</div>
// //             ) : trendingPosts.length === 0 ? (
// //               <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
// //                 <p className="text-4xl mb-3">📸</p>
// //                 <p className="text-lg font-medium">No posts right now!</p>
// //               </div>
// //             ) : (
// //               <>
// //                 {trendingPosts.map((post) => (
// //                   <div key={post._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
// //                     <div className="flex items-center justify-between px-4 py-3">
// //                       <div className="flex items-center gap-3 flex-1 min-w-0">
// //                         <Avatar src={post.author?.avatar} name={post.author?.name} />
// //                         <div className="min-w-0">
// //                           <p className="text-sm font-semibold text-gray-800 truncate">{post.author?.name}</p>
// //                           <p className="text-xs text-gray-400 truncate">{post.author?.designation?.trim() || "EroSocial Member"}</p>
// //                         </div>
// //                       </div>
// //                       <div className="flex items-center gap-1.5 shrink-0">
// //                         {(post.likes?.length || 0) >= 5 && (
// //                           <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-500">
// //                             🔥 {post.likes?.length}
// //                           </span>
// //                         )}
// //                         {post.author?._id !== user?._id && (
// //                           <button onClick={() => handleMessage(post.author?._id)}
// //                             className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition">
// //                             <Send size={14} />
// //                           </button>
// //                         )}
// //                       </div>
// //                     </div>

// //                     {post.image && (
// //    <div className="w-full overflow-hidden" style={{ height: "clamp(200px, 40vw, 400px)" }}>
// //   <img src={post.image} alt="post" className="w-full h-full object-cover" />
// // </div>                 
// //                     )}

// //                     <div className="px-4 pt-3 flex items-center gap-4">
// //                       <button onClick={() => handleLike(post._id)}
// //                         className={`flex items-center gap-1.5 text-sm font-medium transition ${post.likes?.includes(user?._id) ? "text-red-500" : "text-gray-400 hover:text-red-400"}`}>
// //                         <Heart size={20} fill={post.likes?.includes(user?._id) ? "currentColor" : "none"} />
// //                         {post.likes?.length || 0}
// //                       </button>
// //                       <button onClick={() => setShowComments((prev) => ({ ...prev, [post._id]: !prev[post._id] }))}
// //                         className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-indigo-500 transition">
// //                         <MessageCircle size={20} />
// //                         {post.comments?.length || 0}
// //                       </button>
// //                     </div>

// //                     {post.caption && (
// //                       <div className="px-4 py-2">
// //                         <span className="text-sm font-semibold text-gray-800 mr-2">{post.author?.name}</span>
// //                         <span className="text-sm text-gray-700">{post.caption}</span>
// //                       </div>
// //                     )}

// //                     {showComments[post._id] && (
// //                       <div className="px-4 pb-3 space-y-2 border-t border-gray-50 mt-2 pt-2">
// //                         {post.comments?.slice(-3).map((c, i) => (
// //                           <div key={i} className="flex items-start gap-2">
// //                             <Avatar src={c.user?.avatar} name={c.user?.name} size="w-6 h-6" textSize="text-xs" />
// //                             <div>
// //                               <span className="text-xs font-semibold text-gray-800 mr-1">{c.user?.name}</span>
// //                               <span className="text-xs text-gray-600">{c.text}</span>
// //                             </div>
// //                           </div>
// //                         ))}
// //                         <div className="flex gap-2 mt-2">
// //                           <input type="text"
// //                             value={commentInputs[post._id] || ""}
// //                             onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post._id]: e.target.value }))}
// //                             onKeyDown={(e) => e.key === "Enter" && handleComment(post._id)}
// //                             placeholder="Write comment..."
// //                             className="flex-1 text-xs px-3 py-1.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
// //                           <button onClick={() => handleComment(post._id)}
// //                             className="text-xs text-indigo-600 font-medium hover:text-indigo-700 px-2">
// //                             Post
// //                           </button>
// //                           <button onClick={() => setShowComments((prev) => ({ ...prev, [post._id]: !prev[post._id] }))}
// //                         className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-indigo-500 transition">
// //                         <MessageCircle size={20} />
// //                         {post.comments?.length || 0}
// //                       </button>
// //                     </div>
// //                         </div>
// //                       </div>
// //                     )}

// //                     <p className="px-4 pb-3 text-xs text-gray-400">
// //                       {new Date(post.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
// //                     </p>
// //                   </div>
// //                 ))}

// //                 {exploreHasNext && (
// //                   <div ref={sentinelRef} className="py-6 flex justify-center">
// //                     {trendingLoading && (
// //                       <div className="flex items-center gap-2 text-sm text-gray-400">
// //                         <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
// //                         Loading...
// //                       </div>
// //                     )}
// //                   </div>
// //                 )}
// //               </>
// //             )}
// //           </>
// //         )}
// //       </div>

// //       {/* RIGHT SIDEBAR */}
// //       <div className="hidden xl:block w-64 shrink-0">
// //         <div className="space-y-4">
// //           <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
// //             <p className="text-sm font-semibold text-gray-500 mb-4">Suggestions For You</p>
// //             <div className="space-y-3">
// //               {suggestedUsers.slice(0, 5).map((u, i) => (
// //                 <div key={u._id || i} className="flex items-center justify-between gap-2">
// //                   <div className="flex items-center gap-2 flex-1 min-w-0">
// //                     {u.avatar ? (
// //                       <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
// //                     ) : (
// //                       <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
// //                         style={{
// //                           background: ["#f0e8df","#fde8e8","#e8f5e9","#ede7f6","#fff8e1"][i % 5],
// //                           color:      ["#6b3f2a","#c0392b","#2e7d32","#6a1b9a","#f57f17"][i % 5],
// //                         }}>
// //                         {u.name?.charAt(0).toUpperCase()}
// //                       </div>
// //                     )}
// //                     <div className="min-w-0">
// //                       <p className="text-xs font-semibold text-gray-800 leading-tight truncate">{u.name}</p>
// //                       <p className="text-xs text-gray-400 truncate">{u.designation?.trim() || "EroSocial Member"}</p>
// //                     </div>
// //                   </div>
// //                   <div className="flex items-center gap-1 shrink-0">
// //                     <button onClick={() => handleMessage(u._id)}
// //                       className="p-1 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition">
// //                       <Send size={13} />
// //                     </button>
// //                     <button onClick={() => handleFollow(u._id)}
// //                       className="text-xs font-semibold transition hover:opacity-70"
// //                       style={{ color: pendingRequests.includes(u._id) ? "#94a3b8" : "#c8956c" }}>
// //                       {pendingRequests.includes(u._id) ? "Req." : "Follow"}
// //                     </button>
// //                   </div>
// //                 </div>
// //               ))}
// //             </div>
// //           </div>
// //           <div className="px-2">
// //             <p className="text-xs text-gray-400 leading-relaxed">EroSocial · Erovians Community · Marbles, Tiles, Stones</p>
// //             <p className="text-xs text-gray-300 mt-2">© 2025 EroSocial</p>
// //           </div>
// //         </div>
// //       </div>

// //     </div>
// //   );
// // }




// import { useState, useEffect, useRef } from "react";
// import { useAuth } from "../context/AuthContext";
// import { useNavigate } from "react-router-dom";
// import { useDispatch, useSelector } from "react-redux";
// import toast from "react-hot-toast";
// import {
//   Heart, MessageCircle, Send, Share2
// } from "lucide-react";

// import {
//   fetchTrendingPosts, fetchSuggestedUsers, fetchFollowRequestCount,
//   fetchSentFollowRequests, searchAll, clearSearch,
//   toggleFollowRequest, likeTrendingPost, commentTrendingPost,
// } from "../store/slices/Exploreslice";

// const Avatar = ({ src, name, size = "w-10 h-10", textSize = "text-sm" }) =>
//   src ? (
//     <img src={src} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
//   ) : (
//     <div className={`${size} rounded-full flex items-center justify-center text-white font-bold ${textSize} shrink-0`}
//       style={{ background: "linear-gradient(135deg, #c8956c, #a07050)" }}>
//       {name?.charAt(0).toUpperCase()}
//     </div>
//   );

// export default function Explore() {
//   const { user } = useAuth();
//   const navigate = useNavigate();
//   const dispatch = useDispatch();

//   const {
//     trendingPosts, trendingLoading, exploreHasNext, explorePage,
//     suggestedUsers, searchResults, searching, hasSearched, pendingRequests,
//   } = useSelector((s) => s.explore);

//   const [searchQuery, setSearchQuery]     = useState("");
//   const [showComments, setShowComments]   = useState({});
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
//         if (entries[0].isIntersecting && exploreHasNext && !trendingLoading)
//           dispatch(fetchTrendingPosts(explorePage + 1));
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

//   const handleClearSearch = () => { setSearchQuery(""); dispatch(clearSearch()); };

//   const handleFollow = async (userId) => {
//     const isPending = pendingRequests.includes(userId);
//     const result = await dispatch(toggleFollowRequest({ userId, isPending }));
//     if (toggleFollowRequest.fulfilled.match(result))
//       toast.success(isPending ? "Request canceled!" : "Follow request sent!");
//     else toast.error(result.payload || "Request failed!");
//   };

//   const handleLike = async (postId) => {
//     const result = await dispatch(likeTrendingPost({ postId, userId: user._id }));
//     if (likeTrendingPost.rejected.match(result)) toast.error("Like failed!");
//   };

//   const handleComment = async (postId) => {
//     const text = commentInputs[postId]?.trim();
//     if (!text) return;
//     const result = await dispatch(commentTrendingPost({ postId, text }));
//     if (commentTrendingPost.fulfilled.match(result))
//       setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
//     else toast.error("Comment failed!");
//   };

//   const handleShare = (post) => {
//     if (navigator.share) {
//       navigator.share({
//         title: post.author?.name,
//         text: post.caption || "Check out this post!",
//         url: `${window.location.origin}/post/${post._id}`,
//       });
//     } else {
//       navigator.clipboard.writeText(`${window.location.origin}/post/${post._id}`);
//       toast.success("Link copied! 🔗");
//     }
//   };

//   const handleMessage = (userId) => navigate(`/messages/${userId}`);

//   return (
//     <div className="flex gap-6 items-start w-full px-4 md:px-8 lg:px-16">

//       {/* CENTER CONTENT */}
//       <div className="flex-1 min-w-0 space-y-4 pb-6">

//         {/* Explore Posts */}
//         {!hasSearched && (
//           <>
//             {trendingLoading && trendingPosts.length === 0 ? (
//               <div className="text-center py-16 text-gray-400">Loading...</div>
//             ) : trendingPosts.length === 0 ? (
//               <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
//                 <p className="text-4xl mb-3">📸</p>
//                 <p className="text-lg font-medium">No posts right now!</p>
//               </div>
//             ) : (
//               <>
//                 {trendingPosts.map((post) => (
//                   <div key={post._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

//                     {/* Post Header */}
//                     <div className="flex items-center justify-between px-4 py-3">
//                       <div className="flex items-center gap-3 flex-1 min-w-0">
//                         <Avatar src={post.author?.avatar} name={post.author?.name} />
//                         <div className="min-w-0">
//                           <p className="text-sm font-semibold text-gray-800 truncate">{post.author?.name}</p>
//                           <p className="text-xs text-gray-400 truncate">{post.author?.designation?.trim() || "EroSocial Member"}</p>
//                         </div>
//                       </div>
//                       <div className="flex items-center gap-1.5 shrink-0">
//                         {(post.likes?.length || 0) >= 5 && (
//                           <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-500">
//                             🔥 {post.likes?.length}
//                           </span>
//                         )}
//                         {post.author?._id !== user?._id && (
//                           <button onClick={() => handleMessage(post.author?._id)}
//                             className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition">
//                             <Send size={14} />
//                           </button>
//                         )}
//                       </div>
//                     </div>

//                     {/* Post Image */}
//                     {post.image && (
//                       <div className="w-full overflow-hidden" style={{ height: "clamp(200px, 40vw, 400px)" }}>
//                         <img src={post.image} alt="post" className="w-full h-full object-cover" />
//                       </div>
//                     )}

//                     {/* Post Video */}
//                     {post.video && !post.image && (
//                       <div className="w-full overflow-hidden" style={{ height: "clamp(200px, 40vw, 400px)" }}>
//                         <video src={post.video} controls className="w-full h-full object-cover" />
//                       </div>
//                     )}

//                     {/* Actions: Like, Comment, Share */}
//                     <div className="px-4 pt-3 flex items-center gap-4">
//                       <button onClick={() => handleLike(post._id)}
//                         className={`flex items-center gap-1.5 text-sm font-medium transition ${post.likes?.includes(user?._id) ? "text-red-500" : "text-gray-400 hover:text-red-400"}`}>
//                         <Heart size={20} fill={post.likes?.includes(user?._id) ? "currentColor" : "none"} />
//                         {post.likes?.length || 0}
//                       </button>
//                       <button onClick={() => setShowComments((prev) => ({ ...prev, [post._id]: !prev[post._id] }))}
//                         className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-indigo-500 transition">
//                         <MessageCircle size={20} />
//                         {post.comments?.length || 0}
//                       </button>
//                       <button onClick={() => handleShare(post)}
//                         className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-green-500 transition ml-auto">
//                         <Share2 size={20} />
//                       </button>
//                     </div>

//                     {/* Caption */}
//                     {post.caption && (
//                       <div className="px-4 py-2">
//                         <span className="text-sm font-semibold text-gray-800 mr-2">{post.author?.name}</span>
//                         <span className="text-sm text-gray-700">{post.caption}</span>
//                       </div>
//                     )}

//                     {/* Comments Section */}
//                     {showComments[post._id] && (
//                       <div className="px-4 pb-3 space-y-2 border-t border-gray-50 mt-2 pt-2">
//                         {post.comments?.slice(-3).map((c, i) => (
//                           <div key={i} className="flex items-start gap-2">
//                             <Avatar src={c.user?.avatar} name={c.user?.name} size="w-6 h-6" textSize="text-xs" />
//                             <div>
//                               <span className="text-xs font-semibold text-gray-800 mr-1">{c.user?.name}</span>
//                               <span className="text-xs text-gray-600">{c.text}</span>
//                             </div>
//                           </div>
//                         ))}
//                         <div className="flex gap-2 mt-2">
//                           <input type="text"
//                             value={commentInputs[post._id] || ""}
//                             onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post._id]: e.target.value }))}
//                             onKeyDown={(e) => e.key === "Enter" && handleComment(post._id)}
//                             placeholder="Write comment..."
//                             className="flex-1 text-xs px-3 py-1.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
//                           <button onClick={() => handleComment(post._id)}
//                             className="text-xs text-indigo-600 font-medium hover:text-indigo-700 px-2">
//                             Post
//                           </button>
//                         </div>
//                       </div>
//                     )}

//                     {/* Date */}
//                     <p className="px-4 pb-3 text-xs text-gray-400">
//                       {new Date(post.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
//                     </p>
//                   </div>
//                 ))}

//                 {exploreHasNext && (
//                   <div ref={sentinelRef} className="py-6 flex justify-center">
//                     {trendingLoading && (
//                       <div className="flex items-center gap-2 text-sm text-gray-400">
//                         <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
//                         Loading...
//                       </div>
//                     )}
//                   </div>
//                 )}
//               </>
//             )}
//           </>
//         )}
//       </div>

//       {/* RIGHT SIDEBAR */}
//       <div className="hidden xl:block w-64 shrink-0">
//         <div className="space-y-4">
//           <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
//             <p className="text-sm font-semibold text-gray-500 mb-4">Suggestions For You</p>
//             <div className="space-y-3">
//               {suggestedUsers.slice(0, 5).map((u, i) => (
//                 <div key={u._id || i} className="flex items-center justify-between gap-2">
//                   <div className="flex items-center gap-2 flex-1 min-w-0">
//                     {u.avatar ? (
//                       <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
//                     ) : (
//                       <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
//                         style={{
//                           background: "linear-gradient(135deg, #c8956c, #a07050)",
//                           color: "#ffffff",
//                         }}>
//                         {u.name?.charAt(0).toUpperCase()}
//                       </div>
//                     )}
//                     <div className="min-w-0">
//                       <p className="text-xs font-semibold text-gray-800 leading-tight truncate">{u.name}</p>
//                       <p className="text-xs text-gray-400 truncate">{u.designation?.trim() || "EroSocial Member"}</p>
//                     </div>
//                   </div>
//                   <div className="flex items-center gap-1 shrink-0">
//                     <button onClick={() => handleMessage(u._id)}
//                       className="p-1 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition">
//                       <Send size={13} />
//                     </button>
//                     <button onClick={() => handleFollow(u._id)}
//                       className="text-xs font-semibold transition hover:opacity-70"
//                       style={{ color: pendingRequests.includes(u._id) ? "#94a3b8" : "#c8956c" }}>
//                       {pendingRequests.includes(u._id) ? "Req." : "Follow"}
//                     </button>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>
//           <div className="px-2">
//             <p className="text-xs text-gray-400 leading-relaxed">EroSocial · Erovians Community · Marbles, Tiles, Stones</p>
//             <p className="text-xs text-gray-300 mt-2">© 2025 EroSocial</p>
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
  Heart, MessageCircle, Send, Share2
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
    <div className={`${size} rounded-full flex items-center justify-center text-white font-bold ${textSize} shrink-0`}
      style={{ background: "linear-gradient(135deg, #c8956c, #a07050)" }}>
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

  const handleShare = (post) => {
    if (navigator.share) {
      navigator.share({
        title: post.author?.name,
        text: post.caption || "Check out this post!",
        url: `${window.location.origin}/post/${post._id}`,
      });
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/post/${post._id}`);
      toast.success("Link copied! 🔗");
    }
  };

  const handleMessage = (userId) => navigate(`/messages/${userId}`);

  return (
    <div className="flex gap-6 items-start w-full px-4 md:px-8 lg:px-16">

      {/* CENTER CONTENT */}
      <div className="flex-1 min-w-0 space-y-4 pb-6">

        {/* Explore Posts */}
        {!hasSearched && (
          <>
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

                    {/* Post Header */}
                    <div className="flex items-center justify-between px-4 py-3">
                     <div
  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
  onClick={() => post.author?._id !== user?._id && navigate(`/user/${post.author?._id}`)}
>
  <Avatar src={post.author?.avatar} name={post.author?.name} />
  <div className="min-w-0">
    <p className="text-sm font-semibold text-gray-800 truncate hover:underline">{post.author?.name}</p>
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
                          <button
                            onClick={() => handleMessage(post.author?._id)}
                            title="Send Message"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition">
                            <Send size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Post Image */}
                    {post.image && (
                      <div className="w-full overflow-hidden" style={{ height: "clamp(200px, 40vw, 400px)" }}>
                        <img src={post.image} alt="post" className="w-full h-full object-cover" />
                      </div>
                    )}

                    {/* Post Video */}
                    {post.video && !post.image && (
                      <div className="w-full overflow-hidden" style={{ height: "clamp(200px, 40vw, 400px)" }}>
                        <video src={post.video} controls className="w-full h-full object-cover" />
                      </div>
                    )}

                    {/* Actions: Like, Comment, Share */}
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
                      <button
                        onClick={() => handleShare(post)}
                        title="Share Post"
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-green-500 transition">
                        <Share2 size={20} />
                      </button>
                    </div>

                    {/* Caption */}
                    {post.caption && (
                      <div className="px-4 py-2">
                        <span className="text-sm font-semibold text-gray-800 mr-2">{post.author?.name}</span>
                        <span className="text-sm text-gray-700">{post.caption}</span>
                      </div>
                    )}

                    {/* Comments Section */}
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

                    {/* Date */}
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
                          background: "linear-gradient(135deg, #c8956c, #a07050)",
                          color: "#ffffff",
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
                    <button
                      onClick={() => handleMessage(u._id)}
                      title="Send Message"
                      className="p-1 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition">
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