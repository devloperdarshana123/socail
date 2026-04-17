
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import {
  Heart, MessageCircle, Trash2, ShieldX,
  Plus, X, Grid, Users, Search, UserMinus
} from "lucide-react";

// ── Redux Actions ──────────────────────────────────────────
import {
  fetchMyPosts,
  fetchStats,
  fetchSuggestions,
  createPost,
  likePost,
  commentPost,
  deletePost,
  suspendPost,
} from "../store/slices/Feedslice";

import { toggleFollowRequest } from "../store/slices/Exploreslice";

import {
  fetchFollowers,
  fetchFollowing,
  toggleFollow,
} from "../store/slices/Profileslice";

export default function Profile() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { myPosts, stats, suggestions, creating } = useSelector((s) => s.feed);
  const loading = useSelector((s) => s.feed.myPostsLoading);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [postToDelete, setPostToDelete]       = useState(null);

  // ── Redux State ────────────────────────────────────────────
  const { pendingRequests } = useSelector((s) => s.explore);
  const { followers, following } = useSelector((s) => s.profile);

  // ── Local UI State ─────────────────────────────────────────
  const [commentInputs, setCommentInputs]   = useState({});
  const [showComments, setShowComments]     = useState({});
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [caption, setCaption]               = useState("");
  const [image, setImage]                   = useState(null);
  const [imagePreview, setImagePreview]     = useState(null);

  // ── Followers/Following Modal State ────────────────────────
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [activeTab, setActiveTab]             = useState("followers");
  const [searchQuery, setSearchQuery]         = useState("");
  const [unfollowingId, setUnfollowingId]     = useState(null);

  useEffect(() => {
    dispatch(fetchMyPosts());
    dispatch(fetchStats());
    dispatch(fetchSuggestions());
  }, [dispatch]);

  const openSocialModal = (tab) => {
    setActiveTab(tab);
    setSearchQuery("");
    setShowSocialModal(true);
    if (tab === "followers") {
      dispatch(fetchFollowers());
    } else {
      dispatch(fetchFollowing());
    }
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setSearchQuery("");
    if (tab === "followers") {
      dispatch(fetchFollowers());
    } else {
      dispatch(fetchFollowing());
    }
  };

  const currentList = activeTab === "followers" ? followers : following;
  const filteredList = currentList.filter((u) =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.designation?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUnfollow = async (userId) => {
    setUnfollowingId(userId);
    const result = await dispatch(toggleFollow({ userId, isPending: false, isUnfollow: true }));
    if (toggleFollow.fulfilled.match(result)) {
      toast.success("Unfollowed successfully!");
      dispatch(fetchFollowing());
      dispatch(fetchStats());
    } else {
      toast.error(result.payload || "Unfollow failed!");
    }
    setUnfollowingId(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) { setImage(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!caption && !image) { toast.error("Caption ya image daalo!"); return; }
    const result = await dispatch(createPost({ caption, image }));
    if (createPost.fulfilled.match(result)) {
      toast.success("Posted successfully! 🎉");
      setCaption(""); setImage(null); setImagePreview(null);
      setShowCreatePost(false);
      dispatch(fetchStats());
    } else {
      toast.error(result.payload || "Failed to create post!");
    }
  };

  const handleLike = async (postId) => {
    const result = await dispatch(likePost({ postId, userId: user._id }));
    if (likePost.rejected.match(result)) toast.error("Like nahi hua!");
  };

  const handleComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    const result = await dispatch(commentPost({ postId, text }));
    if (commentPost.fulfilled.match(result)) {
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    } else {
      toast.error("Couldn't post comment!");
    }
  };

  const handleDelete = async (postId) => {
    setPostToDelete(postId);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteModalOpen(false);
    const result = await dispatch(deletePost(postToDelete));
    if (deletePost.fulfilled.match(result)) {
      toast.success("Post deleted successfully!");
      dispatch(fetchStats());
    } else {
      toast.error("Failed to delete post!");
    }
    setPostToDelete(null);
  };

  const handleSuspend = async (postId) => {
    const result = await dispatch(suspendPost(postId));
    if (suspendPost.fulfilled.match(result)) {
      toast.success("Post suspended!");
    } else {
      toast.error("Failed to suspend post!");
    }
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

  const closeModal = () => {
    setShowCreatePost(false);
    setCaption("");
    setImage(null);
    setImagePreview(null);
  };

  return (
    <>
      <div className="flex gap-6 items-start w-full">

        {/* LEFT SIDEBAR */}
      <div className="hidden lg:block w-72 shrink-0 sticky top-0 self-start">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex flex-col items-center text-center mb-5">
              {user?.avatar ? (
                <img src={user.avatar} alt="avatar" className="w-20 h-20 rounded-full object-cover mb-3 shadow-md" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-linear-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold mb-3 shadow-md">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <h2 className="text-lg font-bold text-gray-800">{user?.name}</h2>
              <span className="text-sm font-medium mt-0.5 text-orange-500">
                {user?.designation?.trim() || "EroSocial Member"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="text-center p-2 bg-gray-50 rounded-xl">
                <div className="flex justify-center text-indigo-400 mb-1"><Grid size={14} /></div>
                <p className="text-lg font-bold text-gray-800">{stats.posts}</p>
                <p className="text-xs text-gray-400">Posts</p>
              </div>

              <button
                onClick={() => openSocialModal("followers")}
                className="text-center p-2 bg-gray-50 rounded-xl hover:bg-indigo-50 transition cursor-pointer group"
              >
                <div className="flex justify-center text-indigo-400 mb-1 group-hover:text-indigo-600 transition">
                  <Users size={14} />
                </div>
                <p className="text-lg font-bold text-gray-800">{stats.followers}</p>
                <p className="text-xs text-gray-400 group-hover:text-indigo-500 transition">Followers</p>
              </button>

              <button
                onClick={() => openSocialModal("following")}
                className="text-center p-2 bg-gray-50 rounded-xl hover:bg-indigo-50 transition cursor-pointer group"
              >
                <div className="flex justify-center text-indigo-400 mb-1 group-hover:text-indigo-600 transition">
                  <Users size={14} />
                </div>
                <p className="text-lg font-bold text-gray-800">{stats.following}</p>
                <p className="text-xs text-gray-400 group-hover:text-indigo-500 transition">Following</p>
              </button>
            </div>

            <button
              onClick={() => setShowCreatePost(true)}
              className="w-full py-2.5 rounded-full text-sm font-medium transition flex items-center justify-center gap-2 hover:opacity-90"
              style={{ background: "#c8956c", color: "#fff" }}
            >
              <Plus size={16} /> Create Post
            </button>

            {isAdmin && (
              <div className="mt-4 p-3 bg-purple-50 rounded-xl border border-purple-100">
                <p className="text-xs text-purple-600 font-medium text-center">
                  {user?.role === "super_admin" ? "👑 Super Admin Access" : "🛡️ Admin Access"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CENTER — My Posts */}
        <div className="flex-1 min-w-0 h-full overflow-y-auto pr-1 space-y-4 pb-6">

          {/* Mobile Profile Bar */}
          <div className="lg:hidden bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            {user?.avatar ? (
              <img src={user.avatar} alt="avatar" className="w-14 h-14 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-linear-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-800 truncate">{user?.name}</p>
              <span className="text-xs font-medium text-orange-500">
                {user?.designation?.trim() || "EroSocial Member"}
              </span>
            </div>
            <div className="flex gap-3 text-center shrink-0">
              <div>
                <p className="text-sm font-bold text-gray-800">{stats.posts}</p>
                <p className="text-xs text-gray-400">Posts</p>
              </div>
              <button onClick={() => openSocialModal("followers")} className="hover:opacity-70 transition">
                <p className="text-sm font-bold text-gray-800">{stats.followers}</p>
                <p className="text-xs text-indigo-500">Followers</p>
              </button>
              <button onClick={() => openSocialModal("following")} className="hover:opacity-70 transition">
                <p className="text-sm font-bold text-gray-800">{stats.following}</p>
                <p className="text-xs text-indigo-500">Following</p>
              </button>
            </div>
          </div>

          {/* My Posts Header */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Grid size={15} className="text-indigo-400" />
              <span className="text-sm font-semibold text-gray-700">My Posts</span>
            </div>
            <span className="text-xs text-gray-400">{myPosts.length} posts</span>
          </div>

          {/* Posts */}
          {loading ? (
            <div className="text-center py-16 text-gray-400">Loading...</div>
          ) : myPosts.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
              <p className="text-4xl mb-3">📸</p>
              <p className="text-lg font-medium">No posts yet!</p>
              <p className="text-sm mt-1">Create your first post 🎉</p>
              <button
                onClick={() => setShowCreatePost(true)}
                className="mt-4 px-5 py-2 rounded-full text-sm font-medium text-white transition hover:opacity-90"
                style={{ background: "#c8956c" }}
              >
                + Create Post
              </button>
            </div>
          ) : (
            myPosts.map((post) => (
              <div key={post._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    {user?.avatar ? (
                      <img src={user.avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {user?.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{user?.name}</p>
                      <p className="text-xs text-gray-500">
                        {user?.designation?.trim() || "EroSocial Member"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isAdmin && (
                      <button onClick={() => handleSuspend(post._id)}
                        className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition">
                        <ShieldX size={15} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(post._id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                      <Trash2 size={15} />
                    </button>
                  </div>
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
                    <span className="text-sm font-semibold text-gray-800 mr-2">{user?.name}</span>
                    <span className="text-sm text-gray-700">{post.caption}</span>
                  </div>
                )}

                {showComments[post._id] && (
                  <div className="px-4 pb-3 space-y-2 border-t border-gray-50 mt-2 pt-2">
                    {post.comments?.slice(-3).map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        {c.user?.avatar ? (
                          <img src={c.user.avatar} alt="avatar" className="w-6 h-6 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                            {c.user?.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
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
                        placeholder="Write a comment..."
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
            ))
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
                            background: ["#f0e8df","#fde8e8","#e8f5e9","#ede7f6","#fff8e1"][i % 5],
                            color:      ["#6b3f2a","#c0392b","#2e7d32","#6a1b9a","#f57f17"][i % 5],
                          }}>
                          {s.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-gray-800 leading-tight">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.designation?.trim() || "EroSocial Member"}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleFollow(s._id)}
                      className="text-xs font-semibold transition hover:opacity-70"
                      style={{ color: pendingRequests.includes(s._id) ? "#94a3b8" : "#c8956c" }}
                    >
                      {pendingRequests.includes(s._id) ? "Requested" : "Follow"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-2">
              <p className="text-xs text-gray-400 leading-relaxed">
                EroSocial · Erovians Community · Marbles, Tiles, Stones
              </p>
              <p className="text-xs text-gray-300 mt-2">© 2025 EroSocial</p>
            </div>
          </div>
        </div>

      </div>

      {/* ── Followers / Following Modal ──────────────────────────── */}
      {showSocialModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: "85vh" }}>

            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => handleTabSwitch("followers")}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                    activeTab === "followers"
                      ? "bg-white text-gray-800 shadow-sm"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Followers
                  <span className="ml-1.5 text-xs font-medium text-indigo-400">{stats.followers}</span>
                </button>
                <button
                  onClick={() => handleTabSwitch("following")}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                    activeTab === "following"
                      ? "bg-white text-gray-800 shadow-sm"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Following
                  <span className="ml-1.5 text-xs font-medium text-indigo-400">{stats.following}</span>
                </button>
              </div>
              <button
                onClick={() => setShowSocialModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-4 py-3 border-b border-gray-50 shrink-0">
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${activeTab}...`}
                  className="flex-1 text-sm bg-transparent focus:outline-none text-gray-700 placeholder-gray-400"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600 transition">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredList.length === 0 ? (
                <div className="text-center py-14 text-gray-400">
                  <p className="text-3xl mb-2">👥</p>
                  <p className="text-sm font-medium">
                    {searchQuery
                      ? "No results found"
                      : activeTab === "followers"
                      ? "No followers yet"
                      : "Not following anyone yet"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredList.map((u, i) => (
                    <div key={u._id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
                      <div className="flex items-center gap-3">
                        {u.avatar ? (
                          <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                            style={{
                              background: ["#f0e8df","#fde8e8","#e8f5e9","#ede7f6","#fff8e1"][i % 5],
                              color:      ["#6b3f2a","#c0392b","#2e7d32","#6a1b9a","#f57f17"][i % 5],
                            }}
                          >
                            {u.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-800 leading-tight">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.designation?.trim() || "EroSocial Member"}</p>
                          <p className="text-xs text-gray-300 mt-0.5">
                            {u.followers?.length || 0} followers
                          </p>
                        </div>
                      </div>

                      {activeTab === "following" && (
                        <button
                          onClick={() => handleUnfollow(u._id)}
                          disabled={unfollowingId === u._id}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40"
                        >
                          <UserMinus size={13} />
                          {unfollowingId === u._id ? "..." : "Unfollow"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">Create New Post</h2>
              <button onClick={closeModal}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreatePost}>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="avatar" className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-linear-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                      {user?.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{user?.name}</p>
                    <p className="text-xs text-gray-400">
                      {user?.designation?.trim() || "EroSocial Member"}
                    </p>
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
                  {creating ? "In Progress..." : "Post Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onConfirm={confirmDelete}
        onCancel={() => { setDeleteModalOpen(false); setPostToDelete(null); }}
      />
    </>
  );
}