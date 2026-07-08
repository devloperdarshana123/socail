
import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer";
import ThreeGlobe from "three-globe";
import api from "../lib/services/api";

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

const VELOCITY = 1;
const dayNightShader = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    #define PI 3.141592653589793
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;
    uniform vec2 sunPosition;
    uniform vec2 globeRotation;
    varying vec3 vNormal;
    varying vec2 vUv;

    float toRad(float a) {
      return a * PI / 180.0;
    }

    vec3 polarToCartesian(vec2 c) {
      float theta = toRad(90.0 - c.x);
      float phi = toRad(90.0 - c.y);
      return vec3(
        sin(phi) * cos(theta),
        cos(phi),
        sin(phi) * sin(theta)
      );
    }

    void main() {
      float invLon = toRad(globeRotation.x);
      float invLat = -toRad(globeRotation.y);
      mat3 rotX = mat3(
        1.0, 0.0, 0.0,
        0.0, cos(invLat), -sin(invLat),
        0.0, sin(invLat), cos(invLat)
      );
      mat3 rotY = mat3(
        cos(invLon), 0.0, sin(invLon),
        0.0, 1.0, 0.0,
        -sin(invLon), 0.0, cos(invLon)
      );
      vec3 rotatedSunDirection = rotX * rotY * polarToCartesian(sunPosition);
      float intensity = dot(normalize(vNormal), normalize(rotatedSunDirection));
      vec4 dayColor = texture2D(dayTexture, vUv);
      vec4 nightColor = texture2D(nightTexture, vUv);
      float blendFactor = smoothstep(-0.1, 0.1, intensity);
      gl_FragColor = mix(nightColor, dayColor, blendFactor);
    }
  `,
};

const sunPosAt = (dt) => {
  const date = new Date(dt);
  const dayOfYear = Math.floor((date - new Date(Date.UTC(date.getUTCFullYear(), 0, 0))) / 86400000);
  const declination = 23.44 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 80));
  const hourAngle = ((date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 - 12) * 15) * (Math.PI / 180);
  const longitude = hourAngle * (180 / Math.PI);
  const latitude = declination * (180 / Math.PI);
  return [longitude, latitude];
};

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

const createHtmlElement = (seller, onSelect) => {
  const element = document.createElement("button");
  element.type = "button";
  element.style.pointerEvents = "auto";
  element.style.cursor = "pointer";
  element.style.display = "inline-flex";
  element.style.alignItems = "center";
  element.style.justifyContent = "center";
  element.style.padding = "0";
  element.style.border = "none";
  element.style.background = "transparent";
  element.style.boxShadow = "none";
  element.style.width = "12px";
  element.style.height = "12px";

  const dot = document.createElement("span");
  dot.style.width = "12px";
  dot.style.height = "12px";
  dot.style.borderRadius = "50%";
  dot.style.background = categoryColor(seller.businessCategory);
  dot.style.display = "block";
  dot.style.boxShadow = "0 0 0 2px rgba(255,255,255,0.85)";
  element.appendChild(dot);

  element.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect(seller, event);
  });

  return element;
};

export default function MapView({ searchQuery = "", selectedCategory = "all" }) {
  const navigate = useNavigate();
  const currentUser = useSelector((s) => s.auth.user);

  const globeContainer = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const labelRendererRef = useRef(null);
  const controlsRef = useRef(null);
  const globeRef = useRef(null);
  const frameRef = useRef(null);
  const globeMaterialRef = useRef(null);

  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [popupPosition, setPopupPosition] = useState({ x: 24, y: 24 });
  const [globeReady, setGlobeReady] = useState(false);

  const fetchSellers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (searchQuery.trim()) params.append("q", searchQuery.trim());

      const { data } = await api.get(`/user/map-sellers?${params}`);
      if (data.success) setSellers(jitterCoords(data.users || []));
      else throw new Error(data.message || "Failed to load sellers");
    } catch (err) {
      console.error("Globe fetch failed:", err);
      setError("Could not load sellers. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  const selectSeller = useCallback((seller, event) => {
    const rect = globeContainer.current?.getBoundingClientRect();
    if (rect && event?.clientX != null && event?.clientY != null) {
      const rawX = event.clientX - rect.left;
      const rawY = event.clientY - rect.top;
      const x = Math.min(Math.max(rawX + 12, 24), Math.max(24, rect.width - 260));
      const y = Math.min(Math.max(rawY + 12, 24), Math.max(24, rect.height - 220));
      setPopupPosition({ x, y });
    } else {
      setPopupPosition({ x: 24, y: 24 });
    }
    setSelectedSeller(seller);
  }, []);

  const handleFollow = useCallback(async (seller, e) => {
    e?.stopPropagation?.();
    const { id, isFollowing } = seller;

    setSellers((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return isFollowing
          ? { ...s, isFollowing: false, followersCount: Math.max(0, (s.followersCount || 0) - 1) }
          : { ...s, isFollowing: true, followersCount: (s.followersCount || 0) + 1 };
      })
    );

    try {
      if (isFollowing) await api.delete(`/follow/${id}`);
      else await api.post(`/follow/${id}`);
    } catch {
      setSellers((prev) => prev.map((s) => (s.id === id ? { ...s, isFollowing } : s)));
    }
  }, []);

  const handleMessage = useCallback((seller, e) => {
    e?.stopPropagation?.();
    navigate(`/messages?with=${seller.id}`);
  }, [navigate]);

  const handleViewProfile = useCallback((seller, e) => {
    e?.stopPropagation?.();
    if (seller.username) navigate(`/profile/${seller.username}`);
  }, [navigate]);

  const flyToSearch = useCallback(async (query) => {
    if (!query?.trim() || !globeRef.current || !cameraRef.current || !controlsRef.current) return;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { "User-Agent": "Erovians/1.0" } }
      );
      const data = await res.json();
      if (!data?.[0]) return;

      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      const coords = globeRef.current.getCoords(lat, lng, 220);
      cameraRef.current.position.set(coords.x, coords.y, coords.z);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
      globeRef.current.setPointOfView(cameraRef.current);
    } catch {
      // silent fallback
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSellers();
      if (searchQuery) flyToSearch(searchQuery);
    }, searchQuery ? 400 : 0);
    return () => clearTimeout(timer);
  }, [fetchSellers, flyToSearch, searchQuery]);

  useEffect(() => {
    const container = globeContainer.current;
    if (!container) return;

    try {
      container.replaceChildren();

      const scene = new THREE.Scene();
      scene.background = null;
      const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2000);
      camera.position.set(0, 0, 270);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      container.appendChild(renderer.domElement);

      const labelRenderer = new CSS2DRenderer();
      labelRenderer.setSize(container.clientWidth, container.clientHeight);
      labelRenderer.domElement.style.position = "absolute";
      labelRenderer.domElement.style.top = "0";
      labelRenderer.domElement.style.left = "0";
      labelRenderer.domElement.style.pointerEvents = "none";
      container.appendChild(labelRenderer.domElement);

      const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(150, 100, 100);
      scene.add(ambientLight, directionalLight);

      const globe = new ThreeGlobe({ waitForGlobeReady: false })
        .showAtmosphere(false)
        .pointsData([])
        .pointLat("lat")
        .pointLng("lng")
        .pointColor(() => "#fdbf5a")
        .pointAltitude(0.015)
        .pointRadius(0.3)
        .pointsTransitionDuration(0)
        .htmlElementsData([])
        .htmlLat("lat")
        .htmlLng("lng")
        .htmlAltitude(0.01)
        .htmlElement((seller) => createHtmlElement(seller, selectSeller));

      scene.add(globe);

      const textureLoader = new THREE.TextureLoader();
      Promise.all([
        textureLoader.loadAsync("https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg"),
        textureLoader.loadAsync("https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg"),
      ])
        .then(([dayTexture, nightTexture]) => {
          const material = new THREE.ShaderMaterial({
            uniforms: {
              dayTexture: { value: dayTexture },
              nightTexture: { value: nightTexture },
              sunPosition: { value: new THREE.Vector2() },
              globeRotation: { value: new THREE.Vector2() },
            },
            vertexShader: dayNightShader.vertexShader,
            fragmentShader: dayNightShader.fragmentShader,
          });
          globe.globeMaterial(material);
          globeMaterialRef.current = material;
        })
        .catch((err) => {
          console.warn("Unable to load globe textures", err);
        });

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.45;
      controls.zoomSpeed = 0.7;
      controls.minDistance = 100 / Math.tan((camera.fov * Math.PI / 180) / 2) + 24;
      controls.maxDistance = 500;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.25;
      controls.addEventListener("change", () => {
        globe.setPointOfView(camera);
        const { lng, lat } = globe.toGeoCoords(camera.position);
        if (globeMaterialRef.current) {
          globeMaterialRef.current.uniforms.globeRotation.value.set(lng, lat);
        }
      });

      const animate = () => {
        controls.update();
        globe.setPointOfView(camera);
        if (globeMaterialRef.current) {
          globeMaterialRef.current.uniforms.sunPosition.value.set(...sunPosAt(Date.now()));
        }
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
        frameRef.current = requestAnimationFrame(animate);
      };
      animate();

      const handleResize = () => {
        if (!container) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        controls.minDistance = 100 / Math.tan((camera.fov * Math.PI / 180) / 2) + 24;
        renderer.setSize(width, height);
        labelRenderer.setSize(width, height);
      };
      window.addEventListener("resize", handleResize);

      sceneRef.current = scene;
      cameraRef.current = camera;
      rendererRef.current = renderer;
      labelRendererRef.current = labelRenderer;
      controlsRef.current = controls;
      globeRef.current = globe;
      setGlobeReady(true);
      setError(null);

      return () => {
        window.removeEventListener("resize", handleResize);
        cancelAnimationFrame(frameRef.current);
        controls.dispose();
        renderer.dispose();
        labelRenderer.domElement.remove();
        renderer.domElement.remove();
        container.replaceChildren();
      };
    } catch (err) {
      console.error("Unable to initialize globe", err);
      setGlobeReady(false);
      setError("The globe view is unavailable right now.");
    }
  }, [selectSeller]);

  useEffect(() => {
    if (!globeRef.current) return;

    const points = jitterCoords(sellers)
      .map((seller) => {
        const coords = seller.location?.coordinates?.coordinates;
        if (!coords || coords.length < 2) return null;
        return {
          ...seller,
          lat: coords[1],
          lng: coords[0],
        };
      })
      .filter(Boolean);

    globeRef.current
      .pointsData(points)
      .htmlElementsData(points)
      .pointColor((seller) =>
        seller.id === currentUser?.id ? "#22c55e" : categoryColor(seller.businessCategory)
      );
  }, [sellers, currentUser]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {loading && (
        <div style={{
          position: "absolute", top: 12, left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          background: "rgba(255,255,255,0.95)",
          padding: "8px 16px",
          borderRadius: 24,
          fontSize: 13,
          fontWeight: 600,
          color: "#1e3a5f",
          boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
        }}>
          Searching sellers...
        </div>
      )}

      {error && !loading && (
        <div style={{
          position: "absolute", top: 12, left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          background: "#fee2e2",
          padding: "8px 16px",
          borderRadius: 24,
          fontSize: 13,
          fontWeight: 600,
          color: "#991b1b",
          boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
          cursor: "pointer",
        }} onClick={fetchSellers}>
          ⚠️ {error} — click to retry
        </div>
      )}

      {error && !globeReady && !loading && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 5,
          background: "rgba(255,255,255,0.86)",
          color: "#4b4a45",
          textAlign: "center",
          padding: 24,
          fontSize: 14,
          fontWeight: 600,
        }}>
          {error}
        </div>
      )}

      <div
        ref={globeContainer}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "8%",
          transform: "translateX(-50%)",
          width: "58%",
          height: "16%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(15, 23, 42, 0.28) 0%, rgba(15, 23, 42, 0.02) 70%, transparent 100%)",
          filter: "blur(6px)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {selectedSeller && (
        <div style={{
          position: "absolute",
          left: popupPosition.x,
          top: popupPosition.y,
          zIndex: 20,
          width: "min(360px, calc(100% - 32px))",
          background: "rgba(255,255,255,0.98)",
          borderRadius: 24,
          border: "1px solid rgba(229,231,235,0.9)",
          boxShadow: "0 20px 60px rgba(15,23,42,0.12)",
          padding: "18px",
          transform: "translate(-50%, -110%)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <SellerAvatar seller={selectedSeller} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>
                  {selectedSeller.fullName}
                </div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  {selectedSeller.designation || "Erovians member"}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSeller(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#6b7280",
                cursor: "pointer",
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              x
            </button>
          </div>

          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {selectedSeller.businessCategory && (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 10px",
                borderRadius: 999,
                background: categoryColor(selectedSeller.businessCategory) + "18",
                color: categoryColor(selectedSeller.businessCategory),
              }}>
                {selectedSeller.businessCategory}
              </span>
            )}
            {(selectedSeller.location?.city || selectedSeller.location?.country) && (
              <span style={{
                fontSize: 12,
                color: "#6b7280",
              }}>
                📍 {[selectedSeller.location?.city, selectedSeller.location?.country].filter(Boolean).join(", ")}
              </span>
            )}
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {!currentUser || currentUser.id !== selectedSeller.id ? (
              <>
                <button
                  type="button"
                  onClick={(e) => handleFollow(selectedSeller, e)}
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "none",
                    background: selectedSeller.isFollowing ? "#f3f4f6" : "#1e3a5f",
                    color: selectedSeller.isFollowing ? "#374151" : "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {selectedSeller.isFollowing ? "Following" : "Follow"}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleMessage(selectedSeller, e)}
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid #1e3a5f",
                    background: "#fff",
                    color: "#1e3a5f",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Message
                </button>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>
                This is you.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => handleViewProfile(selectedSeller, e)}
            style={{
              width: "100%",
              marginTop: 12,
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#111827",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            View Profile
          </button>
        </div>
      )}
    </div>
  );
}
