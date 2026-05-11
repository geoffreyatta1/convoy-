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
}

export function registerAndroidAutoCallbacks(_start: () => void, _stop: () => void) {}
export function updateAndroidAutoUI(_state: AndroidAutoState) {}
export function initAndroidAuto() {}
