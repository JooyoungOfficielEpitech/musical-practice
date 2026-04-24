export interface NoteEvent {
  pitch: string; // "C4", "D#5"
  midiNumber: number; // 60, 63
  frequency: number; // 261.63 Hz
  startTime: number; // seconds from start
  duration: number; // seconds
  velocity: number; // 0-127
}

export type NoteSequence = NoteEvent[];

export interface PartInfo {
  id: string; // "P1" from <part id="P1">
  name: string; // "Piano RH" from <part-name>
  partIndex: number; // 0-based
}

export interface ParsedMusicXml {
  notes: NoteSequence;
  parts: PartInfo[];
  notePartIndices: number[]; // notePartIndices[i] = partIndex of notes[i]
}
