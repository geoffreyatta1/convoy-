import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { AppState, AppStateStatus, Platform } from "react-native";
import {
  suppressTts,
  resumeTts,
  announceGapWarning,
  announceConvoyRegrouped,
  announceGapCleared,
  announceHazard,
  announceNavStep,
  announceStopRequest,
  announceStopProposal,
} from "@/services/tts";
import {
  isCarPlayConnected,
  ensureCarPlayVoiceTemplate,
  dismissCarPlayVoiceTemplate,
} from "@/services/carplay";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  NavStep,
  fetchRoute,
  fetchRouteViaStop,
  findMergePoint,
  haversineMeters,
} from "@/services/routing";
import {
  getConvoyWsClient,
  WsLocationMessage,
  WsPrivatePttMessage,
  WsPrivatePttEndMessage,
  WsStopRequestMessage,
  WsStopResponseMessage,
  WsRegroupPinMessage,
  WsRegroupEtaMessage,
  WsStopProposalMessage,
  WsStopProposalResponseMessage,
  WsLeaderHandoffMessage,
  WsNavStartMessage,
  WsNavStepMessage,
  WsNavClearMessage,
  type StopStation,
} from "@/services/convoy-ws";
export type { StopStation, WsStopProposalMessage };
import {
  Hazard,
  HazardType,
  fetchHazards,
  reportHazard as apiReportHazard,
} from "@/services/hazards";
import {
  configureAudioSessionForConvoy,
  destroyAgora,
  getCurrentChannel,
  getCurrentPrivateChannel,
  initAgora,
  isAgoraAvailable,
  joinChannel,
  joinPrivateChannel,
  leaveChannel,
  leavePrivateChannel,
  muteLocalAudio,
  mutePrivateAudio,
  privateChannelName,
  resetAudioSession,
  setTokenRenewalErrorHandler,
  setConnectionStatusCallback,
  clearReconnectState,
  unmuteLocalAudio,
  unmutePrivateAudio,
  vehicleIdToAgoraUid,
} from "@/services/agora";

export type { Hazard, HazardType };

export interface RegroupPin {
  pinId: string;
  fromVehicleName: string;
  lat: number;
  lng: number;
  name: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Metres within convoy route polyline to be considered "on the convoy route" */
const JOIN_THRESHOLD = 50;
/** Metres from next personal step to auto-advance */
const STEP_ADVANCE_THRESHOLD = 30;
/** Default metres behind the leader before a vehicle is flagged as lagging */
export const GAP_THRESHOLD_M = 500;
const GAP_THRESHOLD_STORAGE_KEY = "@convoy/gap_threshold_m";
/** How long (ms) to keep a private Agora channel alive after a transmission ends. */
const PRIVATE_IDLE_MS = 30_000;
/** Allowed gap thresholds; any persisted value outside this list is ignored */
const ALLOWED_GAP_VALUES = [200, 500, 1000, 2000] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Vehicle {
  id: string;
  name: string;
  emoji: string;
  isLeader: boolean;
  isMe: boolean;
  location: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  };
  lastSeen: number;
  color: string;
}

export interface ConvoyMessage {
  id: string;
  vehicleId: string;
  vehicleName: string;
  type: "text" | "audio" | "system";
  content: string;
  timestamp: number;
  /** Set when this was a private one-to-one transmission */
  targetVehicleName?: string;
}

export interface NavigationState {
  destination: { latitude: number; longitude: number; name: string };
  route: Array<{ latitude: number; longitude: number }>;
  steps: NavStep[];
  currentStepIndex: number;
  totalDistanceM: number;
  totalDurationS: number;
  /** Traffic-aware total duration (duration_in_traffic from Google Directions).
   *  Equals totalDurationS when traffic data is unavailable. */
  totalDurationInTrafficS: number;
  /** "self" when this device initiated navigation; "leader" when synced from convoy leader; "regroup" when navigating to a regroup pin. */
  navSource?: "self" | "leader" | "regroup";
}

/**
 * State for a follower's personal route to the convoy merge point.
 * While onConvoyRoute=false the follower navigates their personal route.
 * Once onConvoyRoute=true they follow the shared convoy steps.
 */
export interface MergeState {
  /** Point on the convoy route where the follower will intercept */
  mergePoint: { latitude: number; longitude: number };
  /** Index in convoy route.route[] where follower joins */
  mergeRouteIndex: number;
  /** Current straight-line distance to merge point (metres) */
  distanceToMergeM: number;
  /** Follower's personal route polyline to the merge point */
  personalRoute: Array<{ latitude: number; longitude: number }>;
  /** Turn-by-turn steps for the personal route */
  personalSteps: NavStep[];
  /** Which personal step the follower is currently on */
  personalStepIndex: number;
  /** True once the follower is within JOIN_THRESHOLD of the convoy route */
  onConvoyRoute: boolean;
}

export interface ConvoySession {
  id: string;
  name: string;
  code: string;
  destination?: {
    name: string;
    latitude: number;
    longitude: number;
  };
  navigation?: NavigationState;
  vehicles: Vehicle[];
  messages: ConvoyMessage[];
  isActive: boolean;
  createdAt: number;
}

interface ConvoyContextValue {
  session: ConvoySession | null;
  myVehicle: Vehicle | null;
  isLeader: boolean;
  mergeState: MergeState | null;
  createConvoy: (name: string, vehicleName: string) => Promise<void>;
  joinConvoy: (code: string, vehicleName: string) => Promise<boolean>;
  leaveConvoy: () => Promise<void>;
  updateMyLocation: (location: Vehicle["location"]) => void;
  sendMessage: (content: string) => void;
  setDestination: (name: string, lat: number, lng: number) => void;
  startNavigation: (nav: NavigationState) => void;
  advanceNavStep: (index: number) => void;
  clearNavigation: () => void;
  /** Compute the personal merge route for a follower (call once nav starts) */
  computeMerge: (lat: number, lng: number) => Promise<void>;
  /** Update merge progress on each GPS tick; detects route join + step advance */
  updateMergeProgress: (lat: number, lng: number) => void;
  /** Manually advance personal merge step (used by web simulation) */
  advanceMergeStep: (index: number) => void;
  isTalking: boolean;
  /** Returns true if transmission was successfully started */
  startTalking: () => Promise<boolean>;
  stopTalking: () => void;
  /**
   * The vehicle currently selected as the private PTT target.
   * null means group broadcast (default).
   * Gating (Convenience tier+) is enforced in the UI layer.
   */
  talkTarget: Vehicle | null;
  setTalkTarget: (vehicle: Vehicle | null) => void;
  /** True while we have an incoming private PTT channel open (we are the listener) */
  hasIncomingPrivate: boolean;
  /** Vehicle ID of the driver currently (or most recently) talking to us privately. null when none. */
  incomingPrivateSenderId: string | null;
  /** Open a private reply channel back to whoever is currently talking to us. */
  replyToPrivate: () => Promise<boolean>;
  /**
   * True while the outbound sender's private Agora channel is in its 30-second
   * idle warm window (after the sender's transmission ends, before the idle timer
   * fires). Receiver warm visibility is handled by `hasIncomingPrivate` staying
   * true until `sendPrivatePttEnd` arrives.
   */
  isPrivateChannelWarm: boolean;
  /** Name of the partner vehicle in the warm private channel. null when no warm channel. */
  privateWarmPartnerName: string | null;
  /** Set of Agora UIDs actively speaking (above volume threshold) */
  remoteSpeakerUids: Set<number>;
  /** Vehicle names currently speaking, derived from Agora UID→vehicle mapping */
  speakingVehicleNames: string[];
  /**
   * True when one or more convoy members are actively speaking on the GROUP
   * channel. Because `onAudioVolumeIndication` is registered on the main
   * engine connection only, this is never triggered by private-channel audio.
   * Used to implement group-overrides-private PTT priority.
   */
  isGroupBroadcastActive: boolean;
  /** True when the convoy leader (not me) is actively speaking on the group channel */
  isLeaderBroadcastActive: boolean;
  /** True when no vehicle in the session has isLeader=true (e.g. leader disconnected) */
  isLeaderVacant: boolean;
  /**
   * Transfer convoy leadership to another vehicle (leader only).
   * Broadcasts a leader_handoff message so all devices update simultaneously.
   */
  transferLeadership: (vehicle: Vehicle) => void;
  /**
   * Claim convoy leadership when the current leader slot is vacant.
   * Any member may call this after the leader disconnects.
   */
  claimLeadership: () => void;
  /** Set of vehicle IDs that are more than gapThresholdM behind the leader */
  gapWarnings: Set<string>;
  /** Current gap warning threshold in metres (persisted per device) */
  gapThresholdM: number;
  /** Update and persist the gap warning threshold */
  setGapThresholdM: (metres: number) => Promise<void>;
  /** Active hazards for the current convoy */
  hazards: Hazard[];
  /** Report a new hazard at the current location */
  reportHazard: (type: HazardType, lat: number, lng: number) => Promise<void>;
  /**
   * True when a proactive voice-token renewal attempt failed.
   * The user should be warned that voice may disconnect soon.
   */
  voiceTokenWarning: boolean;
  /** Dismiss the voice-token warning banner */
  dismissVoiceTokenWarning: () => void;
  /**
   * Current voice auto-reconnect status.
   *  "ok"          — no issue (default)
   *  "reconnecting" — network dropped; Agora (or our manual retry) is trying
   *  "restored"    — channel recovered; auto-clears after 3 s
   *  "failed"      — manual rejoin also failed; shown until convoy session ends
   */
  voiceConnectStatus: "ok" | "reconnecting" | "restored" | "failed";
  /**
   * True after a PTT press was attempted while the app was backgrounded.
   * Auto-clears after 5 s or when dismissed by the driver.
   */
  bgPttWarning: boolean;
  /** Dismiss the backgrounded-PTT warning banner */
  dismissBgPttWarning: () => void;
  /** Currently active shared regroup pin (null when none) */
  regroupPin: RegroupPin | null;
  /** Broadcast a regroup pin to all convoy members */
  broadcastRegroupPin: (pin: Omit<RegroupPin, "pinId">) => void;
  /** Clear the regroup pin for all convoy members */
  clearRegroupPin: () => void;
  /** Incoming stop request from another convoy member (null when none pending) */
  pendingStopRequest: WsStopRequestMessage | null;
  /** Accept or decline an incoming stop request; navigates to the station on accept */
  respondToStopRequest: (requestId: string, accepted: boolean) => void;
  /** Dismiss the stop request modal without responding */
  dismissStopRequest: () => void;
  /** Response counts for a stop request sent by this driver */
  stopRequestResponses: { accepts: number; declines: number } | null;
  /**
   * Send a stop request to all convoy members with the proposed station.
   * Only the initiating device calls this after AI picks the best station.
   */
  sendConvoyStopRequest: (
    stopType: WsStopRequestMessage["stopType"],
    station: StopStation
  ) => void;
  /** Incoming stop proposal from another convoy member (null when none pending) */
  pendingStopProposal: WsStopProposalMessage | null;
  /** Broadcast a location-based stop suggestion to all convoy members */
  sendStopProposal: (name: string, location: { latitude: number; longitude: number }) => void;
  /** Accept or decline an incoming stop proposal; navigates via the stop on accept */
  respondToStopProposal: (proposalId: string, accepted: boolean) => Promise<void>;
  /** Dismiss the stop proposal banner without responding */
  dismissStopProposal: () => void;
  /** Response counts for a stop proposal sent by this driver */
  stopProposalResponses: { accepts: number; declines: number } | null;
  /**
   * Per-vehicle distance + ETA to the active regroup pin.
   * Populated from `regroup_eta` WS messages; keyed by vehicleId.
   * Empty map when no regroup pin is active.
   */
  vehicleRegroupEtas: Map<string, { distanceM: number; etaS: number }>;
  /**
   * True when all convoy vehicles (≥2) are within 50 m of the centroid.
   * Triggers the proximity sync overhead view.
   */
  isInSyncZone: boolean;
  /** Geographic centroid of all convoy vehicles (null when <2 vehicles) */
  convoycentroid: { latitude: number; longitude: number } | null;
  /**
   * Full teardown of any active or incoming private PTT session.
   * Call when sync zone exits to ensure both transmit and listen states are cleaned up.
   */
  clearSyncPTT: () => void;
}

