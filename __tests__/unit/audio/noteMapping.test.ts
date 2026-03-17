import {
  frequencyToNote,
  noteToFrequency,
  calculateCents,
  keyToFrequency,
} from "../../../client/lib/audio/noteMapping";

describe("noteMapping", () => {
  describe("frequencyToNote", () => {
    it("converts A4 (440Hz) correctly", () => {
      const result = frequencyToNote(440);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("A");
      expect(result!.octave).toBe(4);
    });

    it("converts middle C (261.63Hz) correctly", () => {
      const result = frequencyToNote(261.63);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("C");
      expect(result!.octave).toBe(4);
    });

    it("converts C3 (130.81Hz) correctly", () => {
      const result = frequencyToNote(130.81);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("C");
      expect(result!.octave).toBe(3);
    });

    it("converts F#5 (739.99Hz) correctly", () => {
      const result = frequencyToNote(739.99);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("F#");
      expect(result!.octave).toBe(5);
    });

    it("returns null for frequency 0", () => {
      expect(frequencyToNote(0)).toBeNull();
    });

    it("returns null for negative frequency", () => {
      expect(frequencyToNote(-1)).toBeNull();
      expect(frequencyToNote(-440)).toBeNull();
    });

    it("returns null for Infinity", () => {
      expect(frequencyToNote(Infinity)).toBeNull();
      expect(frequencyToNote(-Infinity)).toBeNull();
    });

    it("returns null for NaN", () => {
      expect(frequencyToNote(NaN)).toBeNull();
    });

    it("returns a frequency field matching noteToFrequency", () => {
      const result = frequencyToNote(440);
      expect(result).not.toBeNull();
      expect(result!.frequency).toBeCloseTo(440, 1);
    });

    it("returns null for frequency below human voice range (<80Hz)", () => {
      expect(frequencyToNote(30)).toBeNull();
      expect(frequencyToNote(79)).toBeNull();
    });

    it("returns null for frequency above human voice range (>1100Hz)", () => {
      expect(frequencyToNote(1200)).toBeNull();
      expect(frequencyToNote(5000)).toBeNull();
    });

    it("accepts frequencies at the boundary of human voice range", () => {
      const low = frequencyToNote(80);
      expect(low).not.toBeNull();

      const high = frequencyToNote(1100);
      expect(high).not.toBeNull();
    });
  });

  describe("noteToFrequency", () => {
    it("converts A4 to 440Hz", () => {
      expect(noteToFrequency("A", 4)).toBeCloseTo(440, 1);
    });

    it("converts C4 (middle C) correctly", () => {
      expect(noteToFrequency("C", 4)).toBeCloseTo(261.63, 0);
    });

    it("converts sharps correctly (C#4)", () => {
      expect(noteToFrequency("C#", 4)).toBeCloseTo(277.18, 0);
    });

    it("converts across octaves (A3 = 220Hz, A5 = 880Hz)", () => {
      expect(noteToFrequency("A", 3)).toBeCloseTo(220, 1);
      expect(noteToFrequency("A", 5)).toBeCloseTo(880, 1);
    });

    it("returns 0 for invalid note name", () => {
      expect(noteToFrequency("INVALID", 4)).toBe(0);
      expect(noteToFrequency("H", 4)).toBe(0);
      expect(noteToFrequency("", 4)).toBe(0);
    });
  });

  describe("calculateCents", () => {
    it("returns 0 for identical frequencies", () => {
      expect(calculateCents(440, 440)).toBe(0);
    });

    it("returns ~100 cents for one semitone sharp", () => {
      // A4 (440) to A#4 (466.16)
      const cents = calculateCents(466.16, 440);
      expect(cents).toBeCloseTo(100, 0);
    });

    it("returns ~-100 cents for one semitone flat", () => {
      // G#4 (415.30) relative to A4 (440)
      const cents = calculateCents(415.30, 440);
      expect(cents).toBeCloseTo(-100, 0);
    });

    it("positive cents means sharp", () => {
      expect(calculateCents(445, 440)).toBeGreaterThan(0);
    });

    it("negative cents means flat", () => {
      expect(calculateCents(435, 440)).toBeLessThan(0);
    });

    it("returns 0 for zero frequencies", () => {
      expect(calculateCents(0, 440)).toBe(0);
      expect(calculateCents(440, 0)).toBe(0);
      expect(calculateCents(0, 0)).toBe(0);
    });

    it("returns ~1200 cents for one octave", () => {
      const cents = calculateCents(880, 440);
      expect(cents).toBeCloseTo(1200, 0);
    });
  });

  describe("keyToFrequency", () => {
    it("defaults to octave 4", () => {
      expect(keyToFrequency("A")).toBeCloseTo(440, 1);
      expect(keyToFrequency("C")).toBeCloseTo(261.63, 0);
    });

    it("accepts custom octave", () => {
      expect(keyToFrequency("A", 3)).toBeCloseTo(220, 1);
    });

    it("handles sharps", () => {
      expect(keyToFrequency("F#")).toBeCloseTo(369.99, 0);
    });
  });
});
