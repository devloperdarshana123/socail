


import { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, MessageCircle, Plus, X, Grid,
  MapPin, Pencil, Camera, Play, Bookmark,
  Loader2, Send, UserPlus,
} from "lucide-react";
import {
  uploadAvatar,
  uploadCoverPhoto,
  removeAvatar,
  removeCoverPhoto,
} from "../lib/redux/userprofileslice";
import {
  fetchMyPosts,
  fetchSavedPosts,
  togglePostLike,
  toggleSavePost,
  fetchComments,
  addComment,
  initInteraction,
} from "../lib/redux/postSlice";

const MOCK_STORIES = [
  { _id: "s1", thumbnail: "https://picsum.photos/seed/1/100/100", seen: false },
  { _id: "s2", thumbnail: "https://picsum.photos/seed/2/100/100", seen: true },
  { _id: "s3", thumbnail: "https://picsum.photos/seed/3/100/100", seen: false },
];

export default function Profile() {
  const dispatch = useDispatch();

  const { avatar, coverPhoto, avatarLoading, coverLoading } = useSelector(
    (state) => state.userProfile
  );
  const { user } = useSelector((state) => state.auth);
  const { myPosts, myPostsLoading, savedPosts, savedPostsLoading, interactions } = useSelector(
    (state) => state.posts
  );

  const [activeTab, setActiveTab] = useState("posts");
  const [selectedPost, setSelectedPost] = useState(null);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [localAvatarPreview, setLocalAvatarPreview] = useState(null);
  const [localCoverPreview, setLocalCoverPreview] = useState(null);

  const avatarPreview = localAvatarPreview || avatar?.url || null;
  const coverPreview = localCoverPreview || coverPhoto?.url || null;

  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const commentInputRef = useRef(null);

  useEffect(() => {
    if (user?._id) dispatch(fetchMyPosts(user._id));
  }, [user?._id]);

  useEffect(() => {
    if (activeTab === "saved") dispatch(fetchSavedPosts(1));
  }, [activeTab]);

  useEffect(() => {
    if (avatar?.url) setLocalAvatarPreview(null);
  }, [avatar?.url]);

  useEffect(() => {
    if (coverPhoto?.url) setLocalCoverPreview(null);
  }, [coverPhoto?.url]);

  useEffect(() => {
    if (!selectedPost) return;
    const postId = selectedPost._id;
    dispatch(initInteraction({
      postId,
      likesCount: selectedPost.likesCount ?? 0,
      commentsCount: selectedPost.commentsCount ?? 0,
    }));
    dispatch(fetchComments({ postId }));
  }, [selectedPost?._id]);

  const interaction = selectedPost ? (interactions[selectedPost._id] || {}) : {};

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLocalAvatarPreview(URL.createObjectURL(file));
    dispatch(uploadAvatar(file));
  };

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLocalCoverPreview(URL.createObjectURL(file));
    dispatch(uploadCoverPhoto(file));
  };

  const handleRemoveAvatar = () => {
    setLocalAvatarPreview(null);
    dispatch(removeAvatar());
  };

  const handleRemoveCover = () => {
    setLocalCoverPreview(null);
    dispatch(removeCoverPhoto());
  };

  const handleLike = () => {
    if (!selectedPost) return;
    dispatch(togglePostLike(selectedPost._id));
  };

  const handleSave = () => {
    if (!selectedPost) return;
    dispatch(toggleSavePost(selectedPost._id));
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim() || !selectedPost) return;
    await dispatch(addComment({ postId: selectedPost._id, content: commentText.trim() }));
    setCommentText("");
  };

  const handleCommentKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCommentSubmit();
    }
  };

  const displayPosts = activeTab === "saved" ? savedPosts : myPosts;
  const isLoadingPosts = activeTab === "saved" ? savedPostsLoading : myPostsLoading;

  return (
    <div className="min-h-screen bg-[#faf6f0] pb-16">

      <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
      <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverChange} />

      {/* COVER PHOTO */}
      <div className="relative w-full h-40 md:h-52 overflow-hidden group">
        {coverPreview ? (
          <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#d4b896] via-[#c09a6e] to-[#8b6343]" />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300" />
        <button
          onClick={() => coverInputRef.current?.click()}
          disabled={coverLoading}
          className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 hover:bg-white text-[#5a3e2b] text-xs font-semibold px-3 py-1.5 rounded-full shadow-md transition-all duration-200 disabled:opacity-60"
        >
          {coverLoading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
          {coverLoading ? "Uploading..." : "Edit Cover"}
        </button>
      </div>

      {/* AVATAR + BUTTONS */}
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        <div className="flex items-end justify-between -mt-10 mb-4">

          <div className="relative group">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-[#faf6f0] shadow-xl overflow-hidden bg-[#e8d5be]">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#d4b896] to-[#c09a6e]">
                  <span className="text-3xl text-white font-bold">
                    {user?.fullName?.[0]?.toUpperCase() || "U"}
                  </span>
                </div>
              )}
            </div>
            <div
              className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center cursor-pointer"
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarLoading ? (
                <Loader2 size={20} className="text-white animate-spin" />
              ) : (
                <Camera size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              )}
            </div>
            {avatarPreview && !avatarLoading && (
              <button
                onClick={(e) => { e.stopPropagation(); handleRemoveAvatar(); }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 pb-1">
            <button className="flex items-center gap-1.5 bg-white hover:bg-[#f5ece0] border border-[#ddd0c0] text-[#5a3e2b] text-sm font-semibold px-4 py-2 rounded-full shadow-sm transition-all duration-200">
              <Pencil size={13} />
              Edit Profile
            </button>
          </div>
        </div>

        {/* Name + bio */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-[#2d1f0f]">{user?.fullName || user?.name}</h1>
          <p className="text-sm text-[#8b6343] font-medium">@{user?.username}</p>
          {user?.bio && <p className="text-sm text-[#4a3828] mt-1.5">{user?.bio}</p>}
          {user?.location && (
            <p className="flex items-center gap-1 text-xs text-[#8b7355] mt-1">
              <MapPin size={12} />
              {user?.location?.city ? `${user.location.city}, ${user.location.state}` : user?.location}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-3 mb-6">
          {[
            { label: "Posts", value: myPosts.length },
            { label: "Followers", value: user?.followersCount ?? user?.followers?.length ?? 0, onClick: () => setShowFollowersModal(true) },
            { label: "Following", value: user?.followingCount ?? user?.following?.length ?? 0 },
          ].map((stat) => (
            <button
              key={stat.label}
              onClick={stat.onClick}
              className="flex-1 bg-white rounded-2xl py-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-[#e8d5be]/60"
            >
              <p className="text-xl font-bold text-[#2d1f0f]">{stat.value?.toLocaleString()}</p>
              <p className="text-xs text-[#8b7355] font-medium">{stat.label}</p>
            </button>
          ))}
        </div>

        {/* Stories strip */}
        <div className="mb-6 overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex gap-3 w-max">
            <div className="flex flex-col items-center gap-1.5 cursor-pointer">
              <div className="relative w-16 h-16 rounded-full bg-white border-2 border-dashed border-[#c09a6e] flex items-center justify-center hover:bg-[#fdf3e7] transition-colors duration-200">
                <Plus size={20} className="text-[#c09a6e]" />
              </div>
              <span className="text-[10px] text-[#8b7355]">Your Story</span>
            </div>
            {MOCK_STORIES.map((story) => (
              <div key={story._id} className="flex flex-col items-center gap-1.5 cursor-pointer">
                <div className={`p-0.5 rounded-full ${story.seen ? "bg-gray-300" : "bg-gradient-to-br from-[#f5a623] via-[#e07b39] to-[#c05621]"}`}>
                  <div className="w-14 h-14 rounded-full border-2 border-[#faf6f0] overflow-hidden">
                    <img src={story.thumbnail} alt="" className="w-full h-full object-cover" />
                  </div>
                </div>
                <span className="text-[10px] text-[#8b7355]">Story</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#e0cbb8] mb-4">
          {[
            { id: "posts", icon: <Grid size={16} />, label: "Posts" },
            { id: "saved", icon: <Bookmark size={16} />, label: "Saved" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 transition-colors duration-200 ${activeTab === tab.id
                ? "border-[#5a3e2b] text-[#5a3e2b]"
                : "border-transparent text-[#a08060] hover:text-[#5a3e2b]"
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Post grid */}
        {isLoadingPosts ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-[#c09a6e]" />
          </div>
        ) : displayPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-full bg-[#f0e4d4] flex items-center justify-center">
              <Grid size={24} className="text-[#c09a6e]" />
            </div>
            <p className="text-sm font-semibold text-[#5a3e2b]">
              {activeTab === "saved" ? "No saved posts yet" : "No posts yet"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 mb-8">
            {displayPosts.map((post) => (
              <motion.div
                key={post._id}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelectedPost(post)}
                className="relative aspect-square rounded-lg overflow-hidden cursor-pointer bg-[#e8d5be] group"
              >
                <img
                  src={
                    post.type === "reel"
                      ? (post.media?.[0]?.thumbnailUrl || post.media?.[0]?.url)
                      : (post.media?.[0]?.url || post.thumbnail || post.image)
                  }
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {post.type === "reel" && (
                  <div className="absolute top-2 right-2 bg-black/40 rounded-full p-1">
                    <Play size={12} className="text-white fill-white" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100">
                  <span className="flex items-center gap-1 text-white text-sm font-bold">
                    <Heart size={16} className="fill-white" />
                    {post.likesCount ?? 0}
                  </span>
                  <span className="flex items-center gap-1 text-white text-sm font-bold">
                    <MessageCircle size={16} className="fill-white" />
                    {post.commentsCount ?? 0}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          POST DETAIL MODAL — Instagram Style
      ══════════════════════════════════════ */}
      <AnimatePresence>
        {selectedPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 md:p-4"
            onClick={() => setSelectedPost(null)}
          >
            <motion.div
              initial={{ scale: 0.93, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.93, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              // ✅ CHANGE 1: flex-row always, max-w-4xl, fixed height
              className="bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col md:flex-row w-full max-w-4xl"
              style={{ height: "min(95vh, 700px)", maxHeight: "95vh" }}
            >
              {/* ── LEFT: Square Image ── */}
              {/* ✅ CHANGE 2: fixed width 60%, no aspect-square */}
              <div
                className="relative bg-black flex-shrink-0 w-full md:w-[60%] h-[300px] md:h-auto"
              >
                {selectedPost.type === "reel" ? (
                  <video
                    src={selectedPost.media?.[0]?.url}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                    poster={selectedPost.media?.[0]?.thumbnailUrl}
                  />
                ) : (
                  <img
                    src={selectedPost.media?.[0]?.url || selectedPost.thumbnail || selectedPost.image}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
                {selectedPost.media?.length > 1 && (
                  <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                    1/{selectedPost.media.length}
                  </div>
                )}
                <button
                  onClick={() => setSelectedPost(null)}
                  className="absolute top-3 left-3 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors md:hidden"
                >
                  <X size={16} />
                </button>
              </div>

              {/* ── RIGHT: Info Panel ── */}
              <div className="flex flex-col flex-1 min-w-0 bg-white">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0e4d4] flex-shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-[#e8d5be] flex-shrink-0">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#d4b896] to-[#c09a6e]">
                          <span className="text-sm text-white font-bold">{user?.fullName?.[0] || "U"}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#2d1f0f] leading-tight">{user?.fullName || user?.name}</p>
                      <p className="text-xs text-[#8b7355]">@{user?.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPost(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5ece0] text-[#8b7355] transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Caption */}
                {selectedPost.caption && (
                  <div className="px-4 py-2.5 border-b border-[#f0e4d4] flex-shrink-0">
                    <p className="text-sm text-[#4a3828] leading-relaxed">{selectedPost.caption}</p>
                  </div>
                )}

                {/* Comments list */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
                  {interaction.commentsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 size={20} className="animate-spin text-[#c09a6e]" />
                    </div>
                  ) : interaction.comments?.length > 0 ? (
                    interaction.comments.map((c, i) => (
                      <div key={c._id || i} className="flex gap-2.5">
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-[#e8d5be] flex-shrink-0">
                          {(c.author?.avatar?.url || c.author?.avatar) ? (
                            <img src={c.author?.avatar?.url || c.author?.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#d4b896] to-[#c09a6e]">
                              <span className="text-xs text-white font-bold">
                                {c.author?.fullName?.[0] || c.author?.username?.[0] || "U"}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-[#2d1f0f]">
                            {c.author?.username || "user"}
                          </span>
                          <span className="text-xs text-[#4a3828]">{c.content || c.text}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#b0926a] text-center py-6">No comments yet. Be the first!</p>
                  )}
                </div>

                {/* Like / Save actions */}
                <div className="px-4 py-3 flex items-center gap-4 border-t border-[#f0e4d4] flex-shrink-0">
                  <button onClick={handleLike} className="flex items-center gap-1.5 text-sm font-semibold transition-colors">
                    <Heart
                      size={20}
                      className={interaction.liked
                        ? "fill-red-500 text-red-500 scale-110 transition-transform"
                        : "text-[#8b7355] hover:text-red-400"}
                    />
                    <span className={interaction.liked ? "text-red-500" : "text-[#4a3828]"}>
                      {interaction.likesCount ?? selectedPost.likesCount ?? 0}
                    </span>
                  </button>
                  <button
                    onClick={() => commentInputRef.current?.focus()}
                    className="flex items-center gap-1.5 text-sm font-semibold text-[#4a3828] hover:text-[#5a3e2b] transition-colors"
                  >
                    <MessageCircle size={20} className="text-[#8b6343]" />
                    <span>{interaction.commentsCount ?? selectedPost.commentsCount ?? 0}</span>
                  </button>
                  <button onClick={handleSave} className="ml-auto transition-colors">
                    <Bookmark
                      size={20}
                      className={interaction.saved
                        ? "fill-[#5a3e2b] text-[#5a3e2b]"
                        : "text-[#8b7355] hover:text-[#5a3e2b]"}
                    />
                  </button>
                </div>

                {/* Comment input */}
                <div className="px-4 py-3 border-t border-[#f0e4d4] flex items-center gap-2 flex-shrink-0">
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-[#e8d5be] flex-shrink-0">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#d4b896] to-[#c09a6e]">
                        <span className="text-xs text-white font-bold">{user?.fullName?.[0] || "U"}</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={commentInputRef}
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={handleCommentKeyDown}
                    placeholder="Add a comment..."
                    className="flex-1 text-sm bg-[#f5ece0] rounded-full px-4 py-2 outline-none placeholder:text-[#b0926a] text-[#2d1f0f] focus:ring-1 focus:ring-[#c09a6e]"
                  />
                  <button
                    onClick={handleCommentSubmit}
                    disabled={!commentText.trim() || interaction.commentAdding}
                    className="w-8 h-8 flex items-center justify-center bg-[#5a3e2b] hover:bg-[#4a3020] text-white rounded-full disabled:opacity-40 transition-all"
                  >
                    {interaction.commentAdding
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Send size={14} />
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOLLOWERS MODAL */}
      <AnimatePresence>
        {showFollowersModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center"
            onClick={() => setShowFollowersModal(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-sm shadow-2xl max-h-[70vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0e4d4]">
                <h2 className="text-base font-bold text-[#2d1f0f]">Followers</h2>
                <button
                  onClick={() => setShowFollowersModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5ece0] text-[#8b7355] transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-3 space-y-1">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-xl hover:bg-[#fdf3e7] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-[#e8d5be]">
                        <img src={`https://picsum.photos/seed/${i + 50}/100/100`} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#2d1f0f]">user_{i + 1}</p>
                        <p className="text-xs text-[#8b7355]">Follower</p>
                      </div>
                    </div>
                    <button className="flex items-center gap-1 text-xs bg-[#5a3e2b] hover:bg-[#4a3020] text-white px-3 py-1.5 rounded-full font-semibold transition-colors">
                      <UserPlus size={12} />
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}