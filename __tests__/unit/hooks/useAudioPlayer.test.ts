import { renderHook, act } from "@testing-library/react-native";
import { useAudioPlayer } from "../../../client/hooks/useAudioPlayer";

// Mock expo-audio (hook migrated from expo-av to expo-audio)
const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockSeekTo = jest.fn().mockResolvedValue(undefined);
const mockRemove = jest.fn();
const mockAddListener = jest.fn(() => ({ remove: jest.fn() }));

const createMockPlayer = (overrides: Partial<Record<string, unknown>> = {}) => ({
  isLoaded: true,
  duration: 225, // seconds
  play: mockPlay,
  pause: mockPause,
  seekTo: mockSeekTo,
  remove: mockRemove,
  addListener: mockAddListener,
  ...overrides,
});

jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(),
}));

const { createAudioPlayer } = jest.requireMock("expo-audio") as {
  createAudioPlayer: jest.Mock;
};

describe("useAudioPlayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createAudioPlayer.mockReturnValue(createMockPlayer());
  });

  it("starts with initial state", () => {
    const { result } = renderHook(() => useAudioPlayer());

    expect(result.current.isLoaded).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.positionMs).toBe(0);
    expect(result.current.durationMs).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("loads sound and sets duration via polling", async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("test.mp3");
    });

    expect(createAudioPlayer).toHaveBeenCalledWith({ uri: "test.mp3" });

    // Advance polling interval
    act(() => { jest.advanceTimersByTime(200); });

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.durationMs).toBe(225000);
    jest.useRealTimers();
  });

  it("plays audio", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("test.mp3");
    });
    await act(async () => {
      await result.current.play();
    });

    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it("pauses audio", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("test.mp3");
    });
    await act(async () => {
      await result.current.pause();
    });

    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it("seeks to position", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("test.mp3");
    });
    await act(async () => {
      await result.current.seekTo(60000);
    });

    // seekTo converts ms to seconds
    expect(mockSeekTo).toHaveBeenCalledWith(60);
  });

  it("unloads sound", async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("test.mp3");
    });
    act(() => { jest.advanceTimersByTime(200); });

    await act(async () => {
      await result.current.unload();
    });

    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(result.current.isLoaded).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    jest.useRealTimers();
  });

  it("does not load when URI is empty", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("");
    });

    expect(createAudioPlayer).not.toHaveBeenCalled();
    expect(result.current.isLoaded).toBe(false);
  });

  it("sets error on load failure", async () => {
    createAudioPlayer.mockImplementationOnce(() => {
      throw new Error("File not found");
    });

    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("bad.mp3");
    });

    expect(result.current.error).toBe("File not found");
    expect(result.current.isLoaded).toBe(false);
  });
});
