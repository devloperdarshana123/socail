import React from "react";
import "../styles/marble.css";

export default function MarbleBackground({ children }) {
  return (
    <div className="marble-bg-container">
      {/* Refined marble background using CSS + minimal SVG */}
      <div className="marble-base">
        {/* SVG for subtle veins only */}
        <svg className="marble-veins" viewBox="0 0 1600 1200" preserveAspectRatio="none">
          <defs>
            <filter id="blurVein">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            </filter>
          </defs>
          
          {/* Soft golden veins */}
          <path d="M -50 400 Q 200 350 400 380 T 800 360 T 1200 400 T 1650 420" stroke="#d9b88f" strokeWidth="3" fill="none" opacity="0.2" filter="url(#blurVein)" />
          <path d="M 0 600 Q 300 550 600 580 T 1200 560 T 1600 610" stroke="#c9a378" strokeWidth="2.5" fill="none" opacity="0.15" filter="url(#blurVein)" />
          <path d="M 100 200 Q 250 180 450 220 T 900 200 T 1400 240" stroke="#e0c4a0" strokeWidth="2" fill="none" opacity="0.12" filter="url(#blurVein)" />
          <path d="M 200 800 Q 400 780 650 820 T 1100 800 T 1550 850" stroke="#d0a882" strokeWidth="2" fill="none" opacity="0.14" filter="url(#blurVein)" />
          <path d="M 50 1000 Q 300 970 550 1020 T 1100 1000 T 1600 1050" stroke="#dab89d" strokeWidth="1.5" fill="none" opacity="0.11" filter="url(#blurVein)" />
        </svg>

        {/* Light rays overlay */}
        <div className="light-rays"></div>

        {/* Vignette overlay */}
        <div className="vignette-overlay"></div>
      </div>

      {/* Content container */}
      <div className="marble-content-wrapper">
        {children}
      </div>
    </div>
  );
}
