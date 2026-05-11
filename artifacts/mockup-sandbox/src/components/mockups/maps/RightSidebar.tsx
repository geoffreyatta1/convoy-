export function RightSidebar() {
  return (
    <div
      style={{
        width: 390,
        height: 580,
        background: "#111",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
        padding: 24,
        gap: 40,
      }}
    >
      {/* Navigation state */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <div style={{ color: "#8e8e93", fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>NAVIGATING</div>
        {[
          { content: "2D", label: "Map Mode" },
          { emoji: "🔇", label: "Mute" },
          { emoji: "👥", label: "Convoy" },
          { emoji: "⚠️", label: "Report" },
          { emoji: "🚶", label: "Walking" },
        ].map((btn, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(44,44,46,0.95)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: (btn as any).content ? 13 : 20,
                fontWeight: (btn as any).content ? 700 : 400,
                color: "#fff",
                boxShadow: "0 2px 10px rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {(btn as any).content ?? (btn as any).emoji}
            </div>
            <span style={{ color: "#636366", fontSize: 9 }}>{btn.label}</span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 300, background: "#2c2c2e" }} />

      {/* Idle state */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <div style={{ color: "#8e8e93", fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>IDLE</div>
        {[
          { content: "2D", label: "Map Mode" },
          { emoji: "🎙️", label: "Talk" },
          { emoji: "👥", label: "Convoy" },
          {
            custom: (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="4" fill="#f59e0b" />
                <path d="M10 2V5M10 15V18M2 10H5M15 10H18" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ),
            label: "Recenter",
          },
        ].map((btn, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(44,44,46,0.95)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: (btn as any).content ? 13 : 20,
                fontWeight: (btn as any).content ? 700 : 400,
                color: "#fff",
                boxShadow: "0 2px 10px rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {(btn as any).content ?? (btn as any).custom ?? (btn as any).emoji}
            </div>
            <span style={{ color: "#636366", fontSize: 9 }}>{btn.label}</span>
          </div>
        ))}

        {/* Green navigate pill */}
        <div style={{ height: 16 }} />
        <div
          style={{
            background: "#22c55e",
            borderRadius: 22,
            padding: "10px 18px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 4px 16px rgba(34,197,94,0.4)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 7L13 1L7 13L5.8 8.2L1 7Z" fill="white" />
          </svg>
          Navigate
        </div>
      </div>
    </div>
  );
}
