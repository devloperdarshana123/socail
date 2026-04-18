

// import { useState, useEffect, useRef } from "react";
// import { useAuth } from "../context/AuthContext";
// import { useNavigate } from "react-router-dom";
// import { useDispatch, useSelector } from "react-redux";
// import toast from "react-hot-toast";
// import DeleteConfirmModal from "../components/DeleteConfirmModal";
// import {
//   Heart, MessageCircle, Trash2, ShieldX,
//   Plus, X, Grid, Users, Search, UserMinus,
//   MapPin, Pencil, Camera, Play, Eye
// } from "lucide-react";

// import {
//   fetchMyPosts, fetchStats, fetchSuggestions,
//   createPost, likePost, commentPost, deletePost, suspendPost,
// } from "../store/slices/Feedslice";
// import { toggleFollowRequest } from "../store/slices/Exploreslice";
// import { fetchFollowers, fetchFollowing, toggleFollow } from "../store/slices/Profileslice";
// import { uploadAvatar, uploadCoverPhoto } from "../store/slices/settingsSlice";
// import { updateUser as updateUserAction } from "../store/slices/authSlice";

// /* ─── Erovians warm palette ─────────────────────────────────── */
// const C = {
//   sand:    "#c8956c",
//   sandLt:  "#f0e8df",
//   sandDk:  "#a07050",
//   ink:     "#1a1614",
//   gray:    "#6b6560",
//   grayLt:  "#f5f2f0",
//   border:  "#e8e0d8",
//   white:   "#ffffff",
//   indigo:  "#6366f1",
// };

// /* ─── Tiny helpers ───────────────────────────────────────────── */
// const Avatar = ({ src, name, size = 40, className = "" }) =>
//   src ? (
//     <img src={src} alt={name} className={className}
//       style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
//   ) : (
//     <div className={className} style={{
//       width: size, height: size, borderRadius: "50%", flexShrink: 0,
//       background: `linear-gradient(135deg, ${C.sand}, ${C.sandDk})`,
//       display: "flex", alignItems: "center", justifyContent: "center",
//       color: C.white, fontWeight: 700,
//       fontSize: size * 0.38,
//     }}>
//       {name?.charAt(0).toUpperCase()}
//     </div>
//   );

// /* ─── Story Bubble ───────────────────────────────────────────── */
// const StoryBubble = ({ label, src, name, hasStory = true }) => (
//   <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
//     <div style={{
//       padding: hasStory ? 2 : 0,
//       borderRadius: "50%",
//       background: hasStory ? `linear-gradient(135deg, ${C.sand}, ${C.sandDk})` : "transparent",
//     }}>
//       <div style={{
//         padding: hasStory ? 2 : 0,
//         borderRadius: "50%",
//         background: C.white,
//       }}>
//         <Avatar src={src} name={name} size={52} />
//       </div>
//     </div>
//     <span style={{ fontSize: 11, color: C.gray, maxWidth: 60, textAlign: "center",
//       overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
//       {label}
//     </span>
//   </div>
// );

// /* ═══════════════════════════════════════════════════════════════
//    MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════ */
// export default function Profile() {
//   const { user, isAdmin } = useAuth();
//   const navigate = useNavigate();
//   const dispatch = useDispatch();

//   const { myPosts, stats, suggestions, creating } = useSelector((s) => s.feed);
//   const loading = useSelector((s) => s.feed.myPostsLoading);
//   const { pendingRequests } = useSelector((s) => s.explore);
//   const { followers, following } = useSelector((s) => s.profile);

//   const [deleteModalOpen, setDeleteModalOpen] = useState(false);
//   const [postToDelete, setPostToDelete]       = useState(null);
//   const [commentInputs, setCommentInputs]     = useState({});
//   const [showComments, setShowComments]       = useState({});
//   const [showCreatePost, setShowCreatePost]   = useState(false);
//   const [caption, setCaption]                 = useState("");
//   const [image, setImage]                     = useState(null);
//   const [imagePreview, setImagePreview]       = useState(null);
//   const [activePostView, setActivePostView]   = useState("grid"); // grid | list
//   const [selectedPost, setSelectedPost]       = useState(null);
//   const [coverUploading, setCoverUploading]   = useState(false);
//   const [avatarUploading, setAvatarUploading] = useState(false);
//   const liveSelectedPost = selectedPost
//   ? myPosts.find((p) => p._id === selectedPost._id) ?? selectedPost
//   : null;

//   // Social modal
//   const [showSocialModal, setShowSocialModal] = useState(false);
//   const [activeTab, setActiveTab]             = useState("followers");
//   const [searchQuery, setSearchQuery]         = useState("");
//   const [unfollowingId, setUnfollowingId]     = useState(null);

//   useEffect(() => {
//     dispatch(fetchMyPosts());
//     dispatch(fetchStats());
//     dispatch(fetchSuggestions());
//   }, [dispatch]);

//   const openSocialModal = (tab) => {
//     setActiveTab(tab); setSearchQuery(""); setShowSocialModal(true);
//     dispatch(tab === "followers" ? fetchFollowers() : fetchFollowing());
//   };
//   const handleTabSwitch = (tab) => {
//     setActiveTab(tab); setSearchQuery("");
//     dispatch(tab === "followers" ? fetchFollowers() : fetchFollowing());
//   };

//   const currentList  = activeTab === "followers" ? followers : following;
//   const filteredList = currentList.filter((u) =>
//     u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
//     u.designation?.toLowerCase().includes(searchQuery.toLowerCase())
//   );

//   const handleUnfollow = async (userId) => {
//     setUnfollowingId(userId);
//     const result = await dispatch(toggleFollow({ userId, isPending: false, isUnfollow: true }));
//     if (toggleFollow.fulfilled.match(result)) {
//       toast.success("Unfollowed successfully!");
//       dispatch(fetchFollowing()); dispatch(fetchStats());
//     } else toast.error(result.payload || "Unfollow failed!");
//     setUnfollowingId(null);
//   };

//   const handleImageChange = (e) => {
//     const file = e.target.files[0];
//     if (file) { setImage(file); setImagePreview(URL.createObjectURL(file)); }
//   };

//   const handleCreatePost = async (e) => {
//     e.preventDefault();
//     if (!caption && !image) { toast.error("Caption ya image daalo!"); return; }
//     const result = await dispatch(createPost({ caption, image }));
//     if (createPost.fulfilled.match(result)) {
//       toast.success("Posted successfully! 🎉");
//       setCaption(""); setImage(null); setImagePreview(null); setShowCreatePost(false);
//       dispatch(fetchStats());
//     } else toast.error(result.payload || "Failed to create post!");
//   };

//   const handleLike = async (postId) => {
//     const result = await dispatch(likePost({ postId, userId: user._id }));
//     if (likePost.rejected.match(result)) toast.error("Like nahi hua!");
//   };

//   const handleComment = async (postId) => {
//     const text = commentInputs[postId]?.trim();
//     if (!text) return;
//     const result = await dispatch(commentPost({ postId, text }));
//     if (commentPost.fulfilled.match(result)) {
//       setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
//     } else toast.error("Couldn't post comment!");
//   };

//   const handleDelete = (postId) => { setPostToDelete(postId); setDeleteModalOpen(true); };
//   const confirmDelete = async () => {
//     setDeleteModalOpen(false);
//     const result = await dispatch(deletePost(postToDelete));
//     if (deletePost.fulfilled.match(result)) { toast.success("Post deleted!"); dispatch(fetchStats()); }
//     else toast.error("Failed to delete post!");
//     setPostToDelete(null);
//   };

//   const handleSuspend = async (postId) => {
//     const result = await dispatch(suspendPost(postId));
//     if (suspendPost.fulfilled.match(result)) toast.success("Post suspended!");
//     else toast.error("Failed to suspend post!");
//   };

//   const handleFollow = async (userId) => {
//     const isPending = pendingRequests.includes(userId);
//     const result = await dispatch(toggleFollowRequest({ userId, isPending }));
//     if (toggleFollowRequest.fulfilled.match(result))
//       toast.success(isPending ? "Request canceled!" : "Follow request sent!");
//     else toast.error(result.payload || "Request failed!");
//   };

