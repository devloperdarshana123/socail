

// import { useState, useEffect, useRef } from "react";
// import { useAuth } from "../context/AuthContext";
// import { useNavigate } from "react-router-dom";
// import { useDispatch, useSelector } from "react-redux";
// import toast from "react-hot-toast";
// import DeleteConfirmModal from "../components/DeleteConfirmModal";
// import MapView from "../components/MapView";
// import StoryRow from "../components/StoryRow";
// import { Heart, MessageCircle, Trash2, X, Send, Bookmark, Camera, MapPin } from "lucide-react";
// import {
//   fetchFeed, fetchStats, fetchSuggestions, fetchSavedPostIds,
//   createPost, likePost, commentPost, savePost, deletePost, toggleSavedLocal,
// } from "../store/slices/Feedslice";
// import {
//   toggleFollowRequest, fetchFollowRequestCount, fetchSentFollowRequests,
// } from "../store/slices/Exploreslice";
// import robotImg from "../assets/h.png";

// const Avatar = ({ src, name, size = "w-10 h-10", text = "text-sm" }) =>
//   src ? (
//     <img src={src} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
//   ) : (
//     <div className={`${size} ${text} rounded-full shrink-0 flex items-center justify-center font-bold text-white`}
//       style={{ background: "linear-gradient(135deg, #c8956c, #a07050)" }}>
//       {name?.charAt(0).toUpperCase()}
//     </div>
//   );

// export default function Marketplace({ showCreatePost, setShowCreatePost }) {
//   const { user } = useAuth();
//   const navigate = useNavigate();
//   const dispatch = useDispatch();

//   const { posts, suggestions, savedPostIds, hasNext, page, loading, creating } = useSelector((s) => s.feed);
//   const { pendingRequests } = useSelector((s) => s.explore);

//   const [commentInputs, setCommentInputs] = useState({});
//   const [showComments, setShowComments]   = useState({});
//   const [caption, setCaption]             = useState("");
//   const [image, setImage]                 = useState(null);
//   const [imagePreview, setImagePreview]   = useState(null);
//   const [video, setVideo]                 = useState(null);
//   const [videoPreview, setVideoPreview]   = useState(null);
//   const [location, setLocation] = useState("");
// const [locationLoading, setLocationLoading] = useState(false);
//   const [deleteModalOpen, setDeleteModalOpen] = useState(false);
//   const [postToDelete, setPostToDelete]   = useState(null);
//   const [mapSearch, setMapSearch]         = useState("");
//   const [mapCategory, setMapCategory]     = useState("all");
//   const [botQuery, setBotQuery]           = useState("");
//   const [penguinPos, setPenguinPos]       = useState({ x: 0, y: 0 });
//   const penguinRef = useRef(null);
//   const feedRef    = useRef(null);
//   const loadingRef = useRef(false);
//   const hasNextRef = useRef(false);
//   const pageRef    = useRef(1);
//   const scrollRestored = useRef(false);

//   useEffect(() => { loadingRef.current = loading; }, [loading]);
//   useEffect(() => { hasNextRef.current = hasNext; }, [hasNext]);
//   useEffect(() => { pageRef.current = page; }, [page]);

//   useEffect(() => {
//     dispatch(fetchFeed({ page: 1 }));
//     dispatch(fetchStats());
//     dispatch(fetchSuggestions());
//     dispatch(fetchSavedPostIds());
//     dispatch(fetchFollowRequestCount());
//     dispatch(fetchSentFollowRequests());
//   }, [dispatch]);

// useEffect(() => {
//   if (loading || posts.length === 0 || scrollRestored.current) return;
//   const saved = sessionStorage.getItem("marketplace_scroll");
//   if (!saved) return;
//   requestAnimationFrame(() => {
//     requestAnimationFrame(() => {
//       window.scrollTo(0, parseInt(saved, 10));
//       scrollRestored.current = true;
//       sessionStorage.removeItem("marketplace_scroll");
//     });
//   });
// }, [loading, posts.length]);

//   useEffect(() => {
//     const params = new URLSearchParams(window.location.search);
//     if (params.get("createPost") === "true") {
//       setShowCreatePost(true);
//       window.history.replaceState({}, "", "/");
//     }
//   }, []);

// useEffect(() => {
//     const onScroll = () => {
//       sessionStorage.setItem("marketplace_scroll", window.scrollY.toString());
//       if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 200
//           && hasNextRef.current && !loadingRef.current)
//         dispatch(fetchFeed({ page: pageRef.current + 1 }));
//     };
//     window.addEventListener("scroll", onScroll);
//     return () => window.removeEventListener("scroll", onScroll);
//   }, [dispatch]);

//   const closeModal = () => {
//     setShowCreatePost(false);
//     setCaption("");
//     setImage(null);
//     setImagePreview(null);
//     setVideo(null);
//     setVideoPreview(null);
//     setLocation("");
// setLocationLoading(false);
//   };

//   const handleImageChange = (e) => {
//     const f = e.target.files[0];
//     if (f) { setImage(f); setImagePreview(URL.createObjectURL(f)); setVideo(null); setVideoPreview(null); }
//   };

