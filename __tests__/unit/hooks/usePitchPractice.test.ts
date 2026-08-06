import { renderHook, act } from "@testing-library/react-native";
import { usePitchPractice } from "../../../client/hooks/usePitchPractice";
import type { NoteEvent } from "../../../client/types/music";

// Mock hooks
const mockStartListening = jest.fn();
const mockStopListening = jest.fn();
const mockPitchResult = {
  frequency: 440,
  note: "A",
  octave: 4,
  cents: 0,
  clarity: 0.9,
};

jest.mock("../../../client/hooks/usePitchDetection", () => ({
  usePitchDetection: jest.fn(() => ({
    isListening: false,
    currentPitch: null,
    error: null,
    startListening: mockStartListening,
    stopListening: mockStopListening,
  })),
}));

describe("usePitchPractice", () => {
  const sampleNotes: NoteEvent[] = [
    {
      pitch: "C4",
      midiNumber: 60,
      frequency: 261.63,
      startTime: 0,
      duration: 1.0,
      velocity: 80,
    },
    {
      pitch: "E4",
      midiNumber: 64,
      frequency: 329.63,
      startTime: 1.0,
      duration: 1.0,
      velocity: 80,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("initialization", () => {
    it("starts with active false and no accuracy readings", () => {
      const { result } = renderHook(() =>
        usePitchPractice({
          notes: sampleNotes,
          getPositionSec: () => 0,
        }),
      );

      expect(result.current.active).toBe(false);
      expect(result.current.accuracyPercent).toBe(0);
      expect(result.current.livePitch).toBeNull();
    });
  });

  describe("activation", () => {
    it("starts listening when activated", async () => {
      const { result } = renderHook(() =>
        usePitchPractice({
          notes: sampleNotes,
          getPositionSec: () => 0,
        }),
      );

      await act(async () => {
        result.current.activate();
      });

      expect(mockStartListening).toHaveBeenCalled();
      expect(result.current.active).toBe(true);
    });

    it("stops listening when deactivated", async () => {
      const { result } = renderHook(() =>
        usePitchPractice({
          notes: sampleNotes,
          getPositionSec: () => 0,
        }),
      );

      await act(async () => {
        result.current.activate();
      });

      await act(async () => {
        result.current.deactivate();
      });

      expect(mockStopListening).toHaveBeenCalled();
      expect(result.current.active).toBe(false);
    });

    it("resets readings when deactivated", async () => {
      const { result } = renderHook(() =>
        usePitchPractice({
          notes: sampleNotes,
          getPositionSec: () => 0,
        }),
      );

      await act(async () => {
        result.current.activate();
      });

      await act(async () => {
        result.current.deactivate();
      });

      expect(result.current.accuracyPercent).toBe(0);
    });
  });

  describe("pitch judgment", () => {
    it("activates and deactivates listening", async () => {
      const { result } = renderHook(() =>
        usePitchPractice({
          notes: sampleNotes,
          getPositionSec: () => 0.5,
        }),
      );

      expect(result.current.active).toBe(false);

      await act(async () => {
        result.current.activate();
      });

      expect(result.current.active).toBe(true);
      expect(mockStartListening).toHaveBeenCalled();

      await act(async () => {
        result.current.deactivate();
      });

      expect(result.current.active).toBe(false);
      expect(mockStopListening).toHaveBeenCalled();
    });

  });

  describe("accuracy tracking", () => {
    it("starts with 0 accuracy before readings", async () => {
      const { result } = renderHook(() =>
        usePitchPractice({
          notes: sampleNotes,
          getPositionSec: () => 0.5,
        }),
      );

      await act(async () => {
        result.current.activate();
      });

      // Should start at 0 with no readings
      expect(result.current.accuracyPercent).toBe(0);
    });
  });

  describe("reset", () => {
    it("clears readings and accuracy", async () => {
      const { result } = renderHook(() =>
        usePitchPractice({
          notes: sampleNotes,
          getPositionSec: () => 0,
        }),
      );

      await act(async () => {
        result.current.activate();
      });

      await act(async () => {
        result.current.reset();
      });

      expect(result.current.accuracyPercent).toBe(0);
    });
  });

  describe("custom options", () => {
    it("accepts tolerance option", async () => {
      const { result } = renderHook(() =>
        usePitchPractice({
          notes: sampleNotes,
          getPositionSec: () => 0.5,
          toleranceCents: 50,
        }),
      );

      // Should initialize successfully with custom tolerance
      expect(result.current.active).toBe(false);
    });

    it("accepts octave-agnostic flag", async () => {
      const { result } = renderHook(() =>
        usePitchPractice({
          notes: sampleNotes,
          getPositionSec: () => 0.5,
          octaveAgnostic: true,
        }),
      );

      // Should initialize successfully with octave-agnostic mode
      expect(result.current.active).toBe(false);
    });
  });
});
