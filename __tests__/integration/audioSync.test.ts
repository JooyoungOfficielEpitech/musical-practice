/**
 * Integration test: Reference track playback syncs with pitch detection lifecycle.
 *
 * When timer starts → reference track plays + pitch detection starts
 * When timer stops  → reference track pauses + pitch detection stops
 */
import { renderHook, act } from "@testing-library/react-native";
import { useAudioPlayer } from "../../client/hooks/useAudioPlayer";

// Mock expo-av
const mockPlayAsync = jest.fn().mockResolvedValue({});
const mockPauseAsync = jest.fn().mockResolvedValue({});
const mockSetPositionAsync = jest.fn().mockResolvedValue({});
const mockUnloadAsync = jest.fn().mockResolvedValue({});
const mockCreateAsync = jest.fn().mockResolvedValue({
  sound: {
    playAsync: mockPlayAsync,
    pauseAsync: mockPauseAsync,
    setPositionAsync: mockSetPositionAsync,
    unloadAsync: mockUnloadAsync,
  },
  status: { isLoaded: true, durationMillis: 180000 },
});

jest.mock("expo-av", () => ({
  Audio: {
    Sound: {
      createAsync: (...args: unknown[]) => mockCreateAsync(...args),
    },
  },
}));

describe("Audio player sync with practice lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("RED: play() calls playAsync on the loaded sound", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("file:///mock/track.mp3");
    });

    expect(result.current.isLoaded).toBe(true);

    await act(async () => {
      await result.current.play();
    });

    expect(mockPlayAsync).toHaveBeenCalledTimes(1);
  });

  it("RED: pause() calls pauseAsync on the loaded sound", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("file:///mock/track.mp3");
    });

    await act(async () => {
      await result.current.pause();
    });

    expect(mockPauseAsync).toHaveBeenCalledTimes(1);
  });

  it("RED: seekTo(0) resets position after stop", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("file:///mock/track.mp3");
    });

    await act(async () => {
      await result.current.seekTo(0);
    });

    expect(mockSetPositionAsync).toHaveBeenCalledWith(0);
  });

  it("RED: play/pause are safe to call before loadSound", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    // Should not throw when no sound loaded
    await act(async () => {
      await result.current.play();
      await result.current.pause();
    });

    expect(mockPlayAsync).not.toHaveBeenCalled();
    expect(mockPauseAsync).not.toHaveBeenCalled();
  });

  it("RED: simulates full timer lifecycle — start plays, stop pauses + seeks to 0", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("file:///mock/track.mp3");
    });

    // Timer start → play reference track
    await act(async () => {
      await result.current.play();
    });
    expect(mockPlayAsync).toHaveBeenCalledTimes(1);

    // Timer stop → pause reference track + reset position
    await act(async () => {
      await result.current.pause();
      await result.current.seekTo(0);
    });
    expect(mockPauseAsync).toHaveBeenCalledTimes(1);
    expect(mockSetPositionAsync).toHaveBeenCalledWith(0);
  });
});