//   const handleVideoChange = (e) => {
//     const f = e.target.files[0];
//     if (f) { setVideo(f); setVideoPreview(URL.createObjectURL(f)); setImage(null); setImagePreview(null); }
//   };
// const handleGetLocation = () => {
//   if (!navigator.geolocation) { toast.error("GPS support not Working!"); return; }
//   setLocationLoading(true);
//   navigator.geolocation.getCurrentPosition(
//     async (pos) => {
//       const { latitude, longitude } = pos.coords;
//       try {
//         const res = await fetch(
//           `${import.meta.env.VITE_SERVER}/location/reverse?lat=${latitude}&lon=${longitude}`
//         );
//         const data = await res.json();
//         setLocation(data.location || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
//       } catch {
//         setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
//       }
//       setLocationLoading(false);
//     },
//     () => { toast.error("Location not found!"); setLocationLoading(false); }
//   );
// };

//   const handleCreatePost = async (e) => {
//     e.preventDefault();
//     if (!caption && !image && !video) { toast.error("Caption or media add here !"); return; }
//     const res = await dispatch(createPost({ caption, image, video }));
//     if (createPost.fulfilled.match(res)) { toast.success("Post Created! 🎉"); closeModal(); dispatch(fetchStats()); }
//     else toast.error(res.payload || "Post Not Created!");
//   };

//   const handleLike = async (postId) => {
//     const res = await dispatch(likePost({ postId, userId: user._id }));
//     if (likePost.rejected.match(res)) toast.error("Like failed!");
//   };

//   const handleSave = async (postId) => {
//     dispatch(toggleSavedLocal(postId));
//     const res = await dispatch(savePost(postId));
//     if (savePost.rejected.match(res)) { dispatch(toggleSavedLocal(postId)); toast.error("Not Saved!"); }
//     else toast.success(savedPostIds.includes(postId) ? "Unsaved!" : "Saved! 🔖");
//   };

//   const handleComment = async (postId) => {
//     const text = commentInputs[postId]?.trim();
//     if (!text) return;
//     const res = await dispatch(commentPost({ postId, text }));
//     if (commentPost.fulfilled.match(res)) setCommentInputs((p) => ({ ...p, [postId]: "" }));
//     else toast.error("Comment failed!");
//   };

//   const handleDelete = (postId) => { setPostToDelete(postId); setDeleteModalOpen(true); };
//   const confirmDelete = async () => {
//     setDeleteModalOpen(false);
//     const res = await dispatch(deletePost(postToDelete));
//     if (deletePost.fulfilled.match(res)) { toast.success("Deleted!"); dispatch(fetchStats()); }
//     else toast.error("Delete failed!");
//     setPostToDelete(null);
//   };

//   const handleFollow = async (userId) => {
//     const isPending = pendingRequests.includes(userId);
//     const res = await dispatch(toggleFollowRequest({ userId, isPending }));
//     if (toggleFollowRequest.fulfilled.match(res))
//       toast.success(isPending ? "Request canceled!" : "Follow request sent!");
//     else toast.error(res.payload || "Request failed!");
//   };

//   const CATS = ["All","Marble","Granite","Limestone","CNC","Quarry","Supplier","Designer","Other"];

//   return (
//     <div className="flex gap-5 items-start w-full px-4 md:px-8 lg:px-16" style={{ background: "#f8f9fb", minHeight: "100vh" }}>

//       {/* ── MAIN COLUMN ── */}
//       <div ref={feedRef} className="flex-1 min-w-0 w-full px-8">

//         {/* ── HERO: Robot + Map ── */}
//         <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

//           {/* ── LEFT: Robot + Search + Filters ── */}
//           <div className="flex flex-col gap-4">
//             <div className="flex flex-col items-center gap-4">
//               <img
//                 ref={penguinRef}
//                 src={robotImg}
//                 alt="Erovians Bot"
//                 draggable={false}
//                 onMouseDown={(e) => {
//                   e.preventDefault();
//                   const startX = e.clientX - penguinPos.x;
//                   const startY = e.clientY - penguinPos.y;
//                   const move = (ev) => setPenguinPos({ x: ev.clientX - startX, y: ev.clientY - startY });
//                   const up = () => {
//                     document.removeEventListener("mousemove", move);
//                     document.removeEventListener("mouseup", up);
//                   };
//                   document.addEventListener("mousemove", move);
//                   document.addEventListener("mouseup", up);
//                 }}
//                 className="w-32 h-32 md:w-44 md:h-44 lg:w-56 lg:h-56"
//                 style={{
//                   objectFit: "contain", cursor: "grab",
//                   transform: `translate(${penguinPos.x}px, ${penguinPos.y}px)`,
//                   filter: "drop-shadow(0 8px 20px rgba(200,149,108,0.4))",
//                   userSelect: "none",
//                 }}
//               />
//               <div className="text-center">
//                 <p className="text-lg font-bold text-stone-800 mb-0.5">Erovians AI</p>
//                 <p className="text-xs text-stone-400">Search sellers, marble, stones & more</p>
//               </div>
//               <div className="flex gap-2 w-full">
//                 <input
//                   value={botQuery}
//                   onChange={(e) => setBotQuery(e.target.value)}
//                   onKeyDown={(e) => e.key === "Enter" && setMapSearch(botQuery)}
//                   placeholder="e.g. marble supplier Delhi..."
//                   className="flex-1 px-4 py-3 text-sm border border-stone-200 rounded-full bg-stone-50 outline-none focus:border-amber-400 focus:bg-white transition"
//                 />
//                 <button onClick={() => setMapSearch(botQuery)}
//                   className="px-5 py-3 text-sm font-semibold text-white rounded-full hover:opacity-90 transition"
//                   style={{ background: "#1e3a5f" }}>
//                   Search
//                 </button>
//               </div>
//             </div>

