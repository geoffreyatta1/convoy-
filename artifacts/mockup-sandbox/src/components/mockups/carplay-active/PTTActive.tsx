import React from "react";

const W = 1024, H = 480;
const mapBg = "#1a2438";
const mapNavy = "#151e2e";
const orange = "#f59e0b";
const green = "#22c55e";
const muted = "#9ca3af";
const text = "#ffffff";

export function PTTActive() {
  return (
    <div style={{ width: W, height: H, background: mapNavy, position: "relative", overflow: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" }}>

      {/* Map background (slightly dimmed for focus) */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <rect width={W} height={H} fill={mapBg}/>
        <rect x="0" y="210" width={W} height="22" fill="#1f2d45"/>
        <rect x="0" y="210" width={W} height="14" fill="#243350"/>
        <rect x="360" y="0" width="22" height={H} fill="#1f2d45"/>
        <rect x="360" y="0" width="14" height={H} fill="#243350"/>
        <rect x="680" y="0" width="16" height={H} fill="#1f2d45"/>
        <rect x="0" y="330" width={W} height="14" fill="#1f2d45"/>
        <rect x="580" y="320" width="200" height="100" rx="6" fill="#131e30" opacity="0.6"/>
        <text x="660" y="390" fill="#2a3a55" fontSize="11" textAnchor="middle">RIVER THAMES</text>
        <path d="M240 480 L240 320 L370 320 L370 80 L510 80 L620 60" stroke={orange} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
        <circle cx="240" cy="295" r="18" fill="#3b82f6" opacity="0.6"/>
        <path d="M240 285 L233 298 L240 293 L247 298Z" fill="white" opacity="0.7"/>
        <circle cx="620" cy="58" r="16" fill={orange} opacity="0.6"/>
        <circle cx="490" cy="155" r="14" fill="#ef4444" opacity="0.6"/>
        <circle cx="145" cy="360" r="14" fill="#22c55e" opacity="0.6"/>
      </svg>

      {/* Dim overlay – slight */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.2)" }} />

      {/* TOP BAR */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 50, background: "rgba(10,15,28,0.92)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", padding: "0 16px" }}>
        <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "4px 12px", fontSize: 13, color: "#d1d5db", fontWeight: 600 }}>ABC1 · 4 cars</div>
        <div style={{ flex: 1, textAlign: "center", color: text, fontSize: 16, fontWeight: 600 }}>Convoy to Blue Lagoon</div>
        {/* ACTIVE TALK BUTTON – large, glowing */}
        <div style={{ background: orange, borderRadius: 20, padding: "8px 22px", display: "flex", alignItems: "center", gap: 7, cursor: "pointer", boxShadow: `0 0 24px ${orange}99, 0 0 48px ${orange}44`, transform: "scale(1.08)" }}>
          <div style={{ width: 9, height: 9, borderRadius: 5, background: "#000", opacity: 0.7 }} />
          <span style={{ color: "#000", fontSize: 15, fontWeight: 800 }}>Talk</span>
        </div>
      </div>

      {/* LEFT: Turn card (dimmed while talking) */}
      <div style={{ position: "absolute", top: 66, left: 14, width: 270, background: "rgba(14,20,32,0.75)", backdropFilter: "blur(12px)", borderRadius: 16, padding: "14px 16px", opacity: 0.55 }}>
        <div style={{ color: orange, fontSize: 11, fontWeight: 700, marginBottom: 5 }}>IN 350 M</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: orange, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none"><path d="M14 22 L14 8 M8 14 L14 8 L20 14" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div style={{ color: text, fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>Turn left onto Riverside Drive</div>
        </div>
      </div>

      {/* RIGHT: ETA card (dimmed) */}
      <div style={{ position: "absolute", top: 66, right: 14, width: 130, background: "rgba(14,20,32,0.75)", backdropFilter: "blur(12px)", borderRadius: 16, padding: "10px 14px", opacity: 0.55, textAlign: "right" }}>
        <div style={{ color: muted, fontSize: 10, fontWeight: 600, marginBottom: 2 }}>ETA</div>
        <div style={{ color: text, fontSize: 38, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>12</div>
        <div style={{ color: muted, fontSize: 11, marginTop: 1 }}>min · 3.4 km</div>
      </div>

      {/* CENTER: PTT Active indicator */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>

        {/* Mic circle with pulses */}
        <div style={{ position: "relative", width: 120, height: 120 }}>
          {/* Pulse rings */}
          <div style={{ position: "absolute", inset: -20, borderRadius: "50%", border: `2px solid ${orange}`, opacity: 0.15, animation: "pulse 1.5s ease-out infinite" }} />
          <div style={{ position: "absolute", inset: -10, borderRadius: "50%", border: `2px solid ${orange}`, opacity: 0.25, animation: "pulse 1.5s ease-out 0.3s infinite" }} />
          {/* Main circle */}
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: orange, boxShadow: `0 0 40px ${orange}77`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <rect x="16" y="8" width="12" height="20" rx="6" fill="black" fillOpacity="0.8"/>
              <path d="M10 24c0 6.627 5.373 12 12 12s12-5.373 12-12" stroke="black" strokeWidth="2.5" strokeLinecap="round" fill="none" fillOpacity="0.8"/>
              <line x1="22" y1="36" x2="22" y2="42" stroke="black" strokeWidth="2.5" strokeLinecap="round" fillOpacity="0.8"/>
              <line x1="16" y1="42" x2="28" y2="42" stroke="black" strokeWidth="2.5" strokeLinecap="round" fillOpacity="0.8"/>
            </svg>
          </div>
        </div>

        {/* Audio waveform bars */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, height: 40 }}>
          {[18, 32, 24, 40, 28, 36, 20, 38, 26, 34, 18].map((h, i) => (
            <div key={i} style={{ width: 4, height: h, borderRadius: 2, background: orange, opacity: 0.7 + (i % 3) * 0.1 }} />
          ))}
        </div>

        {/* Label */}
        <div style={{ textAlign: "center" }}>
          <div style={{ color: text, fontSize: 17, fontWeight: 700 }}>James is talking…</div>
          <div style={{ color: muted, fontSize: 13, marginTop: 4 }}>Hold Talk button to reply</div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0% { transform: scale(1); opacity: 0.25; } 100% { transform: scale(1.4); opacity: 0; } }`}</style>

      {/* BOTTOM MEMBER STRIP */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "rgba(8,14,26,0.97)", backdropFilter: "blur(16px)", borderTop: `1px solid rgba(245,158,11,0.2)`, display: "flex", alignItems: "center", padding: "0 16px" }}>
        <div style={{ flex: 1, display: "flex", gap: 16 }}>
          {[
            { n: "J", name: "James", sub: "Speaking now…", color: orange, badge: null, isLead: true, active: true },
            { n: "Y", name: "You", sub: "56 mph", color: "#3b82f6", badge: "2" },
            { n: "S", name: "Sarah", sub: "55 mph", color: "#ef4444", badge: "3" },
            { n: "M", name: "Mike", sub: "54 mph", color: "#22c55e", badge: "4" },
          ].map((m) => (
            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 8, opacity: (m as any).active ? 1 : 0.6 }}>
              <div style={{ position: "relative" }}>
                <div style={{ width: 38, height: 38, borderRadius: 19, background: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: (m as any).isLead ? "#000" : "#fff", boxShadow: (m as any).active ? `0 0 16px ${orange}99` : "none" }}>{m.n}</div>
                {m.badge && <div style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: 9, background: m.color, border: "2px solid #08121a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff" }}>{m.badge}</div>}
              </div>
              <div>
                <div style={{ color: text, fontSize: 12, fontWeight: 600 }}>{m.name}</div>
                <div style={{ color: (m as any).active ? orange : muted, fontSize: 11 }}>{m.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: `rgba(245,158,11,0.12)`, border: `1px solid rgba(245,158,11,0.4)`, borderRadius: 20, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: 4, background: orange, boxShadow: `0 0 6px ${orange}` }} />
          <span style={{ color: orange, fontSize: 12, fontWeight: 700 }}>PTT ACTIVE</span>
        </div>
      </div>
    </div>
  );
}
