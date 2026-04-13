import { AudioBuffer } from "react-native-audio-api";
import {
  loadInstrumentSamples,
  loadSampleFromUri,
  clearSampleCache,
  getInstrumentSampleDir,
  instrumentSamplesExist,
} from "../../../../client/lib/audio/soundFontLoader";
import {
  __setMockFile,
  __setMockDir,
  __clearMockFs,
} from "../../../../__mocks__/expo-file-system";

// Mock synthEngine with a mock AudioContext
const mockCtx = {
  currentTime: 0,
  state: "running",
  sampleRate: 44100,
  destination: {},
  decodeAudioData: jest.fn(async () => new AudioBuffer({} as any)),
  createOscillator: jest.fn(),
  createGain: jest.fn(),
  createBufferSource: jest.fn(),
};

jest.mock("../../../../client/lib/audio/synthEngine", () => ({
  getAudioContext: () => mockCtx,
}));

beforeEach(() => {
  __clearMockFs();
  clearSampleCache();
});

describe("soundFontLoader", () => {
  describe("loadInstrumentSamples", () => {
    it("throws when instrument directory does not exist", async () => {
      await expect(
        loadInstrumentSamples("file:///nonexistent/dir"),
      ).rejects.toThrow("Instrument directory does not exist");
    });

    it("loads samples from a directory with .mp3 files", async () => {
      const dir = "file:///mock/instruments/piano";
      __setMockDir(dir);
      __setMockFile(`${dir}/60.mp3`, "audio-data-60");
      __setMockFile(`${dir}/64.mp3`, "audio-data-64");
      __setMockFile(`${dir}/67.mp3`, "audio-data-67");

      const samples = await loadInstrumentSamples(dir);

      expect(samples.size).toBe(3);
      expect(samples.has(60)).toBe(true);
      expect(samples.has(64)).toBe(true);
      expect(samples.has(67)).toBe(true);
    });

    it("returns AudioBuffer instances for each sample", async () => {
      const dir = "file:///mock/instruments/test";
      __setMockDir(dir);
      __setMockFile(`${dir}/60.mp3`, "audio-data");

      const samples = await loadInstrumentSamples(dir);
      const buffer = samples.get(60);

      expect(buffer).toBeInstanceOf(AudioBuffer);
    });

    it("ignores non-audio files in the directory", async () => {
      const dir = "file:///mock/instruments/mixed";
      __setMockDir(dir);
      __setMockFile(`${dir}/60.mp3`, "audio");
      __setMockFile(`${dir}/readme.txt`, "text");
      __setMockFile(`${dir}/config.json`, "json");

      const samples = await loadInstrumentSamples(dir);
      expect(samples.size).toBe(1);
      expect(samples.has(60)).toBe(true);
    });

    it("supports .wav, .m4a, and .ogg extensions", async () => {
      const dir = "file:///mock/instruments/multi";
      __setMockDir(dir);
      __setMockFile(`${dir}/60.wav`, "wav-data");
      __setMockFile(`${dir}/64.m4a`, "m4a-data");
      __setMockFile(`${dir}/67.ogg`, "ogg-data");

      const samples = await loadInstrumentSamples(dir);
      expect(samples.size).toBe(3);
    });

    it("returns cached samples on second call", async () => {
      const dir = "file:///mock/instruments/cached";
      __setMockDir(dir);
      __setMockFile(`${dir}/60.mp3`, "audio");

      const first = await loadInstrumentSamples(dir);
      const second = await loadInstrumentSamples(dir);

      expect(first).toBe(second); // Same reference
    });

    it("returns empty map for directory with no audio files", async () => {
      const dir = "file:///mock/instruments/empty";
      __setMockDir(dir);
      __setMockFile(`${dir}/notes.txt`, "text");

      const samples = await loadInstrumentSamples(dir);
      expect(samples.size).toBe(0);
    });

    it("skips invalid MIDI numbers (>127)", async () => {
      const dir = "file:///mock/instruments/invalid";
      __setMockDir(dir);
      __setMockFile(`${dir}/200.mp3`, "audio");
      __setMockFile(`${dir}/60.mp3`, "audio");

      const samples = await loadInstrumentSamples(dir);
      expect(samples.size).toBe(1);
      expect(samples.has(60)).toBe(true);
      expect(samples.has(200)).toBe(false);
    });
  });

  describe("loadSampleFromUri", () => {
    it("returns an AudioBuffer", async () => {
      const buffer = await loadSampleFromUri("file:///some/sample.mp3");
      expect(buffer).toBeInstanceOf(AudioBuffer);
    });
  });

  describe("clearSampleCache", () => {
    it("clears cache for specific directory", async () => {
      const dir = "file:///mock/instruments/clearme";
      __setMockDir(dir);
      __setMockFile(`${dir}/60.mp3`, "audio");

      const first = await loadInstrumentSamples(dir);
      clearSampleCache(dir);
      const second = await loadInstrumentSamples(dir);

      // Different references after cache clear
      expect(first).not.toBe(second);
    });

    it("clears entire cache when no argument given", async () => {
      const dir1 = "file:///mock/instruments/a";
      const dir2 = "file:///mock/instruments/b";
      __setMockDir(dir1);
      __setMockDir(dir2);
      __setMockFile(`${dir1}/60.mp3`, "audio");
      __setMockFile(`${dir2}/60.mp3`, "audio");

      const first1 = await loadInstrumentSamples(dir1);
      const first2 = await loadInstrumentSamples(dir2);
      clearSampleCache();
      const second1 = await loadInstrumentSamples(dir1);
      const second2 = await loadInstrumentSamples(dir2);

      expect(first1).not.toBe(second1);
      expect(first2).not.toBe(second2);
    });
  });

  describe("getInstrumentSampleDir", () => {
    it("returns a path under documents/soundfonts/", () => {
      const dir = getInstrumentSampleDir("acoustic-piano");
      expect(dir).toContain("soundfonts/acoustic-piano");
    });
  });

  describe("instrumentSamplesExist", () => {
    it("returns false when directory does not exist", () => {
      expect(instrumentSamplesExist("nonexistent")).toBe(false);
    });

    it("returns false when directory exists but has no audio files", () => {
      const dir = "file:///mock/documents/soundfonts/empty-inst";
      __setMockDir(dir);
      __setMockFile(`${dir}/readme.txt`, "text");
      expect(instrumentSamplesExist("empty-inst")).toBe(false);
    });

    it("returns true when directory has audio sample files", () => {
      const dir = "file:///mock/documents/soundfonts/has-samples";
      __setMockDir(dir);
      __setMockFile(`${dir}/60.mp3`, "audio");
      expect(instrumentSamplesExist("has-samples")).toBe(true);
    });
  });
});
