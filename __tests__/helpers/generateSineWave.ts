/**
 * Generate a pure sine wave for testing pitch detection.
 */
export function generateSineWave(options: {
  frequency: number;
  sampleRate?: number;
  duration?: number;
  amplitude?: number;
}): Float32Array {
  const {
    frequency,
    sampleRate = 44100,
    duration = 0.1,
    amplitude = 0.8,
  } = options;

  const length = Math.round(sampleRate * duration);
  const buffer = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    buffer[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }

  return buffer;
}
