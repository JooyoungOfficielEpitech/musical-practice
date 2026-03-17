import type { NoteInfo } from "./types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

const A4_FREQUENCY = 440;
const A4_MIDI = 69;

// Human singing voice range (approximately E2 to C6)
const MIN_FREQUENCY = 80;
const MAX_FREQUENCY = 1100;

/**
 * Convert a frequency (Hz) to the nearest note info.
 * Returns note name, octave, and the exact frequency of that note.
 */
export function frequencyToNote(frequency: number): NoteInfo | null {
  if (frequency <= 0 || !isFinite(frequency)) return null;
  if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) return null;

  const midiNote = 12 * Math.log2(frequency / A4_FREQUENCY) + A4_MIDI;
  const roundedMidi = Math.round(midiNote);
  const noteIndex = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  const name = NOTE_NAMES[noteIndex];

  return {
    name,
    octave,
    frequency: noteToFrequency(name, octave),
  };
}

/**
 * Convert a note name and octave to frequency (Hz).
 * A4 = 440Hz standard tuning.
 */
export function noteToFrequency(noteName: string, octave: number): number {
  const noteIndex = NOTE_NAMES.indexOf(noteName as (typeof NOTE_NAMES)[number]);
  if (noteIndex === -1) return 0;

  const midiNote = (octave + 1) * 12 + noteIndex;
  return A4_FREQUENCY * Math.pow(2, (midiNote - A4_MIDI) / 12);
}

/**
 * Calculate the cents difference between a detected frequency and a target frequency.
 * Positive = sharp, negative = flat.
 */
export function calculateCents(detectedFreq: number, targetFreq: number): number {
  if (detectedFreq <= 0 || targetFreq <= 0) return 0;
  return 1200 * Math.log2(detectedFreq / targetFreq);
}

/**
 * Get the target frequency for a given key string (e.g., "C", "F#").
 * Defaults to octave 4.
 */
export function keyToFrequency(key: string, octave = 4): number {
  return noteToFrequency(key, octave);
}
