

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { Heart, MessageCircle, Bookmark, X, ArrowLeft } from "lucide-react";
import { fetchSavedPosts, unsavePost, likeSavedPost } from "../store/slices/Savedslice";
import { commentPost } from "../store/slices/Feedslice";

const Avatar = ({ src, name, size = "w-10 h-10", textSize = "text-sm" }) =>
  src ? (
    <img src={src} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
  ) : (
    <div className={`${size} rounded-full bg-linear-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold ${textSize} shrink-0`}>
      {name?.charAt(0).toUpperCase()}
    </div>
  );

export default function SavedPosts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { posts: savedPosts, loading } = useSelector((s) => s.saved);
  const [commentInputs, setCommentInputs] = useState({});
  const [showComments, setShowComments]   = useState({});
  const [unsavingId, setUnsavingId]       = useState(null);

  useEffect(() => { dispatch(fetchSavedPosts()); }, [dispatch]);

  const handleUnsave = async (postId) => {
    setUnsavingId(postId);
    const result = await dispatch(unsavePost(postId));
    if (unsavePost.fulfilled.match(result)) toast.success("Post unsaved!");
    else toast.error("Failed to unsave!");
    setUnsavingId(null);
  };

  const handleLike = async (postId) => {
    const result = await dispatch(likeSavedPost({ postId, userId: user._id }));
    if (likeSavedPost.rejected.match(result)) toast.error("Like failed!");
  };

  const handleComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    const result = await dispatch(commentPost({ postId, text }));
    if (commentPost.fulfilled.match(result))
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    else toast.error("Comment failed!");
  };

  return (
    <div className="flex gap-6 items-start w-full">

      {/* CENTER */}
      <div className="flex-1 min-w-0 pb-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate("/")}
            className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-gray-200 text-gray-400 hover:text-gray-700 transition">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Bookmark size={20} style={{ color: "#1e3a5f" }} fill="#1e3a5f" />
            <h1 className="text-base font-bold text-gray-800">Saved Posts</h1>
            {!loading && (
              <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {savedPosts.length}
              </span>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
                  <div className="space-y-1.5">
                    <div className="w-28 h-3 bg-gray-200 rounded" />
                    <div className="w-16 h-2.5 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="w-full h-48 bg-gray-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : savedPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-gray-100">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#eef2f7" }}>
              <Bookmark size={28} style={{ color: "#1e3a5f" }} />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">No saved posts</p>
            <p className="text-sm text-gray-400 mb-5">Tap the bookmark icon to save posts you like</p>
            <button onClick={() => navigate("/")}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
              style={{ background: "#1e3a5f" }}>
              View Feed
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {savedPosts.map((post) => (
              <div key={post._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar src={post.author?.avatar} name={post.author?.name} />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{post.author?.name}</p>
                      <p className="text-xs text-gray-500">{post.author?.designation?.trim() || "EroSocial Member"}</p>
                    </div>
                  </div>
                  <button onClick={() => handleUnsave(post._id)} disabled={unsavingId === post._id}
                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-red-50 hover:text-red-500 px-3 py-1.5 rounded-lg transition-all duration-200 disabled:opacity-50">
                    <Bookmark size={14} fill="currentColor" className={unsavingId === post._id ? "animate-pulse" : ""} />
                    {unsavingId === post._id ? "Removing..." : "Saved"}
                  </button>
                </div>

                {post.image && (
                  <img src={post.image} alt="post" className="w-full object-cover" style={{ maxHeight: "500px" }} />
                )}

                <div className="px-4 pt-3 flex items-center gap-4">
                  <button onClick={() => handleLike(post._id)}
                    className={`flex items-center gap-1.5 text-sm font-medium transition ${post.likes?.includes(user?._id) ? "text-red-500" : "text-gray-400 hover:text-red-400"}`}>
                    <Heart size={20} fill={post.likes?.includes(user?._id) ? "currentColor" : "none"} />
                    {post.likes?.length || 0}
                  </button>
                  <button onClick={() => setShowComments((prev) => ({ ...prev, [post._id]: !prev[post._id] }))}
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-indigo-500 transition">
                    <MessageCircle size={20} />
                    {post.comments?.length || 0}
                  </button>
                </div>

                {post.caption && (
                  <div className="px-4 py-2">
                    <span className="text-sm font-semibold text-gray-800 mr-2">{post.author?.name}</span>
                    <span className="text-sm text-gray-700">{post.caption}</span>
                  </div>
                )}

                {showComments[post._id] && (
                  <div className="px-4 pb-3 space-y-2 border-t border-gray-50 mt-2 pt-2">
                    {post.comments?.slice(-3).map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Avatar src={c.user?.avatar} name={c.user?.name} size="w-6 h-6" textSize="text-xs" />
                        <div>
                          <span className="text-xs font-semibold text-gray-800 mr-1">{c.user?.name}</span>
                          <span className="text-xs text-gray-600">{c.text}</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <input type="text"
                        value={commentInputs[post._id] || ""}
                        onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post._id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && handleComment(post._id)}
                        placeholder="Add a comment..."
                        className="flex-1 text-xs px-3 py-1.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      <button onClick={() => handleComment(post._id)}
                        className="text-xs text-indigo-600 font-medium hover:text-indigo-700 px-2">
                        Post
                      </button>
                    </div>
                  </div>
                )}

                <p className="px-4 pb-3 text-xs text-gray-400">
                  {new Date(post.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="hidden xl:block w-64 shrink-0">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bookmark size={16} style={{ color: "#1e3a5f" }} fill="#1e3a5f" />
            <p className="text-sm font-semibold text-gray-700">Your Collection</p>
          </div>
          <p className="text-2xl font-bold text-gray-800 mb-0.5">{savedPosts.length}</p>
          <p className="text-xs text-gray-400">posts saved by you</p>
          <div className="border-t border-gray-100 my-3" />
          <p className="text-xs text-gray-400 leading-relaxed">
            Save posts from your feed to revisit them anytime. Only you can see your saved posts.
          </p>
        </div>
      </div>

    </div>
  );
}