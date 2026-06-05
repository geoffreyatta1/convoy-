/**
 * tts — hands-free voice announcement service for Convoy.
 *
 * Queues all driving alerts (gap warnings, hazards, nav steps, stop requests)
 * so the driver never has to look at the screen. Announcements are suppressed
 * automatically while PTT is transmitting, then resume when the channel closes.
 *
 * Priority 'high' interrupts any currently-speaking item and jumps the queue.
 * Priority 'normal' (default) is appended to the queue.
 *
 * Web is a no-op — TTS is native-only.
 *
 * CarPlay audio session (February 2026 CarPlay Developer Guide §3.4):
 * Before each utterance on iOS the audio session is configured explicitly to:
 *   - Category: AVAudioSessionCategoryPlayback (routes through car speakers)
 *   - Mode:     AVAudioSessionModeVoicePrompt (iOS 12+, for non-assistant prompts)
 *   - Options:  duckOthers (lowers Spotify/music while prompt plays)
 *
 * expo-av's setAudioModeAsync covers the category + duckOthers option.
 * The VoicePrompt mode is set directly via NativeModules.ExponentAV if
 * available; otherwise the session degrades gracefully to standard Playback.
 * The session is deactivated (notifyOthersOnDeactivation) after each utterance
 * so other apps restore to full volume immediately.
 */

import * as Speech from "expo-speech";
import { Platform } from "react-native";
import {
  activateVoicePromptSession,
  deactivateVoicePromptSession,
} from "./audio-session";

interface QueuedItem {
  text: string;
  priority: "high" | "normal";
}

const _queue: QueuedItem[] = [];
let _isSpeaking = false;
let _suppressed = false;

// ─── Queue processing ─────────────────────────────────────────────────────────

function _next() {
  _isSpeaking = false;
  void deactivateVoicePromptSession();
  _processQueue();
}

function _processQueue() {
  if (_isSpeaking || _suppressed || !_queue.length) return;
  const item = _queue.shift()!;
  _isSpeaking = true;

  void activateVoicePromptSession().then(() => {
    Speech.speak(item.text, {
      language: "en-US",
      rate: 1.05,
      pitch: 1.0,
      onDone: _next,
      onStopped: _next,
      onError: _next,
    });
  });
}

function _enqueue(text: string, priority: "high" | "normal" = "normal") {
  if (Platform.OS === "web") return;
  if (priority === "high") {
    Speech.stop();
    _isSpeaking = false;
    _queue.unshift({ text, priority });
  } else {
    _queue.push({ text, priority });
  }
  _processQueue();
}

// ─── Suppression (during PTT transmit) ────────────────────────────────────────

/** Silence TTS while a PTT channel is open. */
export function suppressTts() {
  _suppressed = true;
  try { Speech.stop(); } catch {}
  _isSpeaking = false;
}

/** Resume TTS after PTT closes. */
export function resumeTts() {
  _suppressed = false;
  _processQueue();
}

// ─── Navigation ────────────────────────────────────────────────────────────────

export function announceNavStart(firstInstruction: string) {
  _enqueue(`Navigation started. ${firstInstruction}`, "high");
}

/**
 * Announce the upcoming maneuver.
 * Called whenever the nav step index changes.
 */
export function announceNavStep(instruction: string, distanceM: number) {
  const dist =
    distanceM < 300
      ? `${Math.round(distanceM)} meters`
      : distanceM < 1000
      ? `${Math.round(distanceM / 100) * 100} meters`
      : `${(distanceM / 1000).toFixed(1)} kilometres`;
  _enqueue(`In ${dist}, ${instruction}`);
}

export function announceNavArrival(destinationName: string) {
  _enqueue(`You have arrived at ${destinationName}`, "high");
}

export function announceNavRecalculate() {
  _enqueue("Route recalculated", "high");
}

// ─── Convoy events ─────────────────────────────────────────────────────────────

export function announceGapWarning(vehicleName: string) {
  _enqueue(`${vehicleName} is falling behind the convoy`, "high");
}

export function announceGapCleared() {
  _enqueue("Convoy back together");
}

// ─── Hazards ──────────────────────────────────────────────────────────────────

const HAZARD_LABELS: Record<string, string> = {
  police: "Police ahead",
  accident: "Accident reported ahead",
  construction: "Road construction ahead",
  debris: "Road debris ahead",
  other: "Hazard reported ahead",
};

export function announceHazard(type: string) {
  _enqueue(HAZARD_LABELS[type] ?? "Hazard reported ahead", "high");
}

// ─── Stop proposals ────────────────────────────────────────────────────────────

export function announceStopProposal(fromName: string, stopName: string) {
  _enqueue(
    `${fromName} suggests stopping at ${stopName}. Check your screen to respond.`,
    "high"
  );
}

// ─── Stop requests ─────────────────────────────────────────────────────────────

export function announceStopRequest(
  fromName: string,
  stopType: string,
  stationName: string
) {
  const label =
    stopType === "fuel"
      ? "fuel stop"
      : stopType === "food"
      ? "food stop"
      : stopType === "bathroom"
      ? "bathroom break"
      : stopType === "rest"
      ? "rest stop"
      : "stop";
  _enqueue(
    `${fromName} is requesting a ${label} at ${stationName}. Check your screen to respond.`,
    "high"
  );
}

// ─── Regroup ───────────────────────────────────────────────────────────────────

export function announceConvoyRegrouped() {
  _enqueue("Convoy regrouped!", "high");
}
