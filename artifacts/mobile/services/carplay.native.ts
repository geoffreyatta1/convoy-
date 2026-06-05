/**
 * CarPlay integration service for the Convoy app — native (iOS/Android) implementation.
 *
 * Uses react-native-carplay to manage the in-car display session.
 *
 * REQUIREMENTS (before CarPlay will appear on a real device):
 *  1. A development build — not Expo Go.
 *  2. Apple CarPlay entitlement: com.apple.developer.carplay-navigation
 *     (apply at https://developer.apple.com/contact/carplay/)
 *  3. The `withCarPlay` Expo config plugin in app.json (already configured).
 *
 * COMPLIANCE: February 2026 CarPlay Developer Guide
 *  - Idle screen uses InformationTemplate (no "pick up your iPhone" instruction)
 *  - MapTemplate includes a pan mode toggle button + pan callbacks (knob/touchpad)
 *  - onDidCancelNavigation terminates the CPNavigationSession when car nav takes over
 *  - CPVoiceControlTemplate presented while PTT mic is active (recording gate)
 *  - instructionVariants are ordered longest-first per guide §4.2
 *  - initialTravelEstimates seeded on every new CPManeuver
 *  - iOS 26 multitouch (pinchZoom/twoFingerPitch/twoFingerRotate) forwarded via
 *    DeviceEventEmitter to the map view (ConvoyMap subscribes and animates camera)
 */

import { DeviceEventEmitter, Platform } from "react-native";

export interface CarPlayVehicle {
  id: string;
  name: string;
  isLeader: boolean;
  isMe: boolean;
  speed?: number;
  color: string;
}

export interface CarPlayState {
  convoyName: string;
  code: string;
  vehicles: CarPlayVehicle[];
  isTalking: boolean;
  destination?: string;
  /** Current navigation step, if a convoy navigation session is active. */
  currentStep?: { instruction: string; distanceM: number; icon: string };
  /** Zero-based index of the current step — triggers updates even when two
   *  consecutive steps share identical instruction text. */
  currentStepIndex?: number;
  /** All remaining steps from currentStepIndex onward (including current).
   *  Used to push a full upcoming-maneuver queue to CPNavigationSession. */
  upcomingSteps?: Array<{ instruction: string; distanceM: number; icon: string }>;
  /** Vehicles that have exceeded the gap threshold, with their distance to the leader. */
  gapWarningVehicles?: Array<{ id: string; name: string; distanceM: number }>;
}

// ─── Maneuver icon assets ─────────────────────────────────────────────────────
// Bundled white-on-transparent PNG arrow images (80×80 px) used as the
// symbolImage on CPManeuver. require() calls must be static string literals
// so the Metro bundler can resolve them at build time.

const MANEUVER_IMAGES: Record<string, ReturnType<typeof require>> = {
  "arrow-up":                  require("../assets/images/carplay/arrow-up.png"),
  "turn-left":                 require("../assets/images/carplay/turn-left.png"),
  "turn-right":                require("../assets/images/carplay/turn-right.png"),
  "u-turn-left":               require("../assets/images/carplay/u-turn-left.png"),
  "subdirectory-arrow-left":   require("../assets/images/carplay/subdirectory-arrow-left.png"),
  "subdirectory-arrow-right":  require("../assets/images/carplay/subdirectory-arrow-right.png"),
};

// ─── Lazy native imports ──────────────────────────────────────────────────────
// Only actually import on iOS — react-native-carplay has no Android support

// react-native-carplay ships no TypeScript declarations. All template classes,
// session objects, and the CarPlay singleton are typed as `any` here because
// there is no published @types package and writing a full ambient declaration
// file is out of scope. The `any` is intentional and centralized to this block.
/* eslint-disable @typescript-eslint/no-explicit-any */
let CarPlay: any = null;
let MapTemplate: any = null;
let ListTemplate: any = null;
let AlertTemplate: any = null;
let InformationTemplate: any = null;
let VoiceControlTemplate: any = null;
let Trip: any = null;

if (Platform.OS === "ios") {
  try {
    const m = require("react-native-carplay");
    CarPlay              = m.CarPlay;
    MapTemplate          = m.MapTemplate;
    ListTemplate         = m.ListTemplate;
    AlertTemplate        = m.AlertTemplate;
    InformationTemplate  = m.InformationTemplate;
    VoiceControlTemplate = m.VoiceControlTemplate;
    Trip                 = m.Trip;
  } catch {}
}

