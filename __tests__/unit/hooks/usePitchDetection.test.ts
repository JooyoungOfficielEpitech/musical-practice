import { renderHook, act } from "@testing-library/react-native";
import { AppState } from "react-native";
import { usePitchDetection } from "../../../client/hooks/usePitchDetection";
import type { PitchResult } from "../../../client/lib/audio/types";

// Mock pitch detection infrastructure
const mockInitDetector = jest.fn();
const mockDetectPitch = jest.fn();
const mockDestroyDetector = jest.fn();

jest.mock("../../../client/lib/audio/pitchDetector", () => ({
  initDetector: (...args: any[]) => mockInitDetector(...args),
  detectPitch: (...args: any[]) => mockDetectPitch(...args),
  destroyDetector: () => mockDestroyDetector(),
}));

const mockInitAudioStream = jest.fn();
const mockStartAudioStream = jest.fn();
const mockStopAudioStream = jest.fn();

jest.mock("../../../client/lib/audio/audioStream", () => ({
  initAudioStream: (...args: any[]) => mockInitAudioStream(...args),
  startAudioStream: (...args: any[]) => mockStartAudioStream(...args),
  stopAudioStream: () => mockStopAudioStream(),
}));

jest.mock("../../../client/lib/audio/types", () => ({
  DEFAULT_AUDIO_CONFIG: {
    sampleRate: 44100,
    channels: 1,
    bitsPerSample: 16,
    audioSource: 6,
  },
}));

// Mock AppState listeners
const mockAppStateListeners: Record<string, ((state: string) => void)[]> = {};

jest.doMock("react-native", () => {
  const actual = jest.requireActual("react-native");
  return {
    ...actual,
    AppState: {
      ...actual.AppState,
      addEventListener: jest.fn((event: string, listener: (state: string) => void) => {
        if (!mockAppStateListeners[event]) {
          mockAppStateListeners[event] = [];
        }
        mockAppStateListeners[event].push(listener);
        return { remove: jest.fn() };
      }),
    },
  };
});

