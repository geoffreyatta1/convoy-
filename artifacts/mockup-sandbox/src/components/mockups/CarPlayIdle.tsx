const W = 1280, H = 720, BG = "#000", SURFACE = "#1c1c1e", SURFACE2 = "#2c2c2e", TEXT = "#fff", TEXT2 = "#ebebf599", DIVIDER = "#38383a";

export default function CarPlayIdle() {
  return (
    <div style={{ width: W, height: H, background: BG, overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "-apple-system,'SF Pro Display',system-ui,sans-serif" }}>
      {/* Status bar */}
      <div style={{ height: 32, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: "rgba(0,0,0,0.6)", flexShrink: 0 }}>
        <span style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>9:41</span>
        <span style={{ color: TEXT, fontSize: 13, opacity: 0.7 }}>▲ ▲ ▲ ●</span>
      </div>
      {/* Nav bar */}
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: "rgba(28,28,30,0.95)", borderBottom: `1px solid ${DIVIDER}`, flexShrink: 0 }}>
        <div style={{ background: SURFACE2, borderRadius: 8, padding: "6px 14px", opacity: 0 }}><span>-</span></div>
        <span style={{ color: TEXT, fontSize: 18, fontWeight: 700 }}>Convoy</span>
        <div style={{ background: SURFACE2, borderRadius: 8, padding: "6px 14px" }}><span style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>Talk</span></div>
      </div>
      {/* Grid content */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: SURFACE }}>
        <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 32 }}>
          <div style={{ background: BG, borderRadius: 28, width: 180, height: 180, display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", gap: 12, border: `1.5px solid ${DIVIDER}` }}>
            <span style={{ fontSize: 80 }}>🚗</span>
            <span style={{ color: TEXT, fontSize: 16, fontWeight: 700, textAlign: "center" as const, lineHeight: 1.2 }}>Open Convoy<br />App</span>
          </div>
          <div style={{ color: TEXT2, fontSize: 20, textAlign: "center" as const, maxWidth: 480, lineHeight: 1.5 }}>
            Start or join a convoy on your iPhone<br />to see it here on CarPlay.
          </div>
        </div>
      </div>
    </div>
  );
}
