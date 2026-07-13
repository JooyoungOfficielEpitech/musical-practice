/**
 * useSmoothProgress — display-level smoothing for coarse server progress.
 *
 * The OMR worker reports progress per completed page, so a short score jumps
 * 0 → 45 → 90 in big steps minutes apart. This hook renders a value that
 * (a) eases toward the latest server value instead of teleporting,
 * (b) creeps forward slowly between updates so the bar always feels alive,
 *     capped a little above the last real value (never fakes completion),
 * (c) snaps to 100 quickly when the job finishes,
 * (d) never moves backwards.
 */
import { useEffect, useRef, useState } from "react";

const TICK_MS = 400;
/** How far past the last real value the creep may wander. */
const CREEP_HEADROOM = 12;
/** Absolute ceiling for creeping — only a real 100 completes the bar. */
const CREEP_CAP = 94;
/** Per-tick fraction of the remaining gap when catching up to a real value. */
const CATCH_UP_RATE = 0.25;
/** Per-tick fraction of the remaining creep headroom. */
const CREEP_RATE = 0.015;

export function useSmoothProgress(actual: number, isActive: boolean): number {
  const [displayed, setDisplayed] = useState(actual);
  const actualRef = useRef(actual);
  actualRef.current = actual;

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      setDisplayed((prev) => {
        const real = actualRef.current;
        if (real >= 100) {
          // Finish fast and cleanly.
          return Math.min(100, prev + Math.max(4, (100 - prev) * 0.35));
        }
        if (prev < real) {
          // Server moved ahead — ease toward it.
          return Math.min(real, prev + Math.max(1, (real - prev) * CATCH_UP_RATE));
        }
        // Between updates — creep toward a modest ceiling.
        const ceiling = Math.min(real + CREEP_HEADROOM, CREEP_CAP);
        if (prev >= ceiling) return prev;
        return Math.min(ceiling, prev + Math.max(0.05, (ceiling - prev) * CREEP_RATE));
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [isActive]);

  return Math.min(100, Math.round(displayed));
}
