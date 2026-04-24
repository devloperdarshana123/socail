import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../context/AuthContext";
import { X, Camera, Send, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import { createPost, fetchStats } from "../store/slices/Feedslice";

const Avatar = ({ src, name, size = "w-10 h-10", text = "text-sm" }) =>
  src ? (
    <img src={src} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
  ) : (
    <div className={`${size} ${text} rounded-full shrink-0 flex items-center justify-center font-bold text-white`}
      style={{ background: "linear-gradient(135deg, #c8956c, #a07050)" }}>
      {name?.charAt(0).toUpperCase()}
    </div>
  );

export default function GlobalCreatePostModal({ onClose }) {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const { creating } = useSelector((s) => s.feed);

  const [caption, setCaption]         = useState("");
  const [image, setImage]             = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [video, setVideo]             = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [location, setLocation]       = useState("");
  const [locationLoading, setLocationLoading] = useState(false);

  const handleImageChange = (e) => {
    const f = e.target.files[0];
    if (f) { setImage(f); setImagePreview(URL.createObjectURL(f)); setVideo(null); setVideoPreview(null); }
  };

  const handleVideoChange = (e) => {
    const f = e.target.files[0];
    if (f) { setVideo(f); setVideoPreview(URL.createObjectURL(f)); setImage(null); setImagePreview(null); }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) { toast.error("GPS support not working!"); return; }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `${import.meta.env.VITE_SERVER}/location/reverse?lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          setLocation(data.location || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch {
          setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        setLocationLoading(false);
      },
      () => { toast.error("Location nahi mili!"); setLocationLoading(false); }
    );
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!caption && !image && !video) { toast.error("Caption or media add here !"); return; }
    const res = await dispatch(createPost({ caption, image, video }));
    if (createPost.fulfilled.match(res)) {
      toast.success("Post Created! 🎉");
      dispatch(fetchStats());
      onClose();
    } else {
      toast.error(res.payload || "Post not created!");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <Avatar src={user?.avatar} name={user?.name} size="w-9 h-9" text="text-sm" />
            <div>
              <p className="text-sm font-semibold text-stone-800">{user?.name}</p>
              <p className="text-xs text-stone-400">{user?.designation?.trim() || "EroSocial Member"}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full border border-stone-200 bg-stone-50 flex items-center justify-center text-stone-400 hover:bg-stone-100 transition">
            <X size={15} />
          </button>
        </div>

        <div className="flex">

          {/* LEFT: Media Preview */}
          <div className="w-[48%] bg-stone-50 border-r border-stone-100 flex flex-col items-center justify-center min-h-[300px] gap-4 p-6 relative">
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="preview" className="w-full h-[280px] object-cover rounded-xl" />
                <button onClick={() => { setImage(null); setImagePreview(null); }}
                  className="absolute top-3 right-3 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition">
                  <X size={13} />
                </button>
              </>
            ) : videoPreview ? (
              <>
                <video src={videoPreview} controls className="w-full max-h-[280px] rounded-xl object-cover" />
                <button onClick={() => { setVideo(null); setVideoPreview(null); }}
                  className="absolute top-3 right-3 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition">
                  <X size={13} />
                </button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center">
                  <Camera size={24} className="text-stone-400" strokeWidth={1.4} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-stone-600 mb-0.5">Upload media</p>
                  <p className="text-xs text-stone-400">Photo or video</p>
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-stone-200 text-xs font-semibold text-stone-600 cursor-pointer bg-white hover:bg-stone-50 transition">
                    📷 Image
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                  <label className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-stone-200 text-xs font-semibold text-stone-600 cursor-pointer bg-white hover:bg-stone-50 transition">
                    🎬 Video
                    <input type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
                  </label>
                </div>
              </>
            )}
          </div>

          {/* RIGHT: Form */}
          <div className="w-[52%] flex flex-col p-5 gap-4">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What's on your mind? Share something with your community..."
              rows={6}
              className="w-full px-4 py-3 text-sm border border-stone-200 rounded-2xl bg-stone-50 outline-none focus:ring-2 focus:ring-amber-300 focus:bg-white resize-none transition leading-relaxed"
            />

            {/* Location */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1 px-3 py-2.5 bg-stone-50 rounded-xl border border-stone-100">
                  <MapPin size={14} className="text-stone-400 shrink-0" />
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Add location..."
                    className="flex-1 text-xs bg-transparent outline-none text-stone-600 placeholder-stone-400"
                  />
                </div>
                <button
                  onClick={handleGetLocation}
                  disabled={locationLoading}
                  className="px-3 py-2.5 text-xs font-semibold rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition disabled:opacity-50 shrink-0"
                >
                  {locationLoading ? "..." : "📍 GPS"}
                </button>
              </div>
              {location && (
                <p className="text-xs text-amber-600 px-1 truncate">📍 {location}</p>
              )}
            </div>

            {/* Change media */}
            {(imagePreview || videoPreview) && (
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 cursor-pointer hover:text-amber-700 transition">
                  <Camera size={13} /> Change Image
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
                <span className="text-stone-200">|</span>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 cursor-pointer hover:text-amber-700 transition">
                  🎬 Change Video
                  <input type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
                </label>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2 mt-auto pt-2">
              <button onClick={onClose}
                className="flex-1 py-2.5 text-sm border border-stone-200 rounded-full text-stone-500 hover:bg-stone-50 transition font-medium">
                Cancel
              </button>
              <button onClick={handleCreatePost} disabled={creating}
                className="flex-[2] py-2.5 text-sm font-semibold text-white rounded-full transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #c8956c, #b07848)" }}>
                <Send size={14} />
                {creating ? "Posting..." : "Post Now"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}