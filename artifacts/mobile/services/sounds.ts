/**
 * Sounds service — walkie-talkie audio cues.
 *
 * Two implementations depending on platform:
 *   • Web  : Web Audio API oscillator (no deps, instant)
 *   • Native: expo-av Sound loaded from a runtime-generated WAV data URI
 *
 * Audio session is configured to NOT interrupt background apps (Spotify, Apple Music, etc.)
 * The app acts as an "ambient" audio producer — it ducks its beeps beneath any music
 * already playing rather than pausing it.
 */

import { Platform } from "react-native";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";

export type SoundCue = "ptt_start" | "ptt_end" | "incoming";

const CUES: Record<SoundCue, { freq: number; durationS: number; volume: number }> = {
  ptt_start: { freq: 1050, durationS: 0.07, volume: 0.55 },
  ptt_end:   { freq: 700,  durationS: 0.09, volume: 0.45 },
  incoming:  { freq: 880,  durationS: 0.14, volume: 0.65 },
};

// ─── WAV generator ────────────────────────────────────────────────────────────

function generateWav(freq: number, durationS: number, volume: number, sampleRate = 8000): Uint8Array {
  const n = Math.floor(sampleRate * durationS);
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);

  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i));
  };

  w(0, "RIFF");
  dv.setUint32(4, 36 + n * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);   // PCM
  dv.setUint16(22, 1, true);   // mono
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  w(36, "data");
  dv.setUint32(40, n * 2, true);

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    // Exponential fade-out envelope so the beep doesn't click
    const env = Math.min(1, t * 40) * Math.exp(-t * 10);
    const sample = Math.sin(2 * Math.PI * freq * t) * env * volume;
    const s16 = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    dv.setInt16(44 + i * 2, s16, true);
  }

  return new Uint8Array(buf);
}

function toBase64(bytes: Uint8Array): string {
  let b = "";
  for (let i = 0; i < bytes.length; i++) b += String.fromCharCode(bytes[i]);
  return btoa(b);
}

// ─── Platform implementations ────────────────────────────────────────────────

async function webTone(freq: number, durationS: number, volume: number): Promise<void> {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx() as AudioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume * 0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationS);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + durationS);
  } catch {}
}

async function nativeTone(freq: number, durationS: number, volume: number): Promise<void> {
  try {
    const wav = generateWav(freq, durationS, volume);
    const b64 = toBase64(wav);
    const uri = `data:audio/wav;base64,${b64}`;
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, volume: 1 }
    );
    // Clean up after playback
    setTimeout(() => { sound.unloadAsync().catch(() => {}); }, (durationS + 1) * 1000);
  } catch {}
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function playSound(cue: SoundCue): Promise<void> {
  const { freq, durationS, volume } = CUES[cue];
  if (Platform.OS === "web") {
    await webTone(freq, durationS, volume);
  } else {
    await nativeTone(freq, durationS, volume);
  }
}

/**
 * Configure the audio session for the idle (non-convoy) state so the app's
 * beeps DON'T interrupt or duck Spotify, Apple Music, Waze, or any other
 * background audio app.
 *
 * - iOS  : MixWithOthers = our beeps play alongside music at full volume,
 *          no ducking, no interruption.
 * - Android: shouldDuckAndroid false = we don't lower other apps' volumes.
 *
 * When the driver joins a convoy, `configureAudioSessionForConvoy()` (in
 * agora.native.ts) takes over and switches to DuckOthers so convoy voice
 * automatically dims music during transmissions.
 */
export async function configureAudioSession(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
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
