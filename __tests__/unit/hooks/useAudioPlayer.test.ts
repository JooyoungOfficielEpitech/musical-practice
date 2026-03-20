import { renderHook, act } from "@testing-library/react-native";
import { useAudioPlayer } from "../../../client/hooks/useAudioPlayer";

// Mock expo-av
const mockLoadAsync = jest.fn();
const mockPlayAsync = jest.fn();
const mockPauseAsync = jest.fn();
const mockSetPositionAsync = jest.fn();
const mockUnloadAsync = jest.fn();
const mockSetOnPlaybackStatusUpdate = jest.fn();

const mockSoundInstance = {
  loadAsync: mockLoadAsync,
  playAsync: mockPlayAsync,
  pauseAsync: mockPauseAsync,
  setPositionAsync: mockSetPositionAsync,
  unloadAsync: mockUnloadAsync,
  setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
};

jest.mock("expo-av", () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(),
    },
  },
}));

const { Audio } = jest.requireMock("expo-av");

describe("useAudioPlayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSoundInstance,
      status: { isLoaded: true, durationMillis: 225000 },
    });
    mockPlayAsync.mockResolvedValue(undefined);
    mockPauseAsync.mockResolvedValue(undefined);
    mockSetPositionAsync.mockResolvedValue(undefined);
    mockUnloadAsync.mockResolvedValue(undefined);
  });

  it("starts with initial state", () => {
    const { result } = renderHook(() => useAudioPlayer());

    expect(result.current.isLoaded).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.positionMs).toBe(0);
    expect(result.current.durationMs).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("loads sound and sets duration", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("test.mp3");
    });

    expect(Audio.Sound.createAsync).toHaveBeenCalledWith(
      { uri: "test.mp3" },
      { shouldPlay: false },
      expect.any(Function),
    );
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.durationMs).toBe(225000);
  });

  it("plays audio", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("test.mp3");
    });
    await act(async () => {
      await result.current.play();
    });

    expect(mockSoundInstance.playAsync).toHaveBeenCalledTimes(1);
  });

  it("pauses audio", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("test.mp3");
    });
    await act(async () => {
      await result.current.pause();
    });

    expect(mockSoundInstance.pauseAsync).toHaveBeenCalledTimes(1);
  });

  it("seeks to position", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("test.mp3");
    });
    await act(async () => {
      await result.current.seekTo(60000);
    });

    expect(mockSoundInstance.setPositionAsync).toHaveBeenCalledWith(60000);
  });

  it("unloads sound", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("test.mp3");
    });
    await act(async () => {
      await result.current.unload();
    });

    expect(mockSoundInstance.unloadAsync).toHaveBeenCalledTimes(1);
    expect(result.current.isLoaded).toBe(false);
    expect(result.current.isPlaying).toBe(false);
  });

  it("does not load when URI is empty", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("");
    });

    expect(Audio.Sound.createAsync).not.toHaveBeenCalled();
    expect(result.current.isLoaded).toBe(false);
  });

  it("sets error on load failure", async () => {
    Audio.Sound.createAsync.mockRejectedValue(new Error("File not found"));

    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("bad.mp3");
    });

    expect(result.current.error).toBe("File not found");
    expect(result.current.isLoaded).toBe(false);
  });
});
