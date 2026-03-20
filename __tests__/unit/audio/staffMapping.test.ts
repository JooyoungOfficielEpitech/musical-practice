import {
  noteToStaffY,
  noteToStaffYClamped,
  noteToStaffYDynamic,
  getStaffLineCount,
  type StaffPosition,
  type StaffConfig,
} from "../../../client/lib/audio/staffMapping";

const STAFF_HEIGHT = 120; // 5 lines, ~30px spacing

describe("staffMapping", () => {
  describe("noteToStaffY - treble clef positions", () => {
    // Bottom line = E4, Top line = F5
    // Lines: E4, G4, B4, D5, F5

    it("places E4 on the bottom line (line 1)", () => {
      const result = noteToStaffY("E", 4, STAFF_HEIGHT);
      expect(result.isOnLine).toBe(true);
      expect(result.needsLedgerLines).toBe(0);
    });

    it("places F4 in the first space", () => {
      const result = noteToStaffY("F", 4, STAFF_HEIGHT);
      expect(result.isOnLine).toBe(false);
      expect(result.needsLedgerLines).toBe(0);
    });

    it("places G4 on line 2", () => {
      const result = noteToStaffY("G", 4, STAFF_HEIGHT);
      expect(result.isOnLine).toBe(true);
      expect(result.needsLedgerLines).toBe(0);
    });

    it("places A4 in the second space", () => {
      const result = noteToStaffY("A", 4, STAFF_HEIGHT);
      expect(result.isOnLine).toBe(false);
      expect(result.needsLedgerLines).toBe(0);
    });

    it("places B4 on line 3 (middle)", () => {
      const result = noteToStaffY("B", 4, STAFF_HEIGHT);
      expect(result.isOnLine).toBe(true);
      expect(result.needsLedgerLines).toBe(0);
    });

    it("places C5 in the third space", () => {
      const result = noteToStaffY("C", 5, STAFF_HEIGHT);
      expect(result.isOnLine).toBe(false);
      expect(result.needsLedgerLines).toBe(0);
    });

    it("places D5 on line 4", () => {
      const result = noteToStaffY("D", 5, STAFF_HEIGHT);
      expect(result.isOnLine).toBe(true);
      expect(result.needsLedgerLines).toBe(0);
    });

    it("places F5 on top line (line 5)", () => {
      const result = noteToStaffY("F", 5, STAFF_HEIGHT);
      expect(result.isOnLine).toBe(true);
      expect(result.needsLedgerLines).toBe(0);
    });
  });

  describe("Y coordinates are ordered correctly", () => {
    it("higher notes have lower Y values (SVG convention)", () => {
      const e4 = noteToStaffY("E", 4, STAFF_HEIGHT);
      const g4 = noteToStaffY("G", 4, STAFF_HEIGHT);
      const b4 = noteToStaffY("B", 4, STAFF_HEIGHT);
      const f5 = noteToStaffY("F", 5, STAFF_HEIGHT);

      // In SVG, y=0 is top, so higher notes have smaller y
      expect(f5.y).toBeLessThan(b4.y);
      expect(b4.y).toBeLessThan(g4.y);
      expect(g4.y).toBeLessThan(e4.y);
    });
  });

  describe("ledger lines", () => {
    it("C4 (middle C) needs 1 ledger line below", () => {
      const result = noteToStaffY("C", 4, STAFF_HEIGHT);
      expect(result.needsLedgerLines).toBe(1);
      expect(result.isOnLine).toBe(true); // middle C sits on its ledger line
    });

    it("A3 needs 2 ledger lines below", () => {
      const result = noteToStaffY("A", 3, STAFF_HEIGHT);
      expect(result.needsLedgerLines).toBe(2);
    });

    it("A5 needs 1 ledger line above", () => {
      const result = noteToStaffY("A", 5, STAFF_HEIGHT);
      expect(result.needsLedgerLines).toBe(1);
    });

    it("C6 needs 2 ledger lines above", () => {
      const result = noteToStaffY("C", 6, STAFF_HEIGHT);
      expect(result.needsLedgerLines).toBe(2);
    });
  });

  describe("accidentals", () => {
    it("C# has sharp accidental", () => {
      const result = noteToStaffY("C#", 4, STAFF_HEIGHT);
      expect(result.accidental).toBe("sharp");
    });

    it("Bb has flat accidental", () => {
      const result = noteToStaffY("Bb", 4, STAFF_HEIGHT);
      expect(result.accidental).toBe("flat");
    });

    it("C# and C have the same Y position", () => {
      const c = noteToStaffY("C", 4, STAFF_HEIGHT);
      const cSharp = noteToStaffY("C#", 4, STAFF_HEIGHT);
      expect(cSharp.y).toBe(c.y);
    });

    it("Bb and B have the same Y position", () => {
      const b = noteToStaffY("B", 4, STAFF_HEIGHT);
      const bFlat = noteToStaffY("Bb", 4, STAFF_HEIGHT);
      expect(bFlat.y).toBe(b.y);
    });

    it("natural notes have no accidental", () => {
      const result = noteToStaffY("A", 4, STAFF_HEIGHT);
      expect(result.accidental).toBeUndefined();
    });
  });

  describe("noteToStaffY - default transposition fields", () => {
    it("includes transposition null and octavesShifted 0", () => {
      const result = noteToStaffY("A", 4, STAFF_HEIGHT);
      expect(result.transposition).toBeNull();
      expect(result.octavesShifted).toBe(0);
    });
  });

  describe("noteToStaffYClamped", () => {
    it("returns no transposition for notes within staff range", () => {
      const result = noteToStaffYClamped("A", 4, STAFF_HEIGHT);
      expect(result.transposition).toBeNull();
      expect(result.octavesShifted).toBe(0);
    });

    it("returns no transposition for notes with 1 ledger line (C4)", () => {
      const result = noteToStaffYClamped("C", 4, STAFF_HEIGHT);
      expect(result.transposition).toBeNull();
      expect(result.needsLedgerLines).toBe(1);
    });

    it("returns no transposition for notes with 2 ledger lines (C6)", () => {
      const result = noteToStaffYClamped("C", 6, STAFF_HEIGHT);
      expect(result.transposition).toBeNull();
      expect(result.needsLedgerLines).toBe(2);
    });

    it("returns no transposition for notes with 2 ledger lines (A3)", () => {
      const result = noteToStaffYClamped("A", 3, STAFF_HEIGHT);
      expect(result.transposition).toBeNull();
      expect(result.needsLedgerLines).toBe(2);
    });

    it("transposes high notes down with 8va (E6)", () => {
      const result = noteToStaffYClamped("E", 6, STAFF_HEIGHT);
      expect(result.transposition).toBe("8va");
      expect(result.octavesShifted).toBe(1);
      expect(result.needsLedgerLines).toBeLessThanOrEqual(2);
    });

    it("transposes low notes up with 8vb (E3)", () => {
      const result = noteToStaffYClamped("E", 3, STAFF_HEIGHT);
      expect(result.transposition).toBe("8vb");
      expect(result.octavesShifted).toBe(1);
      expect(result.needsLedgerLines).toBeLessThanOrEqual(2);
    });

    it("handles double transposition for very low notes (E2)", () => {
      const result = noteToStaffYClamped("E", 2, STAFF_HEIGHT);
      expect(result.transposition).toBe("8vb");
      expect(result.octavesShifted).toBe(2);
      expect(result.needsLedgerLines).toBeLessThanOrEqual(2);
    });

    it("handles double transposition for very high notes (C7)", () => {
      const result = noteToStaffYClamped("C", 7, STAFF_HEIGHT);
      expect(result.transposition).toBe("8va");
      expect(result.octavesShifted).toBeGreaterThanOrEqual(1);
      expect(result.needsLedgerLines).toBeLessThanOrEqual(2);
    });

    it("preserves accidentals through transposition", () => {
      const result = noteToStaffYClamped("C#", 6, STAFF_HEIGHT);
      expect(result.accidental).toBe("sharp");
    });

    it("D6 triggers 8va (3 ledger lines without transposition)", () => {
      const raw = noteToStaffY("D", 6, STAFF_HEIGHT);
      expect(raw.needsLedgerLines).toBe(3);

      const clamped = noteToStaffYClamped("D", 6, STAFF_HEIGHT);
      expect(clamped.transposition).toBe("8va");
      expect(clamped.needsLedgerLines).toBeLessThanOrEqual(2);
    });

    it("G3 triggers 8vb (3 ledger lines without transposition)", () => {
      const raw = noteToStaffY("G", 3, STAFF_HEIGHT);
      expect(raw.needsLedgerLines).toBe(3);

      const clamped = noteToStaffYClamped("G", 3, STAFF_HEIGHT);
      expect(clamped.transposition).toBe("8vb");
      expect(clamped.needsLedgerLines).toBeLessThanOrEqual(2);
    });
  });

  describe("getStaffLineCount", () => {
    it("returns 5 lines for a single octave range", () => {
      expect(getStaffLineCount({ lowOctave: 4, highOctave: 4 })).toBe(5);
    });

    it("returns more lines for wider ranges", () => {
      const narrow = getStaffLineCount({ lowOctave: 4, highOctave: 4 });
      const wide = getStaffLineCount({ lowOctave: 3, highOctave: 5 });
      expect(wide).toBeGreaterThan(narrow);
    });

    it("returns at least 5 lines for any range", () => {
      expect(getStaffLineCount({ lowOctave: 1, highOctave: 1 })).toBeGreaterThanOrEqual(5);
    });
  });

  describe("noteToStaffYDynamic", () => {
    const config35: StaffConfig = { lowOctave: 3, highOctave: 5 };
    const config44: StaffConfig = { lowOctave: 4, highOctave: 4 };

    describe("Y ordering within range", () => {
      it("higher notes have lower Y values (SVG convention)", () => {
        const c3 = noteToStaffYDynamic("C", 3, STAFF_HEIGHT, config35);
        const c4 = noteToStaffYDynamic("C", 4, STAFF_HEIGHT, config35);
        const c5 = noteToStaffYDynamic("C", 5, STAFF_HEIGHT, config35);

        expect(c5.y).toBeLessThan(c4.y);
        expect(c4.y).toBeLessThan(c3.y);
      });

      it("B5 is near the top and C3 is near the bottom for range 3~5", () => {
        const b5 = noteToStaffYDynamic("B", 5, STAFF_HEIGHT, config35);
        const c3 = noteToStaffYDynamic("C", 3, STAFF_HEIGHT, config35);

        expect(b5.y).toBeLessThan(STAFF_HEIGHT * 0.2);
        expect(c3.y).toBeGreaterThan(STAFF_HEIGHT * 0.8);
      });
    });

    describe("notes within range", () => {
      it("places C4 within staff for range 3~5", () => {
        const result = noteToStaffYDynamic("C", 4, STAFF_HEIGHT, config35);
        expect(result.y).toBeGreaterThanOrEqual(0);
        expect(result.y).toBeLessThanOrEqual(STAFF_HEIGHT);
        expect(result.outOfRange).toBeFalsy();
      });

      it("places all notes of octave 4 within staff for range 4~4", () => {
        const notes = ["C", "D", "E", "F", "G", "A", "B"];
        for (const note of notes) {
          const result = noteToStaffYDynamic(note, 4, STAFF_HEIGHT, config44);
          expect(result.y).toBeGreaterThanOrEqual(0);
          expect(result.y).toBeLessThanOrEqual(STAFF_HEIGHT);
          expect(result.outOfRange).toBeFalsy();
        }
      });
    });

    describe("out-of-range notes", () => {
      it("marks C6 as outOfRange for range 3~5", () => {
        const result = noteToStaffYDynamic("C", 6, STAFF_HEIGHT, config35);
        expect(result.outOfRange).toBe(true);
      });

      it("marks C2 as outOfRange for range 3~5", () => {
        const result = noteToStaffYDynamic("C", 2, STAFF_HEIGHT, config35);
        expect(result.outOfRange).toBe(true);
      });

      it("clamps out-of-range high notes to near top", () => {
        const result = noteToStaffYDynamic("C", 7, STAFF_HEIGHT, config35);
        expect(result.outOfRange).toBe(true);
        expect(result.y).toBeLessThanOrEqual(0);
      });

      it("clamps out-of-range low notes to near bottom", () => {
        const result = noteToStaffYDynamic("C", 1, STAFF_HEIGHT, config35);
        expect(result.outOfRange).toBe(true);
        expect(result.y).toBeGreaterThanOrEqual(STAFF_HEIGHT);
      });
    });

    describe("accidentals", () => {
      it("C# has sharp accidental", () => {
        const result = noteToStaffYDynamic("C#", 4, STAFF_HEIGHT, config35);
        expect(result.accidental).toBe("sharp");
      });

      it("Bb has flat accidental", () => {
        const result = noteToStaffYDynamic("Bb", 4, STAFF_HEIGHT, config35);
        expect(result.accidental).toBe("flat");
      });

      it("natural notes have no accidental", () => {
        const result = noteToStaffYDynamic("A", 4, STAFF_HEIGHT, config35);
        expect(result.accidental).toBeUndefined();
      });
    });

    describe("edge cases", () => {
      it("handles unknown note gracefully", () => {
        const result = noteToStaffYDynamic("X", 4, STAFF_HEIGHT, config35);
        expect(result.y).toBeDefined();
      });

      it("same note in different configs gives different Y", () => {
        const y35 = noteToStaffYDynamic("A", 4, STAFF_HEIGHT, config35);
        const y44 = noteToStaffYDynamic("A", 4, STAFF_HEIGHT, config44);
        // Different ranges → different Y positions (scaled differently)
        expect(y35.y).not.toBe(y44.y);
      });
    });
  });
});
