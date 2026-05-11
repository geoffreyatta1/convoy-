import React from "react";

const W = 1024, H = 480;
const navy = "#111827";
const navyMid = "#1a2438";
const card = "rgba(18,24,38,0.96)";
const orange = "#f59e0b";
const muted = "#6b7280";
const text = "#ffffff";
const border = "rgba(255,255,255,0.08)";

export function NotConnected() {
  return (
    <div style={{ width: W, height: H, background: navy, position: "relative", overflow: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" }}>

      {/* Background grid lines (subtle map grid) */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.06 }}>
        {[0,1,2,3,4,5,6,7].map(i => <line key={`v${i}`} x1={i*148} y1={0} x2={i*148} y2={H} stroke="#fff" strokeWidth="1"/>)}
        {[0,1,2,3,4,5].map(i => <line key={`h${i}`} x1={0} y1={i*100} x2={W} y2={i*100} stroke="#fff" strokeWidth="1"/>)}
      </svg>

      {/* Left half: main message */}
      <div style={{ position: "absolute", left: 80, top: 0, bottom: 0, width: 460, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>

        {/* App icon */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: orange, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 28px ${orange}55` }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect x="4" y="20" width="28" height="10" rx="3" fill="#000" fillOpacity="0.4"/>
              <rect x="4" y="20" width="28" height="10" rx="3" fill="white" fillOpacity="0.9"/>
              <circle cx="9" cy="27" r="3.5" fill="#111"/>
              <circle cx="27" cy="27" r="3.5" fill="#111"/>
              <path d="M4 23 L8 14 L12 14 L14 20 M22 14 L26 14 L32 23" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <rect x="14" y="14" width="8" height="6" rx="1" fill="white" fillOpacity="0.7"/>
            </svg>
          </div>
          <div>
            <div style={{ color: text, fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>Family Convoy</div>
            <div style={{ color: muted, fontSize: 13, marginTop: 2 }}>CarPlay</div>
          </div>
        </div>

        {/* Heading */}
        <div>
          <div style={{ color: text, fontSize: 28, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.5 }}>Open Convoy on your iPhone</div>
          <div style={{ color: muted, fontSize: 16, marginTop: 8, lineHeight: 1.5 }}>Sign in on your iPhone to connect your account and join or start a convoy.</div>
        </div>

        {/* Step indicators */}
        {[
          { n: "1", label: "Open Convoy on iPhone" },
          { n: "2", label: "Sign in to your account" },
          { n: "3", label: "CarPlay connects automatically" },
        ].map(s => (
          <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: "rgba(245,158,11,0.15)", border: `1px solid ${orange}55`, display: "flex", alignItems: "center", justifyContent: "center", color: orange, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{s.n}</div>
            <div style={{ color: "#d1d5db", fontSize: 14 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Right half: iPhone mockup */}
      <div style={{ position: "absolute", right: 60, top: 0, bottom: 0, width: 340, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Phone outline */}
        <div style={{ width: 180, height: 360, borderRadius: 32, border: "3px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Notch */}
          <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 60, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.12)" }} />
          {/* Screen */}
          <div style={{ width: 154, height: 310, borderRadius: 24, background: "#0f172a", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Status bar */}
            <div style={{ height: 24, background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px" }}>
              <span style={{ color: "white", fontSize: 9, fontWeight: 600 }}>9:41</span>
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                <div style={{ width: 12, height: 8, borderRadius: 1, border: "1px solid rgba(255,255,255,0.5)" }}><div style={{ width: "70%", height: "100%", background: "#22c55e", borderRadius: 1 }} /></div>
              </div>
            </div>
            {/* App screen */}
            <div style={{ flex: 1, background: "#111827", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ background: orange, borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ color: "#000", fontSize: 9, fontWeight: 700 }}>Convoy</div>
                <div style={{ color: "#000", fontSize: 8, marginTop: 2, opacity: 0.7 }}>Not signed in</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "6px 8px", flex: 1 }}>
                <div style={{ color: muted, fontSize: 8, textAlign: "center", marginTop: 20 }}>Sign in to connect</div>
              </div>
              <div style={{ background: orange, borderRadius: 8, padding: "6px 0", textAlign: "center" }}>
                <span style={{ color: "#000", fontSize: 9, fontWeight: 700 }}>Sign In</span>
              </div>
            </div>
          </div>
          {/* Home indicator */}
          <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", width: 48, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.25)" }} />
        </div>

        {/* Arrow pointing to phone */}
        <div style={{ position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)" }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M8 16 L24 16 M18 10 L24 16 L18 22" stroke={orange} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 44, background: "rgba(0,0,0,0.5)", borderTop: border, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: muted, fontSize: 12 }}>Connect via iPhone · Family Convoy v2.4</div>
      </div>
    </div>
  );
}
