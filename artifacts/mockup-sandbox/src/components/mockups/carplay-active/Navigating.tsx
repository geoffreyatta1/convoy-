import React from "react";

const W = 1024, H = 480;
const mapBg = "#1a2438";
const mapNavy = "#151e2e";
const cardBg = "rgba(14,20,32,0.92)";
const orange = "#f59e0b";
const green = "#22c55e";
const muted = "#9ca3af";
const text = "#ffffff";
const routeColor = "#f59e0b";

const MEMBERS = [
  { n: "J", name: "James", sub: "Lead · 58 mph", color: orange, pos: 1, badge: null },
  { n: "Y", name: "You", sub: "56 mph", color: "#3b82f6", pos: 2, badge: "2" },
  { n: "S", name: "Sarah", sub: "55 mph", color: "#ef4444", pos: 3, badge: "3" },
  { n: "M", name: "Mike", sub: "54 mph", color: "#22c55e", pos: 4, badge: "4" },
];

export function Navigating() {
  return (
    <div style={{ width: W, height: H, background: mapNavy, position: "relative", overflow: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" }}>

      {/* Map background */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <rect width={W} height={H} fill={mapBg}/>

        {/* Road grid */}
        <rect x="0" y="210" width={W} height="22" fill="#1f2d45"/>
        <rect x="0" y="210" width={W} height="14" fill="#243350"/>
        <rect x="360" y="0" width="22" height={H} fill="#1f2d45"/>
        <rect x="360" y="0" width="14" height={H} fill="#243350"/>
        <rect x="680" y="0" width="16" height={H} fill="#1f2d45"/>
        <rect x="680" y="0" width="10" height={H} fill="#243350"/>
        <rect x="0" y="330" width={W} height="14" fill="#1f2d45"/>
        <rect x="0" y="330" width={W} height="8" fill="#243350"/>
        {/* Road labels */}
        <text x="430" y="208" fill="#4a5568" fontSize="10" textAnchor="middle">A40</text>

        {/* Dark areas (parks/water) */}
        <rect x="580" y="320" width="200" height="100" rx="6" fill="#131e30" opacity="0.7"/>
        <text x="660" y="390" fill="#2a3a55" fontSize="11" textAnchor="middle">RIVER THAMES</text>
        <rect x="0" y="350" width="160" height="130" rx="4" fill="#162030" opacity="0.6"/>

        {/* Orange route */}
        <path d="M240 480 L240 320 L370 320 L370 80 L510 80 L620 60" stroke={routeColor} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
        <path d="M240 480 L240 320 L370 320 L370 80 L510 80 L620 60" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" strokeDasharray="8 12"/>

        {/* Destination pin */}
        <circle cx="620" cy="58" r="18" fill={orange} opacity="0.9"/>
        <circle cx="620" cy="58" r="12" fill="#000" fillOpacity="0.3"/>
        <text x="620" y="63" fill="white" fontSize="12" textAnchor="middle" fontWeight="bold">🏁</text>

        {/* YOU marker */}
        <circle cx="240" cy="295" r="18" fill="#3b82f6"/>
        <circle cx="240" cy="295" r="22" fill="#3b82f6" fillOpacity="0.2"/>
        {/* Arrow up */}
        <path d="M240 285 L233 298 L240 293 L247 298Z" fill="white"/>
        <text x="240" y="316" fill="white" fontSize="9" textAnchor="middle" fontWeight="700">YOU</text>

        {/* S marker */}
        <circle cx="490" cy="155" r="14" fill="#ef4444"/>
        <text x="490" y="160" fill="white" fontSize="12" textAnchor="middle" fontWeight="700">S</text>

        {/* M marker */}
        <circle cx="145" cy="360" r="14" fill="#22c55e"/>
        <text x="145" y="365" fill="white" fontSize="12" textAnchor="middle" fontWeight="700">M</text>
      </svg>

      {/* TOP BAR */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 50, background: "rgba(10,15,28,0.88)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", padding: "0 16px", gap: 0 }}>
        {/* Plate chip */}
        <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "4px 12px", fontSize: 13, color: "#d1d5db", fontWeight: 600, flexShrink: 0 }}>ABC1 · 4 cars</div>
        {/* Title */}
        <div style={{ flex: 1, textAlign: "center", color: text, fontSize: 16, fontWeight: 600 }}>Convoy to Blue Lagoon</div>
        {/* Talk button */}
        <div style={{ background: orange, borderRadius: 20, padding: "6px 16px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flexShrink: 0, boxShadow: `0 0 12px ${orange}55` }}>
          <div style={{ width: 7, height: 7, borderRadius: 4, background: "#000", opacity: 0.6 }} />
          <span style={{ color: "#000", fontSize: 14, fontWeight: 700 }}>Talk</span>
        </div>
      </div>

      {/* LEFT: Turn instruction card */}
      <div style={{ position: "absolute", top: 66, left: 14, width: 300, background: cardBg, backdropFilter: "blur(16px)", borderRadius: 16, padding: "14px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
        <div style={{ color: orange, fontSize: 12, fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>IN 350 M</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {/* Arrow icon */}
          <div style={{ width: 52, height: 52, borderRadius: 14, background: orange, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 22 L14 8 M8 14 L14 8 L20 14" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 14 L8 14" stroke="black" strokeWidth="3" strokeLinecap="round"/>
              {/* Left turn arrow */}
              <path d="M8 14 L5 11 L5 17" fill="black" opacity="0.5"/>
            </svg>
          </div>
          <div>
            <div style={{ color: text, fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>Turn left onto Riverside Drive</div>
            <div style={{ color: muted, fontSize: 13, marginTop: 4 }}>Then continue for 1.2 km</div>
          </div>
        </div>
      </div>

      {/* RIGHT: ETA card */}
      <div style={{ position: "absolute", top: 66, right: 14, width: 148, background: cardBg, backdropFilter: "blur(16px)", borderRadius: 16, padding: "12px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", textAlign: "right" }}>
        <div style={{ color: muted, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, marginBottom: 2 }}>ETA</div>
        <div style={{ color: text, fontSize: 44, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>12</div>
        <div style={{ color: muted, fontSize: 12, marginTop: 1 }}>min</div>
        <div style={{ color: muted, fontSize: 11, marginTop: 4 }}>3.4 km left</div>
      </div>

      {/* BOTTOM MEMBER STRIP */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "rgba(8,14,26,0.95)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 16px", gap: 0 }}>
        <div style={{ flex: 1, display: "flex", gap: 16 }}>
          {MEMBERS.map((m, i) => (
            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Badge + avatar */}
              <div style={{ position: "relative" }}>
                <div style={{ width: 38, height: 38, borderRadius: 19, background: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: i === 0 ? "#000" : "#fff" }}>{m.n}</div>
                {m.badge && <div style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: 9, background: m.color, border: "2px solid #08121a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: i === 0 ? "#000" : "#fff" }}>{m.badge}</div>}
              </div>
              <div>
                <div style={{ color: text, fontSize: 12, fontWeight: 600 }}>{m.name}</div>
                <div style={{ color: muted, fontSize: 11 }}>{m.sub}</div>
              </div>
              {i === 0 && <div style={{ background: "rgba(245,158,11,0.15)", borderRadius: 6, padding: "2px 6px", marginLeft: 2 }}><span style={{ color: orange, fontSize: 9, fontWeight: 700 }}>Lead</span></div>}
            </div>
          ))}
        </div>
        {/* LIVE CONVOY pill */}
        <div style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 20, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: 4, background: green, boxShadow: `0 0 6px ${green}` }} />
          <span style={{ color: green, fontSize: 12, fontWeight: 700 }}>LIVE CONVOY</span>
        </div>
      </div>
    </div>
  );
}
