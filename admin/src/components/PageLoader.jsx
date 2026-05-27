// client/src/components/PageLoader.jsx
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

// ── Progress Bar ──────────────────────────────────────────────────────────────
function TopProgressBar({ active }) {
  const [width, setWidth]     = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      setVisible(true);
      setWidth(0);
      requestAnimationFrame(() => requestAnimationFrame(() => setWidth(30)));
      const t1 = setTimeout(() => setWidth(65), 150);
      const t2 = setTimeout(() => setWidth(85), 600);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else {
      setWidth(100);
      const hide = setTimeout(() => { setVisible(false); setWidth(0); }, 300);
      return () => clearTimeout(hide);
    }
  }, [active]);

  if (!visible) return null;

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, height:"2.5px", zIndex:9999, pointerEvents:"none" }}>
      <div style={{ width:"100%", height:"100%", background:"rgba(139,92,246,0.12)" }} />
      <div style={{
        position:"absolute", top:0, left:0, height:"100%",
        width:`${width}%`,
        background:"linear-gradient(90deg, #7c3aed, #8b5cf6, #a78bfa)",
        borderRadius:"0 2px 2px 0",
        transition: width === 100
          ? "width 0.25s cubic-bezier(0.4,0,0.2,1)"
          : width <= 30
          ? "width 0.2s cubic-bezier(0.4,0,0.2,1)"
          : "width 0.8s cubic-bezier(0.1,0,0.4,1)",
        boxShadow:"0 0 8px rgba(139,92,246,0.6), 0 0 2px rgba(167,139,250,0.8)",
      }} />
    </div>
  );
}

// ── Content Overlay ───────────────────────────────────────────────────────────
function ContentOverlay({ active }) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setOpacity(1), 80);
      return () => clearTimeout(t);
    } else {
      setOpacity(0);
    }
  }, [active]);

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9998,
      background:"rgba(248,250,252,0.5)",
      opacity, pointerEvents: active ? "all" : "none",
      transition: active ? "opacity 0.15s ease" : "opacity 0.3s ease",
    }} />
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PageLoader() {
  const location   = useLocation();
  const [loading, setLoading] = useState(false);
  const prevPath   = useRef(location.pathname);
  const timerRef   = useRef(null);

  useEffect(() => {
    if (location.pathname !== prevPath.current) {
      // New route — show loader
      prevPath.current = location.pathname;
      setLoading(true);
      // Auto-hide after 600ms (page has rendered by then)
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setLoading(false), 500);
    }
    return () => clearTimeout(timerRef.current);
  }, [location.pathname]);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  return (
    <>
      <TopProgressBar active={loading} />
      <ContentOverlay active={loading} />
    </>
  );
}