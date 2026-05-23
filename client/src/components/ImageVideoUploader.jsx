// import { useState } from 'react';
// import axios from 'axios';

// const CLOUD_NAME = process.env.VITE_CLOUDINARY_CLOUD_NAME;
// const UPLOAD_PRESET = process.env.VITE_CLOUDINARY_UPLOAD_PRESET;                 // ← Same as you created in Cloudinary

// const ImageVideoUploader = ({ onUploadComplete }) => {
//   const [uploading, setUploading] = useState(false);
//   const [uploadedMedia, setUploadedMedia] = useState([]);

//   const handleFileSelect = async (e) => {
//     const files = Array.from(e.target.files);
//     if (files.length === 0) return;

//     setUploading(true);
//     const newUploaded = [];

//     for (let file of files) {
//       const formData = new FormData();
//       formData.append("file", file);
//       formData.append("upload_preset", UPLOAD_PRESET);

//       try {
//         const res = await axios.post(
//           `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`,
//           formData
//         );

//         newUploaded.push({
//           url: res.data.secure_url,
//           publicId: res.data.public_id,
//           resourceType: res.data.resource_type || (file.type.startsWith("video/") ? "video" : "image"),
//           width: res.data.width,
//           height: res.data.height,
//           duration: res.data.duration || null,
//           thumbnailUrl: res.data.eager?.[0]?.secure_url || null,
//           order: uploadedMedia.length + newUploaded.length,
//         });
//       } catch (error) {
//         console.error("Upload failed for", file.name, error);
//         alert(`Failed to upload ${file.name}`);
//       }
//     }

//     const allMedia = [...uploadedMedia, ...newUploaded];
//     setUploadedMedia(allMedia);
//     onUploadComplete(allMedia);        // Send data to parent (PostCreateModal)
//     setUploading(false);
//   };

//   return (
//     <div className="my-3">
//       <input
//         type="file"
//         multiple
//         accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
//         onChange={handleFileSelect}
//         disabled={uploading}
//         className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
//       />

//       {uploading && <p className="text-blue-600 mt-2">Uploading to Cloudinary...</p>}

//       {/* Preview */}
//       <div className="flex flex-wrap gap-3 mt-4">
//         {uploadedMedia.map((media, index) => (
//           <div key={index} className="relative">
//             {media.resourceType === "video" ? (
//               <video src={media.url} className="w-24 h-24 object-cover rounded-lg" controls />
//             ) : (
//               <img src={media.url} alt="preview" className="w-24 h-24 object-cover rounded-lg" />
//             )}
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// };


// export default ImageVideoUploader;




import { useState, useRef } from "react";
import { X, UploadCloud } from "lucide-react";

const CLOUD_NAME   = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET; // unsigned preset

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILES      = 10;

/**
 * Uploads directly to Cloudinary from the browser (unsigned preset).
 * Calls onUploadComplete(mediaItems[]) every time a new file finishes.
 *
 * Each mediaItem shape:
 * { url, publicId, resourceType, width, height, duration, thumbnailUrl, format, bytes, order }
 */
