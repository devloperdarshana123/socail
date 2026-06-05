// import { useState } from "react";
// import { X, Loader2, FileText, Play } from "lucide-react";
// import { toast } from "react-hot-toast";
// import api from "../lib/services/api";

// export default function EditDraftModal({ post, onClose, onSaved }) {
//   const [caption, setCaption] = useState(post.caption || "");
//   const [loading, setLoading] = useState(false);
//   const [publishLoading, setPublishLoading] = useState(false);

//   const imgSrc =
//     post.type === "reel"
//       ? post.media?.[0]?.thumbnailUrl || post.media?.[0]?.url
//       : post.media?.[0]?.url;

//  // CORRECT — tell the parent to re-sync Redux after save
// const handleSaveDraft = async () => {
//   if (caption === post.caption) { onClose(); return; } // nothing changed
//   setLoading(true);
//   try {
//     await api.patch(`/posts/${post._id}`, { caption, isDraft: true });
//     toast.success("Draft updated! 📝");
//     onSaved({ type: "draft", postId: post._id, caption }); // pass update back
//   } catch {
//     toast.error("Some Error .");
//   } finally {
//     setLoading(false);
//   }
// };

//  // CORRECT — one call, one source of truth
// const handlePublish = async () => {
//   setPublishLoading(true);
//   try {
//     // First update caption if changed
//     if (caption !== post.caption) {
//       await api.patch(`/posts/${post._id}`, { caption, isDraft: true });
//     }
//     // Then publish via the dedicated endpoint
//     await api.patch(`/posts/${post._id}/publish`);
//     toast.success("Post published! 🎉");
//     onSaved({ type: "published", postId: post._id });
//   } catch {
//     toast.error("Some Error Occur.");
//   } finally {
//     setPublishLoading(false);
//   }
// };

//   return (
//     <div
//       className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center"
//       onClick={onClose}
//     >
//       <div
//         className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-lg shadow-2xl overflow-hidden"
//         onClick={(e) => e.stopPropagation()}
//       >
//         {/* Header */}
//         <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0e4d4]">
//           <h2 className="text-base font-bold text-[#2d1f0f]">Edit Draft</h2>
//           <button
//             onClick={onClose}
//             className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5ece0] text-[#8b7355]"
//           >
//             <X size={18} />
//           </button>
//         </div>

//         <div className="p-5">
//           {/* Media preview */}
//           {imgSrc ? (
//             <div className="mb-4 rounded-xl overflow-hidden h-44 bg-[#f0e4d4]">
//               <img src={imgSrc} alt="" className="w-full h-full object-cover" />
//             </div>
//           ) : post.type === "reel" ? (
//             <div className="mb-4 h-44 rounded-xl bg-[#f0e4d4] flex items-center justify-center">
//               <Play size={28} className="text-[#c09a6e]" />
//             </div>
//           ) : post.type === "text" ? (
//             <div className="mb-4 h-20 rounded-xl bg-[#f5ece0] flex items-center justify-center">
//               <FileText size={24} className="text-[#c09a6e]" />
//             </div>
//           ) : null}

//           {/* Caption */}
//           <textarea
//             value={caption}
//             onChange={(e) => setCaption(e.target.value)}
//             placeholder="Write your caption..."
//             rows={4}
//             className="w-full border border-[#e0cbb8] rounded-xl px-4 py-3 text-sm text-[#2d1f0f] focus:outline-none focus:ring-2 focus:ring-[#c09a6e] resize-none"
//           />

//           {/* Meta */}
//           <div className="flex items-center gap-2 mt-2 mb-5">
//             <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f0e4d4] text-[#8b7355]">
//               {post.type}
//             </span>
//             {post.media?.length > 0 && (
//               <span className="text-xs text-[#8b7355]">
//                 {post.media.length} media file{post.media.length > 1 ? "s" : ""}
//               </span>
//             )}
//           </div>

//           {/* Buttons */}
//           <div className="flex gap-3">
//             <button
//               onClick={handleSaveDraft}
//               disabled={loading || publishLoading}
//               className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#ddd0c0] text-[#5a3e2b] hover:bg-[#f5ece0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
//             >
//               {loading && <Loader2 size={14} className="animate-spin" />}
//               Save Draft
//             </button>
//             <button
//               onClick={handlePublish}
//               disabled={loading || publishLoading}
//               className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#5a3e2b] hover:bg-[#4a3020] text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
//             >
//               {publishLoading && <Loader2 size={14} className="animate-spin" />}
//               Publish Now
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }



