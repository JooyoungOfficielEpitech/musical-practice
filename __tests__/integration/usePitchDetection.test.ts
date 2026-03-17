import { renderHook, act } from "@testing-library/react-native";
import { AppState } from "react-native";
import { usePitchDetection } from "../../client/hooks/usePitchDetection";

// Mock Audio (expo-av)
jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock audioStream
const mockStartAudioStream = jest.fn();
const mockStopAudioStream = jest.fn();
const mockInitAudioStream = jest.fn();

jest.mock("../../client/lib/audio/audioStream", () => ({
  initAudioStream: (...args: unknown[]) => mockInitAudioStream(...args),
  startAudioStream: (...args: unknown[]) => mockStartAudioStream(...args),
  stopAudioStream: (...args: unknown[]) => mockStopAudioStream(...args),
}));

// Mock pitchDetector
const mockDetectPitch = jest.fn();
const mockInitDetector = jest.fn();
const mockDestroyDetector = jest.fn();

jest.mock("../../client/lib/audio/pitchDetector", () => ({
  detectPitch: (...args: unknown[]) => mockDetectPitch(...args),
  initDetector: (...args: unknown[]) => mockInitDetector(...args),
  destroyDetector: (...args: unknown[]) => mockDestroyDetector(...args),
}));

// Mock AppState
let appStateCallback: ((state: string) => void) | null = null;
const mockRemove = jest.fn();
jest.spyOn(AppState, "addEventListener").mockImplementation((_type, callback) => {
  appStateCallback = callback as (state: string) => void;
  return { remove: mockRemove } as unknown as ReturnType<typeof AppState.addEventListener>;
});

describe("usePitchDetection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appStateCallback = null;

    // Default: startAudioStream returns a cleanup function
    mockStartAudioStream.mockReturnValue(jest.fn());
  });

  it("starts with isListening=false and currentPitch=null", () => {
    const { result } = renderHook(() => usePitchDetection());

    expect(result.current.isListening).toBe(false);
    expect(result.current.currentPitch).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("startListening sets isListening=true", async () => {
    const { result } = renderHook(() => usePitchDetection());

    await act(async () => {
      await result.current.startListening();
    });

    expect(result.current.isListening).toBe(true);
    expect(mockInitDetector).toHaveBeenCalled();
    expect(mockInitAudioStream).toHaveBeenCalled();
    expect(mockStartAudioStream).toHaveBeenCalled();
  });

  it("stopListening sets isListening=false and clears pitch", async () => {
    const { result } = renderHook(() => usePitchDetection());

    await act(async () => {
      await result.current.startListening();
    });

    act(() => {
      result.current.stopListening();
    });

    expect(result.current.isListening).toBe(false);
    expect(result.current.currentPitch).toBeNull();
    expect(mockStopAudioStream).toHaveBeenCalled();
    expect(mockDestroyDetector).toHaveBeenCalled();
  });

  it("updates currentPitch when audio data yields a detection", async () => {
    let audioCallback: ((data: Float32Array) => void) | null = null;
    mockStartAudioStream.mockImplementation((cb: (data: Float32Array) => void) => {
      audioCallback = cb;
      return jest.fn();
    });

    const mockPitchResult = {
      frequency: 440,
      note: "A",
      octave: 4,
      cents: 5,
      clarity: 0.95,
    };
    mockDetectPitch.mockReturnValue(mockPitchResult);

    const { result } = renderHook(() => usePitchDetection());

    await act(async () => {
      await result.current.startListening();
    });

    // Simulate audio data arriving
    await act(async () => {
      audioCallback!(new Float32Array(2048));
    });

    expect(result.current.currentPitch).toEqual(mockPitchResult);
  });

  it("sets error and stops on stream failure (Bug #5)", async () => {
    mockStartAudioStream.mockImplementation(() => {
      throw new Error("Microphone unavailable");
    });

    const { result } = renderHook(() => usePitchDetection());

    await act(async () => {
      await result.current.startListening();
    });

    expect(result.current.isListening).toBe(false);
    expect(result.current.error).toBe("Microphone unavailable");
    // Should still call cleanup
    expect(mockStopAudioStream).toHaveBeenCalled();
    expect(mockDestroyDetector).toHaveBeenCalled();
  });

  it("stops listening when app goes to background", async () => {
    const { result } = renderHook(() => usePitchDetection());

    await act(async () => {
      await result.current.startListening();
    });

    expect(result.current.isListening).toBe(true);

    // Simulate background
    act(() => {
      appStateCallback?.("background");
    });

    expect(result.current.isListening).toBe(false);
  });

  it("cleans up on unmount", async () => {
    const { result, unmount } = renderHook(() => usePitchDetection());

    await act(async () => {
      await result.current.startListening();
    });

    unmount();

    expect(mockRemove).toHaveBeenCalled();
    expect(mockStopAudioStream).toHaveBeenCalled();
  });
});