//             <div style={{ background: "#ffffff", border: "1px solid #eef0f4", borderRadius: 16, padding: 16 }}>
//               <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">Filter by Category</p>
//               <div className="flex flex-wrap gap-2">
//                 {CATS.map((cat) => {
//                   const val = cat.toLowerCase();
//                   const active = mapCategory === val;
//                   return (
//                     <button key={cat} onClick={() => setMapCategory(val)}
//                       className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition
//                         ${active ? "text-white border-transparent" : "bg-white text-stone-500 border-stone-200 hover:border-stone-400"}`}
//                       style={active ? { background: "#1e3a5f" } : {}}>
//                       {cat}
//                     </button>
//                   );
//                 })}
//               </div>
//             </div>
//           </div>

//           {/* ── RIGHT: Map Circle ── */}
//           <div className="flex flex-col gap-3">
//             <div className="w-full relative" style={{ aspectRatio: "1/1", zIndex: 1 }}>
//               <div className="absolute inset-0 rounded-full overflow-hidden border-4 border-white shadow-2xl">
//                 <MapView
//                   searchQuery={mapSearch}
//                   selectedCategory={mapCategory}
//                   onSearchChange={setMapSearch}
//                   onCategoryChange={setMapCategory}
//                 />
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* ── STORIES ROW ── */}
//         <StoryRow />

//         {/* ── FEED POSTS ── */}
//         {loading && page === 1 ? (
//           <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-400">
//             <div className="w-8 h-8 border-2 border-stone-200 border-t-amber-500 rounded-full animate-spin" />
//             Loading posts...
//           </div>
//         ) : posts.length === 0 ? (
//           <div className="bg-white border border-stone-200 rounded-2xl text-center py-16">
//             <p className="text-4xl mb-3">📸</p>
//             <p className="text-base font-semibold text-stone-700">No posts yet!</p>
//             <p className="text-sm text-stone-400 mt-1 mb-4">Follow people to see their posts</p>
//             <button onClick={() => setShowCreatePost(true)}
//               className="px-5 py-2 text-sm font-semibold text-white rounded-full"
//               style={{ background: "#c8956c" }}>
//               + Create Post
//             </button>
//           </div>
//         ) : (
//           posts.map((post) => {
//             const isLiked = post.likes?.some(id => id?.toString() === user?._id?.toString());
//             const isSaved = savedPostIds.includes(post._id);
//             return (
//               <div key={post._id} className="bg-white border border-stone-200 rounded-2xl overflow-hidden mb-3 hover:shadow-md transition-shadow">
//                 <div className="flex items-center justify-between px-4 py-3">
//                  <div 
//   className="flex items-center gap-3 cursor-pointer"
//   onClick={() => post.author?._id !== user?._id && navigate(`/user/${post.author?._id}`)}
// >
//   <Avatar src={post.author?.avatar} name={post.author?.name} />
//   <div>
//     <p className="text-sm font-semibold text-stone-800 hover:underline">{post.author?.name}</p>
//     <p className="text-xs text-stone-400">{post.author?.designation?.trim() || "EroSocial Member"}</p>
//   </div>
// </div>
//                   <div className="flex gap-1">
//                     {post.author?._id !== user?._id && (
//                       <button onClick={() => navigate(`/messages/${post.author?._id}`)}
//                         className="p-1.5 rounded-lg text-stone-400 hover:text-blue-600 hover:bg-blue-50 transition">
//                         <Send size={15} />
//                       </button>
//                     )}
//                     {post.author?._id === user?._id && (
//                       <button onClick={() => handleDelete(post._id)}
//                         className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition">
//                         <Trash2 size={15} />
//                       </button>
//                     )}
//                   </div>
//                 </div>

// {post.video ? (
//   <video src={post.video} controls className="w-full object-cover max-h-120" />
// ) : post.image ? (
//   <img src={post.image} alt="post" className="w-full object-cover max-h-120" />
// ) : null}

//                 {/* {post.image && (
//                 <img src={post.image} alt="post" className="w-full object-cover max-h-120" />
//                 )}   */}

//                 <div className="flex items-center justify-between px-3 py-2">
//                   <div className="flex gap-1">
//                     <button onClick={() => handleLike(post._id)}
//                       className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition
//                         ${isLiked ? "text-red-500" : "text-stone-400 hover:bg-red-50 hover:text-red-400"}`}>
//                       <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
//                       {post.likes?.length || 0}
//                     </button>
//                     <button onClick={() => setShowComments((p) => ({ ...p, [post._id]: !p[post._id] }))}
//                       className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold text-stone-400 hover:bg-indigo-50 hover:text-indigo-500 transition">
//                       <MessageCircle size={18} />
//                       {post.comments?.length || 0}
//                     </button>
//                   </div>
//                   <button onClick={() => handleSave(post._id)}
//                     className={`p-2 rounded-full transition ${isSaved ? "text-indigo-600" : "text-stone-400 hover:bg-indigo-50 hover:text-indigo-500"}`}>
//                     <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
//                   </button>
//                 </div>