//   const closeModal = () => { setShowCreatePost(false); setCaption(""); setImage(null); setImagePreview(null); };

//   /* ── Avatar upload from Profile page ── */
//   const handleAvatarUpload = async (e) => {
//     const file = e.target.files[0];
//     if (!file) return;
//     setAvatarUploading(true);
//     const result = await dispatch(uploadAvatar(file));
//     if (uploadAvatar.fulfilled.match(result)) {
//       dispatch(updateUserAction({ avatar: result.payload }));
//       toast.success("Avatar updated!");
//     } else {
//       toast.error(result.payload || "Upload failed!");
//     }
//     setAvatarUploading(false);
//   };

//   /* ── Cover photo upload from Profile page ── */
//   const handleCoverUpload = async (e) => {
//     const file = e.target.files[0];
//     if (!file) return;
//     setCoverUploading(true);
//     const result = await dispatch(uploadCoverPhoto(file));
//     if (uploadCoverPhoto.fulfilled.match(result)) {
//       dispatch(updateUserAction({ coverPhoto: result.payload }));
//       toast.success("Cover photo updated!");
//     } else {
//       toast.error(result.payload || "Cover upload failed!");
//     }
//     setCoverUploading(false);
//   };

//   /* ── hashtags from user object or fallback ── */
//   const hashtags = user?.interests?.length
//     ? user.interests
//     : ["#erovians", "#marble", "#design", "#stone", "#interiors"];

//   /* ── dummy story list (own + suggestions) ── */
//   const storyList = [
//     { label: "Your Story", src: user?.avatar, name: user?.name, hasStory: false },
//     ...suggestions.slice(0, 5).map((s) => ({ label: s.name?.split(" ")[0], src: s.avatar, name: s.name, hasStory: true })),
//   ];

//   /* ─────────────────────────────────────────────────────────── */
//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
//         .profile-root { font-family: 'DM Sans', sans-serif; background: #f5f2f0; min-height: 100vh; }
//         .profile-root * { box-sizing: border-box; }
//         .cover-overlay { background: linear-gradient(to bottom, transparent 40%, rgba(26,22,20,0.55) 100%); }
//         .tag-pill { display:inline-flex; align-items:center; padding:4px 12px; border-radius:999px;
//           background:${C.sandLt}; color:${C.sandDk}; font-size:12px; font-weight:500; cursor:pointer;
//           border:1px solid ${C.border}; transition:all .15s; }
//         .tag-pill:hover { background:${C.sand}; color:#fff; border-color:${C.sand}; }
//         .stat-btn { display:flex; flex-direction:column; align-items:center; gap:2px;
//           padding:10px 18px; border-radius:12px; background:${C.white}; border:1px solid ${C.border};
//           cursor:pointer; transition:all .15s; }
//         .stat-btn:hover { background:${C.sandLt}; border-color:${C.sand}; }
//         .stat-num { font-size:18px; font-weight:700; color:${C.ink}; line-height:1; font-family:'DM Serif Display',serif; }
//         .stat-lbl { font-size:11px; color:${C.gray}; font-weight:500; }
//         .post-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:3px; }
//         @media(max-width:480px) { .post-grid { grid-template-columns:repeat(2,1fr); } }
//         .post-thumb { position:relative; aspect-ratio:1; overflow:hidden; cursor:pointer; }
//         .post-thumb img { width:100%; height:100%; object-fit:cover; transition:transform .3s; }
//         .post-thumb:hover img { transform:scale(1.06); }
//         .post-thumb-overlay { position:absolute; inset:0; background:rgba(26,22,20,0.45);
//           display:flex; align-items:center; justify-content:center; gap:12px;
//           opacity:0; transition:opacity .2s; color:#fff; font-size:13px; font-weight:600; }
//         .post-thumb:hover .post-thumb-overlay { opacity:1; }
//         .post-thumb-overlay span { display:flex; align-items:center; gap:4px; }
//         .btn-sand { background:${C.sand}; color:#fff; border:none; border-radius:999px;
//           padding:9px 22px; font-size:13px; font-weight:600; cursor:pointer;
//           transition:all .15s; font-family:'DM Sans',sans-serif; }
//         .btn-sand:hover { background:${C.sandDk}; }
//         .btn-outline { background:transparent; color:${C.gray}; border:1.5px solid ${C.border};
//           border-radius:999px; padding:9px 22px; font-size:13px; font-weight:600; cursor:pointer;
//           transition:all .15s; font-family:'DM Sans',sans-serif; }
//         .btn-outline:hover { border-color:${C.sand}; color:${C.sand}; }
//         .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:50;
//           display:flex; align-items:center; justify-content:center; padding:16px; }
//         .modal-box { background:#fff; border-radius:20px; width:100%; max-width:480px;
//           box-shadow:0 24px 60px rgba(0,0,0,0.2); overflow:hidden; display:flex; flex-direction:column; max-height:88vh; }
//         .scroll-hide::-webkit-scrollbar { display:none; }
//         .anim-in { animation: fadeUp .35s ease both; }
//         @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
//       `}</style>

//       <div className="profile-root">
//         <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 80px" }}>

//           {/* ── COVER + AVATAR ─────────────────────────────────── */}
//           <div className="section-card anim-in" style={{ marginBottom: 12 }}>

//             {/* Cover Photo */}
//             <div style={{ position: "relative", height: "clamp(140px, 25vw, 220px)" , background: `linear-gradient(135deg, ${C.sandLt}, ${C.border})` }}>
//               {user?.coverPhoto ? (
//                 <img src={user.coverPhoto} alt="cover"
//                   style={{ width: "100%", height: "100%", objectFit: "cover" }} />
//               ) : (
//                 <div style={{
//                   width: "100%", height: "100%",
//                   background: `linear-gradient(135deg, #e8ddd4 0%, #d4c4b0 50%, #c8b49a 100%)`,
//                   display: "flex", alignItems: "center", justifyContent: "center",
//                 }}>
//                   <span style={{ fontSize: 48, opacity: 0.25 }}>🪨</span>
//                 </div>
//               )}
//               <div className="cover-overlay" style={{ position: "absolute", inset: 0 }} />

//               {/* Cover edit btn */}
//               <label style={{
//                 position: "absolute", top: 12, right: 12,
//                 background: "rgba(255,255,255,0.85)", border: "none", borderRadius: 999,
//                 padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
//                 display: "flex", alignItems: "center", gap: 5, color: C.ink,
//                 backdropFilter: "blur(6px)",
//               }}>
//                 {coverUploading
//                   ? <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
//                       <div style={{ width: 12, height: 12, border: "2px solid #c8956c",
//                         borderTopColor: "transparent", borderRadius: "50%",
//                         animation: "spin 0.7s linear infinite" }} /> Uploading...
//                     </span>
//                   : <><Camera size={13} /> Edit Cover</>
//                 }
//                 <input type="file" accept="image/*" onChange={handleCoverUpload} style={{ display: "none" }} />
//               </label>
//             </div>

//             {/* Avatar row */}
//             <div style={{ position: "relative", padding: "0 20px 20px" }}>
//             <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 0, gap: 16 }}>

//                 {/* Avatar with ring */}
//  <div style={{
//   padding: 3, borderRadius: "50%",
//   background: C.white, boxShadow: "0 0 0 2px " + C.border,
//   position: "relative", marginTop: -44, flexShrink: 0,
// }}>            <Avatar src={user?.avatar} name={user?.name} size={window.innerWidth < 640 ? 64 : 88} />
//                   <label style={{
//                     position: "absolute", bottom: 2, right: 2,
//                     width: 24, height: 24, borderRadius: "50%",
//                     background: C.sand, border: "2px solid #fff",
//                     display: "flex", alignItems: "center", justifyContent: "center",
//                     cursor: "pointer", color: "#fff",
//                   }}>
//                     {avatarUploading
//                       ? <div style={{ width: 10, height: 10, border: "2px solid #fff",
//                           borderTopColor: "transparent", borderRadius: "50%",
//                           animation: "spin 0.7s linear infinite" }} />
//                       : <Camera size={11} />
//                     }
//                     <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
//                   </label>
//                 </div>

