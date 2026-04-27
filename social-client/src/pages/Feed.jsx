
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import CommentSection from"../components/CommentSectionV2";
import toast from "react-hot-toast";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import SharePostModal from "../components/Sharepostmodal";
import {
  Heart, MessageCircle, Trash2, Plus, X, Send, Bookmark, Share2
} from "lucide-react";

import {
  fetchFeed, fetchStats, fetchSuggestions, fetchSavedPostIds,
  createPost, likePost, commentPost, savePost, deletePost,
  toggleSavedLocal,
} from "../store/slices/Feedslice";

import {
  toggleFollowRequest, fetchFollowRequestCount, fetchSentFollowRequests,
} from "../store/slices/Exploreslice";

// ── Avatar Helper ─────────────────────────────────────────────────────────────
const Avatar = ({ src, name, size = "w-10 h-10", textSize = "text-sm" }) =>
  src ? (
    <img src={src} alt="avatar" className={`${size} rounded-full object-cover shrink-0`} />
  ) : (
    <div className={`${size} rounded-full flex items-center justify-center text-white font-bold ${textSize} shrink-0`}
      style={{ background: "linear-gradient(135deg, #c8956c, #a07050)" }}>
      {name?.charAt(0).toUpperCase()}
    </div>
  );

// ── Main Component ────────────────────────────────────────────────────────────
export default function Feed({ showCreatePost, setShowCreatePost }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const {
    posts, stats, suggestions, savedPostIds,
    hasNext, page, loading, creating,
  } = useSelector((s) => s.feed);

  const { pendingRequests } = useSelector((s) => s.explore);

  const [commentInputs, setCommentInputs]     = useState({});
  const [showComments, setShowComments]       = useState({});
  const [caption, setCaption]                 = useState("");
  const [image, setImage]                     = useState(null);
  const [imagePreview, setImagePreview]       = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [postToDelete, setPostToDelete]       = useState(null);
  const [sharePost, setSharePost]             = useState(null); // post to share

  const feedRef    = useRef(null);
  const loadingRef = useRef(false);
  const hasNextRef = useRef(false);
  const pageRef    = useRef(1);

  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { hasNextRef.current = hasNext; }, [hasNext]);
  useEffect(() => { pageRef.current = page; }, [page]);

  useEffect(() => {
    dispatch(fetchFeed({ page: 1 }));
    dispatch(fetchStats());
    dispatch(fetchSuggestions());
    dispatch(fetchSavedPostIds());
    dispatch(fetchFollowRequestCount());
    dispatch(fetchSentFollowRequests());
  }, [dispatch]);

  useEffect(() => {
    const container = feedRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 200 && hasNextRef.current && !loadingRef.current) {
        dispatch(fetchFeed({ page: pageRef.current + 1 }));
      }
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [dispatch]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) { setImage(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const closeModal = () => {
    setShowCreatePost(false);
    setCaption("");
    setImage(null);
    setImagePreview(null);
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!caption && !image) { toast.error("Add a caption or image!"); return; }
    const result = await dispatch(createPost({ caption, image }));
    if (createPost.fulfilled.match(result)) {
      toast.success("Post Created! 🎉");
      closeModal();
      dispatch(fetchStats());
    } else {
      toast.error(result.payload || "Post not created!");
    }
  };

  const handleLike = async (postId) => {
    const result = await dispatch(likePost({ postId, userId: user._id }));
    if (likePost.rejected.match(result)) toast.error("Like failed!");
  };

  const handleSave = async (postId) => {
    dispatch(toggleSavedLocal(postId));
    const result = await dispatch(savePost(postId));
    if (savePost.rejected.match(result)) {
      dispatch(toggleSavedLocal(postId));
      toast.error("Not saved!");
    } else {
      toast.success(savedPostIds.includes(postId) ? "Post unsaved!" : "Post saved! 🔖");
    }
  };

  const handleComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    const result = await dispatch(commentPost({ postId, text }));
    if (commentPost.fulfilled.match(result)) {
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    } else {
      toast.error("Comment failed!");
    }
  };

  const handleDelete = (postId) => {
    setPostToDelete(postId);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteModalOpen(false);
    const result = await dispatch(deletePost(postToDelete));
    if (deletePost.fulfilled.match(result)) {
      toast.success("Post deleted!");
      dispatch(fetchStats());
    } else {
      toast.error("Delete failed!");
    }
    setPostToDelete(null);
  };

  const handleFollow = async (userId) => {
    const isPending = pendingRequests.includes(userId);
    const result = await dispatch(toggleFollowRequest({ userId, isPending }));
    if (toggleFollowRequest.fulfilled.match(result)) {
      toast.success(isPending ? "Request canceled!" : "Follow request sent!");
    } else {
      toast.error(result.payload || "Request failed!");
    }
  };

  const handleMessage = (userId) => navigate(`/messages/${userId}`);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-6 items-start w-full">

      {/* CENTER FEED */}
      <div ref={feedRef} className="flex-1 min-w-0 space-y-4 pb-6">
        {loading && page === 1 ? (
          <div className="text-center py-16 text-gray-400">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <p className="text-4xl mb-3">📸</p>
            <p className="text-lg font-medium">No posts available right now!</p>
            <p className="text-sm mt-1">Follow people to see their posts, or explore!</p>
          </div>
        ) : (
          posts.map((post) => (
            <div key={post._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

              {/* Post Header */}
              <div className="flex items-center justify-between px-4 py-3">
               <div
  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
  onClick={() => navigate(`/user/${post.author?._id}`)}
>
  <Avatar src={post.author?.avatar} name={post.author?.name} />
  <div className="min-w-0">
    <p className="text-sm font-semibold text-gray-800 truncate hover:underline">{post.author?.name}</p>
    <p className="text-xs text-gray-500 truncate">{post.author?.designation?.trim() || "EroSocial Member"}</p>
  </div>
</div>
                <div className="flex items-center gap-1 shrink-0">
                  {post.author?._id !== user?._id && (
                    <button onClick={() => handleMessage(post.author?._id)}
                      title="Send Message"
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition">
                      <Send size={15} />
                    </button>
                  )}
                  {post.author?._id === user?._id && (
                    <button onClick={() => handleDelete(post._id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Post Image */}
              {post.image && (
                <img src={post.image} alt="post" className="w-full object-cover" style={{ maxHeight: "500px" }} />
              )}

              {/* Post Video */}
              {post.video && !post.image && (
                <video src={post.video} controls className="w-full object-cover" style={{ maxHeight: "500px" }} />
              )}

              {/* Actions */}
              <div className="px-4 pt-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
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
                  {/* ── SHARE BUTTON ── */}
                  <button
                    onClick={() => setSharePost(post)}
                    title="Share Post"
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-green-500 transition">
                    <Share2 size={20} />
                  </button>
                </div>
                <button onClick={() => handleSave(post._id)}
                  className={`p-1.5 rounded-lg transition-all duration-200 ${
                    savedPostIds.includes(post._id)
                      ? "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                      : "text-gray-400 hover:text-indigo-500 hover:bg-indigo-50"
                  }`}>
                  <Bookmark size={20} fill={savedPostIds.includes(post._id) ? "currentColor" : "none"} />
                </button>
              </div>

              {post.caption && (
                <div className="px-4 py-2">
                  <span className="text-sm font-semibold text-gray-800 mr-2">{post.author?.name}</span>
                  <span className="text-sm text-gray-700">{post.caption}</span>
                </div>
              )}

{showComments[post._id] && (
  <div style={{background: "red", padding: "10px"}}>
    <p>TEST</p>
    <CommentSection post={post} />
  </div>
)}

              <p className="px-4 pb-3 text-xs text-gray-400">
                {new Date(post.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>
          ))
        )}

        {hasNext && loading && (
          <div className="flex items-center justify-center py-6 gap-2 text-gray-400">
            <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            <span className="text-sm">Posts are loading...</span>
          </div>
        )}
        {!hasNext && posts.length > 0 && !loading && (
          <p className="text-center text-xs text-gray-300 py-6">You&apos;re all caught up 🎉</p>
        )}
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="hidden xl:block w-64 shrink-0">
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-sm font-semibold text-gray-500 mb-4">Suggestions For You</p>
            <div className="space-y-3">
              {suggestions.slice(0, 5).map((s, i) => (
                <div key={s._id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {s.avatar ? (
                      <img src={s.avatar} alt={s.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{
                          background: "linear-gradient(135deg, #c8956c, #a07050)",
                          color: "#ffffff",
                        }}>
                        {s.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-gray-800 leading-tight">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.designation?.trim() || "EroSocial Member"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleMessage(s._id)}
                      title="Send Message"
                      className="p-1 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition">
                      <Send size={13} />
                    </button>
                    <button onClick={() => handleFollow(s._id)}
                      className="text-xs font-semibold transition hover:opacity-70"
                      style={{ color: pendingRequests.includes(s._id) ? "#94a3b8" : "#c8956c" }}>
                      {pendingRequests.includes(s._id) ? "Requested" : "Follow"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="px-2">
            <p className="text-xs text-gray-400 leading-relaxed">EroSocial · Erovians Community · Marbles, Tiles, Stones</p>
            <p className="text-xs text-gray-300 mt-2">© 2025 EroSocial</p>
          </div>
        </div>
      </div>

      {/* CREATE POST MODAL */}
      {showCreatePost && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">Create New Post</h2>
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreatePost}>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar src={user?.avatar} name={user?.name} size="w-9 h-9" textSize="text-sm" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{user?.name}</p>
                    <p className="text-xs text-gray-400">{user?.designation?.trim() || "EroSocial Member"}</p>
                  </div>
                </div>
                <textarea value={caption} onChange={(e) => setCaption(e.target.value)}
                  placeholder="What are you thinking? Share it..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
                {imagePreview && (
                  <div className="relative rounded-xl overflow-hidden">
                    <img src={imagePreview} alt="preview" className="w-full object-cover max-h-60 rounded-xl" />
                    <button type="button" onClick={() => { setImage(null); setImagePreview(null); }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80">
                      <X size={14} />
                    </button>
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer text-sm text-indigo-600 font-medium hover:text-indigo-700">
                  <Plus size={16} />
                  <span>Add Image</span>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
              </div>
              <div className="px-5 pb-5 flex gap-3">
                <button type="button" onClick={closeModal}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-50">
                  {creating ? "In Progress..." : "Post Now 🚀"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHARE POST MODAL */}
      {sharePost && (
        <SharePostModal
          post={sharePost}
          onClose={() => setSharePost(null)}
        />
      )}

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onConfirm={confirmDelete}
        onCancel={() => { setDeleteModalOpen(false); setPostToDelete(null); }}
      />
    </div>
  );
}