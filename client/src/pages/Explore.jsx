// // import { useEffect, useRef, useCallback, useState } from "react";
// // import { useDispatch, useSelector } from "react-redux";
// // import PostModal from "../components/PostModal";
// // import { resolvePostThumb } from "../utils/mediaUtils";
// // import { Search, X, Image, Video, FileText, Grid, Heart, MessageCircle, Eye, Play } from "lucide-react";
// // import {
// //   fetchExplorePosts,
// //   fetchMoreExplorePosts,
// //   searchExplorePosts,
// //   fetchMoreSearchPosts,
// //   setActiveType,
// //   setSearchMode,
// //   clearExplore,
// //   setPostsFromCache,
// // } from "../lib/redux/exploreSlice";

// // // ── Theme ──────────────────────────────────────────────────────
// // const T = {
// //   bg:       "#faf6f0",
// //   card:     "#ffffff",
// //   border:   "#e8d5be",
// //   brown:    "#5a3e2b",
// //   brownMid: "#8b6343",
// //   brownLt:  "#f5ece0",
// //   accent:   "#c09a6e",
// //   text:     "#2d1f0f",
// //   textLt:   "#a08060",
// // };

// // // ── Type Filter Tabs ───────────────────────────────────────────
// // const TYPE_TABS = [
// //   { id: "all",   label: "All",    icon: Grid      },
// //   { id: "image", label: "Photos", icon: Image     },
// //   { id: "reel",  label: "Reels",  icon: Video     },
// //   { id: "text",  label: "Posts",  icon: FileText  },
// // ];

// // // ── Post Card ──────────────────────────────────────────────────
// // function PostCard({ post, onClick }) {
// //   const isReel  = post.type === "reel";
// //   const isText  = post.type === "text";
// //   const isMulti = post.media?.length > 1;

// //   // Thumbnail URL
// // const thumb = resolvePostThumb(post);

// //   return (
// //     <div
// //       onClick={() => onClick(post)}
// //       className="relative group rounded-2xl overflow-hidden cursor-pointer"
// //       style={{ background: T.card, border: `1px solid ${T.border}` }}
// //     >
// //       {/* ── Media / Text content ── */}
// //       {isText ? (
// //         // Text post — caption show karo
// //         <div className="p-4 min-h-30 flex flex-col justify-between"
// //           style={{ background: `linear-gradient(135deg, ${T.brownLt}, #fff)` }}>
// //           <p className="text-sm font-medium line-clamp-5" style={{ color: T.text }}>
// //             {post.caption || "—"}
// //           </p>
// //           {post.hashtags?.length > 0 && (
// //             <div className="flex flex-wrap gap-1 mt-2">
// //               {post.hashtags.slice(0, 3).map((tag, i) => (
// //                 <span key={i} className="text-xs font-semibold" style={{ color: T.accent }}>
// //                   #{tag}
// //                 </span>
// //               ))}
// //             </div>
// //           )}
// //         </div>
// //       ) : (
// //         // Image / Reel
// //         <div className="relative w-full" style={{ paddingBottom: "100%" }}>
// //           {thumb ? (
// //             <img
// //               src={thumb}
// //               alt={post.caption || "post"}
// //               className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
// //               loading="lazy"
// //               decoding="async"
// //             />
// //           ) : (
// //             <div className="absolute inset-0 flex items-center justify-center"
// //               style={{ background: T.brownLt }}>
// //               <Video size={32} style={{ color: T.textLt }} />
// //             </div>
// //           )}

// //           {/* Reel play icon */}
// //           {isReel && (
// //             <div className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center bg-black/50">
// //               <Play size={14} fill="white" color="white" />
// //             </div>
// //           )}

// //           {/* Carousel icon */}
// //           {isMulti && (
// //             <div className="absolute top-2 right-2">
// //               <div className="flex gap-0.5">
// //                 <div className="w-1.5 h-1.5 rounded-full bg-white" />
// //                 <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
// //                 <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
// //               </div>
// //             </div>
// //           )}
// //         </div>
// //       )}

// //       {/* ── Hover overlay with stats ── */}
// //       <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-4 rounded-2xl">
// //         {!post.likesHidden && (
// //           <div className="flex items-center gap-1.5 text-white">
// //             <Heart size={18} fill="white" />
// //             <span className="text-sm font-bold">{fmtCount(post.likesCount)}</span>
// //           </div>
// //         )}
// //         {!post.commentsDisabled && (
// //           <div className="flex items-center gap-1.5 text-white">
// //             <MessageCircle size={18} fill="white" />
// //             <span className="text-sm font-bold">{fmtCount(post.commentsCount)}</span>
// //           </div>
// //         )}
// //         <div className="flex items-center gap-1.5 text-white">
// //           <Eye size={18} />
// //           <span className="text-sm font-bold">{fmtCount(post.viewsCount)}</span>
// //         </div>
// //       </div>

// //       {/* ── Author chip ── */}
// //       <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/50 rounded-full px-2 py-1
// //         opacity-0 group-hover:opacity-100 transition-opacity duration-200">
// //         {post.author?.avatar?.url ? (
// //           <img src={post.author.avatar.url} alt=""
// //             className="w-5 h-5 rounded-full object-cover" />
// //         ) : (
// //           <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
// //             style={{ background: T.accent }}>
// //             {post.author?.fullName?.[0]?.toUpperCase()}
// //           </div>
// //         )}
// //         <span className="text-white text-xs font-semibold">@{post.author?.username}</span>
// //       </div>
// //     </div>
// //   );
// // }

// // // ── Number formatter ───────────────────────────────────────────
// // function fmtCount(n = 0) {
// //   if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
// //   if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
// //   return n;
// // }

// // // ── Skeleton Card ──────────────────────────────────────────────
// // function SkeletonCard() {
// //   return (
// //     <div className="rounded-2xl overflow-hidden animate-pulse"
// //       style={{ background: T.brownLt, paddingBottom: "100%" }} />
// //   );
// // }

