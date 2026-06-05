/**
 * CarPlay service — web stub.
 * On web nothing happens; native implementation is in carplay.native.ts.
 */

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
  /** Zero-based index of the current step. */
  currentStepIndex?: number;
  /** All remaining steps from currentStepIndex onward (including current). */
  upcomingSteps?: Array<{ instruction: string; distanceM: number; icon: string }>;
  /** Vehicles that have exceeded the gap threshold, with their distance to the leader. */
  gapWarningVehicles?: Array<{ id: string; name: string; distanceM: number }>;
  /** Active regroup pin broadcast by a convoy member, if any. */
  regroupPin?: { name: string; lat: number; lng: number };
}

export function registerCarPlayCallbacks(_start: () => void, _stop: () => void) {}
export function registerNavigationCancelledCallback(_cb: () => void) {}
export function updateCarPlayUI(_state: CarPlayState) {}
export function clearCarPlayUI() {}
export function initCarPlay() {}
export function isCarPlayConnected() { return false; }
export function ensureCarPlayVoiceTemplate(): boolean { return true; }
export function dismissCarPlayVoiceTemplate() {}
