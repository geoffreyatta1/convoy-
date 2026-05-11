const W = 1280, H = 720, ORANGE = "#f59e0b", BG = "#000", SURFACE = "#1c1c1e", SURFACE2 = "#2c2c2e", TEXT = "#fff", TEXT2 = "#ebebf599", DIVIDER = "#38383a";

export default function CarPlayAlert() {
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
      {/* Map + alert overlay */}
      <div style={{ flex: 1, background: "linear-gradient(160deg,#1a2a1a 0%,#0d1a0d 100%)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Alert card */}
        <div style={{ background: SURFACE, borderRadius: 20, padding: "40px 48px", width: 640, textAlign: "center" as const, boxShadow: "0 40px 80px rgba(0,0,0,0.8)", border: `1px solid ${DIVIDER}` }}>
          <div style={{ width: 72, height: 72, borderRadius: 36, background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 36, color: "#fff" }}>⚠</div>
          <div style={{ color: TEXT, fontSize: 30, fontWeight: 800, marginBottom: 16 }}>Gap Warning</div>
          <div style={{ color: TEXT2, fontSize: 20, lineHeight: 1.5, marginBottom: 36 }}>
            Mike is <span style={{ color: "#ef4444", fontWeight: 700 }}>1.4 km behind</span>
            <br />Convoy is stretching — consider slowing down.
          </div>
          <div style={{ background: SURFACE2, borderRadius: 14, padding: "18px 32px", display: "inline-block", border: `1px solid ${DIVIDER}` }}>
            <span style={{ color: TEXT, fontSize: 20, fontWeight: 700 }}>Dismiss</span>
          </div>
        </div>
      </div>
    </div>
  );
}