// // // ── Masonry Grid ───────────────────────────────────────────────
// // // function MasonryGrid({ posts, onPostClick, loading }) {
// // //   // 3 column masonry — posts ko 3 columns mein distribute karo
// // //   const cols = [[], [], []];
// // //   posts.forEach((post, i) => cols[i % 3].push(post));

// // //   return (
// // //     <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
// // //       {loading && posts.length === 0
// // //         ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
// // //         : cols.map((col, ci) => (
// // //             <div key={ci} className="flex flex-col gap-2 md:gap-3">
// // //               {col.map((post) => (
// // //                 <PostCard key={post._id} post={post} onClick={onPostClick} />
// // //               ))}
// // //             </div>
// // //           ))
// // //       }
// // //     </div>
// // //   );
// // // }

// // // ── Masonry Grid ───────────────────────────────────────────────
// // function MasonryGrid({ posts, onPostClick, loading }) {
// //   const [numCols, setNumCols] = useState(window.innerWidth < 768 ? 2 : 3);

// //   useEffect(() => {
// //     const handleResize = () => {
// //       setNumCols(window.innerWidth < 768 ? 2 : 3);
// //     };
// //     window.addEventListener("resize", handleResize);
// //     return () => window.removeEventListener("resize", handleResize);
// //   }, []);

// //   const cols = Array.from({ length: numCols }, () => []);
// //   posts.forEach((post, i) => cols[i % numCols].push(post));

// //   return (
// //     <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
// //       {loading && posts.length === 0
// //         ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
// //         : cols.map((col, ci) => (
// //             <div key={ci} className="flex flex-col gap-2 md:gap-3">
// //               {col.map((post) => (
// //                 <PostCard key={post._id} post={post} onClick={onPostClick} />
// //               ))}
// //             </div>
// //           ))
// //       }
// //     </div>
// //   );
// // }
// // // ── MAIN ──────────────────────────────────────────────────────
// // export default function Explore() {
// //   const dispatch = useDispatch();
// //   // const {
// //   //   posts, nextCursor, hasMore, activeType, loading, loadingMore,
// //   //   searchPosts, searchCursor, searchHasMore, isSearchMode,
// //   //   searchLoading, searchLoadingMore, error,
// //   // } = useSelector((s) => s.explore);


// //   const {
// //   posts, nextCursor, hasMore, activeType, loading, loadingMore,
// //   searchPosts, searchCursor, searchHasMore, isSearchMode,
// //   searchLoading, searchLoadingMore, error, postsByType,
// // } = useSelector((s) => s.explore);

// //  const [searchInput, setSearchInput] = useState("");
// // const [selectedPost, setSelectedPost] = useState(null);

// // // URL se post restore karo
// // useEffect(() => {
// //   const params = new URLSearchParams(window.location.search);
// //   const postId = params.get("post");
// //   if (!postId) return;
// //   const found = posts.find((p) => p._id === postId);
// //   if (found) setSelectedPost(found);
// // }, [posts]);
// //   const searchTimer = useRef(null);
// //   const loaderRef   = useRef(null);


// //   useEffect(() => {
// //   const params = new URLSearchParams(window.location.search);
// //   const tab = params.get("tab");
// //   if (tab && tab !== activeType) dispatch(setActiveType(tab));
// // }, []);
// //   // ── Initial fetch ──
// //   // useEffect(() => {
// //   //   dispatch(clearExplore());
// //   //   dispatch(fetchExplorePosts({ type: activeType }));
// //   // }, [activeType, dispatch]);


// // //   useEffect(() => {
// // //   if (posts.length > 0) return;
// // //   dispatch(fetchExplorePosts({ type: activeType }));
// // // }, [activeType, dispatch]);
// // //   // ── Cleanup on unmount ──
// // //   // useEffect(() => () => dispatch(clearExplore()), [dispatch]);

// // useEffect(() => {
// //   if (postsByType[activeType]?.length > 0) {
// //     dispatch(setPostsFromCache(activeType));
// //     return;
// //   }
// //   dispatch(fetchExplorePosts({ type: activeType }));
// // }, [activeType, dispatch]);
// //   useEffect(() => {
// //   return () => dispatch(clearExplore());
// // }, []);
// //   // ── Infinite scroll — IntersectionObserver ──
// //   const handleLoadMore = useCallback(() => {
// //     if (isSearchMode) {
// //       if (!searchLoadingMore && searchHasMore && searchCursor) {
// //         dispatch(fetchMoreSearchPosts({ q: searchInput, cursor: searchCursor }));
// //       }
// //     } else {
// //       if (!loadingMore && hasMore && nextCursor) {
// //         dispatch(fetchMoreExplorePosts({ cursor: nextCursor, type: activeType }));
// //       }
// //     }
// //   }, [
// //     isSearchMode, searchLoadingMore, searchHasMore, searchCursor,
// //     loadingMore, hasMore, nextCursor, activeType, searchInput, dispatch,
// //   ]);

// //   useEffect(() => {
// //     const observer = new IntersectionObserver(
// //       (entries) => { if (entries[0].isIntersecting) handleLoadMore(); },
// //       { threshold: 0.1 , rootMargin: "400px" }
// //     );
// //     if (loaderRef.current) observer.observe(loaderRef.current);
// //     return () => observer.disconnect();
// //   }, [handleLoadMore]);

// //   // ── Search — debounce 500ms ──
// //   const handleSearchChange = (e) => {
// //     const val = e.target.value;
// //     setSearchInput(val);
// //     clearTimeout(searchTimer.current);
// //     if (!val.trim()) {
// //       dispatch(setSearchMode(false));
// //       return;
// //     }
// //     searchTimer.current = setTimeout(() => {
// //       dispatch(searchExplorePosts({ q: val.trim() }));
// //     }, 500);
// //   };

