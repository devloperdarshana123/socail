

// import { useRef, useState } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import { X, Upload, Loader2, Type, Image } from "lucide-react";
// import { useDispatch } from "react-redux";
// import { createStory, createTextStory, fetchStoriesFeed } from "../lib/redux/storySlice";
// import { toast } from "react-hot-toast";
// const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
// const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// const BACKGROUNDS = [
//   "linear-gradient(135deg, #667eea, #764ba2)",
//   "linear-gradient(135deg, #f093fb, #f5576c)",
//   "linear-gradient(135deg, #4facfe, #00f2fe)",
//   "linear-gradient(135deg, #43e97b, #38f9d7)",
//   "linear-gradient(135deg, #fa709a, #fee140)",
//   "#1a1a2e",
// ];

// const TEXT_ALIGNS = ["left", "center", "right"];

// export default function StoryCreate({ onClose, onCreated }) {
//   const dispatch = useDispatch();
//   const fileRef = useRef(null);

//   const [tab, setTab] = useState("media");
//   const [uploading, setUploading] = useState(false);
//   const [progress, setProgress] = useState(0);

//   const [file, setFile] = useState(null);
//   const [preview, setPreview] = useState(null);
//   const [caption, setCaption] = useState("");

//   const [text, setText] = useState("");
//   const [background, setBackground] = useState(BACKGROUNDS[0]);
//   const [textAlign, setTextAlign] = useState("center");
//   const [textColor, setTextColor] = useState("#ffffff");

//   // const handleFile = (e) => {
//   //   const f = e.target.files?.[0];
//   //   if (!f) return;
//   //   setFile(f);
//   //   setPreview(URL.createObjectURL(f));
//   // };


//   const handleFile = (e) => {
//   const f = e.target.files?.[0];
//   if (!f) return;
//   setFile(f);
//   setPreview((prev) => {
//     if (prev) URL.revokeObjectURL(prev);
//     return URL.createObjectURL(f);
//   });
// };
//   const uploadToCloudinary = (f) =>
//     new Promise((resolve, reject) => {
//       const isVideo = f.type.startsWith("video/");
//       const fd = new FormData();
//       fd.append("file", f);
//       fd.append("upload_preset", UPLOAD_PRESET);

//       const xhr = new XMLHttpRequest();
//       xhr.upload.addEventListener("progress", (e) => {
//         if (e.lengthComputable)
//           setProgress(Math.round((e.loaded / e.total) * 100));
//       });
//       xhr.addEventListener("load", () => {
//         if (xhr.status >= 200 && xhr.status < 300) {
//           const r = JSON.parse(xhr.responseText);
//           resolve({
//             url: r.secure_url,
//             publicId: r.public_id,
//             resourceType: r.resource_type || (isVideo ? "video" : "image"),
//             width: r.width || null,
//             height: r.height || null,
//             duration: r.duration || null,
//             thumbnailUrl: r.eager?.[0]?.secure_url || null,
//           });
//         } else {
//           reject(new Error("Cloudinary upload failed"));
//         }
//       });
//       xhr.addEventListener("error", () => reject(new Error("Network error")));
//       xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`);
//       xhr.send(fd);
//     });

//   const handleMediaSubmit = async () => {
//     if (!file || uploading) return;
//     try {
//       setUploading(true);
//       setProgress(0);
//       const media = await uploadToCloudinary(file);
//       const result = await dispatch(createStory({ caption, media })).unwrap();
//       if (result) {
//         dispatch(fetchStoriesFeed());
//         onCreated?.(result);
//         onClose();
//       }
//     } catch (err) {
//       console.error("Media story upload failed:", err);
//       toast.error("Story upload failed. Please try again.");
//     } finally {
//       setUploading(false);
//       setProgress(0);
//     }
//   };

//   const handleTextSubmit = async () => {
//     if (!text.trim() || uploading) return;
//     try {
//       setUploading(true);
//       const result = await dispatch(
//         createTextStory({ text: text.trim(), background, textAlign, textColor })
//       ).unwrap();
//       if (result) {
//         dispatch(fetchStoriesFeed());
//         onCreated?.(result);
//         onClose();
//       }
//     } catch (err) {
//       console.error("Text story creation failed:", err);
//       toast.error("Failed to share story. Please try again.");
//     } finally {
//       setUploading(false);
//     }
//   };

//   const isMediaReady = !!file && !uploading;
//   const isTextReady = text.trim().length > 0 && !uploading;

