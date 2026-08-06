import { useState, useRef, useCallback, useEffect } from "react";
import { usePitchDetection } from "./usePitchDetection";
import { expectedNotesAt, judgePitch, summarizeAccuracy } from "@/lib/audio/pitchScoring";
import { CLARITY_THRESHOLD } from "@/lib/audio/types";
import type { NoteEvent } from "@/types/music";
import type { PitchResult } from "@/lib/audio/types";

interface JudgmentReading {
  correct: boolean;
}

interface LivePitchInfo extends PitchResult {
  correct: boolean;
}

interface UsePitchPracticeOptions {
  notes: NoteEvent[];
  getPositionSec: () => number;
  toleranceCents?: number;
  octaveAgnostic?: boolean;
}

interface UsePitchPracticeReturn {
  active: boolean;
  activate: () => void;
  deactivate: () => void;
  reset: () => void;
  livePitch: LivePitchInfo | null;
  accuracyPercent: number;
}

export function usePitchPractice(options: UsePitchPracticeOptions): UsePitchPracticeReturn {
  const [active, setActive] = useState(false);
  const [livePitch, setLivePitch] = useState<LivePitchInfo | null>(null);
  const [accuracyPercent, setAccuracyPercent] = useState(0);

  const readingsRef = useRef<JudgmentReading[]>([]);
  const lastPositionRef = useRef(-1); // Track last position to avoid duplicate readings

  const { currentPitch, startListening, stopListening } = usePitchDetection();

  const reset = useCallback(() => {
    readingsRef.current = [];
    setAccuracyPercent(0);
    setLivePitch(null);
    lastPositionRef.current = -1;
  }, []);

  const activate = useCallback(() => {
    reset();
    setActive(true);
    startListening();
  }, [reset, startListening]);

  const deactivate = useCallback(() => {
    setActive(false);
    stopListening();
    reset();
  }, [stopListening, reset]);

  // Process pitch readings when active
  useEffect(() => {
    if (!active || !currentPitch) {
      return;
    }

    // Ignore low-clarity readings
    if (currentPitch.clarity < CLARITY_THRESHOLD) {
      return;
    }

    const positionSec = options.getPositionSec();

    // Get notes expected at current position
    const expectedNotes = expectedNotesAt(options.notes, positionSec);

    // If no expected notes (silence / rest), don't judge
    if (expectedNotes.length === 0) {
      return;
    }

    // Avoid duplicate judgments at the same position
    // Round to 10ms to allow for minor playback jitter
    const positionRounded = Math.round(positionSec * 100) / 100;
    if (positionRounded === lastPositionRef.current) {
      return;
    }
    lastPositionRef.current = positionRounded;

    // Convert PitchResult to MIDI float for judgment
    // Note names: C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11
    const noteOffsets: Record<string, number> = {
      C: 0,
      "C#": 1,
      D: 2,
      "D#": 3,
      E: 4,
      F: 5,
      "F#": 6,
      G: 7,
      "G#": 8,
      A: 9,
      "A#": 10,
      B: 11,
    };
    const noteOffset = noteOffsets[currentPitch.note] ?? 0;
    const midiFloat = (currentPitch.octave + 1) * 12 + noteOffset + currentPitch.cents / 100;

    // Judge the pitch
    const judgment = judgePitch(
      midiFloat,
      expectedNotes,
      options.toleranceCents ?? 60,
      options.octaveAgnostic ?? false,
    );

    // Add reading
    readingsRef.current.push({ correct: judgment.correct });

    // Update live pitch with correctness flag
    setLivePitch({
      ...currentPitch,
      correct: judgment.correct,
    });

    // Update accuracy
    const accuracy = summarizeAccuracy(readingsRef.current);
    setAccuracyPercent(accuracy);
  }, [active, currentPitch, options]);

  return {
    active,
    activate,
    deactivate,
    reset,
    livePitch,
    accuracyPercent,
  };
}
