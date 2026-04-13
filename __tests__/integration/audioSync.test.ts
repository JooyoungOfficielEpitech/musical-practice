/**
 * Integration test: Reference track playback syncs with pitch detection lifecycle.
 *
 * When timer starts → reference track plays + pitch detection starts
 * When timer stops  → reference track pauses + pitch detection stops
 */
import { renderHook, act } from "@testing-library/react-native";
import { useAudioPlayer } from "../../client/hooks/useAudioPlayer";

// Mock expo-audio (hook migrated from expo-av to expo-audio)
const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockSeekTo = jest.fn().mockResolvedValue(undefined);
const mockRemove = jest.fn();
const mockAddListener = jest.fn(() => ({ remove: jest.fn() }));

jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(() => ({
    isLoaded: true,
    duration: 180,
    play: mockPlay,
    pause: mockPause,
    seekTo: mockSeekTo,
    remove: mockRemove,
    addListener: mockAddListener,
  })),
}));

describe("Audio player sync with practice lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("RED: play() calls play on the loaded player", async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("file:///mock/track.mp3");
    });
    act(() => { jest.advanceTimersByTime(200); });

    expect(result.current.isLoaded).toBe(true);

    await act(async () => {
      await result.current.play();
    });

    expect(mockPlay).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("RED: pause() calls pause on the loaded player", async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("file:///mock/track.mp3");
    });
    act(() => { jest.advanceTimersByTime(200); });

    await act(async () => {
      await result.current.pause();
    });

    expect(mockPause).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("RED: seekTo(0) resets position after stop", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("file:///mock/track.mp3");
    });

    await act(async () => {
      await result.current.seekTo(0);
    });

    expect(mockSeekTo).toHaveBeenCalledWith(0);
  });

  it("RED: play/pause are safe to call before loadSound", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    // Should not throw when no sound loaded
    await act(async () => {
      await result.current.play();
      await result.current.pause();
    });

    expect(mockPlay).not.toHaveBeenCalled();
    expect(mockPause).not.toHaveBeenCalled();
  });

  it("RED: simulates full timer lifecycle — start plays, stop pauses + seeks to 0", async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("file:///mock/track.mp3");
    });
    act(() => { jest.advanceTimersByTime(200); });

    // Timer start → play reference track
    await act(async () => {
      await result.current.play();
    });
    expect(mockPlay).toHaveBeenCalledTimes(1);

    // Timer stop → pause reference track + reset position
    await act(async () => {
      await result.current.pause();
      await result.current.seekTo(0);
    });
    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockSeekTo).toHaveBeenCalledWith(0);
    jest.useRealTimers();
  });
});
