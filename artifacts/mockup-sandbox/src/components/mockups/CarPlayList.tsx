const W = 1280, H = 720, ORANGE = "#f59e0b", BG = "#000", SURFACE = "#1c1c1e", SURFACE2 = "#2c2c2e", TEXT = "#fff", TEXT2 = "#ebebf599", DIVIDER = "#38383a";

export default function CarPlayList() {
  const members = [
    { name: "James", role: "Leader ★", speed: "58 mph", pos: 1, color: ORANGE },
    { name: "You (Alex)", role: "Driver", speed: "56 mph", pos: 2, color: "#3b82f6" },
    { name: "Sarah", role: "Driver", speed: "55 mph", pos: 3, color: "#ef4444" },
    { name: "Mike", role: "Driver", speed: "54 mph", pos: 4, color: "#22c55e" },
  ];

  return (
    <div style={{ width: W, height: H, background: BG, overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "-apple-system,'SF Pro Display',system-ui,sans-serif" }}>
      {/* Status bar */}
      <div style={{ height: 32, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: "rgba(0,0,0,0.6)", flexShrink: 0 }}>
        <span style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>9:41</span>
        <span style={{ color: TEXT, fontSize: 13, opacity: 0.7 }}>▲ ▲ ▲ ●</span>
      </div>
      {/* Nav bar */}
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: "rgba(28,28,30,0.95)", borderBottom: `1px solid ${DIVIDER}`, flexShrink: 0 }}>
        <div style={{ background: SURFACE2, borderRadius: 8, padding: "6px 14px" }}><span style={{ color: TEXT2, fontSize: 14, fontWeight: 600 }}>‹ Back</span></div>
        <span style={{ color: TEXT, fontSize: 18, fontWeight: 700 }}>Blue Lagoon · ABC1</span>
        <div style={{ background: SURFACE2, borderRadius: 8, padding: "6px 14px" }}><span style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>Talk</span></div>
      </div>
      {/* Section header */}
      <div style={{ padding: "12px 24px 8px", background: SURFACE, flexShrink: 0 }}>
        <span style={{ color: TEXT2, fontSize: 13, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>4 vehicles in convoy</span>
      </div>
      {/* List */}
      <div style={{ flex: 1, background: SURFACE }}>
        {members.map((m, i) => (
          <div key={m.name}>
            <div style={{ display: "flex", alignItems: "center", padding: "0 24px", height: 128, gap: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, background: m.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: "#000", fontSize: 20, fontWeight: 800 }}>{m.pos}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: TEXT, fontSize: 24, fontWeight: 700 }}>{m.name}</div>
                <div style={{ color: TEXT2, fontSize: 17, marginTop: 4 }}>{m.role}</div>
              </div>
              <div style={{ textAlign: "right" as const }}>
                <div style={{ color: TEXT, fontSize: 22, fontWeight: 600 }}>{m.speed}</div>
                <div style={{ color: TEXT2, fontSize: 15, marginTop: 2 }}>Position #{m.pos}</div>
              </div>
            </div>
            {i < members.length - 1 && <div style={{ height: 1, background: DIVIDER, margin: "0 24px" }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
