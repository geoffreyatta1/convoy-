const DARK = {
  mapBg: "#1c2820",
  mapRoad: "#334433",
  mapRoadBase: "#2a3a2a",
  cardBg: "#1c1c1e",
  handle: "#48484a",
  screenBg: "#000",
  text: "#ffffff",
  muted: "#8e8e93",
  border: "#2c2c2e",
  statsOverlay: "rgba(0,0,0,0.88)",
  sideBtn: "rgba(28,28,30,0.9)",
  tabBg: "rgba(18,18,18,0.95)",
  tabBorder: "#2c2c2e",
  tabInactive: "#636366",
};

const LIGHT = {
  mapBg: "#d4dbc8",
  mapRoad: "#ffffff",
  mapRoadBase: "#c0c8b8",
  cardBg: "#ffffff",
  handle: "#c7c7cc",
  screenBg: "#f2f2f7",
  text: "#000000",
  muted: "#6c6c70",
  border: "#e5e5ea",
  statsOverlay: "rgba(242,242,247,0.94)",
  sideBtn: "rgba(255,255,255,0.92)",
  tabBg: "rgba(248,248,252,0.97)",
  tabBorder: "#d1d1d6",
  tabInactive: "#8e8e93",
};

export function NavigatingView() {
  const params = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const isDark = params.get("theme") !== "light";
  const t = isDark ? DARK : LIGHT;

  return (
    <div
      style={{
        width: 390,
        height: 844,
        background: t.screenBg,
        position: "relative",
        overflow: "hidden",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
      }}
    >
      {/* Fake map tiles */}
      <svg width="390" height="844" style={{ position: "absolute", inset: 0 }}>
        <rect width="390" height="844" fill={t.mapBg} />
        <path d="M0,300 Q120,280 200,310 Q300,340 390,320" stroke={t.mapRoadBase} strokeWidth="18" fill="none" />
        <path d="M0,300 Q120,280 200,310 Q300,340 390,320" stroke={t.mapRoad} strokeWidth="14" fill="none" />
        <path d="M60,0 L80,844" stroke={t.mapRoadBase} strokeWidth="14" fill="none" />
        <path d="M60,0 L80,844" stroke={t.mapRoad} strokeWidth="10" fill="none" />
        <path d="M200,0 L180,844" stroke={t.mapRoadBase} strokeWidth="22" fill="none" />
        <path d="M200,0 L180,844" stroke={t.mapRoad} strokeWidth="18" fill="none" />
        {/* Blue route */}
        <path d="M180,844 L182,500 Q190,320 240,310 Q300,300 390,310" stroke="#1e90ff" strokeWidth="8" fill="none" strokeLinecap="round" />
        {/* User dot */}
        <circle cx="182" cy="500" r="10" fill="#f59e0b" />
        <circle cx="182" cy="500" r="14" fill="#f59e0b" fillOpacity="0.3" />
        {/* Building blocks */}
        {isDark
          ? <><rect x="100" y="130" width="60" height="50" rx="4" fill="#243224" /><rect x="220" y="150" width="80" height="60" rx="4" fill="#243224" /><rect x="10" y="160" width="50" height="70" rx="4" fill="#243224" /><rect x="290" y="140" width="70" height="45" rx="4" fill="#243224" /><rect x="130" y="380" width="45" height="40" rx="4" fill="#243224" /><rect x="250" y="360" width="60" height="55" rx="4" fill="#243224" /></>
          : <><rect x="100" y="130" width="60" height="50" rx="4" fill="#c8d0bc" /><rect x="220" y="150" width="80" height="60" rx="4" fill="#c8d0bc" /><rect x="10" y="160" width="50" height="70" rx="4" fill="#c8d0bc" /><rect x="290" y="140" width="70" height="45" rx="4" fill="#c8d0bc" /><rect x="130" y="380" width="45" height="40" rx="4" fill="#c8d0bc" /><rect x="250" y="360" width="60" height="55" rx="4" fill="#c8d0bc" /></>
        }
      </svg>

      {/* TOP: Apple Maps turn card */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          background: t.cardBg,
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20,
          paddingTop: 52,
          paddingBottom: 16,
          paddingLeft: 16,
          paddingRight: 16,
          boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.6)" : "0 4px 20px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ width: 36, height: 4, background: t.handle, borderRadius: 2, margin: "0 auto 12px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#3a8f3a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path d="M18 6 L18 24 M10 16 L18 6 L26 16" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: t.muted, fontSize: 13, marginBottom: 3 }}>In 0.3 mi</div>
            <div style={{ color: t.text, fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>Start on Clay Hill</div>
            <div style={{ color: t.muted, fontSize: 14, marginTop: 3 }}>V5 Great Monks Street</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ color: t.text, fontSize: 16, fontWeight: 700 }}>0.3</div>
            <div style={{ color: t.muted, fontSize: 12 }}>mi</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L13 13H1L7 1Z" fill="#3a8f3a" /></svg>
            <span style={{ color: "#f59e0b", fontWeight: 600 }}>Manchester</span>
          </div>
          <div style={{ color: t.muted, fontSize: 13 }}>Step 2 of 8</div>
          <button style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "4px 8px" }}>End</button>
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div style={{ position: "absolute", right: 12, top: "45%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { label: "2D" },
          { icon: "🔇" },
          { icon: "👥" },
          { icon: "⚠️" },
          { icon: "🚶" },
        ].map((btn, i) => (
          <div key={i} style={{ width: 42, height: 42, borderRadius: 12, background: t.sideBtn, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: (btn as any).label ? 13 : 18, fontWeight: (btn as any).label ? 700 : 400, color: t.text, boxShadow: "0 2px 8px rgba(0,0,0,0.2)", backdropFilter: "blur(10px)", border: isDark ? "none" : `1px solid ${t.border}` }}>
            {(btn as any).label ?? (btn as any).icon}
          </div>
        ))}
      </div>

      {/* BOTTOM STATS BAR */}
      <div style={{ position: "absolute", bottom: 83, left: 0, right: 0, background: t.statsOverlay, backdropFilter: "blur(20px)", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 12, paddingLeft: 20, paddingRight: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", marginBottom: 10 }}>
          {[
            { value: "21:02", label: "arrival" },
            { value: "8", label: "hrs" },
            { value: "4", label: "mi" },
          ].map((stat, i, arr) => (
            <React.Fragment key={stat.label}>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: t.text, fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>{stat.value}</div>
                <div style={{ color: t.muted, fontSize: 12 }}>{stat.label}</div>
              </div>
              {i < arr.length - 1 && <div style={{ width: 1, height: 36, background: t.border }} />}
            </React.Fragment>
          ))}
        </div>
        <div style={{ textAlign: "center", color: "#f59e0b", fontSize: 14, fontWeight: 600 }}>⭐ Share ETA</div>
      </div>

      {/* Tab bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 83, background: t.tabBg, borderTop: `1px solid ${t.tabBorder}`, display: "flex", alignItems: "flex-start", paddingTop: 8, backdropFilter: "blur(20px)" }}>
        {[
          { icon: "📡", label: "Convoy" },
          { icon: "🗺️", label: "Map", active: true },
          { icon: "👥", label: "Convoys" },
          { icon: "⚙️", label: "Settings" },
        ].map((tab) => (
          <div key={tab.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ fontSize: 20 }}>{tab.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: tab.active ? "#f59e0b" : t.tabInactive }}>{tab.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

import React from "react";
