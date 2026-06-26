
import { createPortal } from "react-dom";

export default function LoadingOverlay({ message = "Please wait" }) {
  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <style>{`
        @keyframes spin-ring { to { transform: rotate(360deg); } }
        @keyframes pulse-bg { 0%,100%{opacity:.08;transform:scale(1)} 50%{opacity:.18;transform:scale(1.12)} }
        @keyframes fade-in-up { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dot-flash { 0%,80%,100%{opacity:.2} 40%{opacity:1} }
      `}</style>

      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
        <div style={{ width:180, height:180, borderRadius:"50%", background:"rgba(192,154,110,0.13)", animation:"pulse-bg 2.2s ease-in-out infinite" }} />
      </div>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
        <div style={{ width:130, height:130, borderRadius:"50%", background:"rgba(192,154,110,0.09)", animation:"pulse-bg 2.2s ease-in-out infinite 0.4s" }} />
      </div>

      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20, animation:"fade-in-up 0.35s ease both", position:"relative" }}>
        <div style={{ position:"relative", width:64, height:64 }}>
          <div style={{ position:"absolute", inset:0, borderRadius:"50%", border:"3px solid rgba(192,154,110,0.18)" }} />
          <div style={{ position:"absolute", inset:0, borderRadius:"50%", border:"3px solid transparent", borderTopColor:"#c09a6e", borderRightColor:"rgba(192,154,110,0.45)", animation:"spin-ring 0.9s cubic-bezier(0.6,0.2,0.4,0.8) infinite" }} />
          <div style={{ position:"absolute", inset:8, borderRadius:"50%", border:"2px solid transparent", borderTopColor:"rgba(192,154,110,0.5)", animation:"spin-ring 1.4s cubic-bezier(0.6,0.2,0.4,0.8) infinite reverse" }} />
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:"#c09a6e" }} />
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
          <p style={{ fontSize:14, fontWeight:600, color:"#fff", margin:0 }}>{message}</p>
          <div style={{ display:"flex", gap:5 }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background:"rgba(192,154,110,0.8)", display:"block", animation:"dot-flash 1.4s ease-in-out infinite 0s" }} />
            <span style={{ width:5, height:5, borderRadius:"50%", background:"rgba(192,154,110,0.8)", display:"block", animation:"dot-flash 1.4s ease-in-out infinite 0.2s" }} />
            <span style={{ width:5, height:5, borderRadius:"50%", background:"rgba(192,154,110,0.8)", display:"block", animation:"dot-flash 1.4s ease-in-out infinite 0.4s" }} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}