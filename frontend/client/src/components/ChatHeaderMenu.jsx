
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

export default function ChatHeaderMenu({ btnRef, onClose, children }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }, [btnRef]);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          !btnRef.current?.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, btnRef]);

  if (!pos) return null;

  return createPortal(
    <div ref={menuRef} style={{
      position: "fixed",
      top: pos.top,
      right: pos.right,
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: 10,
      overflow: "hidden",
      minWidth: 160,
      boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
      zIndex: 2147483647,
    }}>
      {children}
    </div>,
    document.body
  );
}