//                 {/* Action buttons */}
//                 <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto", alignSelf: "flex-end", paddingBottom: 0, marginTop: 12 }}>
//                   <button className="btn-outline" onClick={() => navigate("/settings")}
//                     style={{ display: "flex", alignItems: "center", gap: 5 }}>
//                     <Pencil size={13} /> Edit Profile
//                   </button>
//                   <button className="btn-sand" onClick={() => setShowCreatePost(true)}
//                     style={{ display: "flex", alignItems: "center", gap: 5 }}>
//                     <Plus size={13} /> Post
//                   </button>
//                 </div>
//               </div>

//               {/* Name + designation */}
//               <div style={{ marginTop: 12 }}>
//                 <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//                   <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: C.ink, margin: 0 }}>
//                     {user?.name}
//                   </h1>
//                   {isAdmin && (
//                     <span style={{
//                       background: C.sandLt, color: C.sandDk, fontSize: 10, fontWeight: 700,
//                       padding: "2px 8px", borderRadius: 999, border: `1px solid ${C.border}`,
//                     }}>
//                       {user?.role === "super_admin" ? "👑 Super Admin" : "🛡️ Admin"}
//                     </span>
//                   )}
//                 </div>
//                 <p style={{ fontSize: 13, color: C.sand, fontWeight: 500, margin: "2px 0 0" }}>
//                   {user?.designation?.trim() || "EroSocial Member"}
//                 </p>
//                 {(user?.location?.city || user?.location?.state || user?.location?.country) && (
//                   <p style={{ fontSize: 12, color: C.gray, margin: "4px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
//                     <MapPin size={12} />
//                     {[user.location.city, user.location.state, user.location.country]
//                       .filter(Boolean).join(", ")}
//                   </p>
//                 )}
//               </div>

//               {/* Bio */}
//               {user?.bio && (
//                 <p style={{ fontSize: 13, color: C.gray, margin: "10px 0 0", lineHeight: 1.6 }}>
//                   {user.bio}
//                 </p>
//               )}

//               {/* Stats row */}
//               <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: window.innerWidth < 480 ? "center" : "flex-start" }}>
//                 <div className="stat-btn">
//                   <span className="stat-num">{stats.posts ?? 0}</span>
//                   <span className="stat-lbl">Posts</span>
//                 </div>
//                 <button className="stat-btn" onClick={() => openSocialModal("followers")}>
//                   <span className="stat-num">{stats.followers ?? 0}</span>
//                   <span className="stat-lbl">Followers</span>
//                 </button>
//                 <button className="stat-btn" onClick={() => openSocialModal("following")}>
//                   <span className="stat-num">{stats.following ?? 0}</span>
//                   <span className="stat-lbl">Following</span>
//                 </button>
//               </div>

//               {/* Hashtags */}
//               <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
//                 {hashtags.map((tag) => (
//                   <span key={tag} className="tag-pill">{tag.startsWith("#") ? tag : "#" + tag}</span>
//                 ))}
//               </div>
//             </div>
//           </div>

//           {/* ── MY POSTS ───────────────────────────────────────── */}
//           <div className="section-card anim-in">
//             {/* Header */}
//             <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
//               padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
//               <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//                 <Grid size={15} color={C.sand} />
//                 <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>My Posts</span>
//                 <span style={{ fontSize: 11, color: C.gray, background: C.grayLt,
//                   padding: "2px 8px", borderRadius: 999 }}>{myPosts.length}</span>
//               </div>
//               {/* Grid / List toggle */}
//               <div style={{ display: "flex", gap: 4, background: C.grayLt,
//                 borderRadius: 8, padding: 3 }}>
//                 {["grid","list"].map((v) => (
//                   <button key={v} onClick={() => setActivePostView(v)} style={{
//                     padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
//                     fontSize: 11, fontWeight: 600,
//                     background: activePostView === v ? C.white : "transparent",
//                     color: activePostView === v ? C.ink : C.gray,
//                     boxShadow: activePostView === v ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
//                   }}>
//                     {v === "grid" ? "⊞ Grid" : "☰ List"}
//                   </button>
//                 ))}
//               </div>
//             </div>

//             {/* Content */}
//             {loading ? (
//               <div style={{ textAlign: "center", padding: "60px 20px", color: C.gray }}>
//                 <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
//                 Loading posts...
//               </div>
//             ) : myPosts.length === 0 ? (
//               <div style={{ textAlign: "center", padding: "60px 20px" }}>
//                 <div style={{ fontSize: 42, marginBottom: 10 }}>📸</div>
//                 <p style={{ fontSize: 15, fontWeight: 600, color: C.ink, margin: "0 0 4px" }}>No posts yet!</p>
//                 <p style={{ fontSize: 13, color: C.gray, marginBottom: 16 }}>Create your first post 🎉</p>
//                 <button className="btn-sand" onClick={() => setShowCreatePost(true)}>+ Create Post</button>
//               </div>
//             ) : activePostView === "grid" ? (
//               /* GRID VIEW */
//               <div className="post-grid">
//                 {myPosts.map((post) => (
//                   <div key={post._id} className="post-thumb" onClick={() => setSelectedPost(post)}>
//                     {post.image ? (
//                       <img src={post.image} alt="post" />
//                     ) : (
//                       <div style={{ width: "100%", height: "100%", background: C.sandLt,
//                         display: "flex", alignItems: "center", justifyContent: "center",
//                         fontSize: 22, color: C.sand }}>
//                         ✍️
//                       </div>
//                     )}
//                     <div className="post-thumb-overlay">
//                       <span><Heart size={14} fill="white" stroke="none" /> {post.likes?.length || 0}</span>
//                       <span><MessageCircle size={14} /> {post.comments?.length || 0}</span>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             ) : (
//               /* LIST VIEW */
//               <div style={{ padding: "8px 0" }}>
//                 {myPosts.map((post) => (
//                   <div key={post._id} style={{
//                     display: "flex", gap: 12, padding: "14px 20px",
//                     borderBottom: `1px solid ${C.grayLt}`,
//                   }}>
//                     {post.image && (
//                       <img src={post.image} alt="post" style={{
//                         width: 72, height: 72, borderRadius: 12, objectFit: "cover", flexShrink: 0,
//                       }} />
//                     )}
//                     <div style={{ flex: 1, minWidth: 0 }}>
//                       <p style={{ fontSize: 13, color: C.ink, margin: "0 0 6px", lineHeight: 1.5 }}>
//                         {post.caption || <span style={{ color: C.gray, fontStyle: "italic" }}>No caption</span>}
//                       </p>
//                       <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
//                         <button onClick={() => handleLike(post._id)}
//                           style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12,
//                             fontWeight: 600, color: post.likes?.includes(user?._id) ? "#ef4444" : C.gray,
//                             background: "none", border: "none", cursor: "pointer", padding: 0 }}>
//                           <Heart size={14} fill={post.likes?.includes(user?._id) ? "currentColor" : "none"} />
//                           {post.likes?.length || 0}
//                         </button>
//                         <button onClick={() => setShowComments((p) => ({ ...p, [post._id]: !p[post._id] }))}
//                           style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12,
//                             fontWeight: 600, color: C.gray, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
//                           <MessageCircle size={14} /> {post.comments?.length || 0}
//                         </button>
//                         <span style={{ fontSize: 11, color: C.gray, marginLeft: "auto" }}>
//                           {new Date(post.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
//                         </span>
//                         {isAdmin && (
//                           <button onClick={() => handleSuspend(post._id)}
//                             style={{ background: "none", border: "none", cursor: "pointer", color: C.gray, padding: 0 }}>
//                             <ShieldX size={14} />
//                           </button>
//                         )}
//                         <button onClick={() => handleDelete(post._id)}
//                           style={{ background: "none", border: "none", cursor: "pointer", color: C.gray, padding: 0 }}>
//                           <Trash2 size={14} />
//                         </button>
//                       </div>

