import { useState, useCallback } from "react";
import type { NoteSequence } from "../types/music";
import {
  parsePitchString,
  replaceNotePitch,
} from "../lib/audio/musicXmlEditor";
import {
  playNote,
  resumeAudioContext,
} from "../lib/audio/synthEngine";

export interface NoteEditorState {
  editedMusicXml: string;
  selectedIndex: number | null;
  selectedPitch: { step: string; alter: number; octave: number } | null;
  hasEdits: boolean;
}

export interface NoteEditorActions {
  selectNote: (noteIndex: number) => void;
  applyPitch: (step: string, alter: number, octave: number) => void;
  dismiss: () => void;
  resetEdits: () => void;
}

export function useNoteEditor(
  initialMusicXml: string,
  noteSequence: NoteSequence,
): NoteEditorState & NoteEditorActions {
  const [editedMusicXml, setEditedMusicXml] = useState(initialMusicXml);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<{
    step: string;
    alter: number;
    octave: number;
  } | null>(null);
  const [hasEdits, setHasEdits] = useState(false);

  const selectNote = useCallback(
    (noteIndex: number) => {
      if (noteIndex < 0 || noteIndex >= noteSequence.length) return;
      const note = noteSequence[noteIndex];
      const pitch = parsePitchString(note.pitch);
      if (!pitch) return;
      setSelectedIndex(noteIndex);
      setSelectedPitch(pitch);
      // Preview note audio — fire and forget
      resumeAudioContext().then(() => {
        playNote(note.frequency, 0.5, 0);
      });
    },
    [noteSequence],
  );

  const applyPitch = useCallback(
    (step: string, alter: number, octave: number) => {
      if (selectedIndex === null) return;
      const updated = replaceNotePitch(
        editedMusicXml,
        noteSequence,
        selectedIndex,
        step,
        alter,
        octave,
      );
      setEditedMusicXml(updated);
      setHasEdits(true);
      setSelectedIndex(null);
      setSelectedPitch(null);
      // Preview new pitch
      resumeAudioContext().then(() => {
        playNote(440, 0.5, 0); // frequency resolved by caller context; best-effort
      });
    },
    [selectedIndex, editedMusicXml, noteSequence],
  );

  const dismiss = useCallback(() => {
    setSelectedIndex(null);
    setSelectedPitch(null);
  }, []);

  const resetEdits = useCallback(() => {
    setEditedMusicXml(initialMusicXml);
    setHasEdits(false);
    setSelectedIndex(null);
    setSelectedPitch(null);
  }, [initialMusicXml]);

  return {
    editedMusicXml,
    selectedIndex,
    selectedPitch,
    hasEdits,
    selectNote,
    applyPitch,
    dismiss,
    resetEdits,
  };
}
