import { useMemo, type RefObject } from "react";
import { buildPlaybackNotes, mergeNoteEvents } from "@/lib/audio/playbackNotes";
import { buildBeatGrid, generateMetronomeEvents } from "@/lib/audio/beatGrid";
import type { PlaybackOptionsState } from "@/hooks/usePlaybackOptions";
import type { NoteEvent, NoteSequence, PartInfo } from "@/types/music";

export interface UsePlaybackNotesArgs {
  noteSequence: NoteSequence;
  /** Ref written when the XML is parsed — always in lockstep with noteSequence. */
  notePartIndicesRef: RefObject<number[]>;
  partInfos: PartInfo[];
  visiblePartIds: Set<string>;
  playback: PlaybackOptionsState;
  musicXmlContent: string | null;
}

/**
 * The full playback pipeline: part filter → per-part volume → transpose, plus
 * metronome clicks (same shared bar grid as the notes) when enabled.
 */
export function usePlaybackNotes({
  noteSequence,
  notePartIndicesRef,
  partInfos,
  visiblePartIds,
  playback,
  musicXmlContent,
}: UsePlaybackNotesArgs): NoteEvent[] {
  const playbackNotes = useMemo(
    () =>
      buildPlaybackNotes({
        notes: noteSequence,
        notePartIndices: notePartIndicesRef.current ?? [],
        partInfos,
        visiblePartIds,
        partVolumes: playback.partVolumes,
        transposeSemitones: playback.transpose,
      }),
    // notePartIndicesRef is written together with noteSequence — the
    // noteSequence dep covers it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [noteSequence, visiblePartIds, partInfos, playback.partVolumes, playback.transpose],
  );

  const beatGrid = useMemo(
    () => (musicXmlContent ? buildBeatGrid(musicXmlContent) : null),
    [musicXmlContent],
  );

  return useMemo(() => {
    if (!playback.metronomeOn || !beatGrid) return playbackNotes;
    return mergeNoteEvents(playbackNotes, generateMetronomeEvents(beatGrid));
  }, [playbackNotes, playback.metronomeOn, beatGrid]);
}
