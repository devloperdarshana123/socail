import React from "react";
import "../styles/wavyBackground.css";

export default function WavyBackground({ children }) {
  return (
    <div className="wavy-bg-container">
      <svg className="wavy-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <style>
            {`
              @keyframes wave1 {
                0% { d: path('M0,300 Q400,250 800,300 T1600,300 L1600,900 L0,900 Z'); }
                25% { d: path('M0,320 Q400,270 800,320 T1600,320 L1600,900 L0,900 Z'); }
                50% { d: path('M0,280 Q400,230 800,280 T1600,280 L1600,900 L0,900 Z'); }
                75% { d: path('M0,320 Q400,270 800,320 T1600,320 L1600,900 L0,900 Z'); }
                100% { d: path('M0,300 Q400,250 800,300 T1600,300 L1600,900 L0,900 Z'); }
              }
              
              @keyframes wave2 {
                0% { d: path('M0,400 Q400,350 800,400 T1600,400 L1600,900 L0,900 Z'); }
                25% { d: path('M0,380 Q400,330 800,380 T1600,380 L1600,900 L0,900 Z'); }
                50% { d: path('M0,420 Q400,370 800,420 T1600,420 L1600,900 L0,900 Z'); }
                75% { d: path('M0,380 Q400,330 800,380 T1600,380 L1600,900 L0,900 Z'); }
                100% { d: path('M0,400 Q400,350 800,400 T1600,400 L1600,900 L0,900 Z'); }
              }
              
              @keyframes wave3 {
                0% { d: path('M0,500 Q400,450 800,500 T1600,500 L1600,900 L0,900 Z'); }
                25% { d: path('M0,520 Q400,470 800,520 T1600,520 L1600,900 L0,900 Z'); }
                50% { d: path('M0,480 Q400,430 800,480 T1600,480 L1600,900 L0,900 Z'); }
                75% { d: path('M0,520 Q400,470 800,520 T1600,520 L1600,900 L0,900 Z'); }
                100% { d: path('M0,500 Q400,450 800,500 T1600,500 L1600,900 L0,900 Z'); }
              }

              .wave1 { animation: wave1 8s ease-in-out infinite; }
              .wave2 { animation: wave2 10s ease-in-out infinite; }
              .wave3 { animation: wave3 12s ease-in-out infinite; }
            `}
          </style>
        </defs>

        {/* Base background */}
        <rect width="1600" height="900" fill="#fdfaf2" />

        {/* Animated waves */}
        <path
          className="wave1"
          fill="#fceae1"
          fillOpacity="0.85"
          d="M0,300 Q400,250 800,300 T1600,300 L1600,900 L0,900 Z"
        />
        <path
          className="wave2"
          fill="#fbe3d9"
          fillOpacity="0.7"
          d="M0,400 Q400,350 800,400 T1600,400 L1600,900 L0,900 Z"
        />
        <path
          className="wave3"
          fill="#f9dcc8"
          fillOpacity="0.5"
          d="M0,500 Q400,450 800,500 T1600,500 L1600,900 L0,900 Z"
        />
      </svg>

      {/* Content */}
      <div className="wavy-content">
        {children}
      </div>
    </div>
  );
}
