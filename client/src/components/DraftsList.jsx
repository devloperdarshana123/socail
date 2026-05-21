import { motion, AnimatePresence } from "framer-motion";
import { FileText, Send, Trash2, Pencil, Play, ImageIcon, Clock, Eye, Heart } from "lucide-react";
import { toast } from "react-hot-toast";
import { useState } from "react";

export default function DraftsList({ drafts, onPublish, onDelete, onEdit }) {
  const [deletingId, setDeletingId] = useState(null);
  const [publishingId, setPublishingId] = useState(null);

  if (!drafts || drafts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 gap-4"
      >
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-[#f0e4d4] to-[#e8d5be] flex items-center justify-center shadow-inner">
            <FileText size={32} className="text-[#c09a6e]" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#d4b896] flex items-center justify-center">
            <span className="text-white text-xs font-bold">0</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-[#2d1f0f]">No drafts saved</p>
          <p className="text-xs text-[#a08060] mt-1 max-w-50 leading-relaxed">
            Posts you save as draft will appear here for editing later
          </p>
        </div>
      </motion.div>
    );
  }

  const handleDelete = (postId) => {
    toast(
      (t) => (
        <div className="flex flex-col gap-3 min-w-55">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <Trash2 size={14} className="text-red-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#2d1f0f]">Delete draft?</p>
              <p className="text-xs text-[#8b7355]">This cannot be undone</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onDelete(postId);
                toast.dismiss(t.id);
                toast.success("Draft deleted", { icon: "🗑️" });
              }}
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#f0e4d4] text-[#5a3e2b] hover:bg-[#e8d5be] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ),
      { duration: 6000 }
    );
  };

  const handlePublish = async (postId) => {
    setPublishingId(postId);
    try {
      await onPublish(postId);
      toast.success("Post published! 🎉");
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 mb-8">
      {/* Header count */}
      <div className="flex items-center justify-between mb-1 px-1">
        <p className="text-xs font-semibold text-[#8b7355]">
          {drafts.length} draft{drafts.length > 1 ? "s" : ""} saved
        </p>
      </div>

      <AnimatePresence>
        {drafts.map((post, index) => {
          const imgSrc =
            post.type === "reel"
              ? post.media?.[0]?.thumbnailUrl || post.media?.[0]?.url
              : post.media?.[0]?.url;

          const isDeleting  = deletingId  === post._id;
          const isPublishing = publishingId === post._id;

          const typeIcon = post.type === "reel"
            ? <Play size={14} className="text-[#c09a6e]" />
            : post.type === "text"
            ? <FileText size={14} className="text-[#c09a6e]" />
            : <ImageIcon size={14} className="text-[#c09a6e]" />;

          const typeColor = {
            reel:  "bg-purple-50 text-purple-500 border-purple-100",
            text:  "bg-amber-50 text-amber-600 border-amber-100",
            image: "bg-blue-50 text-blue-500 border-blue-100",
          }[post.type] || "bg-[#f0e4d4] text-[#8b7355] border-[#e8d5be]";

          return (
            <motion.div
              key={post._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20, scale: 0.96 }}
              transition={{ delay: index * 0.05, duration: 0.25 }}
              className="bg-white rounded-2xl border border-[#ede0cf] shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
            >
              {/* Top section */}
              <div className="flex gap-3 p-3.5">
                {/* Thumbnail */}
                <div className="relative shrink-0">
                  <div className="w-18 h-18 rounded-xl overflow-hidden bg-linear-to-br from-[#f0e4d4] to-[#e8d5be] flex items-center justify-center">
                    {imgSrc ? (
                      <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                    ) : post.type === "reel" ? (
                      <Play size={22} className="text-[#c09a6e] fill-[#c09a6e]" />
                    ) : post.type === "text" ? (
                      <div className="w-full h-full p-2 flex items-start">
                        <p className="text-[8px] leading-tight text-[#5a3e2b] font-medium line-clamp-5 opacity-70">
                          {post.caption || "Text post"}
                        </p>
                      </div>
                    ) : (
                      <ImageIcon size={22} className="text-[#c09a6e]" />
                    )}
                  </div>
                  {/* Type badge overlay */}
                  {post.type === "reel" && imgSrc && (
                    <div className="absolute top-1.5 right-1.5 bg-black/50 rounded-full p-0.5">
                      <Play size={8} className="text-white fill-white" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    {/* Type + Date row */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeColor}`}>
                        {typeIcon}
                        {post.type}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-[#b0977a]">
                        <Clock size={9} />
                        {new Date(post.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>

                    {/* Caption */}
                    <p className="text-sm text-[#2d1f0f] font-semibold line-clamp-2 leading-snug">
                      {post.caption || (
                        <span className="text-[#b0977a] italic font-normal">No caption added</span>
                      )}
                    </p>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 mt-1.5">
                    {post.media?.length > 0 && (
                      <span className="text-[10px] text-[#a08060] flex items-center gap-1">
                        <ImageIcon size={9} />
                        {post.media.length} file{post.media.length > 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="text-[10px] text-[#a08060] flex items-center gap-1">
                      <Eye size={9} />
                      Draft
                    </span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-linear-to-r from-transparent via-[#ede0cf] to-transparent mx-3" />

              {/* Action Buttons */}
              <div className="grid grid-cols-3">
                <button
                  onClick={() => onEdit(post)}
                  className="flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-[#6b4f35] hover:bg-[#fdf6ef] active:bg-[#f5e8d8] transition-colors rounded-bl-2xl"
                >
                  <Pencil size={13} />
                  Edit
                </button>

                <div className="relative flex items-center justify-center">
                  <div className="absolute left-0 top-2 bottom-2 w-px bg-[#ede0cf]" />
                  <button
                    onClick={() => handlePublish(post._id)}
                    disabled={isPublishing}
                    className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-bold text-[#5a3e2b] hover:bg-[#fdf6ef] active:bg-[#f5e8d8] transition-colors disabled:opacity-60"
                  >
                    {isPublishing ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                        className="w-3.5 h-3.5 border-2 border-[#c09a6e] border-t-transparent rounded-full"
                      />
                    ) : (
                      <Send size={13} />
                    )}
                    {isPublishing ? "Publishing..." : "Publish"}
                  </button>
                  <div className="absolute right-0 top-2 bottom-2 w-px bg-[#ede0cf]" />
                </div>

                <button
                  onClick={() => handleDelete(post._id)}
                  disabled={isDeleting}
                  className="flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-red-400 hover:bg-red-50 active:bg-red-100 transition-colors rounded-br-2xl"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}