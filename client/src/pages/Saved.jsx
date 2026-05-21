import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Bookmark, Heart, MessageCircle, Play, Video, Image, FileText } from "lucide-react";
import { fetchSavedPosts } from "../lib/redux/postSlice";
import PostModal from "../components/PostModal";

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

function fmtCount(n = 0) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Skeleton ───────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse"
      style={{ background: T.brownLt, paddingBottom: "100%" }} />
  );
}

// ── Post Card ──────────────────────────────────────────────────
function SavedCard({ post, onClick }) {
  const isReel  = post.type === "reel";
  const isText  = post.type === "text";
  const isMulti = post.media?.length > 1;
  const thumb   = post.media?.[0]?.thumbnailUrl || post.media?.[0]?.url || null;

  return (
    <div
      onClick={() => onClick(post)}
      className="relative group rounded-2xl overflow-hidden cursor-pointer"
      style={{ background: T.card, border: `1px solid ${T.border}` }}
    >
      {isText ? (
        <div className="p-4 min-h-30 flex flex-col justify-between"
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
        <div className="relative w-full" style={{ paddingBottom: "100%" }}>
          {thumb ? (
            <img src={thumb} alt={post.caption || "post"}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: T.brownLt }}>
              <Video size={32} style={{ color: T.textLt }} />
            </div>
          )}

          {isReel && (
            <div className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center bg-black/50">
              <Play size={14} fill="white" color="white" />
            </div>
          )}

          {isMulti && (
            <div className="absolute top-2 right-2 flex gap-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
            </div>
          )}
        </div>
      )}

      {/* Hover overlay */}
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
      </div>

      {/* Author chip */}
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

// ── Masonry Grid ───────────────────────────────────────────────
function MasonryGrid({ posts, onPostClick, loading }) {
  const cols = [[], [], []];
  posts.forEach((post, i) => cols[i % 3].push(post));

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
      {loading && posts.length === 0
        ? Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)
        : cols.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-2 md:gap-3">
              {col.map((post) => (
                <SavedCard key={post._id} post={post} onClick={onPostClick} />
              ))}
            </div>
          ))
      }
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function Saved() {
  const dispatch = useDispatch();
  const { savedPosts, savedPostsLoading } = useSelector((s) => s.posts);
  

  const [selectedPost, setSelectedPost] = useState(null);

useEffect(() => {
  dispatch(fetchSavedPosts());
}, [dispatch]);

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get("post");
  if (!postId || savedPosts.length === 0) return;
  const found = savedPosts.find((p) => p._id === postId);
  if (found) setSelectedPost(found);
}, [savedPosts]);

  return (
    <div className="min-h-screen pt-14 md:pt-0" style={{ background: T.bg }}>
      <div className="max-w-5xl mx-auto px-3 py-4 md:py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: T.brownLt }}>
            <Bookmark size={18} style={{ color: T.brown }} fill={T.brown} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: T.brown }}>Saved Posts</h1>
            <p className="text-xs" style={{ color: T.textLt }}>
              {savedPostsLoading ? "Loading..." : `${savedPosts.length} post${savedPosts.length !== 1 ? "s" : ""} saved`}
            </p>
          </div>
        </div>

        {/* Empty state */}
        {!savedPostsLoading && savedPosts.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: T.brownLt }}>
              <Bookmark size={28} style={{ color: T.accent }} />
            </div>
            <p className="font-semibold text-lg" style={{ color: T.brown }}>No saved posts yet</p>
            <p className="text-sm mt-1" style={{ color: T.textLt }}>
              Tap the bookmark icon on any post to save it here.
            </p>
          </div>
        )}

        {/* Grid */}
        <MasonryGrid
          posts={savedPosts}
          onPostClick={(post) => {
  setSelectedPost(post);
  window.history.pushState({}, "", `?post=${post._id}`);
}}
          loading={savedPostsLoading}
        />
      </div>

      {/* Post Modal */}
      {selectedPost && (
        <PostModal
          post={selectedPost}
          onClose={() => {
  setSelectedPost(null);
  window.history.pushState({}, "", window.location.pathname);
}}
        />
      )}
    </div>
  );
}