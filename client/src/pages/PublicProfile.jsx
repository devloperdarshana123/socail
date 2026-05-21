import { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import FollowListModal from "../components/FollowListModal";
import { Heart, MessageCircle, Grid, MapPin, Play, Loader2, UserPlus, UserCheck, BadgeCheck, ArrowLeft } from "lucide-react";
import api from "../lib/services/api";
import PostModal from "../components/PostModal";
import { followUser, unfollowUser } from "../lib/redux/authSlice";
import { initInteraction, fetchPostInteraction, recordPostView ,  fetchComments } from "../lib/redux/postSlice";

export default function PublicProfile() {
  const { username }   = useParams();
  const dispatch       = useDispatch();
  const navigate       = useNavigate();
  const currentUser    = useSelector((s) => s.auth.user);
  const [profile,       setProfile]       = useState(null);
  const [posts,         setPosts]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [followState,   setFollowState]   = useState("none");
  const [followLoading, setFollowLoading] = useState(false);
  const [selectedPost,  setSelectedPost]  = useState(null);
  const [followModal, setFollowModal] = useState(() => {
  const params = new URLSearchParams(window.location.search);
  const modal = params.get("modal");
  return modal === "followers" || modal === "following" ? modal : null;
});

  
  const viewedPosts     = useRef(new Set());

  useEffect(() => {
    if (currentUser?.username && username === currentUser.username) {
      navigate("/profile", { replace: true });
    }
  }, [username, currentUser]);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setError(null);
    api.get(`/explore/user/${username}`)
      .then(({ data }) => {
        if (data.success) {
          setProfile(data.user);
          setPosts(data.posts || []);
          setFollowState(data.user.isFollowing ? "following" : "none");
        } else setError("User not found.");
      })
      .catch(() => setError("Could not load profile."))
      .finally(() => setLoading(false));
  }, [username]);


  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get("post");
  if (!postId || posts.length === 0) return;
  const found = posts.find((p) => p._id === postId);
  if (found) setSelectedPost(found);
}, [posts]);
  useEffect(() => {
    if (!selectedPost) return
    
    const postId = selectedPost._id;
    dispatch(initInteraction({ postId, likesCount: selectedPost.likesCount ?? 0, commentsCount: selectedPost.commentsCount ?? 0 }));
    dispatch(fetchComments({ postId }));
    dispatch(fetchPostInteraction(postId));
    if (!viewedPosts.current.has(postId)) {
      viewedPosts.current.add(postId);
      dispatch(recordPostView(postId));
    }
  }, [selectedPost?._id]);



  const handleFollow = async () => {
  if (followLoading || !profile) return;
  setFollowLoading(true);
  const prev = followState;

  // Optimistic update
if (followState === "following") {
  setFollowState("none");
  setProfile((p) => ({
    ...p,
    followersCount: Math.max(0, (p.followersCount || 0) - 1),
  }));
  const res = await dispatch(unfollowUser(profile._id));
  if (unfollowUser.rejected.match(res)) {
    setFollowState(prev);
    setProfile((p) => ({
      ...p,
      followersCount: (p.followersCount || 0) + 1,
    }));
  }
} else {
  setFollowState("following");
  setProfile((p) => ({ ...p, followersCount: (p.followersCount || 0) + 1 }));
  const res = await dispatch(followUser(profile._id));
  if (followUser.rejected.match(res)) {
    setFollowState(prev);
    setProfile((p) => ({
      ...p,
      followersCount: Math.max(0, (p.followersCount || 0) - 1),
    }));
  }
}
  setFollowLoading(false);
};

  if (loading) return (
    <div className="min-h-screen bg-[#faf6f0] flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-[#c09a6e]" />
    </div>
  );

  if (error || !profile) return (
    <div className="min-h-screen bg-[#faf6f0] flex flex-col items-center justify-center gap-4">
      <p className="text-[#5a3e2b] font-semibold">{error || "User not found."}</p>
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-[#8b7355] hover:text-[#5a3e2b]">
        <ArrowLeft size={14} /> Go back
      </button>
    </div>
  );

const followBtnConfig = {
  none:      { label: "Follow",    icon: <UserPlus size={14} />,  cls: "bg-[#2d1f0f] hover:bg-[#1a1108] text-white" },
  following: { label: "Following", icon: <UserCheck size={14} />, cls: "bg-white border-2 border-[#ddd0c0] text-[#5a3e2b] hover:bg-[#f5ece0]" },
}[followState];

  return (
    <div className="min-h-screen bg-[#faf6f0]">

      {/* COVER */}
      <div className="relative w-full h-56 md:h-72 overflow-hidden" style={{ height: 220 }}>
        {profile.coverPhoto?.url ? (
          <img src={profile.coverPhoto.url} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-linear-to-br from-[#d4b896] via-[#c09a6e] to-[#8b6343]" />
        )}
        {/* Back button */}
        <button onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-9 h-9 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all">
          <ArrowLeft size={16} />
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-8 pb-16">

        {/* AVATAR ROW */}
   <div className="flex items-end justify-between mb-5" style={{ marginTop: "-48px" }}>
  <div style={{
    width: 100,
    height: 100,
    borderRadius: "50%",
    border: "4px solid #faf6f0",
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
    overflow: "hidden",
    flexShrink: 0,
    background: "#e8d5be",
    position: "relative",
    zIndex: 10,
  }}>
    {profile.avatar?.url ? (
      <img
        src={profile.avatar.url}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    ) : (
      <div style={{
        width: "100%", height: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #d4b896, #c09a6e)",
      }}>
        <span style={{ fontSize: 36, color: "white", fontWeight: "bold" }}>
          {profile.fullName?.[0]?.toUpperCase()}
        </span>
      </div>
    )}
  </div>

  {/* Action buttons */}
  <div style={{ display: "flex", gap: 8, paddingBottom: 4 }}>
    <button onClick={handleFollow} disabled={followLoading}
      className={`flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-full shadow-sm transition-all disabled:opacity-60 ${followBtnConfig.cls}`}>
      {followLoading ? <Loader2 size={14} className="animate-spin" /> : followBtnConfig.icon}
      {followBtnConfig.label}
    </button>
    {followState === "following" && (
      <button className="flex items-center gap-1.5 bg-white border-2 border-[#ddd0c0] text-[#5a3e2b] text-sm font-semibold px-5 py-2.5 rounded-full shadow-sm hover:bg-[#f5ece0] transition-all">
        Message
      </button>
    )}
  </div>
</div>   

        {/* PROFILE INFO */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold text-[#2d1f0f]">{profile.fullName}</h1>
            {profile.isVerifiedBadge && <BadgeCheck size={20} className="text-blue-500" />}
          </div>
          <p className="text-sm text-[#8b6343] font-medium mb-1.5">@{profile.username}</p>

          {profile.designation && (
            <p className="text-sm text-[#5a3e2b] font-medium mb-1">{profile.designation}</p>
          )}
          {profile.bio && (
            <p className="text-sm text-[#4a3828] leading-relaxed mb-2">{profile.bio}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-2">
            {(profile.location?.city || profile.location?.country) && (
              <span className="flex items-center gap-1 text-xs text-[#8b7355]">
                <MapPin size={12} />
                {[profile.location.city, profile.location.state, profile.location.country].filter(Boolean).join(", ")}
              </span>
            )}
            {profile.businessCategory && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#f0e4d4] text-[#5a3e2b] capitalize">
                {profile.businessCategory}
              </span>
            )}
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: "Posts",     value: profile.postsCount     ?? posts.length },
{ label: "Followers", value: profile.followersCount ?? 0, onClick: () => {
  setFollowModal("followers");
  window.history.pushState({}, "", `?modal=followers`);
}},
{ label: "Following", value: profile.followingCount ?? 0, onClick: () => {
  setFollowModal("following");
  window.history.pushState({}, "", `?modal=following`);
}},
          ].map((s) => (
            <div key={s.label} onClick={s.onClick} className={`bg-white rounded-2xl py-4 text-center shadow-sm border border-[#e8d5be]/60 ${s.onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}>
              <p className="text-2xl font-bold text-[#2d1f0f]">{s.value?.toLocaleString()}</p>
              <p className="text-xs text-[#8b7355] font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

         {/* POSTS GRID */}
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-20 h-20 rounded-full bg-[#f0e4d4] flex items-center justify-center">
              <Grid size={28} className="text-[#c09a6e]" />
            </div>
            <p className="text-base font-bold text-[#2d1f0f]">No posts yet</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Grid size={16} className="text-[#8b7355]" />
              <p className="text-sm font-semibold text-[#5a3e2b]">Posts</p>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {posts.map((post) => (
                <motion.div key={post._id}
                  whileHover={{ scale: 1.02 }} transition={{ duration: 0.18 }}
                  onClick={() => {
  setSelectedPost(post);
  window.history.pushState({}, "", `?post=${post._id}`);
}}
                  className="relative aspect-square rounded-lg overflow-hidden cursor-pointer bg-[#e8d5be] group">
                  {post.type === "text" ? (
                    <div className="w-full h-full flex items-center justify-center p-3 bg-[#f5ece0]">
                      <p className="text-xs font-semibold text-[#2d1f0f] text-center line-clamp-4">{post.caption}</p>
                    </div>
                  ) : (
                    <img
                      src={post.type === "reel" ? (post.media?.[0]?.thumbnailUrl || post.media?.[0]?.url) : post.media?.[0]?.url}
                      alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  )}
                  {post.type === "reel" && (
                    <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                      <Play size={10} className="text-white fill-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                    <span className="flex items-center gap-1 text-white text-xs font-bold">
                      <Heart size={14} className="fill-white" /> {post.likesCount ?? 0}
                    </span>
                    <span className="flex items-center gap-1 text-white text-xs font-bold">
                      <MessageCircle size={14} className="fill-white" /> {post.commentsCount ?? 0}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* POST MODAL */}
    <AnimatePresence>
  {selectedPost && (
    <PostModal
      post={{
        ...selectedPost,
        author: selectedPost.author || {
          _id: profile._id,
          fullName: profile.fullName,
          username: profile.username,
          avatar: profile.avatar,
        }
      }}
      onClose={() => {
  setSelectedPost(null);
  window.history.pushState({}, "", window.location.pathname);
}}
    />
  )}
</AnimatePresence>
{followModal && (
  <FollowListModal
    userId={profile?._id}
    type={followModal}
   onClose={() => {
  setFollowModal(null);
  window.history.pushState({}, "", window.location.pathname);
}}
    onUnfollow={() => {
      setProfile((p) => ({
        ...p,
        followingCount: Math.max(0, (p.followingCount || 0) - 1),
      }));
    }}
  />
)}
    </div>
  );
}