import {
  expectedNotesAt,
  judgePitch,
  summarizeAccuracy,
} from "../../../../client/lib/audio/pitchScoring";
import type { NoteEvent } from "../../../../client/types/music";

describe("pitchScoring", () => {
  const sampleNotes: NoteEvent[] = [
    {
      pitch: "C4",
      midiNumber: 60,
      frequency: 261.63,
      startTime: 0,
      duration: 1.0,
      velocity: 80,
    },
    {
      pitch: "E4",
      midiNumber: 64,
      frequency: 329.63,
      startTime: 1.0,
      duration: 1.0,
      velocity: 80,
    },
    {
      pitch: "G4",
      midiNumber: 67,
      frequency: 392.0,
      startTime: 2.0,
      duration: 1.0,
      velocity: 80,
    },
  ];

  describe("expectedNotesAt", () => {
    it("returns empty array when no notes at time", () => {
      const result = expectedNotesAt(sampleNotes, 3.5);
      expect(result).toEqual([]);
    });

    it("returns notes active at given time", () => {
      const result = expectedNotesAt(sampleNotes, 0.5);
      expect(result).toHaveLength(1);
      expect(result[0].pitch).toBe("C4");
    });

    it("includes note when time equals startTime", () => {
      const result = expectedNotesAt(sampleNotes, 0.0);
      expect(result).toHaveLength(1);
      expect(result[0].pitch).toBe("C4");
    });

    it("excludes note when time equals endTime", () => {
      const result = expectedNotesAt(sampleNotes, 1.0);
      expect(result).toHaveLength(1);
      expect(result[0].pitch).toBe("E4");
    });

    it("handles multiple overlapping notes", () => {
      const overlappingNotes: NoteEvent[] = [
        { pitch: "C4", midiNumber: 60, frequency: 261.63, startTime: 0, duration: 2.0, velocity: 80 },
        { pitch: "E4", midiNumber: 64, frequency: 329.63, startTime: 0.5, duration: 1.5, velocity: 80 },
      ];
      const result = expectedNotesAt(overlappingNotes, 1.0);
      expect(result).toHaveLength(2);
    });

    it("returns empty array on empty input", () => {
      const result = expectedNotesAt([], 0.5);
      expect(result).toEqual([]);
    });
  });

  describe("judgePitch", () => {
    describe("basic matching (octave-sensitive, 60 cent tolerance)", () => {
      it("returns correct=true when pitch is within tolerance", () => {
        const expected = [sampleNotes[0]]; // C4 = MIDI 60
        const result = judgePitch(60.0, expected); // Exact match
        expect(result.correct).toBe(true);
        expect(result.nearest?.pitch).toBe("C4");
        expect(result.centsOff).toBe(0);
      });

      it("returns correct=true when 40 cents off (within 60 cent default tolerance)", () => {
        const expected = [sampleNotes[0]]; // C4 = MIDI 60
        const result = judgePitch(60.4, expected); // 40 cents sharp
        expect(result.correct).toBe(true);
        expect(result.centsOff).toBe(40);
      });

      it("returns correct=false when 80 cents off (beyond 60 cent tolerance)", () => {
        const expected = [sampleNotes[0]]; // C4 = MIDI 60
        const result = judgePitch(60.8, expected); // 80 cents sharp
        expect(result.correct).toBe(false);
        expect(result.centsOff).toBe(80);
      });

      it("handles flat pitch (negative cents)", () => {
        const expected = [sampleNotes[0]]; // C4 = MIDI 60
        const result = judgePitch(59.8, expected); // 20 cents flat
        expect(result.correct).toBe(true);
        expect(result.centsOff).toBe(-20);
      });

      it("returns nearest match when multiple expected notes", () => {
        const expected = [sampleNotes[0], sampleNotes[1]]; // C4, E4
        // Detect D#4 (MIDI 63) — 3 semitones from C4, 1 from E4
        const result = judgePitch(63.0, expected);
        expect(result.nearest?.pitch).toBe("E4");
      });
    });

    describe("custom tolerance", () => {
      it("respects custom tolerance (50 cents)", () => {
        const expected = [sampleNotes[0]]; // C4 = MIDI 60
        const result = judgePitch(60.5, expected, 50); // 50 cents off, exactly at boundary
        expect(result.correct).toBe(true); // 50 is within 50
      });

      it("rejects at boundary when outside tolerance", () => {
        const expected = [sampleNotes[0]]; // C4 = MIDI 60
        const result = judgePitch(60.51, expected, 50); // 51 cents off
        expect(result.correct).toBe(false);
      });
    });

    describe("octave-agnostic mode", () => {
      it("returns correct=true when pitch class matches (different octave)", () => {
        const expected = [sampleNotes[0]]; // C4 = MIDI 60
        // C5 = MIDI 72 — different octave, same pitch class
        const result = judgePitch(72.0, expected, 60, true);
        expect(result.correct).toBe(true);
      });

      it("still uses cents-off value even with pitch class match", () => {
        const expected = [sampleNotes[0]]; // C4 = MIDI 60
        // Detect C5 (MIDI 72) with C4 expected — 1200 cents off (1 octave) but same pitch class
        const result = judgePitch(72.0, expected, 60, true);
        expect(result.correct).toBe(true); // C pitch class matches in octave-agnostic mode
        expect(result.centsOff).toBe(1200); // Still report the large cents difference
      });

      it("rejects when pitch class doesn't match (octave-agnostic)", () => {
        const expected = [sampleNotes[0]]; // C4 = MIDI 60
        // D5 = MIDI 74 — different pitch class
        const result = judgePitch(74.0, expected, 60, true);
        expect(result.correct).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("returns correct=false on empty expected notes", () => {
        const result = judgePitch(60.0, []);
        expect(result.correct).toBe(false);
      });

      it("handles invalid MIDI floats gracefully", () => {
        const expected = [sampleNotes[0]];
        const result = judgePitch(-5.0, expected); // Invalid MIDI
        expect(result.correct).toBe(false);
      });

      it("handles very high MIDI values", () => {
        const expected = [{ ...sampleNotes[0], midiNumber: 127 }];
        const result = judgePitch(127.0, expected);
        expect(result.correct).toBe(true);
      });
    });
  });

  describe("summarizeAccuracy", () => {
    it("returns 0 for empty readings", () => {
      const result = summarizeAccuracy([]);
      expect(result).toBe(0);
    });

    it("calculates correct percentage", () => {
      const readings = [
        { correct: true },
        { correct: true },
        { correct: false },
        { correct: false },
      ];
      const result = summarizeAccuracy(readings);
      expect(result).toBe(50);
    });

    it("returns 100 when all correct", () => {
      const readings = [{ correct: true }, { correct: true }, { correct: true }];
      const result = summarizeAccuracy(readings);
      expect(result).toBe(100);
    });

    it("returns 0 when all incorrect", () => {
      const readings = [{ correct: false }, { correct: false }];
      const result = summarizeAccuracy(readings);
      expect(result).toBe(0);
    });

    it("rounds percentage correctly", () => {
      const readings = [
        { correct: true },
        { correct: true },
        { correct: false },
      ];
      const result = summarizeAccuracy(readings);
      expect(result).toBe(67); // 2/3 = 66.67 → 67
    });
  });
});
