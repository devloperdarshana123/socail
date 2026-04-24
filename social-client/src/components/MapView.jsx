

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useNavigate } from "react-router-dom";

import api from "../services/api";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9001";

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
  CATEGORIES.find((c) => c.value === cat)?.color || "#1e3a5f";

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

function FlyTo({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo([coords[1], coords[0]], 6, { animate: true });
  }, [coords]);
  return null;
}

export default function MapView({ searchQuery, selectedCategory, onSellerClick, onSearchChange, onCategoryChange }) {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState([]);
  const [userCoords, setUserCoords] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchSellers = async (lat, lng) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("erosocial_token");
      const params = { category: selectedCategory || "all" };
      if (lat && lng) { params.lat = lat; params.lng = lng; }
      const res = await axios.get(`${BASE_URL}/api/marketplace/sellers`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setSellers(res.data.sellers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = [pos.coords.longitude, pos.coords.latitude];
          setUserCoords(coords);
          fetchSellers(pos.coords.latitude, pos.coords.longitude);
          const token = localStorage.getItem("erosocial_token");
          axios.put(`${BASE_URL}/api/marketplace/location`,
            { lat: pos.coords.latitude, lng: pos.coords.longitude },
            { headers: { Authorization: `Bearer ${token}` } }
          ).catch(() => {});
        },
        () => fetchSellers()
      );
    } else {
      fetchSellers();
    }
  }, []);

  useEffect(() => {
    fetchSellers(
      userCoords ? userCoords[1] : null,
      userCoords ? userCoords[0] : null
    );
  }, [selectedCategory]);

  const filtered = sellers.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.designation?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q) ||
      s.country?.toLowerCase().includes(q) ||
      s.businessCategory?.toLowerCase().includes(q)
    );
  });

  const handleFollow = async (sellerId, isPending, isFollowing, e) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem("erosocial_token");
      if (isFollowing) {
        await axios.delete(`${BASE_URL}/api/follow/${sellerId}/unfollow`,
          { headers: { Authorization: `Bearer ${token}` } });
      } else if (isPending) {
        await axios.delete(`${BASE_URL}/api/follow/${sellerId}/cancel`,
          { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post(`${BASE_URL}/api/follow/${sellerId}/send`, {},
          { headers: { Authorization: `Bearer ${token}` } });
      }
      fetchSellers(
        userCoords ? userCoords[1] : null,
        userCoords ? userCoords[0] : null
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>

      {loading && (
        <div style={{
          position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "#fff", padding: "6px 16px",
          borderRadius: 999, fontSize: 12, color: "#1e3a5f",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)", border: "1px solid #e5e7eb",
        }}>
          Loading sellers...
        </div>
      )}

      <MapContainer
  center={[20, 78]} zoom={5}
  minZoom={4}
  maxZoom={18}
  style={{ width: "100%", height: "100%" }}
  zoomControl={true}
>

        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        

        {userCoords && <FlyTo coords={userCoords} />}

        {filtered.map((seller) => {
          const [lng, lat] = seller.coordinates;
          if (!lat || !lng) return null;
          const color = categoryColor(seller.businessCategory);

          return (
            <Marker key={seller._id} position={[lat, lng]} icon={makeIcon(color)}>
              <Popup minWidth={240} maxWidth={280}>
                <div style={{ fontFamily: "sans-serif" }}>

                  {/* Header */}
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                    {seller.avatar ? (
                      <img src={seller.avatar} alt={seller.name}
                        style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%",
                        background: "#f0e8df", color: "#6b3f2a",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: "bold", fontSize: 16,
                      }}>
                        {seller.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{seller.name}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        {seller.designation || "EroSocial Member"}
                      </div>
                    </div>
                  </div>

                  {/* Category + Location */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{
                      fontSize: 11, padding: "2px 10px", borderRadius: 999,
                      background: color + "18", color, fontWeight: 600,
                    }}>
                      {seller.businessCategory}
                    </span>
                    {(seller.city || seller.country) && (
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>
                        📍 {[seller.city, seller.country].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>
                    {seller.followersCount} followers
                  </div>

                  {/* Action Buttons */}
                  {/* Action Buttons */}
<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
  <div style={{ display: "flex", gap: 6 }}>
    <button
      onClick={(e) => handleFollow(seller._id, seller.isPending, seller.isFollowing, e)}
      style={{
        flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12,
        fontWeight: 600, border: "none", cursor: "pointer",
        background: seller.isFollowing ? "#f3f4f6" : seller.isPending ? "#fef3c7" : "#1e3a5f",
        color: seller.isFollowing ? "#374151" : seller.isPending ? "#92400e" : "#fff",
      }}
    >
      {seller.isFollowing ? "Following" : seller.isPending ? "Requested" : "Follow"}
    </button>

    {seller.isFollowing && (
      <button
        onClick={() => navigate(`/messages/${seller._id}`)}
        style={{
          flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12,
          fontWeight: 600, border: "1.5px solid #1e3a5f",
          background: "#fff", color: "#1e3a5f", cursor: "pointer",
        }}
      >
        Message
      </button>
    )}
  </div>

  <button
    onClick={() => navigate(`/user/${seller._id}`)}
    style={{
      width: "100%", padding: "7px 0", borderRadius: 8, fontSize: 12,
      fontWeight: 600, border: "1.5px solid #e5e7eb",
      background: "#fff", color: "#374151", cursor: "pointer",
    }}
  >
    View Profile
  </button>
</div>

                </div>
              </Popup>
            </Marker>
          );
        })}

      </MapContainer>
    </div>
  );
}