/**
 * Agora real-time voice service for convoy push-to-talk.
 *
 * Tokens are fetched from the API server (/api/agora-token) before each
 * joinChannel call. The server uses the Agora token builder with the
 * AGORA_APP_CERTIFICATE secret to generate short-lived RTC tokens.
 * See: https://docs.agora.io/en/video-calling/get-started/authentication-workflow
 *
 * EXPO_PUBLIC_AGORA_APP_ID is injected at bundle time via the dev script.
 * EXPO_PUBLIC_DOMAIN is injected at bundle time and used to reach the API server.
 *
 * react-native-agora is loaded lazily via require() so the app still launches
 * in Expo Go (which cannot link custom native modules). All Agora features are
 * silently disabled when the native module is unavailable.
 *
 * Private (targeted) channels use joinChannelEx / leaveChannelEx so the main
 * group channel and a one-to-one private channel run simultaneously. Audio is
 * published on only one channel at a time — updateChannelMediaOptionsEx is used
 * to selectively enable the mic on the private channel while keeping it muted on
 * the group channel, and vice-versa.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";

// ---------------------------------------------------------------------------
// Lazy native module — must NOT be a top-level static import.
// Expo Go will throw "module not linked" for any unresolved native module
// that appears in a static import, even inside a branch that never executes.
// In Expo Go (appOwnership === "expo") we skip loading entirely — the SDK
// is not bundled and react-native-agora's own module init crashes before
// our try/catch can intercept it.
// ---------------------------------------------------------------------------
type AgoraLib = typeof import("react-native-agora");

const _isExpoGo = Constants.appOwnership === "expo";

let _agora: AgoraLib | null = null;

function getAgora(): AgoraLib | null {
  if (_isExpoGo) return null;
  if (_agora !== null) return _agora;
  try {
    _agora = require("react-native-agora") as AgoraLib;
  } catch {
    console.warn(
      "[Agora] react-native-agora not available (not linked). " +
        "PTT will be disabled. Use a custom dev build to enable Agora."
    );
    _agora = null;
  }
  return _agora;
}

// ---------------------------------------------------------------------------
// Types re-exported from the lazy module so callers keep their signatures
// ---------------------------------------------------------------------------
type IRtcEngine = import("react-native-agora").IRtcEngine;
type IRtcEngineEx = import("react-native-agora").IRtcEngineEx;
type IRtcEngineEventHandler = import("react-native-agora").IRtcEngineEventHandler;
type AudioVolumeInfo = import("react-native-agora").AudioVolumeInfo;
type RtcConnection = import("react-native-agora").RtcConnection;

const APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID ?? "";
const API_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";

/**
 * Injected once by AgoraAuthWiring in _layout.tsx so fetchAgoraToken
 * can attach the Supabase session JWT to each token request.
 */
let _getAuthToken: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(fn: () => Promise<string | null>): void {
  _getAuthToken = fn;
}

/** Volume threshold (0–255) above which a user is considered actively speaking */
const SPEAKING_VOLUME_THRESHOLD = 20;

/**
 * Derive a stable uint32 Agora UID from a vehicle ID string.
 * Uses djb2 hash to map an arbitrary string to a non-zero uint32.
 * The same vehicle ID will always produce the same UID across devices.
 */
export function vehicleIdToAgoraUid(vehicleId: string): number {
  let hash = 5381;
  for (let i = 0; i < vehicleId.length; i++) {
    hash = ((hash << 5) + hash) ^ vehicleId.charCodeAt(i);
    hash = hash >>> 0; // keep as uint32
  }
  return (hash % 0xfffffff0) + 1; // ensure non-zero, fits in valid Agora UID range
}

/**
 * Compute the deterministic private channel name for a pair of vehicles.
 * The smaller UID is always first so both sides always derive the same name.
 */
export function privateChannelName(
  convoyCode: string,
  vehicleIdA: string,
  vehicleIdB: string
): string {
  const uidA = vehicleIdToAgoraUid(vehicleIdA);
  const uidB = vehicleIdToAgoraUid(vehicleIdB);
  const [lo, hi] = uidA < uidB ? [uidA, uidB] : [uidB, uidA];
  return `convoy_${convoyCode.toUpperCase()}_p_${lo}_${hi}`;
}

