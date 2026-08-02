/**
 * Tests for client/hooks/usePlaybackOptions.ts
 * Per-part volume, transposition, and metronome state with per-sheet persistence.
 */
import { renderHook, act } from "@testing-library/react-native";
import { usePlaybackOptions } from "../../../client/hooks/usePlaybackOptions";
import type { SheetMusic } from "../../../client/lib/storage";

function makeSheet(overrides: Partial<SheetMusic> = {}): SheetMusic {
  return {
    id: "sheet-1",
    title: "Test",
    artist: "",
    imageUris: [],
    createdAt: 0,
    folder: "",
    isFavorite: false,
    ...overrides,
  };
}

describe("usePlaybackOptions", () => {
  it("initialises from the sheet's saved values", () => {
    const sheet = makeSheet({ partVolumes: { P1: 0.4 }, savedTranspose: -3 });
    const { result } = renderHook(() => usePlaybackOptions(sheet, jest.fn()));

    expect(result.current.partVolumes).toEqual({ P1: 0.4 });
    expect(result.current.transpose).toBe(-3);
    expect(result.current.metronomeOn).toBe(false);
  });

  it("sets and persists a part volume (clamped to 0..1)", async () => {
    const patchSheet = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePlaybackOptions(makeSheet(), patchSheet));

    act(() => result.current.setPartVolume("P1", 0.6));
    expect(result.current.partVolumes.P1).toBe(0.6);
    expect(patchSheet).toHaveBeenCalledWith("sheet-1", { partVolumes: { P1: 0.6 } });

    act(() => result.current.setPartVolume("P2", 7));
    expect(result.current.partVolumes).toEqual({ P1: 0.6, P2: 1 });
  });

  it("sets and persists transposition (clamped to ±12)", () => {
    const patchSheet = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePlaybackOptions(makeSheet(), patchSheet));

    act(() => result.current.setTranspose(4));
    expect(result.current.transpose).toBe(4);
    expect(patchSheet).toHaveBeenCalledWith("sheet-1", { savedTranspose: 4 });

    act(() => result.current.setTranspose(99));
    expect(result.current.transpose).toBe(12);
  });

  it("toggles the metronome without persisting", () => {
    const patchSheet = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePlaybackOptions(makeSheet(), patchSheet));

    act(() => result.current.toggleMetronome());
    expect(result.current.metronomeOn).toBe(true);
    act(() => result.current.toggleMetronome());
    expect(result.current.metronomeOn).toBe(false);
    expect(patchSheet).not.toHaveBeenCalled();
  });

  it("survives a persistence failure without crashing", () => {
    const patchSheet = jest.fn().mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => usePlaybackOptions(makeSheet(), patchSheet));

    act(() => result.current.setTranspose(2));
    expect(result.current.transpose).toBe(2);
  });

  it("does not persist when no sheet is loaded", () => {
    const patchSheet = jest.fn();
    const { result } = renderHook(() => usePlaybackOptions(undefined, patchSheet));

    act(() => result.current.setPartVolume("P1", 0.5));
    expect(result.current.partVolumes.P1).toBe(0.5);
    expect(patchSheet).not.toHaveBeenCalled();
  });
});
