
import { useEffect, useState, useCallback , useRef} from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useSelector } from "react-redux";
import api from "../lib/services/api";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
const CATEGORIES = [
  { value: "all",       label: "All",       color: "#1e3a5f" },
  { value: "marble",    label: "Marble",    color: "#7c3aed" },
  { value: "granite",   label: "Granite",   color: "#b45309" },
  { value: "limestone", label: "Limestone", color: "#0369a1" },
  { value: "cnc",       label: "CNC",       color: "#065f46" },
  { value: "quarry",    label: "Quarry",    color: "#9f1239" },
  { value: "supplier",  label: "Supplier",  color: "#1d4ed8" },
  { value: "designer",  label: "Designer",  color: "#be185d" },
  { value: "other",     label: "Other",     color: "#374151" },
];

const categoryColor = (cat) =>
  CATEGORIES.find((c) => c.value === cat?.toLowerCase())?.color || "#1e3a5f";

const jitterCoords = (sellers) => {
  const seen = {};
  return sellers.map((seller) => {
    const coords = seller.location?.coordinates?.coordinates;
    if (!coords || coords.length < 2) return seller;

    const [lng, lat] = coords;
    const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;

    seen[key] = (seen[key] || 0) + 1;
    const count = seen[key];

    if (count === 1) return seller;

    const angle = (count - 1) * (137.5 * Math.PI / 180);
    const radius = 0.03 * Math.ceil((count - 1) / 8);
    const jLat = lat + radius * Math.sin(angle);
    const jLng = lng + radius * Math.cos(angle);

    return {
      ...seller,
      location: {
        ...seller.location,
        coordinates: {
          ...seller.location.coordinates,
          coordinates: [jLng, jLat],
        },
      },
    };
  });
};

const makeIcon = (color) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};
      border:2px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.25);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

// ─────────────────────────────────────────────
//  Avatar
// ─────────────────────────────────────────────
const SellerAvatar = ({ seller }) => {
  if (seller.avatar?.url) {
    return (
      <img
        src={seller.avatar.url}
        alt={seller.fullName}
        style={{
          width: 40, height: 40, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0,
        }}
        onError={(e) => { e.target.style.display = "none"; }}
      />
    );
  }
  return (
    <div style={{
      width: 40, height: 40, borderRadius: "50%",
      background: "#f0e8df", color: "#6b3f2a",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: "bold", fontSize: 16, flexShrink: 0,
    }}>
      {seller.fullName?.charAt(0).toUpperCase() || "?"}
    </div>
  );
};

// ─────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────
export default function MapView({ searchQuery = "", selectedCategory = "all" }) {
  const navigate   = useNavigate();
 
  const currentUser = useSelector((s) => s.auth.user);
const mapRef = useRef(null);
  const [sellers,  setSellers]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  // ── Fetch sellers from DB ──────────────────────────────────
  const fetchSellers = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const params = new URLSearchParams();
    if (selectedCategory !== "all") params.append("category", selectedCategory);
    if (searchQuery.trim())         params.append("q", searchQuery.trim());

    const { data } = await api.get(`/user/map-sellers?${params}`);
    // if (data.success) setSellers(data.users || []);
    if (data.success) setSellers(jitterCoords(data.users || []));
    else throw new Error(data.message || "Failed to load sellers");
  } catch (err) {
    console.error("Map fetch failed:", err);
    setError("Could not load sellers. Please try again.");
  } finally {
    setLoading(false);
  }
}, [searchQuery, selectedCategory]);

  // useEffect(() => {
  //   // Debounce search queries
  //   const timer = setTimeout(fetchSellers, searchQuery ? 400 : 0);
  //   return () => clearTimeout(timer);
  // }, [fetchSellers, searchQuery]);

  const flyToSearch = useCallback(async (query) => {
    if (!query?.trim() || !mapRef.current) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { "User-Agent": "Erovians/1.0" } }
      );
      const data = await res.json();
      if (data?.[0]) {
       const zoom = 
          data[0].type === "country" ? 5 :
          data[0].type === "state" ? 7 :
          data[0].type === "city" ? 10 : 8;

        mapRef.current.setView(
          [parseFloat(data[0].lat), parseFloat(data[0].lon)],
          zoom
        );
      }
    } catch {}
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSellers();
      if (searchQuery) flyToSearch(searchQuery);
    }, searchQuery ? 400 : 0);
    return () => clearTimeout(timer);
  }, [fetchSellers, flyToSearch, searchQuery]);

  // ── Follow / Unfollow ─────────────────────────────────────
 const handleFollow = async (seller, e) => {
  e.stopPropagation();
  const { id, isFollowing } = seller;

  // Optimistic update
  setSellers((prev) =>
    prev.map((s) => {
      if (s.id !== id) return s;
      return isFollowing
        ? { ...s, isFollowing: false, followersCount: Math.max(0, (s.followersCount || 0) - 1) }
        : { ...s, isFollowing: true,  followersCount: (s.followersCount || 0) + 1 };
    })
  );

  try {
    if (isFollowing) {
      await api.delete(`/follow/${id}`);
    } else {
      await api.post(`/follow/${id}`);
    }
  } catch {
    // Rollback on failure
    setSellers((prev) =>
      prev.map((s) => s.id === id ? { ...s, isFollowing } : s)
    );
  }
};

  // ── Message ───────────────────────────────────────────────