// //   const handleClearSearch = () => {
// //     setSearchInput("");
// //     dispatch(setSearchMode(false));
// //   };

// //   // ── Tab change ──
// //  const handleTabChange = (type) => {
// //   if (type === activeType) return;
// //   dispatch(setActiveType(type));
// //   window.history.pushState({}, "", `?tab=${type}`);
// // };

// //   const displayPosts = isSearchMode ? searchPosts : posts;
// //   const isLoadingAny = loading || searchLoading;
// //   const isLoadingMoreAny = loadingMore || searchLoadingMore;

// //   return (
// //     <div className="min-h-screen pt-14 md:pt-0" style={{ background: T.bg }}>
// //       <div className="max-w-5xl mx-auto px-3 py-4 md:py-8">

// //         {/* ── Search Bar ── */}
// //         <div className="mb-4 relative">
// //           <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2"
// //             style={{ color: T.textLt }} />
// //           <input
// //             type="text"
// //             value={searchInput}
// //             onChange={handleSearchChange}
// //             placeholder="Search posts, hashtags..."
// //             className="w-full pl-10 pr-10 py-3 rounded-2xl text-sm outline-none transition-all"
// //             style={{
// //               background: T.card,
// //               border: `1.5px solid ${T.border}`,
// //               color: T.text,
// //             }}
// //             onFocus={(e) => (e.target.style.borderColor = T.accent)}
// //             onBlur={(e)  => (e.target.style.borderColor = T.border)}
// //           />
// //           {searchInput && (
// //             <button onClick={handleClearSearch}
// //               className="absolute right-3.5 top-1/2 -translate-y-1/2"
// //               style={{ color: T.textLt }}>
// //               <X size={16} />
// //             </button>
// //           )}
// //         </div>

// //         {/* ── Type Filter Tabs — sirf explore mode mein ── */}
// //         {!isSearchMode && (
// //           <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
// //             {TYPE_TABS.map(({ id, label, icon: Icon }) => {
// //               const active = activeType === id;
// //               return (
// //                 <button key={id} onClick={() => handleTabChange(id)}
// //                   className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all"
// //                   style={{
// //                     background: active ? T.brown : T.card,
// //                     color:      active ? "#fff"  : T.brownMid,
// //                     border:     `1.5px solid ${active ? T.brown : T.border}`,
// //                   }}>
// //                   <Icon size={13} />
// //                   {label}
// //                 </button>
// //               );
// //             })}
// //           </div>
// //         )}

// //         {/* ── Search mode header ── */}
// //         {isSearchMode && (
// //           <div className="mb-4 flex items-center justify-between">
// //             <p className="text-sm font-semibold" style={{ color: T.brownMid }}>
// //               Results for <span style={{ color: T.brown }}>"{searchInput}"</span>
// //               <span className="ml-2 font-normal" style={{ color: T.textLt }}>
// //                 ({searchPosts.length} posts)
// //               </span>
// //             </p>
// //             <button onClick={handleClearSearch}
// //               className="text-xs font-semibold" style={{ color: T.accent }}>
// //               Clear
// //             </button>
// //           </div>
// //         )}

// //         {/* ── Error ── */}
// //         {error && (
// //           <div className="text-center py-8">
// //             <p className="text-sm text-red-500">{error}</p>
// //             <button onClick={() => dispatch(fetchExplorePosts({ type: activeType }))}
// //               className="mt-3 text-sm font-semibold underline" style={{ color: T.brown }}>
// //               Try again
// //             </button>
// //           </div>
// //         )}

// //         {/* ── Empty state ── */}
// //         {!isLoadingAny && !error && displayPosts.length === 0 && (
// //           <div className="text-center py-20">
// //             <p className="text-4xl mb-3">🔍</p>
// //             <p className="font-semibold" style={{ color: T.brown }}>
// //               {isSearchMode ? "No posts found" : "No posts yet"}
// //             </p>
// //             <p className="text-sm mt-1" style={{ color: T.textLt }}>
// //               {isSearchMode ? "Try a different search" : "Check back later!"}
// //             </p>
// //           </div>
// //         )}

// //         {/* ── Masonry Grid ── */}
// //         {!error && (
// //           <MasonryGrid
// //             posts={displayPosts}
// //             onPostClick={(post) => {
// //   setSelectedPost(post);
// //   window.history.pushState({}, "", `?tab=${activeType}&post=${post._id}`);
// // }}
// //             loading={isLoadingAny}
// //           />
// //         )}

// //         {/* ── Load more skeletons ── */}
// //         {isLoadingMoreAny && (
// //           <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 mt-3">
// //             {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
// //           </div>
// //         )}

// //         {/* ── Infinite scroll trigger ── */}
// //         <div ref={loaderRef} className="h-10 mt-4" />

// //         {/* ── End of feed ── */}
// //         {!isLoadingAny && !isLoadingMoreAny &&
// //           ((isSearchMode && !searchHasMore) || (!isSearchMode && !hasMore)) &&
// //           displayPosts.length > 0 && (
// //           <p className="text-center text-xs py-6" style={{ color: T.textLt }}>
// //             You've seen it all ✨
// //           </p>
// //         )}
// //       </div>

// //        {selectedPost && (
// //         <PostModal
// //           post={selectedPost}
// //          onClose={() => {
// //   setSelectedPost(null);
// //   window.history.pushState({}, "", `?tab=${activeType}`);
// // }}
// //         />
// //       )}
// //     </div>
// //   );
// // }



// import { useEffect, useRef, useCallback, useState } from "react";
// import { useDispatch, useSelector } from "react-redux";
// import PostModal from "../components/PostModal";
// import { resolvePostThumb } from "../utils/mediaUtils";
// import { 
//   Search, X, Image, Video, FileText, Grid, Heart, MessageCircle, Eye, 
//   Play, Sparkles, ArrowRight, Share2, Bookmark 
// } from "lucide-react";
// import {
//   fetchExplorePosts,
//   fetchMoreExplorePosts,
//   setActiveType,
//   clearExplore,
//   setPostsFromCache,
// } from "../lib/redux/exploreSlice";

