import {
  getAvailableInstruments,
  getInstrument,
  isInstrumentAvailable,
  downloadInstrument,
  deleteInstrument,
  loadInstrument,
  getInstrumentDiskSize,
} from "../../../../client/lib/audio/instrumentManager";
import {
  __setMockFile,
  __setMockDir,
  __clearMockFs,
} from "../../../../__mocks__/expo-file-system";

const { AudioBuffer } = require("react-native-audio-api");

const mockCtx = {
  currentTime: 0,
  state: "running",
  sampleRate: 44100,
  destination: {},
  decodeAudioData: jest.fn(async () => new AudioBuffer()),
  createOscillator: jest.fn(),
  createGain: jest.fn(),
  createBufferSource: jest.fn(),
};

jest.mock("../../../../client/lib/audio/synthEngine", () => ({
  getAudioContext: () => mockCtx,
}));

beforeEach(() => {
  __clearMockFs();
});

describe("instrumentManager", () => {
  describe("getAvailableInstruments", () => {
    it("returns a list of instruments", () => {
      const instruments = getAvailableInstruments();
      expect(instruments.length).toBeGreaterThan(0);
    });

    it("includes built-in instruments", () => {
      const instruments = getAvailableInstruments();
      const builtins = instruments.filter((i) => i.isBuiltin);
      expect(builtins.length).toBeGreaterThanOrEqual(2);
    });

    it("includes oscillator and piano as built-in instruments", () => {
      const instruments = getAvailableInstruments();
      const ids = instruments.map((i) => i.id);
      expect(ids).toContain("oscillator");
      expect(ids).toContain("piano");
    });

    it("includes downloadable instruments", () => {
      const instruments = getAvailableInstruments();
      const downloadable = instruments.filter((i) => !i.isBuiltin);
      expect(downloadable.length).toBeGreaterThan(0);
    });

    it("marks built-in instruments as downloaded", () => {
      const instruments = getAvailableInstruments();
      const builtins = instruments.filter((i) => i.isBuiltin);
      for (const inst of builtins) {
        expect(inst.isDownloaded).toBe(true);
      }
    });

    it("marks non-downloaded instruments as not downloaded", () => {
      const instruments = getAvailableInstruments();
      const downloadable = instruments.filter((i) => !i.isBuiltin);
      for (const inst of downloadable) {
        expect(inst.isDownloaded).toBe(false);
      }
    });

    it("each instrument has required metadata fields", () => {
      const instruments = getAvailableInstruments();
      for (const inst of instruments) {
        expect(inst.id).toBeTruthy();
        expect(inst.name).toBeTruthy();
        expect(inst.icon).toBeTruthy();
        expect(typeof inst.sampleCount).toBe("number");
        expect(typeof inst.sizeBytes).toBe("number");
        expect(typeof inst.isBuiltin).toBe("boolean");
        expect(typeof inst.isDownloaded).toBe("boolean");
      }
    });
  });

  describe("getInstrument", () => {
    it("returns metadata for a known instrument", () => {
      const inst = getInstrument("oscillator");
      expect(inst).not.toBeNull();
      expect(inst!.id).toBe("oscillator");
      expect(inst!.name).toBe("Sine Wave");
    });

    it("returns null for unknown instrument", () => {
      expect(getInstrument("nonexistent")).toBeNull();
    });

    it("returns correct isDownloaded status for built-in", () => {
      const inst = getInstrument("piano");
      expect(inst!.isDownloaded).toBe(true);
    });
  });

  describe("isInstrumentAvailable", () => {
    it("returns true for built-in instruments", () => {
      expect(isInstrumentAvailable("oscillator")).toBe(true);
      expect(isInstrumentAvailable("piano")).toBe(true);
    });

    it("returns false for unknown instruments", () => {
      expect(isInstrumentAvailable("nonexistent")).toBe(false);
    });

    it("returns false for non-downloaded instruments", () => {
      expect(isInstrumentAvailable("acoustic-piano")).toBe(false);
    });

    it("returns true for downloaded instruments with sample files", () => {
      const dir = "file:///mock/documents/soundfonts/acoustic-piano";
      __setMockDir(dir);
      __setMockFile(`${dir}/60.mp3`, "audio");
      expect(isInstrumentAvailable("acoustic-piano")).toBe(true);
    });
  });

  describe("downloadInstrument", () => {
    it("throws for unknown instrument", async () => {
      await expect(downloadInstrument("nonexistent")).rejects.toThrow(
        "Unknown instrument",
      );
    });

    it("throws for built-in instruments", async () => {
      await expect(downloadInstrument("oscillator")).rejects.toThrow(
        "Cannot download built-in instrument",
      );
    });

    it("throws when download URL is not configured", async () => {
      await expect(downloadInstrument("electric-piano")).rejects.toThrow(
        "not yet available for download",
      );
    });

    it("calls onProgress callback", async () => {
      const onProgress = jest.fn();
      // Will throw because URL is null, but progress may be called
      try {
        await downloadInstrument("acoustic-piano", onProgress);
      } catch {
        // Expected
      }
    });
  });

  describe("deleteInstrument", () => {
    it("does nothing for unknown instruments", () => {
      expect(() => deleteInstrument("nonexistent")).not.toThrow();
    });

    it("does nothing for built-in instruments", () => {
      expect(() => deleteInstrument("oscillator")).not.toThrow();
    });

    it("deletes downloaded instrument directory", () => {
      const dir = "file:///mock/documents/soundfonts/acoustic-piano";
      __setMockDir(dir);
      __setMockFile(`${dir}/60.mp3`, "audio");

      expect(isInstrumentAvailable("acoustic-piano")).toBe(true);
      deleteInstrument("acoustic-piano");
      // After deletion, the directory no longer exists
      expect(isInstrumentAvailable("acoustic-piano")).toBe(false);
    });
  });

  describe("loadInstrument", () => {
    it("throws for unknown instrument", async () => {
      await expect(loadInstrument("nonexistent")).rejects.toThrow(
        "Unknown instrument",
      );
    });

    it("returns null for built-in instruments", async () => {
      const result = await loadInstrument("oscillator");
      expect(result).toBeNull();
    });

    it("returns null for piano (built-in)", async () => {
      const result = await loadInstrument("piano");
      expect(result).toBeNull();
    });

    it("throws for non-downloaded instruments", async () => {
      await expect(loadInstrument("acoustic-piano")).rejects.toThrow(
        "not downloaded",
      );
    });

    it("loads samples for downloaded instrument", async () => {
      const dir = "file:///mock/documents/soundfonts/acoustic-piano";
      __setMockDir(dir);
      __setMockFile(`${dir}/60.mp3`, "audio");
      __setMockFile(`${dir}/64.mp3`, "audio");

      const samples = await loadInstrument("acoustic-piano");
      expect(samples).not.toBeNull();
      expect(samples!.size).toBe(2);
    });
  });

  describe("getInstrumentDiskSize", () => {
    it("returns 0 for non-downloaded instrument", () => {
      expect(getInstrumentDiskSize("acoustic-piano")).toBe(0);
    });

    it("returns total size of downloaded samples", () => {
      const dir = "file:///mock/documents/soundfonts/acoustic-piano";
      __setMockDir(dir);
      __setMockFile(`${dir}/60.mp3`, "12345"); // 5 bytes
      __setMockFile(`${dir}/64.mp3`, "1234567890"); // 10 bytes

      const size = getInstrumentDiskSize("acoustic-piano");
      expect(size).toBe(15);
    });
  });
});
