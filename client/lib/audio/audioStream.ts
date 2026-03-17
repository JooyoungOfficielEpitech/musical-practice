import LiveAudioStream from "react-native-live-audio-stream";
import { DEFAULT_AUDIO_CONFIG } from "./types";
import type { AudioStreamConfig } from "./types";

let isInitialized = false;

/**
 * Convert base64-encoded PCM Int16 data to Float32Array.
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

  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768;
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
 * Throttles the callback to avoid CoreAudio overload.
 */
export function startAudioStream(
  onData: (audioData: Float32Array) => void,
): () => void {
  if (!isInitialized) {
    initAudioStream();
  }

  let processing = false;

  LiveAudioStream.on("data", (base64Data: string) => {
    // Drop frames if previous one is still being processed
    if (processing) return;
    processing = true;

    try {
      const float32Data = base64ToFloat32(base64Data);
      if (float32Data.length > 0) {
        onData(float32Data);
      }
    } finally {
      processing = false;
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
