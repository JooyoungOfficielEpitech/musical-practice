import { PitchDetector as PitchyDetector } from "pitchy";
import { CLARITY_THRESHOLD } from "./types";
import { frequencyToNote, calculateCents } from "./noteMapping";
import type { PitchResult } from "./types";

const INPUT_SIZE = 2048;

let detector: PitchyDetector<Float32Array> | null = null;
// Accumulation buffer for when chunks arrive smaller than INPUT_SIZE
let accumulator = new Float32Array(0);

/**
 * Initialize the pitch detector with the given sample rate.
 */
export function initDetector(sampleRate: number): void {
  detector = PitchyDetector.forFloat32Array(INPUT_SIZE);
  detector.minVolumeDecibels = -30;
  accumulator = new Float32Array(0);
}

/**
 * Feed audio data into the accumulator and detect pitch when we have enough.
 * Returns null if not enough data yet or clarity is below threshold.
 */
export function detectPitch(
  audioData: Float32Array,
  sampleRate: number,
): PitchResult | null {
  if (!detector) {
    initDetector(sampleRate);
  }

  // Skip empty buffers entirely
  if (!audioData || audioData.length === 0) {
    return null;
  }

  // Accumulate incoming audio data
  const newAccumulator = new Float32Array(accumulator.length + audioData.length);
  newAccumulator.set(accumulator);
  newAccumulator.set(audioData, accumulator.length);
  accumulator = newAccumulator;

  // Need at least INPUT_SIZE samples
  if (accumulator.length < INPUT_SIZE) {
    return null;
  }

  // Take exactly INPUT_SIZE samples from the end (most recent data)
  const inputBuffer = accumulator.slice(accumulator.length - INPUT_SIZE);
  // Discard processed data — only keep samples that arrived after the window
  accumulator = new Float32Array(0);

  try {
    const [frequency, clarity] = detector!.findPitch(inputBuffer, sampleRate);

    if (clarity < CLARITY_THRESHOLD || frequency <= 0) {
      return null;
    }

    const noteInfo = frequencyToNote(frequency);
    if (!noteInfo) return null;

    const cents = calculateCents(frequency, noteInfo.frequency);

    return {
      frequency,
      note: noteInfo.name,
      octave: noteInfo.octave,
      cents,
      clarity,
    };
  } catch (e) {
    console.warn("Pitch detection error:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Clean up the detector instance.
 */
export function destroyDetector(): void {
  detector = null;
  accumulator = new Float32Array(0);
}
