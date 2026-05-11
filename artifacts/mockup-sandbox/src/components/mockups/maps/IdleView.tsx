import React from "react";

const DARK = {
  mapBg: "#1c2820",
  mapRoad: "#334433",
  mapRoadBase: "#2a3a2a",
  cardBg: "#1c1c1e",
  pillBg: "rgba(28,28,30,0.92)",
  sheetBg: "rgba(0,0,0,0.88)",
  handle: "#48484a",
  text: "#ffffff",
  muted: "#8e8e93",
  border: "#2c2c2e",
  iconBg1: "#ef444420",
  iconBg2: "#f59e0b20",
  sideBtn: "rgba(28,28,30,0.9)",
  tabBg: "rgba(18,18,18,0.95)",
  tabBorder: "#2c2c2e",
  tabInactive: "#636366",
  statusDot: "#22c55e",
};

const LIGHT = {
  mapBg: "#d4dbc8",
  mapRoad: "#ffffff",
  mapRoadBase: "#c0c8b8",
  cardBg: "#ffffff",
  pillBg: "rgba(255,255,255,0.92)",
  sheetBg: "rgba(242,242,247,0.96)",
  handle: "#c7c7cc",
  text: "#000000",
  muted: "#6c6c70",
  border: "#e5e5ea",
  iconBg1: "#ef444415",
  iconBg2: "#f59e0b15",
  sideBtn: "rgba(255,255,255,0.92)",
  tabBg: "rgba(248,248,252,0.97)",
  tabBorder: "#d1d1d6",
  tabInactive: "#8e8e93",
  statusDot: "#22c55e",
};

export function IdleView() {
  const params = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const isDark = params.get("theme") !== "light";
  const t = isDark ? DARK : LIGHT;

  return (
    <div style={{ width: 390, height: 844, background: isDark ? "#000" : "#f2f2f7", position: "relative", overflow: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif" }}>
      {/* Fake map tiles */}
      <svg width="390" height="844" style={{ position: "absolute", inset: 0 }}>
        <rect width="390" height="844" fill={t.mapBg} />
        <path d="M0,350 Q150,330 220,360 Q310,390 390,370" stroke={t.mapRoadBase} strokeWidth="20" fill="none" />
        <path d="M0,350 Q150,330 220,360 Q310,390 390,370" stroke={t.mapRoad} strokeWidth="16" fill="none" />
        <path d="M100,0 L115,844" stroke={t.mapRoadBase} strokeWidth="14" fill="none" />
        <path d="M100,0 L115,844" stroke={t.mapRoad} strokeWidth="10" fill="none" />
        <path d="M240,0 L220,844" stroke={t.mapRoadBase} strokeWidth="22" fill="none" />
        <path d="M240,0 L220,844" stroke={t.mapRoad} strokeWidth="18" fill="none" />
        {isDark
          ? <><rect x="130" y="120" width="65" height="55" rx="4" fill="#243224" /><rect x="250" y="140" width="85" height="65" rx="4" fill="#243224" /><rect x="20" y="150" width="55" height="75" rx="4" fill="#243224" /><rect x="310" y="130" width="70" height="48" rx="4" fill="#243224" /></>
          : <><rect x="130" y="120" width="65" height="55" rx="4" fill="#c8d0bc" /><rect x="250" y="140" width="85" height="65" rx="4" fill="#c8d0bc" /><rect x="20" y="150" width="55" height="75" rx="4" fill="#c8d0bc" /><rect x="310" y="130" width="70" height="48" rx="4" fill="#c8d0bc" /></>
        }
        <circle cx="220" cy="440" r="12" fill="#f59e0b" />
        <circle cx="220" cy="440" r="18" fill="#f59e0b" fillOpacity="0.25" />
      </svg>

      {/* TOP: Convoy info pill */}
      <div style={{ position: "absolute", top: 56, left: 12, right: 64, background: t.pillBg, borderRadius: 14, padding: "10px 14px", backdropFilter: "blur(16px)", boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.4)" : "0 2px 12px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between", border: isDark ? "none" : `1px solid ${t.border}` }}>
        <div>
          <div style={{ color: t.text, fontSize: 15, fontWeight: 700 }}>Family Road Trip</div>
          <div style={{ color: t.muted, fontSize: 12 }}>Code: A8F2K1 · 2 cars</div>
        </div>
        <div style={{ background: "#f59e0b22", borderRadius: 10, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: 4, background: t.statusDot }} />
          <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>Active</span>
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div style={{ position: "absolute", right: 12, top: "42%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 8 }}>
        {([{ label: "2D" }, { icon: "🎙️" }, { icon: "👥" }, { icon: "ℹ️" }] as any[]).map((btn, i) => (
          <div key={i} style={{ width: 42, height: 42, borderRadius: 12, background: t.sideBtn, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: btn.label ? 13 : 18, fontWeight: btn.label ? 700 : 400, color: t.text, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", backdropFilter: "blur(10px)", border: isDark ? "none" : `1px solid ${t.border}` }}>
            {btn.label ?? btn.icon}
          </div>
        ))}
        {/* Recenter */}
        <div style={{ width: 42, height: 42, borderRadius: 12, background: t.sideBtn, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", border: isDark ? "none" : `1px solid ${t.border}` }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="4" fill="#f59e0b" />
            <path d="M10 2V5M10 15V18M2 10H5M15 10H18" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* BOTTOM SHEET */}
      <div style={{ position: "absolute", bottom: 83, left: 0, right: 0, background: t.sheetBg, backdropFilter: "blur(20px)", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: "16px 20px 12px", border: isDark ? "none" : `1px solid ${t.border}` }}>
        <div style={{ width: 36, height: 4, background: t.handle, borderRadius: 2, margin: "0 auto 14px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: t.iconBg1, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 16 }}>📍</span></div>
            <div>
              <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>Manchester</div>
              <div style={{ color: t.muted, fontSize: 12 }}>Destination</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: t.iconBg2, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 16 }}>👥</span></div>
            <div>
              <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>Convoy Members</div>
              <div style={{ color: t.muted, fontSize: 12 }}>2 drivers</div>
            </div>
          </div>
          {/* Green Navigate button */}
          <button style={{ width: "100%", background: "#22c55e", border: "none", borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 4, boxShadow: "0 4px 16px rgba(34,197,94,0.35)" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 9L16 2L9 16L7.5 10.5L2 9Z" fill="white" /></svg>
            Navigate
          </button>
        </div>
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
