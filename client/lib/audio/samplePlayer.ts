import { AudioBuffer } from "react-native-audio-api";
import type { NoteEvent } from "../../types/music";
import { getAudioContext } from "./audioContext";

/** Semitone ratio for pitch shifting: 2^(1/12) */
const SEMITONE_RATIO = Math.pow(2, 1 / 12);

/**
 * Play a single audio sample with precise timing and velocity control.
 *
 * @param buffer - The AudioBuffer to play
 * @param startTime - When to start (AudioContext.currentTime seconds)
 * @param duration - How long to play (seconds). The sample will be stopped after this duration.
 * @param velocity - MIDI velocity (0-127) mapped to volume
 * @param playbackRate - Pitch shift factor (1.0 = original pitch)
 */
export function playSample(
  buffer: AudioBuffer,
  startTime: number,
  duration: number,
  velocity: number,
  playbackRate: number = 1.0,
): void {
  const ctx = getAudioContext();

  const source = ctx.createBufferSource();
  const gainNode = ctx.createGain();

  source.buffer = buffer;
  source.playbackRate.setValueAtTime(playbackRate, startTime);

  // Map velocity (0-127) to gain (0.0-1.0)
  const gain = Math.max(0, Math.min(1, velocity / 127));

  // Envelope: quick attack, sustain, short release
  const attackEnd = startTime + 0.01;
  const releaseStart = startTime + duration - 0.05;
  const noteEnd = startTime + duration;

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, attackEnd);

  if (releaseStart > attackEnd) {
    gainNode.gain.setValueAtTime(gain, releaseStart);
  }
  gainNode.gain.linearRampToValueAtTime(0, noteEnd);

  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  source.start(startTime, 0, duration);
}

/**
 * Find the closest available sample for a given MIDI note number.
 * Returns the MIDI number of the closest sample and the required playback rate.
 */
export function findClosestSample(
  targetMidi: number,
  samples: Map<number, AudioBuffer>,
): { sampleMidi: number; playbackRate: number } | null {
  if (samples.size === 0) return null;

  // Exact match
  if (samples.has(targetMidi)) {
    return { sampleMidi: targetMidi, playbackRate: 1.0 };
  }

  // Find closest available sample (prefer closer, then lower)
  let closestMidi = -1;
  let closestDistance = Infinity;

  for (const midi of samples.keys()) {
    const distance = Math.abs(midi - targetMidi);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestMidi = midi;
    }
  }

  if (closestMidi === -1) return null;

  // Calculate playback rate: shift by the semitone difference
  const semitoneDiff = targetMidi - closestMidi;
  const playbackRate = Math.pow(SEMITONE_RATIO, semitoneDiff);

  return { sampleMidi: closestMidi, playbackRate };
}

/**
 * Schedule a sequence of notes using sample-based playback.
 * For each note, finds the closest available sample and pitch-shifts as needed.
 *
 * @param notes - Array of NoteEvents to schedule
 * @param samples - Map of MIDI note number to AudioBuffer
 * @param offset - Time offset from AudioContext.currentTime (default 0.1s)
 * @returns The end time of the last scheduled note (in AudioContext.currentTime seconds)
 */
export function scheduleNotesWithSamples(
  notes: NoteEvent[],
  samples: Map<number, AudioBuffer>,
  offset: number = 0.1,
): number {
  const ctx = getAudioContext();
  const baseTime = ctx.currentTime + offset;
  let endTime = baseTime;

  for (const note of notes) {
    const match = findClosestSample(note.midiNumber, samples);
    if (!match) continue;

    const buffer = samples.get(match.sampleMidi);
    if (!buffer) continue;

    const noteStart = baseTime + note.startTime;
    const noteEnd = noteStart + note.duration;

    playSample(buffer, noteStart, note.duration, note.velocity, match.playbackRate);

    if (noteEnd > endTime) {
      endTime = noteEnd;
    }
  }

  return endTime;
}
