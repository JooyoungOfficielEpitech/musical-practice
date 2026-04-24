/**
 * audioContext — shared AudioContext singleton.
 *
 * Extracted from synthEngine.ts to break the require cycles:
 *   synthEngine → pianoSamples → synthEngine
 *   synthEngine → samplePlayer → synthEngine
 *
 * Both pianoSamples and samplePlayer now import from here, not from synthEngine.
 */
import { AudioContext } from "react-native-audio-api";

let audioContext: AudioContext | null = null;

/** Get or create the shared AudioContext. */
export function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/** Ensure the AudioContext is running (must be called after a user gesture). */
export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

/** Suspend the shared AudioContext (keeps currentTime monotonic). */
export async function suspendAudioContext(): Promise<void> {
  if (audioContext && audioContext.state === "running") {
    await audioContext.suspend();
  }
}

/** Close and clear the shared AudioContext (only call on unmount). */
export function closeAudioContext(): Promise<void> | void {
  if (audioContext && audioContext.state !== "closed") {
    const p = audioContext.close();
    audioContext = null;
    return p;
  }
  audioContext = null;
}