// // ── Enhanced Theme ────────────────────────────────────────────
// const T = {
//   bg:       "#faf6f0",
//   card:     "#ffffff",
//   border:   "#e8d5be",
//   brown:    "#5a3e2b",
//   brownMid: "#8b6343",
//   brownLt:  "#f5ece0",
//   accent:   "#c09a6e",
//   accentLight: "#e8d4b8",
//   text:     "#2d1f0f",
//   textLt:   "#a08060",
//   shadow:   "0 8px 24px rgba(90, 62, 43, 0.12)",
//   shadowLg: "0 16px 40px rgba(90, 62, 43, 0.18)",
// };

// // ── Type Filter Tabs ───────────────────────────────────────────
// const TYPE_TABS = [
//   { id: "all",   label: "All",    icon: Grid      },
//   { id: "image", label: "Photos", icon: Image     },
//   { id: "reel",  label: "Reels",  icon: Video     },
//   { id: "text",  label: "Posts",  icon: FileText  },
// ];

// // ── Enhanced Post Card with better interactivity ──────────────
// function PostCard({ post, onClick }) {
//   const [isHovered, setIsHovered] = useState(false);
//   const [imageLoaded, setImageLoaded] = useState(false);
  
//   const isReel  = post.type === "reel";
//   const isText  = post.type === "text";
//   const isMulti = post.media?.length > 1;
//   const thumb = resolvePostThumb(post);

//   // Engagement color — based on likes
//   const getEngagementColor = () => {
//     const likes = post.likesCount || 0;
//     if (likes > 10000) return "#ff6b6b";
//     if (likes > 5000) return "#ffa500";
//     if (likes > 1000) return "#4ecdc4";
//     return T.accent;
//   };

//   return (
//     <div
//       onClick={() => onClick(post)}
//       onMouseEnter={() => setIsHovered(true)}
//       onMouseLeave={() => setIsHovered(false)}
//       className="relative group rounded-xl overflow-hidden cursor-pointer transition-all duration-300 transform hover:scale-[1.02]"
//       style={{
//         background: T.card,
//         border: `1.5px solid ${T.border}`,
//         boxShadow: isHovered ? T.shadowLg : T.shadow,
//       }}
//     >
//       {/* ── Text Post Design ── */}
//       {isText ? (
//         <div 
//           className="p-5 min-h-48 flex flex-col justify-between relative overflow-hidden group"
//           style={{
//             background: `linear-gradient(135deg, ${T.accentLight} 0%, #fff 100%)`,
//           }}
//         >
//           {/* Decorative background element */}
//           <div className="absolute top-0 right-0 w-20 h-20 opacity-20"
//             style={{
//               background: `radial-gradient(circle, ${T.accent} 0%, transparent 70%)`,
//             }} />
          
//           <div className="relative z-10">
//             <p className="text-base font-semibold line-clamp-6 leading-relaxed" 
//               style={{ color: T.text }}>
//               {post.caption || "—"}
//             </p>
//           </div>

//           {post.hashtags?.length > 0 && (
//             <div className="flex flex-wrap gap-2 mt-3 relative z-10">
//               {post.hashtags.slice(0, 3).map((tag, i) => (
//                 <span 
//                   key={i} 
//                   className="text-xs font-bold px-3 py-1 rounded-full"
//                   style={{
//                     background: T.accent,
//                     color: "#fff",
//                   }}
//                 >
//                   #{tag}
//                 </span>
//               ))}
//             </div>
//           )}

//           {/* Hover indicator */}
//           {isHovered && (
//             <div className="absolute bottom-0 left-0 right-0 h-1 bg-linear-to-r" 
//               style={{
//                 backgroundImage: `linear-gradient(90deg, ${T.accent}, ${getEngagementColor()})`,
//               }} />
//           )}
//         </div>
//       ) : (
//         // ── Image/Reel Post Design ──
//         <div className="relative w-full" style={{ paddingBottom: "100%" }}>
//           {thumb ? (
//             <img
//               src={thumb}
//               alt={post.caption || "post"}
//               onLoad={() => setImageLoaded(true)}
//               className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${
//                 isHovered ? "scale-110 brightness-75" : "scale-100 brightness-100"
//               }`}
//               loading="lazy"
//               decoding="async"
//             />
//           ) : (
//             <div 
//               className="absolute inset-0 flex items-center justify-center"
//               style={{ background: `linear-gradient(135deg, ${T.brownLt}, ${T.accentLight})` }}
//             >
//               <Video size={40} style={{ color: T.textLt, opacity: 0.5 }} />
//             </div>
//           )}

//           {/* Dark overlay for better text contrast */}
//           {imageLoaded && isHovered && (
//             <div 
//               className="absolute inset-0 bg-black/40 transition-opacity duration-300"
//               style={{ background: "rgba(0, 0, 0, 0.45)" }}
//             />
//           )}

//           {/* Reel play button — enhanced */}
//           {isReel && (
//             <div className={`absolute top-3 right-3 transition-all duration-300 ${
//               isHovered ? "scale-110" : "scale-100"
//             }`}>
//               <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/90 backdrop-blur-sm shadow-lg">
//                 <Play size={18} fill={T.brown} color={T.brown} />
//               </div>
//             </div>
//           )}

