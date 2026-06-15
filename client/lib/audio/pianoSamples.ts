import { getAudioContext, getMasterGain, registerSource } from "./audioContext";

/**
 * Built-in piano synthesizer using additive synthesis.
 * Generates richer piano-like tones by combining fundamental frequency
 * with harmonics and an exponential decay envelope.
 *
 * This serves as the default instrument until real samples are downloaded.
 */

/** Harmonic structure for piano-like timbre: [harmonic number, relative amplitude] */
const PIANO_HARMONICS: readonly [number, number][] = [
  [1, 1.0],    // Fundamental
  [2, 0.5],    // 2nd harmonic
  [3, 0.25],   // 3rd harmonic
  [4, 0.125],  // 4th harmonic
  [5, 0.06],   // 5th harmonic (subtle brightness)
  [6, 0.03],   // 6th harmonic
];

/**
 * Create a piano-like note using additive synthesis.
 * Combines multiple sine wave harmonics with exponential decay.
 *
 * @param frequency - Pitch in Hz
 * @param duration - Note length in seconds
 * @param startTime - When to start (AudioContext.currentTime seconds)
 * @param velocity - MIDI velocity (0-127) mapped to volume
 */
export function createPianoNote(
  frequency: number,
  duration: number,
  startTime: number,
  velocity: number,
): void {
  const ctx = getAudioContext();

  // Per-note gain for velocity + envelope; feeds the shared master bus so a
  // single fade can silence it instantly on Stop/Pause.
  const noteGain = ctx.createGain();
  const gain = Math.max(0, Math.min(1, velocity / 127)) * 0.4;
  noteGain.connect(getMasterGain());

  // Attack and decay envelope on the per-note gain
  const attackTime = 0.005; // Very fast attack (piano hammer strike)
  const decayTime = Math.min(duration * 0.3, 0.3); // Decay to sustain level
  const sustainLevel = 0.6; // Sustain at 60% of peak
  const releaseTime = Math.min(0.1, duration * 0.15);

  const attackEnd = startTime + attackTime;
  const decayEnd = attackEnd + decayTime;
  const releaseStart = startTime + duration - releaseTime;
  const noteEnd = startTime + duration;

  noteGain.gain.setValueAtTime(0, startTime);
  noteGain.gain.linearRampToValueAtTime(gain, attackEnd);
  noteGain.gain.linearRampToValueAtTime(gain * sustainLevel, decayEnd);

  if (releaseStart > decayEnd) {
    noteGain.gain.setValueAtTime(gain * sustainLevel, releaseStart);
  }
  noteGain.gain.linearRampToValueAtTime(0, noteEnd);

  // Create oscillators for each harmonic
  for (const [harmonic, amplitude] of PIANO_HARMONICS) {
    const harmonicFreq = frequency * harmonic;

    // Skip harmonics above Nyquist frequency
    if (harmonicFreq > ctx.sampleRate / 2) continue;

    const oscillator = ctx.createOscillator();
    const harmonicGain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(harmonicFreq, startTime);

    // Higher harmonics decay faster (natural piano behavior)
    const harmonicDecayRate = 1 + (harmonic - 1) * 0.5;
    const harmonicSustain = sustainLevel * Math.pow(0.7, harmonic - 1);

    harmonicGain.gain.setValueAtTime(0, startTime);
    harmonicGain.gain.linearRampToValueAtTime(amplitude, attackEnd);
    harmonicGain.gain.linearRampToValueAtTime(
      amplitude * harmonicSustain,
      attackEnd + decayTime / harmonicDecayRate,
    );

    const harmonicReleaseStart = startTime + duration - releaseTime;
    if (harmonicReleaseStart > attackEnd + decayTime / harmonicDecayRate) {
      harmonicGain.gain.setValueAtTime(
        amplitude * harmonicSustain,
        harmonicReleaseStart,
      );
    }
    harmonicGain.gain.linearRampToValueAtTime(0, noteEnd);

    oscillator.connect(harmonicGain);
    harmonicGain.connect(noteGain);

    oscillator.start(startTime);
    oscillator.stop(noteEnd);
    registerSource(oscillator, noteEnd);
  }
}

/**
 * Schedule a sequence of piano notes using additive synthesis.
 *
 * @param notes - Array of {frequency, duration, startTime, velocity} objects
 * @param offset - Time offset from AudioContext.currentTime (default 0.1s)
 * @returns The end time of the last scheduled note
 */
export function schedulePianoNotes(
  notes: {
    frequency: number;
    duration: number;
    startTime: number;
    velocity: number;
  }[],
  offset: number = 0.1,
): number {
  const ctx = getAudioContext();
  const baseTime = ctx.currentTime + offset;
  let endTime = baseTime;

  for (const note of notes) {
    const noteStart = baseTime + note.startTime;
    const noteEnd = noteStart + note.duration;

    createPianoNote(note.frequency, note.duration, noteStart, note.velocity);

    if (noteEnd > endTime) {
      endTime = noteEnd;
    }
  }

  return endTime;
}
