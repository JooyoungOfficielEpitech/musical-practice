import { useState, useRef, useCallback, useMemo, type RefObject } from "react";
import { usePitchPractice } from "@/hooks/usePitchPractice";
import { useAudioPermission } from "@/hooks/useAudioPermission";
import { useNoteEditor, type NoteEditorState } from "@/hooks/useNoteEditor";
import { usePracticeSessionTracker } from "@/hooks/usePracticeSessionTracker";
import { buildPlaybackNotes } from "@/lib/audio/playbackNotes";
import { computeNoteOccurrence } from "@/lib/audio/noteEditLocator";
import { saveEditedXml } from "@/lib/audio/editedXmlStore";
import type { PlaybackOptionsState } from "@/hooks/usePlaybackOptions";
import type { UseSynthPlayerReturn } from "@/hooks/useSynthPlayer";
import type { SheetMusic } from "@/lib/storage";
import type { NoteSequence, PartInfo } from "@/types/music";
import type { PitchResult } from "@/lib/audio/types";

const EDIT_TAP_TOLERANCE_MS = 60;
const TOAST_DURATION_MS = 3500;

export interface PracticeExtrasArgs {
  sheet: SheetMusic | undefined;
  patchSheet: (id: string, patch: Partial<SheetMusic>) => Promise<void>;
  noteSequence: NoteSequence;
  notePartIndicesRef: RefObject<number[]>;
  partInfos: PartInfo[];
  visiblePartIds: Set<string>;
  playback: PlaybackOptionsState;
  synthPlayer: UseSynthPlayerReturn;
  musicXmlContent: string | null;
  /** Called with the edited XML — owner re-parses and re-renders the score. */
  onXmlEdited: (xml: string) => void;
}

export interface PracticeExtrasState {
  singAlong: {
    active: boolean;
    livePitch: (PitchResult & { correct: boolean }) | null;
    accuracyPercent: number;
    error: string | null;
    /** More than one part is audible — scoring is loose; suggest soloing. */
    multiPartWarning: boolean;
    toggle: () => Promise<void>;
  };
  editor: NoteEditorState & {
    editMode: boolean;
    toggleEditMode: () => void;
    /** Consumes a score tap while in edit mode. Returns true when consumed. */
    handleEditTap: (timeMs: number | null) => boolean;
  };
  sessionToast: { visible: boolean; durationSec: number; accuracy?: number };
}

/**
 * Practice extras: sing-along pitch scoring, fix-a-note editing, and session
 * recording — composed here so usePracticeDetail stays a thin root.
 */
