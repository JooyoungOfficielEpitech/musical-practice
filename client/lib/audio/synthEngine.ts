import { AudioBuffer } from "react-native-audio-api";
import type { NoteEvent } from "../../types/music";
import { getAudioContext, resumeAudioContext, closeAudioContext } from "./audioContext";
import { createPianoNote } from "./pianoSamples";
import { findClosestSample, playSample } from "./samplePlayer";

/** Envelope parameters for note shaping (in seconds). */
interface Envelope {
  attack: number;
  release: number;
}

/** A scheduled note with frequency, duration, and start time (all in seconds). */
export interface ScheduledNote {
  frequency: number;
  duration: number;
  startTime: number;
}

/** Instrument playback mode. */
export type InstrumentMode = "oscillator" | "piano" | "samples";

const DEFAULT_ENVELOPE: Envelope = {
  attack: 0.02,
  release: 0.05,
};

let currentMode: InstrumentMode = "piano";
let instrumentSamples: Map<number, AudioBuffer> | null = null;

export { getAudioContext, resumeAudioContext };

/** Set the instrument playback mode. */
export function setInstrumentMode(mode: InstrumentMode): void {
  currentMode = mode;
}

/** Get the current instrument playback mode. */
export function getInstrumentMode(): InstrumentMode {
  return currentMode;
}

/**
 * Set loaded instrument samples for 'samples' mode.
 * Pass null to clear.
 */
export function setInstrumentSamples(
  samples: Map<number, AudioBuffer> | null,
): void {
  instrumentSamples = samples;
}

/** Get the currently loaded instrument samples. */
export function getInstrumentSamples(): Map<number, AudioBuffer> | null {
  return instrumentSamples;
}

/**
 * Play a single note using an OscillatorNode + GainNode with an ADSR-like envelope.
 *
 * @param frequency - Pitch in Hz
 * @param duration - Note length in seconds
 * @param startTime - When to start (in AudioContext.currentTime seconds)
 * @param velocity - MIDI velocity (0-127), controls volume. Default 100.
 * @param envelope - Optional attack/release times
 */
export function playNote(
  frequency: number,
  duration: number,
  startTime: number,
  velocity: number = 100,
  envelope: Envelope = DEFAULT_ENVELOPE,
): void {
  const ctx = getAudioContext();

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);

  // Map velocity (0-127) to gain, capped at 0.8 to prevent clipping
  const gain = (Math.max(0, Math.min(127, velocity)) / 127) * 0.8;

  // Envelope: start silent, ramp up (attack), hold, ramp down (release)
  const attackEnd = startTime + envelope.attack;
  const releaseStart = startTime + duration - envelope.release;
  const noteEnd = startTime + duration;

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, attackEnd);

  if (releaseStart > attackEnd) {
    gainNode.gain.setValueAtTime(gain, releaseStart);
  }
  gainNode.gain.linearRampToValueAtTime(0, noteEnd);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(startTime);
  oscillator.stop(noteEnd);
}

/**
 * Schedule a sequence of notes for playback using the current instrument mode.
 * Returns the total duration of the sequence in seconds.
 *
 * @param notes - Array of notes to schedule
 * @param offsetSeconds - Offset from AudioContext.currentTime to begin (default 0.1s for safety)
 * @returns The end time of the last note (in AudioContext.currentTime seconds)
 */
export function scheduleNotes(
  notes: ScheduledNote[],
  offsetSeconds: number = 0.1,
): number {
  const ctx = getAudioContext();
  const baseTime = ctx.currentTime + offsetSeconds;
  let endTime = baseTime;

  for (const note of notes) {
    const noteStart = baseTime + note.startTime;
    const noteEnd = noteStart + note.duration;

    switch (currentMode) {
      case "piano":
        createPianoNote(note.frequency, note.duration, noteStart, 80);
        break;

      case "samples":
        if (instrumentSamples && instrumentSamples.size > 0) {
          // Convert frequency to MIDI for sample lookup
          const midiNumber = frequencyToMidi(note.frequency);
          const match = findClosestSample(midiNumber, instrumentSamples);
          if (match) {
            const buffer = instrumentSamples.get(match.sampleMidi);
            if (buffer) {
              playSample(buffer, noteStart, note.duration, 80, match.playbackRate);
            }
          }
        } else {
          // Fallback to piano if no samples loaded
          createPianoNote(note.frequency, note.duration, noteStart, 80);
        }
        break;

      case "oscillator":
      default:
        playNote(note.frequency, note.duration, noteStart);
        break;
    }

    if (noteEnd > endTime) {
      endTime = noteEnd;
    }
  }

  return endTime;
}

/**
 * Schedule a sequence of NoteEvents for playback using the current instrument mode.
 * Unlike scheduleNotes, this accepts the richer NoteEvent type with MIDI numbers and velocity.
 *
 * @param notes - Array of NoteEvents to schedule
 * @param offsetSeconds - Offset from AudioContext.currentTime to begin (default 0.1s)
 * @returns The end time of the last note (in AudioContext.currentTime seconds)
 */
export function scheduleNoteEvents(
  notes: NoteEvent[],
  offsetSeconds: number = 0.1,
): number {
  const ctx = getAudioContext();
  const baseTime = ctx.currentTime + offsetSeconds;
  let endTime = baseTime;

  for (const note of notes) {
    const noteStart = baseTime + note.startTime;
    const noteEnd = noteStart + note.duration;

    switch (currentMode) {
      case "piano":
        createPianoNote(note.frequency, note.duration, noteStart, note.velocity);
        break;

      case "samples":
        if (instrumentSamples && instrumentSamples.size > 0) {
          const match = findClosestSample(note.midiNumber, instrumentSamples);
          if (match) {
            const buffer = instrumentSamples.get(match.sampleMidi);
            if (buffer) {
              playSample(
                buffer,
                noteStart,
                note.duration,
                note.velocity,
                match.playbackRate,
              );
            }
          }
        } else {
          createPianoNote(note.frequency, note.duration, noteStart, note.velocity);
        }
        break;

      case "oscillator":
      default:
        playNote(note.frequency, note.duration, noteStart, note.velocity);
        break;
    }

    if (noteEnd > endTime) {
      endTime = noteEnd;
    }
  }

  return endTime;
}

/** Stop all audio and close the context. */
export async function stopAll(): Promise<void> {
  const ctx = getAudioContext();
  const stack = new Error().stack?.split("\n").slice(1, 4).join(" <- ") ?? "";
  console.log(`[SynthEngine] stopAll() — state=${ctx?.state ?? "null"} | caller: ${stack}`);
  await closeAudioContext();
}

/** Get the current playback time in seconds. */
export function getCurrentTime(): number {
  try {
    return getAudioContext().currentTime;
  } catch {
    return 0;
  }
}

/** Convert a frequency (Hz) to the nearest MIDI note number. */
function frequencyToMidi(frequency: number): number {
  if (frequency <= 0) return 60; // fallback to middle C
  return Math.round(12 * Math.log2(frequency / 440) + 69);
}
