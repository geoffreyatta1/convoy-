import React from "react";

const W = 1024, H = 480;
const mapBg = "#1a2438";
const mapNavy = "#151e2e";
const cardBg = "rgba(12,18,30,0.94)";
const orange = "#f59e0b";
const green = "#22c55e";
const muted = "#9ca3af";
const text = "#ffffff";
const routeColor = "#f59e0b";

/* ─── convoy member data ─────────────────────────────────── */
// Positions on the MAIN map (SVG coords)
const MEMBERS_MAP = [
  { id: "J", color: orange,    mx: 700, my: 115, label: "James", speaking: true  }, // lead – furthest ahead
  { id: "Y", color: "#3b82f6", mx: 510, my: 185, label: "You",   speaking: false },
  { id: "S", color: "#ef4444", mx: 310, my: 290, label: "Sarah", speaking: false },
  { id: "M", color: "#22c55e", mx: 155, my: 370, label: "Mike",  speaking: false },
];

/* ─── mini-map member dot positions (relative to 220×160 box) */
const MEMBERS_MINI = [
  { id: "J", color: orange,    x: 166, y: 28,  speaking: true  },
  { id: "Y", color: "#3b82f6", x: 122, y: 60,  speaking: false },
  { id: "S", color: "#ef4444", x: 76,  y: 96,  speaking: false },
  { id: "M", color: "#22c55e", x: 36,  y: 127, speaking: false },
];