//           {/* Multi-image indicator — enhanced */}
//           {isMulti && (
//             <div className={`absolute top-3 left-3 transition-all duration-300 ${
//               isHovered ? "scale-110" : "scale-100"
//             }`}>
//               <div className="flex gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 shadow-lg">
//                 {Array(Math.min(3, post.media?.length || 1)).fill(null).map((_, i) => (
//                   <div 
//                     key={i} 
//                     className={`rounded-full transition-all ${i === 0 ? 'w-2 h-2' : 'w-1.5 h-1.5'}`}
//                     style={{ background: T.brown }}
//                   />
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Engagement Stats — appears on hover */}
//           {isHovered && (
//             <div className="absolute inset-0 flex items-center justify-center gap-6 pointer-events-none">
//               {!post.likesHidden && (
//                 <div className="flex flex-col items-center gap-2 text-white transform transition-all duration-300 hover:scale-110">
//                   <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
//                     <Heart size={20} fill="white" />
//                     <span className="font-bold">{fmtCount(post.likesCount)}</span>
//                   </div>
//                 </div>
//               )}
//               {!post.commentsDisabled && (
//                 <div className="flex flex-col items-center gap-2 text-white transform transition-all duration-300 hover:scale-110">
//                   <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
//                     <MessageCircle size={20} fill="white" />
//                     <span className="font-bold">{fmtCount(post.commentsCount)}</span>
//                   </div>
//                 </div>
//               )}
//               <div className="flex flex-col items-center gap-2 text-white transform transition-all duration-300 hover:scale-110">
//                 <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
//                   <Eye size={20} />
//                   <span className="font-bold">{fmtCount(post.viewsCount)}</span>
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>
//       )}

//       {/* ── Author info — bottom overlay ── */}
//       <div className={`absolute bottom-0 left-0 right-0 px-4 py-3 bg-linear-to-t from-black/80 via-black/40 to-transparent transition-all duration-300 transform ${
//         isHovered ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
//       }`}>
//         <div className="flex items-center gap-2.5 justify-between">
//           <div className="flex items-center gap-2.5 min-w-0">
//             {post.author?.avatar?.url ? (
//               <img 
//                 src={post.author.avatar.url} 
//                 alt={post.author?.username}
//                 className="w-8 h-8 rounded-full object-cover ring-2 ring-white/30 shrink-0"
//               />
//             ) : (
//               <div 
//                 className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-white/30 shrink-0"
//                 style={{ background: T.accent }}
//               >
//                 {post.author?.fullName?.[0]?.toUpperCase()}
//               </div>
//             )}
//             <div className="min-w-0">
//               <p className="text-white text-xs font-bold truncate">
//                 @{post.author?.username}
//               </p>
//               {post.author?.fullName && (
//                 <p className="text-white/70 text-[10px] truncate">
//                   {post.author.fullName}
//                 </p>
//               )}
//             </div>
//           </div>
//           <ArrowRight size={16} className="text-white/70 shrink-0" />
//         </div>
//       </div>

//       {/* ── Engagement badge — top right corner ── */}
//       {post.likesCount > 1000 && !isText && (
//         <div className="absolute top-3 right-3 z-10">
//           <div 
//             className="flex items-center gap-1 px-3 py-1.5 rounded-full text-white text-xs font-bold backdrop-blur-sm ring-1 ring-white/30"
//             style={{ background: `${getEngagementColor()}dd` }}
//           >
//             <Sparkles size={12} />
//             Trending
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// // ── Number formatter ───────────────────────────────────────────
// function fmtCount(n = 0) {
//   if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
//   if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
//   return n;
// }

// // ── Enhanced Skeleton Card ─────────────────────────────────────
// function SkeletonCard() {
//   return (
//     <div className="rounded-xl overflow-hidden animate-pulse"
//       style={{ background: T.brownLt, paddingBottom: "100%" }}>
//       <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
//     </div>
//   );
// }

// // ── Masonry Grid ───────────────────────────────────────────────
// function MasonryGrid({ posts, onPostClick, loading }) {
//   const [numCols, setNumCols] = useState(
//     typeof window !== "undefined" ? (window.innerWidth < 768 ? 2 : 3) : 3
//   );

//   useEffect(() => {
//     const handleResize = () => {
//       setNumCols(window.innerWidth < 768 ? 2 : 3);
//     };
//     window.addEventListener("resize", handleResize);
//     return () => window.removeEventListener("resize", handleResize);
//   }, []);

//   const cols = Array.from({ length: numCols }, () => []);
//   posts.forEach((post, i) => cols[i % numCols].push(post));

//   return (
//     <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
//       {loading && posts.length === 0
//         ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
//         : cols.map((col, ci) => (
//             <div key={ci} className="flex flex-col gap-3 md:gap-4">
//               {col.map((post) => (
//                 <PostCard key={post._id} post={post} onClick={onPostClick} />
//               ))}
//             </div>
//           ))
//       }
//     </div>
//   );
// }

// // ── Main Explore Component ─────────────────────────────────────
// export default function Explore() {
//   const dispatch = useDispatch();
//   const {
//     posts, nextCursor, hasMore, activeType, loading, loadingMore, error, postsByType,
//   } = useSelector((s) => s.explore);


//   const [selectedPost, setSelectedPost] = useState(null);
  
//   const loaderRef = useRef(null);

//   // URL restoration
//   useEffect(() => {
//     const params = new URLSearchParams(window.location.search);
//     const postId = params.get("post");
//     if (!postId) return;
//     const found = posts.find((p) => p._id === postId);
//     if (found) setSelectedPost(found);
//   }, [posts]);

//   // Tab from URL
//   useEffect(() => {
//     const params = new URLSearchParams(window.location.search);
//     const tab = params.get("tab");
//     if (tab && tab !== activeType) dispatch(setActiveType(tab));
//   }, []);

//   // Load posts
//   useEffect(() => {
//     if (postsByType[activeType]?.length > 0) {
//       dispatch(setPostsFromCache(activeType));
//       return;
//     }
//     dispatch(fetchExplorePosts({ type: activeType }));
//   }, [activeType, dispatch]);

//   // Cleanup
//   useEffect(() => {
//     return () => dispatch(clearExplore());
//   }, []);

