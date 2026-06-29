

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EmojiPicker from "emoji-picker-react";
import { X, Trash2, Eye, Bookmark, Plus, Check } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  viewStory,
  reactToStory as reactToStoryThunk,
  toggleStoryLike,
  deleteStory,
  fetchStoryViewers,
  createHighlight,
  fetchMyHighlights,
  addToHighlight,
  optimisticLike,
} from "../lib/redux/storySlice";


const STORY_DURATION = 5000;
const QUICK_EMOJIS = ["❤️", "🔥", "😮", "😂", "😢", "👏", "😍", "🙌"];

export default function StoryViewer({ feed, startIndex = 0, onClose, onDelete }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
const currentUser = useSelector((s) => s.auth.user);
const {
  viewers: viewersMap,
  viewersLoading,
  highlights: reduxHighlights,
  highlightLoading,
} = useSelector((s) => s.stories);
  const [userIdx, setUserIdx]         = useState(startIndex);
  const [storyIdx, setStoryIdx]       = useState(0);
  const [paused, setPaused]           = useState(false);
  const [progress, setProgress]       = useState(0);
  const [showReact, setShowReact]     = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [myReaction, setMyReaction]   = useState(null);
const [liked,      setLiked]      = useState(false);
const [likesCount, setLikesCount] = useState(0);
  // Highlight states
  const [showHighlight, setShowHighlight]   = useState(false);
  const [newTitle, setNewTitle]             = useState("");
  const [creatingNew, setCreatingNew]       = useState(false);
  const [savedHighlights, setSavedHighlights] = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


  const timerRef   = useRef(null);
  const startRef   = useRef(null);
  const elapsedRef = useRef(0);
  const videoRef   = useRef(null);        
const durationRef = useRef(STORY_DURATION);

  const group  = feed[userIdx];
  const story  = group?.stories[storyIdx];
  const isOwn  = story?.author?.id === currentUser?.id ||
                 story?.author === currentUser?.id;
  const isVideo = story?.media?.resourceType === "video";

  const startTimer = (elapsed = 0) => {
  clearInterval(timerRef.current);
  const duration = durationRef.current;
  startRef.current = Date.now() - elapsed;
  timerRef.current = setInterval(() => {
    const spent = Date.now() - startRef.current;
    const pct   = Math.min((spent / duration) * 100, 100);
    setProgress(pct);
    if (spent >= duration) goNext();
  }, 50);
};
  const stopTimer = () => {
    clearInterval(timerRef.current);
    elapsedRef.current = Date.now() - (startRef.current || Date.now());
  };

 useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
    setMyReaction(null);
    setShowReact(false);
    setShowHighlight(false);
    setLiked(story?.isLiked ?? false);
    setLikesCount(story?.reactionsCount ?? 0);
    setShowViewers(false);

    // if (!isVideo) {
    //   durationRef.current = STORY_DURATION;
    //   startTimer(0);
    // }

    if (!isVideo && story.type === "text") {
  durationRef.current = STORY_DURATION;
  startTimer(0);
}

    if (story?.id) dispatch(viewStory(story.id));
    return () => clearInterval(timerRef.current);
  }, [userIdx, storyIdx]);

useEffect(() => {
  if (paused) {
    stopTimer();
    if (isVideo && videoRef.current) videoRef.current.pause();
  } else {
    if (isVideo && videoRef.current) {
      videoRef.current.play();
      startTimer(elapsedRef.current);
    } else if (story?.type === "text") {
      startTimer(elapsedRef.current);
    }
    
  }
}, [paused]);

