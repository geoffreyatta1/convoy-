/**
 * Android Auto integration service for the Convoy app — native Android implementation.
 *
 * Android Auto integration works through two layers:
 *
 *  1. MANIFEST DECLARATION (handled by plugins/withAndroidAuto.js):
 *     - Adds `<meta-data android:name="com.google.android.gms.car.application">`
 *       pointing to `res/xml/automotive_app_desc.xml` which declares this as
 *       a navigation app. This makes the app visible in the Android Auto launcher.
 *
 *  2. RUNTIME BRIDGE (this file):
 *     - Listens for Android Auto connection events via the native module bridge.
 *     - Exposes convoy state to the car display.
 *     - Handles talk button presses from the steering wheel / car display.
 *
 * REQUIREMENTS for live testing:
 *  - A development build (not Expo Go).
 *  - Android Auto app installed on the phone.
 *  - A car head unit or the Android Auto desktop head unit emulator.
 *
 * NOTE: The `react-native-android-auto` npm package is currently broken
 * (missing internal module AndroidAutoReact). Android Auto UI is therefore
 * implemented via the native module bridge below, which matches the API surface
 * that a future stable package would expose.
 */

import { NativeEventEmitter, NativeModules, Platform } from "react-native";

export interface AndroidAutoState {
  convoyName: string;
  code: string;
  vehicles: Array<{
    id: string;
    name: string;
    isLeader: boolean;
    isMe: boolean;
    speed?: number;
  }>;
  isTalking: boolean;
  destination?: string;
}

type TalkCallback = () => void;

let onStartTalk: TalkCallback | null = null;
let onStopTalk: TalkCallback | null = null;

export function registerAndroidAutoCallbacks(startTalk: TalkCallback, stopTalk: TalkCallback) {
  onStartTalk = startTalk;
  onStopTalk = stopTalk;
}

export function updateAndroidAutoUI(state: AndroidAutoState) {
  if (Platform.OS !== "android") return;

  // Push updated state to the native Android Auto module if available
  const mod = NativeModules.ConvoyAndroidAutoModule;
  if (!mod) return;

  try {
    const sorted = [...state.vehicles].sort((a) => (a.isLeader ? -1 : 1));
    mod.updateConvoyState({
      title: state.convoyName,
      code: state.code,
      isTalking: state.isTalking,
      destination: state.destination ?? "",
      vehicles: sorted.map((v, i) => ({
        id: v.id,
        name: v.name,
        position: i + 1,
        isLeader: v.isLeader,
        isMe: v.isMe,
        speedMph: Math.round(v.speed ?? 0),
      })),
    });
  } catch {}
}

export function initAndroidAuto() {
  if (Platform.OS !== "android") return;

  const mod = NativeModules.ConvoyAndroidAutoModule;
  if (!mod) return;

  try {
    // Listen for action events from the car display (e.g. Talk button press)
    const emitter = new NativeEventEmitter(mod);
    emitter.addListener("ConvoyAutoAction", (event: { action: string }) => {
      switch (event.action) {
        case "TALK_START":
          onStartTalk?.();
          // Auto-release after 8 s for safety (driver shouldn't hold button long)
          setTimeout(() => onStopTalk?.(), 8000);
          break;
        case "TALK_STOP":
          onStopTalk?.();
          break;
        default:
          break;
      }
    });

    // Declare readiness to the car host
    mod.initialize?.();
  } catch {}
}
