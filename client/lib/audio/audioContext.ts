/**
 * audioContext — shared AudioContext singleton + master output bus.
 *
 * Extracted from synthEngine.ts to break the require cycles:
 *   synthEngine → pianoSamples → synthEngine
 *   synthEngine → samplePlayer → synthEngine
 *
 * Both pianoSamples and samplePlayer now import from here, not from synthEngine.
 *
 * Every scheduled note routes through a single master GainNode and registers
 * its source node here. That lets stopAllSources() silence playback instantly
 * (a short declick fade on the bus + a hard stop on every live source) instead
 * of relying on AudioContext.suspend(), which only freezes the render thread and
 * lets the OS output buffer drain — leaving an audible tail after Stop/Pause.
 */
import { AudioContext, GainNode } from "react-native-audio-api";

/** Anything we can force-stop: oscillators and buffer sources. */
interface StoppableSource {
  stop: (when?: number) => void;
}

interface TrackedSource {
  node: StoppableSource;
  /** AudioContext time (seconds) at which this source ends naturally. */
  endTime: number;
}

/** Default declick fade — long enough to avoid a click, short enough to feel instant. */
const STOP_FADE_SEC = 0.012;

/**
 * Sources that ended more than this long ago are assumed already torn down by the
 * audio engine; calling stop() on them only throws (caught below), so we skip them.
 */
const STOPPED_SOURCE_GRACE_SEC = 0.05;

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let activeSources: TrackedSource[] = [];

/** Get or create the shared AudioContext. Rebuilds the master bus on (re)creation. */
export function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContext();
    masterGain = null; // belongs to the old context — rebind lazily
    activeSources = [];
  }
  return audioContext;
}

/**
 * Get (or lazily create) the master output bus. All notes connect here instead
 * of directly to ctx.destination, so a single fade can silence everything.
 */
export function getMasterGain(): GainNode {
  const ctx = getAudioContext();
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1, ctx.currentTime);
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}

/**
 * Register a scheduled source so stopAllSources() can hard-stop it.
 * @param node - The oscillator or buffer source.
 * @param endTime - AudioContext time (seconds) when the note ends naturally.
 */
export function registerSource(node: StoppableSource, endTime: number): void {
  activeSources.push({ node, endTime });
}

/** Restore the bus to full volume. Call before scheduling fresh playback. */
export function resetMasterGain(): void {
  const ctx = getAudioContext();
  const mg = getMasterGain();
  const now = ctx.currentTime;
  // cancelAndHoldAtTime (not cancelScheduledValues) reliably cancels a fade that is
  // still in progress — a loop restart / seek / tempo change schedules new notes only
  // ~1ms into the 12ms stop fade. Without it the ramp-to-0 survives and the freshly
  // scheduled notes play silent.
  mg.gain.cancelAndHoldAtTime(now);
  mg.gain.setValueAtTime(1, now);
}

/**
 * Silence playback immediately: a short declick fade on the master bus plus a
 * hard stop on every live source (which also cancels future-scheduled notes,
 * since stop(t) with t ≤ a source's start makes it produce no sound).
 */
export function stopAllSources(fadeSec: number = STOP_FADE_SEC): void {
  const ctx = getAudioContext();
  const mg = getMasterGain();
  const now = ctx.currentTime;
  const fadeEnd = now + fadeSec;

  // cancelAndHoldAtTime freezes the bus at its current value (even mid-ramp, e.g. a
  // second stop during a fade), giving the ramp-to-silence a clean starting anchor.
  mg.gain.cancelAndHoldAtTime(now);
  mg.gain.linearRampToValueAtTime(0, fadeEnd);

  for (const { node, endTime } of activeSources) {
    // Skip sources that ended a while ago — stopping them only throws.
    if (endTime > now - STOPPED_SOURCE_GRACE_SEC) {
      try {
        node.stop(fadeEnd);
      } catch {
        // already stopped — harmless
      }
    }
  }
  activeSources = [];
}

/** Drop sources whose note has already ended, keeping the registry bounded. */
export function pruneEndedSources(): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  activeSources = activeSources.filter((s) => s.endTime > now);
}

/** Ensure the AudioContext is running (must be called after a user gesture). */
export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

/** Suspend the shared AudioContext (kept for OS/background power management). */
export async function suspendAudioContext(): Promise<void> {
  if (audioContext && audioContext.state === "running") {
    await audioContext.suspend();
  }
}

/** Close and clear the shared AudioContext + bus (only call on unmount). */
export function closeAudioContext(): Promise<void> | void {
  masterGain = null;
  activeSources = [];
  if (audioContext && audioContext.state !== "closed") {
    const p = audioContext.close();
    audioContext = null;
    return p;
  }
  audioContext = null;
}
