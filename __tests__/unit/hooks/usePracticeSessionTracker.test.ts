/**
 * Tests for client/hooks/usePracticeSessionTracker.ts
 * Active-time accumulation, explicit finish, and unmount auto-finish.
 */
import { renderHook, act } from "@testing-library/react-native";
import { usePracticeSessionTracker } from "../../../client/hooks/usePracticeSessionTracker";

const mockRecordSession = jest.fn().mockResolvedValue(null);
jest.mock("../../../client/lib/practiceSessionRecorder", () => ({
  recordSession: (...args: unknown[]) => mockRecordSession(...args),
}));

const SHEET = { id: "s1", title: "La Traviata" };

type Props = { isPlaying: boolean; sheet: { id: string; title: string } | undefined };

function renderTracker(initial: Props) {
  return renderHook<ReturnType<typeof usePracticeSessionTracker>, Props>(
    (props) => usePracticeSessionTracker(props),
    { initialProps: initial },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe("usePracticeSessionTracker", () => {
  it("accumulates seconds only while playing", () => {
    const { result, rerender } = renderTracker({ isPlaying: true, sheet: SHEET });

    act(() => { jest.advanceTimersByTime(5_000); });
    expect(result.current.elapsedActiveSec).toBe(5);

    rerender({ isPlaying: false, sheet: SHEET });
    act(() => { jest.advanceTimersByTime(10_000); });
    expect(result.current.elapsedActiveSec).toBe(5); // paused — clock stopped

    rerender({ isPlaying: true, sheet: SHEET });
    act(() => { jest.advanceTimersByTime(3_000); });
    expect(result.current.elapsedActiveSec).toBe(8);
  });

  it("records the session with accumulated duration and accuracy on finish", async () => {
    const { result } = renderTracker({ isPlaying: true, sheet: SHEET });
    act(() => { jest.advanceTimersByTime(45_000); });

    await act(async () => { await result.current.finishSession(87); });

    expect(mockRecordSession).toHaveBeenCalledWith({
      sheetId: "s1",
      sheetTitle: "La Traviata",
      durationSec: 45,
      accuracy: 87,
    });
    expect(result.current.elapsedActiveSec).toBe(0); // reset after recording
  });

  it("does nothing on finish with zero elapsed time or no sheet", async () => {
    const { result } = renderTracker({ isPlaying: false, sheet: SHEET });
    await act(async () => { await result.current.finishSession(); });

    const noSheet = renderTracker({ isPlaying: true, sheet: undefined });
    act(() => { jest.advanceTimersByTime(5_000); });
    await act(async () => { await noSheet.result.current.finishSession(); });

    expect(mockRecordSession).not.toHaveBeenCalled();
  });

  it("auto-finishes on unmount", () => {
    const { unmount } = renderTracker({ isPlaying: true, sheet: SHEET });
    act(() => { jest.advanceTimersByTime(60_000); });

    unmount();

    expect(mockRecordSession).toHaveBeenCalledWith(
      expect.objectContaining({ sheetId: "s1", durationSec: 60 }),
    );
  });

  it("resets the clock when the sheet changes", () => {
    const { result, rerender } = renderTracker({ isPlaying: true, sheet: SHEET });
    act(() => { jest.advanceTimersByTime(10_000); });

    rerender({ isPlaying: true, sheet: { id: "s2", title: "Other" } });
    expect(result.current.elapsedActiveSec).toBe(0);
  });
});
