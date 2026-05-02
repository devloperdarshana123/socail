

import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Heart, Reply, ChevronDown, ChevronUp, Smile, Trash2, X } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

// ── Common Emojis ─────────────────────────────────────────────────────────────
const EMOJIS = [
  "😂","❤️","🔥","👏","😍","🙏","😭","💯","🤣","😊",
  "✨","🥰","😎","🤩","💪","🙌","😅","👍","💥","🎉",
  "😢","😱","🤔","😏","💀","🫶","😤","🥹","😋","🤯",
  "👀","💬","🌟","🫠","😇","🤗","💫","🥳","😬","🙈",
];

// ── Emoji Picker ──────────────────────────────────────────────────────────────
function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-10 left-0 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl p-2 w-64"
    >
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-xs font-semibold text-gray-500">Emojis</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={12} />
        </button>
      </div>
      <div className="grid grid-cols-10 gap-0.5">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="text-lg hover:bg-gray-100 rounded-lg p-0.5 transition leading-none"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ src, name, size = "w-7 h-7", textSize = "text-xs" }) =>
  src ? (
    <img src={src} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
  ) : (
    <div
      className={`${size} rounded-full flex items-center justify-center text-white font-bold ${textSize} shrink-0`}
      style={{ background: "linear-gradient(135deg, #c8956c, #a07050)" }}
    >
      {name?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );

// ── Time Formatter ────────────────────────────────────────────────────────────
const timeAgo = (date) => {
  if (!date) return "";
  const diff = Date.now() - new Date(date);
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  return `${d}d`;
};

const normalize = (c) => ({
  ...c,
  likes:   Array.isArray(c.likes)   ? c.likes   : [],
  replies: Array.isArray(c.replies) ? c.replies : [],
});

const isLikedBy = (arr = [], uid) =>
  arr.some((id) => id?.toString() === uid?.toString());

// ── Comment Input Box (reusable) ──────────────────────────────────────────────
function CommentInput({ value, onChange, onSubmit, onKeyDown, placeholder, submitting, avatarSrc, avatarName, autoFocus = false }) {
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef(null);

  const insertEmoji = (emoji) => {
    const input = inputRef.current;
    if (!input) { onChange(value + emoji); return; }
    const start = input.selectionStart;
    const end   = input.selectionEnd;
    const newVal = value.slice(0, start) + emoji + value.slice(end);
    onChange(newVal);
    setTimeout(() => input.setSelectionRange(start + emoji.length, start + emoji.length), 0);
  };

  return (
    <div className="flex items-center gap-2 pt-1 relative">
      {avatarSrc !== undefined && (
        <Avatar src={avatarSrc} name={avatarName} size="w-7 h-7" />
      )}
      <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-1.5 relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit?.();
            onKeyDown?.(e);
          }}
          placeholder={placeholder || "Add a comment..."}
          className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder-gray-400"
          autoFocus={autoFocus}
        />

        {/* Emoji button */}
        <button
          type="button"
          onClick={() => setShowEmoji((p) => !p)}
          className="text-gray-400 hover:text-yellow-500 transition shrink-0"
        >
          <Smile size={14} />
        </button>

        {/* Post button */}
        <button
          onClick={onSubmit}
          disabled={submitting || !value.trim()}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-40 transition shrink-0"
        >
          {submitting ? "..." : "Post"}
        </button>

        {/* Emoji Picker */}
        {showEmoji && (
          <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />
        )}
      </div>
    </div>
  );
}

