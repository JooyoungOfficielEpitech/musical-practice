export interface NoteEvent {
  pitch: string; // "C4", "D#5"
  midiNumber: number; // 60, 63
  frequency: number; // 261.63 Hz
  startTime: number; // seconds from start
  duration: number; // seconds
  velocity: number; // 0-127
}

export type NoteSequence = NoteEvent[];