describe("usePitchDetection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    for (const key in mockAppStateListeners) {
      delete mockAppStateListeners[key];
    }

    // Setup default audio stream mock: calls onData callback immediately
    mockStartAudioStream.mockImplementation((onData: (data: Float32Array) => void) => {
      return () => {
        /* cleanup */
      };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("initialization", () => {
    it("starts with isListening false", () => {
      const { result } = renderHook(() => usePitchDetection());
      expect(result.current.isListening).toBe(false);
      expect(result.current.currentPitch).toBe(null);
      expect(result.current.error).toBe(null);
    });
  });

  describe("startListening", () => {
    it("initializes detector and audio stream", async () => {
      const { result } = renderHook(() => usePitchDetection());

      await act(async () => {
        result.current.startListening();
      });

      expect(mockInitDetector).toHaveBeenCalledWith(44100);
      expect(mockInitAudioStream).toHaveBeenCalled();
      expect(mockStartAudioStream).toHaveBeenCalled();
    });

    it("sets isListening to true after start", async () => {
      const { result } = renderHook(() => usePitchDetection());

      await act(async () => {
        result.current.startListening();
      });

      expect(result.current.isListening).toBe(true);
    });

    it("processes audio data and detects pitch", async () => {
      const mockPitchResult: PitchResult = {
        frequency: 440,
        note: "A",
        octave: 4,
        cents: 0,
        clarity: 0.9,
      };
      mockDetectPitch.mockReturnValue(mockPitchResult);

      let capturedOnData: ((data: Float32Array) => void) | null = null;
      mockStartAudioStream.mockImplementation((onData: (data: Float32Array) => void) => {
        capturedOnData = onData;
        return () => {
          /* cleanup */
        };
      });

      const { result } = renderHook(() => usePitchDetection());

      await act(async () => {
        result.current.startListening();
      });

      // Simulate audio data
      const audioData = new Float32Array(2048);
      await act(async () => {
        capturedOnData?.(audioData);
        jest.advanceTimersByTime(100); // Wait for throttle
      });

      expect(result.current.currentPitch).toEqual(mockPitchResult);
    });

    it("throttles pitch updates to ~20Hz (50ms)", async () => {
      mockDetectPitch.mockReturnValue({
        frequency: 440,
        note: "A",
        octave: 4,
        cents: 0,
        clarity: 0.9,
      });

      let capturedOnData: ((data: Float32Array) => void) | null = null;
      mockStartAudioStream.mockImplementation((onData: (data: Float32Array) => void) => {
        capturedOnData = onData;
        return () => {
          /* cleanup */
        };
      });

      const { result } = renderHook(() => usePitchDetection());

      await act(async () => {
        result.current.startListening();
      });

      const audioData = new Float32Array(2048);

      // First update should go through immediately
      await act(async () => {
        capturedOnData?.(audioData);
      });
      expect(mockDetectPitch).toHaveBeenCalledTimes(1);

      // Second update within 50ms should be throttled
      await act(async () => {
        capturedOnData?.(audioData);
      });
      expect(mockDetectPitch).toHaveBeenCalledTimes(1); // Still 1, throttled

      // After 50ms, next update should go through
      await act(async () => {
        jest.advanceTimersByTime(50);
        capturedOnData?.(audioData);
      });
      expect(mockDetectPitch).toHaveBeenCalledTimes(2);
    });

    it("handles onAudioData callback (unthrottled)", async () => {
      let capturedOnData: ((data: Float32Array) => void) | null = null;
      mockStartAudioStream.mockImplementation((onData: (data: Float32Array) => void) => {
        capturedOnData = onData;
        return () => {
          /* cleanup */
        };
      });

      const mockOnAudioData = jest.fn();
      const { result } = renderHook(() =>
        usePitchDetection({ onAudioData: mockOnAudioData }),
      );

      await act(async () => {
        result.current.startListening();
      });

      const audioData = new Float32Array(2048);
      await act(async () => {
        capturedOnData?.(audioData);
        capturedOnData?.(audioData);
      });

      // onAudioData should be called both times (unthrottled)
      expect(mockOnAudioData).toHaveBeenCalledTimes(2);
      expect(mockOnAudioData).toHaveBeenCalledWith(audioData);
    });
  });

  describe("stopListening", () => {
    it("stops audio stream and destroys detector", async () => {
      const { result } = renderHook(() => usePitchDetection());

      await act(async () => {
        result.current.startListening();
      });

      await act(async () => {
        result.current.stopListening();
      });

      expect(mockStopAudioStream).toHaveBeenCalled();
      expect(mockDestroyDetector).toHaveBeenCalled();
    });

    it("resets isListening to false", async () => {
      const { result } = renderHook(() => usePitchDetection());

      await act(async () => {
        result.current.startListening();
      });
      expect(result.current.isListening).toBe(true);

      await act(async () => {
        result.current.stopListening();
      });
      expect(result.current.isListening).toBe(false);
    });

    it("clears currentPitch", async () => {
      mockDetectPitch.mockReturnValue({
        frequency: 440,
        note: "A",
        octave: 4,
        cents: 0,
        clarity: 0.9,
      });

      let capturedOnData: ((data: Float32Array) => void) | null = null;
      mockStartAudioStream.mockImplementation((onData: (data: Float32Array) => void) => {
        capturedOnData = onData;
        return () => {
          /* cleanup */
        };
      });

      const { result } = renderHook(() => usePitchDetection());

      await act(async () => {
        result.current.startListening();
      });

      const audioData = new Float32Array(2048);
      await act(async () => {
        capturedOnData?.(audioData);
        jest.advanceTimersByTime(100);
      });
      expect(result.current.currentPitch).not.toBeNull();

      await act(async () => {
        result.current.stopListening();
      });
      expect(result.current.currentPitch).toBeNull();
    });
  });

  describe("cleanup", () => {
    it("cleans up on unmount (stops listening)", async () => {
      const { result, unmount } = renderHook(() => usePitchDetection());

      await act(async () => {
        result.current.startListening();
      });
      expect(result.current.isListening).toBe(true);

      unmount();

      expect(mockStopAudioStream).toHaveBeenCalled();
      expect(mockDestroyDetector).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("sets error message on startListening failure", async () => {
      mockInitDetector.mockImplementation(() => {
        throw new Error("Detector initialization failed");
      });

      const { result } = renderHook(() => usePitchDetection());

      await act(async () => {
        result.current.startListening();
      });

      expect(result.current.error).toContain("Detector initialization failed");
      expect(result.current.isListening).toBe(false);
    });

    it("clears error on successful start", async () => {
      // Reset the mock that was throwing in the previous test
      mockInitDetector.mockImplementation(() => {
        // success
      });

      const { result } = renderHook(() => usePitchDetection());

      await act(async () => {
        result.current.startListening();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
