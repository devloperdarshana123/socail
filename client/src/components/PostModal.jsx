

import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import EmojiPicker from "emoji-picker-react";
import ReportModal from "./ReportModal";
import api from "../lib/services/api";
import toast from "react-hot-toast";
import LoadingOverlay from "./LoadingOverlay";
import {
  X, Heart, MessageCircle, Bookmark,
  Play, Pause, ChevronLeft, ChevronRight, Send, Eye,
  Loader2,MoreHorizontal, Trash2,
} from "lucide-react";
import {
  togglePostLike,
  toggleSavePost,
  fetchComments,
  addComment,
  fetchPostInteraction,
  initInteraction,
  deletePost,
  recordPostView,
} from "../lib/redux/postSlice";

const T = {
  bg:       "#faf6f0",
  card:     "#ffffff",
  border:   "#e8d5be",
  brown:    "#5a3e2b",
  brownMid: "#8b6343",
  brownLt:  "#f5ece0",
  brownXlt: "#fdf9f5",
  accent:   "#c09a6e",
  text:     "#2d1f0f",
  textMid:  "#6b4c35",
  textLt:   "#a08060",
  red:      "#ef4444",
};

function fmtCount(n = 0) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60)     return `${Math.floor(diff)}s ago`;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function Avatar({ user, size = 36 }) {
  const s = `${size}px`;
  return user?.avatar?.url ? (
    <img
      src={user.avatar.url}
      alt={user.fullName || "user"}
      style={{ width: s, height: s, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
    />
  ) : (
    <div style={{
      width: s, height: s, borderRadius: "50%", flexShrink: 0,
      background: `linear-gradient(135deg, ${T.brown}, ${T.accent})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: Math.round(size * 0.4),
    }}>
      {user?.fullName?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

function MediaCarousel({ media, type }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef(null);

  const current = media?.[idx];
  const isVideo = current?.type === "video" || type === "reel";

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => setIdx((i) => Math.min(media.length - 1, i + 1));

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); }
    else         { videoRef.current.play();  setPlaying(true);  }
  };

  useEffect(() => { setIdx(0); setPlaying(false); }, [media]);

  if (!media?.length) return null;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
      {isVideo ? (
        <video
          ref={videoRef}
          src={current?.url}
          poster={current?.thumbnailUrl}
          className="pm-media-el"
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          loop playsInline onClick={togglePlay}
        />
      ) : (
        <img
          src={current?.url}
          alt=""
          className="pm-media-el"
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      )}

      {isVideo && (
        <button onClick={togglePlay} style={{
          position: "absolute", bottom: 12, right: 12,
          background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%",
          width: 36, height: 36, display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", color: "#fff",
        }}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
      )}

      {media.length > 1 && (
        <>
          {idx > 0 && (
            <button onClick={prev} style={{
              position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%",
              width: 32, height: 32, display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer", color: "#fff",
            }}>
              <ChevronLeft size={18} />
            </button>
          )}
          {idx < media.length - 1 && (
            <button onClick={next} style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%",
              width: 32, height: 32, display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer", color: "#fff",
            }}>
              <ChevronRight size={18} />
            </button>
          )}
          <div style={{
            position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: 5,
          }}>
            {media.map((_, i) => (
              <div key={i} onClick={() => setIdx(i)} style={{
                width: i === idx ? 18 : 6, height: 6, borderRadius: 3, cursor: "pointer",
                background: i === idx ? "#fff" : "rgba(255,255,255,0.45)",
                transition: "all 0.25s",
              }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CommentItem({ comment, onReply, onAvatarClick }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
      <div onClick={() => onAvatarClick(comment.author)} style={{ cursor: "pointer" }}>
        <Avatar user={comment.author} size={32} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: T.text }}>
            {comment.author?.fullName || "User"}
          </span>
          <span style={{ fontSize: 11, color: T.textLt }}>@{comment.author?.username}</span>
          <span style={{ fontSize: 11, color: T.textLt, marginLeft: "auto" }}>
            {timeAgo(comment.createdAt)}
          </span>
        </div>
        <p style={{ fontSize: 13, color: T.text, marginTop: 3, lineHeight: 1.5, wordBreak: "break-word" }}>
          {comment.content}
        </p>
        <button
          onClick={() => onReply(comment)}
          style={{ fontSize: 12, color: T.accent, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginTop: 2 }}
        >
          Reply
        </button>
      </div>
    </div>
  );
}

export default function PostModal({ post, onClose }) {
  const dispatch = useDispatch();
  const navigate = useNavigate(); 
  const { user: me } = useSelector((s) => s.auth);
  const interactions = useSelector((s) => s.posts.interactions);

  const postId = post?.id;
  const inter  = interactions[postId] || {};

  const liked           = inter.liked           ?? false;
  const likesCount      = inter.likesCount      ?? post?.likesCount    ?? 0;
  const saved           = inter.saved           ?? false;
  const comments        = inter.comments        ?? [];
  const commentsLoading     = inter.commentsLoading     ?? false;
  const commentsLoadingMore = inter.commentsLoadingMore ?? false;
  const commentsHasMore     = inter.commentsHasMore     ?? false;
  const commentsNextCursor  = inter.commentsNextCursor  ?? null;
  const commentAdding       = inter.commentAdding       ?? false;

  const [showMenu,      setShowMenu]      = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const isOwner = me?.id === post?.author?.id;
  const [commentText, setCommentText] = useState("");
  const [replyingTo,  setReplyingTo]  = useState(null);
  const [likeAnim,    setLikeAnim]    = useState(false);
  const [showReport,  setShowReport]  = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCommentEmoji, setShowCommentEmoji] = useState(false);
  const inputRef        = useRef(null);
  const commentsListRef = useRef(null);

  const viewTimerRef = useRef(null);
  const viewStartRef = useRef(null);

useEffect(() => {
  if (!postId || !post) return;
  if (isOwner) return;

  const viewStartTime = Date.now();
  
  viewTimerRef.current = setTimeout(() => {
    const viewDuration = Math.floor((Date.now() - viewStartTime) / 1000);
    dispatch(recordPostView({ 
      postId, 
      source: "modal", 
      duration: viewDuration 
    }));
  }, 3000);

  return () => {
    if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
  };
}, [postId, isOwner, dispatch, post]);

  const hasMedia = post?.type !== "text" && Array.isArray(post?.media) && post.media.length > 0;
  const isText   = post?.type === "text";

  useEffect(() => {
    if (!postId) return;
    document.body.style.overflow = "hidden";
    dispatch(initInteraction({
      postId,
      saved:         post.isSaved      ?? false,
      commentsCount: post.commentsCount ?? 0,
    }));
    dispatch(fetchPostInteraction(postId));
    dispatch(fetchComments({ postId }));
    return () => { document.body.style.overflow = ""; };
  }, [postId, dispatch ]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleLike = useCallback(() => {
    if (!postId) return;
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 400);
    dispatch(togglePostLike({
      postId,
      postAuthorId: post?.author?.id || null,
    }));
  }, [dispatch, postId, post?.author?.id]);

  const lastTap = useRef(0);
  const handleMediaDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) { if (!liked) handleLike(); }
    lastTap.current = now;
  };

  const handleSave = useCallback(() => {
    if (!postId) return;
    dispatch(toggleSavePost(postId));
  }, [dispatch, postId]);

  // ✅ FIX: comment send ke baad input focus rakho — message page jaisa
  const handleCommentSubmit = useCallback(() => {
    const text = commentText.trim();
    if (!text || commentAdding) return;

    dispatch(addComment({
      postId,
      content: text,
      parentCommentId: replyingTo?.id || null,
      postAuthorId: post?.author?.id || null,
    }));

    setCommentText("");
    setReplyingTo(null);
    inputRef.current?.focus(); // ✅ message page jaisa — sirf focus
  }, [dispatch, postId, commentText, commentAdding, replyingTo, post?.author?.id]);

  const handleReply = (comment) => {
    setReplyingTo(comment);
    setCommentText(`@${comment.author?.username} `);
    inputRef.current?.focus();
  };

  if (!post) return null;

  const modal = (
    <div
      className="pm-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
        backdropFilter: "blur(4px)",
        animation: "fadeInBackdrop 0.2s ease",
      }}
    >
      <style>{`
        @keyframes fadeInBackdrop { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUpModal   { from { opacity:0; transform:translateY(24px) scale(0.97) }
                                    to   { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes heartPop       { 0%,100%{transform:scale(1)} 40%{transform:scale(1.45)} 70%{transform:scale(0.9)} }
        @keyframes spin           { to { transform:rotate(360deg) } }
        .pm-comment-input::placeholder { color: #a08060 }
        .pm-like-btn:active  { transform: scale(0.88) }
        .pm-action-btn:hover { opacity: 0.75 }
        .pm-right-section::-webkit-scrollbar { width: 2px; }
        .pm-right-section::-webkit-scrollbar-track { background: transparent; }
        .pm-right-section::-webkit-scrollbar-thumb { background: #d4b896; border-radius: 99px; }
        .pm-left-section::-webkit-scrollbar { width: 2px; }
        .pm-left-section::-webkit-scrollbar-track { background: transparent; }
        .pm-left-section::-webkit-scrollbar-thumb { background: #d4b896; border-radius: 99px; }

        @media (max-width: 768px) {
          .pm-backdrop {
            padding: 0 !important;
            align-items: flex-start !important;
          }
          .pm-modal-container {
            flex-direction: column !important;
            height: calc(100dvh - 40px) !important;
            max-height: calc(100dvh - 40px) !important;
            width: 100vw !important;
            max-width: 100vw !important;
            border-radius: 16px !important;
            margin-top: 40px !important;
          }
          .pm-inner-wrap {
            flex-direction: column !important;
          }
          .pm-left-section {
            flex: 0 0 38vh !important;
            width: 100% !important;
            max-height: 38vh !important;
            min-height: 38vh !important;
          }
          .pm-media-el {
            object-fit: cover !important;
          }
          .pm-right-section.pm-info-col {
            flex: 1 1 auto !important;
            width: 100% !important;
            border-left: none !important;
            border-top: 1px solid #e8d5be !important;
            min-height: 0 !important;
            min-width: 0 !important;
          }
        }
      `}</style>

      {/* ── Modal container ── */}
      <div
        className="pm-modal-container"
        style={{
          background: T.card,
          borderRadius: 20,
          width: "100%",
          maxWidth: 920,
          height: "90vh",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "row",
          overflow: "visible",
          boxShadow: "0 32px 80px rgba(0,0,0,0.45)",
          animation: "slideUpModal 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          position: "relative",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: -17, left: "50%", transform: "translateX(-50%)", zIndex: 10,
            background: "rgba(0,0,0,0.35)", border: "none", borderRadius: "50%",
            width: 34, height: 34, display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", color: "#fff",
          }}
        >
          <X size={18} />
        </button>

        <div className="pm-inner-wrap" style={{ display:"flex", flexDirection:"row", width:"100%", height:"100%", borderRadius:20, overflow:"hidden" }}>

          {/* ══ LEFT — Media or Text ══ */}
          <div
            className="pm-left-section"
            onClick={handleMediaDoubleTap}
            style={{
              flex: "1 1 55%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              background: hasMedia
                ? "#0a0a0a"
                : `linear-gradient(135deg, ${T.brownLt}, ${T.brownXlt})`,
            }}
          >
            {hasMedia ? (
              <MediaCarousel media={post.media} type={post.type} />
            ) : (
              <div style={{ padding: 40, maxWidth: 420, overflowY: "auto", maxHeight: "100%" }}>
                <p style={{
                  fontSize: 20, fontWeight: 600, color: T.text,
                  lineHeight: 1.7, wordBreak: "break-word",
                }}>
                  {post.caption}
                </p>
                {post.hashtags?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 20 }}>
                    {post.hashtags.map((tag, i) => (
                      <span key={i} style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══ RIGHT — Info + Comments ══ */}
          <div
            className="pm-right-section pm-info-col"
            style={{
              flex: "0 0 340px",
              display: "flex",
              flexDirection: "column",
              borderLeft: `1px solid ${T.border}`,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {/* Author header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 16px",
              borderBottom: `1px solid ${T.border}`,
              flexShrink: 0,
            }}>
              <div
                onClick={() => {
                  if (!post.author?.username) return;
                  onClose();
                  if (post.author?.username === me?.username) {
                    navigate("/profile");
                  } else {
                    navigate(`/profile/${post.author.username}`);
                  }
                }}
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1, minWidth: 0 }}
              >
                <Avatar user={post.author} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: T.text,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {post.author?.fullName}
                  </p>
                  <p style={{ fontSize: 12, color: T.textLt }}>@{post.author?.username}</p>
                </div>
              </div>
              <span style={{ fontSize: 11, color: T.textLt, flexShrink: 0 }}>
                {timeAgo(post.createdAt)}
              </span>
              <div style={{ position: "relative", marginLeft: 4, zIndex: 11 }}>
                <button
                  onClick={() => setShowMenu((v) => !v)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: 4, color: T.textLt, display: "flex", alignItems: "center",
                    borderRadius: "50%",
                  }}
                >
                  <MoreHorizontal size={18} />
                </button>

                {showMenu && (
                  <>
                    <div
                      onClick={() => setShowMenu(false)}
                      style={{ position: "fixed", inset: 0, zIndex: 10 }}
                    />
                    <div style={{
                      position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 20,
                      background: "#fff", borderRadius: 12, overflow: "hidden",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                      border: `1px solid ${T.border}`,
                      minWidth: 160,
                    }}>
                      {isOwner && (
                        <button
                          onClick={() => { setShowMenu(false); setDeleteConfirm(true); }}
                          style={{
                            width: "100%", padding: "12px 16px",
                            display: "flex", alignItems: "center", gap: 10,
                            background: "none", border: "none", cursor: "pointer",
                            color: "#ef4444", fontSize: 13, fontWeight: 600,
                            textAlign: "left",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#fef2f2"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                        >
                          <Trash2 size={15} />
                          Delete Post
                        </button>
                      )}
                      {!isOwner && (
                        <button
                          onClick={() => { setShowMenu(false); setShowReport(true); }}
                          style={{
                            width: "100%", padding: "12px 16px",
                            display: "flex", alignItems: "center", gap: 10,
                            background: "none", border: "none", cursor: "pointer",
                            color: "#ef4444", fontSize: 13, fontWeight: 600, textAlign: "left",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#fef2f2"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                        >
                          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                          Report post
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Caption */}
            {hasMedia && post.caption && (
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                <p style={{ fontSize: 13, color: T.text, lineHeight: 1.55, wordBreak: "break-word" }}>
                  {post.caption}
                </p>
                {post.hashtags?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                    {post.hashtags.map((tag, i) => (
                      <span key={i} style={{ fontSize: 12, fontWeight: 600, color: T.accent }}>#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Comments list */}
            <div
              ref={commentsListRef}
              className="pm-right-section"
              style={{
                flex: 1, overflowY: "auto", padding: "4px 16px",
                scrollbarWidth: "thin", scrollbarColor: `${T.border} transparent`,
              }}
              onScroll={(e) => {
                const el = e.currentTarget;
                const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
                if (nearBottom && commentsHasMore && !commentsLoadingMore && commentsNextCursor && comments.length > 0) {
                  const lastComment = comments[comments.length - 1];
                  dispatch(fetchComments({ postId, afterId: lastComment.id, afterDate: lastComment.createdAt }));
                }
              }}
            >
              {post.commentsDisabled ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <p style={{ fontSize: 24 }}>🔒</p>
                  <p style={{ fontSize: 13, color: T.textLt, marginTop: 8 }}>Comments are turned off.</p>
                </div>
              ) : commentsLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                  <Loader2 size={22} style={{ color: T.accent, animation: "spin 1s linear infinite" }} />
                </div>
              ) : comments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <p style={{ fontSize: 24 }}>💬</p>
                  <p style={{ fontSize: 13, color: T.textLt, marginTop: 8 }}>No comments yet. Be first!</p>
                </div>
              ) : (
                <>
                  {comments.map((c) => (
                    <CommentItem
                      key={c.id}
                      comment={c}
                      onReply={handleReply}
                      onAvatarClick={(author) => {
                        if (!author?.username) return;
                        onClose();
                        if (author.username === me?.username) {
                          navigate("/profile");
                        } else {
                          navigate(`/profile/${author.username}`);
                        }
                      }}
                    />
                  ))}
                  {commentsLoadingMore && (
                    <div style={{ display: "flex", justifyContent: "center", padding: "14px 0" }}>
                      <Loader2 size={18} style={{ color: T.accent, animation: "spin 1s linear infinite" }} />
                    </div>
                  )}
                  {!commentsLoadingMore && commentsHasMore && (
                    <div style={{ textAlign: "center", padding: "10px 0" }}>
                      <button
                        onClick={() => {
                          const lastComment = comments[comments.length - 1];
                          dispatch(fetchComments({ postId, afterId: lastComment.id, afterDate: lastComment.createdAt }));
                        }}
                        style={{ fontSize: 12, fontWeight: 600, color: T.accent, background: "none", border: "none", cursor: "pointer" }}
                      >
                        Load more comments
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Action row */}
            <div style={{ borderTop: `1px solid ${T.border}`, padding: "10px 16px 8px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {!post.likesHidden && (
                  <button
                    className="pm-like-btn"
                    onClick={handleLike}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5,
                      padding: 4, color: liked ? T.red : T.textMid,
                      animation: likeAnim ? "heartPop 0.4s ease" : "none",
                      transition: "color 0.2s",
                    }}
                  >
                    <Heart size={22} fill={liked ? T.red : "none"} color={liked ? T.red : T.textMid} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtCount(likesCount)}</span>
                  </button>
                )}
                {!post.commentsDisabled && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: T.textMid }}>
                    <MessageCircle size={21} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {fmtCount(inter.commentsCount ?? post.commentsCount ?? 0)}
                    </span>
                  </div>
                )}
                {post.type === "reel" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: T.textMid }}>
                    <Eye size={20} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtCount(inter.viewsCount ?? post.viewsCount ?? 0)}</span>
                  </div>
                )}
                <button
                  className="pm-action-btn"
                  onClick={handleSave}
                  style={{
                    marginLeft: "auto", background: "none", border: "none",
                    cursor: "pointer", padding: 4, color: T.textMid, transition: "color 0.2s",
                  }}
                >
                  <Bookmark size={21} fill={saved ? T.brown : "none"} color={saved ? T.brown : T.textMid} />
                </button>
              </div>
            </div>

            {/* ✅ Comment input — message page jaisa, koi onFocus/scrollIntoView nahi */}
            {!post.commentsDisabled && (
              <div style={{ borderTop: `1px solid ${T.border}`, padding: "10px 12px", flexShrink: 0 }}>
                {replyingTo && (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "4px 10px", marginBottom: 6,
                    background: T.brownLt, borderRadius: 8,
                  }}>
                    <span style={{ fontSize: 12, color: T.brownMid }}>
                      Replying to <b>@{replyingTo.author?.username}</b>
                    </span>
                    <button
                      onClick={() => { setReplyingTo(null); setCommentText(""); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: T.textLt, lineHeight: 1 }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
                  <Avatar user={me} size={30} />
                  {showCommentEmoji && (
                    <div style={{ position: "absolute", bottom: 44, left: 0, zIndex: 50 }}
                      onClick={(e) => e.stopPropagation()}>
                      <EmojiPicker
                        onEmojiClick={(ed) => {
                          setCommentText((p) => p + ed.emoji);
                        
                          inputRef.current?.focus();
                        }}
                        width={280} height={320}
                        skinTonesDisabled
                        previewConfig={{ showPreview: false }}
                      />
                    </div>
                  )}
                  <input
                    ref={inputRef}
                    className="pm-comment-input"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCommentSubmit(); }
                    }}
                    placeholder="Add a comment..."
                    style={{
                      flex: 1, border: "none", outline: "none",
                      background: T.brownLt, borderRadius: 20,
                      padding: "8px 14px", fontSize: 13, color: T.text,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCommentEmoji((v) => !v)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, flexShrink: 0 }}
                  >😊</button>
                  <button
                    onClick={handleCommentSubmit}
                    disabled={!commentText.trim() || commentAdding}
                    style={{
                      background: commentText.trim() ? T.brown : T.brownLt,
                      border: "none", borderRadius: "50%",
                      width: 34, height: 34,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: commentText.trim() ? "pointer" : "default",
                      transition: "background 0.2s", flexShrink: 0,
                    }}
                  >
                    {commentAdding
                      ? <Loader2 size={15} color="#fff" style={{ animation: "spin 1s linear infinite" }} />
                      : <Send size={15} color={commentText.trim() ? "#fff" : T.textLt} />
                    }
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        {showReport && (
          <ReportModal
            targetModel="Post"
            onClose={() => setShowReport(false)}
            onSubmit={async (reason) => {
              try {
                const { data } = await api.post("/user/report", {
                  targetId:    post.id,
                  targetModel: "Post",
                  reason,
                });
                setShowReport(false);
                setTimeout(() => {
                  if (data.alreadyReported) {
                    toast("You have already reported this post.");
                  } else {
                    toast.success("Report submitted. Our team will review it within 24 hours.");
                  }
                }, 100);
              } catch (err) {
                setShowReport(false);
                setTimeout(() => {
                  toast.error(err?.response?.data?.message || "Failed to submit report.");
                }, 100);
              }
            }}
          />
        )}

        {deleteConfirm && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 30,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 20,
          }}>
            <div style={{
              background: "#fff", borderRadius: 16, padding: "28px 24px",
              width: 300, textAlign: "center",
              boxShadow: "0 16px 40px rgba(0,0,0,0.2)",
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "#fef2f2", display: "flex",
                alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
              }}>
                <Trash2 size={22} color="#ef4444" />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                Delete this post?
              </p>
              <p style={{ fontSize: 13, color: T.textLt, marginBottom: 24, lineHeight: 1.5 }}>
                This post will be permanently removed. This action cannot be undone.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 10,
                    border: `1px solid ${T.border}`, background: "#fff",
                    fontSize: 13, fontWeight: 600, color: T.text, cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
  onClick={async () => {
  setIsDeleting(true);
  setDeleteConfirm(false); 
  try {
    await dispatch(deletePost(post.id)).unwrap();
    toast.success("Post deleted successfully.");
    onClose();
  } catch {
    setIsDeleting(false);
    toast.error("Failed to delete post. Please try again.");
  }
}}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 10,
                    border: "none", background: "#ef4444",
                    fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
{isDeleting && <LoadingOverlay message="Deleting post..." />}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}