//                 {post.caption && (
//                   <div className="px-4 pb-2 text-sm">
//                     <span className="font-semibold text-stone-800 mr-1.5">{post.author?.name}</span>
//                     <span className="text-stone-500">{post.caption}</span>
//                   </div>
//                 )}

//                 {showComments[post._id] && (
//                   <div className="px-4 pb-3 pt-2 border-t border-stone-100 space-y-2">
//                     {post.comments?.slice(-3).map((c, i) => (
//                       <div key={i} className="flex gap-2 items-start">
//                         <Avatar src={c.user?.avatar} name={c.user?.name} size="w-6 h-6" text="text-xs" />
//                         <div>
//                           <span className="text-xs font-semibold text-stone-700 mr-1">{c.user?.name}</span>
//                           <span className="text-xs text-stone-500">{c.text}</span>
//                         </div>
//                       </div>
//                     ))}
//                     <div className="flex gap-2 items-center mt-2">
//                       <Avatar src={user?.avatar} name={user?.name} size="w-6 h-6" text="text-xs" />
//                       <input
//                         value={commentInputs[post._id] || ""}
//                         onChange={(e) => setCommentInputs((p) => ({ ...p, [post._id]: e.target.value }))}
//                         onKeyDown={(e) => e.key === "Enter" && handleComment(post._id)}
//                         placeholder="Add a comment..."
//                         className="flex-1 text-xs px-3 py-1.5 border border-stone-200 rounded-full outline-none focus:border-amber-400 transition"
//                       />
//                       <button onClick={() => handleComment(post._id)}
//                         className="text-xs font-bold text-amber-600 hover:text-amber-700">
//                         Post
//                       </button>
//                     </div>
//                   </div>
//                 )}

//                 <p className="px-4 pb-3 text-xs text-stone-300">
//                   {new Date(post.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
//                 </p>
//               </div>
//             );
//           })
//         )}

//         {hasNext && loading && (
//           <div className="flex items-center justify-center gap-2 py-5 text-sm text-stone-400">
//             <div className="w-4 h-4 border-2 border-stone-200 border-t-amber-500 rounded-full animate-spin" />
//             Loading more...
//           </div>
//         )}
//         {!hasNext && posts.length > 0 && !loading && (
//           <p className="text-center text-xs text-stone-300 py-5">You're all caught up 🎉</p>
//         )}
//       </div>

//       {/* ── CREATE POST MODAL ── */}
//       {showCreatePost && (
//         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
//           <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">

//             {/* ── Modal Header ── */}
//             <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
//               <div className="flex items-center gap-3">
//                 <Avatar src={user?.avatar} name={user?.name} size="w-9 h-9" text="text-sm" />
//                 <div>
//                   <p className="text-sm font-semibold text-stone-800">{user?.name}</p>
//                   <p className="text-xs text-stone-400">{user?.designation?.trim() || "EroSocial Member"}</p>
//                 </div>
//               </div>
//               <button onClick={closeModal}
//                 className="w-8 h-8 rounded-full border border-stone-200 bg-stone-50 flex items-center justify-center text-stone-400 hover:bg-stone-100 transition">
//                 <X size={15} />
//               </button>
//             </div>

//             <div className="flex">

//               {/* ── LEFT: Media Preview ── */}
//               <div className="w-[48%] bg-stone-50 border-r border-stone-100 flex flex-col items-center justify-center min-h-[300px] gap-4 p-6 relative">
//                 {imagePreview ? (
//                   <>
//                     <img src={imagePreview} alt="preview" className="w-full h-[280px] object-cover rounded-xl" />
//                     <button onClick={() => { setImage(null); setImagePreview(null); }}
//                       className="absolute top-3 right-3 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition">
//                       <X size={13} />
//                     </button>
//                   </>
//                 ) : videoPreview ? (
//                   <>
//                     <video src={videoPreview} controls className="w-full max-h-[280px] rounded-xl object-cover" />
//                     <button onClick={() => { setVideo(null); setVideoPreview(null); }}
//                       className="absolute top-3 right-3 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition">
//                       <X size={13} />
//                     </button>
//                   </>
//                 ) : (
//                   <>
//                     <div className="w-14 h-14 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center">
//                       <Camera size={24} className="text-stone-400" strokeWidth={1.4} />
//                     </div>
//                     <div className="text-center">
//                       <p className="text-sm font-semibold text-stone-600 mb-0.5">Upload media</p>
//                       <p className="text-xs text-stone-400">Photo or video</p>
//                     </div>
//                     <div className="flex gap-2">
//                       <label className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-stone-200 text-xs font-semibold text-stone-600 cursor-pointer bg-white hover:bg-stone-50 transition">
//                         📷 Image
//                         <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
//                       </label>
//                       <label className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-stone-200 text-xs font-semibold text-stone-600 cursor-pointer bg-white hover:bg-stone-50 transition">
//                         🎬 Video
//                         <input type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
//                       </label>
//                     </div>
//                   </>
//                 )}
//               </div>

