/**
 * Convert Float32 samples (-1.0 to 1.0) to Int16 samples (-32768 to 32767).
 */
export function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
  }
  return int16;
}

/**
 * Encode Float32Array chunks into a WAV file ArrayBuffer.
 * Format: 44.1kHz, 16-bit, mono PCM.
 */
export function encodeWav(
  chunks: Float32Array[],
  sampleRate: number,
): ArrayBuffer {
  // Count total samples
  let totalSamples = 0;
  for (const chunk of chunks) {
    totalSamples += chunk.length;
  }

  const dataSize = totalSamples * 2; // 16-bit = 2 bytes per sample
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true); // file size - 8
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // sub-chunk size (PCM = 16)
  view.setUint16(20, 1, true); // audio format (PCM = 1)
  view.setUint16(22, 1, true); // channels (mono = 1)
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate (sampleRate * channels * bitsPerSample/8)
  view.setUint16(32, 2, true); // block align (channels * bitsPerSample/8)
  view.setUint16(34, 16, true); // bits per sample

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Write PCM data
  let offset = 44;
  for (const chunk of chunks) {
    const int16 = float32ToInt16(chunk);
    for (let i = 0; i < int16.length; i++) {
      view.setInt16(offset, int16[i], true);
      offset += 2;
    }
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
