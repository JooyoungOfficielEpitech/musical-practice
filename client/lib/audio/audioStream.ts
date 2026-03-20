import LiveAudioStream from "react-native-live-audio-stream";
import { DEFAULT_AUDIO_CONFIG } from "./types";
import type { AudioStreamConfig } from "./types";

let isInitialized = false;

/**
 * Convert base64-encoded PCM Int16 data to Float32Array.
 * Optimized: uses Uint8Array + DataView for direct typed array conversion.
 */
export function base64ToFloat32(base64: string): Float32Array {
  if (!base64 || base64.length === 0) {
    return new Float32Array(0);
  }

  const binaryString = atob(base64);
  const len = binaryString.length;
  if (len === 0) {
    return new Float32Array(0);
  }

  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Direct typed array view — no intermediate copy
  const int16View = new DataView(bytes.buffer);
  const sampleCount = len >>> 1; // len / 2
  const float32Array = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    float32Array[i] = int16View.getInt16(i * 2, true) / 32768;
  }

  return float32Array;
}

/**
 * Initialize the audio stream with the given config.
 */
export function initAudioStream(
  config: AudioStreamConfig = DEFAULT_AUDIO_CONFIG,
): void {
  if (isInitialized) return;

  LiveAudioStream.init({
    sampleRate: config.sampleRate,
    channels: config.channels,
    bitsPerSample: config.bitsPerSample,
    audioSource: config.audioSource,
    wavFile: "",
    // 4096 bytes = 2048 Int16 samples = exactly what pitchy needs
    bufferSize: 4096,
  });

  isInitialized = true;
}

/**
 * Start the audio stream. Returns cleanup function.
 * Ring buffer in pitchDetector handles backpressure — no frame dropping needed.
 */
export function startAudioStream(
  onData: (audioData: Float32Array) => void,
): () => void {
  if (!isInitialized) {
    initAudioStream();
  }

  LiveAudioStream.on("data", (base64Data: string) => {
    const float32Data = base64ToFloat32(base64Data);
    if (float32Data.length > 0) {
      onData(float32Data);
    }
  });

  LiveAudioStream.start();

  return () => {
    LiveAudioStream.stop();
    isInitialized = false;
  };
}

/**
 * Stop the audio stream.
 */
export function stopAudioStream(): void {
  try {
    LiveAudioStream.stop();
  } catch {
    // Stream may not be running
  }
  isInitialized = false;
}
