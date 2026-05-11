import React from "react";

const W = 1024, H = 480;
const navy = "#111827";
const orange = "#f59e0b";
const muted = "#6b7280";
const text = "#ffffff";
const border = "rgba(255,255,255,0.08)";

export function Connecting() {
  return (
    <div style={{ width: W, height: H, background: navy, position: "relative", overflow: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" }}>

      {/* Background subtle grid */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.05 }}>
        {[0,1,2,3,4,5,6,7].map(i => <line key={`v${i}`} x1={i*148} y1={0} x2={i*148} y2={H} stroke="#fff" strokeWidth="1"/>)}
        {[0,1,2,3,4,5].map(i => <line key={`h${i}`} x1={0} y1={i*100} x2={W} y2={i*100} stroke="#fff" strokeWidth="1"/>)}
      </svg>

      {/* Center content */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>

        {/* Spinning ring + icon */}
        <div style={{ position: "relative", width: 100, height: 100 }}>
          {/* Outer ring */}
          <svg width="100" height="100" style={{ position: "absolute", inset: 0 }}>
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(245,158,11,0.15)" strokeWidth="4"/>
            <circle cx="50" cy="50" r="44" fill="none" stroke={orange} strokeWidth="4" strokeLinecap="round"
              strokeDasharray="138" strokeDashoffset="50"
              style={{ transformOrigin: "50px 50px", animation: "spin 1.4s linear infinite" }}/>
          </svg>
          {/* App icon center */}
          <div style={{ position: "absolute", inset: 12, borderRadius: "50%", background: "rgba(245,158,11,0.12)", border: `1px solid rgba(245,158,11,0.3)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
              <rect x="4" y="20" width="28" height="10" rx="3" fill="white" fillOpacity="0.9"/>
              <circle cx="9" cy="27" r="3.5" fill="#111827"/>
              <circle cx="27" cy="27" r="3.5" fill="#111827"/>
              <path d="M4 23 L8 14 L12 14 L14 20 M22 14 L26 14 L32 23" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <rect x="14" y="14" width="8" height="6" rx="1" fill="white" fillOpacity="0.7"/>
            </svg>
          </div>
        </div>

        {/* Text */}
        <div style={{ textAlign: "center" }}>
          <div style={{ color: text, fontSize: 26, fontWeight: 700, letterSpacing: -0.4 }}>Connecting to Convoy…</div>
          <div style={{ color: muted, fontSize: 15, marginTop: 8 }}>Waiting for iPhone authorisation</div>
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: 8 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i === 0 ? orange : "rgba(245,158,11,0.3)" }} />
          ))}
        </div>

        {/* Profile card appearing */}
        <div style={{ background: "rgba(255,255,255,0.05)", border, borderRadius: 16, padding: "14px 24px", display: "flex", alignItems: "center", gap: 14, backdropFilter: "blur(10px)", opacity: 0.7 }}>
          {/* Avatar */}
          <div style={{ width: 44, height: 44, borderRadius: 22, background: orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#000" }}>J</div>
          <div>
            <div style={{ color: text, fontSize: 16, fontWeight: 600 }}>James Carter</div>
            <div style={{ color: muted, fontSize: 13 }}>Verifying account…</div>
          </div>
          {/* Pulse dot */}
          <div style={{ marginLeft: 12, width: 10, height: 10, borderRadius: 5, background: orange, boxShadow: `0 0 10px ${orange}` }} />
        </div>
      </div>

      {/* Spin keyframe injected via style tag */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Bottom bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 44, background: "rgba(0,0,0,0.5)", borderTop: border, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: muted, fontSize: 12 }}>Connecting via Bluetooth · Family Convoy</div>
      </div>
    </div>
  );
}
