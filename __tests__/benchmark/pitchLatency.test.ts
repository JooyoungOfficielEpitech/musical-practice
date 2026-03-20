import { initDetector, detectPitch, destroyDetector, INPUT_SIZE } from "../../client/lib/audio/pitchDetector";
import { base64ToFloat32 } from "../../client/lib/audio/audioStream";
import { RingBuffer } from "../../client/lib/audio/ringBuffer";
import { THROTTLE_MS } from "../../client/hooks/usePitchDetection";

// Mock pitchy for benchmark (we're measuring our code, not pitchy)
const mockFindPitch = jest.fn().mockReturnValue([440, 0.95]);
jest.mock("pitchy", () => ({
  PitchDetector: {
    forFloat32Array: jest.fn(() => ({
      findPitch: (...args: unknown[]) => mockFindPitch(...args),
      minVolumeDecibels: -30,
    })),
  },
}));

jest.mock("../../client/lib/audio/noteMapping", () => ({
  frequencyToNote: jest.fn(() => ({ name: "A", octave: 4, frequency: 440 })),
  calculateCents: jest.fn(() => 5),
}));

// Mock LiveAudioStream (not used in benchmarks but imported)
jest.mock("react-native-live-audio-stream", () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    on: jest.fn(),
  },
}));

// Mock expo-av (usePitchDetection imports Audio from expo-av)
jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  },
}));

function measureAvgMs(fn: () => void, iterations: number): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  return (performance.now() - start) / iterations;
}

describe("Pitch Detection Latency Benchmarks", () => {
  beforeEach(() => {
    destroyDetector();
    mockFindPitch.mockReturnValue([440, 0.95]);
  });

  describe("detectPitch performance", () => {
    it("processes a 2048-sample buffer in under 5ms (avg over 1000 calls)", () => {
      initDetector(44100);
      const buffer = new Float32Array(INPUT_SIZE);

      // Warm up
      for (let i = 0; i < 10; i++) {
        detectPitch(buffer, 44100);
      }

      const avgMs = measureAvgMs(() => {
        detectPitch(buffer, 44100);
      }, 1000);

      expect(avgMs).toBeLessThan(5);
    });
  });

  describe("base64ToFloat32 performance", () => {
    it("converts 4096 bytes in under 1ms (avg over 1000 calls)", () => {
      const int16 = new Int16Array(2048);
      for (let i = 0; i < 2048; i++) {
        int16[i] = Math.floor(Math.random() * 65536) - 32768;
      }
      const bytes = new Uint8Array(int16.buffer);
      const base64 = btoa(String.fromCharCode(...bytes));

      // Warm up
      for (let i = 0; i < 10; i++) {
        base64ToFloat32(base64);
      }

      const avgMs = measureAvgMs(() => {
        base64ToFloat32(base64);
      }, 1000);

      expect(avgMs).toBeLessThan(1);
    });
  });

  describe("RingBuffer performance", () => {
    it("write+peek+advance cycle in under 0.1ms (avg over 1000 calls)", () => {
      const rb = new RingBuffer(8192);
      const chunk = new Float32Array(1024);

      // Warm up
      for (let i = 0; i < 10; i++) {
        rb.write(chunk);
        rb.peek(2048);
        rb.advance(1024);
      }
      rb.clear();

      const avgMs = measureAvgMs(() => {
        rb.write(chunk);
        if (rb.availableRead >= 2048) {
          rb.peek(2048);
          rb.advance(1024);
        }
      }, 1000);

      expect(avgMs).toBeLessThan(0.1);
    });
  });

  describe("full pipeline performance", () => {
    it("base64 → detectPitch completes in under 10ms per call", () => {
      initDetector(44100);

      // Create realistic audio data (4096 bytes = 2048 Int16 samples)
      const int16 = new Int16Array(2048);
      for (let i = 0; i < 2048; i++) {
        int16[i] = Math.floor(Math.random() * 65536) - 32768;
      }
      const bytes = new Uint8Array(int16.buffer);
      const base64 = btoa(String.fromCharCode(...bytes));

      // Warm up
      for (let i = 0; i < 10; i++) {
        const data = base64ToFloat32(base64);
        detectPitch(data, 44100);
      }

      const avgMs = measureAvgMs(() => {
        const data = base64ToFloat32(base64);
        detectPitch(data, 44100);
      }, 500);

      expect(avgMs).toBeLessThan(10);
    });
  });

  describe("configuration constants", () => {
    it("THROTTLE_MS is 50ms (20fps)", () => {
      expect(THROTTLE_MS).toBe(50);
    });

    it("INPUT_SIZE is 2048", () => {
      expect(INPUT_SIZE).toBe(2048);
    });
  });
});