//   return (
//     <AnimatePresence>
//       <motion.div
//         initial={{ opacity: 0 }}
//         animate={{ opacity: 1 }}
//         exit={{ opacity: 0 }}
//         className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
//         style={{ zIndex: 99999 }}
//         onClick={onClose}
//       >
//         <motion.div
//           initial={{ scale: 0.92, opacity: 0 }}
//           animate={{ scale: 1, opacity: 1 }}
//           exit={{ scale: 0.92, opacity: 0 }}
//           onClick={(e) => e.stopPropagation()}
//           className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm"
//         >
//           {/* Header */}
//           <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0e4d4]">
//             <p className="font-bold text-[#2d1f0f] text-base">Create Story</p>
//             <button
//               onClick={onClose}
//               className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5ece0]"
//             >
//               <X size={16} className="text-[#8b7355]" />
//             </button>
//           </div>

//           {/* Tab Switcher */}
//           <div className="flex gap-2 px-5 pt-4">
//             {["media", "text"].map((t) => (
//               <button
//                 key={t}
//                 onClick={() => setTab(t)}
//                 className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-sm font-semibold transition-all"
//                 style={{
//                   background: tab === t ? "#2d1f0f" : "#f5ece0",
//                   color: tab === t ? "#ffffff" : "#8b7355",
//                 }}
//               >
//                 {t === "media" ? <Image size={14} /> : <Type size={14} />}
//                 {t === "media" ? "Photo / Video" : "Text"}
//               </button>
//             ))}
//           </div>

//           {/* Media Pane */}
//           {tab === "media" && (
//             <>
//               <div
//                 onClick={() => !uploading && fileRef.current?.click()}
//                 className="relative mx-5 mt-4 rounded-xl overflow-hidden cursor-pointer bg-[#f5ece0] flex items-center justify-center"
//                 style={{ height: 300 }}
//               >
//                 {preview ? (
//                   file?.type.startsWith("video") ? (
//                     <video
//                       src={preview}
//                       className="w-full h-full object-cover"
//                       muted
//                       playsInline
//                     />
//                   ) : (
//                     <img
//                       src={preview}
//                       alt="story preview"
//                       className="w-full h-full object-cover"
//                     />
//                   )
//                 ) : (
//                   <div className="flex flex-col items-center gap-3 text-[#b0926a]">
//                     <Upload size={32} />
//                     <p className="text-sm font-medium">Tap to select photo or video</p>
//                     <p className="text-xs text-[#c09a6e]">Max 50MB video · 10MB image</p>
//                   </div>
//                 )}

//                 {uploading && (
//                   <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
//                     <Loader2 size={28} className="animate-spin text-white" />
//                     <p className="text-white text-sm font-semibold">{progress}%</p>
//                     <div className="w-40 h-1.5 bg-white/30 rounded-full overflow-hidden">
//                       <div
//                         className="h-full bg-white rounded-full transition-all"
//                         style={{ width: `${progress}%` }}
//                       />
//                     </div>
//                   </div>
//                 )}

//                 <input
//                   ref={fileRef}
//                   type="file"
//                   accept="image/*,video/*"
//                   className="hidden"
//                   onChange={handleFile}
//                 />
//               </div>

//               <div className="px-5 mt-3">
//                 <input
//                   type="text"
//                   value={caption}
//                   onChange={(e) => setCaption(e.target.value)}
//                   placeholder="Add a caption..."
//                   maxLength={200}
//                   disabled={uploading}
//                   className="w-full bg-[#f5ece0] rounded-full px-4 py-2.5 text-sm outline-none text-[#2d1f0f] placeholder:text-[#b0926a] focus:ring-1 focus:ring-[#c09a6e] disabled:opacity-50"
//                 />
//               </div>
//             </>
//           )}

//           {/* Text Pane */}
//           {tab === "text" && (
//             <div className="px-5 mt-4">
//               {/* Live Preview */}
//               <div
//                 className="rounded-xl flex items-center justify-center overflow-hidden"
//                 style={{ height: 200, background }}
//               >
//                 <p
//                   className="text-xl font-semibold px-5 break-words w-full"
//                   style={{ color: textColor, textAlign, maxWidth: "100%" }}
//                 >
//                   {text.trim() || "Your text here..."}
//                 </p>
//               </div>

//               {/* Text Input */}
//               <textarea
//                 value={text}
//                 onChange={(e) => setText(e.target.value)}
//                 placeholder="Write your story text..."
//                 maxLength={500}
//                 disabled={uploading}
//                 rows={3}
//                 className="w-full mt-3 bg-[#f5ece0] rounded-xl px-4 py-2.5 text-sm outline-none text-[#2d1f0f] placeholder:text-[#b0926a] resize-none focus:ring-1 focus:ring-[#c09a6e] disabled:opacity-50"
//               />
//               <p className="text-xs text-right text-[#c09a6e] mt-0.5">
//                 {text.length} / 500
//               </p>

