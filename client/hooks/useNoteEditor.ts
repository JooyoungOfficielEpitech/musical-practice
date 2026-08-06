import { useState, useCallback, useEffect } from "react";
import { parsePitchString, replaceNotePitchAtIndex } from "../lib/audio/musicXmlEditor";
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
  /** Null until checked; false when the tapped note can't be safely located. */
  canEditSelected: boolean | null;
  hasEdits: boolean;
  selectNote: (identity: NoteIdentity) => void;
  applyPitch: (step: string, alter: number, octave: number) => boolean;
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
  onXmlChanged?: (xml: string) => void,
): NoteEditorState {
  const [editedMusicXml, setEditedMusicXml] = useState(initialMusicXml);
  const [selectedNote, setSelectedNote] = useState<NoteIdentity | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<SelectedPitch | null>(null);
  const [canEditSelected, setCanEditSelected] = useState<boolean | null>(null);
  const [hasEdits, setHasEdits] = useState(false);

  // A new score file resets the editing session.
  useEffect(() => {
    setEditedMusicXml(initialMusicXml);
    setHasEdits(false);
    setSelectedNote(null);
    setSelectedPitch(null);
    setCanEditSelected(null);
  }, [initialMusicXml]);

  const selectNote = useCallback(
    (identity: NoteIdentity) => {
      const pitch = parsePitchString(identity.pitch);
      setSelectedNote(identity);
      setSelectedPitch(pitch);
      setCanEditSelected(findXmlNoteIndex(editedMusicXml, identity) !== null);
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
      setCanEditSelected(null);
      previewMidi(midiOf(step, alter, octave));
      onXmlChanged?.(updated);
      return true;
    },
    [selectedNote, editedMusicXml, onXmlChanged],
  );

  const dismiss = useCallback(() => {
    setSelectedNote(null);
    setSelectedPitch(null);
    setCanEditSelected(null);
  }, []);

  const resetEdits = useCallback(() => {
    setEditedMusicXml(initialMusicXml);
    setHasEdits(false);
    setSelectedNote(null);
    setSelectedPitch(null);
    setCanEditSelected(null);
    onXmlChanged?.(initialMusicXml);
  }, [initialMusicXml, onXmlChanged]);

  return {
    editedMusicXml, selectedNote, selectedPitch, canEditSelected, hasEdits,
    selectNote, applyPitch, dismiss, resetEdits,
  };
}
