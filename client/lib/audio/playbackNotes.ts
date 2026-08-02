/**
 * playbackNotes — pure transforms that turn the parsed note sequence into what
 * the synth player actually schedules: part filtering, per-part volume
 * (velocity scaling), transposition, and merging in metronome clicks.
 */
import type { NoteEvent, PartInfo } from "../../types/music";

export const TRANSPOSE_MIN = -12;
export const TRANSPOSE_MAX = 12;

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MIN_VELOCITY = 0;
const MAX_VELOCITY = 127;

function midiToPitchLabel(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

/** Return a new note shifted by the given number of semitones. */
export function transposeNoteEvent(note: NoteEvent, semitones: number): NoteEvent {
  if (semitones === 0) return { ...note };
  const midiNumber = note.midiNumber + semitones;
  return {
    ...note,
    midiNumber,
    frequency: note.frequency * Math.pow(2, semitones / 12),
    pitch: midiToPitchLabel(midiNumber),
  };
}

export interface PlaybackNoteOptions {
  notes: NoteEvent[];
  notePartIndices: number[];
  partInfos: PartInfo[];
  visiblePartIds: Set<string>;
  /** Per-part gain 0..1 keyed by part id; missing parts default to 1. */
  partVolumes?: Record<string, number>;
  transposeSemitones?: number;
}

/**
 * Build the playable note list: drop hidden parts, scale each note's velocity
 * by its part volume, and transpose. Never mutates the inputs.
 */
export function buildPlaybackNotes(options: PlaybackNoteOptions): NoteEvent[] {
  const {
    notes,
    notePartIndices,
    partInfos,
    visiblePartIds,
    partVolumes = {},
    transposeSemitones = 0,
  } = options;

  const semitones = clamp(Math.round(transposeSemitones), TRANSPOSE_MIN, TRANSPOSE_MAX);
  const includeAll =
    visiblePartIds.size === 0 ||
    visiblePartIds.size === partInfos.length ||
    notePartIndices.length === 0;

  const result: NoteEvent[] = [];
  for (let i = 0; i < notes.length; i++) {
    const partId = partInfos[notePartIndices[i]]?.id;
    if (!includeAll && (partId === undefined || !visiblePartIds.has(partId))) continue;

    const volume = clamp(partId !== undefined ? partVolumes[partId] ?? 1 : 1, 0, 1);
    const transposed = transposeNoteEvent(notes[i], semitones);
    result.push({
      ...transposed,
      velocity: clamp(Math.round(transposed.velocity * volume), MIN_VELOCITY, MAX_VELOCITY),
    });
  }
  return result;
}

/** Merge two startTime-sorted note sequences into one sorted sequence. */
export function mergeNoteEvents(a: NoteEvent[], b: NoteEvent[]): NoteEvent[] {
  if (a.length === 0) return [...b];
  if (b.length === 0) return [...a];
  const merged: NoteEvent[] = [];
  let ai = 0;
  let bi = 0;
  while (ai < a.length && bi < b.length) {
    merged.push(a[ai].startTime <= b[bi].startTime ? a[ai++] : b[bi++]);
  }
  while (ai < a.length) merged.push(a[ai++]);
  while (bi < b.length) merged.push(b[bi++]);
  return merged;
}
