const W = 1280, H = 720, ORANGE = "#f59e0b", BG = "#000", SURFACE = "#1c1c1e", SURFACE2 = "#2c2c2e", TEXT = "#fff", TEXT2 = "#ebebf599", DIVIDER = "#38383a";

export default function CarPlayNav() {
  return (
    <div style={{ width: W, height: H, background: BG, overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "-apple-system,'SF Pro Display',system-ui,sans-serif" }}>
      {/* Status bar */}
      <div style={{ height: 32, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: "rgba(0,0,0,0.6)", flexShrink: 0 }}>
        <span style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>9:41</span>
        <span style={{ color: TEXT, fontSize: 13, opacity: 0.7 }}>▲ ▲ ▲ ●</span>
      </div>
      {/* Nav bar */}
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: "rgba(28,28,30,0.95)", borderBottom: `1px solid ${DIVIDER}`, flexShrink: 0 }}>
        <div style={{ background: SURFACE2, borderRadius: 8, padding: "6px 14px" }}><span style={{ color: TEXT2, fontSize: 14, fontWeight: 600 }}>ABC1</span></div>
        <span style={{ color: TEXT, fontSize: 18, fontWeight: 700 }}>Blue Lagoon</span>
        <div style={{ background: SURFACE2, borderRadius: 8, padding: "6px 14px" }}><span style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>Talk</span></div>
      </div>
      {/* Maneuver panel */}
      <div style={{ background: "rgba(28,28,30,0.98)", borderBottom: `1px solid ${DIVIDER}`, padding: "20px 28px", display: "flex", alignItems: "center", gap: 24, flexShrink: 0 }}>
        <div style={{ width: 120, height: 120, borderRadius: 24, background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64, color: "#000", flexShrink: 0 }}>↰</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: ORANGE, fontSize: 15, fontWeight: 600, marginBottom: 4 }}>In 350 m</div>
          <div style={{ color: TEXT, fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>Turn left onto</div>
          <div style={{ color: TEXT, fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>Riverside Drive</div>
          <div style={{ color: TEXT2, fontSize: 16, marginTop: 8 }}>Then continue for 1.2 km</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: TEXT2, fontSize: 14 }}>ETA</div>
          <div style={{ color: TEXT, fontSize: 28, fontWeight: 700 }}>12 min</div>
          <div style={{ color: TEXT2, fontSize: 14, marginTop: 4 }}>3.4 km left</div>
        </div>
      </div>
      {/* Map area */}
      <div style={{ flex: 1, background: "linear-gradient(160deg,#1a2a1a 0%,#0d1a0d 100%)", position: "relative", overflow: "hidden" }}>
        <svg width={W} height="100%" style={{ position: "absolute", inset: 0 }}>
          <line x1="640" y1="0" x2="640" y2="400" stroke="#2d3d2d" strokeWidth="60" />
          <line x1="640" y1="0" x2="640" y2="400" stroke="#3d5a3d" strokeWidth="8" strokeDasharray="30 20" />
          <line x1="640" y1="180" x2="200" y2="180" stroke="#2d3d2d" strokeWidth="60" />
          <line x1="640" y1="180" x2="200" y2="180" stroke="#3d5a3d" strokeWidth="8" strokeDasharray="30 20" />
          <line x1="640" y1="400" x2="640" y2="180" stroke={ORANGE} strokeWidth="6" strokeOpacity="0.8" />
          <line x1="640" y1="180" x2="200" y2="180" stroke={ORANGE} strokeWidth="6" strokeOpacity="0.8" />
          <polygon points="600,185 640,160 680,185" fill={ORANGE} />
        </svg>
        <div style={{ position: "absolute", bottom: 20, left: 24, display: "flex", gap: 12 }}>
          {[{ name: "James ★", color: ORANGE }, { name: "You", color: "#3b82f6" }, { name: "Sarah", color: "#ef4444" }].map((v) => (
            <div key={v.name} style={{ background: SURFACE, borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: v.color }} />
              <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>{v.name}</span>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", right: 24, bottom: 24, background: SURFACE, borderRadius: 12, width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${DIVIDER}` }}>
          <span style={{ color: TEXT, fontSize: 22 }}>≡</span>
        </div>
      </div>
    </div>
  );
}