//               {/* ── RIGHT: Form ── */}
//               <div className="w-[52%] flex flex-col p-5 gap-4">

//                 <textarea
//                   value={caption}
//                   onChange={(e) => setCaption(e.target.value)}
//                   placeholder="What's on your mind? Share something with your community..."
//                   rows={6}
//                   className="w-full px-4 py-3 text-sm border border-stone-200 rounded-2xl bg-stone-50 outline-none focus:ring-2 focus:ring-amber-300 focus:bg-white resize-none transition leading-relaxed"
//                 />

//                 {/* Location row */}
//                 <div className="flex flex-col gap-1.5">
//   <div className="flex items-center gap-2">
//     <div className="flex items-center gap-2 flex-1 px-3 py-2.5 bg-stone-50 rounded-xl border border-stone-100">
//       <MapPin size={14} className="text-stone-400 shrink-0" />
//       <input
//         value={location}
//         onChange={(e) => setLocation(e.target.value)}
//         placeholder="Add location..."
//         className="flex-1 text-xs bg-transparent outline-none text-stone-600 placeholder-stone-400"
//       />
//     </div>
//     <button
//       onClick={handleGetLocation}
//       disabled={locationLoading}
//       className="px-3 py-2.5 text-xs font-semibold rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition disabled:opacity-50 shrink-0"
//     >
//       {locationLoading ? "..." : "📍 GPS"}
//     </button>
//   </div>
//   {location && (
//     <p className="text-xs text-amber-600 px-1 truncate">📍 {location}</p>
//   )}
// </div>

//                 {/* Change media buttons (shown after upload) */}
//                 {(imagePreview || videoPreview) && (
//                   <div className="flex gap-3">
//                     <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 cursor-pointer hover:text-amber-700 transition">
//                       <Camera size={13} /> Change Image
//                       <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
//                     </label>
//                     <span className="text-stone-200">|</span>
//                     <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 cursor-pointer hover:text-amber-700 transition">
//                       🎬 Change Video
//                       <input type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
//                     </label>
//                   </div>
//                 )}

//                 {/* Action buttons */}
//                 <div className="flex gap-2 mt-auto pt-2">
//                   <button
//                     onClick={closeModal}
//                     className="flex-1 py-2.5 text-sm border border-stone-200 rounded-full text-stone-500 hover:bg-stone-50 transition font-medium">
//                     Cancel
//                   </button>
//                   <button
//                     onClick={handleCreatePost}
//                     disabled={creating}
//                     className="flex-[2] py-2.5 text-sm font-semibold text-white rounded-full transition disabled:opacity-50 flex items-center justify-center gap-2"
//                     style={{ background: "linear-gradient(135deg, #c8956c, #b07848)" }}>
//                     <Send size={14} />
//                     {creating ? "Posting..." : "Post Now"}
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       <DeleteConfirmModal
//         isOpen={deleteModalOpen}
//         onConfirm={confirmDelete}
//         onCancel={() => { setDeleteModalOpen(false); setPostToDelete(null); }}
//       />
//     </div>
//   );
// }




import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import MapView from "../components/MapView";
import StoryRow from "../components/StoryRow";
import CommentSection from "../components/CommentSectionV2"; // ✅ NEW
import { Heart, MessageCircle, Trash2, X, Send, Bookmark, Camera, MapPin } from "lucide-react";
import {
  fetchFeed, fetchStats, fetchSuggestions, fetchSavedPostIds,
  createPost, likePost, commentPost, savePost, deletePost, toggleSavedLocal,
} from "../store/slices/Feedslice";
import {
  toggleFollowRequest, fetchFollowRequestCount, fetchSentFollowRequests,
} from "../store/slices/Exploreslice";
import robotImg from "../assets/h.png";
import { motion } from "framer-motion";

const Avatar = ({ src, name, size = "w-10 h-10", text = "text-sm" }) =>
  src ? (
    <img src={src} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
  ) : (
    <div className={`${size} ${text} rounded-full shrink-0 flex items-center justify-center font-bold text-white`}
      style={{ background: "linear-gradient(135deg, #c8956c, #a07050)" }}>
      {name?.charAt(0).toUpperCase()}
    </div>
  );

