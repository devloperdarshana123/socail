import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Loader2 } from "lucide-react";

import { useDispatch, useSelector } from "react-redux";
import { createStory, createTextStory, fetchStoriesFeed } from "../lib/redux/storySlice";
export default function StoryCreate({ onClose, onCreated }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const dispatch = useDispatch();
const { storyUploading: uploading } = useSelector((s) => s.stories);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

const handleSubmit = async () => {
    if (!file || uploading) return;
    try {
      const form = new FormData();
      form.append("media", file);
      form.append("caption", caption);
      const result = await dispatch(createStory(form)).unwrap();
      if (result) {
        dispatch(fetchStoriesFeed());
        onCreated?.(result);
        onClose();
      }
    } catch (err) {
      console.error("Story upload failed:", err);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
style={{ zIndex: 99999 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0e4d4]">
            <p className="font-bold text-[#2d1f0f] text-base">Create Story</p>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5ece0]">
              <X size={16} className="text-[#8b7355]" />
            </button>
          </div>

          {/* Preview */}
          <div
            onClick={() => fileRef.current?.click()}
            className="relative mx-5 mt-5 rounded-xl overflow-hidden cursor-pointer bg-[#f5ece0] flex items-center justify-center"
            style={{ height: 320 }}
          >
            {preview ? (
              file?.type.startsWith("video") ? (
                <video src={preview} className="w-full h-full object-cover" muted playsInline />
              ) : (
                <img src={preview} alt="" className="w-full h-full object-cover" />
              )
            ) : (
              <div className="flex flex-col items-center gap-3 text-[#b0926a]">
                <Upload size={32} />
                <p className="text-sm font-medium">Tap to select photo or video</p>
                <p className="text-xs text-[#c09a6e]">Max 15 seconds for video</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
          </div>

          {/* Caption */}
          <div className="px-5 mt-4">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption..."
              maxLength={200}
              className="w-full bg-[#f5ece0] rounded-full px-4 py-2.5 text-sm outline-none text-[#2d1f0f] placeholder:text-[#b0926a] focus:ring-1 focus:ring-[#c09a6e]"
            />
          </div>

          {/* Submit */}
          <div className="px-5 py-5">
            <button
              onClick={handleSubmit}
              disabled={!file || uploading}
              className="w-full py-3 rounded-full text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ background: "#2d1f0f" }}
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Uploading...
                </span>
              ) : "Share Story"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}