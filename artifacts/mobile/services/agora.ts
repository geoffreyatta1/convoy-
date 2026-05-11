/**
 * Web stub for the Agora service.
 * Metro picks agora.native.ts on iOS/Android; this file is used on web only.
 * All functions are no-ops so web bundling succeeds.
 */

export type AgoraEventCallbacks = {
  onSpeakersChanged?: (speakingUids: Set<number>) => void;
  onRemoteUserJoined?: (uid: number) => void;
  onRemoteUserLeft?: (uid: number) => void;
  onLocalVolume?: (volume: number) => void;
  onError?: (code: number, msg: string) => void;
};

export function isAgoraAvailable(): boolean {
  return false;
}

export function vehicleIdToAgoraUid(_vehicleId: string): number {
  return 0;
}

export function privateChannelName(
  _convoyCode: string,
  _vehicleIdA: string,
  _vehicleIdB: string
): string {
  return "";
}

export function setAuthTokenGetter(_fn: () => Promise<string | null>): void {}

export function initAgora(_cbs: AgoraEventCallbacks): void {}

export async function joinChannel(_convoyCode: string, _vehicleId: string): Promise<void> {}

export function leaveChannel(): void {}

export function getCurrentChannel(): string | null {
  return null;
}

export function unmuteLocalAudio(): void {}

export function muteLocalAudio(): void {}

export async function joinPrivateChannel(
  _channelName: string,
  _vehicleId: string
): Promise<void> {}

export function leavePrivateChannel(): void {}

export function getCurrentPrivateChannel(): string | null {
  return null;
}

export function unmutePrivateAudio(): void {}

export function mutePrivateAudio(): void {}

export async function configureAudioSessionForConvoy(): Promise<void> {}

export async function resetAudioSession(): Promise<void> {}

export function destroyAgora(): void {}

export function setTokenRenewalErrorHandler(_fn: () => void): void {}

export function stopTokenRenewal(): void {}

export function setConnectionStatusCallback(
  _fn: ((_status: "reconnecting" | "connected" | "failed") => void) | null
): void {}

export function clearReconnectState(): void {}