//                       {showComments[post._id] && (
//                         <div style={{ marginTop: 10 }}>
//                           {post.comments?.slice(-2).map((c, i) => (
//                             <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
//                               <Avatar src={c.user?.avatar} name={c.user?.name} size={20} />
//                               <span style={{ fontSize: 12, color: C.ink }}>
//                                 <strong>{c.user?.name}</strong> {c.text}
//                               </span>
//                             </div>
//                           ))}
//                           <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
//                             <input value={commentInputs[post._id] || ""}
//                               onChange={(e) => setCommentInputs((p) => ({ ...p, [post._id]: e.target.value }))}
//                               onKeyDown={(e) => e.key === "Enter" && handleComment(post._id)}
//                               placeholder="Comment..." style={{
//                                 flex: 1, fontSize: 12, padding: "6px 12px",
//                                 border: `1px solid ${C.border}`, borderRadius: 999,
//                                 outline: "none", fontFamily: "inherit",
//                               }} />
//                             <button onClick={() => handleComment(post._id)}
//                               style={{ fontSize: 12, fontWeight: 600, color: C.sand,
//                                 background: "none", border: "none", cursor: "pointer" }}>Post</button>
//                           </div>
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>

//         </div>
//       </div>

//       {/* ── GRID POST DETAIL MODAL ──────────────────────────────── */}
// {/* ── GRID POST DETAIL MODAL ──────────────────────────────── */}
//       {liveSelectedPost && (
//         <div className="modal-backdrop" onClick={() => setSelectedPost(null)}>
//           <div onClick={(e) => e.stopPropagation()} style={{
//             background: C.white, borderRadius: 20, width: "100%", maxWidth: 560,
//             maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
//             boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
//           }}>
//             <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
//               padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
//               <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//                 <Avatar src={user?.avatar} name={user?.name} size={36} />
//                 <div>
//                   <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: 0 }}>{user?.name}</p>
//                   <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>{user?.designation?.trim() || "EroSocial Member"}</p>
//                 </div>
//               </div>
//               <div style={{ display: "flex", gap: 4 }}>
//                 {isAdmin && (
//                   <button onClick={() => { handleSuspend(liveSelectedPost._id); setSelectedPost(null); }}
//                     style={{ background: "none", border: "none", cursor: "pointer", color: C.gray, padding: 6 }}>
//                     <ShieldX size={16} />
//                   </button>
//                 )}
//                 <button onClick={() => { handleDelete(liveSelectedPost._id); setSelectedPost(null); }}
//                   style={{ background: "none", border: "none", cursor: "pointer", color: C.gray, padding: 6 }}>
//                   <Trash2 size={16} />
//                 </button>
//                 <button onClick={() => setSelectedPost(null)}
//                   style={{ background: "none", border: "none", cursor: "pointer", color: C.gray, padding: 6 }}>
//                   <X size={18} />
//                 </button>
//               </div>
//             </div>
//             {liveSelectedPost.image && (
//               <img src={liveSelectedPost.image} alt="post"
//                 style={{ width: "100%", maxHeight: 380, objectFit: "cover" }} />
//             )}
//             <div style={{ padding: "12px 18px", flex: 1, overflowY: "auto" }}>
//               {liveSelectedPost.caption && (
//                 <p style={{ fontSize: 13, color: C.ink, marginBottom: 12, lineHeight: 1.6 }}>
//                   <strong>{user?.name} </strong>{liveSelectedPost.caption}
//                 </p>
//               )}
//               <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
//                 <button onClick={() => handleLike(liveSelectedPost._id)}
//                   style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13,
//                     fontWeight: 600, color: liveSelectedPost.likes?.some(id => id?.toString() === user?._id?.toString()) ? "#ef4444" : C.gray,
//                     background: "none", border: "none", cursor: "pointer", padding: 0 }}>
//                   <Heart size={18} fill={liveSelectedPost.likes?.some(id => id?.toString() === user?._id?.toString()) ? "currentColor" : "none"} />
//                   {liveSelectedPost.likes?.length || 0}
//                 </button>
//                 <button onClick={() => setShowComments((p) => ({ ...p, [liveSelectedPost._id]: !p[liveSelectedPost._id] }))}
//                   style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13,
//                     fontWeight: 600, color: C.gray, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
//                   <MessageCircle size={18} /> {liveSelectedPost.comments?.length || 0}
//                 </button>
//               </div>
//               {liveSelectedPost.comments?.map((c, i) => (
//                 <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
//                   <Avatar src={c.user?.avatar} name={c.user?.name} size={28} />
//                   <div style={{ background: C.grayLt, borderRadius: 12, padding: "6px 12px", flex: 1 }}>
//                     <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginRight: 6 }}>{c.user?.name}</span>
//                     <span style={{ fontSize: 12, color: C.gray }}>{c.text}</span>
//                   </div>
//                 </div>
//               ))}
//               <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
//                 <Avatar src={user?.avatar} name={user?.name} size={30} />
//                 <input value={commentInputs[liveSelectedPost._id] || ""}
//                   onChange={(e) => setCommentInputs((p) => ({ ...p, [liveSelectedPost._id]: e.target.value }))}
//                   onKeyDown={(e) => e.key === "Enter" && handleComment(liveSelectedPost._id)}
//                   placeholder="Add a comment..." style={{
//                     flex: 1, fontSize: 13, padding: "8px 14px",
//                     border: `1px solid ${C.border}`, borderRadius: 999,
//                     outline: "none", fontFamily: "inherit",
//                   }} />
//                 <button onClick={() => handleComment(liveSelectedPost._id)}
//                   style={{ fontSize: 13, fontWeight: 700, color: C.sand,
//                     background: "none", border: "none", cursor: "pointer" }}>Post</button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── FOLLOWERS / FOLLOWING MODAL ─────────────────────────── */}
//       {/* ── FOLLOWERS / FOLLOWING MODAL ─────────────────────────── */}
//       {showSocialModal && (
//         <div className="modal-backdrop">
//           <div className="modal-box">
//             <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
//               padding: "16px 20px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
//               <div style={{ display: "flex", gap: 4, background: C.grayLt, borderRadius: 12, padding: 4 }}>
//                 {["followers","following"].map((tab) => (
//                   <button key={tab} onClick={() => handleTabSwitch(tab)} style={{
//                     padding: "7px 16px", borderRadius: 9, border: "none", cursor: "pointer",
//                     fontSize: 13, fontWeight: 700, fontFamily: "inherit",
//                     background: activeTab === tab ? C.white : "transparent",
//                     color: activeTab === tab ? C.ink : C.gray,
//                     boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
//                     transition: "all .15s",
//                   }}>
//                     {tab.charAt(0).toUpperCase() + tab.slice(1)}
//                     <span style={{ marginLeft: 6, fontSize: 11, color: C.sand }}>
//                       {tab === "followers" ? stats.followers : stats.following}
//                     </span>
//                   </button>
//                 ))}
//               </div>
//               <button onClick={() => setShowSocialModal(false)}
//                 style={{ background: "none", border: "none", cursor: "pointer", color: C.gray, padding: 4 }}>
//                 <X size={18} />
//               </button>
//             </div>

//             <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.grayLt}`, flexShrink: 0 }}>
//               <div style={{ display: "flex", alignItems: "center", gap: 8,
//                 background: C.grayLt, borderRadius: 12, padding: "8px 14px" }}>
//                 <Search size={14} color={C.gray} />
//                 <input type="text" value={searchQuery}
//                   onChange={(e) => setSearchQuery(e.target.value)}
//                   placeholder={`Search ${activeTab}...`}
//                   style={{ flex: 1, fontSize: 13, background: "transparent",
//                     border: "none", outline: "none", color: C.ink, fontFamily: "inherit" }} />
//                 {searchQuery && (
//                   <button onClick={() => setSearchQuery("")}
//                     style={{ background: "none", border: "none", cursor: "pointer", color: C.gray, padding: 0 }}>
//                     <X size={13} />
//                   </button>
//                 )}
//               </div>
//             </div>