//   // Infinite scroll
//   const handleLoadMore = useCallback(() => {
//     if (isSearchMode) {
//       if (!searchLoadingMore && searchHasMore && searchCursor) {
//         dispatch(fetchMoreSearchPosts({ q: searchInput, cursor: searchCursor }));
//       }
//     } else {
//       if (!loadingMore && hasMore && nextCursor) {
//         dispatch(fetchMoreExplorePosts({ cursor: nextCursor, type: activeType }));
//       }
//     }
//   }, [
//     isSearchMode, searchLoadingMore, searchHasMore, searchCursor,
//     loadingMore, hasMore, nextCursor, activeType, searchInput, dispatch,
//   ]);

//   useEffect(() => {
//     const observer = new IntersectionObserver(
//       (entries) => { if (entries[0].isIntersecting) handleLoadMore(); },
//       { threshold: 0.1, rootMargin: "400px" }
//     );
//     if (loaderRef.current) observer.observe(loaderRef.current);
//     return () => observer.disconnect();
//   }, [handleLoadMore]);

//   // Tab change
//   const handleTabChange = (type) => {
//     if (type === activeType) return;
//     dispatch(setActiveType(type));
//     window.history.pushState({}, "", `?tab=${type}`);
//   };
// const displayPosts = posts;
// const isLoadingAny = loading;
// const isLoadingMoreAny = loadingMore;

//   return (
//     <div className="min-h-screen pt-14 md:pt-0" style={{ background: T.bg }}>
//       {/* Gradient accent line at top */}
//       <div 
//         className="h-0.5 bg-linear-to-r"
//         style={{
//           backgroundImage: `linear-gradient(90deg, ${T.accent}, ${T.accentLight}, ${T.accent})`,
//         }}
//       />

//       <div className="max-w-5xl mx-auto px-3 py-4 md:py-8">
        
       

//         {/* ── Type Filter Tabs ── */}
//         {!isSearchMode && (
//           <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
//             {TYPE_TABS.map(({ id, label, icon: Icon }) => {
//               const active = activeType === id;
//               return (
//                 <button 
//                   key={id} 
//                   onClick={() => handleTabChange(id)}
//                   className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all transform hover:scale-105 active:scale-95"
//                   style={{
//                     background: active 
//                       ? `linear-gradient(135deg, ${T.brown}, ${T.brownMid})`
//                       : T.card,
//                     color: active ? "#fff" : T.brownMid,
//                     border: `1.5px solid ${active ? T.brown : T.border}`,
//                     boxShadow: active ? `0 4px 12px ${T.brown}33` : "none",
//                   }}
//                 >
//                   <Icon size={14} />
//                   {label}
//                 </button>
//               );
//             })}
//           </div>
//         )}

      
//         {/* ── Error State ── */}
//         {error && (
//           <div 
//             className="text-center py-12 px-4 rounded-xl mb-4"
//             style={{ background: "#fff3cd", border: "1px solid #ffc107" }}
//           >
//             <p className="text-sm mb-3" style={{ color: T.brown }}>
//               ⚠️ Something went wrong
//             </p>
//             <p className="text-sm text-red-600 mb-4">{error}</p>
//             <button 
//               onClick={() => dispatch(fetchExplorePosts({ type: activeType }))}
//               className="text-sm font-semibold px-4 py-2 rounded-lg transition-all hover:scale-105"
//               style={{ background: T.brown, color: "#fff" }}
//             >
//               Try again
//             </button>
//           </div>
//         )}

//         {/* ── Empty State ── */}
//         {!isLoadingAny && !error && displayPosts.length === 0 && (
//           <div className="text-center py-24">
//             <p className="text-6xl mb-4 animate-bounce">🔍</p>
//             <p className="font-bold text-lg mb-2" style={{ color: T.brown }}>
//               {isSearchMode ? "No posts found" : "No posts yet"}
//             </p>
//             <p className="text-sm" style={{ color: T.textLt }}>
//               {isSearchMode 
//                 ? "Try a different search or explore other categories" 
//                 : "Check back soon or explore other tabs!"}
//             </p>
//           </div>
//         )}

//         {/* ── Masonry Grid ── */}
//         {!error && displayPosts.length > 0 && (
//           <MasonryGrid
//             posts={displayPosts}
//             onPostClick={(post) => {
//               setSelectedPost(post);
//               window.history.pushState(
//                 {},
//                 "",
//                 `?tab=${activeType}&post=${post._id}`
//               );
//             }}
//             loading={isLoadingAny}
//           />
//         )}

//         {/* ── Load More Skeletons ── */}
//         {isLoadingMoreAny && (
//           <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mt-6">
//             {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
//           </div>
//         )}

//         {/* ── Infinite Scroll Trigger ── */}
//         <div ref={loaderRef} className="h-10 mt-6" />

//         {/* ── End of Feed ── */}
//         {!isLoadingAny && !isLoadingMoreAny &&
//           ((isSearchMode && !searchHasMore) || (!isSearchMode && !hasMore)) &&
//           displayPosts.length > 0 && (
//           <div className="text-center py-8 mb-4">
//             <p className="text-sm font-medium" style={{ color: T.textLt }}>
//               ✨ You've reached the end ✨
//             </p>
//             <p className="text-xs mt-1" style={{ color: T.textLt }}>
//               Come back later for more amazing content!
//             </p>
//           </div>
//         )}
//       </div>

//       {/* ── Post Modal ── */}
//       {selectedPost && (
//         <PostModal
//           post={selectedPost}
//           onClose={() => {
//             setSelectedPost(null);
//             window.history.pushState({}, "", `?tab=${activeType}`);
//           }}
//         />
//       )}

//       {/* ── CSS for shimmer animation ── */}
//       <style>{`
//         @keyframes shimmer {
//           0% { transform: translateX(-100%); }
//           100% { transform: translateX(100%); }
//         }
//         .animate-shimmer {
//           animation: shimmer 2s infinite;
//         }
//       `}</style>
//     </div>
//   );
// }




