/**
 * E2E Pitch Detection Test
 *
 * Tests the real pitchy library (no mocks) with synthetic sine waves
 * for the C major scale (도레미파솔라시도).
 */
import { generateSineWave } from "../helpers/generateSineWave";
import { noteToFrequency } from "../../client/lib/audio/noteMapping";
import {
  initDetector,
  detectPitch,
  destroyDetector,
} from "../../client/lib/audio/pitchDetector";
import { CLARITY_THRESHOLD } from "../../client/lib/audio/types";

const SAMPLE_RATE = 44100;
// Duration long enough for pitchy to analyze (need >= 2048 samples with good periodicity)
const DURATION = 0.15; // 6615 samples — well above INPUT_SIZE of 2048
const AMPLITUDE = 0.8;

const C_MAJOR_SCALE: Array<{ noteName: string; octave: number; label: string }> = [
  { noteName: "C", octave: 4, label: "도 (C4)" },
  { noteName: "D", octave: 4, label: "레 (D4)" },
  { noteName: "E", octave: 4, label: "미 (E4)" },
  { noteName: "F", octave: 4, label: "파 (F4)" },
  { noteName: "G", octave: 4, label: "솔 (G4)" },
  { noteName: "A", octave: 4, label: "라 (A4)" },
  { noteName: "B", octave: 4, label: "시 (B4)" },
  { noteName: "C", octave: 5, label: "도 (C5)" },
];

describe("E2E Pitch Detection — C Major Scale", () => {
  beforeEach(() => {
    destroyDetector();
    initDetector(SAMPLE_RATE);
  });

  afterAll(() => {
    destroyDetector();
  });

  it.each(C_MAJOR_SCALE)(
    "$label — detects correct note name and octave",
    ({ noteName, octave }) => {
      const frequency = noteToFrequency(noteName, octave);
      const wave = generateSineWave({
        frequency,
        sampleRate: SAMPLE_RATE,
        duration: DURATION,
        amplitude: AMPLITUDE,
      });

      const result = detectPitch(wave, SAMPLE_RATE);

      expect(result).not.toBeNull();
      expect(result!.note).toBe(noteName);
      expect(result!.octave).toBe(octave);
    },
  );

  it.each(C_MAJOR_SCALE)(
    "$label — cents deviation within ±10",
    ({ noteName, octave }) => {
      const frequency = noteToFrequency(noteName, octave);
      const wave = generateSineWave({
        frequency,
        sampleRate: SAMPLE_RATE,
        duration: DURATION,
        amplitude: AMPLITUDE,
      });

      const result = detectPitch(wave, SAMPLE_RATE);

      expect(result).not.toBeNull();
      expect(Math.abs(result!.cents)).toBeLessThanOrEqual(10);
    },
  );

  it.each(C_MAJOR_SCALE)(
    "$label — clarity meets threshold (>= ${CLARITY_THRESHOLD})",
    ({ noteName, octave }) => {
      const frequency = noteToFrequency(noteName, octave);
      const wave = generateSineWave({
        frequency,
        sampleRate: SAMPLE_RATE,
        duration: DURATION,
        amplitude: AMPLITUDE,
      });

      const result = detectPitch(wave, SAMPLE_RATE);

      expect(result).not.toBeNull();
      expect(result!.clarity).toBeGreaterThanOrEqual(CLARITY_THRESHOLD);
    },
  );

  it.each(C_MAJOR_SCALE)(
    "$label — detected frequency within 1%% of target",
    ({ noteName, octave }) => {
      const targetFreq = noteToFrequency(noteName, octave);
      const wave = generateSineWave({
        frequency: targetFreq,
        sampleRate: SAMPLE_RATE,
        duration: DURATION,
        amplitude: AMPLITUDE,
      });

      const result = detectPitch(wave, SAMPLE_RATE);

      expect(result).not.toBeNull();
      const deviation = Math.abs(result!.frequency - targetFreq) / targetFreq;
      expect(deviation).toBeLessThanOrEqual(0.01);
    },
  );

  describe("streaming simulation", () => {
    it.each(C_MAJOR_SCALE)(
      "$label — 1024+1024 chunks: first null, second detects",
      ({ noteName, octave }) => {
        const frequency = noteToFrequency(noteName, octave);
        const wave = generateSineWave({
          frequency,
          sampleRate: SAMPLE_RATE,
          duration: DURATION,
          amplitude: AMPLITUDE,
        });

        // Split into two 1024-sample chunks
        const chunk1 = wave.slice(0, 1024);
        const chunk2 = wave.slice(1024, 2048);

        const result1 = detectPitch(chunk1, SAMPLE_RATE);
        expect(result1).toBeNull(); // Not enough samples yet

        const result2 = detectPitch(chunk2, SAMPLE_RATE);
        expect(result2).not.toBeNull();
        expect(result2!.note).toBe(noteName);
        expect(result2!.octave).toBe(octave);
      },
    );
  });

  describe("edge cases", () => {
    it("returns null for very low amplitude signal (0.001)", () => {
      const wave = generateSineWave({
        frequency: 440,
        sampleRate: SAMPLE_RATE,
        duration: DURATION,
        amplitude: 0.001,
      });

      const result = detectPitch(wave, SAMPLE_RATE);

      // Should be null because signal is below minVolumeDecibels (-30dB)
      expect(result).toBeNull();
    });
  });
});
