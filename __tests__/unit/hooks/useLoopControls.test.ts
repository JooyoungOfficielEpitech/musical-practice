/**
 * Tests for client/hooks/useLoopControls.ts
 * A–B loop state machine: button press uses the current position; while armed,
 * score note taps set the loop points instead of seeking.
 */
import { renderHook, act } from "@testing-library/react-native";
import { useLoopControls } from "../../../client/hooks/useLoopControls";

function makeFns() {
  return {
    play: jest.fn(), pause: jest.fn(), stop: jest.fn(), seekTo: jest.fn(),
    setInstrument: jest.fn(), setTempo: jest.fn(),
    setLoopRange: jest.fn(), clearLoopRange: jest.fn(),
  };
}

function makePlayer(fns: ReturnType<typeof makeFns>, overrides: Record<string, unknown> = {}) {
  return {
    isPlaying: false, positionMs: 0, durationMs: 60_000, error: null,
    instrument: "piano", instrumentLoading: false, tempo: 1.0, loopRange: null,
    ...fns,
    ...overrides,
  } as any;
}

describe("useLoopControls — button flow", () => {
  it("arms A at the current position, then sets the range on second press", () => {
    const fns = makeFns();
    const { result, rerender } = renderHook<ReturnType<typeof useLoopControls>, { p: any }>(({ p }) => useLoopControls(p), {
      initialProps: { p: makePlayer(fns, { positionMs: 1_000 }) },
    });

    act(() => result.current.handleLoopButton());
    expect(result.current.armed).toBe(true);
    expect(fns.setLoopRange).not.toHaveBeenCalled();

    rerender({ p: makePlayer(fns, { positionMs: 6_000 }) });
    act(() => result.current.handleLoopButton());
    expect(fns.setLoopRange).toHaveBeenCalledWith({ startMs: 1_000, endMs: 6_000 });
    expect(result.current.armed).toBe(false);
  });

  it("clears an active loop on press", () => {
    const fns = makeFns();
    const { result } = renderHook(() =>
      useLoopControls(makePlayer(fns, { loopRange: { startMs: 0, endMs: 5_000 } })),
    );

    act(() => result.current.handleLoopButton());
    expect(fns.clearLoopRange).toHaveBeenCalledTimes(1);
    expect(result.current.armed).toBe(false);
  });

  it("ignores a second press too close to A (stays armed)", () => {
    const fns = makeFns();
    const { result } = renderHook(() => useLoopControls(makePlayer(fns, { positionMs: 1_000 })));
    act(() => result.current.handleLoopButton());
    act(() => result.current.handleLoopButton()); // same position → range too short
    expect(fns.setLoopRange).not.toHaveBeenCalled();
    expect(result.current.armed).toBe(true);
  });
});

describe("useLoopControls — score tap flow", () => {
  it("does not consume taps when idle (taps seek as usual)", () => {
    const fns = makeFns();
    const { result } = renderHook(() => useLoopControls(makePlayer(fns)));
    let consumed = true;
    act(() => { consumed = result.current.handleScoreTap(2.0); });
    expect(consumed).toBe(false);
  });

  it("while armed: first tap overrides A, second tap sets B and activates", () => {
    const fns = makeFns();
    const { result } = renderHook(() => useLoopControls(makePlayer(fns, { positionMs: 0 })));

    act(() => result.current.handleLoopButton()); // armed, A = 0 (current pos)
    let consumed = false;
    act(() => { consumed = result.current.handleScoreTap(2.0); }); // A ← note at 2s
    expect(consumed).toBe(true);
    expect(fns.setLoopRange).not.toHaveBeenCalled();

    act(() => { consumed = result.current.handleScoreTap(6.5); }); // B ← note at 6.5s
    expect(consumed).toBe(true);
    expect(fns.setLoopRange).toHaveBeenCalledWith({ startMs: 2_000, endMs: 6_500 });
    expect(result.current.armed).toBe(false);
  });

  it("score taps land on the tempo-scaled timeline", () => {
    // tempo 0.5 → a note at original 2s plays at 4s scaled
    const fns = makeFns();
    const { result } = renderHook(() =>
      useLoopControls(makePlayer(fns, { positionMs: 0, tempo: 0.5, durationMs: 120_000 })),
    );

    act(() => result.current.handleLoopButton());
    act(() => { result.current.handleScoreTap(2.0); });
    act(() => { result.current.handleScoreTap(6.0); });
    expect(fns.setLoopRange).toHaveBeenCalledWith({ startMs: 4_000, endMs: 12_000 });
  });

  it("orders reversed taps into a valid range", () => {
    const fns = makeFns();
    const { result } = renderHook(() => useLoopControls(makePlayer(fns, { positionMs: 0 })));
    act(() => result.current.handleLoopButton());
    act(() => { result.current.handleScoreTap(8.0); });
    act(() => { result.current.handleScoreTap(3.0); });
    expect(fns.setLoopRange).toHaveBeenCalledWith({ startMs: 3_000, endMs: 8_000 });
  });
});

describe("useLoopControls — tempo rescale", () => {
  it("rescales an active loop when tempo changes", () => {
    const fns = makeFns();
    const { result, rerender } = renderHook<ReturnType<typeof useLoopControls>, { p: any }>(({ p }) => useLoopControls(p), {
      initialProps: { p: makePlayer(fns, { positionMs: 0 }) },
    });

    act(() => result.current.handleLoopButton());
    rerender({ p: makePlayer(fns, { positionMs: 8_000 }) });
    act(() => result.current.handleLoopButton());
    expect(fns.setLoopRange).toHaveBeenLastCalledWith({ startMs: 0, endMs: 8_000 });

    rerender({
      p: makePlayer(fns, {
        positionMs: 8_000, tempo: 0.5, durationMs: 120_000,
        loopRange: { startMs: 0, endMs: 8_000 },
      }),
    });
    expect(fns.setLoopRange).toHaveBeenLastCalledWith({ startMs: 0, endMs: 16_000 });
  });
});
