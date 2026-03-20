import {
  base64ToFloat32,
  initAudioStream,
  startAudioStream,
  stopAudioStream,
} from "../../../client/lib/audio/audioStream";

// Mock react-native-live-audio-stream
const mockInit = jest.fn();
const mockStart = jest.fn();
const mockStop = jest.fn();
const mockOn = jest.fn();

jest.mock("react-native-live-audio-stream", () => ({
  __esModule: true,
  default: {
    init: (...args: unknown[]) => mockInit(...args),
    start: (...args: unknown[]) => mockStart(...args),
    stop: (...args: unknown[]) => mockStop(...args),
    on: (...args: unknown[]) => mockOn(...args),
  },
}));

describe("audioStream", () => {
  beforeEach(() => {
    mockInit.mockReset();
    mockStart.mockReset();
    mockStop.mockReset();
    mockOn.mockReset();
    // Reset module state by calling stopAudioStream (sets isInitialized = false)
    stopAudioStream();
  });

  describe("base64ToFloat32", () => {
    it("returns empty Float32Array for empty string", () => {
      const result = base64ToFloat32("");
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(0);
    });

    it("returns empty Float32Array for null/undefined", () => {
      const result = base64ToFloat32(null as unknown as string);
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(0);
    });

    it("converts valid base64 PCM Int16 to Float32 in range [-1, 1]", () => {
      // Create a known Int16 sample: [0, 32767, -32768]
      const int16 = new Int16Array([0, 32767, -32768]);
      const bytes = new Uint8Array(int16.buffer);
      const base64 = btoa(String.fromCharCode(...bytes));

      const result = base64ToFloat32(base64);
      expect(result.length).toBe(3);
      expect(result[0]).toBeCloseTo(0, 4);           // 0/32768 = 0
      expect(result[1]).toBeCloseTo(0.99997, 3);      // 32767/32768 ≈ 1.0
      expect(result[2]).toBeCloseTo(-1.0, 4);          // -32768/32768 = -1.0
    });

    it("all output values are within [-1, 1] range", () => {
      // Random-ish Int16 values
      const int16 = new Int16Array([100, -100, 16384, -16384, 1, -1]);
      const bytes = new Uint8Array(int16.buffer);
      const base64 = btoa(String.fromCharCode(...bytes));

      const result = base64ToFloat32(base64);
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBeGreaterThanOrEqual(-1);
        expect(result[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("initAudioStream", () => {
    it("calls LiveAudioStream.init with correct config", () => {
      initAudioStream({
        sampleRate: 44100,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6,
      });

      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          sampleRate: 44100,
          channels: 1,
          bitsPerSample: 16,
        }),
      );
    });

    it("does NOT call init twice (idempotent)", () => {
      const config = {
        sampleRate: 44100,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6,
      };

      initAudioStream(config);
      initAudioStream(config);

      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    it("can re-initialize after stopAudioStream resets state", () => {
      const config = {
        sampleRate: 44100,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6,
      };

      initAudioStream(config);
      stopAudioStream();
      initAudioStream(config);

      expect(mockInit).toHaveBeenCalledTimes(2);
    });
  });

  describe("startAudioStream", () => {
    it("registers data listener and calls start", () => {
      const onData = jest.fn();
      startAudioStream(onData);

      expect(mockOn).toHaveBeenCalledWith("data", expect.any(Function));
      expect(mockStart).toHaveBeenCalledTimes(1);
    });

    it("auto-initializes if not already initialized", () => {
      const onData = jest.fn();
      startAudioStream(onData);

      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    it("returns a cleanup function that calls stop", () => {
      const onData = jest.fn();
      const cleanup = startAudioStream(onData);

      expect(typeof cleanup).toBe("function");
      cleanup();
      expect(mockStop).toHaveBeenCalled();
    });

    it("converts base64 data and passes Float32Array to callback", () => {
      const onData = jest.fn();

      // Capture the "data" callback
      mockOn.mockImplementation((_event: string, callback: (data: string) => void) => {
        // Simulate receiving data
        const int16 = new Int16Array([1000, -1000]);
        const bytes = new Uint8Array(int16.buffer);
        const base64 = btoa(String.fromCharCode(...bytes));
        callback(base64);
      });

      startAudioStream(onData);

      expect(onData).toHaveBeenCalledTimes(1);
      const receivedData = onData.mock.calls[0][0];
      expect(receivedData).toBeInstanceOf(Float32Array);
      expect(receivedData.length).toBe(2);
    });

    it("skips empty base64 data without calling onData", () => {
      const onData = jest.fn();

      mockOn.mockImplementation((_event: string, callback: (data: string) => void) => {
        callback(""); // empty data
      });

      startAudioStream(onData);

      expect(onData).not.toHaveBeenCalled();
    });
  });

  describe("stopAudioStream", () => {
    it("calls LiveAudioStream.stop", () => {
      initAudioStream();
      stopAudioStream();

      expect(mockStop).toHaveBeenCalled();
    });

    it("does not throw if stream was never started", () => {
      mockStop.mockImplementation(() => {
        throw new Error("not running");
      });

      expect(() => stopAudioStream()).not.toThrow();
    });

    it("resets isInitialized so stream can be re-initialized", () => {
      initAudioStream();
      stopAudioStream();

      mockInit.mockClear();
      initAudioStream();
      expect(mockInit).toHaveBeenCalledTimes(1);
    });
  });

  describe("Bug #3: frame dropping under load", () => {
    it("does not silently drop frames when processing is fast", () => {
      const onData = jest.fn();
      let dataCallback: ((data: string) => void) | null = null;

      mockOn.mockImplementation((_event: string, cb: (data: string) => void) => {
        dataCallback = cb;
      });

      startAudioStream(onData);

      // Simulate 5 rapid frames
      const int16 = new Int16Array([100]);
      const bytes = new Uint8Array(int16.buffer);
      const base64 = btoa(String.fromCharCode(...bytes));

      for (let i = 0; i < 5; i++) {
        dataCallback!(base64);
      }

      // All 5 should be delivered (no silent drops)
      expect(onData).toHaveBeenCalledTimes(5);
    });
  });

  describe("Bug #4: global state after stop", () => {
    it("allows clean restart after stop", () => {
      const onData1 = jest.fn();
      const onData2 = jest.fn();

      startAudioStream(onData1);
      stopAudioStream();

      mockInit.mockClear();
      mockStart.mockClear();
      mockOn.mockClear();

      startAudioStream(onData2);

      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(mockStart).toHaveBeenCalledTimes(1);
      expect(mockOn).toHaveBeenCalledWith("data", expect.any(Function));
    });
  });

  describe("base64ToFloat32 performance", () => {
    it("converts 4096 bytes (2048 samples) in under 5ms per call (1000 iterations)", () => {
      // Create 4096 bytes of PCM data (2048 Int16 samples)
      const int16 = new Int16Array(2048);
      for (let i = 0; i < 2048; i++) {
        int16[i] = Math.floor(Math.random() * 65536) - 32768;
      }
      const bytes = new Uint8Array(int16.buffer);
      const base64 = btoa(String.fromCharCode(...bytes));

      const iterations = 1000;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        base64ToFloat32(base64);
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      // Should be well under 5ms per call
      expect(avgMs).toBeLessThan(5);
    });
  });
});