// ─── Module-level state ───────────────────────────────────────────────────────

type TalkCallback = () => void;
type NavigationCancelledCallback = () => void;

let onStartTalk: TalkCallback | null = null;
let onStopTalk: TalkCallback | null = null;
/** Fired when the car's own nav system cancels the convoy navigation session. */
let onNavigationCancelled: NavigationCancelledCallback | null = null;
let currentState: CarPlayState | null = null;
let isConnected = false;

/**
 * The single MapTemplate instance for the current CarPlay connection.
 * Created ONCE on connect; updated with updateConfig() on state changes.
 * Destroying and recreating it would cancel any active NavigationSession,
 * causing flicker and session churn on every convoy state update.
 */
let activeMapTemplate: any = null;
/** Active CPNavigationSession — exists only while convoy navigation is running. */
let activeNavSession: any = null;
/**
 * Key of the last maneuver pushed to the navigation session.
 * Encodes instruction + icon + rounded distance (100 m buckets) so step
 * transitions are detected even when two consecutive steps have identical
 * instruction text (e.g. two "Continue straight" steps at different distances).
 * Cleared whenever the session starts, finishes, or the connection drops.
 */
let lastNavStepKey: string | null = null;
/** True while a CPAlertTemplate gap-warning is on screen. Prevents alert stacking. */
let gapAlertShowing = false;
/**
 * Active CPVoiceControlTemplate shown while the driver is transmitting PTT.
 * The CarPlay Developer Guide requires this template to be visible whenever
 * the app is actively recording from the microphone.
 */
let activeVoiceTemplate: any = null;
/** True while panning mode is active on the MapTemplate. */
let isPanningActive = false;

// ─── Public API ───────────────────────────────────────────────────────────────

export function registerCarPlayCallbacks(startTalk: TalkCallback, stopTalk: TalkCallback) {
  onStartTalk = startTalk;
  onStopTalk = stopTalk;
}

/**
 * Register a callback fired when iOS signals `mapTemplateDidCancelNavigation`
 * (e.g. the driver's car built-in nav takes over the route).
 * Wire this in useCarBridge to call clearNavigation() on ConvoyContext.
 */
export function registerNavigationCancelledCallback(cb: NavigationCancelledCallback) {
  onNavigationCancelled = cb;
}

export function updateCarPlayUI(state: CarPlayState) {
  currentState = state;
  if (!isConnected || Platform.OS !== "ios") return;
  try {
    ensureMapTemplate(state);
    syncGapAlert(state);
  } catch {}
}

export function isCarPlayConnected() {
  return isConnected;
}

// ─── MapTemplate lifecycle ────────────────────────────────────────────────────

/**
 * Stable handlers that always reference the latest `currentState`.
 * Using named functions instead of inline closures means we can safely
 * pass them through updateConfig() without changing the reference each time.
 */
function handleBarButton({ id }: { id: string }) {
  if (id === "talk" && currentState) onTalkPress(currentState);
}

function handleMapButton({ id }: { id: string }) {
  if (!currentState) return;
  if (id === "list") {
    const lt = buildListTemplate(currentState);
    if (lt) try { CarPlay.pushTemplate(lt, true); } catch {}
  } else if (id === "pan") {
    // Toggle panning mode. Required for navigation apps on knob/touchpad vehicles
    // (February 2026 CarPlay Developer Guide). The pan button activates the
    // panning interface; tapping it again (or back button) dismisses it.
    if (!activeMapTemplate) return;
    if (isPanningActive) {
      try { activeMapTemplate.dismissPanningInterface(true); } catch {}
      isPanningActive = false;
    } else {
      try { activeMapTemplate.showPanningInterface(true); } catch {}
      isPanningActive = true;
    }
  }
}

/**
 * Fired by iOS when the car's built-in navigation system cancels the current
 * route (CPMapTemplateDelegate mapTemplateDidCancelNavigation:).
 * Terminate our CPNavigationSession and notify the convoy context.
 */
function handleNavigationCancelled() {
  if (activeNavSession) {
    try { activeNavSession.finish(); } catch {}
    activeNavSession = null;
    lastNavStepKey = null;
  }
  onNavigationCancelled?.();
}

