import React from "react";

const W = 1024, H = 480;
const mapBg = "#1a2438";
const mapNavy = "#151e2e";
const cardBg = "rgba(14,20,32,0.92)";
const orange = "#f59e0b";
const green = "#22c55e";
const red = "#ef4444";
const muted = "#9ca3af";
const text = "#ffffff";

export function MemberAlert() {
  return (
    <div style={{ width: W, height: H, background: mapNavy, position: "relative", overflow: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" }}>

      {/* Map background (dimmed) */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <rect width={W} height={H} fill={mapBg}/>
        <rect x="0" y="210" width={W} height="22" fill="#1f2d45"/>
        <rect x="0" y="210" width={W} height="14" fill="#243350"/>
        <rect x="360" y="0" width="22" height={H} fill="#1f2d45"/>
        <rect x="360" y="0" width="14" height={H} fill="#243350"/>
        <rect x="680" y="0" width="16" height={H} fill="#1f2d45"/>
        <rect x="0" y="330" width={W} height="14" fill="#1f2d45"/>
        <rect x="580" y="320" width="200" height="100" rx="6" fill="#131e30" opacity="0.7"/>
        <text x="660" y="390" fill="#2a3a55" fontSize="11" textAnchor="middle">RIVER THAMES</text>

        {/* Route */}
        <path d="M240 480 L240 320 L370 320 L370 80 L510 80 L620 60" stroke={orange} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>

        {/* YOU marker */}
        <circle cx="240" cy="295" r="18" fill="#3b82f6" opacity="0.7"/>
        <path d="M240 285 L233 298 L240 293 L247 298Z" fill="white"/>
        <text x="240" y="316" fill="white" fontSize="9" textAnchor="middle" fontWeight="700">YOU</text>

        {/* Destination */}
        <circle cx="620" cy="58" r="16" fill={orange} opacity="0.7"/>

        {/* Sarah marker – off route, blinking red */}
        <circle cx="400" cy="350" r="18" fill={red} opacity="0.9"/>
        <circle cx="400" cy="350" r="26" fill={red} fillOpacity="0.2"/>
        <text x="400" y="356" fill="white" fontSize="12" textAnchor="middle" fontWeight="800">S</text>

        {/* Gap line from Sarah to convoy route */}
        <line x1="400" y1="325" x2="370" y2="280" stroke={red} strokeWidth="2" strokeDasharray="6 4" opacity="0.6"/>
        <text x="388" y="300" fill={red} fontSize="10" textAnchor="middle">0.8 km</text>
      </svg>

      {/* Dim overlay */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />

      {/* TOP BAR */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 50, background: "rgba(10,15,28,0.92)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", padding: "0 16px" }}>
        <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "4px 12px", fontSize: 13, color: "#d1d5db", fontWeight: 600 }}>ABC1 · 4 cars</div>
        <div style={{ flex: 1, textAlign: "center", color: text, fontSize: 16, fontWeight: 600 }}>Convoy to Blue Lagoon</div>
        <div style={{ background: orange, borderRadius: 20, padding: "6px 16px", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: 4, background: "#000", opacity: 0.6 }} />
          <span style={{ color: "#000", fontSize: 14, fontWeight: 700 }}>Talk</span>
        </div>
      </div>

      {/* ALERT CARD – CENTER */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 460, background: "rgba(10,15,26,0.98)", backdropFilter: "blur(20px)", borderRadius: 20, padding: "24px 28px", boxShadow: `0 0 0 1px rgba(239,68,68,0.4), 0 24px 64px rgba(0,0,0,0.8)` }}>
        {/* Alert header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: "rgba(239,68,68,0.15)", border: `1.5px solid ${red}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 3L20 19H2L11 3Z" stroke={red} strokeWidth="2" fill="rgba(239,68,68,0.15)" strokeLinejoin="round"/>
              <line x1="11" y1="9" x2="11" y2="14" stroke={red} strokeWidth="2" strokeLinecap="round"/>
              <circle cx="11" cy="17" r="1" fill={red}/>
            </svg>
          </div>
          <div>
            <div style={{ color: red, fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>CONVOY ALERT</div>
            <div style={{ color: text, fontSize: 19, fontWeight: 700 }}>Sarah is falling behind</div>
          </div>
        </div>

        {/* Details */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 24 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: red, fontSize: 22, fontWeight: 800 }}>0.8</div>
            <div style={{ color: muted, fontSize: 11 }}>km gap</div>
          </div>
          <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ color: text, fontSize: 22, fontWeight: 800 }}>48</div>
            <div style={{ color: muted, fontSize: 11 }}>mph · slowing</div>
          </div>
          <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ color: orange, fontSize: 22, fontWeight: 800 }}>↓</div>
            <div style={{ color: muted, fontSize: 11 }}>losing speed</div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "13px 0", color: text, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            Continue
          </button>
          <button style={{ flex: 1, background: orange, border: "none", borderRadius: 12, padding: "13px 0", color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 16px ${orange}44` }}>
            Wait for Sarah
          </button>
        </div>
      </div>

      {/* BOTTOM MEMBER STRIP */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "rgba(8,14,26,0.97)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", padding: "0 16px" }}>
        <div style={{ flex: 1, display: "flex", gap: 16 }}>
          {[
            { n: "J", name: "James", sub: "Lead · 58 mph", color: orange, badge: null, isLead: true },
            { n: "Y", name: "You", sub: "56 mph", color: "#3b82f6", badge: "2" },
            { n: "S", name: "Sarah", sub: "48 mph · ↓", color: red, badge: "3", alert: true },
            { n: "M", name: "Mike", sub: "54 mph", color: "#22c55e", badge: "4" },
          ].map((m) => (
            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 8, opacity: (m as any).alert ? 1 : 0.7 }}>
              <div style={{ position: "relative" }}>
                <div style={{ width: 38, height: 38, borderRadius: 19, background: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: (m as any).isLead ? "#000" : "#fff", boxShadow: (m as any).alert ? `0 0 12px ${red}88` : "none" }}>{m.n}</div>
                {m.badge && <div style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: 9, background: m.color, border: "2px solid #08121a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff" }}>{m.badge}</div>}
              </div>
              <div>
                <div style={{ color: text, fontSize: 12, fontWeight: 600 }}>{m.name}</div>
                <div style={{ color: (m as any).alert ? red : muted, fontSize: 11 }}>{m.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 20, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: 4, background: red, boxShadow: `0 0 6px ${red}` }} />
          <span style={{ color: red, fontSize: 12, fontWeight: 700 }}>ALERT</span>
        </div>
      </div>
    </div>
  );
}
