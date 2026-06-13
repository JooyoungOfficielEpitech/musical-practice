import {
  countNotesByPart,
  resolveInitialVisibleParts,
} from "../../../../client/lib/audio/partSelection";
import type { PartInfo } from "../../../../client/types/music";

const PARTS: PartInfo[] = [
  { id: "P1", name: "Soprano", partIndex: 0 },
  { id: "P2", name: "Alto", partIndex: 1 },
  { id: "P3", name: "Tenor", partIndex: 2 },
];

describe("countNotesByPart", () => {
  it("counts notes per part id from notePartIndices", () => {
    // 3 notes in P1 (index 0), 1 in P2 (index 1), 0 in P3
    const counts = countNotesByPart([0, 0, 1, 0], PARTS);
    expect(counts).toEqual({ P1: 3, P2: 1, P3: 0 });
  });

  it("returns zero for every part when there are no notes", () => {
    expect(countNotesByPart([], PARTS)).toEqual({ P1: 0, P2: 0, P3: 0 });
  });

  it("ignores out-of-range indices without crashing", () => {
    const counts = countNotesByPart([0, 9, -1], PARTS);
    expect(counts.P1).toBe(1);
    expect(counts.P2).toBe(0);
    expect(counts.P3).toBe(0);
  });
});

describe("resolveInitialVisibleParts", () => {
  it("defaults to all parts when no selection is persisted", () => {
    const visible = resolveInitialVisibleParts(PARTS, undefined);
    expect(visible).toEqual(new Set(["P1", "P2", "P3"]));
  });

  it("restores a persisted selection", () => {
    const visible = resolveInitialVisibleParts(PARTS, ["P2"]);
    expect(visible).toEqual(new Set(["P2"]));
  });

  it("keeps only persisted ids that still exist in the score", () => {
    // P9 no longer exists (re-OMR changed parts); drop it, keep P1.
    const visible = resolveInitialVisibleParts(PARTS, ["P1", "P9"]);
    expect(visible).toEqual(new Set(["P1"]));
  });

  it("falls back to all parts when the persisted selection matches nothing", () => {
    const visible = resolveInitialVisibleParts(PARTS, ["P9"]);
    expect(visible).toEqual(new Set(["P1", "P2", "P3"]));
  });

  it("falls back to all parts when the persisted selection is empty", () => {
    const visible = resolveInitialVisibleParts(PARTS, []);
    expect(visible).toEqual(new Set(["P1", "P2", "P3"]));
  });
});
