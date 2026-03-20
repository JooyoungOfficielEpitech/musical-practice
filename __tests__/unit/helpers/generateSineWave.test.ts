import { generateSineWave } from "../../helpers/generateSineWave";

describe("generateSineWave", () => {
  it("returns a Float32Array with correct default length", () => {
    const wave = generateSineWave({ frequency: 440 });
    // default: 44100 * 0.1 = 4410 samples
    expect(wave).toBeInstanceOf(Float32Array);
    expect(wave.length).toBe(4410);
  });

  it("respects custom sampleRate and duration", () => {
    const wave = generateSineWave({
      frequency: 440,
      sampleRate: 48000,
      duration: 0.2,
    });
    expect(wave.length).toBe(9600);
  });

  it("all values are within [-amplitude, +amplitude]", () => {
    const amplitude = 0.5;
    const wave = generateSineWave({ frequency: 440, amplitude });

    for (let i = 0; i < wave.length; i++) {
      expect(wave[i]).toBeGreaterThanOrEqual(-amplitude);
      expect(wave[i]).toBeLessThanOrEqual(amplitude);
    }
  });

  it("generates correct frequency content via zero-crossing count", () => {
    const frequency = 440;
    const sampleRate = 44100;
    const duration = 0.1;
    const wave = generateSineWave({ frequency, sampleRate, duration });

    // Count zero crossings (sign changes)
    let crossings = 0;
    for (let i = 1; i < wave.length; i++) {
      if (wave[i - 1] * wave[i] < 0) {
        crossings++;
      }
    }

    // A sine wave crosses zero twice per cycle
    const expectedCycles = frequency * duration;
    const expectedCrossings = expectedCycles * 2;

    // Allow ±2 crossings tolerance for edge effects
    expect(crossings).toBeGreaterThanOrEqual(expectedCrossings - 2);
    expect(crossings).toBeLessThanOrEqual(expectedCrossings + 2);
  });

  it("generates silence (all zeros) for amplitude 0", () => {
    const wave = generateSineWave({ frequency: 440, amplitude: 0 });
    for (let i = 0; i < wave.length; i++) {
      expect(wave[i]).toBeCloseTo(0);
    }
  });
});