const handleMessage = (seller, e) => {
  e.stopPropagation();
  navigate(`/messages?with=${seller.id}`);
};

  // ── View Profile ──────────────────────────────────────────
  const handleViewProfile = (seller, e) => {
    e.stopPropagation();
    if (seller.username) navigate(`/profile/${seller.username}`);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>

      {/* Loading indicator */}
      {loading && (
        <div style={{
          position: "absolute", top: 12, left: "50%",
          transform: "translateX(-50%)", zIndex: 1000,
          background: "rgba(255,255,255,0.95)",
          padding: "6px 16px", borderRadius: 20,
          fontSize: 12, fontWeight: 600, color: "#1e3a5f",
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: "50%",
            border: "2px solid #1e3a5f",
            borderTopColor: "transparent",
            display: "inline-block",
            animation: "spin 0.7s linear infinite",
          }} />
          Searching...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error indicator */}
      {error && !loading && (
        <div style={{
          position: "absolute", top: 12, left: "50%",
          transform: "translateX(-50%)", zIndex: 1000,
          background: "#fee2e2", padding: "6px 16px",
          borderRadius: 20, fontSize: 12, fontWeight: 600,
          color: "#991b1b", boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
          cursor: "pointer",
        }} onClick={fetchSellers}>
          ⚠️ {error} — Click to retry
        </div>
      )}

      {/* No results */}
      {!loading && !error && sellers.length === 0 && (
        <div style={{
          position: "absolute", top: 12, left: "50%",
          transform: "translateX(-50%)", zIndex: 1000,
          background: "rgba(255,255,255,0.95)",
          padding: "6px 16px", borderRadius: 20,
          fontSize: 12, fontWeight: 600, color: "#6b7280",
          boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
        }}>
          No sellers found in this area yet
        </div>
      )}

      <MapContainer
         ref={mapRef}
        center={[22, 78]}
        zoom={4}
        minZoom={2}
        maxZoom={18}
        scrollWheelZoom={true}
        dragging={true}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1.0}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {sellers.map((seller) => {
          const coords = seller.location?.coordinates?.coordinates;
          if (!coords || coords.length < 2) return null;

          const [lng, lat] = coords;
          if (!lat || !lng) return null;

          const color    = categoryColor(seller.businessCategory);
          const isMe     = currentUser?.id === seller.id;
          const city     = seller.location?.city;
          const country  = seller.location?.country;

          return (
            <Marker
              key={seller.id}
              position={[lat, lng]}
              icon={makeIcon(isMe ? "#22c55e" : color)}
            >
              <Popup minWidth={240} maxWidth={280}>
                <div style={{ fontFamily: "sans-serif" }}>

                  {/* Header */}
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                    <SellerAvatar seller={seller} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 700, fontSize: 13,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {seller.fullName}
                        {seller.isVerifiedBadge && (
                          <span style={{ marginLeft: 4, color: "#3b82f6", fontSize: 12 }}>✓</span>
                        )}
                        {isMe && (
                          <span style={{ marginLeft: 4, fontSize: 10, color: "#22c55e", fontWeight: 600 }}>You</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        {seller.designation || "Erovians Member"}
                      </div>
                    </div>
                  </div>

                  {/* Category + Location */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {seller.businessCategory && (
                      <span style={{
                        fontSize: 11, padding: "2px 10px", borderRadius: 999,
                        background: color + "18", color, fontWeight: 600,
                        textTransform: "capitalize",
                      }}>
                        {seller.businessCategory}
                      </span>
                    )}
                    {(city || country) && (
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>
                        📍 {[city, country].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>
                    {seller.followersCount ?? 0} followers
                  </div>

                  {/* Action Buttons */}
                  {!isMe && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={(e) => handleFollow(seller, e)}
                          style={{
                            flex: 1, padding: "7px 0", borderRadius: 8,
                            fontSize: 12, fontWeight: 600, border: "none",
                            cursor: "pointer",
                            background: seller.isFollowing ? "#f3f4f6" : "#1e3a5f",
color: seller.isFollowing ? "#374151" : "#fff",
                            transition: "opacity 0.2s",
                          }}
                        >
                        {seller.isFollowing ? "Following" : "Follow"}
                        </button>

                      <button
  onClick={(e) => handleMessage(seller, e)}
  style={{
    flex: 1, padding: "7px 0", borderRadius: 8,
    fontSize: 12, fontWeight: 600,
    border: "1.5px solid #1e3a5f",
    background: "#fff", color: "#1e3a5f", cursor: "pointer",
  }}
>
  Message
</button>
                      </div>

                      <button
                        onClick={(e) => handleViewProfile(seller, e)}
                        style={{
                          width: "100%", padding: "7px 0", borderRadius: 8,
                          fontSize: 12, fontWeight: 600,
                          border: "1.5px solid #e5e7eb",
                          background: "#fff", color: "#374151", cursor: "pointer",
                        }}
                      >
                        View Profile
                      </button>
                    </div>
                  )}

                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}