const ConvoyContext = createContext<ConvoyContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAR_COLORS = [
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#22c55e",
];

const VEHICLE_EMOJIS = ["🚗", "🚙", "🚕", "🏎️", "🚐", "🛻"];

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const STORAGE_KEY = "@convoy_session";

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ConvoyProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ConvoySession | null>(null);
  const [myVehicle, setMyVehicle] = useState<Vehicle | null>(null);
  const [mergeState, setMergeState] = useState<MergeState | null>(null);
  const [isTalking, setIsTalking] = useState(false);
  const [talkTarget, setTalkTargetState] = useState<Vehicle | null>(null);
  const [hasIncomingPrivate, setHasIncomingPrivate] = useState(false);
  const [incomingPrivateSenderId, setIncomingPrivateSenderId] = useState<string | null>(null);
  const [isPrivateChannelWarm, setIsPrivateChannelWarm] = useState(false);
  const [privateWarmPartnerName, setPrivateWarmPartnerName] = useState<string | null>(null);
  const incomingPrivateSenderIdRef = useRef<string | null>(null);
  const [remoteSpeakerUids, setRemoteSpeakerUids] = useState<Set<number>>(new Set());
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [voiceTokenWarning, setVoiceTokenWarning] = useState(false);
  const [voiceConnectStatus, setVoiceConnectStatus] = useState<"ok" | "reconnecting" | "restored" | "failed">("ok");
  const voiceRestoredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceTokenWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True when a PTT attempt was made while the app was backgrounded */
  const [bgPttWarning, setBgPttWarning] = useState(false);
  const bgPttWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set to true when PTT is pressed while app is in background; consumed on next foreground event */
  const missedPttWhileBgRef = useRef(false);
  const [pendingStopRequest, setPendingStopRequest] = useState<WsStopRequestMessage | null>(null);
  const [stopRequestResponses, setStopRequestResponses] = useState<{ accepts: number; declines: number } | null>(null);
  const [pendingStopProposal, setPendingStopProposal] = useState<WsStopProposalMessage | null>(null);
  const pendingStopProposalRef = useRef<WsStopProposalMessage | null>(null);
  const [stopProposalResponses, setStopProposalResponses] = useState<{ accepts: number; declines: number } | null>(null);
  const activeProposalIdRef = useRef<string | null>(null);
  // Stores the full payload of the proposal *we* sent (separate from
  // pendingStopProposalRef which only holds incoming proposals from others).
  const activeProposalDataRef = useRef<{ name: string; location: { latitude: number; longitude: number } } | null>(null);
  // Per-proposal vote tracking — populated by EVERY client (proposer + receivers)
  // so deterministic majority logic can run on each device independently.
  const proposalTrackingRef = useRef<Map<string, {
    name: string;
    location: { latitude: number; longitude: number };
    voterIds: Set<string>;
    accepts: number;
    declines: number;
    rerouted: boolean;
  }>>(new Map());
  const [gapThresholdM, setGapThresholdMState] = useState<number>(GAP_THRESHOLD_M);
  const [regroupPin, setRegroupPin] = useState<RegroupPin | null>(null);
  const regroupPinRef = useRef<RegroupPin | null>(null);
  const [vehicleRegroupEtas, setVehicleRegroupEtas] = useState<Map<string, { distanceM: number; etaS: number }>>(new Map());
  const didStartTransmittingRef = useRef(false);
  const talkTargetRef = useRef<Vehicle | null>(null);

  const setTalkTarget = useCallback((vehicle: Vehicle | null) => {
    talkTargetRef.current = vehicle;
    setTalkTargetState(vehicle);
  }, []);

  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const talkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Cleanup fn for the Web Audio silence detector (non-Agora / web path only). */
  const webSilenceCleanupRef = useRef<(() => void) | null>(null);
  /** 30-second idle timer that tears down the private channel after silence. */
  const privateIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Info needed by the idle-timer callback; avoids stale closures. */
  const privateWarmInfoRef = useRef<{
    myId: string;
    partnerId: string;
    chName: string;
  } | null>(null);
  const sessionRef = useRef<ConvoySession | null>(null);
  const wsClientRef = useRef(getConvoyWsClient());

  /** Maps Agora UID → vehicle name for remote speakers */
  const agoraUidToVehicleRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const STALE_REMOVE_MS = 30_000;

  useEffect(() => {
    const timer = setInterval(() => {
      setSession((prev) => {
        if (!prev) return prev;
        const now = Date.now();
        const filtered = prev.vehicles.filter(
          (v) => v.isMe || now - v.lastSeen <= STALE_REMOVE_MS
        );
        if (filtered.length === prev.vehicles.length) return prev;
        return { ...prev, vehicles: filtered };
      });
    }, 5_000);
    return () => clearInterval(timer);
  }, []);

  // Load persisted gap threshold on mount — validate against allowed options
  useEffect(() => {
    AsyncStorage.getItem(GAP_THRESHOLD_STORAGE_KEY).then((raw) => {
      if (!raw) return;
      const parsed = parseInt(raw, 10);
      if ((ALLOWED_GAP_VALUES as readonly number[]).includes(parsed)) {
        setGapThresholdMState(parsed);
      }
    });
  }, []);

  const setGapThresholdM = useCallback(async (metres: number) => {
    setGapThresholdMState(metres);
    await AsyncStorage.setItem(GAP_THRESHOLD_STORAGE_KEY, String(metres));
  }, []);

  // Keep ref in sync so WS callbacks can read the latest pin without stale closure
  useEffect(() => {
    regroupPinRef.current = regroupPin;
  }, [regroupPin]);

  const broadcastRegroupPin = useCallback((pin: Omit<RegroupPin, "pinId">) => {
    const pinId = Date.now().toString();
    const full: RegroupPin = { pinId, ...pin };
    setRegroupPin(full);
    regroupPinRef.current = full;
    const myId = sessionRef.current?.vehicles.find((v) => v.isMe)?.id ?? "";
    wsClientRef.current.sendRegroupPin({
      pinId,
      fromVehicleId: myId,
      fromVehicleName: pin.fromVehicleName,
      lat: pin.lat,
      lng: pin.lng,
      name: pin.name,
    });
  }, []);

  const clearRegroupPin = useCallback(() => {
    const pin = regroupPinRef.current;
    if (!pin) return;
    // Only the convoy leader may dismiss the pin for everyone
    const amLeader = sessionRef.current?.vehicles.find((v) => v.isMe)?.isLeader ?? false;
    if (!amLeader) return;
    const pinIdToRemove = pin.pinId;
    setRegroupPin(null);
    regroupPinRef.current = null;
    setVehicleRegroupEtas(new Map());
    wsClientRef.current.sendRegroupPinClear(pinIdToRemove);
  }, []);

  // Fetch hazards for the given convoy code merged with global hazards
  const fetchAllHazards = async (convoyCode?: string): Promise<Hazard[]> => {
    const [globalHazards, convoyHazards] = await Promise.all([
      fetchHazards("GLOBAL"),
      convoyCode ? fetchHazards(convoyCode) : Promise.resolve([]),
    ]);
    const seen = new Set<string>();
    const merged: Hazard[] = [];
    for (const h of [...globalHazards, ...convoyHazards]) {
      if (!seen.has(h.id)) {
        seen.add(h.id);
        merged.push(h);
      }
    }
    return merged;
  };

  // Refresh hazards from the server every 60 seconds (prunes expired, picks up new)
  useEffect(() => {
    const timer = setInterval(() => {
      const code = sessionRef.current?.code;
      fetchAllHazards(code ?? undefined).then((fresh) => {
        setHazards(fresh);
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Fetch global hazards immediately on mount so drivers see them without waiting
  // for the first 60-second poll interval tick
  useEffect(() => {
    fetchAllHazards(undefined).then((fresh) => {
      setHazards(fresh);
    });
  }, []);

  useEffect(() => {
    loadSession();

    if (isAgoraAvailable()) {
      setTokenRenewalErrorHandler(() => {
        setVoiceTokenWarning(true);
        if (voiceTokenWarningTimerRef.current) clearTimeout(voiceTokenWarningTimerRef.current);
        voiceTokenWarningTimerRef.current = setTimeout(() => {
          voiceTokenWarningTimerRef.current = null;
          setVoiceTokenWarning(false);
        }, 4000);
      });
      setConnectionStatusCallback((status: "reconnecting" | "connected" | "failed") => {
        if (status === "reconnecting") {
          setVoiceConnectStatus("reconnecting");
        } else if (status === "connected") {
          // Clear any pending "restored" auto-dismiss before setting new one
          if (voiceRestoredTimerRef.current) {
            clearTimeout(voiceRestoredTimerRef.current);
          }
          setVoiceConnectStatus("restored");
          voiceRestoredTimerRef.current = setTimeout(() => {
            voiceRestoredTimerRef.current = null;
            setVoiceConnectStatus("ok");
          }, 3000);
        } else if (status === "failed") {
          setVoiceConnectStatus("failed");
          if (voiceRestoredTimerRef.current) clearTimeout(voiceRestoredTimerRef.current);
          voiceRestoredTimerRef.current = setTimeout(() => {
            voiceRestoredTimerRef.current = null;
            setVoiceConnectStatus("ok");
          }, 5000);
        }
      });
      initAgora({
        onSpeakersChanged: (speakingUids) => {
          setRemoteSpeakerUids(speakingUids);
        },
        onLocalVolume: (volume) => {
          // VAD auto-stop: if mic is open and silence detected for 2 s, end transmission
          if (!didStartTransmittingRef.current) return;
          const SILENCE_THRESHOLD = 8;
          const SILENCE_DELAY_MS = 2000;
          if (volume <= SILENCE_THRESHOLD) {
            if (!silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                silenceTimerRef.current = null;
                if (didStartTransmittingRef.current) {
                  stopTalking();
                }
              }, SILENCE_DELAY_MS);
            }
          } else {
            // Speaking detected — cancel any pending silence timer
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          }
        },
        onRemoteUserJoined: (uid) => {
          const currentSession = sessionRef.current;
          if (!currentSession) return;
          if (agoraUidToVehicleRef.current.has(uid)) return;
          const vehicle = currentSession.vehicles.find(
            (v) => !v.isMe && vehicleIdToAgoraUid(v.id) === uid
          );
          if (vehicle) {
            agoraUidToVehicleRef.current.set(uid, vehicle.name);
          }
        },
        onRemoteUserLeft: (uid) => {
          setRemoteSpeakerUids((prev) => {
            const next = new Set(prev);
            next.delete(uid);
            return next;
          });
        },
        onError: (code, msg) => {
          console.warn(`[Agora] error ${code}: ${msg}`);
        },
      });
    }

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (!isAgoraAvailable()) return;
      const currentSession = sessionRef.current;
      if (!currentSession?.isActive) return;

      if (nextState === "background" || nextState === "inactive") {
        // Cancel any active PTT transmission when the app goes to the background.
        // With tap-to-toggle mode the mic could stay open indefinitely; cut it off
        // automatically so the driver is never hot-mic'd without knowing.
        // stopTalking() handles group AND private teardown (signaling + channel leave).
        if (didStartTransmittingRef.current) {
          stopTalking();
        }
        // Re-apply the convoy audio session to ensure staysActiveInBackground=true
        // and allowsRecordingIOS=false, even if the user was mid-transmit when
        // they backgrounded the app (startTalking sets allowsRecordingIOS=true).
        // The Agora channel intentionally stays connected so incoming audio
        // continues to play while the app is in the background.
        configureAudioSessionForConvoy().catch(() => {});
      } else if (nextState === "active") {
        // If a PTT press was attempted while backgrounded, surface a warning now
        // that the app is visible again so the driver knows the transmission was
        // silently dropped.
        if (missedPttWhileBgRef.current) {
          missedPttWhileBgRef.current = false;
          // If the banner is already visible (timer already running) do NOT
          // reset the countdown — a second background press should not extend
          // or re-trigger the 5-second auto-dismiss timer. This prevents rapid
          // multi-press events from making the banner feel "stuck" and avoids
          // the confusing UX of a second foreground cycle restarting the timer
          // when the first banner is still visible.
          if (!bgPttWarningTimerRef.current) {
            setBgPttWarning(true);
            bgPttWarningTimerRef.current = setTimeout(() => {
              bgPttWarningTimerRef.current = null;
              setBgPttWarning(false);
            }, 5000);
          }
        }

        // If the channel dropped while in the background (e.g. token expired
        // or OS reclaimed resources), attempt to rejoin and re-configure the
        // audio session.
        if (!getCurrentChannel()) {
          const me = currentSession.vehicles.find((v) => v.isMe);
          if (me) {
            joinChannel(currentSession.code, me.id)
              .then(() => {
                muteLocalAudio();
                return configureAudioSessionForConvoy();
              })
              .catch((e: unknown) => {
                console.warn("[PTT] Failed to rejoin channel on foreground:", e);
              });
          }
        }
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      if (privateIdleTimerRef.current) {
        clearTimeout(privateIdleTimerRef.current);
        privateIdleTimerRef.current = null;
      }
      // Clear the reconnect-status callback so a destroyed provider cannot
      // schedule state updates after unmount.
      if (isAgoraAvailable()) {
        setConnectionStatusCallback(null);
      }
      destroyAgora();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only effect; loadSession and stopTalking are only needed once on init
  }, []);

  const connectWs = useCallback((code: string, me: Vehicle) => {
    wsClientRef.current.connect(code, {
      onOpen: () => {
        // Send join once the socket is actually open — calling it before onOpen
        // fires means ws.readyState !== OPEN and the message is silently dropped.
        wsClientRef.current.sendJoin(me.id, me.name, me.emoji, me.color, me.isLeader);
      },
      onJoin: (msg) => {
        // Another member joined the room — the server broadcasts this immediately
        // on join so existing members don't have to wait for the first location update.
        setSession((prev) => {
          if (!prev) return prev;
          if (prev.vehicles.some((v) => v.id === msg.vehicleId)) return prev;
          const newVehicle: Vehicle = {
            id: msg.vehicleId,
            name: msg.name,
            emoji: msg.emoji,
            color: msg.color,
            isLeader: msg.isLeader,
            isMe: false,
            location: { latitude: 0, longitude: 0 },
            lastSeen: Date.now(),
          };
          return { ...prev, vehicles: [...prev.vehicles, newVehicle] };
        });
      },
      onPrivatePtt: async (msg: WsPrivatePttMessage) => {
        // Only the targeted vehicle should respond
        if (msg.targetVehicleId !== me.id) return;
        if (!isAgoraAvailable()) return;
        // Cancel any warm-channel idle timer — channel is being reused
        if (privateIdleTimerRef.current) {
          clearTimeout(privateIdleTimerRef.current);
          privateIdleTimerRef.current = null;
        }
        privateWarmInfoRef.current = null;
        setIsPrivateChannelWarm(false);
        setPrivateWarmPartnerName(null);
        // Join the private channel so we hear the sender (no-op if already joined on same channel)
        try {
          await joinPrivateChannel(msg.channelName, me.id);
          incomingPrivateSenderIdRef.current = msg.fromVehicleId;
          setIncomingPrivateSenderId(msg.fromVehicleId);
          setHasIncomingPrivate(true);
          // Store sender name so the warm pill can show "X · channel open" even
          // when they are not actively speaking (speakingVehicleNames is empty).
          const senderVehicle = sessionRef.current?.vehicles.find(
            (v) => v.id === msg.fromVehicleId
          );
          setPrivateWarmPartnerName(senderVehicle?.name ?? null);
        } catch (e) {
          console.warn("[PTT] Failed to join private channel as receiver:", e);
        }
      },
      onPrivatePttEnd: (msg: WsPrivatePttEndMessage) => {
        // Only the targeted vehicle should respond
        if (msg.targetVehicleId !== me.id) return;
        if (!isAgoraAvailable()) return;
        // Validate channel identity: with deferred end-signaling, a late or
        // stale end message could arrive after the driver switched to a different
        // private partner. Ignore it if it doesn't match our current channel.
        const currentCh = getCurrentPrivateChannel();
        if (currentCh && currentCh !== msg.channelName) return;
        // Only tear down if we're not currently the one speaking back (sender role).
        // The sender is authoritative: it already held the channel for PRIVATE_IDLE_MS
        // before sending this signal, so the receiver tears down immediately here.
        if (!talkTargetRef.current) {
          // Cancel any receiver-side idle timer that may have been set from a
          // prior role-swap (edge case: both sides had warm timers running).
          if (privateIdleTimerRef.current) {
            clearTimeout(privateIdleTimerRef.current);
            privateIdleTimerRef.current = null;
          }
          privateWarmInfoRef.current = null;
          leavePrivateChannel();
          setIsPrivateChannelWarm(false);
          setPrivateWarmPartnerName(null);
          setHasIncomingPrivate(false);
          incomingPrivateSenderIdRef.current = null;
          setIncomingPrivateSenderId(null);
          configureAudioSessionForConvoy().catch(() => {});
        }
      },
      onLocation: (msg: WsLocationMessage) => {
        setSession((prev) => {
          if (!prev) return prev;
          const exists = prev.vehicles.some((v) => v.id === msg.vehicleId);
          let vehicles: Vehicle[];
          if (exists) {
            vehicles = prev.vehicles.map((v) => {
              if (v.id !== msg.vehicleId) return v;
              return {
                ...v,
                name: msg.name,
                emoji: msg.emoji,
                color: msg.color,
                isLeader: msg.isLeader,
                location: {
                  latitude: msg.lat,
                  longitude: msg.lng,
                  heading: msg.heading,
                  speed: msg.speed,
                },
                lastSeen: msg.ts,
              };
            });
          } else {
            const newVehicle: Vehicle = {
              id: msg.vehicleId,
              name: msg.name,
              emoji: msg.emoji,
              color: msg.color,
              isLeader: msg.isLeader,
              isMe: false,
              location: {
                latitude: msg.lat,
                longitude: msg.lng,
                heading: msg.heading,
                speed: msg.speed,
              },
              lastSeen: msg.ts,
            };
            vehicles = [...prev.vehicles, newVehicle];
            agoraUidToVehicleRef.current.set(vehicleIdToAgoraUid(msg.vehicleId), msg.name);
          }
          return { ...prev, vehicles };
        });
      },
      onLeave: (vehicleId: string) => {
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            vehicles: prev.vehicles.filter((v) => v.id !== vehicleId),
          };
        });
        // If the departing vehicle is our current private channel partner,
        // tear down the warm/active private channel immediately rather than
        // waiting for the idle timer (which may never fire if they disconnected).
        const warmInfo = privateWarmInfoRef.current;
        const isWarmPartner = warmInfo?.partnerId === vehicleId;
        const isIncomingPartner = incomingPrivateSenderIdRef.current === vehicleId;
        const isTalkPartner = talkTargetRef.current?.id === vehicleId;
        if (isWarmPartner || isIncomingPartner || isTalkPartner) {
          if (privateIdleTimerRef.current) {
            clearTimeout(privateIdleTimerRef.current);
            privateIdleTimerRef.current = null;
          }
          privateWarmInfoRef.current = null;
          if (isAgoraAvailable()) {
            mutePrivateAudio();
            leavePrivateChannel();
            configureAudioSessionForConvoy().catch(() => {});
          }
          setIsPrivateChannelWarm(false);
          setPrivateWarmPartnerName(null);
          setHasIncomingPrivate(false);
          incomingPrivateSenderIdRef.current = null;
          setIncomingPrivateSenderId(null);
          if (isTalkPartner) {
            talkTargetRef.current = null;
            setTalkTargetState(null);
            setIsTalking(false);
          }
        }
      },
      onHazard: (hazard: Hazard) => {
        const now = new Date();
        if (new Date(hazard.expiresAt) <= now) return;
        setHazards((prev) => {
          if (prev.some((h) => h.id === hazard.id)) return prev;
          announceHazard(hazard.type);
          return [...prev, hazard];
        });
      },
      onStopRequest: (msg: WsStopRequestMessage) => {
        // Don't show to the driver who initiated the request
        if (msg.fromVehicleId === me.id) return;
        setPendingStopRequest(msg);
        announceStopRequest(msg.fromVehicleName, msg.stopType, msg.station.name);
      },
      onStopResponse: (msg: WsStopResponseMessage) => {
        // Aggregate responses for the requesting driver
        if (msg.fromVehicleId === me.id) return;
        setStopRequestResponses((prev) => {
          const base = prev ?? { accepts: 0, declines: 0 };
          return msg.accepted
            ? { ...base, accepts: base.accepts + 1 }
            : { ...base, declines: base.declines + 1 };
        });
      },
      onRegroupPin: (msg: WsRegroupPinMessage) => {
        const pin: RegroupPin = {
          pinId: msg.pinId,
          fromVehicleName: msg.fromVehicleName,
          lat: msg.lat,
          lng: msg.lng,
          name: msg.name,
        };
        setRegroupPin(pin);
        regroupPinRef.current = pin;
        // Reset ETA data whenever a new (or replaced) pin arrives
        setVehicleRegroupEtas(new Map());
      },
      onRegroupPinClear: (msg) => {
        // Only clear if the incoming message matches the currently active pin
        if (regroupPinRef.current?.pinId !== msg.pinId) return;
        setRegroupPin(null);
        regroupPinRef.current = null;
        setVehicleRegroupEtas(new Map());
      },
      onRegroupEta: (msg: WsRegroupEtaMessage) => {
        // Ignore stale ETA updates that belong to a different pin
        if (regroupPinRef.current?.pinId !== msg.pinId) return;
        setVehicleRegroupEtas((prev) => {
          const next = new Map(prev);
          next.set(msg.vehicleId, { distanceM: msg.distanceM, etaS: msg.etaS });
          return next;
        });
      },
      onStopProposal: (msg: WsStopProposalMessage) => {
        // Ignore our own proposals (we're the proposer)
        const myId = sessionRef.current?.vehicles.find((v) => v.isMe)?.id;
        if (msg.proposedByVehicleId === myId) return;
        pendingStopProposalRef.current = msg;
        setPendingStopProposal(msg);
        announceStopProposal(msg.proposedBy, msg.name);
        // Register in shared tracking so majority logic can run on this device too
        proposalTrackingRef.current.set(msg.proposalId, {
          name: msg.name,
          location: msg.location,
          voterIds: new Set(),
          accepts: 0,
          declines: 0,
          rerouted: false,
        });
      },
      onStopProposalResponse: (msg: WsStopProposalResponseMessage) => {
        const tracking = proposalTrackingRef.current.get(msg.proposalId);
        if (!tracking) return; // unknown proposal — ignore

        // Deduplicate: each vehicle may only vote once
        if (tracking.voterIds.has(msg.fromVehicleId)) return;
        tracking.voterIds.add(msg.fromVehicleId);
        if (msg.accepted) tracking.accepts++;
        else tracking.declines++;

        // Update display tally only on the proposer's device
        if (activeProposalIdRef.current === msg.proposalId) {
          setStopProposalResponses({ accepts: tracking.accepts, declines: tracking.declines });
        }

        // Strict majority: more than half of other convoy members
        const totalVehicles = sessionRef.current?.vehicles.length ?? 1;
        const otherCount = Math.max(totalVehicles - 1, 0);
        const threshold = Math.floor(otherCount / 2) + 1;
        if (
          msg.accepted &&
          tracking.accepts >= threshold &&
          threshold > 0 &&
          !tracking.rerouted &&
          startNavigationRef.current
        ) {
          // One-shot guard — prevents repeated reroutes on additional accepts.
          // Also prune this entry from the map so long sessions don't accumulate
          // stale tracking data.
          tracking.rerouted = true;
          setTimeout(() => proposalTrackingRef.current.delete(msg.proposalId), 0);

          // Only the convoy leader auto-reroutes when majority accepts.
          // Followers update their own route only when they personally tap Accept.
          const myVeh = sessionRef.current?.vehicles.find((v) => v.isMe);
          if (!myVeh?.isLeader) return;

          const myLoc = myVeh.location;
          const nav = sessionRef.current?.navigation;
          if (nav) {
            // Already navigating: insert stop as waypoint, preserve destination
            fetchRouteViaStop(
              myLoc.latitude, myLoc.longitude,
              tracking.location.latitude, tracking.location.longitude,
              nav.destination.latitude, nav.destination.longitude
            ).then((result) => {
              if (result && startNavigationRef.current) {
                startNavigationRef.current({
                  destination: nav.destination,
                  route: result.route,
                  steps: result.steps,
                  currentStepIndex: 0,
                  totalDistanceM: result.totalDistanceM,
                  totalDurationS: result.totalDurationS,
                  totalDurationInTrafficS: result.totalDurationInTrafficS,
                });
                if (result.steps.length > 0) {
                  announceNavStep(result.steps[0].instruction, result.steps[0].distanceM);
                }
              }
            });
          } else {
            // Not navigating yet: route directly to the stop
            fetchRoute(
              myLoc.latitude, myLoc.longitude,
              tracking.location.latitude, tracking.location.longitude
            ).then((result) => {
              if (result && startNavigationRef.current) {
                startNavigationRef.current({
                  destination: { name: tracking.name, latitude: tracking.location.latitude, longitude: tracking.location.longitude },
                  route: result.route,
                  steps: result.steps,
                  currentStepIndex: 0,
                  totalDistanceM: result.totalDistanceM,
                  totalDurationS: result.totalDurationS,
                  totalDurationInTrafficS: result.totalDurationInTrafficS,
                });
                if (result.steps.length > 0) {
                  announceNavStep(result.steps[0].instruction, result.steps[0].distanceM);
                }
              }
            });
          }
        }
      },
      onLeaderHandoff: (msg: WsLeaderHandoffMessage) => {
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            vehicles: prev.vehicles.map((v) => ({
              ...v,
              isLeader: v.id === msg.toVehicleId,
            })),
          };
        });
        setMyVehicle((prev) => {
          if (!prev) return prev;
          return { ...prev, isLeader: prev.id === msg.toVehicleId };
        });
      },
      onNavStart: async (msg: WsNavStartMessage) => {
        // Ignore our own broadcast (server relay echoes back to sender)
        const myId = sessionRef.current?.vehicles.find((v) => v.isMe)?.id;
        if (msg.fromVehicleId === myId) return;

        // Follower: fetch a route from current position to the destination
        const myVeh = sessionRef.current?.vehicles.find((v) => v.isMe);
        if (!myVeh) return;

        const result = await fetchRoute(
          myVeh.location.latitude,
          myVeh.location.longitude,
          msg.destination.latitude,
          msg.destination.longitude,
        );
        if (!result) return;

        const nav: NavigationState = {
          destination: msg.destination,
          route: result.route,
          steps: result.steps,
          currentStepIndex: 0,
          totalDistanceM: result.totalDistanceM,
          totalDurationS: result.totalDurationS,
          totalDurationInTrafficS: result.totalDurationInTrafficS,
          navSource: "leader",
        };
        startNavigationRef.current?.(nav);
        if (result.steps.length > 0) {
          announceNavStep(result.steps[0].instruction, result.steps[0].distanceM);
        }
      },
      onNavStep: (msg: WsNavStepMessage) => {
        const myId = sessionRef.current?.vehicles.find((v) => v.isMe)?.id;
        if (msg.fromVehicleId === myId) return;
        advanceNavStepRef.current?.(msg.stepIndex);
      },
      onNavClear: (msg: WsNavClearMessage) => {
        const myId = sessionRef.current?.vehicles.find((v) => v.isMe)?.id;
        if (msg.fromVehicleId === myId) return;
        clearNavigationRef.current?.();
      },
    });
  }, []);

  const loadSession = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        // Guard against the JSC "Property storage exceeds 196607 properties"
        // crash: if the persisted blob is unreasonably large (> 1 MB) it
        // contains a bloated navigation polyline or unbounded messages array
        // from an older app version.  Clear it so the app recovers cleanly
        // instead of crashing on JSON.parse.
        if (stored.length > 1_000_000) {
          await AsyncStorage.removeItem(STORAGE_KEY);
          return;
        }
        const data = JSON.parse(stored) as ConvoySession;
        if (data.isActive) {
          const me = data.vehicles.find((v) => v.isMe);
          const onlyMe = me ? [me] : data.vehicles;
          const restored = { ...data, vehicles: onlyMe };
          agoraUidToVehicleRef.current.clear();
          setSession(restored);
          if (me) {
            setMyVehicle(me);
            connectWs(data.code, me);
          }
          if (isAgoraAvailable() && me) {
            await joinChannel(data.code, me.id);
            await configureAudioSessionForConvoy();
          }
          const loadedHazards = await fetchAllHazards(data.code);
          setHazards(loadedHazards);
        }
      }
    } catch {}
  };

  const saveSession = async (s: ConvoySession | null) => {
    try {
      if (s) {
        // Strip navigation state (route + steps are large polyline arrays that
        // can contain thousands of coordinate objects — storing them in
        // AsyncStorage can cause JSC to exceed its ~196 k property limit on
        // parse/stringify).  Navigation is re-synced from the leader via
        // WebSocket when the user reconnects, so we don't need to persist it.
        //
        // Also cap messages to the last 100 entries so the chat history cannot
        // grow without bound across long sessions.
        const toSave: ConvoySession = {
          ...s,
          navigation: undefined,
          messages: s.messages.slice(-100),
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  };

  const createConvoy = useCallback(
    async (name: string, vehicleName: string) => {
      const myId = generateId();
      const me: Vehicle = {
        id: myId,
        name: vehicleName,
        emoji: VEHICLE_EMOJIS[0],
        isLeader: true,
        isMe: true,
        location: { latitude: 37.7749, longitude: -122.4194, heading: 0, speed: 0 },
        lastSeen: Date.now(),
        color: CAR_COLORS[0],
      };

      const newSession: ConvoySession = {
        id: generateId(),
        name,
        code: generateCode(),
        vehicles: [me],
        messages: [
          {
            id: generateId(),
            vehicleId: "system",
            vehicleName: "Convoy",
            type: "system",
            content: `Convoy "${name}" created! Share the code with your family.`,
            timestamp: Date.now(),
          },
        ],
        isActive: true,
        createdAt: Date.now(),
      };

      agoraUidToVehicleRef.current.clear();
      setSession(newSession);
      setMyVehicle(me);
      setHazards([]);
      await saveSession(newSession);
      connectWs(newSession.code, me);

      if (isAgoraAvailable()) {
        await joinChannel(newSession.code, myId);
        await configureAudioSessionForConvoy();
      }
    },
    [connectWs]
  );

  const joinConvoy = useCallback(async (code: string, vehicleName: string): Promise<boolean> => {
    if (code.length < 4) return false;

    const myId = generateId();
    const colorIndex = 3;
    const me: Vehicle = {
      id: myId,
      name: vehicleName,
      emoji: VEHICLE_EMOJIS[3],
      isLeader: false,
      isMe: true,
      location: { latitude: 37.7749, longitude: -122.4194, heading: 0, speed: 0 },
      lastSeen: Date.now(),
      color: CAR_COLORS[colorIndex],
    };

    const joinedSession: ConvoySession = {
      id: generateId(),
      name: "Family Convoy",
      code,
      vehicles: [me],
      messages: [
        {
          id: generateId(),
          vehicleId: "system",
          vehicleName: "Convoy",
          type: "system",
          content: `${vehicleName} joined the convoy!`,
          timestamp: Date.now(),
        },
      ],
      isActive: true,
      createdAt: Date.now(),
    };

    agoraUidToVehicleRef.current.clear();
    setSession(joinedSession);
    setMyVehicle(me);
    await saveSession(joinedSession);
    connectWs(code, me);

    if (isAgoraAvailable()) {
      await joinChannel(code, myId);
      await configureAudioSessionForConvoy();
    }

    const loadedHazards = await fetchAllHazards(code);
    setHazards(loadedHazards);

    return true;
  }, [connectWs]);

  const leaveConvoy = useCallback(async () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    // Cancel any warm private-channel idle timer before tearing down Agora
    if (privateIdleTimerRef.current) {
      clearTimeout(privateIdleTimerRef.current);
      privateIdleTimerRef.current = null;
    }
    privateWarmInfoRef.current = null;
    const currentSession = sessionRef.current;
    const me = currentSession?.vehicles.find((v) => v.isMe);
    if (me) {
      wsClientRef.current.sendLeave(me.id);
    }
    wsClientRef.current.disconnect();
    if (isAgoraAvailable()) {
      muteLocalAudio();
      mutePrivateAudio();
      leavePrivateChannel();
      // Cancel any pending voice auto-reconnect before tearing down the channel.
      // leaveChannel() also calls clearReconnectState() internally, but calling it
      // here first ensures cleanup happens even if the channel is temporarily null
      // (i.e. scheduleManualReconnect() cleared it while awaiting rejoin).
      clearReconnectState();
      leaveChannel();
      await resetAudioSession();
    }
    didStartTransmittingRef.current = false;
    agoraUidToVehicleRef.current.clear();
    talkTargetRef.current = null;
    setTalkTargetState(null);
    setHasIncomingPrivate(false);
    setIsPrivateChannelWarm(false);
    setPrivateWarmPartnerName(null);
    incomingPrivateSenderIdRef.current = null;
    setIncomingPrivateSenderId(null);
    setIsTalking(false);
    setRemoteSpeakerUids(new Set());
    setVoiceTokenWarning(false);
    setVoiceConnectStatus("ok");
    if (voiceRestoredTimerRef.current) {
      clearTimeout(voiceRestoredTimerRef.current);
      voiceRestoredTimerRef.current = null;
    }
    setBgPttWarning(false);
    missedPttWhileBgRef.current = false;
    if (bgPttWarningTimerRef.current) {
      clearTimeout(bgPttWarningTimerRef.current);
      bgPttWarningTimerRef.current = null;
    }
    setSession(null);
    setMyVehicle(null);
    setMergeState(null);
    setHazards([]);
    await saveSession(null);
  }, []);

  const updateMyLocation = useCallback(
    (location: Vehicle["location"]) => {
      setMyVehicle((prev) => {
        if (!prev) return prev;
        return { ...prev, location, lastSeen: Date.now() };
      });
      setSession((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          vehicles: prev.vehicles.map((v) =>
            v.isMe ? { ...v, location, lastSeen: Date.now() } : v
          ),
        };
        saveSession(updated);
        return updated;
      });
      const currentSession = sessionRef.current;
      if (currentSession) {
        const me = currentSession.vehicles.find((v) => v.isMe);
        if (me) {
          wsClientRef.current.sendLocation(
            me.id,
            me.name,
            me.emoji,
            me.color,
            me.isLeader,
            location.latitude,
            location.longitude,
            location.heading,
            location.speed,
          );
          // Broadcast regroup ETA when this follower is navigating to the active regroup pin
          const pin = regroupPinRef.current;
          if (pin && currentSession.navigation?.navSource === "regroup") {
            const distanceM = haversineMeters(
              location.latitude,
              location.longitude,
              pin.lat,
              pin.lng,
            );
            const AVG_SPEED_MPS = 11.2;
            const etaS = distanceM / AVG_SPEED_MPS;
            wsClientRef.current.sendRegroupEta(me.id, pin.pinId, distanceM, etaS);
          }
        }
      }
    },
    []
  );

  const sendMessage = useCallback((content: string) => {
    if (!myVehicle) return;
    const msg: ConvoyMessage = {
      id: generateId(),
      vehicleId: myVehicle.id,
      vehicleName: myVehicle.name,
      type: "text",
      content,
      timestamp: Date.now(),
    };
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, messages: [...prev.messages, msg] };
      saveSession(updated);
      return updated;
    });
  }, [myVehicle]);

  const setDestination = useCallback(
    (name: string, lat: number, lng: number) => {
      setSession((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          destination: { name, latitude: lat, longitude: lng },
          messages: [
            ...prev.messages,
            {
              id: generateId(),
              vehicleId: "system",
              vehicleName: "Convoy",
              type: "system" as const,
              content: `Destination set: ${name}`,
              timestamp: Date.now(),
            },
          ],
        };
        saveSession(updated);
        return updated;
      });
    },
    []
  );

  const startNavigationRef = useRef<((nav: NavigationState) => void) | null>(null);
  const advanceNavStepRef = useRef<((index: number) => void) | null>(null);
  const clearNavigationRef = useRef<(() => void) | null>(null);

  const startNavigation = useCallback((nav: NavigationState) => {
    setMergeState(null);
    setSession((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        destination: nav.destination,
        navigation: nav,
        messages: [
          ...prev.messages,
          {
            id: generateId(),
            vehicleId: "system",
            vehicleName: "Convoy",
            type: "system" as const,
            content: `Navigation started → ${nav.destination.name}`,
            timestamp: Date.now(),
          },
        ],
      };
      saveSession(updated);
      return updated;
    });
    // Leader broadcasts nav_start so all followers sync their routes.
    const me = sessionRef.current?.vehicles.find((v) => v.isMe);
    if (me?.isLeader && nav.navSource !== "leader") {
      wsClientRef.current.sendNavStart(me.id, nav.destination);
    }
  }, []);

  // Keep refs in sync so WS callbacks (registered on mount) can call the
  // latest version of each function without stale closure issues.
  useEffect(() => {
    startNavigationRef.current = startNavigation;
  }, [startNavigation]);

  const advanceNavStep = useCallback((index: number) => {
    setSession((prev) => {
      if (!prev?.navigation) return prev;
      const updated = {
        ...prev,
        navigation: { ...prev.navigation, currentStepIndex: index },
      };
      saveSession(updated);
      return updated;
    });
    // Leader broadcasts step advance so all followers stay in sync.
    const me = sessionRef.current?.vehicles.find((v) => v.isMe);
    if (me?.isLeader) {
      wsClientRef.current.sendNavStep(me.id, index);
    }
  }, []);

  useEffect(() => {
    advanceNavStepRef.current = advanceNavStep;
  }, [advanceNavStep]);

  const clearNavigation = useCallback(() => {
    setMergeState(null);
    setSession((prev) => {
      if (!prev) return prev;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { navigation: _navigation, ...rest } = prev;
      const updated = { ...rest } as ConvoySession;
      saveSession(updated);
      return updated;
    });
    // Leader broadcasts nav_clear so all followers stop navigating.
    const me = sessionRef.current?.vehicles.find((v) => v.isMe);
    if (me?.isLeader) {
      wsClientRef.current.sendNavClear(me.id);
    }
  }, []);

  useEffect(() => {
    clearNavigationRef.current = clearNavigation;
  }, [clearNavigation]);

  // ─── Merge routing ──────────────────────────────────────────────────────────

  /**
   * Called once when a follower's navigation starts.  Finds the nearest point
   * on the convoy (leader's) route and fetches a personal route to reach it.
   */
  const computeMerge = useCallback(async (lat: number, lng: number) => {
    const nav = sessionRef.current?.navigation;
    if (!nav || !nav.route.length) return;

    const mp = findMergePoint(lat, lng, nav.route);
    if (!mp) return;

    if (mp.distanceToMergeM < JOIN_THRESHOLD) {
      setMergeState({
        mergePoint: mp.point,
        mergeRouteIndex: mp.index,
        distanceToMergeM: 0,
        personalRoute: [],
        personalSteps: [],
        personalStepIndex: 0,
        onConvoyRoute: true,
      });
      return;
    }

    const personal = await fetchRoute(
      lat,
      lng,
      mp.point.latitude,
      mp.point.longitude
    );
    if (!personal) return;

    setMergeState({
      mergePoint: mp.point,
      mergeRouteIndex: mp.index,
      distanceToMergeM: mp.distanceToMergeM,
      personalRoute: personal.route,
      personalSteps: personal.steps,
      personalStepIndex: 0,
      onConvoyRoute: false,
    });
  }, []);

  /**
   * Called on every GPS tick for followers.  Updates distance-to-merge,
   * auto-advances personal turn steps, and detects route joining.
   */
  const updateMergeProgress = useCallback((lat: number, lng: number) => {
    setMergeState((prev) => {
      if (!prev || prev.onConvoyRoute) return prev;

      const distToMerge = haversineMeters(
        lat, lng,
        prev.mergePoint.latitude,
        prev.mergePoint.longitude
      );

      if (distToMerge < JOIN_THRESHOLD) {
        return { ...prev, distanceToMergeM: 0, onConvoyRoute: true };
      }

      let newStepIdx = prev.personalStepIndex;
      const nextIdx = prev.personalStepIndex + 1;
      if (nextIdx < prev.personalSteps.length) {
        const nextStep = prev.personalSteps[nextIdx];
        const distToNext = haversineMeters(
          lat, lng,
          nextStep.location.latitude,
          nextStep.location.longitude
        );
        if (distToNext < STEP_ADVANCE_THRESHOLD) {
          newStepIdx = nextIdx;
        }
      }

      return { ...prev, distanceToMergeM: distToMerge, personalStepIndex: newStepIdx };
    });
  }, []);

  /** Manual personal-step advance (leader on web can drive this for demo) */
  const advanceMergeStep = useCallback((index: number) => {
    setMergeState((prev) => {
      if (!prev) return prev;
      return { ...prev, personalStepIndex: index };
    });
  }, []);

  // ─── Hazards ──────────────────────────────────────────────────────────────────

  const reportHazard = useCallback(
    async (type: HazardType, lat: number, lng: number) => {
      const name = myVehicle?.name ?? "Anonymous Driver";
      const hazard = await apiReportHazard({ convoyCode: "GLOBAL", type, lat, lng, reportedBy: name });
      if (hazard) {
        setHazards((prev) => {
          if (prev.some((h) => h.id === hazard.id)) return prev;
          return [...prev, hazard];
        });
      }
    },
    [myVehicle],
  );

  const dismissVoiceTokenWarning = useCallback(() => {
    setVoiceTokenWarning(false);
    if (voiceTokenWarningTimerRef.current) {
      clearTimeout(voiceTokenWarningTimerRef.current);
      voiceTokenWarningTimerRef.current = null;
    }
  }, []);

  const dismissBgPttWarning = useCallback(() => {
    setBgPttWarning(false);
    if (bgPttWarningTimerRef.current) {
      clearTimeout(bgPttWarningTimerRef.current);
      bgPttWarningTimerRef.current = null;
    }
  }, []);

  // ─── Stop requests ────────────────────────────────────────────────────────────

  const sendConvoyStopRequest = useCallback(
    (stopType: WsStopRequestMessage["stopType"], station: StopStation) => {
      if (!myVehicle || !sessionRef.current) return;
      const requestId = `${myVehicle.id}-${Date.now()}`;
      setStopRequestResponses({ accepts: 0, declines: 0 });
      wsClientRef.current.sendStopRequest({
        requestId,
        fromVehicleId: myVehicle.id,
        fromVehicleName: myVehicle.name,
        stopType,
        station,
      });
    },
    [myVehicle]
  );

  const respondToStopRequest = useCallback(
    (requestId: string, accepted: boolean) => {
      if (!myVehicle) return;
      wsClientRef.current.sendStopResponse({
        requestId,
        fromVehicleId: myVehicle.id,
        fromVehicleName: myVehicle.name,
        accepted,
      });
      setPendingStopRequest(null);
      // If accepted, caller handles navigation
    },
    [myVehicle]
  );

  const dismissStopRequest = useCallback(() => {
    setPendingStopRequest(null);
  }, []);

  // ─── Stop proposals ──────────────────────────────────────────────────────────

  const sendStopProposal = useCallback(
    (name: string, location: { latitude: number; longitude: number }) => {
      const me = sessionRef.current?.vehicles.find((v) => v.isMe);
      if (!me) return;
      const proposalId = generateId();
      activeProposalIdRef.current = proposalId;
      activeProposalDataRef.current = { name, location };
      // Prune any stale entries (only one active proposal at a time)
      proposalTrackingRef.current.clear();
      // Register in shared tracking so majority logic fires on proposer's device too
      proposalTrackingRef.current.set(proposalId, {
        name,
        location,
        voterIds: new Set(),
        accepts: 0,
        declines: 0,
        rerouted: false,
      });
      setStopProposalResponses({ accepts: 0, declines: 0 });
      wsClientRef.current.sendStopProposal({
        proposalId,
        proposedBy: me.name,
        proposedByVehicleId: me.id,
        location,
        name,
      });
    },
    []
  );

  const respondToStopProposal = useCallback(async (proposalId: string, accepted: boolean) => {
    const proposal = pendingStopProposalRef.current;
    pendingStopProposalRef.current = null;
    setPendingStopProposal(null);

    const me = sessionRef.current?.vehicles.find((v) => v.isMe);
    if (!me) return;

    // Broadcast vote to convoy (WS server will NOT echo back to sender,
    // so we count our own vote locally below).
    wsClientRef.current.sendStopProposalResponse({
      proposalId,
      fromVehicleId: me.id,
      fromVehicleName: me.name,
      accepted,
    });

    // Count own vote locally in shared tracking
    const tracking = proposalTrackingRef.current.get(proposalId);
    if (tracking && !tracking.voterIds.has(me.id)) {
      tracking.voterIds.add(me.id);
      if (accepted) tracking.accepts++;
      else tracking.declines++;
      if (activeProposalIdRef.current === proposalId) {
        setStopProposalResponses({ accepts: tracking.accepts, declines: tracking.declines });
      }
    }

    if (!accepted || !proposal) return;

    const myLoc = me.location;
    const nav = sessionRef.current?.navigation;

    // ── Followers: reroute immediately on accept (opt-in) ──────────────────
    if (!me.isLeader) {
      if (nav) {
        const result = await fetchRouteViaStop(
          myLoc.latitude, myLoc.longitude,
          proposal.location.latitude, proposal.location.longitude,
          nav.destination.latitude, nav.destination.longitude
        );
        if (result) {
          startNavigation({
            destination: nav.destination,
            route: result.route,
            steps: result.steps,
            currentStepIndex: 0,
            totalDistanceM: result.totalDistanceM,
            totalDurationS: result.totalDurationS,
            totalDurationInTrafficS: result.totalDurationInTrafficS,
          });
        }
      } else {
        const result = await fetchRoute(
          myLoc.latitude, myLoc.longitude,
          proposal.location.latitude, proposal.location.longitude
        );
        if (result) {
          startNavigation({
            destination: { name: proposal.name, latitude: proposal.location.latitude, longitude: proposal.location.longitude },
            route: result.route,
            steps: result.steps,
            currentStepIndex: 0,
            totalDistanceM: result.totalDistanceM,
            totalDurationS: result.totalDurationS,
            totalDurationInTrafficS: result.totalDurationInTrafficS,
          });
        }
      }
      return;
    }

    // ── Leader: only reroute when majority threshold crossed ───────────────
    // (Own vote already counted above. onStopProposalResponse handles
    // the case where other members' accepts push count over threshold.)
    if (!tracking || tracking.rerouted) return;
    const totalVehicles = sessionRef.current?.vehicles.length ?? 1;
    const otherCount = Math.max(totalVehicles - 1, 0);
    const threshold = Math.floor(otherCount / 2) + 1;
    if (tracking.accepts >= threshold && threshold > 0) {
      tracking.rerouted = true;
      if (nav) {
        const result = await fetchRouteViaStop(
          myLoc.latitude, myLoc.longitude,
          proposal.location.latitude, proposal.location.longitude,
          nav.destination.latitude, nav.destination.longitude
        );
        if (result) {
          startNavigation({
            destination: nav.destination,
            route: result.route,
            steps: result.steps,
            currentStepIndex: 0,
            totalDistanceM: result.totalDistanceM,
            totalDurationS: result.totalDurationS,
            totalDurationInTrafficS: result.totalDurationInTrafficS,
          });
          if (result.steps.length > 0) {
            announceNavStep(result.steps[0].instruction, result.steps[0].distanceM);
          }
        }
      } else {
        const result = await fetchRoute(
          myLoc.latitude, myLoc.longitude,
          proposal.location.latitude, proposal.location.longitude
        );
        if (result) {
          startNavigation({
            destination: { name: proposal.name, latitude: proposal.location.latitude, longitude: proposal.location.longitude },
            route: result.route,
            steps: result.steps,
            currentStepIndex: 0,
            totalDistanceM: result.totalDistanceM,
            totalDurationS: result.totalDurationS,
            totalDurationInTrafficS: result.totalDurationInTrafficS,
          });
          if (result.steps.length > 0) {
            announceNavStep(result.steps[0].instruction, result.steps[0].distanceM);
          }
        }
      }
    }
  }, [startNavigation]);

  const dismissStopProposal = useCallback(() => {
    const id = pendingStopProposalRef.current?.proposalId;
    pendingStopProposalRef.current = null;
    setPendingStopProposal(null);
    if (id) proposalTrackingRef.current.delete(id);
  }, []);

  // ─── Talk ────────────────────────────────────────────────────────────────────

  const startTalking = useCallback(async (): Promise<boolean> => {
    if (!myVehicle) return false;

    // Bluetooth PTT buttons and external accessories can fire press events even
    // when the app is backgrounded. Reject the attempt so the mic never opens
    // silently, and flag it so the driver is notified on next foreground.
    if (AppState.currentState !== "active") {
      missedPttWhileBgRef.current = true;
      return false;
    }

    if (Platform.OS !== "web") {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        console.warn("[PTT] Microphone permission denied");
        return false;
      }
    }

    const target = talkTargetRef.current;

    if (isAgoraAvailable()) {
      if (!getCurrentChannel()) {
        console.warn("[PTT] Agora channel not joined yet — skipping transmit");
        return false;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        // DuckOthers: Spotify / music lowers while driver transmits, restores after.
        interruptionModeIOS: 2 /* InterruptionModeIOS.DuckOthers */,
        shouldDuckAndroid: true,
        interruptionModeAndroid: 2 /* InterruptionModeAndroid.DuckOthers */,
        playThroughEarpieceAndroid: false,
      });

      if (target) {
        // Private PTT: join the private channel (or reuse the warm channel), signal
        // the target, then unmute. Cancel any pending idle timer first so the
        // channel is not torn down while we are about to speak.
        const currentSession = sessionRef.current;
        if (currentSession) {
          const chName = privateChannelName(currentSession.code, myVehicle.id, target.id);
          // If we are switching to a DIFFERENT partner while a warm hold is active,
          // send sendPrivatePttEnd to the previous partner immediately so they are
          // not stranded waiting for an idle timer that will never fire.
          const prevWarm = privateWarmInfoRef.current;
          if (prevWarm && prevWarm.partnerId !== target.id) {
            wsClientRef.current.sendPrivatePttEnd(prevWarm.myId, prevWarm.partnerId, prevWarm.chName);
          }
          if (privateIdleTimerRef.current) {
            clearTimeout(privateIdleTimerRef.current);
            privateIdleTimerRef.current = null;
          }
          privateWarmInfoRef.current = null;
          setIsPrivateChannelWarm(false);
          setPrivateWarmPartnerName(null);
          // Clear inbound receiver state: once we start sending we are the sender,
          // not the receiver. This hides the Reply button and avoids stale state
          // in role-swap flows (e.g. receiver replies, becoming the new sender).
          incomingPrivateSenderIdRef.current = null;
          setIncomingPrivateSenderId(null);
          setHasIncomingPrivate(false);
          if (getCurrentPrivateChannel() !== chName) {
            await joinPrivateChannel(chName, myVehicle.id);
          }
          // Fail-closed CarPlay guard: only open the mic if the VoiceControl
          // template was successfully presented on the car display. If CarPlay
          // is connected but presentation failed, abort — do not unmute.
          if (isCarPlayConnected() && !ensureCarPlayVoiceTemplate()) return false;
          wsClientRef.current.sendPrivatePtt(myVehicle.id, target.id, chName);
          unmutePrivateAudio();
        }
      } else {
        // Group PTT: transmit on the main channel.
        // Fail-closed CarPlay guard — same requirement applies.
        if (isCarPlayConnected() && !ensureCarPlayVoiceTemplate()) return false;
        unmuteLocalAudio();
      }
    }

    didStartTransmittingRef.current = true;
    setIsTalking(true);
    suppressTts();

    // Non-Agora path (web / simulator): use Web Audio API to detect silence
    // and auto-stop after 2 s of quiet, matching the Agora VAD behaviour.
    if (!isAgoraAvailable() && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      // Clean up any previous detector that may have leaked.
      webSilenceCleanupRef.current?.();
      webSilenceCleanupRef.current = null;
      navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((stream) => {
        const AudioContextCtor: typeof AudioContext =
          window.AudioContext ?? (window as unknown as Record<string, typeof AudioContext>).webkitAudioContext;
        if (!AudioContextCtor) { stream.getTracks().forEach((t) => t.stop()); return; }
        const ctx = new AudioContextCtor();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const SILENCE_THRESHOLD = 10; // 0–255
        const SILENCE_DELAY_MS = 2000;
        let silenceStart: number | null = null;
        const cleanup = () => {
          clearInterval(intervalId);
          stream.getTracks().forEach((t) => t.stop());
          ctx.close().catch(() => {});
          if (webSilenceCleanupRef.current === cleanup) webSilenceCleanupRef.current = null;
        };
        const intervalId = setInterval(() => {
          if (!didStartTransmittingRef.current) { cleanup(); return; }
          analyser.getByteFrequencyData(data);
          let peak = 0;
          for (let i = 0; i < data.length; i++) if (data[i] > peak) peak = data[i];
          if (peak <= SILENCE_THRESHOLD) {
            if (silenceStart === null) silenceStart = Date.now();
            else if (Date.now() - silenceStart >= SILENCE_DELAY_MS) { cleanup(); stopTalking(); }
          } else {
            silenceStart = null;
          }
        }, 100);
        webSilenceCleanupRef.current = cleanup;
      }).catch(() => { /* no mic access — hard timeout is the only safeguard */ });
    }

    // Last-resort hard cut-off: stops any open mic that silence detection missed
    // (e.g. continuous loud background noise, or mic permission denied on web).
    if (talkTimerRef.current) clearTimeout(talkTimerRef.current);
    talkTimerRef.current = setTimeout(() => {
      stopTalking();
    }, 30_000);
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- stopTalking captured via closure; it reads from stable refs internally (talkTargetRef, sessionRef) so stale closure is safe here
  }, [myVehicle]);

  const stopTalking = useCallback(() => {
    const target = talkTargetRef.current;
    const currentSession = sessionRef.current;
    // Always read the current user from the session ref so this function
    // is safe to call from stale closures (e.g. VAD silence timer).
    const me = currentSession?.vehicles.find((v) => v.isMe) ?? null;

    if (isAgoraAvailable()) {
      if (target && currentSession && me) {
        // Private PTT stop: mute the mic immediately but keep the channel joined
        // for PRIVATE_IDLE_MS so the peer can reply without a re-join penalty.
        // The sendPrivatePttEnd signal and leavePrivateChannel are deferred to the
        // idle timer so both sides stay warm for the full conversation window.
        const chName = privateChannelName(currentSession.code, me.id, target.id);
        mutePrivateAudio();
        privateWarmInfoRef.current = { myId: me.id, partnerId: target.id, chName };
        setIsPrivateChannelWarm(true);
        setPrivateWarmPartnerName(target.name);
        if (privateIdleTimerRef.current) clearTimeout(privateIdleTimerRef.current);
        privateIdleTimerRef.current = setTimeout(() => {
          privateIdleTimerRef.current = null;
          const info = privateWarmInfoRef.current;
          if (info) {
            wsClientRef.current.sendPrivatePttEnd(info.myId, info.partnerId, info.chName);
          }
          privateWarmInfoRef.current = null;
          leavePrivateChannel();
          setIsPrivateChannelWarm(false);
          setPrivateWarmPartnerName(null);
          setHasIncomingPrivate(false);
          incomingPrivateSenderIdRef.current = null;
          setIncomingPrivateSenderId(null);
          configureAudioSessionForConvoy().catch(() => {});
        }, PRIVATE_IDLE_MS);
        // Restore the audio session now so group audio (background playback) resumes
        // while the private channel stays joined but silent.
        configureAudioSessionForConvoy().catch(() => {});
      } else {
        // Group PTT stop — or private where target/session/me are unavailable.
        muteLocalAudio();
        // Preserve a warm private channel that is in its idle hold window;
        // it will tear down naturally when its own idle timer fires.
        if (!privateWarmInfoRef.current) {
          mutePrivateAudio();
          leavePrivateChannel();
        }
        configureAudioSessionForConvoy().catch(() => {});
      }
    }

    const wasTransmitting = didStartTransmittingRef.current;
    didStartTransmittingRef.current = false;
    // CarPlay guide: dismiss CPVoiceControlTemplate as soon as recording stops.
    if (isCarPlayConnected()) dismissCarPlayVoiceTemplate();
    setIsTalking(false);
    resumeTts();
    // Always clear the talk target so the next walkie-talkie press
    // routes to group (all cars) rather than a stale private target.
    talkTargetRef.current = null;
    setTalkTargetState(null);
    if (talkTimerRef.current) {
      clearTimeout(talkTimerRef.current);
      talkTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    // Stop the Web Audio silence detector (non-Agora / web path).
    webSilenceCleanupRef.current?.();
    webSilenceCleanupRef.current = null;

    if (!wasTransmitting || !me || !currentSession) return;

    const msg: ConvoyMessage = {
      id: generateId(),
      vehicleId: me.id,
      vehicleName: me.name,
      type: "audio",
      content: isAgoraAvailable() ? "Voice transmission" : "Voice message",
      timestamp: Date.now(),
      targetVehicleName: target?.name,
    };
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, messages: [...prev.messages, msg] };
      saveSession(updated);
      return updated;
    });
  }, []);

  /**
   * Group broadcast priority: when a convoy member speaks on the group channel
   * while this device is actively transmitting a private PTT, automatically
   * stop the private transmission so the driver hears the group broadcast
   * uninterrupted. The private warm-channel idle timer continues running so the
   * conversation can resume once the group speaker finishes.
   */
  useEffect(() => {
    if (remoteSpeakerUids.size === 0) return;
    const currentSession = sessionRef.current;
    const amLeader = currentSession?.vehicles.find((v) => v.isMe)?.isLeader ?? false;

    // Leader broadcast override: stop ALL active transmissions by non-leader members
    // (both group and private) so the leader's voice is heard uninterrupted.
    if (!amLeader && isTalking) {
      const leaderIsSpeaking = currentSession?.vehicles.some(
        (v) => v.isLeader && !v.isMe && remoteSpeakerUids.has(vehicleIdToAgoraUid(v.id))
      ) ?? false;
      if (leaderIsSpeaking) {
        stopTalking();
        return;
      }
    }

    // Group broadcast: stop active private TX so group audio comes through clearly.
    if (isTalking && talkTargetRef.current) {
      stopTalking();
    }
  }, [remoteSpeakerUids, isTalking, stopTalking]);

  const isGroupBroadcastActive = remoteSpeakerUids.size > 0;

  const isLeaderBroadcastActive = React.useMemo(() => {
    if (remoteSpeakerUids.size === 0 || !session) return false;
    return session.vehicles.some(
      (v) => v.isLeader && !v.isMe && remoteSpeakerUids.has(vehicleIdToAgoraUid(v.id))
    );
  }, [remoteSpeakerUids, session]);

  const isLeaderVacant = React.useMemo(() => {
    if (!session) return false;
    return !session.vehicles.some((v) => v.isLeader);
  }, [session]);

  const speakingVehicleNames = React.useMemo(() => {
    if (remoteSpeakerUids.size === 0 || !session) return [];
    return Array.from(remoteSpeakerUids)
      .map((uid) => agoraUidToVehicleRef.current.get(uid))
      .filter((name): name is string => Boolean(name));
  }, [remoteSpeakerUids, session]);

  const gapWarnings = React.useMemo<Set<string>>(() => {
    if (!session || session.vehicles.length < 2) return new Set();
    const leader = session.vehicles.find((v) => v.isLeader);
    if (!leader) return new Set();
    const warnings = new Set<string>();
    for (const v of session.vehicles) {
      if (v.isLeader) continue;
      const dist = haversineMeters(
        v.location.latitude,
        v.location.longitude,
        leader.location.latitude,
        leader.location.longitude
      );
      if (dist > gapThresholdM) warnings.add(v.id);
    }
    return warnings;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- session?.vehicles is the specific dependency; adding full session object would recompute on any session change
  }, [session?.vehicles, gapThresholdM]);

  // Tear down private PTT on sync zone exit.
  // Group PTT is not affected — exiting sync does not interrupt a broadcast.
  //
  const transferLeadership = useCallback((vehicle: Vehicle) => {
    const me = sessionRef.current?.vehicles.find((v) => v.isMe);
    if (!me?.isLeader) return;
    // Apply locally first for instant UI feedback
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        vehicles: prev.vehicles.map((v) => ({
          ...v,
          isLeader: v.id === vehicle.id,
        })),
      };
    });
    setMyVehicle((prev) => (prev ? { ...prev, isLeader: false } : prev));
    wsClientRef.current.sendLeaderHandoff(me.id, vehicle.id, vehicle.name);
  }, []);

  const claimLeadership = useCallback(() => {
    const me = sessionRef.current?.vehicles.find((v) => v.isMe);
    if (!me || !sessionRef.current) return;
    // Only claim if leader slot is truly vacant
    const leaderExists = sessionRef.current.vehicles.some((v) => v.isLeader);
    if (leaderExists) return;
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        vehicles: prev.vehicles.map((v) => ({
          ...v,
          isLeader: v.id === me.id,
        })),
      };
    });
    setMyVehicle((prev) => (prev ? { ...prev, isLeader: true } : prev));
    wsClientRef.current.sendLeaderHandoff("", me.id, me.name);
  }, []);

  // NOTE: This is the one intentional exception to the "defer sendPrivatePttEnd
  // until idle timeout" rule. Sync-zone exit forces an immediate channel teardown
  // regardless of the warm-hold window. The remote peer will receive sendPrivatePttEnd
  // sooner than 30 s in this case; that is acceptable — the sync event (all vehicles
  // within 50 m) already signals conversation end to the convoy.
  const clearSyncPTT = useCallback(() => {
    if (talkTargetRef.current) {
      // Active outbound private call: stopTalking() handles mute + schedules the
      // 30s warm-hold timer. Cancel that timer right after — sync-zone exit
      // requires immediate teardown (see note above).
      stopTalking();
      if (privateIdleTimerRef.current) {
        clearTimeout(privateIdleTimerRef.current);
        privateIdleTimerRef.current = null;
      }
      const info = privateWarmInfoRef.current;
      if (info && isAgoraAvailable()) {
        wsClientRef.current.sendPrivatePttEnd(info.myId, info.partnerId, info.chName);
        leavePrivateChannel();
        configureAudioSessionForConvoy().catch(() => {});
      }
      privateWarmInfoRef.current = null;
    } else {
      // No active outbound call: cancel any warm-channel idle timer (receive-only
      // or idle warm) and tear down the private channel immediately.
      if (privateIdleTimerRef.current) {
        clearTimeout(privateIdleTimerRef.current);
        privateIdleTimerRef.current = null;
      }
      privateWarmInfoRef.current = null;
      if (isAgoraAvailable()) {
        mutePrivateAudio();
        leavePrivateChannel();
        configureAudioSessionForConvoy().catch(() => {});
      }
    }
    // Always clear all private-channel UI state.
    setIsPrivateChannelWarm(false);
    setPrivateWarmPartnerName(null);
    setHasIncomingPrivate(false);
    incomingPrivateSenderIdRef.current = null;
    setIncomingPrivateSenderId(null);
  }, [stopTalking]);

  /**
   * Open a private reply channel back to whoever last sent us a private PTT.
   * Works identically to tapping a vehicle card's private PTT button, except
   * the target is auto-filled from `incomingPrivateSenderIdRef`.
   * VAD silence (2 s) stops the transmission; the channel then stays warm for
   * 30 s (PRIVATE_IDLE_MS) to allow further back-and-forth without re-joining.
   */
  const replyToPrivate = useCallback(async (): Promise<boolean> => {
    const senderId = incomingPrivateSenderIdRef.current;
    const currentSession = sessionRef.current;
    if (!senderId || !currentSession) return false;

    const senderVehicle = currentSession.vehicles.find((v) => v.id === senderId);
    if (!senderVehicle) return false;

    // Point talkTarget at the sender so startTalking() opens the private channel
    talkTargetRef.current = senderVehicle;
    setTalkTargetState(senderVehicle);

    return startTalking();
  }, [startTalking]);

  // ─── Sync zone: all vehicles within 50 m of centroid ─────────────────────
  const SYNC_ZONE_RADIUS_M = 50;

  const { isInSyncZone, convoycentroid } = useMemo(() => {
    const vehicles = session?.vehicles ?? [];
    if (vehicles.length < 2) return { isInSyncZone: false, convoycentroid: null };

    const lat = vehicles.reduce((s, v) => s + v.location.latitude, 0) / vehicles.length;
    const lng = vehicles.reduce((s, v) => s + v.location.longitude, 0) / vehicles.length;

    const allWithin = vehicles.every(
      (v) =>
        haversineMeters(v.location.latitude, v.location.longitude, lat, lng) <=
        SYNC_ZONE_RADIUS_M
    );

    return {
      isInSyncZone: allWithin,
      convoycentroid: { latitude: lat, longitude: lng },
    };
  }, [session?.vehicles]);

  const prevGapWarningsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const prev = prevGapWarningsRef.current;
    // Announce newly-gapped vehicles
    for (const id of gapWarnings) {
      if (!prev.has(id)) {
        const vehicle = session?.vehicles.find((v) => v.id === id);
        if (vehicle) announceGapWarning(vehicle.name);
      }
    }
    // Announce when ALL gaps clear (convoy reunited)
    if (prev.size > 0 && gapWarnings.size === 0) {
      announceGapCleared();
    }
    prevGapWarningsRef.current = new Set(gapWarnings);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- session?.vehicles is accessed inside via gapWarnings derivation; adding it would double-run announcements
  }, [gapWarnings]);

  // Auto-clear regroup pin once every vehicle is within 50 m of it
  const REGROUP_ARRIVE_RADIUS_M = 50;
  useEffect(() => {
    if (!regroupPin || !session || session.vehicles.length === 0) return;
    const allArrived = session.vehicles.every((v) => {
      const dist = haversineMeters(
        v.location.latitude,
        v.location.longitude,
        regroupPin.lat,
        regroupPin.lng
      );
      return dist <= REGROUP_ARRIVE_RADIUS_M;
    });
    if (allArrived) {
      const pinIdToRemove = regroupPin.pinId;
      setRegroupPin(null);
      regroupPinRef.current = null;
      setVehicleRegroupEtas(new Map());
      wsClientRef.current.sendRegroupPinClear(pinIdToRemove);
      announceConvoyRegrouped();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- session?.vehicles is the specific dep; adding full session would re-run on every message update
  }, [session?.vehicles, regroupPin]);

  return (
    <ConvoyContext.Provider
      value={{
        session,
        myVehicle,
        isLeader: myVehicle?.isLeader ?? false,
        mergeState,
        createConvoy,
        joinConvoy,
        leaveConvoy,
        updateMyLocation,
        sendMessage,
        setDestination,
        startNavigation,
        advanceNavStep,
        clearNavigation,
        computeMerge,
        updateMergeProgress,
        advanceMergeStep,
        isTalking,
        startTalking,
        stopTalking,
        talkTarget,
        setTalkTarget,
        hasIncomingPrivate,
        incomingPrivateSenderId,
        replyToPrivate,
        isPrivateChannelWarm,
        privateWarmPartnerName,
        remoteSpeakerUids,
        speakingVehicleNames,
        isGroupBroadcastActive,
        isLeaderBroadcastActive,
        isLeaderVacant,
        transferLeadership,
        claimLeadership,
        gapWarnings,
        gapThresholdM,
        setGapThresholdM,
        hazards,
        reportHazard,
        voiceTokenWarning,
        dismissVoiceTokenWarning,
        voiceConnectStatus,
        bgPttWarning,
        dismissBgPttWarning,
        regroupPin,
        broadcastRegroupPin,
        clearRegroupPin,
        pendingStopRequest,
        respondToStopRequest,
        dismissStopRequest,
        stopRequestResponses,
        sendConvoyStopRequest,
        pendingStopProposal,
        sendStopProposal,
        respondToStopProposal,
        dismissStopProposal,
        stopProposalResponses,
        vehicleRegroupEtas,
        isInSyncZone,
        convoycentroid,
        clearSyncPTT,
      }}
    >
      {children}
    </ConvoyContext.Provider>
  );
}

export function useConvoy() {
  const ctx = useContext(ConvoyContext);
  if (!ctx) throw new Error("useConvoy must be used within ConvoyProvider");
  return ctx;
}