export function Overview() {
  return (
    <div style={{
      width: W, height: H,
      background: mapNavy,
      position: "relative",
      overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
    }}>

      {/* ── Keyframes ─────────────────────────────────────── */}
      <style>{`
        @keyframes speakRing {
          0%   { transform: scale(1);   opacity: 0.9; }
          50%  { transform: scale(1.6); opacity: 0;   }
          100% { transform: scale(1);   opacity: 0.9; }
        }
        @keyframes speakRing2 {
          0%   { transform: scale(1);   opacity: 0.6; }
          50%  { transform: scale(2.1); opacity: 0;   }
          100% { transform: scale(1);   opacity: 0.6; }
        }
        @keyframes slideOutRight {
          0%   { opacity: 1; transform: translateX(0);    }
          80%  { opacity: 1; transform: translateX(0);    }
          100% { opacity: 0; transform: translateX(40px); }
        }
        @keyframes miniMapIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════
          MAIN MAP  (navigation-style, slightly pulled back)
      ═══════════════════════════════════════════════════ */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <rect width={W} height={H} fill={mapBg}/>

        {/* ── road grid ── */}
        <rect x="0"   y="230" width={W} height="18" fill="#1e2d44"/>
        <rect x="0"   y="230" width={W} height="11" fill="#223352"/>
        <rect x="0"   y="360" width={W} height="13" fill="#1e2d44"/>
        <rect x="0"   y="360" width={W} height="8"  fill="#223352"/>
        <rect x="380" y="0"   width="20" height={H} fill="#1e2d44"/>
        <rect x="380" y="0"   width="12" height={H} fill="#223352"/>
        <rect x="680" y="0"   width="16" height={H} fill="#1e2d44"/>
        <rect x="680" y="0"   width="10" height={H} fill="#223352"/>
        <rect x="820" y="0"   width="11" height={H} fill="#1e2d44"/>
        <rect x="200" y="0"   width="10" height={H} fill="#1b2840"/>

        {/* ── water / park ── */}
        <rect x="620" y="340" width="340" height="140" rx="4" fill="#111e30" opacity="0.75"/>
        <text x="785" y="425" fill="#1e3251" fontSize="13" textAnchor="middle">RIVER THAMES</text>
        <rect x="0"   y="390" width="180" height="90"  rx="3" fill="#162130" opacity="0.6"/>

        {/* ── orange route (full convoy extent) ── */}
        <path
          d="M140 480 L160 385 L200 320 L260 240 L380 225 L480 195 L570 165 L690 110 L760 80 L850 58"
          stroke={routeColor} strokeWidth="7" fill="none"
          strokeLinecap="round" strokeLinejoin="round" opacity="0.85"
        />
        {/* dashed centre line on route */}
        <path
          d="M140 480 L160 385 L200 320 L260 240 L380 225 L480 195 L570 165 L690 110 L760 80 L850 58"
          stroke="white" strokeWidth="1.5" fill="none"
          strokeLinecap="round" strokeLinejoin="round" opacity="0.25"
          strokeDasharray="8 14"
        />

        {/* ── destination pin ── */}
        <circle cx="850" cy="56" r="17" fill={orange} opacity="0.92"/>
        <circle cx="850" cy="56" r="10" fill="#000" fillOpacity="0.3"/>
        <text x="850" y="61" fill="white" fontSize="11" textAnchor="middle">🏁</text>

        {/* ── member markers on main map ── */}
        {MEMBERS_MAP.map(m => (
          <g key={m.id}>
            {/* subtle halo */}
            <circle cx={m.mx} cy={m.my} r="22" fill={m.color} fillOpacity="0.12"/>
            <circle cx={m.mx} cy={m.my} r="15" fill={m.color} opacity="0.9"/>
            {/* YOU: direction arrow */}
            {m.id === "Y" && (
              <path d={`M${m.mx} ${m.my-9} L${m.mx-5} ${m.my+5} L${m.mx} ${m.my} L${m.mx+5} ${m.my+5}Z`} fill="white"/>
            )}
            {/* Lead: chevron */}
            {m.id === "J" && (
              <path d={`M${m.mx} ${m.my-7} L${m.mx-4} ${m.my+4} L${m.mx} ${m.my} L${m.mx+4} ${m.my+4}Z`} fill="#000" fillOpacity="0.6"/>
            )}
            {m.id !== "Y" && m.id !== "J" && (
              <text x={m.mx} y={m.my+4} fill="white" fontSize="11" textAnchor="middle" fontWeight="700">{m.id}</text>
            )}
          </g>
        ))}
      </svg>

      {/* ═══════════════════════════════════════════════════
          TOP BAR
      ═══════════════════════════════════════════════════ */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 50,
        background: "rgba(10,15,28,0.9)", backdropFilter: "blur(14px)",
        display: "flex", alignItems: "center", padding: "0 16px",
      }}>
        <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "4px 12px", fontSize: 13, color: "#d1d5db", fontWeight: 600, flexShrink: 0 }}>
          ABC1 · 4 cars
        </div>
        <div style={{ flex: 1, textAlign: "center", color: text, fontSize: 16, fontWeight: 600 }}>
          Convoy Overview
        </div>
        <div style={{
          background: orange, borderRadius: 20, padding: "6px 16px",
          display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
          boxShadow: `0 0 12px ${orange}55`, flexShrink: 0,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: 4, background: "#000", opacity: 0.6 }}/>
          <span style={{ color: "#000", fontSize: 14, fontWeight: 700 }}>Talk</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          CONVOY SPREAD CARD  — floats top-right, auto-dismisses
      ═══════════════════════════════════════════════════ */}
      <div style={{
        position: "absolute", top: 62, right: 14,
        width: 200,
        background: cardBg, backdropFilter: "blur(18px)",
        borderRadius: 14, padding: "12px 14px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
        border: "1px solid rgba(255,255,255,0.07)",
        animation: "slideOutRight 4.5s ease-in-out forwards",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ color: muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>
            Convoy Spread
          </div>
          <div style={{ color: muted, fontSize: 10 }}>2.5 km</div>
        </div>

        {[
          { id: "J", name: "James", info: "Lead · 58 mph",    color: orange,    dot: green   },
          { id: "Y", name: "You",   info: "0.5 km behind",    color: "#3b82f6", dot: green   },
          { id: "S", name: "Sarah", info: "1.2 km behind",    color: "#ef4444", dot: orange  },
          { id: "M", name: "Mike",  info: "2.0 km behind",    color: "#22c55e", dot: orange  },
        ].map((m, i) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < 3 ? 8 : 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 13, background: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: m.id === "J" ? "#000" : "#fff", flexShrink: 0 }}>
              {m.id}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: text, fontSize: 11, fontWeight: 600 }}>{m.name}</div>
              <div style={{ color: muted, fontSize: 10 }}>{m.info}</div>
            </div>
            <div style={{ width: 7, height: 7, borderRadius: 4, background: m.dot, flexShrink: 0 }}/>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════
          MINI-MAP  —  bottom-left corner
      ═══════════════════════════════════════════════════ */}
      <div style={{
        position: "absolute", bottom: 14, left: 14,
        width: 220, height: 155,
        background: "rgba(10,16,28,0.96)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 8px 28px rgba(0,0,0,0.7)",
        animation: "miniMapIn 0.4s ease-out forwards",
      }}>
        {/* mini map tiles (dark navy) */}
        <svg width="220" height="155" style={{ position: "absolute", inset: 0 }}>
          <rect width="220" height="155" fill="#141e30"/>

          {/* mini road grid */}
          <rect x="0"   y="75"  width="220" height="6"  fill="#1b2d46"/>
          <rect x="0"   y="110" width="220" height="4"  fill="#1b2d46"/>
          <rect x="125" y="0"   width="6"   height="155" fill="#1b2d46"/>
          <rect x="65"  y="0"   width="4"   height="155" fill="#1b2d46"/>

          {/* mini water */}
          <rect x="140" y="120" width="80" height="35" rx="2" fill="#0e1928" opacity="0.8"/>
          <text x="178" y="143" fill="#1a2d47" fontSize="7" textAnchor="middle">THAMES</text>

          {/* mini route */}
          <path
            d="M26 148 L42 128 L60 108 L88 80 L130 73 L165 56 L190 38 L212 24"
            stroke={routeColor} strokeWidth="3.5" fill="none"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.9"
          />

          {/* destination */}
          <circle cx="212" cy="22" r="6" fill={orange}/>
          <text x="212" y="25.5" fill="white" fontSize="6" textAnchor="middle">🏁</text>

          {/* member dots on mini-map */}
          {MEMBERS_MINI.map(m => (
            <g key={m.id}>
              {/* speaking ring pulse layers */}
              {m.speaking && <>
                <circle cx={m.x} cy={m.y} r="10"
                  fill="none" stroke={m.color} strokeWidth="1.5" opacity="0.6"
                  style={{ transformOrigin: `${m.x}px ${m.y}px`, animation: "speakRing 1.6s ease-out infinite" }}
                />
                <circle cx={m.x} cy={m.y} r="10"
                  fill="none" stroke={m.color} strokeWidth="1" opacity="0.4"
                  style={{ transformOrigin: `${m.x}px ${m.y}px`, animation: "speakRing2 1.6s ease-out 0.4s infinite" }}
                />
              </>}
              {/* dot */}
              <circle cx={m.x} cy={m.y} r="6" fill={m.color} opacity="0.95"/>
              <text x={m.x} y={m.y+2.5} fill={m.id === "J" ? "#000" : "#fff"} fontSize="5.5" textAnchor="middle" fontWeight="700">{m.id}</text>
            </g>
          ))}
        </svg>

        {/* mini-map label */}
        <div style={{
          position: "absolute", bottom: 6, right: 8,
          color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 600, letterSpacing: 0.5,
        }}>
          CONVOY
        </div>

        {/* speaking badge */}
        <div style={{
          position: "absolute", top: 6, left: 8,
          background: "rgba(245,158,11,0.15)",
          border: "1px solid rgba(245,158,11,0.35)",
          borderRadius: 6, padding: "2px 7px",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: 3, background: orange, boxShadow: `0 0 5px ${orange}` }}/>
          <span style={{ color: orange, fontSize: 9, fontWeight: 700 }}>James</span>
        </div>
      </div>

    </div>
  );
}