export type AgoraEventCallbacks = {
  /** Called with the set of remote UIDs currently speaking (volume above threshold) */
  onSpeakersChanged?: (speakingUids: Set<number>) => void;
  /** Called when a remote user joins the channel (uid = their Agora UID) */
  onRemoteUserJoined?: (uid: number) => void;
  /** Called when a remote user leaves the channel */
  onRemoteUserLeft?: (uid: number) => void;
  /**
   * Called every ~200 ms with the local user's microphone volume (0–255).
   * Only fires while the local mic is unmuted. Used for VAD auto-stop.
   */
  onLocalVolume?: (volume: number) => void;
  onError?: (code: number, msg: string) => void;
};

let engine: IRtcEngine | null = null;
let registeredHandler: IRtcEngineEventHandler | null = null;
let callbacks: AgoraEventCallbacks = {};
let currentChannel: string | null = null;
let isInitialized = false;

// ─── Auto-reconnect state ─────────────────────────────────────────────────────

/** Last convoy code + vehicle used for joinChannel, saved for auto-reconnect */
let lastConvoyCode: string | null = null;
let lastVehicleId: string | null = null;
/** True while a manual reconnect attempt is in flight */
let isReconnecting = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * Incremented on every clearReconnectState(). The timer callback captures its
 * value at schedule time; if they differ when joinChannel() resolves, an
 * intentional leave happened mid-flight and we immediately leave again.
 */
let reconnectSessionId = 0;
/** True after a ConnectionStateReconnecting event so we know to fire "restored" on success */
let hadVoiceInterruption = false;
/** Callback fired on connection status changes so ConvoyContext can update the UI */
let onConnectionStatusChanged: ((status: "reconnecting" | "connected" | "failed") => void) | null = null;

/**
 * Register a callback that fires when the Agora connection state changes in a
 * way that affects voice reliability. Called with:
 *  "reconnecting" — SDK is attempting to restore the channel after a network drop
 *  "connected"    — channel fully restored (after a prior "reconnecting" event)
 *  "failed"       — SDK gave up; manual rejoin is being scheduled
 */
export function setConnectionStatusCallback(
  fn: ((status: "reconnecting" | "connected" | "failed") => void) | null
): void {
  onConnectionStatusChanged = fn;
}

function scheduleManualReconnect(): void {
  if (isReconnecting || !lastConvoyCode || !lastVehicleId) return;
  isReconnecting = true;
  const scheduledSessionId = reconnectSessionId; // snapshot for in-flight guard
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    // Re-check state at execution time — clearReconnectState() may have been
    // called while the timer was pending (user left convoy during back-off window).
    if (reconnectSessionId !== scheduledSessionId || !lastConvoyCode || !lastVehicleId) {
      isReconnecting = false;
      return;
    }
    const code = lastConvoyCode;
    const vid = lastVehicleId;
    // Clear currentChannel so joinChannel doesn't bail early on the guard.
    currentChannel = null;
    // Mark interruption BEFORE calling joinChannel so the subsequent
    // ConnectionStateConnected event knows to emit the "restored" callback.
    hadVoiceInterruption = true;
    joinChannel(code, vid)
      .then(() => {
        // In-flight guard: if the session changed while joinChannel was executing
        // (token fetch + SDK join can take several seconds), an intentional leave
        // happened. Undo the rejoin immediately.
        if (reconnectSessionId !== scheduledSessionId) {
          if (engine && currentChannel) {
            try { engine.leaveChannel(); } catch {}
            currentChannel = null;
          }
          hadVoiceInterruption = false;
        }
      })
      .catch(() => {
        hadVoiceInterruption = false;
        // Manual retry failed — now surface "failed" to the driver
        onConnectionStatusChanged?.("failed");
      })
      .finally(() => {
        isReconnecting = false;
      });
  }, 3000);
}