/** Returns the map template config object for the current state. */
function mapTemplateConfig(state: CarPlayState): object {
  return {
    title: state.convoyName,
    leadingNavigationBarButtons: [{ id: "code", title: state.code }],
    trailingNavigationBarButtons: [talkButton(state.isTalking)],
    // Two map buttons: convoy list + pan mode toggle (max 4 allowed by iOS).
    // The pan button satisfies the Feb 2026 guide requirement for all navigation
    // apps to provide a panning control on knob/touchpad CarPlay vehicles.
    mapButtons: [
      { id: "list", systemIcon: "list.bullet" },
      { id: "pan",  systemIcon: "hand.draw"   },
    ],
    onBarButtonPressed: handleBarButton,
    onMapButtonPressed: handleMapButton,
    onPanBeganWithDirection: ({ direction }: { direction: string }) => {
      DeviceEventEmitter.emit("CARPLAY_PAN_DIRECTION", { direction });
    },
    onPanWithDirection: ({ direction }: { direction: string }) => {
      DeviceEventEmitter.emit("CARPLAY_PAN_DIRECTION", { direction });
    },
    onPanEndedWithDirection: ({ direction }: { direction: string }) => {
      DeviceEventEmitter.emit("CARPLAY_PAN_DIRECTION", { direction });
    },
    onDidCancelNavigation: handleNavigationCancelled,
  };
}

/**
 * Ensure the root MapTemplate exists and is up to date.
 * • First call per connection: creates the template and calls setRootTemplate().
 * • Subsequent calls: updates only title/buttons via updateConfig() — the
 *   existing NavigationSession stays alive and undisturbed.
 */
function ensureMapTemplate(state: CarPlayState) {
  if (!CarPlay || !MapTemplate) return;

  if (!activeMapTemplate) {
    activeMapTemplate = new MapTemplate(mapTemplateConfig(state));
    CarPlay.setRootTemplate(activeMapTemplate, true);
  } else {
    try { activeMapTemplate.updateConfig(mapTemplateConfig(state)); } catch {}
  }

  syncNavSession(state);
}

// ─── ListTemplate builder ─────────────────────────────────────────────────────

function buildListTemplate(state: CarPlayState): any {
  if (!ListTemplate) return null;
  return new ListTemplate({
    title: `${state.convoyName} · ${state.code}`,
    sections: [
      {
        header: `${state.vehicles.length} vehicles in convoy`,
        items: [...state.vehicles]
          .sort((a) => (a.isLeader ? -1 : 1))
          .map((v, i) => ({
            id: v.id,
            text: v.name + (v.isLeader ? " ★" : "") + (v.isMe ? " (You)" : ""),
            detailText:
              v.speed != null && v.speed > 0
                ? `${Math.round(v.speed)} mph · Position #${i + 1}`
                : `Position #${i + 1}`,
          })),
      },
    ],
    trailingNavigationBarButtons: [talkButton(state.isTalking)],
    onBarButtonPressed: handleBarButton,
  });
}

function talkButton(isTalking: boolean) {
  return {
    id: "talk",
    systemItem: isTalking ? "done" : "reply",
    title: isTalking ? "Talking…" : "Talk",
  };
}

/**
 * PTT press handler compliant with the CarPlay Developer Guide.
 *
 * The guide requires that a CPVoiceControlTemplate is presented on the car
 * display whenever the app is actively recording from the microphone. We
 * present it before unmuting and dismiss it when the transmission ends.
 */
function onTalkPress(state: CarPlayState) {
  if (state.isTalking) {
    onStopTalk?.();
    dismissVoiceTemplate();
  } else {
    presentVoiceTemplate();
    onStartTalk?.();
    // Auto-release after 8 s as a safety backstop; also dismisses the template.
    setTimeout(() => {
      onStopTalk?.();
      dismissVoiceTemplate();
    }, 8000);
  }
}

/** Present a CPVoiceControlTemplate to indicate active microphone recording. */
function presentVoiceTemplate() {
  if (!VoiceControlTemplate || !CarPlay) return;
  try {
    const vct = new VoiceControlTemplate({
      voiceControlStates: [
        {
          identifier: "transmitting",
          titleVariants: ["Transmitting…", "PTT Active"],
          repeats: true,
        },
      ],
    });
    // VoiceControlTemplate is a PresentableTemplate — use presentTemplate/
    // dismissTemplate (the modal presentation path) not push/popTemplate
    // (which operates on the navigation stack). This matches the CarPlay
    // Developer Guide and the react-native-carplay PresentableTemplates type.
    CarPlay.presentTemplate(vct, true);
    activeVoiceTemplate = vct;
  } catch {
    activeVoiceTemplate = null;
  }
}

