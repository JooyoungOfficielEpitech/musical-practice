import { fuzzySearchFilter } from "../../client/lib/fuzzySearch";

describe("fuzzySearch", () => {
  describe("fuzzySearchFilter", () => {
    it("matches exact title", () => {
      const result = fuzzySearchFilter(
        { title: "Clair de Lune", artist: "Debussy" },
        "Clair"
      );
      expect(result).toBe(true);
    });

    it("matches case-insensitive", () => {
      const result = fuzzySearchFilter(
        { title: "Clair de Lune", artist: "Debussy" },
        "CLAIR"
      );
      expect(result).toBe(true);
    });

    it("matches artist name", () => {
      const result = fuzzySearchFilter(
        { title: "Clair de Lune", artist: "Debussy" },
        "Debussy"
      );
      expect(result).toBe(true);
    });

    it("matches substring", () => {
      const result = fuzzySearchFilter(
        { title: "Clair de Lune", artist: "Claude Debussy" },
        "Claude"
      );
      expect(result).toBe(true);
    });

    it("ignores leading/trailing whitespace in query", () => {
      const result = fuzzySearchFilter(
        { title: "Clair de Lune", artist: "Debussy" },
        "  Clair  "
      );
      expect(result).toBe(true);
    });

    it("returns false when no match", () => {
      const result = fuzzySearchFilter(
        { title: "Clair de Lune", artist: "Debussy" },
        "Mozart"
      );
      expect(result).toBe(false);
    });

    it("returns true for empty search", () => {
      const result = fuzzySearchFilter(
        { title: "Clair de Lune", artist: "Debussy" },
        ""
      );
      expect(result).toBe(true);
    });

    it("matches diacritic-insensitive (ignores accents)", () => {
      const result = fuzzySearchFilter(
        { title: "Clair de Lune", artist: "Debussy" },
        "deBussy"
      );
      expect(result).toBe(true);
    });
  });
});
