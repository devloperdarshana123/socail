
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import toast from "react-hot-toast";
import { Send, UserCheck, UserPlus, ArrowLeft, MapPin } from "lucide-react";
import { toggleFollowRequest, fetchSentFollowRequests } from "../store/slices/Exploreslice";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9001";

const Avatar = ({ src, name, size = 72 }) =>
  src ? (
    <img src={src} alt={name}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover",
        border: "3px solid #fff", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }} />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, #c8956c, #a07050)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, color: "#fff",
      border: "3px solid #fff", boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
      flexShrink: 0,
    }}>
      {name?.charAt(0).toUpperCase()}
    </div>
  );

export default function UserProfile() {
  const { userId } = useParams();
  const navigate   = useNavigate();
  const dispatch   = useDispatch();
  const { user: me } = useAuth();
  const { pendingRequests } = useSelector((s) => s.explore);

  const [profile, setProfile]         = useState(null);
  const [stats, setStats]             = useState({});
  const [posts, setPosts]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  useEffect(() => {
    dispatch(fetchSentFollowRequests());
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("erosocial_token");
      const headers = { Authorization: `Bearer ${token}` };
      const [profileRes, postsRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/auth/users/${userId}`, { headers }),
        axios.get(`${BASE_URL}/api/posts/user/${userId}`, { headers }),
      ]);
      setProfile(profileRes.data.user);
      setStats(profileRes.data.stats);
      setPosts(postsRes.data.posts || []);
      setIsFollowing(profileRes.data.user?.followers?.some(
        (f) => f?.toString() === me?._id?.toString()
      ));
    } catch {
     toast.error("Failed to load profile!");
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    const isPending = pendingRequests.includes(userId);
    const res = await dispatch(toggleFollowRequest({ userId, isPending }));
    if (toggleFollowRequest.fulfilled.match(res)) {
      toast.success(isPending ? "Request canceled!" : "Follow request sent!");
      fetchProfile();
    } else toast.error(res.payload || "Request failed!");
  };

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh" }}>
      <div style={{ width:32, height:32, border:"2px solid #e5e7eb",
        borderTop:"2px solid #c8956c", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!profile) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", minHeight:"60vh", gap:12 }}>
      <p style={{ color:"#9ca3af", fontSize:14 }}>User not found</p>
      <button onClick={() => navigate(-1)}
        style={{ fontSize:12, color:"#c8956c", background:"none", border:"none", cursor:"pointer" }}>
        Go back
      </button>
    </div>
  );

  const isPending = pendingRequests.includes(userId);
  const isSelf    = me?._id?.toString() === userId;
  const shownPost = selectedPost || null;

  return (
  <div style={{ maxWidth: 960, margin: "0 auto", paddingBottom: 48, padding: "0 24px 48px" }}>

      {/* Back */}
      <button onClick={() => navigate(-1)}
        style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:"#9ca3af",
          background:"none", border:"none", cursor:"pointer", marginBottom:16, padding:0 }}>
        <ArrowLeft size={15} /> Back
      </button>

      {/* ── Cover Photo ── */}
      <div style={{ borderRadius:"16px 16px 0 0", overflow:"hidden", height:220,
        background:"linear-gradient(135deg,#1e3a5f,#c8956c)" }}>
        {profile.coverPhoto && (
          <img src={profile.coverPhoto} alt="cover"
            style={{ width:"100%", height:"100%", objectFit:"cover" }} />
        )}
      </div>

      {/* ── Profile Card ── */}
      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:"0 0 16px 16px",
        padding:"0 24px 24px", marginBottom:12 }}>

        {/* Avatar + action row */}
 <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between",
  marginTop:-40, marginBottom:14 }}>
          <Avatar src={profile.avatar} name={profile.name} size={80} />
          {!isSelf && (
            <div style={{ display:"flex", gap:8, paddingBottom:4, marginTop: 16 }}>
              <button onClick={handleFollow} style={{
                display:"flex", alignItems:"center", gap:6,
                padding:"8px 18px", borderRadius:8, fontSize:13, fontWeight:600,
                border:"none", cursor:"pointer",
                background: isFollowing?"#f3f4f6": isPending?"#fef3c7":"#1e3a5f",
                color: isFollowing?"#374151": isPending?"#92400e":"#fff",
              }}>
                {isFollowing ? <UserCheck size={14}/> : <UserPlus size={14}/>}
                {isFollowing ? "Following" : isPending ? "Requested" : "Follow"}
              </button>
              {isFollowing && (
                <button onClick={() => navigate(`/messages/${userId}`)} style={{
                  display:"flex", alignItems:"center", gap:6,
                  padding:"8px 18px", borderRadius:8, fontSize:13, fontWeight:600,
                  border:"1.5px solid #e5e7eb", background:"#fff", color:"#374151", cursor:"pointer",
                }}>
                  <Send size={14}/> Message
                </button>
              )}
            </div>
          )}
        </div>

        {/* Location */}
        {(profile.location?.city || profile.location?.country) && (
          <p style={{ fontSize:12, color:"#9ca3af", marginBottom:3,
            display:"flex", alignItems:"center", gap:4 }}>
            <MapPin size={11}/>
            {[profile.location?.city, profile.location?.country].filter(Boolean).join(", ")}
          </p>
        )}

        {/* Name */}
        <h1 style={{ fontSize:22, fontWeight:700, color:"#1c1917", margin:"0 0 2px" }}>
          {profile.name}
        </h1>
        <p style={{ fontSize:13, color:"#78716c", margin:"0 0 12px" }}>
          {profile.designation?.trim() || "EroSocial Member"}
        </p>

        {/* Bio */}
        {profile.bio && (
          <p style={{ fontSize:13, color:"#57534e", lineHeight:1.7, marginBottom:14 }}>
            {profile.bio}
          </p>
        )}

        {/* Stats pills */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
          {[["posts", stats.posts], ["followers", stats.followers], ["following", stats.following]].map(([l,v]) => (
            <span key={l} style={{ fontSize:12, color:"#78716c", padding:"3px 12px",
              background:"#f5f5f4", borderRadius:6, border:"1px solid #e5e7eb" }}>
              <strong style={{ color:"#1c1917" }}>{v ?? 0}</strong> {l}
            </span>
          ))}
        </div>

        {/* Interests */}
        {profile.interests?.length > 0 && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
            {profile.interests.map((tag, i) => (
              <span key={i} style={{ fontSize:12, color:"#1e3a5f", padding:"3px 10px",
                background:"#eff6ff", borderRadius:6, border:"1px solid #bfdbfe" }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Business category */}
        {profile.businessCategory && (
          <span style={{ fontSize:12, fontWeight:600, color:"#c8956c",
            padding:"3px 12px", background:"#fff7ed",
            borderRadius:999, border:"1px solid #fed7aa" }}>
            {profile.businessCategory}
          </span>
        )}

        {/* Back to feed */}
        <div style={{ marginTop:20 }}>
          <button onClick={() => navigate(-1)} style={{
            width:"100%", padding:"10px 0", fontSize:13, fontWeight:500,
            color:"#374151", background:"#fff", border:"1px solid #e5e7eb",
            borderRadius:8, cursor:"pointer",
          }}>
            ← Return to feed
          </button>
        </div>
      </div>

      {/* ── Posts Summary ── */}
      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:16,
        padding:"18px 24px", marginBottom:12 }}>
        <p style={{ fontSize:10, fontWeight:700, color:"#9ca3af",
          letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>
         Posts Overview
        </p>
        <h2 style={{ fontSize:18, fontWeight:700, color:"#1c1917", margin:"0 0 4px" }}>
          {posts.length} publication{posts.length !== 1 ? "s" : ""} visible{posts.length !== 1 ? "s" : ""}
        </h2>
        {posts[0]?.caption && (
          <p style={{ fontSize:12, color:"#78716c", margin:0 }}>
            Dernier contenu: {posts[0].caption?.slice(0, 80)}{posts[0].caption?.length > 80 ? "..." : ""}
          </p>
        )}
      </div>

      {/* ── 4-col Posts Grid ── */}
      {posts.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)",
          gap:4, marginBottom:12 }}>
          {posts.map((post) => (
            <div key={post._id} onClick={() => setSelectedPost(post)}
              style={{ aspectRatio:"1/1", borderRadius:8, overflow:"hidden",
                background:"#f5f5f4", cursor:"pointer", position:"relative" }}
              onMouseEnter={(e) => { const o = e.currentTarget.querySelector(".ov"); if(o) o.style.opacity=1; }}
              onMouseLeave={(e) => { const o = e.currentTarget.querySelector(".ov"); if(o) o.style.opacity=0; }}>
              {post.image ? (
                <img src={post.image} alt="post"
                  style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              ) : (
                <div style={{ width:"100%", height:"100%", display:"flex",
                  alignItems:"center", justifyContent:"center", padding:8 }}>
                  <p style={{ fontSize:10, color:"#9ca3af", textAlign:"center",
                    overflow:"hidden", display:"-webkit-box",
                    WebkitLineClamp:4, WebkitBoxOrient:"vertical" }}>
                    {post.caption}
                  </p>
                </div>
              )}
              <div className="ov" style={{ position:"absolute", inset:0,
                background:"rgba(0,0,0,0.45)", opacity:0, transition:"opacity 0.2s",
                display:"flex", alignItems:"center", justifyContent:"center",
                gap:12, color:"#fff", fontSize:12, fontWeight:600 }}>
                <span>❤️ {post.likes?.length || 0}</span>
                <span>💬 {post.comments?.length || 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Selected / Latest Post Detail ── */}
      {shownPost && (
        <div style={{ background:"#fff", border:"1px solid #e5e7eb",
          borderRadius:16, overflow:"hidden" }}>
          <div style={{ padding:"14px 20px", borderBottom:"1px solid #f5f5f4" }}>
            <p style={{ fontSize:10, fontWeight:700, color:"#9ca3af",
              letterSpacing:"0.08em", textTransform:"uppercase", margin:"0 0 4px" }}>
              POST · {profile.name?.toUpperCase()}
              {(profile.location?.city || profile.location?.country)
                ? ` · ${[profile.location?.city, profile.location?.country].filter(Boolean).join(", ").toUpperCase()}`
                : ""}
            </p>
            {shownPost.caption && (
              <h3 style={{ fontSize:15, fontWeight:700, color:"#1c1917", margin:"0 0 4px" }}>
                {shownPost.caption?.slice(0, 60)}{shownPost.caption?.length > 60 ? "..." : ""}
              </h3>
            )}
            {shownPost.caption?.length > 60 && (
              <p style={{ fontSize:12, color:"#78716c", margin:0 }}>{shownPost.caption}</p>
            )}
          </div>
          {shownPost.image && (
            <img src={shownPost.image} alt="post"
              style={{ width:"100%", maxHeight:360, objectFit:"cover" }} />
          )}
          <div style={{ display:"flex", gap:8, padding:"14px 20px" }}>
            <button onClick={() => setSelectedPost(null)} style={{
              padding:"8px 20px", borderRadius:8, fontSize:13, fontWeight:600,
              border:"1.5px solid #e5e7eb", background:"#fff",
              color:"#374151", cursor:"pointer",
            }}>
              Detail
            </button>
            <button onClick={() => navigate("/")} style={{
              padding:"8px 20px", borderRadius:8, fontSize:13, fontWeight:600,
              border:"none", background:"#1e3a5f", color:"#fff", cursor:"pointer",
            }}>
              Feed
            </button>
          </div>
        </div>
      )}

    </div>
  );
}