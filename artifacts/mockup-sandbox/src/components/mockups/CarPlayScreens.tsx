/**
 * CarPlay mockup screens — four 1280×720 frames for the Apple CarPlay
 * navigation entitlement application form.
 *
 * Access at /preview/CarPlayScreens
 *
 * Screens rendered:
 *  1. Navigation active  — MapTemplate + maneuver panel
 *  2. Convoy member list — ListTemplate
 *  3. Gap alert          — CPAlertTemplate overlay
 *  4. Idle / no convoy   — GridTemplate
 */

const W = 1280;
const H = 720;
const ORANGE = "#f59e0b";
const BG = "#000000";
const SURFACE = "#1c1c1e";
const SURFACE2 = "#2c2c2e";
const TEXT = "#ffffff";
const TEXT2 = "#ebebf599"; // secondary label
const DIVIDER = "#38383a";
const NAV_H = 64;
const STATUS_H = 32;

// ─── Shared primitives ─────────────────────────────────────────────────────────

function StatusBar() {
  return (
    <div
      style={{
        height: STATUS_H,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(10px)",
        flexShrink: 0,
      }}
    >
      <span style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>9:41</span>
      <span style={{ color: TEXT, fontSize: 13, opacity: 0.7 }}>▲ ▲ ▲ ●</span>
    </div>
  );
}

