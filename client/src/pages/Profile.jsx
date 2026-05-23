


import { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion , AnimatePresence} from "framer-motion";
import DraftsList from "../components/DraftsList";
import EditDraftModal from "../components/EditDraftModal";
import { createPortal } from "react-dom";
import { resolvePostThumb , isVideoMedia } from "../utils/mediaUtils";
import {
  Plus, X, Grid,
  MapPin, Pencil, Camera, Play, Bookmark,
  Loader2, Heart, MessageCircle, FileText,
  MoreHorizontal, Trash2,
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
  fetchComments,
  initInteraction,
   fetchDraftPosts, publishDraftPost, deletePost ,   recordPostView,
} from "../lib/redux/postSlice";

import PostModal from "../components/PostModal";
import FollowListModal from "../components/FollowListModal";
import HighlightViewer from "../components/HighlightViewer";
import StoryCreate from "../components/StoryCreate";
import { fetchMyHighlights, deleteHighlight ,fetchStoriesFeed , removeSnapFromHighlight } from "../lib/redux/storySlice";



function PostGridMenu({ onDelete }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="absolute top-1.5 right-1.5 z-20 w-7 h-7 rounded-full bg-black/50
          backdrop-blur-sm flex items-center justify-center
          opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreHorizontal size={14} className="text-white" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          />
          <div
            className="absolute top-8 right-1.5 z-40 bg-white rounded-xl shadow-xl
              border border-[#e8d5be] overflow-hidden min-w-32.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setOpen(false); setConfirm(true); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs
                font-semibold text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
              Delete Post
            </button>
          </div>
        </>
      )}

      {confirm && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm
            flex items-center justify-center p-4"
          onClick={() => setConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <p className="text-sm font-bold text-[#2d1f0f] mb-2">Delete this post?</p>
            <p className="text-xs text-[#8b7355] mb-5 leading-relaxed">
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#ddd0c0] text-sm
                  font-semibold text-[#5a3e2b] hover:bg-[#f5ece0] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { onDelete(); setConfirm(false); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600
                  text-sm font-semibold text-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default function Profile() {
  const dispatch = useDispatch();

  const { avatar, coverPhoto, avatarLoading, coverLoading } = useSelector(
    (state) => state.userProfile
  );

  const { myPosts, myPostsLoading, savedPosts, savedPostsLoading, draftPosts, draftPostsLoading } = useSelector((state) => state.posts);
  const { user } = useSelector((state) => state.auth);
 
  const { highlights, highlightLoading } = useSelector((state) => state.stories);

  const [activeTab, setActiveTab] = useState(() => {
  return localStorage.getItem("profile_active_tab") || "posts";
});
  const [selectedPost, setSelectedPost] = useState(null);


  const [followModal, setFollowModal] = useState(null); 
  const [localAvatarPreview, setLocalAvatarPreview] = useState(null);
  const [localCoverPreview, setLocalCoverPreview] = useState(null);
  const [selectedHighlight, setSelectedHighlight] = useState(null);
  const [editingDraft, setEditingDraft] = useState(null);
const [showStoryCreate, setShowStoryCreate] = useState(false);
const avatarPreview = localAvatarPreview || avatar?.url || user?.avatar?.url || null;
const coverPreview = localCoverPreview || coverPhoto?.url || user?.coverPhoto?.url || null;

  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const viewedPosts = useRef(new Set());
 
  useEffect(() => {
    if (user?._id) dispatch(fetchMyPosts(user._id));
  }, [user?._id]);

  useEffect(() => {
    dispatch(fetchMyHighlights());
  }, []);


useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get("post");
  if (!postId) return;

  // Pehle myPosts mein dhundho
  const found = myPosts.find((p) => p._id === postId);
  if (found) { setSelectedPost(found); return; }

  // Nahi mila toh savedPosts fetch karke dhundho
  if (savedPosts.length > 0) {
    const foundInSaved = savedPosts.find((p) => p._id === postId);
    if (foundInSaved) { setSelectedPost(foundInSaved); return; }
  } else {
    dispatch(fetchSavedPosts(1));
  }
}, [myPosts, savedPosts]);

  useEffect(() => {
  if (activeTab === "drafts") dispatch(fetchDraftPosts());
}, [activeTab]);
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

  // Sirf ek baar view count karo
  if (!viewedPosts.current.has(postId)) {
    viewedPosts.current.add(postId);
    dispatch(recordPostView(postId));
  }
}, [selectedPost?._id]);


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