//               {/* Background Picker */}
//               <p className="text-xs text-[#8b7355] mb-2 mt-2">Background</p>
//               <div className="flex gap-2 flex-wrap">
//                 {BACKGROUNDS.map((bg) => (
//                   <button
//                     key={bg}
//                     onClick={() => setBackground(bg)}
//                     className="w-8 h-8 rounded-full transition-transform hover:scale-110"
//                     style={{
//                       background: bg,
//                       outline: background === bg ? "2px solid #2d1f0f" : "none",
//                       outlineOffset: "2px",
//                     }}
//                   />
//                 ))}
//               </div>

//               {/* Text Align */}
//               <p className="text-xs text-[#8b7355] mb-2 mt-3">Alignment</p>
//               <div className="flex gap-2">
//                 {TEXT_ALIGNS.map((a) => (
//                   <button
//                     key={a}
//                     onClick={() => setTextAlign(a)}
//                     className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
//                     style={{
//                       background: textAlign === a ? "#2d1f0f" : "#f5ece0",
//                       color: textAlign === a ? "#ffffff" : "#8b7355",
//                     }}
//                   >
//                     {a}
//                   </button>
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Submit Button */}
//           <div className="px-5 py-5">
//             <button
//               onClick={tab === "media" ? handleMediaSubmit : handleTextSubmit}
//               disabled={tab === "media" ? !isMediaReady : !isTextReady}
//               className="w-full py-3 rounded-full text-sm font-bold text-white transition-all disabled:opacity-40"
//               style={{ background: "#2d1f0f" }}
//             >
//               {uploading ? (
//                 <span className="flex items-center justify-center gap-2">
//                   <Loader2 size={16} className="animate-spin" />
//                   {tab === "media" ? `Uploading... ${progress}%` : "Sharing..."}
//                 </span>
//               ) : (
//                 "Share Story"
//               )}
//             </button>
//           </div>
//         </motion.div>
//       </motion.div>
//     </AnimatePresence>
//   );
// }


import { useRef, useState } from "react";
import { X, Upload, Loader2, Type, Image } from "lucide-react";
import { useDispatch } from "react-redux";
import { createStory, createTextStory, fetchStoriesFeed } from "../lib/redux/storySlice";
import { toast } from "react-hot-toast";
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const BACKGROUNDS = [
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #4facfe, #00f2fe)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #fa709a, #fee140)",
  "#1a1a2e",
];

const TEXT_ALIGNS = ["left", "center", "right"];

