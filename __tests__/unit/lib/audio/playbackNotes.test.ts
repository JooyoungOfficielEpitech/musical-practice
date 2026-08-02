/**
 * Tests for client/lib/audio/playbackNotes.ts
 * Pure note-pipeline transforms: part filtering, per-part volume, transposition,
 * and merging metronome clicks into a sorted playback sequence.
 */
import {
  buildPlaybackNotes,
  transposeNoteEvent,
  mergeNoteEvents,
  TRANSPOSE_MIN,
  TRANSPOSE_MAX,
} from "../../../../client/lib/audio/playbackNotes";
import type { NoteEvent, PartInfo } from "../../../../client/types/music";

function makeNote(overrides: Partial<NoteEvent> = {}): NoteEvent {
  return {
    pitch: "A4",
    midiNumber: 69,
    frequency: 440,
    startTime: 0,
    duration: 1,
    velocity: 80,
    ...overrides,
  };
}

const PARTS: PartInfo[] = [
  { id: "P1", name: "Soprano", partIndex: 0 },
  { id: "P2", name: "Alto", partIndex: 1 },
];

describe("transposeNoteEvent", () => {
  it("shifts midi number and frequency by semitones", () => {
    // Arrange
    const note = makeNote();

    // Act
    const up = transposeNoteEvent(note, 12);
    const down = transposeNoteEvent(note, -12);

    // Assert
    expect(up.midiNumber).toBe(81);
    expect(up.frequency).toBeCloseTo(880, 3);
    expect(down.midiNumber).toBe(57);
    expect(down.frequency).toBeCloseTo(220, 3);
  });

  it("returns an equal note for zero semitones", () => {
    const note = makeNote();
    expect(transposeNoteEvent(note, 0)).toEqual(note);
  });

  it("does not mutate the input note", () => {
    const note = makeNote();
    transposeNoteEvent(note, 3);
    expect(note.midiNumber).toBe(69);
    expect(note.frequency).toBe(440);
  });

  it("updates the pitch label to match the new midi number", () => {
    const note = makeNote(); // A4
    expect(transposeNoteEvent(note, 3).pitch).toBe("C5");
  });
});

describe("buildPlaybackNotes", () => {
  const notes = [
    makeNote({ startTime: 0 }),
    makeNote({ startTime: 1, midiNumber: 60, frequency: 261.63, pitch: "C4" }),
  ];
  const notePartIndices = [0, 1];

  it("keeps all notes when every part is visible", () => {
    const result = buildPlaybackNotes({
      notes,
      notePartIndices,
      partInfos: PARTS,
      visiblePartIds: new Set(["P1", "P2"]),
    });
    expect(result).toHaveLength(2);
  });

  it("filters notes of hidden parts", () => {
    const result = buildPlaybackNotes({
      notes,
      notePartIndices,
      partInfos: PARTS,
      visiblePartIds: new Set(["P2"]),
    });
    expect(result).toHaveLength(1);
    expect(result[0].pitch).toBe("C4");
  });

  it("scales velocity by the part volume", () => {
    const result = buildPlaybackNotes({
      notes,
      notePartIndices,
      partInfos: PARTS,
      visiblePartIds: new Set(["P1", "P2"]),
      partVolumes: { P1: 0.5 },
    });
    expect(result[0].velocity).toBe(40); // 80 * 0.5
    expect(result[1].velocity).toBe(80); // default volume 1
  });

  it("clamps part volume to the 0..1 range", () => {
    const result = buildPlaybackNotes({
      notes,
      notePartIndices,
      partInfos: PARTS,
      visiblePartIds: new Set(["P1", "P2"]),
      partVolumes: { P1: 5, P2: -1 },
    });
    expect(result[0].velocity).toBe(80); // clamped to 1.0
    expect(result[1].velocity).toBe(0); // clamped to 0
  });

  it("applies transposition to every note", () => {
    const result = buildPlaybackNotes({
      notes,
      notePartIndices,
      partInfos: PARTS,
      visiblePartIds: new Set(["P1", "P2"]),
      transposeSemitones: 2,
    });
    expect(result[0].midiNumber).toBe(71);
    expect(result[1].midiNumber).toBe(62);
  });

  it("clamps transposition to the supported range", () => {
    const result = buildPlaybackNotes({
      notes,
      notePartIndices,
      partInfos: PARTS,
      visiblePartIds: new Set(["P1", "P2"]),
      transposeSemitones: 99,
    });
    expect(result[0].midiNumber).toBe(69 + TRANSPOSE_MAX);
    expect(TRANSPOSE_MIN).toBeLessThan(0);
  });

  it("does not mutate the input array or notes", () => {
    buildPlaybackNotes({
      notes,
      notePartIndices,
      partInfos: PARTS,
      visiblePartIds: new Set(["P1"]),
      partVolumes: { P1: 0.2 },
      transposeSemitones: 5,
    });
    expect(notes[0].velocity).toBe(80);
    expect(notes[0].midiNumber).toBe(69);
  });
});

describe("mergeNoteEvents", () => {
  it("merges two sequences sorted by startTime", () => {
    const a = [makeNote({ startTime: 0 }), makeNote({ startTime: 2 })];
    const b = [makeNote({ startTime: 1 }), makeNote({ startTime: 3 })];
    const merged = mergeNoteEvents(a, b);
    expect(merged.map((n) => n.startTime)).toEqual([0, 1, 2, 3]);
  });

  it("returns the non-empty sequence unchanged when the other is empty", () => {
    const a = [makeNote({ startTime: 0 })];
    expect(mergeNoteEvents(a, [])).toEqual(a);
    expect(mergeNoteEvents([], a)).toEqual(a);
  });
});