const displayPosts = activeTab === "saved" ? savedPosts : activeTab === "drafts" ? draftPosts : myPosts;
const isLoadingPosts = activeTab === "saved" ? savedPostsLoading : activeTab === "drafts" ? draftPostsLoading : myPostsLoading;

  return (
    <div className="min-h-screen bg-[#faf6f0] pb-16">
      <style>{`
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .tab-content { animation: fadeIn 0.25s ease forwards; }
`}</style>

      <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
      <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverChange} />

      {/* COVER PHOTO */}
      <div className="relative w-full h-40 md:h-52 overflow-hidden group">
        {coverPreview ? (
          <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-linear-to-br from-[#d4b896] via-[#c09a6e] to-[#8b6343]" />
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
                <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-[#d4b896] to-[#c09a6e]">
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
         {user?.location?.city || user?.location?.state || user?.location?.country ? (
  <p className="flex items-center gap-1 text-xs text-[#8b7355] mt-1">
    <MapPin size={12} />
    {[user.location.city, user.location.state, user.location.country]
      .filter(Boolean)
      .join(", ")}
  </p>
) : null}
        </div>

        {/* Stats */}
        <div className="flex gap-3 mb-6">
          {[
            { label: "Posts", value: myPosts.length },
            { label: "Followers", value: user?.followersCount ?? 0, onClick: () => setFollowModal("followers") },
{ label: "Following", value: user?.followingCount ?? 0, onClick: () => setFollowModal("following") },
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
       {/* Highlights strip */}
        <div className="mb-6 overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex gap-3 w-max">
            {/* New Highlight button */}
            <div className="flex flex-col items-center gap-1.5 cursor-pointer"
              onClick={() => setShowStoryCreate(true)}>
              <div className="relative w-16 h-16 rounded-full bg-white border-2 border-dashed border-[#c09a6e] flex items-center justify-center hover:bg-[#fdf3e7] transition-colors duration-200">
                <Plus size={20} className="text-[#c09a6e]" />
              </div>
              <span className="text-[10px] text-[#8b7355]">New</span>
            </div>

            {/* Real highlights */}
            {highlightLoading ? (
              <div className="flex items-center px-4">
                <Loader2 size={18} className="animate-spin text-[#c09a6e]" />
              </div>
            ) : highlights.length === 0 ? null : (
              highlights.map((highlight) => {
               const thumb =
                  highlight.coverImage ||
                  highlight.snapshots?.[0]?.url ||
                  highlight.snapshots?.[0]?.thumbnailUrl ||
                  null;

                return (
                  <div key={highlight._id} className="flex flex-col items-center gap-1.5 cursor-pointer" 
                  onClick={() => setSelectedHighlight(highlight)}>
                    <div className="p-0.5 rounded-full bg-linear-120-to-br from-[#d4b896] via-[#c09a6e] to-[#8b6343]">
                      <div className="w-14 h-14 rounded-full border-2 border-[#faf6f0] overflow-hidden bg-[#e8d5be]">
                        {thumb ? (
                          <img src={thumb} alt={highlight.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-[#d4b896] to-[#c09a6e]">
                            <span className="text-white text-lg font-bold">
                              {highlight.title?.[0]?.toUpperCase() || "H"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-[#8b7355] max-w-16 truncate text-center">
                      {highlight.title}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#e0cbb8] mb-4">
          {[
         { id: "posts",  icon: <Grid size={16} />,     label: "Posts"  },
{ id: "saved",  icon: <Bookmark size={16} />, label: "Saved"  },
{ id: "drafts", icon: <FileText size={16} />, label: "Drafts" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
  setActiveTab(tab.id);
  localStorage.setItem("profile_active_tab", tab.id);
}}
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
     <div key={activeTab} className="tab-content">
{isLoadingPosts ? (
  <div className="grid grid-cols-3 gap-0.5 mb-8">
    {[...Array(6)].map((_, i) => (
      <div key={i} style={{ paddingBottom: "100%", height: 0, position: "relative" }}>
        <div className="absolute inset-0" style={{
          background: "linear-gradient(90deg, #f0e4d4 25%, #faf0e6 50%, #f0e4d4 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.4s infinite",
        }} />
      </div>
    ))}
  </div>
) : activeTab === "drafts" ? (
  draftPosts.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-16 h-16 rounded-full bg-[#f0e4d4] flex items-center justify-center">
        <FileText size={24} className="text-[#c09a6e]" />
      </div>
      <p className="text-sm font-semibold text-[#5a3e2b]">No drafts yet</p>
    </div>
  ) : (
    <div className="grid grid-cols-3 gap-0.5 mb-8">
      {draftPosts.map((post) => {

        const imgSrc = resolvePostThumb(post);
const isTextPost = post.type === "text" || (!imgSrc && post.caption);

        return (
          <motion.div
            key={post._id}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
            onClick={() => setEditingDraft(post)}
            className="relative cursor-pointer group overflow-hidden"
            style={{ paddingBottom: "100%", height: 0 }}
          >
            <div className="absolute inset-0">
              {isTextPost ? (
                <div
                  className="w-full h-full flex flex-col justify-between p-3 group-hover:brightness-90 transition-all duration-300"
                  style={{
                    background: "linear-gradient(135deg, #f5ece0, #fdf9f5)",
                    border: "1px solid #e8d5be",
                  }}
                >
                  <p
                    className="text-xs leading-relaxed"
                    style={{
                      color: "#2d1f0f", fontWeight: 500,
                      display: "-webkit-box", WebkitLineClamp: 6,
                      WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}
                  >
                    {post.caption || "No caption"}
                  </p>
                </div>
              ) : imgSrc ? (
                <img
  src={imgSrc}
  alt=""
  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
  onError={(e) => {
    e.target.style.display = "none";
    e.target.parentNode.style.background = "#e8d5be";
  }}
/>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#e8d5be]">
                  <Grid size={20} className="text-[#c09a6e]" />
                </div>
              )}

              {/* Draft badge */}
              <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
              </div>

              {/* Hover overlay with actions */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingDraft(post); }}
                  className="flex items-center gap-1.5 bg-white text-[#5a3e2b] text-xs font-bold px-3 py-1.5 rounded-full"
                >
                  <Pencil size={11} /> Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); dispatch(publishDraftPost(post._id)).then(() => dispatch(fetchDraftPosts())); }}
                  className="flex items-center gap-1.5 bg-[#5a3e2b] text-white text-xs font-bold px-3 py-1.5 rounded-full"
                >
                  <Play size={11} /> Publish
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); dispatch(deletePost(post._id)).then(() => dispatch(fetchDraftPosts())); }}
                  className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full"
                >
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  )
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
  <div className="grid grid-cols-3 gap-0.5 mb-8">
            {displayPosts.map((post) => {

              const imgSrc = resolvePostThumb(post);
const isVid = isVideoMedia(post);
const isTextPost = post.type === "text" || (!imgSrc && post.caption);

              return (
                <motion.div
                  key={post._id}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                 onClick={() => {
  setSelectedPost(post);
  window.history.pushState({}, "", `?post=${post._id}`);
}}
                  className="relative cursor-pointer group overflow-hidden"
                  style={{ paddingBottom: "100%", height: 0 }}
                >
                  <div className="absolute inset-0">
                    {isTextPost ? (
                      <div
                        className="w-full h-full flex flex-col justify-between p-3 group-hover:brightness-90 transition-all duration-300"
                        style={{
                          background: "linear-gradient(135deg, #f5ece0, #fdf9f5)",
                          border: "1px solid #e8d5be",
                        }}
                      >
                        <p
                          className="text-xs leading-relaxed"
                          style={{
                            color: "#2d1f0f",
                            fontWeight: 500,
                            display: "-webkit-box",
                            WebkitLineClamp: 6,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {post.caption}
                        </p>
                        {post.hashtags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {post.hashtags.slice(0, 3).map((tag, i) => (
                              <span key={i} className="text-[10px] font-bold" style={{ color: "#c09a6e" }}>
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : imgSrc ? (
                      <img
                        src={imgSrc}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.parentNode.style.background = "#e8d5be";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#e8d5be]">
                        <Grid size={20} className="text-[#c09a6e]" />
                      </div>
                    )}

                    {/* {post.type === "reel" && (
                      <div className="absolute top-2 right-2 bg-black/40 rounded-full p-1">
                        <Play size={12} className="text-white fill-white" />
                      </div>
                    )} */}


                    {isVid && (
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

                    <PostGridMenu
                      onDelete={() => dispatch(deletePost(post._id))}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
       )}
        </div> {/* tab-content */}
      </div>

      {/* ══════════════════════════════════════
          POST DETAIL MODAL — Instagram Style
      ══════════════════════════════════════ */}
  {selectedPost && (
        <PostModal
          post={selectedPost}
          onClose={() => {
  setSelectedPost(null);
  window.history.pushState({}, "", window.location.pathname);
}}
        />
      )}

      {/* FOLLOWERS MODAL */}
     {/* FOLLOW LIST MODAL */}
{followModal && (
  <FollowListModal
    userId={user?._id}
    type={followModal}
    onClose={() => setFollowModal(null)}
    onUnfollow={() => {}}
  />
)}
{selectedHighlight && (
  <HighlightViewer
    highlight={selectedHighlight}
    onClose={() => setSelectedHighlight(null)}
    onDelete={(id) => {
      dispatch(deleteHighlight(id));
      setSelectedHighlight(null);
    }}
    onRemoveSnap={(highlightId, snapId) => {
      dispatch(removeSnapFromHighlight({ highlightId, snapId }));
      setSelectedHighlight((prev) => ({
        ...prev,
        snapshots: prev.snapshots.filter((s) => s._id !== snapId),
      }));
    }}
  />
)}

{showStoryCreate && (
  <StoryCreate
    onClose={() => setShowStoryCreate(false)}
    onCreated={() => {
      dispatch(fetchStoriesFeed());
      setShowStoryCreate(false);
    }}
  />
)}

{editingDraft && (
  <EditDraftModal
    post={editingDraft}
    onClose={() => setEditingDraft(null)}
    onSaved={() => {
      setEditingDraft(null);
      dispatch(fetchDraftPosts());
    }}
  />
)}
    </div>
  );
}
  