/** Reset all reconnect state. Call when leaving a convoy intentionally. */
export function clearReconnectState(): void {
  // Increment session ID first so any in-flight joinChannel() resolves knowing
  // it should abort — checked in the scheduleManualReconnect() .then() handler.
  reconnectSessionId++;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  isReconnecting = false;
  hadVoiceInterruption = false;
  lastConvoyCode = null;
  lastVehicleId = null;
  // NOTE: intentionally NOT clearing onConnectionStatusChanged here.
  // The callback is registered once for the lifetime of ConvoyContext and must
  // survive intentional channel leaves so subsequent convoy sessions still get
  // reconnect status updates.
}

// ─── Private channel state ───────────────────────────────────────────────────

let privateConn: RtcConnection | null = null;
let currentPrivateChannel: string | null = null;

// ─── Token renewal state ──────────────────────────────────────────────────────

/** How many seconds before expiry to schedule the renewal */
const TOKEN_RENEWAL_MARGIN_S = 5 * 60;

let tokenRenewalTimer: ReturnType<typeof setTimeout> | null = null;
let onTokenRenewalError: (() => void) | null = null;

/**
 * Register a callback that fires when proactive token renewal fails.
 * Call this once from ConvoyContext so the UI can show a warning banner.
 */
export function setTokenRenewalErrorHandler(fn: () => void): void {
  onTokenRenewalError = fn;
}

function scheduleTokenRenewal(
  expiresAt: number,
  channel: string,
  uid: number
): void {
  if (tokenRenewalTimer) {
    clearTimeout(tokenRenewalTimer);
    tokenRenewalTimer = null;
  }

  const nowS = Math.floor(Date.now() / 1000);
  const renewInMs = Math.max(0, (expiresAt - nowS - TOKEN_RENEWAL_MARGIN_S) * 1000);

  tokenRenewalTimer = setTimeout(() => {
    tokenRenewalTimer = null;
    void performTokenRenewal(channel, uid);
  }, renewInMs);
}

async function performTokenRenewal(channel: string, uid: number): Promise<void> {
  if (!engine || !currentChannel) return;
  try {
    const { token, expiresAt } = await fetchAgoraToken(channel, uid);
    // Re-validate after the async fetch — the channel may have changed or
    // been left while the network request was in flight.
    if (!engine || currentChannel !== channel) return;
    // Guard against a malformed/past expiresAt that would cause an immediate-
    // renew loop. Require the token to be valid for at least 60 seconds.
    const nowS = Math.floor(Date.now() / 1000);
    if (typeof expiresAt !== "number" || expiresAt - nowS < 60) {
      console.warn("[Agora] Renewed token has unexpected expiresAt:", expiresAt);
      onTokenRenewalError?.();
      return;
    }
    engine.renewToken(token);
    scheduleTokenRenewal(expiresAt, channel, uid);
  } catch (e) {
    console.warn("[Agora] Token renewal failed:", e);
    onTokenRenewalError?.();
  }
}

/** Cancel the pending token renewal timer. Call when leaving the channel. */
export function stopTokenRenewal(): void {
  if (tokenRenewalTimer) {
    clearTimeout(tokenRenewalTimer);
    tokenRenewalTimer = null;
  }
}

export function isAgoraAvailable(): boolean {
  return Platform.OS !== "web" && APP_ID.length > 0 && getAgora() !== null;
}