//             <div style={{ flex: 1, overflowY: "auto" }}>
//               {filteredList.length === 0 ? (
//                 <div style={{ textAlign: "center", padding: "48px 20px", color: C.gray }}>
//                   <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
//                   <p style={{ fontSize: 13, fontWeight: 500 }}>
//                     {searchQuery ? "No results found"
//                       : activeTab === "followers" ? "No followers yet" : "Not following anyone yet"}
//                   </p>
//                 </div>
//               ) : filteredList.map((u, i) => (
//                 <div key={u._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
//                   padding: "12px 20px", borderBottom: `1px solid ${C.grayLt}` }}>
//                   <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
//                     <Avatar src={u.avatar} name={u.name} size={42} />
//                     <div>
//                       <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: "0 0 1px" }}>{u.name}</p>
//                       <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>{u.designation?.trim() || "EroSocial Member"}</p>
//                       <p style={{ fontSize: 11, color: C.border, margin: "2px 0 0" }}>
//                         {u.followers?.length || 0} followers
//                       </p>
//                     </div>
//                   </div>
//                   {activeTab === "following" && (
//                     <button onClick={() => handleUnfollow(u._id)} disabled={unfollowingId === u._id}
//                       style={{
//                         display: "flex", alignItems: "center", gap: 5,
//                         fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 999,
//                         border: `1.5px solid ${C.border}`, background: "none", cursor: "pointer",
//                         color: C.gray, fontFamily: "inherit", opacity: unfollowingId === u._id ? 0.4 : 1,
//                         transition: "all .15s",
//                       }}
//                       onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
//                       onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.gray; }}
//                     >
//                       <UserMinus size={13} />
//                       {unfollowingId === u._id ? "..." : "Unfollow"}
//                     </button>
//                   )}
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── CREATE POST MODAL ───────────────────────────────────── */}
//       {showCreatePost && (
//         <div className="modal-backdrop">
//           <div className="modal-box" style={{ maxWidth: 520 }}>
//             <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
//               padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
//               <h2 style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0,
//                 fontFamily: "'DM Serif Display', serif" }}>Create New Post</h2>
//               <button onClick={closeModal}
//                 style={{ background: "none", border: "none", cursor: "pointer", color: C.gray }}>
//                 <X size={18} />
//               </button>
//             </div>
//             <form onSubmit={handleCreatePost}>
//               <div style={{ padding: 20, overflowY: "auto" }}>
//                 <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
//                   <Avatar src={user?.avatar} name={user?.name} size={38} />
//                   <div>
//                     <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: 0 }}>{user?.name}</p>
//                     <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>{user?.designation?.trim() || "EroSocial Member"}</p>
//                   </div>
//                 </div>
//                 <textarea value={caption} onChange={(e) => setCaption(e.target.value)}
//                   placeholder="What are you thinking? Share it..."
//                   rows={4} style={{
//                     width: "100%", padding: "12px 16px",
//                     border: `1.5px solid ${C.border}`, borderRadius: 14,
//                     fontSize: 13, outline: "none", resize: "none",
//                     fontFamily: "inherit", lineHeight: 1.6, color: C.ink,
//                     transition: "border-color .15s",
//                   }}
//                   onFocus={(e) => e.target.style.borderColor = C.sand}
//                   onBlur={(e) => e.target.style.borderColor = C.border}
//                 />
//                 {imagePreview && (
//                   <div style={{ position: "relative", marginTop: 12, borderRadius: 14, overflow: "hidden" }}>
//                     <img src={imagePreview} alt="preview"
//                       style={{ width: "100%", maxHeight: 240, objectFit: "cover" }} />
//                     <button type="button" onClick={() => { setImage(null); setImagePreview(null); }}
//                       style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28,
//                         borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none",
//                         display: "flex", alignItems: "center", justifyContent: "center",
//                         color: "#fff", cursor: "pointer" }}>
//                       <X size={14} />
//                     </button>
//                   </div>
//                 )}
//                 <label style={{ display: "inline-flex", alignItems: "center", gap: 6,
//                   marginTop: 12, fontSize: 13, fontWeight: 600, color: C.sand, cursor: "pointer" }}>
//                   <Camera size={15} /> Add Image
//                   <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
//                 </label>
//               </div>
//               <div style={{ display: "flex", gap: 10, padding: "12px 20px 20px" }}>
//                 <button type="button" onClick={closeModal} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
//                 <button type="submit" disabled={creating} className="btn-sand" style={{
//                   flex: 1, opacity: creating ? 0.6 : 1,
//                 }}>
//                   {creating ? "Posting..." : "Post Now 🚀"}
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       <DeleteConfirmModal
//         isOpen={deleteModalOpen}
//         onConfirm={confirmDelete}
//         onCancel={() => { setDeleteModalOpen(false); setPostToDelete(null); }}
//       />
//     </>
//   );
// }





import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import {
  Heart, MessageCircle, Trash2, ShieldX,
  Plus, X, Grid, Search, UserMinus,
  MapPin, Pencil, Camera,
} from "lucide-react";

import {
  fetchMyPosts, fetchStats, fetchSuggestions,
  createPost, likePost, commentPost, deletePost, suspendPost,
} from "../store/slices/Feedslice";
import { fetchFollowers, fetchFollowing, toggleFollow } from "../store/slices/Profileslice";
import { uploadAvatar, uploadCoverPhoto } from "../store/slices/settingsSlice";
import { updateUser as updateUserAction } from "../store/slices/authSlice";

/* ─── Palette ────────────────────────────────────────────────── */
const C = {
  sand:   "#c8956c",
  sandLt: "#f0e8df",
  sandDk: "#a07050",
  ink:    "#1a1614",
  gray:   "#6b6560",
  grayLt: "#f5f2f0",
  border: "#e8e0d8",
  white:  "#ffffff",
};

