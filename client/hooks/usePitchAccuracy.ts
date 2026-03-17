import { useState, useCallback, useRef } from "react";
import { CENTS_THRESHOLD } from "@/lib/audio/types";
import type { PitchResult, PitchAccuracy } from "@/lib/audio/types";

interface UsePitchAccuracyReturn extends PitchAccuracy {
  addReading: (pitch: PitchResult) => void;
  reset: () => void;
}

export function usePitchAccuracy(): UsePitchAccuracyReturn {
  const [accuracy, setAccuracy] = useState<PitchAccuracy>({
    sessionAccuracy: 0,
    totalReadings: 0,
    correctReadings: 0,
  });

  const totalRef = useRef(0);
  const correctRef = useRef(0);

  const addReading = useCallback((pitch: PitchResult) => {
    totalRef.current += 1;
    if (Math.abs(pitch.cents) <= CENTS_THRESHOLD) {
      correctRef.current += 1;
    }

    const total = totalRef.current;
    const correct = correctRef.current;
    const sessionAccuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    setAccuracy({
      sessionAccuracy,
      totalReadings: total,
      correctReadings: correct,
    });
  }, []);

  const reset = useCallback(() => {
    totalRef.current = 0;
    correctRef.current = 0;
    setAccuracy({
      sessionAccuracy: 0,
      totalReadings: 0,
      correctReadings: 0,
    });
  }, []);

  return {
    ...accuracy,
    addReading,
    reset,
  };
}
