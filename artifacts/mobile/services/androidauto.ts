/**
 * Android Auto service — web stub.
 * On web nothing happens; native implementation is in androidauto.native.ts.
 */

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
  /** Active regroup pin broadcast by a convoy member, if any. */
  regroupPin?: { name: string; lat: number; lng: number };
}

export function registerAndroidAutoCallbacks(_start: () => void, _stop: () => void) {}
export function updateAndroidAutoUI(_state: AndroidAutoState) {}
export function initAndroidAuto() {}