/* ─── Avatar ─────────────────────────────────────────────────── */
const Avatar = ({ src, name, size = 40 }) =>
  src ? (
    <img src={src} alt={name}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `linear-gradient(135deg, ${C.sand}, ${C.sandDk})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: C.white, fontWeight: 700, fontSize: size * 0.38,
    }}>
      {name?.charAt(0)?.toUpperCase() ?? "?"}
    </div>
  );

/* ─── Spinner ────────────────────────────────────────────────── */
const Spinner = ({ size = 12, color = "#fff" }) => (
  <div style={{
    width: size, height: size,
    border: `2px solid ${color}`,
    borderTopColor: "transparent",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  }} />
);

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Profile() {
  const { user, isAdmin } = useAuth();
  const navigate  = useNavigate();
  const dispatch  = useDispatch();

  const { myPosts, stats, creating }  = useSelector((s) => s.feed);
  const loading                        = useSelector((s) => s.feed.myPostsLoading);
  const { followers, following }       = useSelector((s) => s.profile);

  /* ── responsive: track viewport width properly ── */
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const [isXs, setIsXs]         = useState(() => window.innerWidth < 480);
  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 640);
      setIsXs(window.innerWidth < 480);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ── post state ── */
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [postToDelete,    setPostToDelete]    = useState(null);
  const [commentInputs,   setCommentInputs]   = useState({});
  const [showComments,    setShowComments]    = useState({});
  const [showCreatePost,  setShowCreatePost]  = useState(false);
  const [caption,         setCaption]         = useState("");
  const [image,           setImage]           = useState(null);
  const [imagePreview,    setImagePreview]    = useState(null);
  const [activePostView,  setActivePostView]  = useState("grid");
  const [selectedPost,    setSelectedPost]    = useState(null);

  /* ── upload state ── */
  const [coverUploading,  setCoverUploading]  = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  /* ── social modal ── */
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [activeTab,       setActiveTab]       = useState("followers");
  const [searchQuery,     setSearchQuery]     = useState("");
  const [unfollowingId,   setUnfollowingId]   = useState(null);

  /* live-update selected post from redux */
  const liveSelectedPost = selectedPost
    ? myPosts.find((p) => p._id === selectedPost._id) ?? selectedPost
    : null;

  /* ── fetch on mount ── */
  useEffect(() => {
    dispatch(fetchMyPosts());
    dispatch(fetchStats());
    dispatch(fetchSuggestions());
  }, [dispatch]);

  /* ── social modal helpers ── */
  const openSocialModal = useCallback((tab) => {
    setActiveTab(tab); setSearchQuery(""); setShowSocialModal(true);
    dispatch(tab === "followers" ? fetchFollowers() : fetchFollowing());
  }, [dispatch]);

  const handleTabSwitch = useCallback((tab) => {
    setActiveTab(tab); setSearchQuery("");
    dispatch(tab === "followers" ? fetchFollowers() : fetchFollowing());
  }, [dispatch]);

  const currentList  = activeTab === "followers" ? followers : following;
  const filteredList = currentList.filter((u) =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.designation?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* ── handlers ── */
  const handleUnfollow = async (userId) => {
    setUnfollowingId(userId);
    const res = await dispatch(toggleFollow({ userId, isPending: false, isUnfollow: true }));
    if (toggleFollow.fulfilled.match(res)) {
      toast.success("Unfollowed!");
      dispatch(fetchFollowing()); dispatch(fetchStats());
    } else toast.error(res.payload || "Unfollow failed!");
    setUnfollowingId(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) { setImage(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!caption && !image) { toast.error("Caption ya image daalo!"); return; }
    const res = await dispatch(createPost({ caption, image }));
    if (createPost.fulfilled.match(res)) {
      toast.success("Posted! 🎉");
      setCaption(""); setImage(null); setImagePreview(null); setShowCreatePost(false);
      dispatch(fetchStats());
    } else toast.error(res.payload || "Post failed!");
  };

  const handleLike = async (postId) => {
    const res = await dispatch(likePost({ postId, userId: user._id }));
    if (likePost.rejected.match(res)) toast.error("Like failed!");
  };

  const handleComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    const res = await dispatch(commentPost({ postId, text }));
    if (commentPost.fulfilled.match(res))
      setCommentInputs((p) => ({ ...p, [postId]: "" }));
    else toast.error("Comment failed!");
  };

  const handleDelete    = (postId) => { setPostToDelete(postId); setDeleteModalOpen(true); };
  const confirmDelete   = async () => {
    setDeleteModalOpen(false);
    const res = await dispatch(deletePost(postToDelete));
    if (deletePost.fulfilled.match(res)) { toast.success("Deleted!"); dispatch(fetchStats()); }
    else toast.error("Delete failed!");
    setPostToDelete(null);
  };

  const handleSuspend = async (postId) => {
    const res = await dispatch(suspendPost(postId));
    if (suspendPost.fulfilled.match(res)) toast.success("Suspended!");
    else toast.error("Suspend failed!");
  };

  const closeModal = () => {
    setShowCreatePost(false); setCaption(""); setImage(null); setImagePreview(null);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarUploading(true);
    const res = await dispatch(uploadAvatar(file));
    if (uploadAvatar.fulfilled.match(res)) {
      dispatch(updateUserAction({ avatar: res.payload }));
      toast.success("Avatar updated!");
    } else toast.error(res.payload || "Upload failed!");
    setAvatarUploading(false);
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCoverUploading(true);
    const res = await dispatch(uploadCoverPhoto(file));
    if (uploadCoverPhoto.fulfilled.match(res)) {
      dispatch(updateUserAction({ coverPhoto: res.payload }));
      toast.success("Cover updated!");
    } else toast.error(res.payload || "Upload failed!");
    setCoverUploading(false);
  };

  const hashtags = user?.interests?.length
    ? user.interests
    : ["#erovians", "#marble", "#design", "#stone", "#interiors"];

  /* ──────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }

        .profile-root { font-family:'DM Sans',sans-serif; background:#f5f2f0; min-height:100vh; }
        .profile-root * { box-sizing:border-box; }

        .section-card {
          background:${C.white};
          border-radius:20px;
          border:1px solid ${C.border};
          overflow:hidden;
          box-shadow:0 2px 12px rgba(0,0,0,0.06);
        }
        .anim-in { animation:fadeUp .35s ease both; }

        .cover-overlay { background:linear-gradient(to bottom,transparent 40%,rgba(26,22,20,0.5) 100%); }

        .tag-pill {
          display:inline-flex; align-items:center; padding:4px 12px;
          border-radius:999px; background:${C.sandLt}; color:${C.sandDk};
          font-size:12px; font-weight:500; cursor:pointer;
          border:1px solid ${C.border}; transition:all .15s;
        }
        .tag-pill:hover { background:${C.sand}; color:#fff; border-color:${C.sand}; }

        .stat-btn {
          display:flex; flex-direction:column; align-items:center; gap:2px;
          padding:10px 20px; border-radius:12px; background:${C.white};
          border:1px solid ${C.border}; cursor:pointer; transition:all .15s;
        }
        .stat-btn:hover { background:${C.sandLt}; border-color:${C.sand}; }
        .stat-num { font-size:18px; font-weight:700; color:${C.ink}; line-height:1; font-family:'DM Serif Display',serif; }
        .stat-lbl { font-size:11px; color:${C.gray}; font-weight:500; }

        .post-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:3px; }
        @media(max-width:480px) { .post-grid { grid-template-columns:repeat(2,1fr); } }

        .post-thumb { position:relative; aspect-ratio:1; overflow:hidden; cursor:pointer; }
        .post-thumb img { width:100%; height:100%; object-fit:cover; transition:transform .3s; }
        .post-thumb:hover img { transform:scale(1.06); }
        .post-thumb-overlay {
          position:absolute; inset:0; background:rgba(26,22,20,0.45);
          display:flex; align-items:center; justify-content:center; gap:12px;
          opacity:0; transition:opacity .2s; color:#fff; font-size:13px; font-weight:600;
        }
        .post-thumb:hover .post-thumb-overlay { opacity:1; }
        .post-thumb-overlay span { display:flex; align-items:center; gap:4px; }

        .btn-sand {
          background:${C.sand}; color:#fff; border:none; border-radius:999px;
          padding:9px 22px; font-size:13px; font-weight:600; cursor:pointer;
          transition:all .15s; font-family:'DM Sans',sans-serif;
          display:inline-flex; align-items:center; gap:5px;
        }
        .btn-sand:hover { background:${C.sandDk}; }
        .btn-sand:disabled { opacity:0.6; cursor:not-allowed; }

        .btn-outline {
          background:transparent; color:${C.gray}; border:1.5px solid ${C.border};
          border-radius:999px; padding:9px 22px; font-size:13px; font-weight:600; cursor:pointer;
          transition:all .15s; font-family:'DM Sans',sans-serif;
          display:inline-flex; align-items:center; gap:5px;
        }
        .btn-outline:hover { border-color:${C.sand}; color:${C.sand}; }

        .modal-backdrop {
          position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:100;
          display:flex; align-items:center; justify-content:center; padding:16px;
        }
        .modal-box {
          background:#fff; border-radius:20px; width:100%; max-width:480px;
          box-shadow:0 24px 60px rgba(0,0,0,0.2); overflow:hidden;
          display:flex; flex-direction:column; max-height:88vh;
        }
        .scroll-hide { overflow-y:auto; }
        .scroll-hide::-webkit-scrollbar { display:none; }
      `}</style>

      <div className="profile-root">
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>

          {/* ── COVER + AVATAR ── */}
          <div className="section-card anim-in" style={{ marginBottom: 12 }}>

            {/* Cover */}
            <div style={{ position: "relative", height: "clamp(140px, 25vw, 240px)" }}>
              {user?.coverPhoto ? (
                <img src={user.coverPhoto} alt="cover"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{
                  width: "100%", height: "100%",
                  background: `linear-gradient(135deg, #e8ddd4 0%, #d4c4b0 50%, #c8b49a 100%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 48, opacity: 0.25 }}>🪨</span>
                </div>
              )}
              <div className="cover-overlay" style={{ position: "absolute", inset: 0 }} />

              {/* Edit Cover */}
              <label style={{
                position: "absolute", top: 12, right: 12,
                background: "rgba(255,255,255,0.88)", borderRadius: 999,
                padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5, color: C.ink,
                backdropFilter: "blur(6px)", border: "none", userSelect: "none",
              }}>
                {coverUploading
                  ? <><Spinner size={12} color={C.sand} /> Uploading...</>
                  : <><Camera size={13} /> Edit Cover</>
                }
                <input type="file" accept="image/*" onChange={handleCoverUpload} style={{ display: "none" }} />
              </label>
            </div>

            {/* Avatar + Actions */}
            <div style={{ padding: "0 24px 24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>

                {/* Avatar */}
                <div style={{
                  padding: 3, borderRadius: "50%",
                  background: C.white, boxShadow: `0 0 0 2px ${C.border}`,
                  position: "relative", marginTop: -44, flexShrink: 0,
                }}>
                  <Avatar src={user?.avatar} name={user?.name} size={isMobile ? 64 : 92} />
                  <label style={{
                    position: "absolute", bottom: 2, right: 2,
                    width: 26, height: 26, borderRadius: "50%",
                    background: C.sand, border: "2px solid #fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", color: "#fff",
                  }}>
                    {avatarUploading ? <Spinner size={10} /> : <Camera size={11} />}
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
                  </label>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: 8, marginTop: 14, marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button className="btn-outline" onClick={() => navigate("/settings")}>
                    <Pencil size={13} /> Edit Profile
                  </button>
                  <button className="btn-sand" onClick={() => setShowCreatePost(true)}>
                    <Plus size={13} /> Post
                  </button>
                </div>
              </div>

              {/* Name */}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 24, color: C.ink, margin: 0 }}>
                    {user?.name}
                  </h1>
                  {isAdmin && (
                    <span style={{
                      background: C.sandLt, color: C.sandDk, fontSize: 10, fontWeight: 700,
                      padding: "2px 8px", borderRadius: 999, border: `1px solid ${C.border}`,
                    }}>
                      {user?.role === "super_admin" ? "👑 Super Admin" : "🛡️ Admin"}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: C.sand, fontWeight: 500, margin: "3px 0 0" }}>
                  {user?.designation?.trim() || "EroSocial Member"}
                </p>
                {(user?.location?.city || user?.location?.state || user?.location?.country) && (
                  <p style={{ fontSize: 12, color: C.gray, margin: "5px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={12} />
                    {[user.location.city, user.location.state, user.location.country].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>

              {/* Bio */}
              {user?.bio && (
                <p style={{ fontSize: 13, color: C.gray, margin: "10px 0 0", lineHeight: 1.65, maxWidth: 600 }}>
                  {user.bio}
                </p>
              )}

              {/* Stats */}
              <div style={{
                display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap",
                justifyContent: isXs ? "center" : "flex-start",
              }}>
                <div className="stat-btn">
                  <span className="stat-num">{stats.posts ?? 0}</span>
                  <span className="stat-lbl">Posts</span>
                </div>
                <button className="stat-btn" onClick={() => openSocialModal("followers")}>
                  <span className="stat-num">{stats.followers ?? 0}</span>
                  <span className="stat-lbl">Followers</span>
                </button>
                <button className="stat-btn" onClick={() => openSocialModal("following")}>
                  <span className="stat-num">{stats.following ?? 0}</span>
                  <span className="stat-lbl">Following</span>
                </button>
              </div>

              {/* Hashtags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
                {hashtags.map((tag) => (
                  <span key={tag} className="tag-pill">
                    {tag.startsWith("#") ? tag : "#" + tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── MY POSTS ── */}
          <div className="section-card anim-in">
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 20px", borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Grid size={15} color={C.sand} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>My Posts</span>
                <span style={{
                  fontSize: 11, color: C.gray, background: C.grayLt,
                  padding: "2px 8px", borderRadius: 999,
                }}>{myPosts.length}</span>
              </div>
              <div style={{ display: "flex", gap: 4, background: C.grayLt, borderRadius: 8, padding: 3 }}>
                {["grid", "list"].map((v) => (
                  <button key={v} onClick={() => setActivePostView(v)} style={{
                    padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 600,
                    background: activePostView === v ? C.white : "transparent",
                    color: activePostView === v ? C.ink : C.gray,
                    boxShadow: activePostView === v ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    transition: "all .15s",
                  }}>
                    {v === "grid" ? "⊞ Grid" : "☰ List"}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: C.gray }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                Loading posts...
              </div>
            ) : myPosts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 42, marginBottom: 10 }}>📸</div>
                <p style={{ fontSize: 15, fontWeight: 600, color: C.ink, margin: "0 0 4px" }}>No posts yet!</p>
                <p style={{ fontSize: 13, color: C.gray, marginBottom: 16 }}>Share your first post 🎉</p>
                <button className="btn-sand" onClick={() => setShowCreatePost(true)}>+ Create Post</button>
              </div>
            ) : activePostView === "grid" ? (
              <div className="post-grid">
                {myPosts.map((post) => (
                  <div key={post._id} className="post-thumb" onClick={() => setSelectedPost(post)}>
                    {post.image ? (
                      <img src={post.image} alt="post" loading="lazy" />
                    ) : (
                      <div style={{
                        width: "100%", height: "100%", background: C.sandLt,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, color: C.sand,
                      }}>✍️</div>
                    )}
                    <div className="post-thumb-overlay">
                      <span><Heart size={14} fill="white" stroke="none" /> {post.likes?.length || 0}</span>
                      <span><MessageCircle size={14} /> {post.comments?.length || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "8px 0" }}>
                {myPosts.map((post) => (
                  <div key={post._id} style={{
                    display: "flex", gap: 12, padding: "14px 20px",
                    borderBottom: `1px solid ${C.grayLt}`,
                  }}>
                    {post.image && (
                      <img src={post.image} alt="post" loading="lazy" style={{
                        width: 72, height: 72, borderRadius: 12, objectFit: "cover", flexShrink: 0,
                      }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: C.ink, margin: "0 0 6px", lineHeight: 1.5 }}>
                        {post.caption || <span style={{ color: C.gray, fontStyle: "italic" }}>No caption</span>}
                      </p>
                      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                        <button onClick={() => handleLike(post._id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600,
                            color: post.likes?.includes(user?._id) ? "#ef4444" : C.gray,
                            background: "none", border: "none", cursor: "pointer", padding: 0,
                          }}>
                          <Heart size={14} fill={post.likes?.includes(user?._id) ? "currentColor" : "none"} />
                          {post.likes?.length || 0}
                        </button>
                        <button onClick={() => setShowComments((p) => ({ ...p, [post._id]: !p[post._id] }))}
                          style={{
                            display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600,
                            color: C.gray, background: "none", border: "none", cursor: "pointer", padding: 0,
                          }}>
                          <MessageCircle size={14} /> {post.comments?.length || 0}
                        </button>
                        <span style={{ fontSize: 11, color: C.gray, marginLeft: "auto" }}>
                          {new Date(post.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                        {isAdmin && (
                          <button onClick={() => handleSuspend(post._id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: C.gray, padding: 0 }}>
                            <ShieldX size={14} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(post._id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 0 }}>
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {showComments[post._id] && (
                        <div style={{ marginTop: 10 }}>
                          {post.comments?.slice(-2).map((c, i) => (
                            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                              <Avatar src={c.user?.avatar} name={c.user?.name} size={20} />
                              <span style={{ fontSize: 12, color: C.ink }}>
                                <strong>{c.user?.name}</strong> {c.text}
                              </span>
                            </div>
                          ))}
                          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            <input value={commentInputs[post._id] || ""}
                              onChange={(e) => setCommentInputs((p) => ({ ...p, [post._id]: e.target.value }))}
                              onKeyDown={(e) => e.key === "Enter" && handleComment(post._id)}
                              placeholder="Comment..." style={{
                                flex: 1, fontSize: 12, padding: "6px 12px",
                                border: `1px solid ${C.border}`, borderRadius: 999,
                                outline: "none", fontFamily: "inherit",
                              }} />
                            <button onClick={() => handleComment(post._id)}
                              style={{ fontSize: 12, fontWeight: 600, color: C.sand, background: "none", border: "none", cursor: "pointer" }}>
                              Post
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── POST DETAIL MODAL ── */}
      {liveSelectedPost && (
        <div className="modal-backdrop" onClick={() => setSelectedPost(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: C.white, borderRadius: 20, width: "100%", maxWidth: 580,
            maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
            boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px", borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar src={user?.avatar} name={user?.name} size={36} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: 0 }}>{user?.name}</p>
                  <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>{user?.designation?.trim() || "EroSocial Member"}</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {isAdmin && (
                  <button onClick={() => { handleSuspend(liveSelectedPost._id); setSelectedPost(null); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: C.gray, padding: 6 }}>
                    <ShieldX size={16} />
                  </button>
                )}
                <button onClick={() => { handleDelete(liveSelectedPost._id); setSelectedPost(null); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 6 }}>
                  <Trash2 size={16} />
                </button>
                <button onClick={() => setSelectedPost(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: C.gray, padding: 6 }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {liveSelectedPost.image && (
              <img src={liveSelectedPost.image} alt="post"
                style={{ width: "100%", maxHeight: 400, objectFit: "cover" }} />
            )}

            <div className="scroll-hide" style={{ padding: "12px 18px", flex: 1 }}>
              {liveSelectedPost.caption && (
                <p style={{ fontSize: 13, color: C.ink, marginBottom: 12, lineHeight: 1.6 }}>
                  <strong>{user?.name} </strong>{liveSelectedPost.caption}
                </p>
              )}
              <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
                <button onClick={() => handleLike(liveSelectedPost._id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600,
                    color: liveSelectedPost.likes?.some(id => id?.toString() === user?._id?.toString()) ? "#ef4444" : C.gray,
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                  }}>
                  <Heart size={18} fill={liveSelectedPost.likes?.some(id => id?.toString() === user?._id?.toString()) ? "currentColor" : "none"} />
                  {liveSelectedPost.likes?.length || 0}
                </button>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: C.gray }}>
                  <MessageCircle size={18} /> {liveSelectedPost.comments?.length || 0}
                </span>
              </div>

              {liveSelectedPost.comments?.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <Avatar src={c.user?.avatar} name={c.user?.name} size={28} />
                  <div style={{ background: C.grayLt, borderRadius: 12, padding: "6px 12px", flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginRight: 6 }}>{c.user?.name}</span>
                    <span style={{ fontSize: 12, color: C.gray }}>{c.text}</span>
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Avatar src={user?.avatar} name={user?.name} size={30} />
                <input value={commentInputs[liveSelectedPost._id] || ""}
                  onChange={(e) => setCommentInputs((p) => ({ ...p, [liveSelectedPost._id]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleComment(liveSelectedPost._id)}
                  placeholder="Add a comment..." style={{
                    flex: 1, fontSize: 13, padding: "8px 14px",
                    border: `1px solid ${C.border}`, borderRadius: 999,
                    outline: "none", fontFamily: "inherit",
                  }} />
                <button onClick={() => handleComment(liveSelectedPost._id)}
                  style={{ fontSize: 13, fontWeight: 700, color: C.sand, background: "none", border: "none", cursor: "pointer" }}>
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FOLLOWERS / FOLLOWING MODAL ── */}
      {showSocialModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: `1px solid ${C.border}`, flexShrink: 0,
            }}>
              <div style={{ display: "flex", gap: 4, background: C.grayLt, borderRadius: 12, padding: 4 }}>
                {["followers", "following"].map((tab) => (
                  <button key={tab} onClick={() => handleTabSwitch(tab)} style={{
                    padding: "7px 16px", borderRadius: 9, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                    background: activeTab === tab ? C.white : "transparent",
                    color: activeTab === tab ? C.ink : C.gray,
                    boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                    transition: "all .15s",
                  }}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    <span style={{ marginLeft: 6, fontSize: 11, color: C.sand }}>
                      {tab === "followers" ? stats.followers : stats.following}
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowSocialModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.gray, padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.grayLt}`, flexShrink: 0 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: C.grayLt, borderRadius: 12, padding: "8px 14px",
              }}>
                <Search size={14} color={C.gray} />
                <input type="text" value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${activeTab}...`}
                  style={{ flex: 1, fontSize: 13, background: "transparent", border: "none", outline: "none", color: C.ink, fontFamily: "inherit" }} />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")}
                    style={{ background: "none", border: "none", cursor: "pointer", color: C.gray, padding: 0 }}>
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="scroll-hide" style={{ flex: 1 }}>
              {filteredList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 20px", color: C.gray }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>
                    {searchQuery ? "No results found"
                      : activeTab === "followers" ? "No followers yet" : "Not following anyone"}
                  </p>
                </div>
              ) : filteredList.map((u) => (
                <div key={u._id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 20px", borderBottom: `1px solid ${C.grayLt}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar src={u.avatar} name={u.name} size={42} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: "0 0 1px" }}>{u.name}</p>
                      <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>{u.designation?.trim() || "EroSocial Member"}</p>
                    </div>
                  </div>
                  {activeTab === "following" && (
                    <button onClick={() => handleUnfollow(u._id)} disabled={unfollowingId === u._id}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 999,
                        border: `1.5px solid ${C.border}`, background: "none", cursor: "pointer",
                        color: C.gray, fontFamily: "inherit",
                        opacity: unfollowingId === u._id ? 0.4 : 1, transition: "all .15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.gray; }}
                    >
                      <UserMinus size={13} />
                      {unfollowingId === u._id ? "..." : "Unfollow"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE POST MODAL ── */}
      {showCreatePost && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 520 }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
            }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0, fontFamily: "'DM Serif Display',serif" }}>
                Create New Post
              </h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: C.gray }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePost}>
              <div className="scroll-hide" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <Avatar src={user?.avatar} name={user?.name} size={38} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: 0 }}>{user?.name}</p>
                    <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>{user?.designation?.trim() || "EroSocial Member"}</p>
                  </div>
                </div>

                <textarea value={caption} onChange={(e) => setCaption(e.target.value)}
                  placeholder="What are you thinking? Share it..."
                  rows={4} style={{
                    width: "100%", padding: "12px 16px",
                    border: `1.5px solid ${C.border}`, borderRadius: 14,
                    fontSize: 13, outline: "none", resize: "none",
                    fontFamily: "inherit", lineHeight: 1.6, color: C.ink,
                    transition: "border-color .15s",
                  }}
                  onFocus={(e) => e.target.style.borderColor = C.sand}
                  onBlur={(e) => e.target.style.borderColor = C.border}
                />

                {imagePreview && (
                  <div style={{ position: "relative", marginTop: 12, borderRadius: 14, overflow: "hidden" }}>
                    <img src={imagePreview} alt="preview" style={{ width: "100%", maxHeight: 240, objectFit: "cover" }} />
                    <button type="button" onClick={() => { setImage(null); setImagePreview(null); }}
                      style={{
                        position: "absolute", top: 8, right: 8, width: 28, height: 28,
                        borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", cursor: "pointer",
                      }}>
                      <X size={14} />
                    </button>
                  </div>
                )}

                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 13, fontWeight: 600, color: C.sand, cursor: "pointer" }}>
                  <Camera size={15} /> Add Image
                  <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, padding: "12px 20px 20px" }}>
                <button type="button" onClick={closeModal} className="btn-outline" style={{ flex: 1, justifyContent: "center" }}>Cancel</button>
                <button type="submit" disabled={creating} className="btn-sand" style={{ flex: 1, justifyContent: "center" }}>
                  {creating ? "Posting..." : "Post Now 🚀"}
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