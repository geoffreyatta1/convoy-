import React from "react";

const W = 1024, H = 480;
const navy = "#111827";
const orange = "#f59e0b";
const green = "#22c55e";
const muted = "#6b7280";
const text = "#ffffff";
const cardBg = "rgba(255,255,255,0.04)";
const border = "rgba(255,255,255,0.08)";

const MEMBERS = [
  { name: "James", role: "You · Lead", color: orange, initials: "J" },
  { name: "Emma", color: "#3b82f6", initials: "E" },
  { name: "Sarah", color: "#ef4444", initials: "S" },
];

export function Authenticated() {
  return (
    <div style={{ width: W, height: H, background: navy, position: "relative", overflow: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" }}>

      {/* Background subtle grid */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.05 }}>
        {[0,1,2,3,4,5,6,7].map(i => <line key={`v${i}`} x1={i*148} y1={0} x2={i*148} y2={H} stroke="#fff" strokeWidth="1"/>)}
        {[0,1,2,3,4,5].map(i => <line key={`h${i}`} x1={0} y1={i*100} x2={W} y2={i*100} stroke="#fff" strokeWidth="1"/>)}
      </svg>

      {/* Left: Welcome + profile */}
      <div style={{ position: "absolute", left: 80, top: 0, bottom: 0, width: 380, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>

        {/* Success badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: "rgba(34,197,94,0.15)", border: `1.5px solid ${green}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 7L5.5 10L11.5 4" stroke={green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ color: green, fontSize: 13, fontWeight: 600 }}>Connected</span>
        </div>

        {/* Welcome */}
        <div>
          <div style={{ color: text, fontSize: 30, fontWeight: 700, letterSpacing: -0.6 }}>Welcome back, James!</div>
          <div style={{ color: muted, fontSize: 15, marginTop: 6 }}>Your account is linked to CarPlay.</div>
        </div>

        {/* Profile card */}
        <div style={{ background: cardBg, border, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#000" }}>J</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: text, fontSize: 16, fontWeight: 600 }}>James Carter</div>
            <div style={{ color: muted, fontSize: 13 }}>james@convoy.app</div>
          </div>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: green, boxShadow: `0 0 8px ${green}` }} />
        </div>
      </div>

      {/* Divider */}
      <div style={{ position: "absolute", left: 500, top: 60, bottom: 60, width: 1, background: border }} />

      {/* Right: Active convoy */}
      <div style={{ position: "absolute", left: 540, top: 0, right: 60, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>

        <div style={{ color: muted, fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>Active Convoy</div>

        {/* Convoy card */}
        <div style={{ background: cardBg, border, borderRadius: 16, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ color: text, fontSize: 17, fontWeight: 700 }}>Blue Lagoon</div>
              <div style={{ color: muted, fontSize: 13 }}>Code: A8F2K1 · 3 cars</div>
            </div>
            <div style={{ background: "rgba(34,197,94,0.12)", border: `1px solid ${green}44`, borderRadius: 8, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: green }} />
              <span style={{ color: green, fontSize: 12, fontWeight: 600 }}>Live</span>
            </div>
          </div>

          {/* Member avatars */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {MEMBERS.map(m => (
              <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: 16, background: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#000" }}>{m.initials}</div>
                <div>
                  <div style={{ color: text, fontSize: 12, fontWeight: 600 }}>{m.name}</div>
                  {m.role && <div style={{ color: orange, fontSize: 10 }}>{m.role}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Destination */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, borderTop: border }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1C4.8 1 3 2.8 3 5c0 3 4 8 4 8s4-5 4-8c0-2.2-1.8-4-4-4zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" fill={orange}/></svg>
            <span style={{ color: muted, fontSize: 13 }}>Blue Lagoon, Reykjavik · 42 min away</span>
          </div>
        </div>

        {/* Start button */}
        <button style={{ background: green, border: "none", borderRadius: 14, padding: "15px 0", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: `0 4px 20px rgba(34,197,94,0.3)` }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 9L16 2L9 16L7.5 10.5L2 9Z" fill="white"/></svg>
          Start Navigating
        </button>
      </div>

      {/* Bottom bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 44, background: "rgba(0,0,0,0.5)", borderTop: border, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: muted, fontSize: 12 }}>Family Convoy · CarPlay · Connected</div>
      </div>
    </div>
  );
}
