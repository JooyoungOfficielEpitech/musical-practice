import { useState, useCallback, useRef } from "react";
import type { SheetMusic } from "@/lib/storage";
import { TRANSPOSE_MIN, TRANSPOSE_MAX } from "@/lib/audio/playbackNotes";

export interface PlaybackOptionsState {
  /** Per-part gain 0..1 keyed by part id; missing parts default to 1. */
  partVolumes: Record<string, number>;
  setPartVolume: (partId: string, volume: number) => void;
  /** Semitone offset applied to playback audio (score display is unchanged). */
  transpose: number;
  setTranspose: (semitones: number) => void;
  metronomeOn: boolean;
  toggleMetronome: () => void;
}

/**
 * Playback mix options for one score: per-part volume, transposition, and the
 * metronome toggle. Volume/transpose persist per sheet (like tempo); the
 * metronome is session-only.
 */
export function usePlaybackOptions(
  sheet: SheetMusic | undefined,
  patchSheet: (id: string, patch: Partial<SheetMusic>) => Promise<void>,
): PlaybackOptionsState {
  const [partVolumes, setPartVolumes] = useState<Record<string, number>>(
    sheet?.partVolumes ?? {},
  );
  const [transpose, setTransposeState] = useState<number>(sheet?.savedTranspose ?? 0);
  const [metronomeOn, setMetronomeOn] = useState(false);

  // Latest volumes for the setter — avoids a stale closure without re-creating
  // the callback on every volume change.
  const partVolumesRef = useRef(partVolumes);
  partVolumesRef.current = partVolumes;

  const sheetId = sheet?.id;

  const setPartVolume = useCallback(
    (partId: string, volume: number) => {
      const clamped = Math.max(0, Math.min(1, volume));
      const next = { ...partVolumesRef.current, [partId]: clamped };
      setPartVolumes(next);
      if (sheetId) patchSheet(sheetId, { partVolumes: next }).catch(() => {});
    },
    [sheetId, patchSheet],
  );

  const setTranspose = useCallback(
    (semitones: number) => {
      const clamped = Math.max(
        TRANSPOSE_MIN,
        Math.min(TRANSPOSE_MAX, Math.round(semitones)),
      );
      setTransposeState(clamped);
      if (sheetId) patchSheet(sheetId, { savedTranspose: clamped }).catch(() => {});
    },
    [sheetId, patchSheet],
  );

  const toggleMetronome = useCallback(() => setMetronomeOn((v) => !v), []);

  return { partVolumes, setPartVolume, transpose, setTranspose, metronomeOn, toggleMetronome };
}