function NavBar({
  title,
  leftLabel,
  rightLabel,
  rightOrange,
}: {
  title: string;
  leftLabel?: string;
  rightLabel?: string;
  rightOrange?: boolean;
}) {
  return (
    <div
      style={{
        height: NAV_H,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: "rgba(28,28,30,0.95)",
        backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${DIVIDER}`,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          background: SURFACE2,
          borderRadius: 8,
          padding: "6px 14px",
          minWidth: 64,
        }}
      >
        <span style={{ color: TEXT2, fontSize: 14, fontWeight: 600 }}>
          {leftLabel ?? ""}
        </span>
      </div>
      <span style={{ color: TEXT, fontSize: 18, fontWeight: 700 }}>{title}</span>
      <div
        style={{
          background: rightOrange ? ORANGE : SURFACE2,
          borderRadius: 8,
          padding: "6px 14px",
          minWidth: 64,
          textAlign: "center",
        }}
      >
        <span
          style={{
            color: rightOrange ? "#000" : TEXT,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {rightLabel ?? "Talk"}
        </span>
      </div>
    </div>
  );
}

function Frame({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div style={{ marginBottom: 48 }}>
      <div
        style={{
          color: "#aaa",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
      <div
        style={{
          width: W,
          height: H,
          background: BG,
          overflow: "hidden",
          position: "relative",
          fontFamily:
            "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          outline: "2px solid #333",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Screen 1: Navigation active ───────────────────────────────────────────────

function ArrowIcon({ icon }: { icon: string }) {
  const arrows: Record<string, string> = {
    "turn-left": "↰",
    "turn-right": "↱",
    "u-turn-left": "↶",
    "arrow-up": "↑",
    "subdirectory-arrow-left": "↲",
    "subdirectory-arrow-right": "↳",
  };
  return (
    <div
      style={{
        width: 120,
        height: 120,
        borderRadius: 24,
        background: ORANGE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 64,
        color: "#000",
        flexShrink: 0,
      }}
    >
      {arrows[icon] ?? "↑"}
    </div>
  );
}

function ScreenNavActive() {
  return (
    <Frame label="Screen 1 — Navigation active (MapTemplate + maneuver panel)">
      <StatusBar />
      <NavBar title="Blue Lagoon" leftLabel="ABC1" rightLabel="Talk" />

      {/* Maneuver panel */}
      <div
        style={{
          background: "rgba(28,28,30,0.98)",
          borderBottom: `1px solid ${DIVIDER}`,
          padding: "20px 28px",
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexShrink: 0,
        }}
      >
        <ArrowIcon icon="turn-left" />
        <div style={{ flex: 1 }}>
          <div style={{ color: ORANGE, fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            In 350 m
          </div>
          <div style={{ color: TEXT, fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>
            Turn left onto
          </div>
          <div style={{ color: TEXT, fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>
            Riverside Drive
          </div>
          <div style={{ color: TEXT2, fontSize: 16, marginTop: 8 }}>
            Then continue for 1.2 km
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: TEXT2, fontSize: 14 }}>ETA</div>
          <div style={{ color: TEXT, fontSize: 28, fontWeight: 700 }}>12 min</div>
          <div style={{ color: TEXT2, fontSize: 14, marginTop: 4 }}>3.4 km left</div>
        </div>
      </div>

      {/* Map area */}
      <div
        style={{
          flex: 1,
          background: `linear-gradient(160deg, #1a2a1a 0%, #0d1a0d 100%)`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Fake road lines */}
        <svg width={W} height="100%" style={{ position: "absolute", inset: 0 }}>
          <line x1="640" y1="0" x2="640" y2="400" stroke="#2d3d2d" strokeWidth="60" />
          <line x1="640" y1="0" x2="640" y2="400" stroke="#3d5a3d" strokeWidth="8" strokeDasharray="30 20" />
          <line x1="640" y1="180" x2="200" y2="180" stroke="#2d3d2d" strokeWidth="60" />
          <line x1="640" y1="180" x2="200" y2="180" stroke="#3d5a3d" strokeWidth="8" strokeDasharray="30 20" />
          {/* Route highlight */}
          <line x1="640" y1="400" x2="640" y2="180" stroke={ORANGE} strokeWidth="6" strokeOpacity="0.8" />
          <line x1="640" y1="180" x2="200" y2="180" stroke={ORANGE} strokeWidth="6" strokeOpacity="0.8" />
          {/* Turn arrow */}
          <polygon points="600,185 640,160 680,185" fill={ORANGE} />
        </svg>

        {/* Convoy vehicles */}
        <div style={{ position: "absolute", bottom: 20, left: 24, display: "flex", gap: 12 }}>
          {[
            { name: "James ★", color: ORANGE, me: false },
            { name: "You", color: "#3b82f6", me: true },
            { name: "Sarah", color: "#ef4444", me: false },
          ].map((v) => (
            <div
              key={v.name}
              style={{
                background: SURFACE,
                borderRadius: 8,
                padding: "6px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: v.me ? `1.5px solid ${ORANGE}` : "1.5px solid transparent",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: v.color,
                }}
              />
              <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>{v.name}</span>
            </div>
          ))}
        </div>

        {/* Map button */}
        <div
          style={{
            position: "absolute",
            right: 24,
            bottom: 24,
            background: SURFACE,
            borderRadius: 12,
            width: 48,
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${DIVIDER}`,
          }}
        >
          <span style={{ color: TEXT, fontSize: 22 }}>≡</span>
        </div>
      </div>
    </Frame>
  );
}

// ─── Screen 2: Convoy member list ──────────────────────────────────────────────

function ScreenMemberList() {
  const members = [
    { name: "James", role: "Leader ★", speed: "58 mph", pos: 1, color: ORANGE },
    { name: "You (Alex)", role: "Driver", speed: "56 mph", pos: 2, color: "#3b82f6" },
    { name: "Sarah", role: "Driver", speed: "55 mph", pos: 3, color: "#ef4444" },
    { name: "Mike", role: "Driver", speed: "54 mph", pos: 4, color: "#22c55e" },
  ];

  return (
    <Frame label="Screen 2 — Convoy member list (ListTemplate)">
      <StatusBar />
      <NavBar title="Blue Lagoon · ABC1" leftLabel="‹ Back" rightLabel="Talk" />

      {/* Section header */}
      <div
        style={{
          padding: "12px 24px 8px",
          background: SURFACE,
          flexShrink: 0,
        }}
      >
        <span style={{ color: TEXT2, fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          4 vehicles in convoy
        </span>
      </div>

      {/* List rows */}
      <div style={{ flex: 1, background: SURFACE, overflowY: "hidden" }}>
        {members.map((m, i) => (
          <div key={m.name}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 24px",
                height: 128,
                gap: 20,
              }}
            >
              {/* Position badge */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  background: m.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ color: "#000", fontSize: 20, fontWeight: 800 }}>
                  {m.pos}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: TEXT, fontSize: 24, fontWeight: 700 }}>{m.name}</div>
                <div style={{ color: TEXT2, fontSize: 17, marginTop: 4 }}>{m.role}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: TEXT, fontSize: 22, fontWeight: 600 }}>{m.speed}</div>
                <div style={{ color: TEXT2, fontSize: 15, marginTop: 2 }}>Position #{m.pos}</div>
              </div>
            </div>
            {i < members.length - 1 && (
              <div style={{ height: 1, background: DIVIDER, margin: "0 24px" }} />
            )}
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ─── Screen 3: Gap alert ───────────────────────────────────────────────────────

function ScreenGapAlert() {
  return (
    <Frame label="Screen 3 — Gap alert (CPAlertTemplate)">
      <StatusBar />
      <NavBar title="Blue Lagoon" leftLabel="ABC1" rightLabel="Talk" />

      {/* Map background (blurred) */}
      <div
        style={{
          flex: 1,
          background: `linear-gradient(160deg, #1a2a1a 0%, #0d1a0d 100%)`,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Alert card */}
        <div
          style={{
            background: SURFACE,
            borderRadius: 20,
            padding: "40px 48px",
            width: 640,
            textAlign: "center",
            boxShadow: "0 40px 80px rgba(0,0,0,0.8)",
            border: `1px solid ${DIVIDER}`,
          }}
        >
          {/* Warning icon */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              background: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
              fontSize: 36,
              color: "#fff",
            }}
          >
            ⚠
          </div>

          <div
            style={{
              color: TEXT,
              fontSize: 30,
              fontWeight: 800,
              marginBottom: 16,
            }}
          >
            Gap Warning
          </div>
          <div
            style={{
              color: TEXT2,
              fontSize: 20,
              lineHeight: 1.5,
              marginBottom: 36,
            }}
          >
            Mike is <span style={{ color: "#ef4444", fontWeight: 700 }}>1.4 km behind</span>
            <br />
            Convoy is stretching — consider slowing down.
          </div>

          <div
            style={{
              background: SURFACE2,
              borderRadius: 14,
              padding: "18px 32px",
              display: "inline-block",
              cursor: "pointer",
              border: `1px solid ${DIVIDER}`,
            }}
          >
            <span style={{ color: TEXT, fontSize: 20, fontWeight: 700 }}>
              Dismiss
            </span>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ─── Screen 4: Idle / no convoy ────────────────────────────────────────────────

function ScreenIdle() {
  return (
    <Frame label="Screen 4 — Idle / no convoy (GridTemplate)">
      <StatusBar />
      <NavBar title="Convoy" />

      {/* Grid content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: SURFACE,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 32,
          }}
        >
          {/* App icon button */}
          <div
            style={{
              background: BG,
              borderRadius: 28,
              width: 180,
              height: 180,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              border: `1.5px solid ${DIVIDER}`,
            }}
          >
            <span style={{ fontSize: 80 }}>🚗</span>
            <span
              style={{
                color: TEXT,
                fontSize: 16,
                fontWeight: 700,
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              Open Convoy
              <br />
              App
            </span>
          </div>

          <div
            style={{
              color: TEXT2,
              fontSize: 20,
              textAlign: "center",
              maxWidth: 480,
              lineHeight: 1.5,
            }}
          >
            Start or join a convoy on your iPhone
            <br />
            to see it here on CarPlay.
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ─── Screen 5: In Formation status ────────────────────────────────────────────

function ScreenInFormation() {
  return (
    <Frame label="Screen 5 — Formation Status (MapTemplate · all cars in sync)">
      <StatusBar />
      {/* NavBar shows convoy code + "In formation" pill + Talk button */}
      <div
        style={{
          height: NAV_H,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          background: "rgba(28,28,30,0.95)",
          backdropFilter: "blur(20px)",
          borderBottom: `1px solid ${DIVIDER}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ background: SURFACE2, borderRadius: 8, padding: "6px 14px" }}>
            <span style={{ color: TEXT2, fontSize: 14, fontWeight: 600 }}>A3X9F2</span>
          </div>
          {/* Formation status pill — shown when gapWarnings.size === 0 and ≥2 cars */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(34,197,94,0.15)",
              border: "1px solid rgba(34,197,94,0.35)",
              borderRadius: 8,
              padding: "6px 12px",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: "#22c55e",
                boxShadow: "0 0 6px #22c55e",
              }}
            />
            <span style={{ color: "#22c55e", fontSize: 14, fontWeight: 700 }}>In formation</span>
          </div>
        </div>
        <span style={{ color: TEXT, fontSize: 18, fontWeight: 700 }}>Desert Convoy</span>
        <div style={{ background: SURFACE2, borderRadius: 8, padding: "6px 14px" }}>
          <span style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>Talk</span>
        </div>
      </div>

      {/* Map area showing tight convoy formation (3 car dots) */}
      <div style={{ flex: 1, position: "relative", background: "#1a2433" }}>
        {/* Simulated road */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 48,
            transform: "translateX(-50%)",
            background: "#2d3748",
          }}
        />
        {/* Dashes */}
        {[100, 200, 300, 400, 500].map((top) => (
          <div
            key={top}
            style={{
              position: "absolute",
              left: "50%",
              top,
              width: 4,
              height: 32,
              transform: "translateX(-50%)",
              background: "#f59e0b",
              opacity: 0.5,
            }}
          />
        ))}

        {/* Car dots — tight formation, green rings */}
        {[
          { top: 200, label: "You", color: ORANGE },
          { top: 270, label: "Maya", color: "#3b82f6" },
          { top: 340, label: "Raj", color: "#a855f7" },
        ].map(({ top, label, color }) => (
          <div key={label} style={{ position: "absolute", left: "calc(50% - 18px)", top }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: color,
                border: "3px solid #22c55e",
                boxShadow: `0 0 14px ${color}88`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 16 }}>🚗</span>
            </div>
            <div
              style={{
                marginTop: 4,
                background: "rgba(0,0,0,0.7)",
                borderRadius: 4,
                padding: "2px 6px",
                textAlign: "center",
              }}
            >
              <span style={{ color: TEXT, fontSize: 11, fontWeight: 600 }}>{label}</span>
            </div>
          </div>
        ))}

        {/* Formation confirmed banner */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(34,197,94,0.2)",
            border: "1px solid rgba(34,197,94,0.5)",
            borderRadius: 12,
            padding: "12px 28px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: 20 }}>✅</span>
          <span style={{ color: "#22c55e", fontSize: 16, fontWeight: 700 }}>
            All 3 vehicles in formation
          </span>
        </div>
      </div>
    </Frame>
  );
}

// ─── Screen 6: PTT / VoiceControlTemplate active ───────────────────────────────

function ScreenPTTActive() {
  return (
    <Frame label="Screen 6 — Push-to-Talk Active (VoiceControlTemplate)">
      <StatusBar />
      <NavBar title="Push-to-Talk" leftLabel="A3X9F2" rightLabel="Release" rightOrange />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          background: BG,
        }}
      >
        {/* Pulsing mic indicator */}
        <div style={{ position: "relative", width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Outer pulse ring */}
          <div
            style={{
              position: "absolute",
              width: 160,
              height: 160,
              borderRadius: 80,
              border: `2px solid ${ORANGE}`,
              opacity: 0.25,
            }}
          />
          {/* Mid ring */}
          <div
            style={{
              position: "absolute",
              width: 120,
              height: 120,
              borderRadius: 60,
              border: `2px solid ${ORANGE}`,
              opacity: 0.5,
            }}
          />
          {/* Core button */}
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              background: ORANGE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 32px ${ORANGE}88`,
            }}
          >
            <span style={{ fontSize: 36 }}>🎙️</span>
          </div>
        </div>

        {/* Waveform bars */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {[18, 36, 52, 40, 62, 48, 30, 56, 38, 20, 44, 32, 60, 26, 50].map((h, i) => (
            <div
              key={i}
              style={{
                width: 6,
                height: h,
                borderRadius: 3,
                background: ORANGE,
                opacity: 0.7 + (i % 3) * 0.1,
              }}
            />
          ))}
        </div>

        {/* Label */}
        <div style={{ textAlign: "center" }}>
          <div style={{ color: ORANGE, fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            Broadcasting to convoy
          </div>
          <div style={{ color: TEXT2, fontSize: 16 }}>Desert Convoy · 3 members</div>
          <div style={{ color: TEXT2, fontSize: 14, marginTop: 8 }}>
            Auto-releases in <span style={{ color: ORANGE }}>10 s</span>
          </div>
        </div>

        {/* Release hint */}
        <div
          style={{
            background: SURFACE,
            border: `1px solid ${ORANGE}44`,
            borderRadius: 12,
            padding: "12px 28px",
          }}
        >
          <span style={{ color: TEXT2, fontSize: 14 }}>
            Press{" "}
            <span style={{ color: TEXT, fontWeight: 600 }}>Release</span>
            {" "}or use knob to end broadcast
          </span>
        </div>
      </div>
    </Frame>
  );
}

// ─── Individual screen exports (used by per-screen routes) ────────────────────

export { ScreenNavActive as CarPlayNav };
export { ScreenMemberList as CarPlayList };
export { ScreenGapAlert as CarPlayAlert };
export { ScreenIdle as CarPlayIdle };
export { ScreenInFormation as CarPlayFormation };
export { ScreenPTTActive as CarPlayPTT };

// ─── Root export (all 6 in one scrollable page) ────────────────────────────────

export default function CarPlayScreens() {
  return (
    <div
      style={{
        background: "#0a0a0a",
        minHeight: "100vh",
        padding: "48px 48px 80px",
        fontFamily:
          "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
      }}
    >
      <div style={{ marginBottom: 40 }}>
        <h1
          style={{
            color: ORANGE,
            fontSize: 28,
            fontWeight: 800,
            margin: "0 0 8px",
          }}
        >
          Convoy — CarPlay Mockup Screens
        </h1>
        <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
          1280 × 720 px · Dark UI · 6 screens · For Apple CarPlay navigation entitlement
          application form
        </p>
      </div>

      <ScreenNavActive />
      <ScreenMemberList />
      <ScreenGapAlert />
      <ScreenIdle />
      <ScreenInFormation />
      <ScreenPTTActive />
    </div>
  );
}
