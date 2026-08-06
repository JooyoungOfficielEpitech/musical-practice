import { useState, useRef, useCallback, useEffect } from "react";
import {
  makeLoopRange,
  scaledToOriginalMs,
  originalToScaledMs,
} from "@/lib/audio/transportMath";
import type { UseSynthPlayerReturn } from "@/hooks/useSynthPlayer";

export interface LoopControlsState {
  /** True while waiting for the B point (A is set). */
  armed: boolean;
  /** Loop button: idle → arm A at current position → set B at current position → clear. */
  handleLoopButton: () => void;
  /**
   * Score note tap hook-in. While armed, the first tap moves A to that note and
   * the second tap sets B (activating the loop). Returns true when the tap was
   * consumed — the caller must then NOT seek.
   */
  handleScoreTap: (originalTimeSec: number) => boolean;
}

/**
 * A–B loop state machine on top of the synth player. Anchors are stored in
 * original-score milliseconds so an active loop survives tempo changes; the
 * player's range is always tempo-scaled.
 */
export function useLoopControls(synthPlayer: UseSynthPlayerReturn): LoopControlsState {
  const { positionMs, durationMs, tempo, loopRange } = synthPlayer;
  const [armed, setArmed] = useState(false);
  // Anchor A in original-score ms; tappedRef marks that A came from a score tap
  // (so the next tap completes the range instead of re-overriding A).
  const anchorRef = useRef<number | null>(null);
  const tappedRef = useRef(false);
  const loopOriginalRef = useRef<{ aMs: number; bMs: number } | null>(null);

  const activate = useCallback(
    (aOriginalMs: number, bOriginalMs: number): boolean => {
      const range = makeLoopRange(
        originalToScaledMs(aOriginalMs, tempo),
        originalToScaledMs(bOriginalMs, tempo),
        durationMs,
      );
      if (!range) return false;
      loopOriginalRef.current = {
        aMs: scaledToOriginalMs(range.startMs, tempo),
        bMs: scaledToOriginalMs(range.endMs, tempo),
      };
      synthPlayer.setLoopRange(range);
      anchorRef.current = null;
      tappedRef.current = false;
      setArmed(false);
      return true;
    },
    [tempo, durationMs, synthPlayer],
  );

  const handleLoopButton = useCallback(() => {
    if (loopRange) {
      synthPlayer.clearLoopRange();
      loopOriginalRef.current = null;
      anchorRef.current = null;
      tappedRef.current = false;
      setArmed(false);
      return;
    }
    if (anchorRef.current === null) {
      anchorRef.current = scaledToOriginalMs(positionMs, tempo);
      tappedRef.current = false;
      setArmed(true);
      return;
    }
    // Second press: B = current position. Too-short ranges keep us armed.
    activate(anchorRef.current, scaledToOriginalMs(positionMs, tempo));
  }, [loopRange, positionMs, tempo, synthPlayer, activate]);

  const handleScoreTap = useCallback(
    (originalTimeSec: number): boolean => {
      if (!armed || anchorRef.current === null) return false;
      const tapMs = originalTimeSec * 1000;
      if (!tappedRef.current) {
        // First tap re-anchors A on the tapped note.
        anchorRef.current = tapMs;
        tappedRef.current = true;
        return true;
      }
      activate(anchorRef.current, tapMs);
      return true;
    },
    [armed, activate],
  );

  // Rescale the active loop when the tempo changes.
  const prevTempoRef = useRef(tempo);
  useEffect(() => {
    if (prevTempoRef.current === tempo) return;
    prevTempoRef.current = tempo;
    const original = loopOriginalRef.current;
    if (!original || !loopRange) return;
    const range = makeLoopRange(
      originalToScaledMs(original.aMs, tempo),
      originalToScaledMs(original.bMs, tempo),
      durationMs,
    );
    if (range) synthPlayer.setLoopRange(range);
  }, [tempo, durationMs, loopRange, synthPlayer]);

  return { armed, handleLoopButton, handleScoreTap };
}