/** Dismiss the active CPVoiceControlTemplate if one is currently presented. */
function dismissVoiceTemplate() {
  if (!activeVoiceTemplate || !CarPlay) return;
  try { CarPlay.dismissTemplate(true); } catch {}
  activeVoiceTemplate = null;
}

/**
 * Returns true when it is safe to open the mic (not connected, or template
 * presented OK). Returns false when CarPlay is connected but presentation failed —
 * caller must treat as fail-closed and must NOT unmute.
 */
export function ensureCarPlayVoiceTemplate(): boolean {
  if (!isConnected || Platform.OS !== "ios") return true; // not connected → safe
  if (activeVoiceTemplate) return true; // already presenting → safe
  presentVoiceTemplate();
  return activeVoiceTemplate !== null; // true = presented OK, false = failed
}

/**
 * Dismiss the CPVoiceControlTemplate after microphone recording ends.
 * Call from the PTT stop path in ConvoyContext after muting the mic.
 */
export function dismissCarPlayVoiceTemplate(): void {
  dismissVoiceTemplate();
}

// CarPlay gesture events forwarded via DeviceEventEmitter to ConvoyMap:
//   CARPLAY_PAN_DIRECTION { direction }  CARPLAY_PINCH_ZOOM { scale }
//   CARPLAY_PITCH { pitch }              CARPLAY_ROTATE { heading }

// ─── Navigation session management ───────────────────────────────────────────

