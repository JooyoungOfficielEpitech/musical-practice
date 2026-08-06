/**
 * Tracks active practice time and records sessions.
 * Accumulates time only while isPlaying (wall-clock pauses don't count) and
 * auto-finishes on unmount so leaving the screen never loses a session.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { recordSession } from "@/lib/practiceSessionRecorder";

interface TrackerArgs {
  isPlaying: boolean;
  sheet: { id: string; title: string } | undefined;
  /** Sampled when a session is finished without an explicit accuracy (unmount). */
  getFinishAccuracy?: () => number | undefined;
}

export interface UseTrackerReturn {
  elapsedActiveSec: number;
  finishSession: (accuracy?: number) => Promise<void>;
}

export function usePracticeSessionTracker({
  isPlaying,
  sheet,
  getFinishAccuracy,
}: TrackerArgs): UseTrackerReturn {
  const [elapsedActiveSec, setElapsedActiveSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sheetRef = useRef(sheet);
  const elapsedRef = useRef(0);
  const getFinishAccuracyRef = useRef(getFinishAccuracy);
  getFinishAccuracyRef.current = getFinishAccuracy;

  // A different score starts a fresh session clock.
  useEffect(() => {
    if (sheetRef.current?.id !== sheet?.id) {
      setElapsedActiveSec(0);
      elapsedRef.current = 0;
    }
    sheetRef.current = sheet;
  }, [sheet]);

  useEffect(() => {
    if (!isPlaying) return;
    timerRef.current = setInterval(() => {
      setElapsedActiveSec((prev) => {
        const next = prev + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying]);

  const finishSession = useCallback(async (accuracy?: number): Promise<void> => {
    if (!sheetRef.current || elapsedRef.current === 0) return;
    const durationSec = elapsedRef.current;
    // Reset first so a concurrent unmount can't double-record the session.
    setElapsedActiveSec(0);
    elapsedRef.current = 0;
    await recordSession({
      sheetId: sheetRef.current.id,
      sheetTitle: sheetRef.current.title,
      durationSec,
      accuracy,
    });
  }, []);

  // Auto-finish when the practice screen unmounts.
  const finishRef = useRef(finishSession);
  finishRef.current = finishSession;
  useEffect(() => {
    return () => {
      finishRef.current(getFinishAccuracyRef.current?.()).catch(() => {});
    };
  }, []);

  return { elapsedActiveSec, finishSession };
}
