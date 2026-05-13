import { useEffect, useRef, useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import PostModal from "../components/PostModal";
import { Search, X, Image, Video, FileText, Grid, Heart, MessageCircle, Eye, Play } from "lucide-react";
import {
  fetchExplorePosts,
  fetchMoreExplorePosts,
  searchExplorePosts,
  fetchMoreSearchPosts,
  setActiveType,
  setSearchMode,
  clearExplore,
} from "../lib/redux/exploreSlice";

// ── Theme ──────────────────────────────────────────────────────
const T = {
  bg:       "#faf6f0",
  card:     "#ffffff",
  border:   "#e8d5be",
  brown:    "#5a3e2b",
  brownMid: "#8b6343",
  brownLt:  "#f5ece0",
  accent:   "#c09a6e",
  text:     "#2d1f0f",
  textLt:   "#a08060",
};

// ── Type Filter Tabs ───────────────────────────────────────────
const TYPE_TABS = [
  { id: "all",   label: "All",    icon: Grid      },
  { id: "image", label: "Photos", icon: Image     },
  { id: "reel",  label: "Reels",  icon: Video     },
  { id: "text",  label: "Posts",  icon: FileText  },
];

// ── Post Card ──────────────────────────────────────────────────
function PostCard({ post, onClick }) {
  const isReel  = post.type === "reel";
  const isText  = post.type === "text";
  const isMulti = post.media?.length > 1;

  // Thumbnail URL
  const thumb = post.media?.[0]?.thumbnailUrl || post.media?.[0]?.url || null;

  return (
    <div
      onClick={() => onClick(post)}
      className="relative group rounded-2xl overflow-hidden cursor-pointer"
      style={{ background: T.card, border: `1px solid ${T.border}` }}
    >
      {/* ── Media / Text content ── */}
      {isText ? (
        // Text post — caption show karo
        <div className="p-4 min-h-[120px] flex flex-col justify-between"
          style={{ background: `linear-gradient(135deg, ${T.brownLt}, #fff)` }}>
          <p className="text-sm font-medium line-clamp-5" style={{ color: T.text }}>
            {post.caption || "—"}
          </p>
          {post.hashtags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {post.hashtags.slice(0, 3).map((tag, i) => (
                <span key={i} className="text-xs font-semibold" style={{ color: T.accent }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Image / Reel
        <div className="relative w-full" style={{ paddingBottom: "100%" }}>
          {thumb ? (
            <img
              src={thumb}
              alt={post.caption || "post"}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: T.brownLt }}>
              <Video size={32} style={{ color: T.textLt }} />
            </div>
          )}

          {/* Reel play icon */}
          {isReel && (
            <div className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center bg-black/50">
              <Play size={14} fill="white" color="white" />
            </div>
          )}

          {/* Carousel icon */}
          {isMulti && (
            <div className="absolute top-2 right-2">
              <div className="flex gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Hover overlay with stats ── */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-4 rounded-2xl">
        {!post.likesHidden && (
          <div className="flex items-center gap-1.5 text-white">
            <Heart size={18} fill="white" />
            <span className="text-sm font-bold">{fmtCount(post.likesCount)}</span>
          </div>
        )}
        {!post.commentsDisabled && (
          <div className="flex items-center gap-1.5 text-white">
            <MessageCircle size={18} fill="white" />
            <span className="text-sm font-bold">{fmtCount(post.commentsCount)}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-white">
          <Eye size={18} />
          <span className="text-sm font-bold">{fmtCount(post.viewsCount)}</span>
        </div>
      </div>

      {/* ── Author chip ── */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/50 rounded-full px-2 py-1
        opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {post.author?.avatar?.url ? (
          <img src={post.author.avatar.url} alt=""
            className="w-5 h-5 rounded-full object-cover" />
        ) : (
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: T.accent }}>
            {post.author?.fullName?.[0]?.toUpperCase()}
          </div>
        )}
        <span className="text-white text-xs font-semibold">@{post.author?.username}</span>
      </div>
    </div>
  );
}

// ── Number formatter ───────────────────────────────────────────
function fmtCount(n = 0) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n;
}

// ── Skeleton Card ──────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse"
      style={{ background: T.brownLt, paddingBottom: "100%" }} />
  );
}

// ── Masonry Grid ───────────────────────────────────────────────
function MasonryGrid({ posts, onPostClick, loading }) {
  // 3 column masonry — posts ko 3 columns mein distribute karo
  const cols = [[], [], []];
  posts.forEach((post, i) => cols[i % 3].push(post));

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
      {loading && posts.length === 0
        ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
        : cols.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-2 md:gap-3">
              {col.map((post) => (
                <PostCard key={post._id} post={post} onClick={onPostClick} />
              ))}
            </div>
          ))
      }
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function Explore() {
  const dispatch = useDispatch();
  const {
    posts, nextCursor, hasMore, activeType, loading, loadingMore,
    searchPosts, searchCursor, searchHasMore, isSearchMode,
    searchLoading, searchLoadingMore, error,
  } = useSelector((s) => s.explore);

  const [searchInput, setSearchInput] = useState("");
  const [selectedPost, setSelectedPost] = useState(null); // future modal
  const searchTimer = useRef(null);
  const loaderRef   = useRef(null);

  // ── Initial fetch ──
  useEffect(() => {
    dispatch(clearExplore());
    dispatch(fetchExplorePosts({ type: activeType }));
  }, [activeType, dispatch]);

  // ── Cleanup on unmount ──
  useEffect(() => () => dispatch(clearExplore()), [dispatch]);

  // ── Infinite scroll — IntersectionObserver ──
  const handleLoadMore = useCallback(() => {
    if (isSearchMode) {
      if (!searchLoadingMore && searchHasMore && searchCursor) {
        dispatch(fetchMoreSearchPosts({ q: searchInput, cursor: searchCursor }));
      }
    } else {
      if (!loadingMore && hasMore && nextCursor) {
        dispatch(fetchMoreExplorePosts({ cursor: nextCursor, type: activeType }));
      }
    }
  }, [
    isSearchMode, searchLoadingMore, searchHasMore, searchCursor,
    loadingMore, hasMore, nextCursor, activeType, searchInput, dispatch,
  ]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) handleLoadMore(); },
      { threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  // ── Search — debounce 500ms ──
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    if (!val.trim()) {
      dispatch(setSearchMode(false));
      return;
    }
    searchTimer.current = setTimeout(() => {
      dispatch(searchExplorePosts({ q: val.trim() }));
    }, 500);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    dispatch(setSearchMode(false));
  };

  // ── Tab change ──
  const handleTabChange = (type) => {
    if (type === activeType) return;
    dispatch(setActiveType(type));
  };

  const displayPosts = isSearchMode ? searchPosts : posts;
  const isLoadingAny = loading || searchLoading;
  const isLoadingMoreAny = loadingMore || searchLoadingMore;

  return (
    <div className="min-h-screen pt-14 md:pt-0" style={{ background: T.bg }}>
      <div className="max-w-5xl mx-auto px-3 py-4 md:py-8">

        {/* ── Search Bar ── */}
        <div className="mb-4 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: T.textLt }} />
          <input
            type="text"
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Search posts, hashtags..."
            className="w-full pl-10 pr-10 py-3 rounded-2xl text-sm outline-none transition-all"
            style={{
              background: T.card,
              border: `1.5px solid ${T.border}`,
              color: T.text,
            }}
            onFocus={(e) => (e.target.style.borderColor = T.accent)}
            onBlur={(e)  => (e.target.style.borderColor = T.border)}
          />
          {searchInput && (
            <button onClick={handleClearSearch}
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              style={{ color: T.textLt }}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* ── Type Filter Tabs — sirf explore mode mein ── */}
        {!isSearchMode && (
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
            {TYPE_TABS.map(({ id, label, icon: Icon }) => {
              const active = activeType === id;
              return (
                <button key={id} onClick={() => handleTabChange(id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all"
                  style={{
                    background: active ? T.brown : T.card,
                    color:      active ? "#fff"  : T.brownMid,
                    border:     `1.5px solid ${active ? T.brown : T.border}`,
                  }}>
                  <Icon size={13} />
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Search mode header ── */}
        {isSearchMode && (
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: T.brownMid }}>
              Results for <span style={{ color: T.brown }}>"{searchInput}"</span>
              <span className="ml-2 font-normal" style={{ color: T.textLt }}>
                ({searchPosts.length} posts)
              </span>
            </p>
            <button onClick={handleClearSearch}
              className="text-xs font-semibold" style={{ color: T.accent }}>
              Clear
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="text-center py-8">
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={() => dispatch(fetchExplorePosts({ type: activeType }))}
              className="mt-3 text-sm font-semibold underline" style={{ color: T.brown }}>
              Try again
            </button>
          </div>
        )}

        {/* ── Empty state ── */}
        {!isLoadingAny && !error && displayPosts.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold" style={{ color: T.brown }}>
              {isSearchMode ? "No posts found" : "No posts yet"}
            </p>
            <p className="text-sm mt-1" style={{ color: T.textLt }}>
              {isSearchMode ? "Try a different search" : "Check back later!"}
            </p>
          </div>
        )}

        {/* ── Masonry Grid ── */}
        {!error && (
          <MasonryGrid
            posts={displayPosts}
            onPostClick={setSelectedPost}
            loading={isLoadingAny}
          />
        )}

        {/* ── Load more skeletons ── */}
        {isLoadingMoreAny && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 mt-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Infinite scroll trigger ── */}
        <div ref={loaderRef} className="h-10 mt-4" />

        {/* ── End of feed ── */}
        {!isLoadingAny && !isLoadingMoreAny &&
          ((isSearchMode && !searchHasMore) || (!isSearchMode && !hasMore)) &&
          displayPosts.length > 0 && (
          <p className="text-center text-xs py-6" style={{ color: T.textLt }}>
            You've seen it all ✨
          </p>
        )}
      </div>

       {selectedPost && (
        <PostModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
        />
      )}
    </div>
  );
}