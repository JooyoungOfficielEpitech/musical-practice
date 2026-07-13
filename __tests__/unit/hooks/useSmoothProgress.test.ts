import { renderHook, act } from "@testing-library/react-native";
import { useSmoothProgress } from "../../../client/hooks/useSmoothProgress";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function tick(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe("useSmoothProgress", () => {
  it("starts at the actual value (no replay from 0 on remount)", () => {
    const { result } = renderHook(() => useSmoothProgress(45, true));
    expect(result.current).toBe(45);
  });

  it("creeps forward slowly between server updates", () => {
    const { result } = renderHook(() => useSmoothProgress(30, true));
    expect(result.current).toBe(30);

    tick(5_000);
    const after5s = result.current;
    expect(after5s).toBeGreaterThan(30);
    // Creep is modest — nowhere near the next real milestone
    expect(after5s).toBeLessThan(45);

    tick(60_000);
    // Creep is capped: asymptotically approaches actual + headroom, never 100
    expect(result.current).toBeLessThanOrEqual(45);
  });

  it("catches up quickly (but not instantly) when the server value jumps", () => {
    const { result, rerender } = renderHook(
      (props: { actual: number }) => useSmoothProgress(props.actual, true),
      { initialProps: { actual: 10 } },
    );

    rerender({ actual: 60 });
    // Not an instant teleport
    expect(result.current).toBeLessThan(60);

    tick(4_000);
    expect(result.current).toBeGreaterThanOrEqual(55);
  });

  it("never decreases even if the input regresses", () => {
    const { result, rerender } = renderHook(
      (props: { actual: number }) => useSmoothProgress(props.actual, true),
      { initialProps: { actual: 50 } },
    );
    tick(2_000);
    const before = result.current;

    rerender({ actual: 20 });
    tick(2_000);
    expect(result.current).toBeGreaterThanOrEqual(before);
  });

  it("reaches 100 quickly when actual hits 100", () => {
    const { result, rerender } = renderHook(
      (props: { actual: number }) => useSmoothProgress(props.actual, true),
      { initialProps: { actual: 80 } },
    );

    rerender({ actual: 100 });
    tick(3_000);
    expect(result.current).toBe(100);
  });

  it("does not run a timer when inactive", () => {
    const { result } = renderHook(() => useSmoothProgress(30, false));
    tick(30_000);
    expect(result.current).toBe(30);
  });
});