export function initAgora(cbs: AgoraEventCallbacks): void {
  const agora = getAgora();
  if (!agora || Platform.OS === "web" || !APP_ID) return;
  if (isInitialized && engine) {
    callbacks = cbs;
    return;
  }

  callbacks = cbs;

  try {
    engine = agora.createAgoraRtcEngine();

    registeredHandler = {
      onError: (errCode, msg) => {
        callbacks.onError?.(errCode, msg);
      },
      onUserJoined: (_connection, remoteUid) => {
        callbacks.onRemoteUserJoined?.(remoteUid);
      },
      onUserOffline: (_connection, remoteUid) => {
        callbacks.onRemoteUserLeft?.(remoteUid);
      },
      onAudioVolumeIndication: (
        _connection,
        speakers: AudioVolumeInfo[],
        _speakerNumber: number,
        _totalVolume: number
      ) => {
        const speakingUids = new Set<number>();
        for (const s of speakers) {
          if (s.uid == null || s.volume == null) continue;
          if (s.uid === 0) {
            // Local user — report volume for VAD auto-stop
            callbacks.onLocalVolume?.(s.volume);
          } else if (s.volume > SPEAKING_VOLUME_THRESHOLD) {
            speakingUids.add(s.uid);
          }
        }
        callbacks.onSpeakersChanged?.(speakingUids);
      },
      onConnectionStateChanged: (_connection, state) => {
        const ST = agora.ConnectionStateType;
        if (state === ST.ConnectionStateReconnecting) {
          // SDK is automatically retrying after a network interruption.
          // Mark that an interruption happened so we can fire "restored" when it recovers.
          hadVoiceInterruption = true;
          onConnectionStatusChanged?.("reconnecting");
        } else if (state === ST.ConnectionStateConnected) {
          // Channel fully connected. Only notify if we had a prior interruption —
          // the initial join also fires Connected and we don't want a "restored" pill then.
          if (hadVoiceInterruption) {
            hadVoiceInterruption = false;
            onConnectionStatusChanged?.("connected");
          }
        } else if (state === ST.ConnectionStateFailed) {
          // Agora's own retry exhausted (~20 s). Stay in "reconnecting" state since
          // scheduleManualReconnect() is about to fire a manual back-off rejoin.
          // Only transition to "failed" if the manual retry itself also fails
          // (handled in scheduleManualReconnect()'s .catch() path).
          onConnectionStatusChanged?.("reconnecting");
          scheduleManualReconnect();
        } else if (state === ST.ConnectionStateDisconnected) {
          // Unexpected disconnect while in a convoy session (e.g. severe network loss
          // that bypassed ConnectionStateReconnecting, or post-Failed SDK teardown).
          // lastConvoyCode is cleared by clearReconnectState() during an intentional
          // leaveChannel(), so this guard safely skips reconnect after voluntary exits.
          if (lastConvoyCode && lastVehicleId && !isReconnecting) {
            hadVoiceInterruption = true;
            onConnectionStatusChanged?.("reconnecting");
            scheduleManualReconnect();
          }
        }
      },
    };

    engine.registerEventHandler(registeredHandler);

    engine.initialize({
      appId: APP_ID,
      channelProfile:
        agora.ChannelProfileType.ChannelProfileCommunication,
    });

    engine.enableAudio();
    engine.muteLocalAudioStream(true);

    isInitialized = true;
  } catch (e) {
    console.warn("[Agora] init error:", e);
  }
}

/**
 * Fetch a short-lived RTC token from the API server.
 *
 * Auth uses the Supabase session JWT as a Bearer token.
 * - In development (EXPO_PUBLIC_DOMAIN not set) falls back to empty string
 *   so local testing against an App ID-only Agora project still works.
 * - In production (EXPO_PUBLIC_DOMAIN is set) throws on failure so the caller
 *   never joins with an empty/invalid token by accident (fail-closed).
 */
