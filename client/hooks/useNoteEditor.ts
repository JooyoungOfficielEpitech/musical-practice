import { useState, useCallback, useEffect, useRef } from "react";
import {
  parsePitchString,
  replaceNotePitchAtIndex,
  lyricTextAtIndex,
  replaceLyricTextAtIndex,
} from "../lib/audio/musicXmlEditor";
import { findXmlNoteIndex } from "../lib/audio/noteEditLocator";
import { playNote, resumeAudioContext } from "../lib/audio/synthEngine";

/** Identity of a tapped note, computed by the integrator from noteSequence. */
export interface NoteIdentity {
  partIndex: number;
  midiNumber: number;
  /** nth same-midi note of this part in playback order (computeNoteOccurrence). */
  occurrence: number;
  /** Display label, e.g. "F#4". */
  pitch: string;
}

export interface SelectedPitch {
  step: string;
  alter: number;
  octave: number;
}

export interface NoteEditorState {
  editedMusicXml: string;
  selectedNote: NoteIdentity | null;
  selectedPitch: SelectedPitch | null;
  /** Printed lyric of the selected note (null when it has none). */
  selectedLyric: string | null;
  /** Null until checked; false when the tapped note can't be safely located. */
  canEditSelected: boolean | null;
  hasEdits: boolean;
  selectNote: (identity: NoteIdentity) => void;
  applyPitch: (step: string, alter: number, octave: number) => boolean;
  /** Set/replace the lyric text; empty string removes it. */
  applyLyric: (text: string) => boolean;
  dismiss: () => void;
  resetEdits: () => void;
}

const PREVIEW_DURATION_SEC = 0.4;

function midiOf(step: string, alter: number, octave: number): number {
  const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return (octave + 1) * 12 + (SEMITONES[step] ?? 0) + alter;
}

function previewMidi(midi: number): void {
  const frequency = 440 * Math.pow(2, (midi - 69) / 12);
  resumeAudioContext()
    .then(() => playNote(frequency, PREVIEW_DURATION_SEC, 0))
    .catch(() => {});
}

/**
 * Fix-a-wrong-note editor. The tapped note is identified by part + midi +
 * occurrence (never a raw index — see noteEditLocator) so an edit can NEVER
 * land on the wrong note: if the note can't be located unambiguously,
 * canEditSelected is false and applyPitch refuses.
 */
export function useNoteEditor(
  initialMusicXml: string,
  onXmlChanged?: (xml: string, hasEdits: boolean) => void,
): NoteEditorState {
  const [editedMusicXml, setEditedMusicXml] = useState(initialMusicXml);
  const [selectedNote, setSelectedNote] = useState<NoteIdentity | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<SelectedPitch | null>(null);
  const [selectedLyric, setSelectedLyric] = useState<string | null>(null);
  const [canEditSelected, setCanEditSelected] = useState<boolean | null>(null);
  const [hasEdits, setHasEdits] = useState(false);

  // The undo baseline: the last XML that arrived from OUTSIDE (load/refresh).
  // Our own edits round-trip through the parent (re-parse) and come back as
  // initialMusicXml — those must NOT reset the session or move the baseline.
  const baselineRef = useRef(initialMusicXml);
  const lastEmittedRef = useRef<string | null>(null);

  // A genuinely new score file resets the editing session.
  useEffect(() => {
    if (initialMusicXml === lastEmittedRef.current) return;
    baselineRef.current = initialMusicXml;
    setEditedMusicXml(initialMusicXml);
    setHasEdits(false);
    setSelectedNote(null);
    setSelectedPitch(null);
    setSelectedLyric(null);
    setCanEditSelected(null);
  }, [initialMusicXml]);

  const selectNote = useCallback(
    (identity: NoteIdentity) => {
      const pitch = parsePitchString(identity.pitch);
      setSelectedNote(identity);
      setSelectedPitch(pitch);
      const xmlIndex = findXmlNoteIndex(editedMusicXml, identity);
      setCanEditSelected(xmlIndex !== null);
      setSelectedLyric(xmlIndex !== null ? lyricTextAtIndex(editedMusicXml, xmlIndex) : null);
      previewMidi(identity.midiNumber);
    },
    [editedMusicXml],
  );

  const applyPitch = useCallback(
    (step: string, alter: number, octave: number): boolean => {
      if (!selectedNote) return false;
      const xmlNoteIndex = findXmlNoteIndex(editedMusicXml, selectedNote);
      if (xmlNoteIndex === null) return false;

      const updated = replaceNotePitchAtIndex(editedMusicXml, xmlNoteIndex, step, alter, octave);
      if (updated === editedMusicXml) return false;

      setEditedMusicXml(updated);
      setHasEdits(true);
      setSelectedNote(null);
      setSelectedPitch(null);
      setSelectedLyric(null);
      setCanEditSelected(null);
      previewMidi(midiOf(step, alter, octave));
      lastEmittedRef.current = updated;
      onXmlChanged?.(updated, true);
      return true;
    },
    [selectedNote, editedMusicXml, onXmlChanged],
  );

  const applyLyric = useCallback(
    (text: string): boolean => {
      if (!selectedNote) return false;
      const xmlNoteIndex = findXmlNoteIndex(editedMusicXml, selectedNote);
      if (xmlNoteIndex === null) return false;
      const updated = replaceLyricTextAtIndex(editedMusicXml, xmlNoteIndex, text);
      if (updated === editedMusicXml) return false;
      setEditedMusicXml(updated);
      setHasEdits(true);
      setSelectedLyric(text.trim() || null);
      lastEmittedRef.current = updated;
      onXmlChanged?.(updated, true);
      return true;
    },
    [selectedNote, editedMusicXml, onXmlChanged],
  );

  const dismiss = useCallback(() => {
    setSelectedNote(null);
    setSelectedPitch(null);
    setSelectedLyric(null);
    setCanEditSelected(null);
  }, []);

  const resetEdits = useCallback(() => {
    const baseline = baselineRef.current;
    setEditedMusicXml(baseline);
    setHasEdits(false);
    setSelectedNote(null);
    setSelectedPitch(null);
    setSelectedLyric(null);
    setCanEditSelected(null);
    lastEmittedRef.current = baseline;
    onXmlChanged?.(baseline, false);
  }, [onXmlChanged]);

  return {
    editedMusicXml, selectedNote, selectedPitch, selectedLyric, canEditSelected, hasEdits,
    selectNote, applyPitch, applyLyric, dismiss, resetEdits,
  };
}