export function usePracticeExtras(args: PracticeExtrasArgs): PracticeExtrasState {
  const {
    sheet, patchSheet, noteSequence, notePartIndicesRef, partInfos,
    visiblePartIds, playback, synthPlayer, musicXmlContent, onXmlEdited,
  } = args;

  // ── Sing-along scoring: expected notes = the visible parts, transposed the
  // same way playback is (the singer follows what they hear).
  const scoringNotes = useMemo(
    () =>
      buildPlaybackNotes({
        notes: noteSequence,
        notePartIndices: notePartIndicesRef.current ?? [],
        partInfos,
        visiblePartIds,
        transposeSemitones: playback.transpose,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [noteSequence, partInfos, visiblePartIds, playback.transpose],
  );

  const positionSecRef = useRef(0);
  positionSecRef.current = (synthPlayer.positionMs * synthPlayer.tempo) / 1000;
  const getPositionSec = useCallback(() => positionSecRef.current, []);

  const permission = useAudioPermission();
  const pitch = usePitchPractice({
    notes: scoringNotes,
    getPositionSec,
    octaveAgnostic: true, // hobby singers routinely sing octave-shifted
  });

  // Last non-zero accuracy of this visit — survives deactivate() resets so the
  // session record on unmount still carries it.
  const lastAccuracyRef = useRef<number | undefined>(undefined);
  if (pitch.active && pitch.accuracyPercent > 0) {
    lastAccuracyRef.current = pitch.accuracyPercent;
  }

  const [sessionToast, setSessionToast] = useState<PracticeExtrasState["sessionToast"]>({
    visible: false, durationSec: 0,
  });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Accuracy is stored/displayed as a 0..1 fraction everywhere downstream
  // (PracticeSession.accuracy, SheetCard chip, toast) — convert once here.
  const session = usePracticeSessionTracker({
    isPlaying: synthPlayer.isPlaying,
    sheet: sheet ? { id: sheet.id, title: sheet.title } : undefined,
    getFinishAccuracy: () =>
      lastAccuracyRef.current !== undefined ? lastAccuracyRef.current / 100 : undefined,
  });

  const toggleSingAlong = useCallback(async () => {
    if (pitch.active) {
      const accuracy = pitch.accuracyPercent;
      pitch.deactivate();
      if (accuracy > 0) {
        setSessionToast({
          visible: true,
          durationSec: session.elapsedActiveSec,
          accuracy: accuracy / 100,
        });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(
          () => setSessionToast((t) => ({ ...t, visible: false })),
          TOAST_DURATION_MS,
        );
      }
      return;
    }
    const granted = permission.hasPermission || (await permission.requestPermission());
    if (!granted) return;
    pitch.activate();
  }, [pitch, permission, session.elapsedActiveSec]);

  // ── Fix-a-note editing.
  const [editMode, setEditMode] = useState(false);
  const toggleEditMode = useCallback(() => setEditMode((v) => !v), []);

  const handleXmlChanged = useCallback(
    (xml: string, hasEdits: boolean) => {
      onXmlEdited(xml);
      if (sheet?.musicXmlUri) {
        // A full undo (hasEdits=false) re-enables server refresh.
        saveEditedXml(sheet.id, sheet.musicXmlUri, xml)
          .then(() => patchSheet(sheet.id, { hasLocalEdits: hasEdits }))
          .catch(() => {});
      }
    },
    [sheet, patchSheet, onXmlEdited],
  );

  const noteEditor = useNoteEditor(musicXmlContent ?? "", handleXmlChanged);

  const handleEditTap = useCallback(
    (timeMs: number | null): boolean => {
      if (!editMode) return false;
      if (timeMs === null) return true; // consumed, but nothing selectable
      const indices = notePartIndicesRef.current ?? [];
      const showAll = visiblePartIds.size === 0 || visiblePartIds.size === partInfos.length;
      const candidates: number[] = [];
      noteSequence.forEach((n, i) => {
        const partId = partInfos[indices[i]]?.id;
        if (!showAll && (partId === undefined || !visiblePartIds.has(partId))) return;
        if (Math.abs(n.startTime * 1000 - timeMs) <= EDIT_TAP_TOLERANCE_MS) candidates.push(i);
      });
      if (candidates.length === 0) return true;
      const idx = candidates[0];
      const note = noteSequence[idx];
      // Ambiguous tap (several parts/chord notes share the beat): occurrence -1
      // can never match, so the editor safely reports "can't edit" instead of
      // guessing — the user solos their part and taps again.
      const occurrence =
        candidates.length === 1
          ? computeNoteOccurrence(noteSequence, indices, idx)
          : -1;
      noteEditor.selectNote({
        partIndex: indices[idx],
        midiNumber: note.midiNumber,
        occurrence,
        pitch: note.pitch,
      });
      return true;
    },
    [editMode, noteSequence, partInfos, visiblePartIds, noteEditor, notePartIndicesRef],
  );

  const audibleParts =
    visiblePartIds.size === 0 || visiblePartIds.size === partInfos.length
      ? partInfos.length
      : visiblePartIds.size;

  return {
    singAlong: {
      active: pitch.active,
      livePitch: pitch.livePitch,
      accuracyPercent: pitch.accuracyPercent,
      error: permission.error ?? pitch.error,
      multiPartWarning: pitch.active && audibleParts > 1,
      toggle: toggleSingAlong,
    },
    editor: { ...noteEditor, editMode, toggleEditMode, handleEditTap },
    sessionToast,
  };
}
