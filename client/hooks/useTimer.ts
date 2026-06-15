import { useState, useRef, useEffect, useCallback } from "react";
import { AppState, type AppStateStatus } from "react-native";

interface UseTimerOptions {
  onTimeUpdate?: (seconds: number) => void;
}

export function useTimer(options?: UseTimerOptions) {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpdateRef = useRef(options?.onTimeUpdate);
  const accumulatedSecondsRef = useRef(0);
  const wallClockStartRef = useRef<number | null>(null);
  const wasRunningWhenBackgroundedRef = useRef(false);

  useEffect(() => {
    onTimeUpdateRef.current = options?.onTimeUpdate;
  }, [options?.onTimeUpdate]);

  // Handle AppState changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "background" && isRunning) {
        // App going to background while timer is running
        wasRunningWhenBackgroundedRef.current = true;
        setIsRunning(false);
      } else if (state === "active" && wasRunningWhenBackgroundedRef.current) {
        // App coming back to foreground, resume if it was running before
        wasRunningWhenBackgroundedRef.current = false;
        setIsRunning(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isRunning]);

  // Main interval effect: compute elapsed time based on wall-clock
  useEffect(() => {
    if (isRunning) {
      if (wallClockStartRef.current === null) {
        // Timer just started (or resumed): set the wall-clock reference
        wallClockStartRef.current = Date.now();
      }

      intervalRef.current = setInterval(() => {
        if (wallClockStartRef.current !== null) {
          const wallClockElapsed = Math.floor((Date.now() - wallClockStartRef.current) / 1000);
          const total = accumulatedSecondsRef.current + wallClockElapsed;
          setSeconds(total);
          onTimeUpdateRef.current?.(total);
        }
      }, 1000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      // Timer stopped: accumulate elapsed time before stopping
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (wallClockStartRef.current !== null) {
        const wallClockElapsed = Math.floor((Date.now() - wallClockStartRef.current) / 1000);
        accumulatedSecondsRef.current += wallClockElapsed;
        wallClockStartRef.current = null;
      }
    }
  }, [isRunning]);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    wasRunningWhenBackgroundedRef.current = false;
    setIsRunning(false);
  }, []);

  const stop = useCallback(() => {
    wasRunningWhenBackgroundedRef.current = false;
    setIsRunning(false);
    setSeconds(0);
    accumulatedSecondsRef.current = 0;
    wallClockStartRef.current = null;
  }, []);

  const reset = useCallback(() => {
    setSeconds(0);
    accumulatedSecondsRef.current = 0;
    wallClockStartRef.current = null;
  }, []);

  const formatTime = useCallback((s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return { seconds, isRunning, start, pause, stop, reset, formatTime };
}