export default function ImageVideoUploader({ onUploadComplete, isDark = false }) {
  const [items,    setItems]    = useState([]); // uploaded items
  const [progress, setProgress] = useState({}); // { filename: 0-100 }
  const [errors,   setErrors]   = useState([]);
  const xhrsRef = useRef({});                   // track XHRs for abort

  const uploadFile = (file, order) =>
    new Promise((resolve, reject) => {
      const isVideo = file.type.startsWith("video/");

      // Size guard
      if (isVideo && file.size > MAX_VIDEO_SIZE)
        return reject(new Error(`${file.name} exceeds 100MB limit`));
      if (!isVideo && file.size > MAX_IMAGE_SIZE)
        return reject(new Error(`${file.name} exceeds 10MB limit`));

      const fd = new FormData();
      fd.append("file",           file);
      fd.append("upload_preset",  UPLOAD_PRESET);
      // Ask Cloudinary to auto-compress images
      if (!isVideo) {
        fd.append("quality",      "auto:good");
        fd.append("fetch_format", "auto");
      }

      const xhr = new XMLHttpRequest();
      xhrsRef.current[file.name] = xhr;

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setProgress((p) => ({ ...p, [file.name]: pct }));
        }
      });

      xhr.addEventListener("load", () => {
        delete xhrsRef.current[file.name];
        if (xhr.status >= 200 && xhr.status < 300) {
          const r = JSON.parse(xhr.responseText);
          resolve({
            url:          r.secure_url,
            publicId:     r.public_id,
            resourceType: r.resource_type || (isVideo ? "video" : "image"),
            width:        r.width        || null,
            height:       r.height       || null,
            duration:     r.duration     || null,
            thumbnailUrl: r.eager?.[0]?.secure_url || null,
            format:       r.format       || null,
            bytes:        r.bytes        || null,
            order,
          });
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      });

      xhr.addEventListener("error", () => {
        delete xhrsRef.current[file.name];
        reject(new Error(`Network error uploading ${file.name}`));
      });

      xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`);
      xhr.send(fd);
    });

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_FILES - items.length);
    if (!files.length) return;

    setErrors([]);
    const newErrors = [];

    for (const file of files) {
      setProgress((p) => ({ ...p, [file.name]: 0 }));
      try {
        const mediaItem = await uploadFile(file, items.length);
        setItems((prev) => {
          const next = [...prev, mediaItem];
          onUploadComplete(next);
          return next;
        });
      } catch (err) {
        newErrors.push(err.message);
      } finally {
        setProgress((p) => { const c = { ...p }; delete c[file.name]; return c; });
      }
    }

    if (newErrors.length) setErrors(newErrors);
    e.target.value = "";
  };

  const removeItem = (idx) => {
    // NOTE: publicId is stored — backend/cron can delete from Cloudinary if post never saved
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== idx).map((m, i) => ({ ...m, order: i }));
      onUploadComplete(next);
      return next;
    });
  };

  const uploading   = Object.keys(progress).length > 0;
  const uploadNames = Object.keys(progress);

  return (
    <div>
      {/* Drop zone / file picker */}
      <label
        style={{
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          justifyContent:"center",
          gap:           8,
          minHeight:     160,
          borderRadius:  16,
          border:        `2px dashed ${isDark ? "#374151" : "#e5e7eb"}`,
          cursor:        items.length >= MAX_FILES ? "not-allowed" : "pointer",
          opacity:       items.length >= MAX_FILES ? 0.5 : 1,
          transition:    "border-color .2s",
          padding:       "16px",
        }}
      >
        <UploadCloud size={28} color={isDark ? "#9ca3af" : "#6b7280"} />
        <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? "#f1f5f9" : "#111827" }}>
          {uploading ? "Uploading…" : "Click or drag files here"}
        </span>
        <span style={{ fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }}>
          Images (10MB) · Videos (100MB) · Up to {MAX_FILES} files
        </span>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
          disabled={items.length >= MAX_FILES || uploading}
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
      </label>

      {/* Progress bars */}
      {uploadNames.map((name) => (
        <div key={name} style={{ marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12,
                        color: isDark ? "#9ca3af" : "#6b7280", marginBottom: 3 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>
              {name}
            </span>
            <span>{progress[name]}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 4, background: isDark ? "#374151" : "#f1f5f9" }}>
            <div style={{
              height: "100%", borderRadius: 4,
              width: `${progress[name]}%`,
              background: "#1e3a5f",
              transition: "width .2s",
            }} />
          </div>
        </div>
      ))}

      {/* Error messages */}
      {errors.map((err, i) => (
        <div key={i} style={{
          marginTop: 8, padding: "8px 12px", borderRadius: 10,
          background: "#fef2f2", border: "1px solid #fecaca",
          color: "#dc2626", fontSize: 12,
        }}>
          ⚠️ {err}
        </div>
      ))}

      {/* Previews */}
      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {items.map((m, idx) => (
            <div key={idx} style={{ position: "relative", width: 72, height: 72, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
              {m.resourceType === "video"
                ? <video src={m.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                : <img    src={m.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
              }
              <button
                type="button"
                onClick={() => removeItem(idx)}
                style={{
                  position: "absolute", top: 2, right: 2,
                  width: 20, height: 20, borderRadius: "50%",
                  background: "rgba(0,0,0,0.65)", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={10} color="#fff" />
              </button>
              <div style={{
                position: "absolute", bottom: 2, left: 2,
                background: "rgba(0,0,0,0.5)", borderRadius: 4,
                color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 4px",
              }}>
                {idx + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}