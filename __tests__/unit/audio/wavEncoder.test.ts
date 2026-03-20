import { encodeWav, float32ToInt16 } from "../../../client/lib/audio/wavEncoder";

describe("wavEncoder", () => {
  describe("float32ToInt16", () => {
    it("converts normalized float32 samples to int16", () => {
      const float32 = new Float32Array([0.0, 1.0, -1.0, 0.5, -0.5]);
      const int16 = float32ToInt16(float32);

      expect(int16).toBeInstanceOf(Int16Array);
      expect(int16.length).toBe(5);
      expect(int16[0]).toBe(0); // silence
      expect(int16[1]).toBe(32767); // max positive
      expect(int16[2]).toBe(-32768); // max negative
      expect(int16[3]).toBe(16383); // half positive (0.5 * 32767)
      expect(int16[4]).toBe(-16384); // half negative (0.5 * -32768)
    });

    it("clamps values beyond -1.0 to 1.0", () => {
      const float32 = new Float32Array([1.5, -1.5]);
      const int16 = float32ToInt16(float32);

      expect(int16[0]).toBe(32767);
      expect(int16[1]).toBe(-32768);
    });

    it("handles empty input", () => {
      const float32 = new Float32Array(0);
      const int16 = float32ToInt16(float32);
      expect(int16.length).toBe(0);
    });
  });

  describe("encodeWav", () => {
    const SAMPLE_RATE = 44100;

    it("produces valid WAV header (44 bytes)", () => {
      const chunks = [new Float32Array([0.1, 0.2, 0.3])];
      const wav = encodeWav(chunks, SAMPLE_RATE);
      const view = new DataView(wav);

      // RIFF header
      expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)))
        .toBe("RIFF");

      // WAVE format
      expect(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)))
        .toBe("WAVE");

      // fmt sub-chunk
      expect(String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15)))
        .toBe("fmt ");

      // Audio format: PCM = 1
      expect(view.getUint16(20, true)).toBe(1);

      // Channels: mono = 1
      expect(view.getUint16(22, true)).toBe(1);

      // Sample rate
      expect(view.getUint32(24, true)).toBe(SAMPLE_RATE);

      // Bits per sample: 16
      expect(view.getUint16(34, true)).toBe(16);

      // data sub-chunk
      expect(String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39)))
        .toBe("data");
    });

    it("has correct file size in header", () => {
      const samples = new Float32Array(100);
      const wav = encodeWav([samples], SAMPLE_RATE);
      const view = new DataView(wav);

      const dataSize = 100 * 2; // 100 samples * 2 bytes per Int16
      // RIFF chunk size = file size - 8
      expect(view.getUint32(4, true)).toBe(wav.byteLength - 8);
      // data chunk size
      expect(view.getUint32(40, true)).toBe(dataSize);
      // total file size = 44 header + data
      expect(wav.byteLength).toBe(44 + dataSize);
    });

    it("concatenates multiple chunks", () => {
      const chunk1 = new Float32Array([0.5, 0.5]);
      const chunk2 = new Float32Array([0.25, 0.25, 0.25]);
      const wav = encodeWav([chunk1, chunk2], SAMPLE_RATE);

      const totalSamples = 5;
      const dataSize = totalSamples * 2;
      expect(wav.byteLength).toBe(44 + dataSize);

      // Verify data chunk size
      const view = new DataView(wav);
      expect(view.getUint32(40, true)).toBe(dataSize);
    });

    it("handles empty chunks array", () => {
      const wav = encodeWav([], SAMPLE_RATE);
      const view = new DataView(wav);

      expect(wav.byteLength).toBe(44); // header only
      expect(view.getUint32(40, true)).toBe(0); // no data
    });

    it("encodes audio data correctly after header", () => {
      const chunks = [new Float32Array([0.0, 1.0, -1.0])];
      const wav = encodeWav(chunks, SAMPLE_RATE);
      const view = new DataView(wav);

      // Read Int16 values from data section (offset 44)
      expect(view.getInt16(44, true)).toBe(0); // 0.0
      expect(view.getInt16(46, true)).toBe(32767); // 1.0
      expect(view.getInt16(48, true)).toBe(-32768); // -1.0
    });

    it("handles large data (60 seconds at 44.1kHz)", () => {
      const samplesPerSecond = SAMPLE_RATE;
      const seconds = 60;
      const totalSamples = samplesPerSecond * seconds;

      // Split into 1-second chunks (like real audio streaming)
      const chunks: Float32Array[] = [];
      for (let i = 0; i < seconds; i++) {
        chunks.push(new Float32Array(samplesPerSecond));
      }

      const wav = encodeWav(chunks, SAMPLE_RATE);
      const expectedSize = 44 + totalSamples * 2;
      expect(wav.byteLength).toBe(expectedSize);

      // Verify header integrity
      const view = new DataView(wav);
      expect(view.getUint32(4, true)).toBe(expectedSize - 8);
      expect(view.getUint32(40, true)).toBe(totalSamples * 2);
    });
  });
});
