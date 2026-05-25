

import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Image, Film, FileText, LayoutGrid, Heart, MessageCircle,
  Eye, Trash2, Play, Copy, Search, X, ChevronLeft, ChevronRight,
  TrendingUp, SlidersHorizontal, RotateCcw, Loader2,
} from "lucide-react";
import {
  fetchAllPosts, adminDeletePost, setPostFilters, setPostPage,
  resetPostFilters, clearPostErrors, openPostModal, closePostModal,
  selectAdminPosts, selectAdminPostsLoading, selectAdminPostsError,
  selectDeleteLoading, selectPostsPagination, selectPostsFilters,
  selectSelectedPost,
} from "../lib/redux/postsSlice";
import { PostsGridSkeleton } from "../components/skeletons";
import PostDetailModal from "../components/PostDetailmodal";

// ── Helpers ───────────────────────────────────────────────────
function fmtCount(n = 0) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function useDebounce(value, delay = 400) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}
function resolveThumb(post) {
  const media = post?.media?.[0];
  if (!media?.url) return null;
  const isVid =
    post.type === "reel" ||
    media.resourceType === "video" ||
    /\.(mp4|mov|webm|avi)$/i.test(media.url);
  if (!isVid) return media.url;
  return (
    media.thumbnailUrl ||
    media.url
      .replace("/upload/", "/upload/so_0,w_600,h_600,c_fill,f_jpg,q_auto/")
      .replace(/\.(mp4|mov|webm|avi)$/i, ".jpg")
  );
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, accent, loading }) {
  return (
    <div className={`rounded-2xl border ${accent.cardBg} px-4 py-4 sm:px-6 sm:py-5 
      flex items-center gap-3 sm:gap-5 shadow-sm
      hover:shadow-md transition-all duration-300 hover:-translate-y-0.5`}>
      <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 ${accent.icon}`}>
        <Icon size={20} className="sm:hidden" />
        <Icon size={28} className="hidden sm:block" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-800 leading-none tracking-tight">
          {loading ? "—" : fmtCount(value)}
        </p>
        <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

// ── Post Tile ─────────────────────────────────────────────────
function PostTile({ post, onDelete, deleteLoading, onOpen }) {
  const [hovered,    setHovered]    = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const isText  = post.type === "text";
  const isVid   = post.type === "reel" || post.media?.[0]?.resourceType === "video";
  const isMulti = post.media?.length > 1;
  const thumb   = resolveThumb(post);
  const busy    = deleteLoading === post._id;

  return (
    <div
      className="relative cursor-pointer group select-none"
      onClick={() => onOpen(post)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDel(false); }}
    >
      <div className="aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-slate-100 relative shadow-sm
        ring-1 ring-slate-200/60 group-hover:ring-violet-300 transition-all duration-200
        group-hover:shadow-lg group-hover:-translate-y-0.5">

        {/* Content */}
        {isText ? (
          <div className="w-full h-full flex flex-col p-2.5 sm:p-4 gap-1.5 sm:gap-2"
            style={{ background: "linear-gradient(135deg,#fdf6ec,#fef9f3)" }}>
            <div className="flex items-center gap-1">
              <FileText size={11} className="text-amber-500 shrink-0 sm:hidden" />
              <FileText size={14} className="text-amber-500 shrink-0 hidden sm:block" />
              <span className="text-[8px] sm:text-[9px] font-bold text-amber-600 uppercase tracking-wider">
                Text Post
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-600 leading-relaxed line-clamp-4 sm:line-clamp-5 flex-1">
              {post.caption || "—"}
            </p>
            {post.hashtags?.length > 0 && (
              <p className="text-[8px] sm:text-[9px] text-amber-500 font-semibold truncate">
                #{post.hashtags.slice(0, 2).join(" #")}
              </p>
            )}
          </div>
        ) : thumb ? (
          <img
            src={thumb} alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-200">
            <Image size={24} className="text-slate-300 sm:hidden" />
            <Image size={28} className="text-slate-300 hidden sm:block" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex flex-col gap-1 z-10">
          {isVid && (
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-black/60 backdrop-blur-sm rounded-full
              flex items-center justify-center">
              <Play size={8} className="text-white fill-white ml-0.5 sm:hidden" />
              <Play size={10} className="text-white fill-white ml-0.5 hidden sm:block" />
            </div>
          )}
          {isMulti && (
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-black/60 backdrop-blur-sm rounded-full
              flex items-center justify-center">
              <Copy size={8} className="text-white sm:hidden" />
              <Copy size={10} className="text-white hidden sm:block" />
            </div>
          )}  
        </div>

        {/* Hover Overlay */}
        <div className={`absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-black/20
          flex flex-col justify-between p-2 sm:p-3 transition-opacity duration-200
          ${hovered ? "opacity-100" : "opacity-0"}`}>

          {/* Author top */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <span className="text-[7px] sm:text-[8px] text-white font-bold">
                {post.author?.username?.[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
            <p className="text-white/80 text-[9px] sm:text-[10px] font-medium truncate">
              @{post.author?.username ?? "—"}
            </p>
          </div>

          {/* Stats middle */}
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <div className="flex items-center gap-0.5 sm:gap-1 text-white">
              <Heart size={11} className="fill-white sm:hidden" />
              <Heart size={13} className="fill-white hidden sm:block" />
              <span className="text-[10px] sm:text-xs font-bold">{fmtCount(post.likesCount)}</span>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 text-white">
              <MessageCircle size={11} className="fill-white sm:hidden" />
              <MessageCircle size={13} className="fill-white hidden sm:block" />
              <span className="text-[10px] sm:text-xs font-bold">{fmtCount(post.commentsCount)}</span>
            </div>
            {post.viewsCount > 0 && (
              <div className="flex items-center gap-0.5 sm:gap-1 text-white">
                <Eye size={11} className="sm:hidden" />
                <Eye size={13} className="hidden sm:block" />
                <span className="text-[10px] sm:text-xs font-bold">{fmtCount(post.viewsCount)}</span>
              </div>
            )}
          </div>

          {/* Delete bottom */}
          <div onClick={(e) => e.stopPropagation()}>
            {!confirmDel ? (
              <button
                onClick={() => setConfirmDel(true)}
                className="w-full flex items-center justify-center gap-1
                  bg-red-500/90 hover:bg-red-500 text-white text-[10px] sm:text-[11px] font-bold
                  py-1 sm:py-1.5 rounded-lg sm:rounded-xl transition-colors"
              >
                <Trash2 size={9} className="sm:hidden" />
                <Trash2 size={11} className="hidden sm:block" />
                Delete
              </button>
            ) : (
              <div className="flex gap-1 sm:gap-1.5">
                <button onClick={() => setConfirmDel(false)}
                  className="flex-1 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white/20 hover:bg-white/30
                    text-white text-[10px] sm:text-[11px] font-semibold transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => { onDelete(post._id); setConfirmDel(false); }}
                  disabled={busy}
                  className="flex-1 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-red-500 hover:bg-red-400
                    text-white text-[10px] sm:text-[11px] font-bold transition-colors
                    disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {busy ? <Loader2 size={10} className="animate-spin" /> : "Confirm"}
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Below tile — author + date */}
      <div className="mt-1 sm:mt-1.5 px-0.5 flex items-center justify-between gap-1">
        <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium truncate max-w-[65%]">
          @{post.author?.username ?? "—"}
        </p>
        <p className="text-[9px] sm:text-[10px] text-slate-400 shrink-0">{formatDate(post.createdAt)}</p>
      </div>
    </div>
  );
}

function SkeletonTile() {
  return (
    <div>
      <div className="aspect-square rounded-xl sm:rounded-2xl bg-slate-200 animate-pulse" />
      <div className="mt-1 sm:mt-1.5 h-2 sm:h-2.5 bg-slate-200 animate-pulse rounded-full w-3/4" />
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function PostsPage() {
  const dispatch = useDispatch();

  const posts         = useSelector(selectAdminPosts);
  const loading       = useSelector(selectAdminPostsLoading);
  const error         = useSelector(selectAdminPostsError);
  const deleteLoading = useSelector(selectDeleteLoading);
  const pagination    = useSelector(selectPostsPagination);
  const filters       = useSelector(selectPostsFilters);
  const selectedPost  = useSelector(selectSelectedPost);

  const [searchInput,   setSearchInput]   = useState(filters.search);
  const [filterOpen,    setFilterOpen]    = useState(false);
  const [toast,         setToast]         = useState(null);

  const debouncedSearch = useDebounce(searchInput, 450);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    dispatch(fetchAllPosts({
      type:      filters.type      || undefined,
      search:    filters.search    || undefined,
      sortBy:    filters.sortBy,
      sortOrder: filters.sortOrder,
      page:      filters.page,
      limit:     filters.limit,
    }));
  }, [dispatch, filters]);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      dispatch(setPostFilters({ search: debouncedSearch, page: 1 }));
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (error) { showToast(error, "error"); dispatch(clearPostErrors()); }
  }, [error]);

  const handleDelete = useCallback(async (postId) => {
    const res = await dispatch(adminDeletePost(postId));
    if (!res.error) showToast("Post deleted successfully");
    else showToast(res.payload ?? "Failed to delete", "error");
  }, [dispatch, showToast]);

  const total      = pagination.total      ?? 0;
  const totalPages = pagination.totalPages ?? 1;
  const curPage    = pagination.page       ?? 1;

  const photosCount = posts.filter(p => p.type === "image").length;
  const reelsCount  = posts.filter(p => p.type === "reel").length;
  const textCount   = posts.filter(p => p.type === "text").length;

  const STAT_CARDS = [
    {
      icon: LayoutGrid, label: "Total Posts", value: total,
      accent: {
        cardBg: "bg-violet-50 border-violet-100 hover:bg-violet-100/50 hover:border-violet-200",
        icon: "text-violet-500",
      },
    },
    {
      icon: Image, label: "Photos", value: photosCount,
      accent: {
        cardBg: "bg-sky-50 border-sky-100 hover:bg-sky-100/50 hover:border-sky-200",
        icon: "text-sky-500",
      },
    },
    {
      icon: Film, label: "Reels", value: reelsCount,
      accent: {
        cardBg: "bg-pink-50 border-pink-100 hover:bg-pink-100/50 hover:border-pink-200",
        icon: "text-pink-500",
      },
    },
    {
      icon: FileText, label: "Text Posts", value: textCount,
      accent: {
        cardBg: "bg-amber-50 border-amber-100 hover:bg-amber-100/50 hover:border-amber-200",
        icon: "text-amber-500",
      },
    },
  ];

  const TYPE_FILTERS = [
    { value: "",      label: "All",    icon: LayoutGrid },
    { value: "image", label: "Photos", icon: Image      },
    { value: "reel",  label: "Reels",  icon: Film       },
    { value: "text",  label: "Text",   icon: FileText   },
  ];

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 left-4 sm:left-auto sm:right-5 sm:top-5 z-50
          px-4 py-3 rounded-2xl text-sm font-semibold shadow-xl border
          pointer-events-none animate-fade-in text-center sm:text-left
          ${toast.type === "error"
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
          {toast.msg}
        </div>
      )}

      <PostDetailModal
        post={selectedPost}
        onClose={() => dispatch(closePostModal())}
        onDelete={handleDelete}
        deleteLoading={deleteLoading}
      />

      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-8">

          {/* ── Page Header ── */}
          <div className="flex items-center justify-between mb-5 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Post</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5 sm:mt-1 flex items-center gap-1.5">
                <TrendingUp size={12} />
                {loading ? "Loading…" : `${total.toLocaleString()} total posts`}
              </p>
            </div>
            <button
              onClick={() => { dispatch(resetPostFilters()); setSearchInput(""); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500
                hover:text-slate-800 border border-slate-200 bg-white rounded-xl
                px-2.5 py-2 sm:px-3.5 sm:py-2.5 hover:bg-slate-50 hover:border-slate-300
                transition-all duration-150 shadow-sm"
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">Reset filters</span>
              <span className="sm:hidden">Reset</span>
            </button>
          </div>

          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-5 sm:mb-8">
            {STAT_CARDS.map((card) => (
              <StatCard key={card.label} {...card} loading={loading} />
            ))}
          </div>

          {/* ── Filter Bar ── */}
          <div className="bg-white border border-slate-200 rounded-2xl px-3 py-3 sm:px-5 sm:py-4 mb-4 sm:mb-6 shadow-sm">

            {/* Mobile: search + toggle button row */}
            <div className="flex items-center gap-2 sm:hidden">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search caption…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl
                    pl-9 pr-8 py-2 text-sm text-slate-700 placeholder-slate-400
                    focus:outline-none focus:border-violet-400 focus:bg-white transition-all"
                />
                {searchInput && (
                  <button
                    onClick={() => { setSearchInput(""); dispatch(setPostFilters({ search: "", page: 1 })); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setFilterOpen(v => !v)}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl border text-xs font-semibold
                  transition-colors shrink-0
                  ${filterOpen
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-slate-50 text-slate-600 border-slate-200"}`}
              >
                <SlidersHorizontal size={13} />
                Filter
              </button>
            </div>

            {/* Mobile: collapsible extra filters */}
            {filterOpen && (
              <div className="flex flex-col gap-2.5 mt-3 sm:hidden">
                {/* Type pills */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 overflow-x-auto">
                  {TYPE_FILTERS.map(({ value, label, icon: Icon }) => (
                    <button key={value}
                      onClick={() => dispatch(setPostFilters({ type: value, page: 1 }))}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg whitespace-nowrap
                        text-xs font-semibold transition-all shrink-0
                        ${filters.type === value
                          ? "bg-white text-violet-700 shadow-sm border border-slate-200"
                          : "text-slate-500 hover:text-slate-700"}`}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Sort + Per page row */}
                <div className="flex gap-2">
                  <select
                    value={`${filters.sortBy}_${filters.sortOrder}`}
                    onChange={(e) => {
                      const [col, ord] = e.target.value.split("_");
                      dispatch(setPostFilters({ sortBy: col, sortOrder: ord, page: 1 }));
                    }}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2
                      text-xs text-slate-600 focus:outline-none focus:border-violet-400 cursor-pointer"
                  >
                    <option value="createdAt_desc">Newest first</option>
                    <option value="createdAt_asc">Oldest first</option>
                    <option value="likesCount_desc">Most liked</option>
                    <option value="commentsCount_desc">Most commented</option>
                    <option value="viewsCount_desc">Most viewed</option>
                  </select>
                  <select
                    value={filters.limit}
                    onChange={(e) => dispatch(setPostFilters({ limit: Number(e.target.value), page: 1 }))}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2
                      text-xs text-slate-600 focus:outline-none focus:border-violet-400 cursor-pointer"
                  >
                    <option value={20}>20/page</option>
                    <option value={30}>30/page</option>
                    <option value={50}>50/page</option>
                  </select>
                </div>
              </div>
            )}

            {/* Desktop: all filters in one row */}
            <div className="hidden sm:flex flex-wrap gap-3 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search caption…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl
                    pl-10 pr-9 py-2.5 text-sm text-slate-700 placeholder-slate-400
                    focus:outline-none focus:border-violet-400 focus:bg-white transition-all duration-150"
                />
                {searchInput && (
                  <button
                    onClick={() => { setSearchInput(""); dispatch(setPostFilters({ search: "", page: 1 })); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Type pills */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1">
                {TYPE_FILTERS.map(({ value, label, icon: Icon }) => (
                  <button key={value}
                    onClick={() => dispatch(setPostFilters({ type: value, page: 1 }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                      text-xs font-semibold transition-all duration-150
                      ${filters.type === value
                        ? "bg-white text-violet-700 shadow-sm border border-slate-200"
                        : "text-slate-500 hover:text-slate-700"}`}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-slate-400 shrink-0" />
                <select
                  value={`${filters.sortBy}_${filters.sortOrder}`}
                  onChange={(e) => {
                    const [col, ord] = e.target.value.split("_");
                    dispatch(setPostFilters({ sortBy: col, sortOrder: ord, page: 1 }));
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5
                    text-sm text-slate-600 focus:outline-none focus:border-violet-400 cursor-pointer transition-colors"
                >
                  <option value="createdAt_desc">Newest first</option>
                  <option value="createdAt_asc">Oldest first</option>
                  <option value="likesCount_desc">Most liked</option>
                  <option value="commentsCount_desc">Most commented</option>
                  <option value="viewsCount_desc">Most viewed</option>
                </select>
              </div>

              {/* Per page */}
              <select
                value={filters.limit}
                onChange={(e) => dispatch(setPostFilters({ limit: Number(e.target.value), page: 1 }))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5
                  text-sm text-slate-600 focus:outline-none focus:border-violet-400 cursor-pointer transition-colors"
              >
                <option value={20}>20 / page</option>
                <option value={30}>30 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          </div>

          {/* ── Grid ── */}
          {loading ? <PostsGridSkeleton count={18} /> :posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 sm:py-28 gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-slate-100 flex items-center justify-center">
                <Image size={28} className="text-slate-300 sm:hidden" />
                <Image size={32} className="text-slate-300 hidden sm:block" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-600">No posts found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
              </div>
              <button
                onClick={() => { dispatch(resetPostFilters()); setSearchInput(""); }}
                className="text-xs font-semibold text-violet-600 hover:text-violet-700
                  underline underline-offset-2 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
              {posts.map((post) => (
                <PostTile
                  key={post._id}
                  post={post}
                  onDelete={handleDelete}
                  deleteLoading={deleteLoading}
                  onOpen={(p) => dispatch(openPostModal(p))}
                />
              ))}
            </div>
          )}

          {/* ── Pagination ── */}
          {!loading && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4
              mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-200">
              <p className="text-xs text-slate-400 font-medium text-center sm:text-left order-2 sm:order-1">
                Page {curPage} of {totalPages} · {total.toLocaleString()} posts
              </p>
              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center order-1 sm:order-2">
                <button
                  onClick={() => dispatch(setPostPage(curPage - 1))}
                  disabled={curPage <= 1}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs
                    font-semibold bg-white border border-slate-200 hover:bg-slate-50
                    text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed
                    transition-colors shadow-sm"
                >
                  <ChevronLeft size={13} /> Prev
                </button>

                {(() => {
                  const pages = [];
                  let start = Math.max(1, curPage - 2);
                  let end   = Math.min(totalPages, start + 4);
                  if (end - start < 4) start = Math.max(1, end - 4);
                  for (let i = start; i <= end; i++) pages.push(i);
                  return pages.map((p) => (
                    <button key={p}
                      onClick={() => dispatch(setPostPage(p))}
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-xs font-bold transition-all duration-150
                        ${p === curPage
                          ? "bg-violet-600 text-white shadow-sm scale-105"
                          : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"}`}
                    >{p}</button>
                  ));
                })()}

                <button
                  onClick={() => dispatch(setPostPage(curPage + 1))}
                  disabled={curPage >= totalPages}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs
                    font-semibold bg-white border border-slate-200 hover:bg-slate-50
                    text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed
                    transition-colors shadow-sm"
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}