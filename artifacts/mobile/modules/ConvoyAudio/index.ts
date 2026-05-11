/**
 * ConvoyAudio — JavaScript interface for the native iOS audio session bridge.
 *
 * The native module (ConvoyAudioModule.swift) is added to the Xcode project via
 * the withConvoyAudio config plugin and registered automatically by expo-modules-core.
 *
 * requireOptionalNativeModule returns null (instead of throwing) when the module
 * is not registered — which is always the case in Expo Go and any build that does
 * not include the withConvoyAudio plugin. This makes it safe to import anywhere.
 */
import { requireOptionalNativeModule } from "expo-modules-core";

interface ConvoyAudioNativeModule {
  activateVoicePromptSession(): Promise<void>;
  deactivateVoicePromptSession(): Promise<void>;
}

let _m: ConvoyAudioNativeModule | null | undefined; // undefined = not yet attempted

function getModule(): ConvoyAudioNativeModule | null {
  if (_m !== undefined) return _m;
  _m = requireOptionalNativeModule<ConvoyAudioNativeModule>("ConvoyAudio");
  return _m;
}

const ConvoyAudio: ConvoyAudioNativeModule = {
  activateVoicePromptSession: () =>
    getModule()?.activateVoicePromptSession() ?? Promise.resolve(),
  deactivateVoicePromptSession: () =>
    getModule()?.deactivateVoicePromptSession() ?? Promise.resolve(),
};

export default ConvoyAudio;
