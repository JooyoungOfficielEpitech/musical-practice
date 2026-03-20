import { useState, useRef, useEffect, useCallback } from "react";

interface UseTimerOptions {
  onTimeUpdate?: (seconds: number) => void;
}

export function useTimer(options?: UseTimerOptions) {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpdateRef = useRef(options?.onTimeUpdate);

  useEffect(() => {
    onTimeUpdateRef.current = options?.onTimeUpdate;
  }, [options?.onTimeUpdate]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          const next = prev + 1;
          onTimeUpdateRef.current?.(next);
          return next;
        });
      }, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [isRunning]);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    setSeconds(0);
  }, []);

  const reset = useCallback(() => {
    setSeconds(0);
  }, []);

  const formatTime = useCallback((s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return { seconds, isRunning, start, pause, stop, reset, formatTime };
}
