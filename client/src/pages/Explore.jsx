
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

const TYPE_TABS = [
  { id: "all",   label: "All",    icon: Grid     },
  { id: "image", label: "Photos", icon: Image    },
  { id: "reel",  label: "Reels",  icon: Video    },
  { id: "text",  label: "Posts",  icon: FileText },
];

const isMobile = () => typeof window !== "undefined" && window.innerWidth < 768;

function PostCard({ post, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [mobile, setMobile] = useState(isMobile());

  useEffect(() => {
    const handleResize = () => setMobile(isMobile());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  const showOverlay = mobile || isHovered;

  return (
    <div
      onClick={() => onClick(post)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group rounded-xl overflow-hidden cursor-pointer transition-all duration-300 transform hover:scale-[1.02]"
      style={{
        background: T.card,
        border:     `1.5px solid ${T.border}`,
        boxShadow:  isHovered ? T.shadowLg : T.shadow,
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

          {/* Stats — mobile pe hamesha bottom strip mein, desktop pe hover overlay */}
          {mobile ? (
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 flex items-center gap-2 z-10"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }}>
              {!post.likesHidden && (
                <div className="flex items-center gap-1 text-white">
                  <Heart size={11} fill="white" />
                  <span className="text-xs font-semibold">{fmtCount(post.likesCount)}</span>
                </div>
              )}
              {!post.commentsDisabled && (
                <div className="flex items-center gap-1 text-white">
                  <MessageCircle size={11} fill="white" />
                  <span className="text-xs font-semibold">{fmtCount(post.commentsCount)}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-white ml-auto">
                <Eye size={11} />
                <span className="text-xs font-semibold">{fmtCount(post.viewsCount)}</span>
              </div>
            </div>
          ) : (
            isHovered && (
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
            )
          )}
        </div>
      )}

      {/* Author overlay — desktop only hover */}
      {!mobile && (
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
      )}

      {/* Trending badge — desktop only */}
      {!mobile && post.likesCount > 1000 && !isText && (
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

function fmtCount(n = 0) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden animate-pulse relative"
      style={{ background: T.brownLt, paddingBottom: "100%" }}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
    </div>
  );
}

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

export default function Explore() {
  const dispatch = useDispatch();
  const {
    posts, nextCursor, hasMore, activeType, loading, loadingMore, error, postsByType,
  } = useSelector((s) => s.explore);

  const [selectedPost, setSelectedPost] = useState(null);
  const loaderRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get("post");
    if (!postId) return;
    const found = posts.find((p) => p._id === postId);
    if (found) setSelectedPost(found);
  }, [posts]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && tab !== activeType) dispatch(setActiveType(tab));
  }, []);

  useEffect(() => {
    if (postsByType[activeType]?.length > 0) {
      dispatch(setPostsFromCache(activeType));
      return;
    }
    dispatch(fetchExplorePosts({ type: activeType }));
  }, [activeType, dispatch]);

  useEffect(() => {
    return () => dispatch(clearExplore());
  }, []);

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

  const handleTabChange = (type) => {
    if (type === activeType) return;
    dispatch(setActiveType(type));
    window.history.pushState({}, "", `?tab=${type}`);
  };

  return (
    <div className="min-h-screen pt-14 md:pt-0" style={{ background: T.bg }}>
      <div className="max-w-5xl mx-auto px-3 py-4 md:py-8">

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {TYPE_TABS.map(({ id, label, icon: Icon }) => {
            const active = activeType === id;
            return (
              <button key={id} onClick={() => handleTabChange(id)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all transform hover:scale-105 active:scale-95"
                style={{
                  background: active ? `linear-gradient(135deg, ${T.brown}, ${T.brownMid})` : T.card,
                  color:      active ? "#fff" : T.brownMid,
                  border:     `1.5px solid ${active ? T.brown : T.border}`,
                  boxShadow:  active ? `0 4px 12px ${T.brown}33` : "none",
                }}>
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="text-center py-12 px-4 rounded-xl mb-4"
            style={{ background: "#fff3cd", border: "1px solid #ffc107" }}>
            <p className="text-sm mb-3" style={{ color: T.brown }}>⚠️ Something went wrong</p>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button onClick={() => dispatch(fetchExplorePosts({ type: activeType }))}
              className="text-sm font-semibold px-4 py-2 rounded-lg"
              style={{ background: T.brown, color: "#fff" }}>
              Try again
            </button>
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div className="text-center py-24">
            <p className="text-6xl mb-4 animate-bounce">📭</p>
            <p className="font-bold text-lg mb-2" style={{ color: T.brown }}>No posts yet</p>
            <p className="text-sm" style={{ color: T.textLt }}>Check back soon or explore other tabs!</p>
          </div>
        )}

        {!error && (
          <MasonryGrid
            posts={posts}
            onPostClick={(post) => {
              setSelectedPost(post);
              window.history.pushState({}, "", `?tab=${activeType}&post=${post._id}`);
            }}
            loading={loading}
          />
        )}

        {loadingMore && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mt-6">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        <div ref={loaderRef} className="h-10 mt-6" />

        {!loading && !loadingMore && !hasMore && posts.length > 0 && (
          <div className="text-center py-8 mb-4">
            <p className="text-sm font-medium" style={{ color: T.textLt }}>✨ You've reached the end ✨</p>
            <p className="text-xs mt-1" style={{ color: T.textLt }}>Come back later for more amazing content!</p>
          </div>
        )}
      </div>

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
