import { PitchDetector as PitchyDetector } from "pitchy";
import { CLARITY_THRESHOLD } from "./types";
import { frequencyToNote, calculateCents } from "./noteMapping";
import { RingBuffer } from "./ringBuffer";
import type { PitchResult } from "./types";

export const INPUT_SIZE = 2048;
const RING_CAPACITY = 8192; // 4x INPUT_SIZE

let detector: PitchyDetector<Float32Array> | null = null;
let ringBuffer = new RingBuffer(RING_CAPACITY);

/**
 * Initialize the pitch detector with the given sample rate.
 */
export function initDetector(sampleRate: number): void {
  detector = PitchyDetector.forFloat32Array(INPUT_SIZE);
  detector.minVolumeDecibels = -30;
  ringBuffer.clear();
}

/**
 * Feed audio data into the ring buffer and detect pitch when we have enough.
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

  // Write into ring buffer (no allocation)
  ringBuffer.write(audioData);

  // Need at least INPUT_SIZE samples
  if (ringBuffer.availableRead < INPUT_SIZE) {
    return null;
  }

  // Peek at INPUT_SIZE samples (most recent window)
  const inputBuffer = ringBuffer.peek(INPUT_SIZE);
  // Consume all buffered data
  ringBuffer.clear();

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
  ringBuffer = new RingBuffer(RING_CAPACITY);
}