// ── Single Reply ──────────────────────────────────────────────────────────────
function ReplyItem({ reply, postId, commentId, currentUserId, onDelete }) {
  const safeReply               = normalize(reply);
  const [liked, setLiked]       = useState(isLikedBy(safeReply.likes, currentUserId));
  const [likeCount, setLikeCount] = useState(safeReply.likes.length);

  const isOwner = safeReply.user?._id?.toString() === currentUserId?.toString();

  const handleLike = async () => {
    try {
      await api.put(`/posts/${postId}/comments/${commentId}/replies/${safeReply._id}/like`);
      setLiked((p) => !p);
      setLikeCount((p) => (liked ? p - 1 : p + 1));
    } catch {
      toast.error("Like failed!");
    }
  };

  return (
    <div className="flex items-start gap-2 mt-2 ml-9 group">
      <Avatar src={safeReply.user?.avatar} name={safeReply.user?.name} size="w-6 h-6" textSize="text-[10px]" />
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 rounded-2xl px-3 py-2 inline-block max-w-full">
          <span className="text-xs font-semibold text-gray-800 mr-1.5">{safeReply.user?.name || "User"}</span>
          <span className="text-xs text-gray-700 break-words">{safeReply.text}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 ml-1">
          <span className="text-[10px] text-gray-400">{timeAgo(safeReply.createdAt)}</span>

          {/* Like reply */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 text-[10px] font-semibold transition ${
              liked ? "text-red-500" : "text-gray-400 hover:text-red-400"
            }`}
          >
            <Heart size={10} fill={liked ? "currentColor" : "none"} />
            {liked ? "Liked" : "Like"}
            {likeCount > 0 && <span className="ml-0.5">· {likeCount}</span>}
          </button>

          {/* Delete reply (only owner) */}
          {isOwner && (
            <button
              onClick={() => onDelete(safeReply._id)}
              className="text-[10px] text-gray-300 hover:text-red-400 transition "
            >
              <Trash2 size={10} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Single Comment ────────────────────────────────────────────────────────────
function CommentItem({ comment, postId, currentUserId, onDelete }) {
  const safe                                = normalize(comment);
  const [liked, setLiked]                   = useState(isLikedBy(safe.likes, currentUserId));
  const [likeCount, setLikeCount]           = useState(safe.likes.length);
  const [showReplies, setShowReplies]       = useState(false);
  const [replyText, setReplyText]           = useState("");
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [localReplies, setLocalReplies]     = useState(safe.replies);
  const [submitting, setSubmitting]         = useState(false);

  const isOwner = safe.user?._id?.toString() === currentUserId?.toString();

  const handleLike = async () => {
    try {
      await api.put(`/posts/${postId}/comments/${safe._id}/like`);
      setLiked((p) => !p);
      setLikeCount((p) => (liked ? p - 1 : p + 1));
    } catch {
      toast.error("Like failed!");
    }
  };

  const handleReplySubmit = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/posts/${postId}/comments/${safe._id}/reply`, {
        text: replyText.trim(),
      });
      setLocalReplies((p) => [...p, data.reply]);
      setReplyText("");
      setShowReplyInput(false);
      setShowReplies(true);
      toast.success("Reply posted!");
    } catch {
      toast.error("Reply failed!");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReply = async (replyId) => {
    try {
      await api.delete(`/posts/${postId}/comments/${safe._id}/replies/${replyId}`);
      setLocalReplies((p) => p.filter((r) => r._id !== replyId));
      toast.success("Reply deleted!");
    } catch {
      toast.error("Delete failed!");
    }
  };

  return (
    <div className="group">
      <div className="flex items-start gap-2">
        <Avatar src={safe.user?.avatar} name={safe.user?.name} />
        <div className="flex-1 min-w-0">

          {/* Comment bubble */}
          <div className="bg-gray-50 rounded-2xl px-3 py-2 inline-block max-w-full">
            <span className="text-xs font-semibold text-gray-800 mr-1.5">{safe.user?.name || "User"}</span>
            <span className="text-xs text-gray-700 break-words">{safe.text}</span>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1 ml-1 flex-wrap">
            <span className="text-[10px] text-gray-400">{timeAgo(safe.createdAt)}</span>

            {/* Like comment */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 text-[10px] font-semibold transition ${
                liked ? "text-red-500" : "text-gray-400 hover:text-red-400"
              }`}
            >
              <Heart size={10} fill={liked ? "currentColor" : "none"} />
              {liked ? "Liked" : "Like"}
              {likeCount > 0 && <span className="ml-0.5">· {likeCount}</span>}
            </button>

            {/* Reply button */}
            <button
              onClick={() => setShowReplyInput((p) => !p)}
              className={`flex items-center gap-1 text-[10px] font-semibold transition ${
                showReplyInput ? "text-indigo-500" : "text-gray-400 hover:text-indigo-500"
              }`}
            >
              <Reply size={10} />
              Reply
            </button>

            {/* Show/hide replies */}
            {localReplies.length > 0 && (
              <button
                onClick={() => setShowReplies((p) => !p)}
                className="flex items-center gap-1 text-[10px] font-semibold text-indigo-400 hover:text-indigo-600 transition"
              >
                {showReplies ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                {showReplies
                  ? "Hide replies"
                  : `${localReplies.length} ${localReplies.length === 1 ? "reply" : "replies"}`}
              </button>
            )}

            {/* Delete comment (only owner) */}
            {isOwner && (
              <button
                onClick={() => onDelete(safe._id)}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-400 transition"
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>

          {/* Reply input */}
          {showReplyInput && (
            <div className="mt-2 ml-1">
              <CommentInput
                value={replyText}
                onChange={setReplyText}
                onSubmit={handleReplySubmit}
                placeholder={`Reply to ${safe.user?.name || "user"}...`}
                submitting={submitting}
                autoFocus
              />
            </div>
          )}

          {/* Replies list */}
          {showReplies &&
            localReplies.map((reply) => (
              <ReplyItem
                key={reply._id}
                reply={reply}
                postId={postId}
                commentId={safe._id}
                currentUserId={currentUserId}
                onDelete={handleDeleteReply}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Main CommentSection ───────────────────────────────────────────────────────
export default function CommentSection({ post, onCommentAdded }) {
  const { user } = useAuth();
  const [commentText, setCommentText]   = useState("");
  const [localComments, setLocalComments] = useState(
    (post.comments || []).map(normalize)
  );
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll]       = useState(false);

  const visibleComments = showAll ? localComments : localComments.slice(-3);

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/posts/${post._id}/comment`, { text: commentText.trim() });
      setLocalComments((prev) => [...prev, normalize(data.comment)]);
      setCommentText("");
      if (onCommentAdded) onCommentAdded(post._id, data.comment);
    } catch {
      toast.error("Comment failed!");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`/posts/${post._id}/comment/${commentId}`);
      setLocalComments((prev) => prev.filter((c) => c._id !== commentId));
      toast.success("Comment deleted!");
    } catch {
      toast.error("Delete failed!");
    }
  };

  return (
    <div className="px-4 pb-3 border-t border-gray-50 mt-2 pt-3 space-y-3">

      {/* Show more */}
      {localComments.length > 3 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-indigo-500 font-semibold hover:text-indigo-700 transition"
        >
          View all {localComments.length} comments
        </button>
      )}

      {/* Comments */}
      {visibleComments.map((comment) => (
        <CommentItem
          key={comment._id}
          comment={comment}
          postId={post._id}
          currentUserId={user._id}
          onDelete={handleDeleteComment}
        />
      ))}

      {/* Add comment */}
      <CommentInput
        value={commentText}
        onChange={setCommentText}
        onSubmit={handleAddComment}
        placeholder="Add a comment..."
        submitting={submitting}
        avatarSrc={user?.avatar}
        avatarName={user?.name}
      />
    </div>
  );
}