import { useState, useRef } from "react";
import { X, Loader2, FileText, Play, Plus, Trash2, ImageIcon } from "lucide-react";
import { toast } from "react-hot-toast";
import { useDispatch } from "react-redux";
import { updateDraft, publishDraftPost } from "../lib/redux/postSlice";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const uploadToCloudinary = (file) =>
  new Promise((resolve, reject) => {
    const isVideo = file.type.startsWith("video/");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const r = JSON.parse(xhr.responseText);
        resolve({
          url:          r.secure_url,
          publicId:     r.public_id,
          resourceType: r.resource_type || (isVideo ? "video" : "image"),
          width:        r.width    || null,
          height:       r.height   || null,
          duration:     r.duration || null,
          thumbnailUrl: r.eager?.[0]?.secure_url || null,
          format:       r.format   || null,
          bytes:        r.bytes    || null,
        });
      } else {
        reject(new Error("Cloudinary upload failed"));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`);
    xhr.send(fd);
  });

export default function EditDraftModal({ post, onClose, onSaved }) {
  const dispatch = useDispatch();
  const fileRef = useRef(null);

  const [caption, setCaption] = useState(post.caption || "");
  const [mediaItems, setMediaItems] = useState(post.media || []);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);

  const isImage = post.type === "image";
  const isReel  = post.type === "reel";
  const isText  = post.type === "text";

  const canAddMore = isImage && mediaItems.length < 10;

  // ── File select & upload ──
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Reel: sirf 1 video
    if (isReel && files.length > 1) {
      toast.error("Reel mein sirf 1 video allowed hai");
      return;
    }

    // Image: max 10 total
    if (isImage && mediaItems.length + files.length > 10) {
      toast.error(`Sirf ${10 - mediaItems.length} aur images add ho sakti hain`);
      return;
    }

    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map(uploadToCloudinary));

      if (isReel) {
        // Replace existing
        setMediaItems(uploaded);
      } else {
        // Add to existing
        setMediaItems((prev) => [...prev, ...uploaded]);
      }
      toast.success("Media uploaded!");
    } catch {
      toast.error("Upload failed, try again");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // ── Remove single media item ──
  const handleRemove = (index) => {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Save Draft ──
  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      await dispatch(
        updateDraft({ postId: post._id, caption, media: mediaItems })
      ).unwrap();
      toast.success("Draft updated! 📝");
      onSaved({ type: "draft", postId: post._id, caption });
    } catch {
      toast.error("Save failed, try again");
    } finally {
      setLoading(false);
    }
  };

  // ── Publish ──
  const handlePublish = async () => {
    setPublishLoading(true);
    try {
      // Pehle latest changes save karo
      await dispatch(
        updateDraft({ postId: post._id, caption, media: mediaItems })
      ).unwrap();
      // Phir publish
      await dispatch(publishDraftPost(post._id)).unwrap();
      toast.success("Post published! 🎉");
      onSaved({ type: "published", postId: post._id });
    } catch {
      toast.error("Publish failed, try again");
    } finally {
      setPublishLoading(false);
    }
  };

  const isDisabled = uploading || loading || publishLoading;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0e4d4] sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-[#2d1f0f]">Edit Draft</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5ece0] text-[#8b7355]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">

          {/* ── TEXT post — no media section ── */}
          {isText && (
            <div className="mb-4 h-20 rounded-xl bg-[#f5ece0] flex items-center justify-center">
              <FileText size={24} className="text-[#c09a6e]" />
            </div>
          )}

          {/* ── REEL — single video replace ── */}
          {isReel && (
            <div className="mb-4">
              <div
                className="relative h-44 rounded-xl overflow-hidden bg-[#f0e4d4] flex items-center justify-center cursor-pointer group"
                onClick={() => !isDisabled && fileRef.current?.click()}
              >
                {mediaItems[0]?.thumbnailUrl || mediaItems[0]?.url ? (
                  <img
                    src={mediaItems[0].thumbnailUrl || mediaItems[0].url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Play size={28} className="text-[#c09a6e]" />
                )}
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {uploading ? (
                    <Loader2 size={20} className="animate-spin text-white" />
                  ) : (
                    <>
                      <Play size={16} className="text-white" />
                      <span className="text-white text-sm font-semibold">Replace Video</span>
                    </>
                  )}
                </div>
              </div>
              <p className="text-xs text-[#a08060] mt-1.5 text-center">
                Tap to replace video
              </p>
            </div>
          )}

          {/* ── IMAGE — multi image grid ── */}
          {isImage && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-[#8b7355]">
                  Media ({mediaItems.length}/10)
                </p>
                {canAddMore && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={isDisabled}
                    className="text-xs font-semibold text-[#5a3e2b] flex items-center gap-1 hover:text-[#2d1f0f] disabled:opacity-50"
                  >
                    <Plus size={12} />
                    Add More
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {mediaItems.map((item, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-[#f0e4d4]">
                    <img
                      src={item.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => handleRemove(idx)}
                      disabled={isDisabled}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors disabled:opacity-50"
                    >
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                ))}

                {/* Add more tile */}
                {canAddMore && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={isDisabled}
                    className="aspect-square rounded-xl border-2 border-dashed border-[#d4b896] flex flex-col items-center justify-center gap-1 hover:bg-[#f5ece0] transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 size={16} className="animate-spin text-[#c09a6e]" />
                    ) : (
                      <>
                        <Plus size={16} className="text-[#c09a6e]" />
                        <span className="text-[9px] text-[#c09a6e] font-semibold">Add</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept={isReel ? "video/*" : "image/*"}
            multiple={isImage}
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Caption */}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write your caption..."
            rows={4}
            disabled={isDisabled}
            className="w-full border border-[#e0cbb8] rounded-xl px-4 py-3 text-sm text-[#2d1f0f] focus:outline-none focus:ring-2 focus:ring-[#c09a6e] resize-none disabled:opacity-60"
          />

          {/* Meta */}
          <div className="flex items-center gap-2 mt-2 mb-5">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f0e4d4] text-[#8b7355]">
              {post.type}
            </span>
            {uploading && (
              <span className="text-xs text-[#a08060] flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" />
                Uploading...
              </span>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={isDisabled}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#ddd0c0] text-[#5a3e2b] hover:bg-[#f5ece0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Save Draft
            </button>
            <button
              onClick={handlePublish}
              disabled={isDisabled}
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