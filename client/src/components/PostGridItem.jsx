/**
 * PostGridItem.jsx — Reusable grid tile
 *
 * Use karo Profile, Explore, Feed — sab jagah.
 * Import:
 *   import PostGridItem from "../components/PostGridItem";
 *
 * Usage:
 *   <PostGridItem post={post} onClick={() => setSelectedPost(post)} />
 *   <PostGridItem post={post} onClick={...} showMenu onDelete={() => dispatch(deletePost(post._id))} />
 *   <PostGridItem post={post} onClick={...} isDraft onEdit={...} onPublish={...} onDelete={...} />
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Play, Heart, MessageCircle, Pencil, Trash2, Grid } from "lucide-react";
import {
  resolvePostThumb,
  isVideoMedia,
  createImgErrorHandler,
} from "../utils/mediaUtils";

// ─── Delete confirm portal ────────────────────────────────────────────────────
function DeleteConfirm({ onCancel, onConfirm }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <p className="text-sm font-bold text-[#2d1f0f] mb-2">Delete this post?</p>
        <p className="text-xs text-[#8b7355] mb-5 leading-relaxed">
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-[#ddd0c0] text-sm
              font-semibold text-[#5a3e2b] hover:bg-[#f5ece0] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600
              text-sm font-semibold text-white transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PostGridItem({
  post,
  onClick,

  // Owner-only actions
  showMenu    = false,   // show 3-dot menu (Profile page)
  onDelete,              // called after confirm

  // Draft-specific actions
  isDraft     = false,
  onEdit,
  onPublish,
}) {
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const imgSrc   = resolvePostThumb(post);
  const isVid    = isVideoMedia(post);
  const isText   = post?.type === "text" || (!imgSrc && post?.caption);

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
        onClick={onClick}
        className="relative cursor-pointer group overflow-hidden"
        style={{ paddingBottom: "100%", height: 0 }}
      >
        <div className="absolute inset-0">

          {/* ── Content ── */}
          {isText ? (
            <div
              className="w-full h-full flex flex-col justify-between p-3
                group-hover:brightness-90 transition-all duration-300"
              style={{
                background: "linear-gradient(135deg, #f5ece0, #fdf9f5)",
                border: "1px solid #e8d5be",
              }}
            >
              <p
                className="text-xs leading-relaxed"
                style={{
                  color: "#2d1f0f", fontWeight: 500,
                  display: "-webkit-box",
                  WebkitLineClamp: 6,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {post.caption || "No caption"}
              </p>
              {post.hashtags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {post.hashtags.slice(0, 3).map((tag, i) => (
                    <span key={i} className="text-[10px] font-bold" style={{ color: "#c09a6e" }}>
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : imgSrc ? (
            <img
              src={imgSrc}
              alt="post"
              className="w-full h-full object-cover group-hover:scale-105
                transition-transform duration-300"
              onError={createImgErrorHandler(post.media?.[0]?.url)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#e8d5be]">
              <Grid size={20} className="text-[#c09a6e]" />
            </div>
          )}

          {/* ── Video badge ── */}
          {isVid && (
            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-full p-1.5">
              <Play size={11} className="text-white fill-white" />
            </div>
          )}

          {/* ── Hover overlay — likes & comments ── */}
          {!isDraft && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40
              transition-all duration-300 flex items-center justify-center
              gap-4 opacity-0 group-hover:opacity-100">
              <span className="flex items-center gap-1 text-white text-sm font-bold">
                <Heart size={16} className="fill-white" />
                {post.likesCount ?? 0}
              </span>
              <span className="flex items-center gap-1 text-white text-sm font-bold">
                <MessageCircle size={16} className="fill-white" />
                {post.commentsCount ?? 0}
              </span>
            </div>
          )}

          {/* ── Draft hover actions ── */}
          {isDraft && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50
              transition-all duration-300 flex flex-col items-center justify-center
              gap-2 opacity-0 group-hover:opacity-100">
              {onEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="flex items-center gap-1.5 bg-white text-[#5a3e2b]
                    text-xs font-bold px-3 py-1.5 rounded-full"
                >
                  <Pencil size={11} /> Edit
                </button>
              )}
              {onPublish && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPublish(); }}
                  className="flex items-center gap-1.5 bg-[#5a3e2b] text-white
                    text-xs font-bold px-3 py-1.5 rounded-full"
                >
                  <Play size={11} /> Publish
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDel(true); }}
                  className="flex items-center gap-1.5 bg-red-500 text-white
                    text-xs font-bold px-3 py-1.5 rounded-full"
                >
                  <Trash2 size={11} /> Delete
                </button>
              )}
            </div>
          )}

          {/* ── 3-dot owner menu (non-draft) ── */}
          {showMenu && !isDraft && onDelete && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                className="absolute top-1.5 right-1.5 z-20 w-7 h-7 rounded-full
                  bg-black/50 backdrop-blur-sm flex items-center justify-center
                  opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <span className="text-white text-xs font-bold leading-none">···</span>
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                  />
                  <div
                    className="absolute top-8 right-1.5 z-40 bg-white rounded-xl
                      shadow-xl border border-[#e8d5be] overflow-hidden min-w-[130px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => { setMenuOpen(false); setConfirmDel(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs
                        font-semibold text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={13} />
                      Delete Post
                    </button>
                  </div>
                </>
              )}
            </>
          )}

        </div>
      </motion.div>

      {/* ── Delete confirm ── */}
      {confirmDel && (
        <DeleteConfirm
          onCancel={() => setConfirmDel(false)}
          onConfirm={() => { onDelete?.(); setConfirmDel(false); }}
        />
      )}
    </>
  );
}