async function fetchAgoraToken(
  channel: string,
  uid: number
): Promise<{ token: string; expiresAt: number }> {
  if (!API_DOMAIN) {
    console.warn(
      "[Agora] EXPO_PUBLIC_DOMAIN not set — falling back to empty token (dev only)"
    );
    // Return a token that "expires" in 1 hour so the renewal timer fires normally
    return { token: "", expiresAt: Math.floor(Date.now() / 1000) + 3600 };
  }

  const accessToken = _getAuthToken ? await _getAuthToken() : null;
  if (!accessToken) {
    throw new Error("[Agora] No auth session — cannot request Agora token");
  }

  const url = `https://${API_DOMAIN}/api/agora-token?channel=${encodeURIComponent(channel)}&uid=${uid}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`[Agora] Token server returned HTTP ${response.status}`);
  }
  const data = (await response.json()) as { token: string; expiresAt: number };
  if (!data.token) {
    throw new Error("[Agora] Token server returned empty token");
  }
  return { token: data.token, expiresAt: data.expiresAt };
}

/**
 * Join a voice channel derived from the convoy join code.
 * vehicleId is used to derive a stable Agora UID so remote users can
 * be mapped deterministically back to a vehicle name.
 * The local mic is muted by default — call unmuteLocalAudio() to transmit.
 */
export async function joinChannel(
  convoyCode: string,
  vehicleId: string
): Promise<void> {
  const agora = getAgora();
  if (!agora || !engine) return;

  const channel = `convoy_${convoyCode.toUpperCase()}`;
  const uid = vehicleIdToAgoraUid(vehicleId);

  // Save for auto-reconnect in case the channel drops mid-convoy.
  // Do NOT reset hadVoiceInterruption here — scheduleManualReconnect() sets it
  // to true before calling joinChannel() so the post-reconnect
  // ConnectionStateConnected event correctly emits the "restored" callback.
  lastConvoyCode = convoyCode;
  lastVehicleId = vehicleId;

  if (currentChannel === channel) return;

  if (currentChannel) {
    try {
      engine.leaveChannel();
    } catch (e) {
      console.warn("[Agora] leaveChannel before rejoin error:", e);
    }
  }

  const { token, expiresAt } = await fetchAgoraToken(channel, uid);

  try {
    const options: import("react-native-agora").ChannelMediaOptions = {
      clientRoleType: agora.ClientRoleType.ClientRoleBroadcaster,
      publishMicrophoneTrack: false, // always start muted
      autoSubscribeAudio: true,
    };

    engine.joinChannel(token, channel, uid, options);
    currentChannel = channel;
    scheduleTokenRenewal(expiresAt, channel, uid);

    engine.enableAudioVolumeIndication(
      200, // interval in ms — report every 200 ms
      3,   // smooth factor
      true // reportVad — enables uid=0 local volume reports used for VAD auto-stop
    );
  } catch (e) {
    console.warn("[Agora] joinChannel SDK error:", e);
  }
}

export function leaveChannel(): void {
  // Clear reconnect state UNCONDITIONALLY — before the currentChannel guard —
  // so timers are cancelled even when scheduleManualReconnect() has already
  // set currentChannel to null in preparation for its own joinChannel() call.
  clearReconnectState();
  if (!engine || !currentChannel) return;
  stopTokenRenewal();
  try {
    engine.leaveChannel();
    currentChannel = null;
    callbacks.onSpeakersChanged?.(new Set());
  } catch (e) {
    console.warn("[Agora] leaveChannel error:", e);
  }
}

/** Returns the active group channel name, or null if not joined */
export function getCurrentChannel(): string | null {
  return currentChannel;
}

// ─── Group PTT ───────────────────────────────────────────────────────────────

/** Unmute local mic on the group channel — call when group PTT button is pressed */
export function unmuteLocalAudio(): void {
  if (!engine) return;
  try {
    engine.updateChannelMediaOptions({ publishMicrophoneTrack: true });
  } catch (e) {
    console.warn("[Agora] unmuteLocalAudio error:", e);
  }
}

/** Mute local mic on the group channel — call when group PTT button is released */
export function muteLocalAudio(): void {
  if (!engine) return;
  try {
    engine.updateChannelMediaOptions({ publishMicrophoneTrack: false });
  } catch (e) {
    console.warn("[Agora] muteLocalAudio error:", e);
  }
}

// ─── Private channel (simultaneous / targeted PTT) ───────────────────────────

/**
 * Join a private channel alongside the group channel so audio from the remote
 * peer can be received simultaneously. The mic is NOT published on join —
 * call unmutePrivateAudio() when the user presses PTT.
 */
export async function joinPrivateChannel(
  channelName: string,
  vehicleId: string
): Promise<void> {
  const agora = getAgora();
  if (!agora || !engine) return;

  if (currentPrivateChannel === channelName) return;

  // Clean up any previous private channel first
  if (privateConn) {
    try {
      (engine as unknown as IRtcEngineEx).leaveChannelEx(privateConn);
    } catch {}
    privateConn = null;
    currentPrivateChannel = null;
  }

  const uid = vehicleIdToAgoraUid(vehicleId);
  const { token } = await fetchAgoraToken(channelName, uid);

  const conn: RtcConnection = { channelId: channelName, localUid: uid };

  try {
    const options: import("react-native-agora").ChannelMediaOptions = {
      clientRoleType: agora.ClientRoleType.ClientRoleBroadcaster,
      publishMicrophoneTrack: false,
      autoSubscribeAudio: true,
    };

    (engine as unknown as IRtcEngineEx).joinChannelEx(token, conn, options);
    privateConn = conn;
    currentPrivateChannel = channelName;
  } catch (e) {
    console.warn("[Agora] joinPrivateChannel error:", e);
  }
}

/** Leave the private channel. Call after a private PTT session ends. */
export function leavePrivateChannel(): void {
  if (!engine || !privateConn) return;
  try {
    (engine as unknown as IRtcEngineEx).leaveChannelEx(privateConn);
  } catch (e) {
    console.warn("[Agora] leavePrivateChannel error:", e);
  } finally {
    privateConn = null;
    currentPrivateChannel = null;
  }
}

/** Returns the active private channel name, or null */
export function getCurrentPrivateChannel(): string | null {
  return currentPrivateChannel;
}

/**
 * Start transmitting on the private channel only.
 * Also ensures the group channel is NOT publishing (mic isolation).
 */
export function unmutePrivateAudio(): void {
  if (!engine || !privateConn) return;
  try {
    // Ensure group channel is muted
    engine.updateChannelMediaOptions({ publishMicrophoneTrack: false });
    // Unmute on private channel
    (engine as unknown as IRtcEngineEx).updateChannelMediaOptionsEx(
      { publishMicrophoneTrack: true },
      privateConn
    );
  } catch (e) {
    console.warn("[Agora] unmutePrivateAudio error:", e);
  }
}

/** Stop transmitting on the private channel. */
export function mutePrivateAudio(): void {
  if (!engine || !privateConn) return;
  try {
    (engine as unknown as IRtcEngineEx).updateChannelMediaOptionsEx(
      { publishMicrophoneTrack: false },
      privateConn
    );
  } catch (e) {
    console.warn("[Agora] mutePrivateAudio error:", e);
  }
}

/**
 * Configure the iOS/Android audio session for active convoy participation.
 * Must be called after joining a channel so that:
 *  - Incoming audio plays while the app is in the background (staysActiveInBackground)
 *  - Audio plays even when the iOS silent switch is on (playsInSilentModeIOS)
 *  - Recording is disabled until the PTT button is pressed (allowsRecordingIOS: false)
 *
 * This is a no-op on web or when expo-av is unavailable.
 */
export async function configureAudioSessionForConvoy(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { Audio, InterruptionModeIOS, InterruptionModeAndroid } = require("expo-av") as typeof import("expo-av");
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      // DuckOthers: when convoy audio plays, iOS automatically lowers Spotify /
      // Apple Music / Waze audio. iOS restores the volume once our audio session
      // goes silent (i.e. no one is transmitting or receiving). This is the
      // standard "walkie-talkie over music" pattern.
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      shouldDuckAndroid: true,
      // Explicitly duck on Android too (DuckOthers is the default but let's be clear).
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    });
  } catch (e) {
    console.warn("[Agora] configureAudioSessionForConvoy error:", e);
  }
}

/**
 * Reset the audio session after leaving a convoy channel.
 * Releases the background audio entitlement so the OS can reclaim resources.
 */
export async function resetAudioSession(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { Audio, InterruptionModeIOS, InterruptionModeAndroid } = require("expo-av") as typeof import("expo-av");
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: false,
      // Restore to MixWithOthers so Spotify / music resumes at full volume
      // as soon as the convoy channel is fully torn down.
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      shouldDuckAndroid: false,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    });
  } catch (e) {
    console.warn("[Agora] resetAudioSession error:", e);
  }
}

export function destroyAgora(): void {
  if (!engine) return;
  stopTokenRenewal();
  try {
    if (registeredHandler) {
      engine.unregisterEventHandler(registeredHandler);
      registeredHandler = null;
    }
    if (privateConn) {
      try {
        (engine as unknown as IRtcEngineEx).leaveChannelEx(privateConn);
      } catch {}
      privateConn = null;
      currentPrivateChannel = null;
    }
    if (currentChannel) {
      engine.leaveChannel();
      currentChannel = null;
    }
    engine.release();
    engine = null;
    isInitialized = false;
  } catch (e) {
    console.warn("[Agora] destroy error:", e);
  }
}