export default function StoryCreate({ onClose, onCreated }) {
  const dispatch = useDispatch();
  const fileRef = useRef(null);

  const [tab, setTab] = useState("media");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState("");

  const [text, setText] = useState("");
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [textAlign, setTextAlign] = useState("center");
  const [textColor, setTextColor] = useState("#ffffff");

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    toast(`DEBUG: handleFile fired. file=${f ? f.name + " (" + f.type + ", " + Math.round(f.size/1024) + "KB)" : "NONE"}`);
    if (!f) return;
    setFile(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  };

  const uploadToCloudinary = (f) =>
    new Promise((resolve, reject) => {
      const isVideo = f.type.startsWith("video/");
      const fd = new FormData();
      fd.append("file", f);
      fd.append("upload_preset", UPLOAD_PRESET);

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable)
          setProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const r = JSON.parse(xhr.responseText);
          resolve({
            url: r.secure_url,
            publicId: r.public_id,
            resourceType: r.resource_type || (isVideo ? "video" : "image"),
            width: r.width || null,
            height: r.height || null,
            duration: r.duration || null,
            thumbnailUrl: r.eager?.[0]?.secure_url || null,
          });
        } else {
          reject(new Error("Cloudinary upload failed"));
        }
      });
      xhr.addEventListener("error", () => reject(new Error("Network error")));
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`);
      xhr.send(fd);
    });

  const handleMediaSubmit = async () => {
    if (!file || uploading) return;
    try {
      setUploading(true);
      setProgress(0);
      const media = await uploadToCloudinary(file);
      const result = await dispatch(createStory({ caption, media })).unwrap();
      if (result) {
        dispatch(fetchStoriesFeed());
        onCreated?.(result);
        onClose();
      }
    } catch (err) {
      console.error("Media story upload failed:", err);
      toast.error("Story upload failed. Please try again.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleTextSubmit = async () => {
    if (!text.trim() || uploading) return;
    try {
      setUploading(true);
      const result = await dispatch(
        createTextStory({ text: text.trim(), background, textAlign, textColor })
      ).unwrap();
      if (result) {
        dispatch(fetchStoriesFeed());
        onCreated?.(result);
        onClose();
      }
    } catch (err) {
      console.error("Text story creation failed:", err);
      toast.error("Failed to share story. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const isMediaReady = !!file && !uploading;
  const isTextReady = text.trim().length > 0 && !uploading;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 99999 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm"
      >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0e4d4]">
            <p className="font-bold text-[#2d1f0f] text-base">Create Story</p>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5ece0]"
            >
              <X size={16} className="text-[#8b7355]" />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-2 px-5 pt-4">
            {["media", "text"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: tab === t ? "#2d1f0f" : "#f5ece0",
                  color: tab === t ? "#ffffff" : "#8b7355",
                }}
              >
                {t === "media" ? <Image size={14} /> : <Type size={14} />}
                {t === "media" ? "Photo / Video" : "Text"}
              </button>
            ))}
          </div>

          {/* Media Pane */}
          {tab === "media" && (
            <>
              <label
                htmlFor="story-file-input"
                className="relative mx-5 mt-4 rounded-xl overflow-hidden cursor-pointer bg-[#f5ece0] flex items-center justify-center block"
                style={{ height: 300 }}
              >
                {preview ? (
                  file?.type.startsWith("video") ? (
                    <video
                      src={preview}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={preview}
                      alt="story preview"
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center gap-3 text-[#b0926a]">
                    <Upload size={32} />
                    <p className="text-sm font-medium">TEST123 - TAP HERE NEW VERSION</p>
                    <p className="text-xs text-[#c09a6e]">Max 50MB video · 10MB image</p>
                  </div>
                )}

                {uploading && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
                    <Loader2 size={28} className="animate-spin text-white" />
                    <p className="text-white text-sm font-semibold">{progress}%</p>
                    <div className="w-40 h-1.5 bg-white/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <input
                  id="story-file-input"
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    opacity: 0,
                  }}
                  onChange={handleFile}
                />
              </label>

              <div className="px-5 mt-3">
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption..."
                  maxLength={200}
                  disabled={uploading}
                  className="w-full bg-[#f5ece0] rounded-full px-4 py-2.5 text-sm outline-none text-[#2d1f0f] placeholder:text-[#b0926a] focus:ring-1 focus:ring-[#c09a6e] disabled:opacity-50"
                />
              </div>
            </>
          )}

          {/* Text Pane */}
          {tab === "text" && (
            <div className="px-5 mt-4">
              {/* Live Preview */}
              <div
                className="rounded-xl flex items-center justify-center overflow-hidden"
                style={{ height: 200, background }}
              >
                <p
                  className="text-xl font-semibold px-5 break-words w-full"
                  style={{ color: textColor, textAlign, maxWidth: "100%" }}
                >
                  {text.trim() || "Your text here..."}
                </p>
              </div>

              {/* Text Input */}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write your story text..."
                maxLength={500}
                disabled={uploading}
                rows={3}
                className="w-full mt-3 bg-[#f5ece0] rounded-xl px-4 py-2.5 text-sm outline-none text-[#2d1f0f] placeholder:text-[#b0926a] resize-none focus:ring-1 focus:ring-[#c09a6e] disabled:opacity-50"
              />
              <p className="text-xs text-right text-[#c09a6e] mt-0.5">
                {text.length} / 500
              </p>

              {/* Background Picker */}
              <p className="text-xs text-[#8b7355] mb-2 mt-2">Background</p>
              <div className="flex gap-2 flex-wrap">
                {BACKGROUNDS.map((bg) => (
                  <button
                    key={bg}
                    onClick={() => setBackground(bg)}
                    className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                    style={{
                      background: bg,
                      outline: background === bg ? "2px solid #2d1f0f" : "none",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>

              {/* Text Align */}
              <p className="text-xs text-[#8b7355] mb-2 mt-3">Alignment</p>
              <div className="flex gap-2">
                {TEXT_ALIGNS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setTextAlign(a)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                    style={{
                      background: textAlign === a ? "#2d1f0f" : "#f5ece0",
                      color: textAlign === a ? "#ffffff" : "#8b7355",
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="px-5 py-5">
            <button
              onClick={tab === "media" ? handleMediaSubmit : handleTextSubmit}
              disabled={tab === "media" ? !isMediaReady : !isTextReady}
              className="w-full py-3 rounded-full text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ background: "#2d1f0f" }}
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  {tab === "media" ? `Uploading... ${progress}%` : "Sharing..."}
                </span>
              ) : (
                "Share Story"
              )}
            </button>
          </div>
      </div>
    </div>
  );
}