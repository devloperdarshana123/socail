import { useState } from "react";
import { X, Loader2, FileText, Play } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../lib/services/api";

export default function EditDraftModal({ post, onClose, onSaved }) {
  const [caption, setCaption] = useState(post.caption || "");
  const [loading, setLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);

  const imgSrc =
    post.type === "reel"
      ? post.media?.[0]?.thumbnailUrl || post.media?.[0]?.url
      : post.media?.[0]?.url;

  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      await api.patch(`/posts/${post._id}`, { caption, isDraft: true });
      toast.success("Draft updated! 📝");
      onSaved();
    } catch {
      toast.error("Draft save nahi ho saka.");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    setPublishLoading(true);
    try {
      // Caption update + publish ek saath
      await api.patch(`/posts/${post._id}`, { caption, isDraft: false });
      await api.patch(`/posts/${post._id}/publish`);
      toast.success("Post published! 🎉");
      onSaved();
    } catch {
      toast.error("Publish nahi ho saka.");
    } finally {
      setPublishLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0e4d4]">
          <h2 className="text-base font-bold text-[#2d1f0f]">Edit Draft</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5ece0] text-[#8b7355]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {/* Media preview */}
          {imgSrc ? (
            <div className="mb-4 rounded-xl overflow-hidden h-44 bg-[#f0e4d4]">
              <img src={imgSrc} alt="" className="w-full h-full object-cover" />
            </div>
          ) : post.type === "reel" ? (
            <div className="mb-4 h-44 rounded-xl bg-[#f0e4d4] flex items-center justify-center">
              <Play size={28} className="text-[#c09a6e]" />
            </div>
          ) : post.type === "text" ? (
            <div className="mb-4 h-20 rounded-xl bg-[#f5ece0] flex items-center justify-center">
              <FileText size={24} className="text-[#c09a6e]" />
            </div>
          ) : null}

          {/* Caption */}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write your caption..."
            rows={4}
            className="w-full border border-[#e0cbb8] rounded-xl px-4 py-3 text-sm text-[#2d1f0f] focus:outline-none focus:ring-2 focus:ring-[#c09a6e] resize-none"
          />

          {/* Meta */}
          <div className="flex items-center gap-2 mt-2 mb-5">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f0e4d4] text-[#8b7355]">
              {post.type}
            </span>
            {post.media?.length > 0 && (
              <span className="text-xs text-[#8b7355]">
                {post.media.length} media file{post.media.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={loading || publishLoading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#ddd0c0] text-[#5a3e2b] hover:bg-[#f5ece0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Save Draft
            </button>
            <button
              onClick={handlePublish}
              disabled={loading || publishLoading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#5a3e2b] hover:bg-[#4a3020] text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {publishLoading && <Loader2 size={14} className="animate-spin" />}
              Publish Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}