import { renderHook, act } from "@testing-library/react-native";
import { usePitchAccuracy } from "../../../client/hooks/usePitchAccuracy";
import type { PitchResult } from "../../../client/lib/audio/types";

function makePitch(cents: number): PitchResult {
  return {
    frequency: 440,
    note: "A",
    octave: 4,
    cents,
    clarity: 0.95,
  };
}

describe("usePitchAccuracy", () => {
  it("starts with zero values", () => {
    const { result } = renderHook(() => usePitchAccuracy());

    expect(result.current.sessionAccuracy).toBe(0);
    expect(result.current.totalReadings).toBe(0);
    expect(result.current.correctReadings).toBe(0);
  });

  it("counts a reading within ±50 cents as correct", () => {
    const { result } = renderHook(() => usePitchAccuracy());

    act(() => {
      result.current.addReading(makePitch(10)); // within threshold
    });

    expect(result.current.totalReadings).toBe(1);
    expect(result.current.correctReadings).toBe(1);
    expect(result.current.sessionAccuracy).toBe(100);
  });

  it("counts a reading outside ±50 cents as incorrect", () => {
    const { result } = renderHook(() => usePitchAccuracy());

    act(() => {
      result.current.addReading(makePitch(60)); // outside threshold
    });

    expect(result.current.totalReadings).toBe(1);
    expect(result.current.correctReadings).toBe(0);
    expect(result.current.sessionAccuracy).toBe(0);
  });

  it("counts exactly ±50 cents as correct (boundary)", () => {
    const { result } = renderHook(() => usePitchAccuracy());

    act(() => {
      result.current.addReading(makePitch(50));
    });

    expect(result.current.correctReadings).toBe(1);

    act(() => {
      result.current.addReading(makePitch(-50));
    });

    expect(result.current.correctReadings).toBe(2);
  });

  it("calculates accuracy as percentage (7/10 = 70%)", () => {
    const { result } = renderHook(() => usePitchAccuracy());

    act(() => {
      // 7 correct (within range)
      for (let i = 0; i < 7; i++) {
        result.current.addReading(makePitch(5));
      }
      // 3 incorrect (outside range)
      for (let i = 0; i < 3; i++) {
        result.current.addReading(makePitch(80));
      }
    });

    expect(result.current.totalReadings).toBe(10);
    expect(result.current.correctReadings).toBe(7);
    expect(result.current.sessionAccuracy).toBe(70);
  });

  it("rounds accuracy to nearest integer", () => {
    const { result } = renderHook(() => usePitchAccuracy());

    act(() => {
      // 1 correct out of 3 = 33.33...%
      result.current.addReading(makePitch(5));
      result.current.addReading(makePitch(80));
      result.current.addReading(makePitch(80));
    });

    expect(result.current.sessionAccuracy).toBe(33);
  });

  it("handles negative cents correctly", () => {
    const { result } = renderHook(() => usePitchAccuracy());

    act(() => {
      result.current.addReading(makePitch(-30)); // flat but within range
    });

    expect(result.current.correctReadings).toBe(1);
  });

  it("reset() clears all values to zero", () => {
    const { result } = renderHook(() => usePitchAccuracy());

    act(() => {
      result.current.addReading(makePitch(5));
      result.current.addReading(makePitch(5));
      result.current.addReading(makePitch(5));
    });

    expect(result.current.totalReadings).toBe(3);

    act(() => {
      result.current.reset();
    });

    expect(result.current.sessionAccuracy).toBe(0);
    expect(result.current.totalReadings).toBe(0);
    expect(result.current.correctReadings).toBe(0);
  });

  it("works correctly after reset and new readings", () => {
    const { result } = renderHook(() => usePitchAccuracy());

    act(() => {
      result.current.addReading(makePitch(5));
      result.current.reset();
      result.current.addReading(makePitch(80)); // incorrect
    });

    expect(result.current.totalReadings).toBe(1);
    expect(result.current.correctReadings).toBe(0);
    expect(result.current.sessionAccuracy).toBe(0);
  });
});