/** Format a distance in metres to a short human-readable label. */
function formatDistanceM(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/**
 * Build instruction variants ordered longest-first per CarPlay Developer Guide
 * §4.2. CarPlay picks the best-fit string for the current display width.
 * Generates up to three length variants: full, ~30-char, ~15-char.
 */
function buildInstructionVariants(instruction: string): string[] {
  const full = instruction;

  const midCut = 30;
  const midIdx = full.length > midCut ? (full.lastIndexOf(" ", midCut) || midCut) : full.length;
  const mid = full.substring(0, midIdx);

  const shortCut = 15;
  const shortIdx = full.length > shortCut ? (full.lastIndexOf(" ", shortCut) || shortCut) : full.length;
  const short = full.substring(0, shortIdx);

  const variants = [full];
  if (mid !== full) variants.push(mid);
  if (short !== mid && short !== full) variants.push(short);
  return variants;
}

/** Push the full upcoming-maneuver queue to an existing NavigationSession.
 *  Each remaining step becomes a CPManeuver with its own initialTravelEstimates.
 *  updateTravelEstimates(0, …) is also called for the current step so the
 *  dashboard trip-bar reflects live distance immediately. */
function applyManeuverQueueToSession(
  session: any,
  steps: NonNullable<CarPlayState["upcomingSteps"]>,
): void {
  if (!session || steps.length === 0) return;
  try {
    // Assume ~15 m/s (≈54 km/h) average convoy speed for time estimates.
    const AVG_SPEED_MS = 15;

    const maneuvers = steps.map((step) => {
      const symbolImage = MANEUVER_IMAGES[step.icon] ?? MANEUVER_IMAGES["arrow-up"];
      const variants = buildInstructionVariants(step.instruction);
      const timeRemaining = Math.max(1, Math.round(step.distanceM / AVG_SPEED_MS));
      return {
        instructionVariants: variants,
        dashboardInstructionVariants: variants,
        notificationInstructionVariants: variants,
        symbolImage,
        symbolImageSize: { width: 40, height: 40 },
        tintSymbolImage: "#ffffff",
        initialTravelEstimates: {
          distanceRemaining: step.distanceM,
          timeRemaining,
          distanceUnits: "meters",
        },
      };
    });

    session.updateManeuvers(maneuvers);

    // Update live estimates for the first (current) maneuver.
    const first = steps[0];
    session.updateTravelEstimates(0, {
      distanceRemaining: first.distanceM,
      timeRemaining: Math.max(1, Math.round(first.distanceM / AVG_SPEED_MS)),
      distanceUnits: "meters",
    });
  } catch {}
}

/** Start a brand-new CPNavigationSession on the active MapTemplate. */
async function startNavSession(state: CarPlayState): Promise<void> {
  if (!activeMapTemplate || !Trip || !state.currentStep) return;

  try { activeNavSession?.cancel(); } catch {}
  activeNavSession = null;
  lastNavStepKey = null;

  const trip = new Trip({
    origin: { latitude: 0, longitude: 0, name: "Current Location" },
    destination: {
      latitude: 0,
      longitude: 0,
      name: state.destination ?? "Destination",
    },
    routeChoices: [
      {
        summaryVariants: [state.convoyName],
        selectionSummaryVariants: [state.convoyName],
        additionalInformationVariants: ["Convoy navigation"],
      },
    ],
  });

  try {
    const session = await activeMapTemplate.startNavigationSession(trip);
    activeNavSession = session;
    const queue = state.upcomingSteps ?? [state.currentStep];
    applyManeuverQueueToSession(session, queue);
    lastNavStepKey = state.currentStepIndex !== undefined
      ? `idx:${state.currentStepIndex}:${state.currentStep.instruction}:${state.currentStep.icon}`
      : `${state.currentStep.instruction}:${state.currentStep.icon}`;
  } catch {}
}

/**
 * Keep the CPNavigationSession in sync with state:
 * • Starts a new session when navigation begins.
 * • Updates the full maneuver queue when currentStepIndex changes.
 * • Finishes the session when navigation ends.
 */
function syncNavSession(state: CarPlayState): void {
  if (!state.currentStep) {
    if (activeNavSession) {
      try { activeNavSession.finish(); } catch {}
      activeNavSession = null;
      lastNavStepKey = null;
    }
    return;
  }

  if (!activeNavSession) {
    void startNavSession(state);
    return;
  }

  const stepKey = state.currentStepIndex !== undefined
    ? `idx:${state.currentStepIndex}:${state.currentStep.instruction}:${state.currentStep.icon}`
    : `${state.currentStep.instruction}:${state.currentStep.icon}:${Math.round(state.currentStep.distanceM / 100)}`;

  if (stepKey !== lastNavStepKey) {
    const queue = state.upcomingSteps ?? [state.currentStep];
    applyManeuverQueueToSession(activeNavSession, queue);
    lastNavStepKey = stepKey;
  }
}

// ─── Gap alert management ─────────────────────────────────────────────────────

/**
 * Show a CPAlertTemplate when a vehicle falls behind the gap threshold.
 * One alert is shown at a time; the driver must dismiss before the next appears.
 */
function syncGapAlert(state: CarPlayState): void {
  if (!AlertTemplate || !CarPlay || gapAlertShowing) return;

  const warnings = state.gapWarningVehicles;
  if (!warnings || warnings.length === 0) return;

  const worst = [...warnings].sort((a, b) => b.distanceM - a.distanceM)[0];
  const distLabel = formatDistanceM(worst.distanceM);

  gapAlertShowing = true;

  try {
    const alert = new AlertTemplate({
      titleVariants: ["Gap Warning"],
      message: `${worst.name} is ${distLabel} behind — convoy is stretching.`,
      actions: [{ id: "dismiss", title: "Dismiss", style: "cancel" }],
      onActionButtonPressed: () => {
        gapAlertShowing = false;
        try { CarPlay.popTemplate(true); } catch {}
      },
      onActionPressed: () => {
        gapAlertShowing = false;
        try { CarPlay.popTemplate(true); } catch {}
      },
    });
    CarPlay.pushTemplate(alert, true);
  } catch {
    gapAlertShowing = false;
  }
}

// ─── Idle screen ──────────────────────────────────────────────────────────────

/**
 * Shown when CarPlay connects but no convoy session is active.
 *
 * Uses InformationTemplate to display a useful waiting state WITHOUT any
 * instruction to pick up or interact with the iPhone. Instructing the driver
 * to use their phone while connected to CarPlay violates CarPlay Developer
 * Guide guideline 2 (Feb 2026).
 */
function showIdleTemplate() {
  if (!CarPlay || !InformationTemplate) return;

  const info = new InformationTemplate({
    title: "Convoy",
    items: [
      { title: "Status",  detail: "Waiting for convoy…" },
      { title: "App",     detail: "Family Convoy Navigator" },
    ],
    actions: [],
    onActionButtonPressed: () => {},
  });

  try { CarPlay.setRootTemplate(info, true); } catch {}
}

// ─── Public clear ────────────────────────────────────────────────────────────

/**
 * Called by useCarBridge when the driver leaves a convoy while CarPlay is
 * connected. Finishes any active navigation session, resets module state,
 * and immediately shows the idle InformationTemplate on the car display.
 */
export function clearCarPlayUI(): void {
  currentState = null;

  if (!isConnected || Platform.OS !== "ios") return;

  if (activeNavSession) {
    try { activeNavSession.finish(); } catch {}
    activeNavSession = null;
    lastNavStepKey = null;
  }

  dismissVoiceTemplate();

  activeMapTemplate = null;
  gapAlertShowing = false;
  isPanningActive = false;

  showIdleTemplate();
}

// ─── iOS 26 multitouch via CarPlay emitter ────────────────────────────────────

function subscribeMultitouchEvents(): (() => void) | null {
  try {
    const emitter = CarPlay?.emitter;
    if (!emitter) return null;

    // Pan lifecycle — keep isPanningActive in sync with the actual gesture state
    // rather than relying solely on the pan button toggle.
    // Note: directional pan events are already forwarded via MapTemplate config
    // callbacks (onPanWithDirection/Begin/End) so no separate emitter sub needed.
    const panBeginSub = emitter.addListener?.("didBeginPanGesture", () => {
      isPanningActive = true;
    });
    const panEndSub = emitter.addListener?.("didEndPanGestureWithVelocity", () => {
      isPanningActive = false;
    });

    // iOS 26 multitouch (CarPlay Ultra) — emitted via withCarPlayMultitouchPatch
    // vendor patch; no-op on earlier OS versions where events are never emitted.
    // Wrapped in try/catch so unsupported events do not throw when the patch
    // plugin is disabled (e.g. CarPlay entitlement not yet granted).
    let pinchSub: any, pitchSub: any, rotateSub: any;
    try {
      pinchSub = emitter.addListener?.("pinchZoom" as any, (e: { scale: number }) => {
        DeviceEventEmitter.emit("CARPLAY_PINCH_ZOOM", { scale: e.scale ?? 1 });
      });
    } catch {}
    try {
      pitchSub = emitter.addListener?.("twoFingerPitch" as any, (e: { pitch: number }) => {
        DeviceEventEmitter.emit("CARPLAY_PITCH", { pitch: e.pitch ?? 0 });
      });
    } catch {}
    try {
      rotateSub = emitter.addListener?.("twoFingerRotate" as any, (e: { heading: number }) => {
        DeviceEventEmitter.emit("CARPLAY_ROTATE", { heading: e.heading ?? 0 });
      });
    } catch {}

    return () => {
      try { panBeginSub?.remove?.(); }  catch {}
      try { panEndSub?.remove?.(); }    catch {}
      try { pinchSub?.remove?.(); }     catch {}
      try { pitchSub?.remove?.(); }     catch {}
      try { rotateSub?.remove?.(); }    catch {}
    };
  } catch {
    return null;
  }
}

let _unsubscribeMultitouch: (() => void) | null = null;

// ─── Public init ──────────────────────────────────────────────────────────────

export function initCarPlay() {
  if (Platform.OS !== "ios" || !CarPlay) return;

  // Subscribe to CarPlay emitter for multitouch gesture events.
  _unsubscribeMultitouch?.();
  _unsubscribeMultitouch = subscribeMultitouchEvents();

  try {
    CarPlay.registerOnConnect(() => {
      isConnected = true;
      gapAlertShowing = false;
      isPanningActive = false;
      activeMapTemplate = null;
      activeNavSession = null;
      lastNavStepKey = null;
      activeVoiceTemplate = null;

      if (currentState) {
        ensureMapTemplate(currentState);
        syncGapAlert(currentState);
      } else {
        showIdleTemplate();
      }
    });

    CarPlay.registerOnDisconnect(() => {
      isConnected = false;
      activeMapTemplate = null;
      activeNavSession = null;
      lastNavStepKey = null;
      gapAlertShowing = false;
      isPanningActive = false;
      activeVoiceTemplate = null;
    });
  } catch {}
}