import { useEffect, useRef, useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import PostModal from "../components/PostModal";
import { resolvePostThumb } from "../utils/mediaUtils";
import { 
  Image, Video, FileText, Grid, Heart, MessageCircle, Eye, 
  Play, Sparkles, ArrowRight 
} from "lucide-react";
import {
  fetchExplorePosts,
  fetchMoreExplorePosts,
  setActiveType,
  clearExplore,
  setPostsFromCache,
} from "../lib/redux/exploreSlice";

// ── Theme ─────────────────────────────────────────────────────
const T = {
  bg:          "#faf6f0",
  card:        "#ffffff",
  border:      "#e8d5be",
  brown:       "#5a3e2b",
  brownMid:    "#8b6343",
  brownLt:     "#f5ece0",
  accent:      "#c09a6e",
  accentLight: "#e8d4b8",
  text:        "#2d1f0f",
  textLt:      "#a08060",
  shadow:      "0 8px 24px rgba(90, 62, 43, 0.12)",
  shadowLg:    "0 16px 40px rgba(90, 62, 43, 0.18)",
};

// ── Type Filter Tabs ──────────────────────────────────────────
const TYPE_TABS = [
  { id: "all",   label: "All",    icon: Grid     },
  { id: "image", label: "Photos", icon: Image    },
  { id: "reel",  label: "Reels",  icon: Video    },
  { id: "text",  label: "Posts",  icon: FileText },
];

// ── Post Card ─────────────────────────────────────────────────
function PostCard({ post, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const isReel  = post.type === "reel";
  const isText  = post.type === "text";
  const isMulti = post.media?.length > 1;
  const thumb   = resolvePostThumb(post);

  const getEngagementColor = () => {
    const likes = post.likesCount || 0;
    if (likes > 10000) return "#ff6b6b";
    if (likes > 5000)  return "#ffa500";
    if (likes > 1000)  return "#4ecdc4";
    return T.accent;
  };

  return (
    <div
      onClick={() => onClick(post)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group rounded-xl overflow-hidden cursor-pointer transition-all duration-300 transform hover:scale-[1.02]"
      style={{
        background:  T.card,
        border:      `1.5px solid ${T.border}`,
        boxShadow:   isHovered ? T.shadowLg : T.shadow,
      }}
    >
      {isText ? (
        <div
          className="p-5 min-h-48 flex flex-col justify-between relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${T.accentLight} 0%, #fff 100%)` }}
        >
          <div className="absolute top-0 right-0 w-20 h-20 opacity-20"
            style={{ background: `radial-gradient(circle, ${T.accent} 0%, transparent 70%)` }} />

          <div className="relative z-10">
            <p className="text-base font-semibold line-clamp-6 leading-relaxed" style={{ color: T.text }}>
              {post.caption || "—"}
            </p>
          </div>

          {post.hashtags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 relative z-10">
              {post.hashtags.slice(0, 3).map((tag, i) => (
                <span key={i} className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: T.accent, color: "#fff" }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {isHovered && (
            <div className="absolute bottom-0 left-0 right-0 h-1"
              style={{ backgroundImage: `linear-gradient(90deg, ${T.accent}, ${getEngagementColor()})` }} />
          )}
        </div>
      ) : (
        <div className="relative w-full" style={{ paddingBottom: "100%" }}>
          {thumb ? (
            <img
              src={thumb}
              alt={post.caption || "post"}
              onLoad={() => setImageLoaded(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${
                isHovered ? "scale-110 brightness-75" : "scale-100 brightness-100"
              }`}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${T.brownLt}, ${T.accentLight})` }}>
              <Video size={40} style={{ color: T.textLt, opacity: 0.5 }} />
            </div>
          )}

          {imageLoaded && isHovered && (
            <div className="absolute inset-0 transition-opacity duration-300"
              style={{ background: "rgba(0,0,0,0.45)" }} />
          )}

          {isReel && (
            <div className={`absolute top-3 right-3 transition-all duration-300 ${isHovered ? "scale-110" : "scale-100"}`}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/90 backdrop-blur-sm shadow-lg">
                <Play size={18} fill={T.brown} color={T.brown} />
              </div>
            </div>
          )}

          {isMulti && (
            <div className={`absolute top-3 left-3 transition-all duration-300 ${isHovered ? "scale-110" : "scale-100"}`}>
              <div className="flex gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 shadow-lg">
                {Array(Math.min(3, post.media?.length || 1)).fill(null).map((_, i) => (
                  <div key={i}
                    className={`rounded-full transition-all ${i === 0 ? "w-2 h-2" : "w-1.5 h-1.5"}`}
                    style={{ background: T.brown }} />
                ))}
              </div>
            </div>
          )}

          {isHovered && (
            <div className="absolute inset-0 flex items-center justify-center gap-6 pointer-events-none">
              {!post.likesHidden && (
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 text-white">
                  <Heart size={20} fill="white" />
                  <span className="font-bold">{fmtCount(post.likesCount)}</span>
                </div>
              )}
              {!post.commentsDisabled && (
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 text-white">
                  <MessageCircle size={20} fill="white" />
                  <span className="font-bold">{fmtCount(post.commentsCount)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 text-white">
                <Eye size={20} />
                <span className="font-bold">{fmtCount(post.viewsCount)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Author overlay */}
      <div className={`absolute bottom-0 left-0 right-0 px-4 py-3 transition-all duration-300 transform ${
        isHovered ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
      }`} style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.4), transparent)" }}>
        <div className="flex items-center gap-2.5 justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {post.author?.avatar?.url ? (
              <img src={post.author.avatar.url} alt={post.author?.username}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-white/30 shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-white/30 shrink-0"
                style={{ background: T.accent }}>
                {post.author?.fullName?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-white text-xs font-bold truncate">@{post.author?.username}</p>
              {post.author?.fullName && (
                <p className="text-white/70 text-[10px] truncate">{post.author.fullName}</p>
              )}
            </div>
          </div>
          <ArrowRight size={16} className="text-white/70 shrink-0" />
        </div>
      </div>

      {/* Trending badge */}
      {post.likesCount > 1000 && !isText && (
        <div className="absolute top-3 right-3 z-10">
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full text-white text-xs font-bold backdrop-blur-sm ring-1 ring-white/30"
            style={{ background: `${getEngagementColor()}dd` }}>
            <Sparkles size={12} />
            Trending
          </div>
        </div>
      )}
    </div>
  );
}

// ── Number formatter ──────────────────────────────────────────
function fmtCount(n = 0) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n;
}

// ── Skeleton Card ─────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden animate-pulse relative"
      style={{ background: T.brownLt, paddingBottom: "100%" }}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
    </div>
  );
}

// ── Masonry Grid ──────────────────────────────────────────────
function MasonryGrid({ posts, onPostClick, loading }) {
  const [numCols, setNumCols] = useState(
    typeof window !== "undefined" ? (window.innerWidth < 768 ? 2 : 3) : 3
  );

  useEffect(() => {
    const handleResize = () => setNumCols(window.innerWidth < 768 ? 2 : 3);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const cols = Array.from({ length: numCols }, () => []);
  posts.forEach((post, i) => cols[i % numCols].push(post));

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
      {loading && posts.length === 0
        ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
        : cols.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-3 md:gap-4">
              {col.map((post) => (
                <PostCard key={post._id} post={post} onClick={onPostClick} />
              ))}
            </div>
          ))
      }
    </div>
  );
}

// ── Main Explore Component ────────────────────────────────────
export default function Explore() {
  const dispatch = useDispatch();
  const {
    posts, nextCursor, hasMore, activeType, loading, loadingMore, error, postsByType,
  } = useSelector((s) => s.explore);

  const [selectedPost, setSelectedPost] = useState(null);
  const loaderRef = useRef(null);

  // URL se post restore karo
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get("post");
    if (!postId) return;
    const found = posts.find((p) => p._id === postId);
    if (found) setSelectedPost(found);
  }, [posts]);

  // Tab from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && tab !== activeType) dispatch(setActiveType(tab));
  }, []);

  // Posts load karo
  useEffect(() => {
    if (postsByType[activeType]?.length > 0) {
      dispatch(setPostsFromCache(activeType));
      return;
    }
    dispatch(fetchExplorePosts({ type: activeType }));
  }, [activeType, dispatch]);

  // Cleanup
  useEffect(() => {
    return () => dispatch(clearExplore());
  }, []);

  // Infinite scroll
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && nextCursor) {
      dispatch(fetchMoreExplorePosts({ cursor: nextCursor, type: activeType }));
    }
  }, [loadingMore, hasMore, nextCursor, activeType, dispatch]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) handleLoadMore(); },
      { threshold: 0.1, rootMargin: "400px" }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  // Tab change
  const handleTabChange = (type) => {
    if (type === activeType) return;
    dispatch(setActiveType(type));
    window.history.pushState({}, "", `?tab=${type}`);
  };

  return (
    <div className="min-h-screen pt-14 md:pt-0" style={{ background: T.bg }}>
      {/* Top accent line */}
      <div className="h-0.5"
        style={{ backgroundImage: `linear-gradient(90deg, ${T.accent}, ${T.accentLight}, ${T.accent})` }} />

      <div className="max-w-5xl mx-auto px-3 py-4 md:py-8">

        {/* Type Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {TYPE_TABS.map(({ id, label, icon: Icon }) => {
            const active = activeType === id;
            return (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all transform hover:scale-105 active:scale-95"
                style={{
                  background:  active ? `linear-gradient(135deg, ${T.brown}, ${T.brownMid})` : T.card,
                  color:       active ? "#fff" : T.brownMid,
                  border:      `1.5px solid ${active ? T.brown : T.border}`,
                  boxShadow:   active ? `0 4px 12px ${T.brown}33` : "none",
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="text-center py-12 px-4 rounded-xl mb-4"
            style={{ background: "#fff3cd", border: "1px solid #ffc107" }}>
            <p className="text-sm mb-3" style={{ color: T.brown }}>⚠️ Something went wrong</p>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={() => dispatch(fetchExplorePosts({ type: activeType }))}
              className="text-sm font-semibold px-4 py-2 rounded-lg transition-all hover:scale-105"
              style={{ background: T.brown, color: "#fff" }}
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && posts.length === 0 && (
          <div className="text-center py-24">
            <p className="text-6xl mb-4 animate-bounce">📭</p>
            <p className="font-bold text-lg mb-2" style={{ color: T.brown }}>No posts yet</p>
            <p className="text-sm" style={{ color: T.textLt }}>Check back soon or explore other tabs!</p>
          </div>
        )}

        {/* Masonry Grid */}
        {!error && posts.length > 0 && (
          <MasonryGrid
            posts={posts}
            onPostClick={(post) => {
              setSelectedPost(post);
              window.history.pushState({}, "", `?tab=${activeType}&post=${post._id}`);
            }}
            loading={loading}
          />
        )}

        {/* Load more skeletons */}
        {loadingMore && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mt-6">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Infinite scroll trigger */}
        <div ref={loaderRef} className="h-10 mt-6" />

        {/* End of feed */}
        {!loading && !loadingMore && !hasMore && posts.length > 0 && (
          <div className="text-center py-8 mb-4">
            <p className="text-sm font-medium" style={{ color: T.textLt }}>✨ You've reached the end ✨</p>
            <p className="text-xs mt-1" style={{ color: T.textLt }}>Come back later for more amazing content!</p>
          </div>
        )}
      </div>

      {/* Post Modal */}
      {selectedPost && (
        <PostModal
          post={selectedPost}
          onClose={() => {
            setSelectedPost(null);
            window.history.pushState({}, "", `?tab=${activeType}`);
          }}
        />
      )}

      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer { animation: shimmer 2s infinite; }
      `}</style>
    </div>
  );
}