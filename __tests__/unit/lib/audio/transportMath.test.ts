import { ratioToMs, msToRatio, gestureXToMs, makeLoopRange } from "../../../../client/lib/audio/transportMath";

describe("ratioToMs", () => {
  it("maps 0..1 onto the duration", () => {
    expect(ratioToMs(0, 1000)).toBe(0);
    expect(ratioToMs(0.5, 1000)).toBe(500);
    expect(ratioToMs(1, 1000)).toBe(1000);
  });
  it("clamps out-of-range ratios", () => {
    expect(ratioToMs(-0.2, 1000)).toBe(0);
    expect(ratioToMs(1.5, 1000)).toBe(1000);
  });
  it("returns 0 for non-positive duration", () => {
    expect(ratioToMs(0.5, 0)).toBe(0);
  });
});

describe("msToRatio", () => {
  it("maps ms onto 0..1", () => {
    expect(msToRatio(0, 1000)).toBe(0);
    expect(msToRatio(250, 1000)).toBe(0.25);
    expect(msToRatio(1000, 1000)).toBe(1);
  });
  it("clamps and guards zero duration", () => {
    expect(msToRatio(2000, 1000)).toBe(1);
    expect(msToRatio(-5, 1000)).toBe(0);
    expect(msToRatio(500, 0)).toBe(0);
  });
});

describe("gestureXToMs", () => {
  it("converts a touch x within the track to ms", () => {
    expect(gestureXToMs(0, 200, 1000)).toBe(0);
    expect(gestureXToMs(100, 200, 1000)).toBe(500);
    expect(gestureXToMs(200, 200, 1000)).toBe(1000);
  });
  it("clamps an overshooting x", () => {
    expect(gestureXToMs(250, 200, 1000)).toBe(1000);
    expect(gestureXToMs(-10, 200, 1000)).toBe(0);
  });
  it("guards a zero-width track", () => {
    expect(gestureXToMs(50, 0, 1000)).toBe(0);
  });
});

describe("makeLoopRange", () => {
  it("orders the two points into start<end", () => {
    expect(makeLoopRange(800, 300, 1000)).toEqual({ startMs: 300, endMs: 800 });
    expect(makeLoopRange(300, 800, 1000)).toEqual({ startMs: 300, endMs: 800 });
  });
  it("clamps to the duration bounds", () => {
    expect(makeLoopRange(-100, 5000, 1000)).toEqual({ startMs: 0, endMs: 1000 });
  });
  it("returns null when a point is missing", () => {
    expect(makeLoopRange(null, 500, 1000)).toBeNull();
    expect(makeLoopRange(500, null, 1000)).toBeNull();
  });
  it("returns null when the range is shorter than the minimum", () => {
    expect(makeLoopRange(500, 600, 1000, 200)).toBeNull();
    expect(makeLoopRange(500, 750, 1000, 200)).toEqual({ startMs: 500, endMs: 750 });
  });
  it("returns null for zero duration", () => {
    expect(makeLoopRange(100, 500, 0)).toBeNull();
  });
});
