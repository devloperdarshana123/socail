import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {  X, Trash2 } from "lucide-react";

const DURATION = 5000;

export default function HighlightViewer({ highlight, onClose, onDelete, onRemoveSnap }) {
const [idx, setIdx]           = useState(0);
const [confirmDelete, setConfirmDelete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused]     = useState(false);
  const timerRef                = useRef(null);
  const startRef                = useRef(null);
  const elapsedRef              = useRef(0);

  const snapshots = highlight.snapshots || [];
  const snap      = snapshots[idx];

  const goNext = () => {
    if (idx < snapshots.length - 1) {
      setIdx((i) => i + 1);
      elapsedRef.current = 0;
      setProgress(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (idx > 0) {
      setIdx((i) => i - 1);
      elapsedRef.current = 0;
      setProgress(0);
    }
  };

  const startTimer = (elapsed = 0) => {
    clearInterval(timerRef.current);
    startRef.current = Date.now() - elapsed;
    timerRef.current = setInterval(() => {
      const spent = Date.now() - startRef.current;
      setProgress(Math.min((spent / DURATION) * 100, 100));
      if (spent >= DURATION) goNext();
    }, 50);
  };

  const stopTimer = () => {
    clearInterval(timerRef.current);
    elapsedRef.current = Date.now() - (startRef.current || Date.now());
  };

  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
    if (!paused) startTimer(0);
    return () => clearInterval(timerRef.current);
  }, [idx]);

  useEffect(() => {
    if (paused) stopTimer();
    else startTimer(elapsedRef.current);
  }, [paused]);

  if (!snapshots.length) return (
  <div className="fixed inset-0 bg-black flex items-center justify-center" 
    style={{ zIndex: 99999 }} onClick={onClose}>
    <div className="text-white text-center">
      <p className="text-lg font-semibold">No stories in this highlight</p>
      <button onClick={onClose} className="mt-4 px-4 py-2 bg-white/20 rounded-full text-sm">Close</button>
    </div>
  </div>
);
if (!snap) return null;

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
          className="relative"
          style={{ width: "min(420px, 100vw)", height: "100vh" }}
        >
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-3">
            {snapshots.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-none"
                  style={{
                    width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%"
                  }} />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-6 left-0 right-0 z-20 flex items-center justify-between px-4 pt-3">
<div className="flex items-center gap-2">
  {!confirmDelete ? (
    <button onClick={() => { setConfirmDelete(true); setPaused(true); }}
      className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white">
      <Trash2 size={15} />
    </button>
  ) : (
    <div className="flex flex-col gap-1.5 bg-black/70 rounded-2xl px-3 py-2">
      <span className="text-white text-xs font-semibold text-center">What do you want to delete?</span>
      <div className="flex gap-1.5">
        <button
          onClick={() => {
            onRemoveSnap?.(highlight._id, snap._id);
            if (snapshots.length <= 1) {
              onClose();
            } else {
              setIdx((i) => Math.max(0, i - 1));
              setConfirmDelete(false);
              setPaused(false);
            }
          }}
          className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 rounded-full font-semibold">
      This Story
        </button>
        <button
          onClick={() => { onDelete?.(highlight._id); onClose(); }}
          className="text-xs bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded-full font-semibold">
          Full Highlight
        </button>
        <button
          onClick={() => { setConfirmDelete(false); setPaused(false); }}
          className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-semibold">
          Cancel
        </button>
      </div>
    </div>
  )}
  <button onClick={onClose}
    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white">
    <X size={16} />
  </button>
</div>
          </div>

          {/* Content */}
          <div className="w-full h-full"
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
          >
            {snap.type === "text" ? (
              <div className="w-full h-full flex items-center justify-center p-10"
                style={{ background: snap.textContent?.background || "linear-gradient(135deg, #667eea, #764ba2)" }}>
                <p style={{
                  color:      snap.textContent?.textColor || "#fff",
                  textAlign:  snap.textContent?.textAlign || "center",
                  fontSize:   (snap.textContent?.text?.length || 0) > 80 ? 22
                            : (snap.textContent?.text?.length || 0) > 40 ? 28 : 36,
                  fontWeight: "700",
                  textShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  lineHeight:  1.4,
                  wordBreak:  "break-word",
                }}>
                  {snap.textContent?.text}
                </p>
              </div>
            ) : snap.type === "video" ? (
              <video src={snap.url} autoPlay muted playsInline
                className="w-full h-full object-cover" />
            ) : (
              <img src={snap.url} alt="" className="w-full h-full object-cover" />
            )}
          </div>

          {/* Tap zones */}
          <div className="absolute inset-0 z-10 flex">
            <div className="w-1/3 h-full cursor-pointer" onClick={goPrev} />
            <div className="w-2/3 h-full cursor-pointer" onClick={goNext} />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}