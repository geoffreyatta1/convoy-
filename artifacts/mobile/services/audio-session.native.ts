/**
 * iOS audio session bridge for CarPlay voice prompts (Feb 2026 guide §3.4).
 *
 * Primary path: ConvoyAudio native module (ConvoyAudioModule.swift) sets
 *   setCategory(.playback, mode:.voicePrompt,
 *               options:[.duckOthers, .interruptSpokenAudioAndMixWithOthers])
 *   setActive(true / false, options:.notifyOthersOnDeactivation)
 * Fallback (Expo Go / pre-prebuild): expo-av setAudioModeAsync — Playback +
 *   DuckOthers without VoicePrompt mode.
 */

import { Platform } from "react-native";

export async function activateVoicePromptSession(): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const m = require("../modules/ConvoyAudio") as typeof import("../modules/ConvoyAudio");
    await m.default.activateVoicePromptSession();
    return;
  } catch {}
  try {
    const { Audio, InterruptionModeIOS, InterruptionModeAndroid } =
      require("expo-av") as typeof import("expo-av");
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    });
  } catch {}
}

export async function deactivateVoicePromptSession(): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const m = require("../modules/ConvoyAudio") as typeof import("../modules/ConvoyAudio");
    await m.default.deactivateVoicePromptSession();
    return;
  } catch {}
  try {
    const { Audio, InterruptionModeIOS, InterruptionModeAndroid } =
      require("expo-av") as typeof import("expo-av");
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      shouldDuckAndroid: false,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    });
  } catch {}
}
