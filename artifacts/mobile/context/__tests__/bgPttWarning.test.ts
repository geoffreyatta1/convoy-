/**
 * Integration test: Bluetooth PTT background-press deduplication
 *
 * Simulates the ref / timer state machine that lives in ConvoyContext.tsx
 * without mounting the full React component tree.
 *
 * Run with:  pnpm --filter @workspace/mobile test:bgPtt
 */

import assert from "node:assert/strict";

// ─── Minimal fake timer utilities ────────────────────────────────────────────

type TimerId = ReturnType<typeof setTimeout>;

let _fakeNow = 0;
const _pendingTimers: Array<{ id: TimerId; fireAt: number; fn: () => void }> = [];
let _nextId = 1;

function fakeSetTimeout(fn: () => void, ms: number): TimerId {
  const id = (_nextId++ as unknown) as TimerId;
  _pendingTimers.push({ id, fireAt: _fakeNow + ms, fn });
  return id;
}

function fakeClearTimeout(id: TimerId | null): void {
  if (id == null) return;
  const idx = _pendingTimers.findIndex((t) => t.id === id);
  if (idx !== -1) _pendingTimers.splice(idx, 1);
}

/** Advance fake clock by `ms` milliseconds, firing any elapsed timers. */
function advanceTime(ms: number): void {
  _fakeNow += ms;
  const toFire = _pendingTimers.filter((t) => t.fireAt <= _fakeNow);
  toFire.forEach((t) => {
    const idx = _pendingTimers.indexOf(t);
    if (idx !== -1) _pendingTimers.splice(idx, 1);
    t.fn();
  });
}

function resetFakeTimers(): void {
  _fakeNow = 0;
  _pendingTimers.length = 0;
  _nextId = 1;
}

// ─── Replicate the state-machine logic from ConvoyContext ────────────────────
//
// We model just the three mutable values that govern the banner:
//   missedPttWhileBgRef  — set true on each background PTT press
//   bgPttWarningTimerRef — holds the auto-dismiss timer handle (or null)
//   bgPttWarning         — the boolean passed down to the UI layer
//
// `handlePttPress`  mimics `startTalking` when AppState !== "active"
// `handleForeground` mimics the relevant branch of `handleAppStateChange`

interface State {
  missedPttWhileBg: boolean;
  timerRef: TimerId | null;
  bgPttWarning: boolean;
}

function makeMachine() {
  const s: State = { missedPttWhileBg: false, timerRef: null, bgPttWarning: false };

  const handlePttPress = () => {
    s.missedPttWhileBg = true;
  };

  const handleForeground = () => {
    if (!s.missedPttWhileBg) return;
    s.missedPttWhileBg = false;
    if (!s.timerRef) {
      s.bgPttWarning = true;
      s.timerRef = fakeSetTimeout(() => {
        s.timerRef = null;
        s.bgPttWarning = false;
      }, 5000);
    }
  };

  const dismissBgPttWarning = () => {
    s.bgPttWarning = false;
    fakeClearTimeout(s.timerRef);
    s.timerRef = null;
  };

  return { s, handlePttPress, handleForeground, dismissBgPttWarning };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    resetFakeTimers();
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

console.log("\nBluetooth PTT background-press deduplication\n");

test("single background press → one banner shown", () => {
  const { s, handlePttPress, handleForeground } = makeMachine();

  handlePttPress();
  handleForeground();

  assert.equal(s.bgPttWarning, true, "banner should be visible");
  assert.notEqual(s.timerRef, null, "auto-dismiss timer should be running");
});

test("two rapid background presses → still only one banner", () => {
  const { s, handlePttPress, handleForeground } = makeMachine();

  handlePttPress();
  handlePttPress();
  handleForeground();

  assert.equal(s.bgPttWarning, true, "banner should be visible");

  const timersRunning = _pendingTimers.length;
  assert.equal(timersRunning, 1, "exactly one auto-dismiss timer should exist");
});

test("background, foreground (banner shown), background again, foreground → timer NOT reset", () => {
  const { s, handlePttPress, handleForeground } = makeMachine();

  handlePttPress();
  handleForeground();

  assert.equal(s.bgPttWarning, true, "first banner should be visible");
  const firstTimerId = s.timerRef;
  assert.notEqual(firstTimerId, null, "first timer should be running");

  advanceTime(2000);
  assert.equal(s.bgPttWarning, true, "banner still visible after 2 s");

  handlePttPress();
  handleForeground();

  assert.equal(s.bgPttWarning, true, "banner should still be visible");
  assert.equal(
    s.timerRef,
    firstTimerId,
    "timer handle should be unchanged — second press must NOT reset the countdown"
  );
  assert.equal(_pendingTimers.length, 1, "still only one timer running");
});

test("banner auto-dismisses after 5 s with no second press", () => {
  const { s, handlePttPress, handleForeground } = makeMachine();

  handlePttPress();
  handleForeground();
  assert.equal(s.bgPttWarning, true);

  advanceTime(5000);

  assert.equal(s.bgPttWarning, false, "banner should auto-dismiss after 5 s");
  assert.equal(s.timerRef, null, "timer ref should be null after expiry");
});

test("a second press after banner dismisses starts a fresh banner", () => {
  const { s, handlePttPress, handleForeground } = makeMachine();

  handlePttPress();
  handleForeground();
  advanceTime(5000);
  assert.equal(s.bgPttWarning, false, "first banner dismissed");

  handlePttPress();
  handleForeground();

  assert.equal(s.bgPttWarning, true, "new banner should appear after first dismissed");
  assert.notEqual(s.timerRef, null, "new timer should be running");
});

test("dismiss button clears banner and timer immediately", () => {
  const { s, handlePttPress, handleForeground, dismissBgPttWarning } = makeMachine();

  handlePttPress();
  handleForeground();
  assert.equal(s.bgPttWarning, true);

  dismissBgPttWarning();

  assert.equal(s.bgPttWarning, false, "banner should be gone after dismiss");
  assert.equal(s.timerRef, null, "timer should be cleared after dismiss");
  assert.equal(_pendingTimers.length, 0, "no stale timers should remain");
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