export default function Marketplace({ showCreatePost, setShowCreatePost }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { posts, suggestions, savedPostIds, hasNext, page, loading, creating } = useSelector((s) => s.feed);
  const { pendingRequests } = useSelector((s) => s.explore);

  const [showComments, setShowComments]   = useState({});
  const [caption, setCaption]             = useState("");
  const [image, setImage]                 = useState(null);
  const [imagePreview, setImagePreview]   = useState(null);
  const [video, setVideo]                 = useState(null);
  const [videoPreview, setVideoPreview]   = useState(null);
  const [location, setLocation]           = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [postToDelete, setPostToDelete]   = useState(null);
  const [mapSearch, setMapSearch]         = useState("");
  const [mapCategory, setMapCategory]     = useState("all");
  const [botQuery, setBotQuery]           = useState("");
  const [penguinPos, setPenguinPos]       = useState({ x: 0, y: 0 });

  const penguinRef = useRef(null);
  const feedRef    = useRef(null);
  const loadingRef = useRef(false);
  const hasNextRef = useRef(false);
  const pageRef    = useRef(1);
  const scrollRestored = useRef(false);

  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { hasNextRef.current = hasNext; }, [hasNext]);
  useEffect(() => { pageRef.current = page; }, [page]);

  useEffect(() => {
    dispatch(fetchFeed({ page: 1 }));
    dispatch(fetchStats());
    dispatch(fetchSuggestions());
    dispatch(fetchSavedPostIds());
    dispatch(fetchFollowRequestCount());
    dispatch(fetchSentFollowRequests());
  }, [dispatch]);

  useEffect(() => {
    if (loading || posts.length === 0 || scrollRestored.current) return;
    const saved = sessionStorage.getItem("marketplace_scroll");
    if (!saved) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(saved, 10));
        scrollRestored.current = true;
        sessionStorage.removeItem("marketplace_scroll");
      });
    });
  }, [loading, posts.length]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("createPost") === "true") {
      setShowCreatePost(true);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      sessionStorage.setItem("marketplace_scroll", window.scrollY.toString());
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 200
          && hasNextRef.current && !loadingRef.current)
        dispatch(fetchFeed({ page: pageRef.current + 1 }));
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [dispatch]);

  const closeModal = () => {
    setShowCreatePost(false);
    setCaption("");
    setImage(null);
    setImagePreview(null);
    setVideo(null);
    setVideoPreview(null);
    setLocation("");
    setLocationLoading(false);
  };

  const handleImageChange = (e) => {
    const f = e.target.files[0];
    if (f) { setImage(f); setImagePreview(URL.createObjectURL(f)); setVideo(null); setVideoPreview(null); }
  };

  const handleVideoChange = (e) => {
    const f = e.target.files[0];
    if (f) { setVideo(f); setVideoPreview(URL.createObjectURL(f)); setImage(null); setImagePreview(null); }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) { toast.error("GPS support not Working!"); return; }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `${import.meta.env.VITE_SERVER}/location/reverse?lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          setLocation(data.location || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch {
          setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        setLocationLoading(false);
      },
      () => { toast.error("Location not found!"); setLocationLoading(false); }
    );
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!caption && !image && !video) { toast.error("Caption or media add here!"); return; }
    const res = await dispatch(createPost({ caption, image, video }));
    if (createPost.fulfilled.match(res)) { toast.success("Post Created! 🎉"); closeModal(); dispatch(fetchStats()); }
    else toast.error(res.payload || "Post Not Created!");
  };

  const handleLike = async (postId) => {
    const res = await dispatch(likePost({ postId, userId: user._id }));
    if (likePost.rejected.match(res)) toast.error("Like failed!");
  };

  const handleSave = async (postId) => {
    dispatch(toggleSavedLocal(postId));
    const res = await dispatch(savePost(postId));
    if (savePost.rejected.match(res)) { dispatch(toggleSavedLocal(postId)); toast.error("Not Saved!"); }
    else toast.success(savedPostIds.includes(postId) ? "Unsaved!" : "Saved! 🔖");
  };

  const handleDelete = (postId) => { setPostToDelete(postId); setDeleteModalOpen(true); };
  const confirmDelete = async () => {
    setDeleteModalOpen(false);
    const res = await dispatch(deletePost(postToDelete));
    if (deletePost.fulfilled.match(res)) { toast.success("Deleted!"); dispatch(fetchStats()); }
    else toast.error("Delete failed!");
    setPostToDelete(null);
  };

  const handleFollow = async (userId) => {
    const isPending = pendingRequests.includes(userId);
    const res = await dispatch(toggleFollowRequest({ userId, isPending }));
    if (toggleFollowRequest.fulfilled.match(res))
      toast.success(isPending ? "Request canceled!" : "Follow request sent!");
    else toast.error(res.payload || "Request failed!");
  };

  const CATS = ["All","Marble","Granite","Limestone","CNC","Quarry","Supplier","Designer","Other"];

  return (
    <div className="flex gap-5 items-start w-full px-4 md:px-8 lg:px-16" style={{ background: "#f8f9fb", minHeight: "100vh" }}>

      {/* ── MAIN COLUMN ── */}
      <div ref={feedRef} className="flex-1 min-w-0 w-full px-8">

        {/* ── HERO: Robot + Map ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

          {/* ── LEFT: Robot + Search + Filters ── */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-4">
              <img
                ref={penguinRef}
                src={robotImg}
                alt="Erovians Bot"
                draggable={false}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX - penguinPos.x;
                  const startY = e.clientY - penguinPos.y;
                  const move = (ev) => setPenguinPos({ x: ev.clientX - startX, y: ev.clientY - startY });
                  const up = () => {
                    document.removeEventListener("mousemove", move);
                    document.removeEventListener("mouseup", up);
                  };
                  document.addEventListener("mousemove", move);
                  document.addEventListener("mouseup", up);
                }}
                className="w-32 h-32 md:w-44 md:h-44 lg:w-56 lg:h-56"
                style={{
                  objectFit: "contain", cursor: "grab",
                  transform: `translate(${penguinPos.x}px, ${penguinPos.y}px)`,
                  filter: "drop-shadow(0 8px 20px rgba(200,149,108,0.4))",
                  userSelect: "none",
                }}
              />
              <div className="text-center">
                <p className="text-lg font-bold text-stone-800 mb-0.5">Erovians AI</p>
                <p className="text-xs text-stone-400">Search sellers, marble, stones & more</p>
              </div>
              <div className="flex gap-2 w-full">
                <input
                  value={botQuery}
                  onChange={(e) => setBotQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setMapSearch(botQuery)}
                  placeholder="e.g. marble supplier Delhi..."
                  className="flex-1 px-4 py-3 text-sm border border-stone-200 rounded-full bg-stone-50 outline-none focus:border-amber-400 focus:bg-white transition"
                />
                <button onClick={() => setMapSearch(botQuery)}
                  className="px-5 py-3 text-sm font-semibold text-white rounded-full hover:opacity-90 transition"
                  style={{ background: "#1e3a5f" }}>
                  Search
                </button>
              </div>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #eef0f4", borderRadius: 16, padding: 16 }}>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">Filter by Category</p>
              <div className="flex flex-wrap gap-2">
                {CATS.map((cat) => {
                  const val = cat.toLowerCase();
                  const active = mapCategory === val;
                  return (
                    <button key={cat} onClick={() => setMapCategory(val)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition
                        ${active ? "text-white border-transparent" : "bg-white text-stone-500 border-stone-200 hover:border-stone-400"}`}
                      style={active ? { background: "#1e3a5f" } : {}}>
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Map Circle ── */}
          <div className="flex flex-col gap-3">
            <div className="w-full relative" style={{ aspectRatio: "1/1", zIndex: 1 }}>
              <div className="absolute inset-0 rounded-full overflow-hidden border-4 border-white shadow-2xl">
                <MapView
                  searchQuery={mapSearch}
                  selectedCategory={mapCategory}
                  onSearchChange={setMapSearch}
                  onCategoryChange={setMapCategory}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── STORIES ROW ── */}
        <StoryRow />

        {/* ── FEED POSTS ── */}
        {loading && page === 1 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-400">
            <div className="w-8 h-8 border-2 border-stone-200 border-t-amber-500 rounded-full animate-spin" />
            Loading posts...
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl text-center py-16">
            <p className="text-4xl mb-3">📸</p>
            <p className="text-base font-semibold text-stone-700">No posts yet!</p>
            <p className="text-sm text-stone-400 mt-1 mb-4">Follow people to see their posts</p>
            <button onClick={() => setShowCreatePost(true)}
              className="px-5 py-2 text-sm font-semibold text-white rounded-full"
              style={{ background: "#c8956c" }}>
              + Create Post
            </button>
          </div>
        ) : (
          posts.map((post, i) => {
            const isLiked = post.likes?.some(id => id?.toString() === user?._id?.toString());
            const isSaved = savedPostIds.includes(post._id);
            return (
              <motion.div 
                key={post._id} 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
                className="bg-white border border-stone-200 rounded-3xl overflow-hidden mb-5 shadow-sm hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-center justify-between px-5 py-4">
                  <div
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => post.author?._id !== user?._id && navigate(`/user/${post.author?._id}`)}
                  >
                    <Avatar src={post.author?.avatar} name={post.author?.name} />
                    <div>
                      <p className="text-sm font-semibold text-stone-800 group-hover:text-amber-600 transition-colors">{post.author?.name}</p>
                      <p className="text-xs text-stone-400">{post.author?.designation?.trim() || "EroSocial Member"}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {post.author?._id !== user?._id && (
                      <button onClick={() => navigate(`/messages/${post.author?._id}`)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-blue-600 hover:bg-blue-50 transition">
                        <Send size={15} />
                      </button>
                    )}
                    {post.author?._id === user?._id && (
                      <button onClick={() => handleDelete(post._id)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <motion.div whileHover={{ scale: 1.01 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                  {post.video ? (
                    <video src={post.video} controls className="w-full object-cover max-h-120" />
                  ) : post.image ? (
                    <img src={post.image} alt="post" className="w-full object-cover max-h-120" />
                  ) : null}
                </motion.div>

                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => handleLike(post._id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition
                        ${isLiked ? "text-red-500" : "text-stone-400 hover:bg-red-50 hover:text-red-400"}`}>
                      <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
                      {post.likes?.length || 0}
                    </button>
                    <button
                      onClick={() => setShowComments((p) => ({ ...p, [post._id]: !p[post._id] }))}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold text-stone-400 hover:bg-indigo-50 hover:text-indigo-500 transition">
                      <MessageCircle size={18} />
                      {post.comments?.length || 0}
                    </button>
                  </div>
                  <button onClick={() => handleSave(post._id)}
                    className={`p-2 rounded-full transition ${isSaved ? "text-indigo-600" : "text-stone-400 hover:bg-indigo-50 hover:text-indigo-500"}`}>
                    <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
                  </button>
                </div>

                {post.caption && (
                  <div className="px-4 pb-2 text-sm">
                    <span className="font-semibold text-stone-800 mr-1.5">{post.author?.name}</span>
                    <span className="text-stone-500">{post.caption}</span>
                  </div>
                )}

                {/* ✅ FIXED: CommentSectionV2 — Reply, Like, Emoji sab kaam karega */}
                {showComments[post._id] && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <CommentSection post={post} />
                  </motion.div>
                )}

                <p className="px-5 pb-4 text-[11px] font-medium text-stone-400 uppercase tracking-wide">
                  {new Date(post.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </motion.div>
            );
          })
        )}

        {hasNext && loading && (
          <div className="flex items-center justify-center gap-2 py-5 text-sm text-stone-400">
            <div className="w-4 h-4 border-2 border-stone-200 border-t-amber-500 rounded-full animate-spin" />
            Loading more...
          </div>
        )}
        {!hasNext && posts.length > 0 && !loading && (
          <p className="text-center text-xs text-stone-300 py-5">You're all caught up 🎉</p>
        )}
      </div>

      {/* ── CREATE POST MODAL ── */}
      {showCreatePost && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <Avatar src={user?.avatar} name={user?.name} size="w-9 h-9" text="text-sm" />
                <div>
                  <p className="text-sm font-semibold text-stone-800">{user?.name}</p>
                  <p className="text-xs text-stone-400">{user?.designation?.trim() || "EroSocial Member"}</p>
                </div>
              </div>
              <button onClick={closeModal}
                className="w-8 h-8 rounded-full border border-stone-200 bg-stone-50 flex items-center justify-center text-stone-400 hover:bg-stone-100 transition">
                <X size={15} />
              </button>
            </div>

            <div className="flex">
              <div className="w-[48%] bg-stone-50 border-r border-stone-100 flex flex-col items-center justify-center min-h-[300px] gap-4 p-6 relative">
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="preview" className="w-full h-[280px] object-cover rounded-xl" />
                    <button onClick={() => { setImage(null); setImagePreview(null); }}
                      className="absolute top-3 right-3 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition">
                      <X size={13} />
                    </button>
                  </>
                ) : videoPreview ? (
                  <>
                    <video src={videoPreview} controls className="w-full max-h-[280px] rounded-xl object-cover" />
                    <button onClick={() => { setVideo(null); setVideoPreview(null); }}
                      className="absolute top-3 right-3 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition">
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center">
                      <Camera size={24} className="text-stone-400" strokeWidth={1.4} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-stone-600 mb-0.5">Upload media</p>
                      <p className="text-xs text-stone-400">Photo or video</p>
                    </div>
                    <div className="flex gap-2">
                      <label className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-stone-200 text-xs font-semibold text-stone-600 cursor-pointer bg-white hover:bg-stone-50 transition">
                        📷 Image
                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                      </label>
                      <label className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-stone-200 text-xs font-semibold text-stone-600 cursor-pointer bg-white hover:bg-stone-50 transition">
                        🎬 Video
                        <input type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
                      </label>
                    </div>
                  </>
                )}
              </div>

              <div className="w-[52%] flex flex-col p-5 gap-4">
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="What's on your mind? Share something with your community..."
                  rows={6}
                  className="w-full px-4 py-3 text-sm border border-stone-200 rounded-2xl bg-stone-50 outline-none focus:ring-2 focus:ring-amber-300 focus:bg-white resize-none transition leading-relaxed"
                />

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 flex-1 px-3 py-2.5 bg-stone-50 rounded-xl border border-stone-100">
                      <MapPin size={14} className="text-stone-400 shrink-0" />
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Add location..."
                        className="flex-1 text-xs bg-transparent outline-none text-stone-600 placeholder-stone-400"
                      />
                    </div>
                    <button
                      onClick={handleGetLocation}
                      disabled={locationLoading}
                      className="px-3 py-2.5 text-xs font-semibold rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition disabled:opacity-50 shrink-0">
                      {locationLoading ? "..." : "📍 GPS"}
                    </button>
                  </div>
                  {location && (
                    <p className="text-xs text-amber-600 px-1 truncate">📍 {location}</p>
                  )}
                </div>

                {(imagePreview || videoPreview) && (
                  <div className="flex gap-3">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 cursor-pointer hover:text-amber-700 transition">
                      <Camera size={13} /> Change Image
                      <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    </label>
                    <span className="text-stone-200">|</span>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 cursor-pointer hover:text-amber-700 transition">
                      🎬 Change Video
                      <input type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
                    </label>
                  </div>
                )}

                <div className="flex gap-2 mt-auto pt-2">
                  <button onClick={closeModal}
                    className="flex-1 py-2.5 text-sm border border-stone-200 rounded-full text-stone-500 hover:bg-stone-50 transition font-medium">
                    Cancel
                  </button>
                  <button onClick={handleCreatePost} disabled={creating}
                    className="flex-[2] py-2.5 text-sm font-semibold text-white rounded-full transition disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, #c8956c, #b07848)" }}>
                    <Send size={14} />
                    {creating ? "Posting..." : "Post Now"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onConfirm={confirmDelete}
        onCancel={() => { setDeleteModalOpen(false); setPostToDelete(null); }}
      />
    </div>
  );
}