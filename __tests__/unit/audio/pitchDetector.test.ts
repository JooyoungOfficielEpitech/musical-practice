import { initDetector, detectPitch, destroyDetector } from "../../../client/lib/audio/pitchDetector";

// Mock pitchy
const mockFindPitch = jest.fn();
jest.mock("pitchy", () => ({
  PitchDetector: {
    forFloat32Array: jest.fn(() => ({
      findPitch: mockFindPitch,
      minVolumeDecibels: -30,
    })),
  },
}));

// Mock noteMapping — let real logic run for most tests
jest.mock("../../../client/lib/audio/noteMapping", () => ({
  frequencyToNote: jest.fn((freq: number) => {
    if (freq <= 0 || freq < 80 || freq > 1100) return null;
    return { name: "A", octave: 4, frequency: 440 };
  }),
  calculateCents: jest.fn(() => 5),
}));

describe("pitchDetector", () => {
  beforeEach(() => {
    destroyDetector();
    mockFindPitch.mockReset();
  });

  describe("detectPitch with empty/null input", () => {
    it("returns null for empty Float32Array", () => {
      initDetector(44100);
      const result = detectPitch(new Float32Array(0), 44100);
      expect(result).toBeNull();
    });

    it("returns null for null-ish input", () => {
      initDetector(44100);
      const result = detectPitch(null as unknown as Float32Array, 44100);
      expect(result).toBeNull();
    });
  });

  describe("accumulator behavior", () => {
    it("returns null when buffer is smaller than 2048", () => {
      initDetector(44100);
      const smallBuffer = new Float32Array(1024);
      const result = detectPitch(smallBuffer, 44100);
      expect(result).toBeNull();
      // pitchy should NOT have been called
      expect(mockFindPitch).not.toHaveBeenCalled();
    });

    it("accumulates small buffers until reaching 2048", () => {
      initDetector(44100);
      mockFindPitch.mockReturnValue([440, 0.95]);

      // First call: 1024 samples — not enough
      const result1 = detectPitch(new Float32Array(1024), 44100);
      expect(result1).toBeNull();
      expect(mockFindPitch).not.toHaveBeenCalled();

      // Second call: another 1024 — total 2048, now enough
      const result2 = detectPitch(new Float32Array(1024), 44100);
      expect(result2).not.toBeNull();
      expect(mockFindPitch).toHaveBeenCalledTimes(1);
    });

    it("processes exactly 2048 samples in one call", () => {
      initDetector(44100);
      mockFindPitch.mockReturnValue([440, 0.95]);

      const buffer = new Float32Array(2048);
      const result = detectPitch(buffer, 44100);
      expect(result).not.toBeNull();
      expect(mockFindPitch).toHaveBeenCalledTimes(1);

      // Verify pitchy received exactly 2048 samples
      const inputArg = mockFindPitch.mock.calls[0][0];
      expect(inputArg.length).toBe(2048);
    });

    it("handles buffer larger than 2048", () => {
      initDetector(44100);
      mockFindPitch.mockReturnValue([440, 0.95]);

      const buffer = new Float32Array(4096);
      const result = detectPitch(buffer, 44100);
      expect(result).not.toBeNull();

      // pitchy should still receive exactly 2048
      const inputArg = mockFindPitch.mock.calls[0][0];
      expect(inputArg.length).toBe(2048);
    });

    // Bug #1: accumulator should not grow unbounded
    it("does NOT leak memory — accumulator stays bounded after repeated calls", () => {
      initDetector(44100);
      mockFindPitch.mockReturnValue([440, 0.95]);

      // Feed 100 buffers of 2048 each
      for (let i = 0; i < 100; i++) {
        detectPitch(new Float32Array(2048), 44100);
      }

      // After processing, feed one more small buffer and check it works
      mockFindPitch.mockClear();
      const result = detectPitch(new Float32Array(2048), 44100);
      expect(result).not.toBeNull();
      expect(mockFindPitch).toHaveBeenCalledTimes(1);
    });

    // Bug #1 specific: after processing, accumulator should be cleared or minimal
    it("clears accumulator after processing a full buffer", () => {
      initDetector(44100);
      mockFindPitch.mockReturnValue([440, 0.95]);

      // Process a full buffer
      detectPitch(new Float32Array(2048), 44100);

      // Next small buffer should NOT trigger detection (accumulator was cleared)
      mockFindPitch.mockClear();
      const result = detectPitch(new Float32Array(512), 44100);
      expect(result).toBeNull();
      expect(mockFindPitch).not.toHaveBeenCalled();
    });
  });

  describe("clarity threshold", () => {
    it("returns null when clarity is below 0.85", () => {
      initDetector(44100);
      mockFindPitch.mockReturnValue([440, 0.5]); // low clarity

      const result = detectPitch(new Float32Array(2048), 44100);
      expect(result).toBeNull();
    });

    it("returns result when clarity is exactly 0.85", () => {
      initDetector(44100);
      mockFindPitch.mockReturnValue([440, 0.85]);

      const result = detectPitch(new Float32Array(2048), 44100);
      expect(result).not.toBeNull();
    });

    it("returns result when clarity is above 0.85", () => {
      initDetector(44100);
      mockFindPitch.mockReturnValue([440, 0.95]);

      const result = detectPitch(new Float32Array(2048), 44100);
      expect(result).not.toBeNull();
      expect(result!.frequency).toBe(440);
      expect(result!.note).toBe("A");
      expect(result!.octave).toBe(4);
      expect(result!.clarity).toBe(0.95);
    });
  });

  describe("frequency validation", () => {
    it("returns null when frequency is 0", () => {
      initDetector(44100);
      mockFindPitch.mockReturnValue([0, 0.95]);

      const result = detectPitch(new Float32Array(2048), 44100);
      expect(result).toBeNull();
    });

    it("returns null when frequency is negative", () => {
      initDetector(44100);
      mockFindPitch.mockReturnValue([-100, 0.95]);

      const result = detectPitch(new Float32Array(2048), 44100);
      expect(result).toBeNull();
    });
  });

  describe("error handling (Bug #2)", () => {
    it("returns null when pitchy throws, without crashing", () => {
      initDetector(44100);
      mockFindPitch.mockImplementation(() => {
        throw new Error("pitchy internal error");
      });

      const result = detectPitch(new Float32Array(2048), 44100);
      expect(result).toBeNull();
    });

    it("logs a warning when pitchy throws", () => {
      initDetector(44100);
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      mockFindPitch.mockImplementation(() => {
        throw new Error("buffer corruption");
      });

      detectPitch(new Float32Array(2048), 44100);
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0][0]).toContain("Pitch detection error");

      warnSpy.mockRestore();
    });
  });

  describe("initDetector / destroyDetector", () => {
    it("auto-initializes if detectPitch is called without init", () => {
      // Don't call initDetector
      mockFindPitch.mockReturnValue([440, 0.95]);

      const result = detectPitch(new Float32Array(2048), 44100);
      expect(result).not.toBeNull();
    });

    it("destroyDetector resets accumulator", () => {
      initDetector(44100);

      // Add partial data to accumulator
      detectPitch(new Float32Array(1024), 44100);

      // Destroy
      destroyDetector();

      // After destroy + re-init, small buffer should not trigger (no leftover data)
      initDetector(44100);
      mockFindPitch.mockClear();
      const result = detectPitch(new Float32Array(512), 44100);
      expect(result).toBeNull();
      expect(mockFindPitch).not.toHaveBeenCalled();
    });
  });
});
