import type { NoteEvent } from "@/types/music";

interface JudgmentResult {
  correct: boolean;
  nearest?: NoteEvent;
  centsOff?: number;
}

/**
 * Get notes that are sounding at the given original-score time.
 * A note is sounding if: startTime ≤ timeSec < startTime + duration
 */
export function expectedNotesAt(
  notes: NoteEvent[],
  timeSec: number,
): NoteEvent[] {
  return notes.filter(
    (note) => note.startTime <= timeSec && timeSec < note.startTime + note.duration,
  );
}

/**
 * Convert MIDI float to note name and octave (e.g., 60.5 → C4)
 */
function midiToNote(
  midiFloat: number,
): { name: string; octave: number } | null {
  const midiInt = Math.round(midiFloat);
  if (midiInt < 0 || midiInt > 127) return null;

  const noteNames = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const octave = Math.floor(midiInt / 12) - 1;
  const noteIndex = midiInt % 12;

  return {
    name: noteNames[noteIndex],
    octave,
  };
}

/**
 * Calculate cents difference between detected and expected pitch.
 * Positive = detected is higher. 1200 cents = 1 octave.
 */
function calculateCentsOff(detectedMidiFloat: number, expectedMidi: number): number {
  const semitones = detectedMidiFloat - expectedMidi;
  return Math.round(semitones * 100);
}

/**
 * Get pitch class (C, C#, D, ..., B) from MIDI note, ignoring octave.
 */
function getPitchClass(midiFloat: number): string | null {
  const note = midiToNote(midiFloat);
  if (!note) return null;
  return note.name;
}

/**
 * Judge if the detected pitch matches any expected note.
 * By default, octave-agnostic is OFF (must match the exact octave).
 * When octaveAgnostic is true, only the pitch class must match (any octave ok).
 */
export function judgePitch(
  detectedMidiFloat: number,
  expected: NoteEvent[],
  toleranceCents: number = 60,
  octaveAgnostic: boolean = false,
): JudgmentResult {
  if (expected.length === 0) {
    return { correct: false };
  }

  let bestMatch: {
    note: NoteEvent;
    centsOff: number;
    correct: boolean;
  } | null = null;

  const detectedNote = midiToNote(detectedMidiFloat);
  if (!detectedNote) {
    return { correct: false };
  }

  for (const expectedNote of expected) {
    const centsOff = calculateCentsOff(detectedMidiFloat, expectedNote.midiNumber);
    const correct = Math.abs(centsOff) <= toleranceCents;

    // If octaveAgnostic, also check if pitch classes match
    if (octaveAgnostic && !correct) {
      const expectedPitchClass = getPitchClass(expectedNote.midiNumber);
      const detectedPitchClass = getPitchClass(detectedMidiFloat);
      if (expectedPitchClass && detectedPitchClass && expectedPitchClass === detectedPitchClass) {
        // Pitch class matches, so consider correct in octave-agnostic mode
        bestMatch = {
          note: expectedNote,
          centsOff,
          correct: true,
        };
        break;
      }
    }

    // Track best (nearest) match regardless of correctness
    if (!bestMatch || Math.abs(centsOff) < Math.abs(bestMatch.centsOff)) {
      bestMatch = {
        note: expectedNote,
        centsOff,
        correct,
      };
    }
  }

  if (!bestMatch) {
    return { correct: false };
  }

  return {
    correct: bestMatch.correct,
    nearest: bestMatch.note,
    centsOff: bestMatch.centsOff,
  };
}

/**
 * Summarize accuracy from a list of judgment readings.
 * Returns percentage 0-100. Returns 0 if readings array is empty.
 */
export function summarizeAccuracy(readings: { correct: boolean }[]): number {
  if (readings.length === 0) return 0;
  const correctCount = readings.filter((r) => r.correct).length;
  return Math.round((correctCount / readings.length) * 100);
}