useEffect(() => {
  const nextStory = group?.stories[storyIdx + 1] 
    || feed[userIdx + 1]?.stories[0];
  if (nextStory?.media?.url && nextStory.type !== "text") {
    const img = new Image();
    img.src = nextStory.media.url;
  }
}, [userIdx, storyIdx]);

  // ── Navigation ────────────────────────────────────────────
  const goNext = () => {
    const grp = feed[userIdx];
    if (storyIdx < grp.stories.length - 1) {
      setStoryIdx((i) => i + 1);
    } else if (userIdx < feed.length - 1) {
      setUserIdx((i) => i + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
    } else if (userIdx > 0) {
      setUserIdx((i) => i - 1);
      setStoryIdx(feed[userIdx - 1].stories.length - 1);
    }
  };

  // ── React ─────────────────────────────────────────────────
const handleReact = (emoji) => {
  setMyReaction(emoji);
  setShowReact(false);
  setPaused(false);
  dispatch(reactToStoryThunk({ storyId: story.id, reaction: emoji }));
};

// handleReact ke baad add karo:
const handleLike = () => {
  if (!story?.id) return;
  const newLiked = !liked;
  setLiked(newLiked);
  setLikesCount((c) => newLiked ? c + 1 : Math.max(0, c - 1));
  dispatch(optimisticLike({ storyId: story.id, liked: newLiked }));
  dispatch(toggleStoryLike(story.id)).then((res) => {
    if (toggleStoryLike.fulfilled.match(res)) {
      setLiked(res.payload.liked);
      setLikesCount(res.payload.reactionsCount);
    }
  });
};
  // ── Delete ────────────────────────────────────────────────
const handleDelete = async () => {
  setShowDeleteConfirm(false);
  const result = await dispatch(deleteStory(story.id));
  if (deleteStory.fulfilled.match(result)) {
    onDelete?.(story.id);
    const toast = document.createElement("div");
    toast.innerText = "✓ Story deleted";
    toast.style.cssText = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1D9E75;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;z-index:99999;pointer-events:none;";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
    goNext();
  }
};

  // ── Viewers ───────────────────────────────────────────────
  const handleViewers = () => {
  setPaused(true);
  setShowViewers(true);
  dispatch(fetchStoryViewers(story.id));
};

  // ── Highlight ─────────────────────────────────────────────
 const openHighlight = () => {
  setPaused(true);
  setShowHighlight(true);
  dispatch(fetchMyHighlights()).then((res) => {
    if (fetchMyHighlights.fulfilled.match(res)) {
      const saved = new Set(
        res.payload
          .filter((h) =>
            h.snapshots?.some(
              (s) => s.storyId?.toString() === story.id?.toString()
            )
          )
          .map((h) => h.id)
      );
      setSavedHighlights(saved);
    }
  });
};



const toggleHighlight = async (highlightId) => {
  const result = await dispatch(addToHighlight({ highlightId, storyId: story.id }));
  
  if (addToHighlight.rejected.match(result)) {
    // Story already kisi aur highlight mein hai
    const msg = result.payload || "Already added to another highlight";
    alert(msg); // ya apna toast use karo
    return;
  }

  if (addToHighlight.fulfilled.match(result)) {
    setSavedHighlights((prev) => {
      const next = new Set(prev);
      if (result.payload.removed) {
        next.delete(highlightId);
      } else {
        next.add(highlightId);
      }
      return next;
    });
  }
};


const createNewHighlight = async () => {
  if (!newTitle.trim()) return;
  const result = await dispatch(createHighlight({
    title:    newTitle.trim(),
    storyIds: [story.id],
  }));
  if (createHighlight.fulfilled.match(result)) {
    setSavedHighlights((prev) => new Set([...prev, result.payload.id]));
    setNewTitle("");
    setCreatingNew(false);
  } else {
    alert(result.payload || "Highlight with this title already exists");
  }
};

  if (!story) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black flex items-center justify-center"
        style={{ zIndex: 99999 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95 }} animate={{ scale: 1 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex items-center justify-center"
          style={{ width: "min(420px, 100vw)", height: "100vh" }}
        >
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-3">
            {group.stories.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-none"
                  style={{
                    width: i < storyIdx ? "100%"
                         : i === storyIdx ? `${progress}%`
                         : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-6 left-0 right-0 z-20 flex items-center justify-between px-4 pt-3">
            <div
    className="flex items-center gap-2.5 cursor-pointer"
    onClick={(e) => {
      e.stopPropagation();
      if (!story.author?.username) return;
      onClose?.();
      navigate(`/profile/${story.author.username}`);
    }}
  >
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shrink-0">
                {story.author?.avatar?.url ? (
                  <img src={story.author.avatar.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#c09a6e] flex items-center justify-center">
                    <span className="text-white text-sm font-bold">{story.author?.fullName?.[0]}</span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-none">{story.author?.fullName}</p>
                <p className="text-white/60 text-xs mt-0.5">@{story.author?.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
  {!isOwn && (
    <button
      onClick={(e) => { e.stopPropagation(); handleLike(); }}
      className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 transition-all"
      style={{ transform: liked ? "scale(1.08)" : "scale(1)" }}
    >
      <motion.span
        key={liked ? "liked" : "unliked"}
        initial={{ scale: 0.7 }} animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        style={{ fontSize: 16, lineHeight: 1 }}
      >
        {liked ? "❤️" : "🤍"}
      </motion.span>
      {likesCount > 0 && (
        <span className="text-white text-xs font-semibold">{likesCount}</span>
      )}
    </button>
  )}
  {isOwn && (
                <>
                  {/* Highlight button — sirf apni story pe */}
                  <button onClick={(e) => { e.stopPropagation(); openHighlight(); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white">
                    <Bookmark size={15} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleViewers(); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white">
                    <Eye size={15} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setPaused(true); setShowDeleteConfirm(true); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white">
                    <Trash2 size={15} />
                  </button>
                </>
              )}
              <button onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Media */}
  <div className="w-full h-full"
  onMouseDown={(e) => { e.stopPropagation(); setPaused(true); }}
  onMouseUp={(e) => { e.stopPropagation(); setPaused(false); }}
  onTouchStart={(e) => { e.stopPropagation(); setPaused(true); }}
  onTouchEnd={(e) => { e.stopPropagation(); setPaused(false); }}
>
  {story.type === "text" ? (
    <div key={story.id}
      className="w-full h-full flex items-center justify-center p-10"
      style={{ background: story.textContent?.background || "linear-gradient(135deg, #667eea, #764ba2)" }}>
      <p style={{
        color:      story.textContent?.textColor || "#fff",
        textAlign:  story.textContent?.textAlign || "center",
        fontSize:   (story.textContent?.text?.length || 0) > 80 ? 22
                  : (story.textContent?.text?.length || 0) > 40 ? 28 : 36,
        fontWeight: "700",
        textShadow: "0 2px 8px rgba(0,0,0,0.3)",
        lineHeight:  1.4,
        wordBreak:  "break-word",
      }}>
        {story.textContent?.text}
      </p>
    </div>
  ) : isVideo ? (
    <video
  key={story.id}
  ref={videoRef}
  src={story.media.url}
  autoPlay
  muted
  playsInline
  className="w-full h-full object-cover"
  onLoadedMetadata={() => {
    if (videoRef.current) {
      durationRef.current = videoRef.current.duration * 1000;
      if (!paused) startTimer(0);
    }
  }}
  onEnded={goNext}
  onError={goNext}
/>
  ) : (
    <img key={story.id} src={story.media.url}
      alt="" className="w-full h-full object-cover"
      loading="eager"
      fetchPriority="high"
      onLoad={() => { if (!paused) startTimer(0); }}
    />
  )}
</div>

          {/* Caption */}
          {story.caption && (
            <div className="absolute bottom-32 left-0 right-0 px-5 z-20">
              <p className="text-white text-sm font-medium text-center drop-shadow-lg">
                {story.caption}
              </p>
            </div>
          )}

          {/* ── Bottom bar — Instagram style ── */}
          <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-6 pt-10"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent)" }}>

            {/* Quick emoji reactions */}
            {!isOwn && (
              <div className="flex items-center justify-center gap-3 mb-3">
                {QUICK_EMOJIS.map((emoji) => (
                  <button key={emoji}
                    onClick={(e) => { e.stopPropagation(); handleReact(emoji); }}
                    style={{
                      fontSize: 24,
                      transition: "transform 0.15s",
                      transform: myReaction === emoji ? "scale(1.35)" : "scale(1)",
                      filter: myReaction === emoji ? "drop-shadow(0 0 6px white)" : "none",
                    }}>
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={(e) => { e.stopPropagation(); setPaused(true); setShowReact((v) => !v); }}
                  className="text-white/80 hover:text-white text-xl">
                  ➕
                </button>
              </div>
            )}
           
               
          </div>

          {/* Full Emoji Picker */}
          <AnimatePresence>
            {showReact && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-0 left-0 right-0 z-30"
                onClick={(e) => e.stopPropagation()}
              >
                <EmojiPicker
                  onEmojiClick={(emojiData) => { handleReact(emojiData.emoji); }}
                  skinTonesDisabled
                  height={380}
                  width="100%"
                  previewConfig={{ showPreview: false }}
                  theme="dark"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Highlight Panel ── */}
          <AnimatePresence>
            {showHighlight && (
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl"
                style={{ maxHeight: "70vh" }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 bg-gray-200 rounded-full" />
                </div>

                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                  <p className="font-bold text-[#2d1f0f] text-base">Add to Highlight</p>
                  <button onClick={() => { setShowHighlight(false); setPaused(false); }}>
                    <X size={18} className="text-[#8b7355]" />
                  </button>
                </div>

                <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: "calc(70vh - 80px)" }}>

                  {/* New highlight button */}
                  {!creatingNew ? (
                    <button
                      onClick={() => setCreatingNew(true)}
                      className="flex items-center gap-3 w-full mb-4 py-2 rounded-xl hover:bg-[#f5ece0] transition px-2"
                    >
                      <div className="w-14 h-14 rounded-full bg-[#f0e4d4] border-2 border-dashed border-[#c09a6e] flex items-center justify-center shrink-0">
                        <Plus size={20} className="text-[#c09a6e]" />
                      </div>
                      <p className="text-sm font-semibold text-[#2d1f0f]">New Highlight</p>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 mb-4">
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && createNewHighlight()}
                        placeholder="Highlight name..."
                        autoFocus
                        maxLength={30}
                        className="flex-1 bg-[#f5ece0] rounded-full px-4 py-2.5 text-sm outline-none text-[#2d1f0f] placeholder:text-[#b0926a] focus:ring-1 focus:ring-[#c09a6e]"
                      />
                      <button onClick={createNewHighlight}
                        className="w-10 h-10 rounded-full bg-[#2d1f0f] text-white flex items-center justify-center shrink-0">
                        <Check size={16} />
                      </button>
                      <button onClick={() => { setCreatingNew(false); setNewTitle(""); }}
                        className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {/* Existing highlights */}
                  {highlightLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="w-6 h-6 border-2 border-[#c09a6e] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : reduxHighlights.length === 0 ? (
                    <p className="text-center text-sm text-[#b0926a] py-6">No highlights yet</p>
                  ) : (
                    <div className="space-y-1">
                     {reduxHighlights.map((h) => {
                        const isSaved = savedHighlights.has(h.id);
                      const cover = h.coverImage || h.snapshots?.find(s => s.url)?.url || null;
                        return (
                          <button key={h.id}
                            onClick={() => toggleHighlight(h.id)}
                            className="flex items-center gap-3 w-full py-2 px-2 rounded-xl hover:bg-[#f5ece0] transition">
                            <div className="w-14 h-14 rounded-full overflow-hidden bg-[#e8d5be] shrink-0 border-2"
                              style={{ borderColor: isSaved ? "#2d1f0f" : "#e8d5be" }}>
                              {cover
                                ? <img src={cover} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full bg-gradient-to-br from-[#d4b896] to-[#c09a6e]" />
                              }
                            </div>
                            <p className="flex-1 text-sm font-semibold text-[#2d1f0f] text-left">{h.title}</p>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isSaved ? "bg-[#2d1f0f]" : "border-2 border-gray-300"}`}>
                              {isSaved && <Check size={12} className="text-white" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Viewers Panel ── */}
          <AnimatePresence>
            {showViewers && (
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl p-5"
                style={{ maxHeight: "60%" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-center mb-3">
                  <div className="w-10 h-1 bg-gray-200 rounded-full" />
                </div>
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-[#2d1f0f]">Viewers ({(viewersMap[story?.id]?.viewers || []).length})</p>
                  <button onClick={() => { setShowViewers(false); setPaused(false); }}>
                    <X size={18} className="text-[#8b7355]" />
                  </button>
                </div>
                <div className="overflow-y-auto space-y-3" style={{ maxHeight: "calc(60vh - 80px)" }}>
                  

                  {(viewersMap[story?.id]?.viewers || []).map((v, i) => (
  <div key={i} className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-full overflow-hidden bg-[#e8d5be] shrink-0">
      {v.viewer?.avatar?.url
        ? <img src={v.viewer.avatar.url} alt="" className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center bg-[#c09a6e]">
            <span className="text-white text-xs font-bold">{v.viewer?.fullName?.[0]}</span>
          </div>
      }
    </div>
    <div className="flex-1">
      <p className="text-sm font-semibold text-[#2d1f0f]">{v.viewer?.fullName}</p>
      <p className="text-xs text-[#8b7355]">@{v.viewer?.username}</p>
    </div>
    {v.reaction && <span className="text-lg">{v.reaction}</span>}
  </div>
))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {showDeleteConfirm && (
            <div className="absolute inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
              <div className="w-full bg-white rounded-t-3xl p-6">
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
                <p className="text-center font-bold text-[#2d1f0f] text-base mb-1">Delete Story?</p>
                <p className="text-center text-sm text-[#8b7355] mb-6">This story will be permanently deleted.</p>
                <button onClick={handleDelete} className="w-full py-3 rounded-2xl bg-red-500 text-white font-semibold text-sm mb-3">Delete</button>
                <button onClick={() => { setShowDeleteConfirm(false); setPaused(false); }} className="w-full py-3 rounded-2xl bg-gray-100 text-[#2d1f0f] font-semibold text-sm">Cancel</button>
              </div>
            </div>
          )}

          {/* Tap zones */}
          <div className="absolute inset-0 z-10 flex">
    <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); goPrev(); }} />
    <div className="w-2/3 h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); goNext(); }} />
  </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}